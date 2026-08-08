import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { compareConformanceReports } from "../scripts/conformance-compare.mjs";
import { analyzeConformance } from "../scripts/conformance.mjs";
import { createIdentityMapping } from "../scripts/field-mapping.mjs";

const root = new URL("../", import.meta.url).pathname;
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const [mappingSchema, reportSchema, comparisonSchema, snapshot] = await Promise.all([
  readJson("schemas/field-mapping.schema.json"),
  readJson("schemas/conformance-report.schema.json"),
  readJson("schemas/conformance-comparison.schema.json"),
  readJson("policy-snapshot.json")
]);
const policy = snapshot.policies.find((candidate) => candidate.slug === "invoice-exception-triage");
const examples = join(root, "workflows", "finance", "invoice-exception-triage", "examples");
const low = await readFile(join(examples, "low-risk.json"), "utf8").then(JSON.parse);
const high = await readFile(join(examples, "high-risk.json"), "utf8").then(JSON.parse);
const invalid = await readFile(join(examples, "invalid.json"), "utf8").then(JSON.parse);

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function schemaIssues(value, schema, rootSchema, path = "$") {
  if (schema === true || schema === undefined) return [];
  if (schema === false) return [`${path}: forbidden by schema`];
  if (schema.$ref) {
    const parts = schema.$ref.replace(/^#\//, "").split("/");
    const resolved = parts.reduce((current, part) => current?.[part.replaceAll("~1", "/").replaceAll("~0", "~")], rootSchema);
    return resolved ? schemaIssues(value, resolved, rootSchema, path) : [`${path}: unresolved ${schema.$ref}`];
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) => schemaIssues(value, candidate, rootSchema, path).length === 0);
    return matches.length === 1 ? [] : [`${path}: expected exactly one schema match, found ${matches.length}`];
  }
  if (schema.allOf) return schema.allOf.flatMap((candidate) => schemaIssues(value, candidate, rootSchema, path));
  const issues = [];
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) issues.push(`${path}: const mismatch`);
  if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) issues.push(`${path}: enum mismatch`);
  if (schema.type && !typeMatches(value, schema.type)) return [...issues, `${path}: expected ${schema.type}`];
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push(`${path}: too short`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) issues.push(`${path}: pattern mismatch`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) issues.push(`${path}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) issues.push(`${path}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(`${path}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) issues.push(`${path}: too many items`);
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) issues.push(`${path}: duplicate items`);
    value.forEach((item, index) => issues.push(...schemaIssues(item, schema.items, rootSchema, `${path}[${index}]`)));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) issues.push(`${path}: missing ${required}`);
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) issues.push(`${path}: too few properties`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.propertyNames) issues.push(...schemaIssues(key, schema.propertyNames, rootSchema, `${path}{key}`));
      if (schema.properties?.[key]) issues.push(...schemaIssues(item, schema.properties[key], rootSchema, `${path}.${key}`));
      else if (schema.additionalProperties === false) issues.push(`${path}: unknown ${key}`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        issues.push(...schemaIssues(item, schema.additionalProperties, rootSchema, `${path}.${key}`));
      }
    }
  }
  return issues;
}

function assertMatches(document, schema) {
  assert.deepEqual(schemaIssues(document, schema, schema), []);
}

test("published field-mapping schema accepts generated mappings and rejects extensions", () => {
  const mapping = createIdentityMapping(policy);
  assertMatches(mapping, mappingSchema);
  assert.ok(schemaIssues({ ...mapping, executable: true }, mappingSchema, mappingSchema).some((issue) => issue.includes("unknown executable")));
});

test("published conformance schema accepts aggregate reports and locks privacy flags", () => {
  const report = analyzeConformance({ snapshotPolicy: policy, records: [low, high, invalid] });
  assertMatches(report, reportSchema);
  const unsafe = structuredClone(report);
  unsafe.privacy.rawPayloadsIncluded = true;
  assert.ok(schemaIssues(unsafe, reportSchema, reportSchema).some((issue) => issue.includes("const mismatch")));
});

test("published comparison schema accepts drift reports and requires interpretation", () => {
  const baseline = analyzeConformance({ snapshotPolicy: policy, records: [low, high] });
  const current = analyzeConformance({ snapshotPolicy: policy, records: [high, invalid] });
  const comparison = compareConformanceReports({ baseline, current });
  assertMatches(comparison, comparisonSchema);
  delete comparison.interpretation;
  assert.ok(schemaIssues(comparison, comparisonSchema, comparisonSchema).some((issue) => issue.includes("missing interpretation")));
});
