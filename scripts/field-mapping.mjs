import { fingerprint } from "./policy-governance.mjs";

export const fieldMappingVersion = 1;
export const supportedMappingTransforms = ["identity", "trim", "uppercase", "lowercase", "finiteNumber", "strictBoolean"];

const unsafeSegments = new Set(["__proto__", "prototype", "constructor"]);

function escapePointerSegment(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointerSegments(pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    throw new Error("Mapping sources must be non-empty JSON Pointers beginning with /");
  }
  return pointer.slice(1).split("/").map((segment) => {
    if (/~(?![01])/u.test(segment)) throw new Error("Mapping source contains an invalid JSON Pointer escape");
    const decoded = segment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (unsafeSegments.has(decoded)) throw new Error("Mapping source contains an unsafe property segment");
    return decoded;
  });
}

function readPointer(input, segments) {
  let current = input;
  for (const segment of segments) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, segment)) {
      return { found: false };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function transformValue(value, transform) {
  if (transform === "identity") return value;
  if (["trim", "uppercase", "lowercase"].includes(transform)) {
    if (typeof value !== "string") throw new Error("string_required");
    const trimmed = value.trim();
    if (transform === "trim") return trimmed;
    return transform === "uppercase" ? trimmed.toUpperCase() : trimmed.toLowerCase();
  }
  if (transform === "finiteNumber") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    throw new Error("finite_number_required");
  }
  if (transform === "strictBoolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && ["true", "false"].includes(value.trim().toLowerCase())) {
      return value.trim().toLowerCase() === "true";
    }
    throw new Error("strict_boolean_required");
  }
  throw new Error("unsupported_transform");
}

export function createIdentityMapping(snapshotPolicy) {
  if (!snapshotPolicy?.behavior?.inputSchema?.properties) throw new Error("A complete snapshot policy is required");
  return {
    mappingVersion: fieldMappingVersion,
    workflow: snapshotPolicy.slug,
    policyFingerprint: snapshotPolicy.fingerprint,
    fields: Object.fromEntries(
      Object.keys(snapshotPolicy.behavior.inputSchema.properties).map((field) => [field, {
        source: `/${escapePointerSegment(field)}`,
        transform: "identity"
      }])
    )
  };
}

export function validateFieldMapping(mapping, snapshotPolicy) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("Mapping must be a JSON object");
  const extraKeys = Object.keys(mapping).filter((key) => !["mappingVersion", "workflow", "policyFingerprint", "fields"].includes(key));
  if (extraKeys.length) throw new Error(`Mapping contains unsupported option: ${extraKeys[0]}`);
  if (mapping.mappingVersion !== fieldMappingVersion) throw new Error(`mappingVersion must be ${fieldMappingVersion}`);
  if (mapping.workflow !== snapshotPolicy.slug) throw new Error(`Mapping workflow must be ${snapshotPolicy.slug}`);
  if (mapping.policyFingerprint !== snapshotPolicy.fingerprint) {
    throw new Error(`Mapping policyFingerprint must match the current snapshot for ${snapshotPolicy.slug}`);
  }
  if (!mapping.fields || typeof mapping.fields !== "object" || Array.isArray(mapping.fields)) throw new Error("Mapping fields must be an object");

  const schema = snapshotPolicy.behavior.inputSchema;
  const knownFields = new Set(Object.keys(schema.properties));
  for (const field of schema.required) {
    if (!Object.hasOwn(mapping.fields, field)) throw new Error(`Required target field ${field} is not mapped`);
  }

  const compiledFields = [];
  for (const [field, configuration] of Object.entries(mapping.fields)) {
    if (!knownFields.has(field)) throw new Error(`Unknown target field: ${field}`);
    if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
      throw new Error(`Mapping for ${field} must be an object`);
    }
    const extraFieldKeys = Object.keys(configuration).filter((key) => !["source", "transform"].includes(key));
    if (extraFieldKeys.length) throw new Error(`Mapping for ${field} contains unsupported option: ${extraFieldKeys[0]}`);
    const transform = configuration.transform ?? "identity";
    if (!supportedMappingTransforms.includes(transform)) throw new Error(`Mapping for ${field} uses unsupported transform: ${transform}`);
    compiledFields.push({
      field,
      required: schema.required.includes(field),
      sourceSegments: pointerSegments(configuration.source),
      transform
    });
  }
  return {
    mappingVersion: mapping.mappingVersion,
    workflow: mapping.workflow,
    policyFingerprint: mapping.policyFingerprint,
    fingerprint: fingerprint(mapping),
    fields: compiledFields
  };
}

export function applyFieldMapping(compiledMapping, sourceRecord) {
  if (!sourceRecord || typeof sourceRecord !== "object" || Array.isArray(sourceRecord)) {
    return { ok: false, errors: [{ field: "$", code: "source_not_object" }] };
  }
  const value = {};
  const errors = [];
  for (const field of compiledMapping.fields) {
    const source = readPointer(sourceRecord, field.sourceSegments);
    if (!source.found) {
      if (field.required) errors.push({ field: field.field, code: "source_missing" });
      continue;
    }
    try {
      value[field.field] = transformValue(source.value, field.transform);
    } catch {
      errors.push({ field: field.field, code: "transform_failed" });
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
