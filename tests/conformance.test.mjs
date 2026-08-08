import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { analyzeConformance, parseConformanceInput, renderConformanceReport } from "../scripts/conformance.mjs";

const root = new URL("../", import.meta.url).pathname;
const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
const snapshotPolicy = snapshot.policies.find((policy) => policy.slug === "invoice-exception-triage");
const examplesDirectory = join(root, "workflows", "finance", "invoice-exception-triage", "examples");
const low = JSON.parse(await readFile(join(examplesDirectory, "low-risk.json"), "utf8"));
const high = JSON.parse(await readFile(join(examplesDirectory, "high-risk.json"), "utf8"));
const invalid = JSON.parse(await readFile(join(examplesDirectory, "invalid.json"), "utf8"));

test("conformance input accepts arrays, single objects, and JSON Lines", () => {
  assert.deepEqual(parseConformanceInput(JSON.stringify([low, high])), [low, high]);
  assert.deepEqual(parseConformanceInput(JSON.stringify(low)), [low]);
  assert.deepEqual(parseConformanceInput(`${JSON.stringify(low)}\n${JSON.stringify(high)}\n`), [low, high]);
});

test("conformance input errors do not echo malformed input", () => {
  const privateValue = "private-customer-name";
  assert.throws(
    () => parseConformanceInput(`${JSON.stringify(low)}\n{\"name\":\"${privateValue}\",}`),
    (error) => error.message.includes("line 2") && !error.message.includes(privateValue)
  );
  assert.throws(() => parseConformanceInput("[]"), /at least one record/);
  assert.throws(() => parseConformanceInput(JSON.stringify([low, high]), { maxRecords: 1 }), /configured limit is 1/);
});

test("aggregate report measures outcomes, rule exercise, violations, and scores", () => {
  const report = analyzeConformance({ snapshotPolicy, records: [low, high, invalid] });
  assert.deepEqual(report.sample, { total: 3, valid: 2, invalid: 1, invalidRate: 0.3333 });
  assert.equal(report.outcomes.priorityBands.find((item) => item.band === "low").count, 1);
  assert.equal(report.outcomes.priorityBands.find((item) => item.band === "high").count, 1);
  assert.equal(report.scores.count, 2);
  assert.ok(report.rules.observed > 0);
  assert.ok(report.violations.total >= 2);
  assert.ok(report.violations.counts.some((item) => item.code === "required"));
});

test("aggregate report cannot leak caller values or request identifiers", () => {
  const privateValue = "private-acquisition-target";
  const report = analyzeConformance({
    snapshotPolicy,
    records: [{ ...low, privateContext: privateValue, invoiceId: privateValue }]
  });
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(privateValue), false);
  assert.equal(serialized.includes("conformance-1"), false);
  assert.deepEqual(report.privacy, {
    mode: "aggregate-only",
    rawPayloadsIncluded: false,
    requestIdentifiersIncluded: false
  });
});

test("configured conformance gates fail closed with actionable evidence", () => {
  const report = analyzeConformance({
    snapshotPolicy,
    records: [low, invalid],
    gates: { minRecords: 3, maxInvalidRate: 0, minRuleCoverage: 1, requireBands: ["low", "high"] }
  });
  assert.equal(report.passed, false);
  assert.equal(report.gates.length, 4);
  assert.ok(report.gates.every((gate) => gate.passed === false));
  assert.deepEqual(report.gates.find((gate) => gate.gate === "requireBands").missing, ["high"]);
});

test("Markdown rendering declares privacy behavior and reports gate state", () => {
  const report = analyzeConformance({ snapshotPolicy, records: [low, high], gates: { requireBands: ["low", "high"] } });
  const markdown = renderConformanceReport(report);
  assert.match(markdown, /aggregate-only/);
  assert.match(markdown, /Gate result: \*\*PASS\*\*/);
  assert.match(markdown, /Unobserved rules:/);
  assert.equal(markdown.includes(low.invoiceId), false);
});

test("CLI emits JSON and uses exit 2 only for failed quality gates", () => {
  const input = join(examplesDirectory, "low-risk.json");
  const success = spawnSync(process.execPath, ["scripts/conformance-cli.mjs", "invoice-exception-triage", input, "--json"], { cwd: root, encoding: "utf8" });
  assert.equal(success.status, 0, success.stderr);
  const parsed = JSON.parse(success.stdout);
  assert.equal(parsed.workflow.slug, "invoice-exception-triage");
  assert.equal(parsed.sample.total, 1);

  const stdinSuccess = spawnSync(process.execPath, ["scripts/conformance-cli.mjs", "invoice-exception-triage", "-", "--json"], { cwd: root, encoding: "utf8", input: JSON.stringify(low) });
  assert.equal(stdinSuccess.status, 0, stdinSuccess.stderr);
  assert.equal(JSON.parse(stdinSuccess.stdout).sample.total, 1);

  const evaluateStdin = spawnSync(process.execPath, ["scripts/evaluate-policy.mjs", "invoice-exception-triage", "-"], { cwd: root, encoding: "utf8", input: JSON.stringify(low) });
  assert.equal(evaluateStdin.status, 0, evaluateStdin.stderr);
  assert.equal(JSON.parse(evaluateStdin.stdout).workflow, "invoice-exception-triage");

  const failedGate = spawnSync(process.execPath, ["scripts/conformance-cli.mjs", "invoice-exception-triage", input, "--require-bands", "high", "--json"], { cwd: root, encoding: "utf8" });
  assert.equal(failedGate.status, 2, failedGate.stderr);
  assert.equal(JSON.parse(failedGate.stdout).passed, false);

  const badUsage = spawnSync(process.execPath, ["scripts/conformance-cli.mjs", "invoice-exception-triage", input, "--unknown"], { cwd: root, encoding: "utf8" });
  assert.equal(badUsage.status, 1);
  assert.match(badUsage.stderr, /Unknown option/);

  const emptyBands = spawnSync(process.execPath, ["scripts/conformance-cli.mjs", "invoice-exception-triage", input, "--require-bands", ","], { cwd: root, encoding: "utf8" });
  assert.equal(emptyBands.status, 1);
  assert.match(emptyBands.stderr, /requires at least one band/);
});
