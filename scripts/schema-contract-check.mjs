function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function resolveReference(reference, rootSchema) {
  if (!reference.startsWith("#/")) return null;
  return reference.slice(2).split("/").reduce(
    (current, part) => current?.[part.replaceAll("~1", "/").replaceAll("~0", "~")],
    rootSchema
  );
}

function declaredProperties(schema, rootSchema, seen = new Set()) {
  if (!schema || typeof schema !== "object" || seen.has(schema)) return new Set();
  seen.add(schema);
  const names = new Set(Object.keys(schema.properties ?? {}));
  if (schema.$ref) {
    for (const name of declaredProperties(resolveReference(schema.$ref, rootSchema), rootSchema, seen)) names.add(name);
  }
  for (const child of schema.allOf ?? []) {
    for (const name of declaredProperties(child, rootSchema, seen)) names.add(name);
  }
  return names;
}

export function schemaContractIssues(value, schema, rootSchema = schema, path = "$") {
  if (schema === true || schema === undefined) return [];
  if (schema === false) return [`${path}: forbidden by schema`];
  const issues = [];
  if (schema.$ref) {
    const resolved = resolveReference(schema.$ref, rootSchema);
    if (!resolved) return [`${path}: unresolved ${schema.$ref}`];
    issues.push(...schemaContractIssues(value, resolved, rootSchema, path));
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => schemaContractIssues(value, candidate, rootSchema, path).length === 0);
    if (matches.length !== 1) issues.push(`${path}: expected exactly one schema match, found ${matches.length}`);
  }
  if (schema.anyOf && !schema.anyOf.some((candidate) => schemaContractIssues(value, candidate, rootSchema, path).length === 0)) {
    issues.push(`${path}: expected at least one schema match`);
  }
  for (const candidate of schema.allOf ?? []) issues.push(...schemaContractIssues(value, candidate, rootSchema, path));
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) issues.push(`${path}: const mismatch`);
  if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) issues.push(`${path}: enum mismatch`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeMatches(value, type))) return [...issues, `${path}: expected ${types.join(" or ")}`];
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push(`${path}: too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) issues.push(`${path}: too long`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) issues.push(`${path}: pattern mismatch`);
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) issues.push(`${path}: invalid email`);
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) issues.push(`${path}: invalid date-time`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) issues.push(`${path}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) issues.push(`${path}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(`${path}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) issues.push(`${path}: too many items`);
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) issues.push(`${path}: duplicate items`);
    value.forEach((item, index) => issues.push(...schemaContractIssues(item, schema.items, rootSchema, `${path}[${index}]`)));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) issues.push(`${path}: missing ${required}`);
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) issues.push(`${path}: too few properties`);
    const evaluated = declaredProperties(schema, rootSchema);
    for (const [key, item] of Object.entries(value)) {
      if (schema.propertyNames) issues.push(...schemaContractIssues(key, schema.propertyNames, rootSchema, `${path}{key}`));
      if (schema.properties?.[key]) issues.push(...schemaContractIssues(item, schema.properties[key], rootSchema, `${path}.${key}`));
      else if (schema.additionalProperties === false) issues.push(`${path}: unknown ${key}`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        issues.push(...schemaContractIssues(item, schema.additionalProperties, rootSchema, `${path}.${key}`));
      }
      if (schema.unevaluatedProperties === false && !evaluated.has(key)) issues.push(`${path}: unevaluated ${key}`);
    }
  }
  return [...new Set(issues)];
}

export function assertSchemaContract(value, schema, rootSchema = schema, label = "Document") {
  const issues = schemaContractIssues(value, schema, rootSchema);
  if (issues.length) throw new Error(`${label} does not match its schema:\n- ${issues.join("\n- ")}`);
}
