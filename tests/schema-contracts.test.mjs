import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { compareConformanceReports } from "../scripts/conformance-compare.mjs";
import { analyzeConformance } from "../scripts/conformance.mjs";
import { createIdentityMapping } from "../scripts/field-mapping.mjs";
import { schemaContractIssues } from "../scripts/schema-contract-check.mjs";

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

function assertMatches(document, schema) {
  assert.deepEqual(schemaContractIssues(document, schema, schema), []);
}

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
