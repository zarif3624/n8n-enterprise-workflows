import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { compareConformanceReports } from "../scripts/conformance-compare.mjs";
import { analyzeConformance } from "../scripts/conformance.mjs";
import { createIdentityMapping } from "../scripts/field-mapping.mjs";
import { policyEngineVersion } from "../scripts/policy-engine.mjs";
import { runtimeCompatibilityIssues, runtimeCompatibilityMatrix } from "../scripts/runtime-compatibility.mjs";
import { schemaContractIssues } from "../scripts/schema-contract-check.mjs";

const root = new URL("../", import.meta.url).pathname;
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const [catalogSchema, mappingSchema, reportSchema, comparisonSchema, compatibilitySchema, lifecycleSchema, compatibility, lifecycle, catalog, snapshot] = await Promise.all([
  readJson("schemas/catalog.schema.json"),
  readJson("schemas/field-mapping.schema.json"),
  readJson("schemas/conformance-report.schema.json"),
  readJson("schemas/conformance-comparison.schema.json"),
  readJson("schemas/runtime-compatibility.schema.json"),
  readJson("schemas/policy-lifecycle.schema.json"),
  readJson("runtime-compatibility.json"),
  readJson("policy-lifecycle.json"),
  readJson("catalog.json"),
  readJson("policy-snapshot.json")
]);
const policy = snapshot.policies.find((candidate) => candidate.slug === "invoice-exception-triage");
const examples = join(root, "workflows", "finance", "invoice-exception-triage", "examples");
const low = await readFile(join(examples, "low-risk.json"), "utf8").then(JSON.parse);
const high = await readFile(join(examples, "high-risk.json"), "utf8").then(JSON.parse);
const invalid = await readFile(join(examples, "invalid.json"), "utf8").then(JSON.parse);

function assertMatches(document, schema) {
  assert.deepEqual(schemaContractIssues(document, schema, schema), []);
}

test("published catalog schema accepts every workflow and rejects undocumented metadata", () => {
  assertMatches(catalog, catalogSchema);
  const extended = structuredClone(catalog);
  extended[0].unreviewedExtension = true;
  assert.ok(schemaContractIssues(extended, catalogSchema, catalogSchema).some((issue) => issue.includes("unknown unreviewedExtension")));
});

test("published field-mapping schema accepts generated mappings and rejects extensions", () => {
  const mapping = createIdentityMapping(policy);
  assertMatches(mapping, mappingSchema);
  assert.ok(schemaContractIssues({ ...mapping, executable: true }, mappingSchema, mappingSchema).some((issue) => issue.includes("unknown executable")));
});

test("published conformance schema accepts aggregate reports and locks privacy flags", () => {
  const report = analyzeConformance({ snapshotPolicy: policy, records: [low, high, invalid] });
  assertMatches(report, reportSchema);
  const unsafe = structuredClone(report);
  unsafe.privacy.rawPayloadsIncluded = true;
  assert.ok(schemaContractIssues(unsafe, reportSchema, reportSchema).some((issue) => issue.includes("const mismatch")));
});

test("published comparison schema accepts drift reports and requires interpretation", () => {
  const baseline = analyzeConformance({ snapshotPolicy: policy, records: [low, high] });
  const current = analyzeConformance({ snapshotPolicy: policy, records: [high, invalid] });
  const comparison = compareConformanceReports({ baseline, current });
  assertMatches(comparison, comparisonSchema);
  delete comparison.interpretation;
  assert.ok(schemaContractIssues(comparison, comparisonSchema, comparisonSchema).some((issue) => issue.includes("missing interpretation")));
});

test("published runtime compatibility plan drives a pinned, complete CI matrix", () => {
  assertMatches(compatibility, compatibilitySchema);
  assert.deepEqual(runtimeCompatibilityIssues(compatibility, { catalog, policyEngineVersion }), []);
  assert.deepEqual(runtimeCompatibilityMatrix(compatibility), compatibility.scheduledN8nVersions.map((version) => ({
    "n8n-version": version,
    "node-version": compatibility.nodeVersion
  })));
  const drifted = structuredClone(compatibility);
  drifted.policyEngineVersion = "0.0.0";
  assert.ok(runtimeCompatibilityIssues(drifted, { catalog, policyEngineVersion }).some((issue) => issue.includes("policyEngineVersion")));
});

test("published policy lifecycle contract accepts the governed catalog", () => {
  assertMatches(lifecycle, lifecycleSchema);
  const unsafe = structuredClone(lifecycle);
  unsafe.policies[0].unreviewedOverride = true;
  assert.ok(schemaContractIssues(unsafe, lifecycleSchema, lifecycleSchema).some((issue) => issue.includes("unknown unreviewedOverride")));
});
