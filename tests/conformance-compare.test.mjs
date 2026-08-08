import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compareConformanceReports, renderConformanceComparison } from "../scripts/conformance-compare.mjs";
import { analyzeConformance } from "../scripts/conformance.mjs";

const root = new URL("../", import.meta.url).pathname;
const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
const snapshotPolicy = snapshot.policies.find((policy) => policy.slug === "invoice-exception-triage");
const examples = join(root, "workflows", "finance", "invoice-exception-triage", "examples");
const low = JSON.parse(await readFile(join(examples, "low-risk.json"), "utf8"));
const high = JSON.parse(await readFile(join(examples, "high-risk.json"), "utf8"));
const invalid = JSON.parse(await readFile(join(examples, "invalid.json"), "utf8"));

function report(records) {
  return analyzeConformance({ snapshotPolicy, records });
}

test("comparison quantifies sample, invalid-rate, score, band, decision, and rule movement", () => {
  const comparison = compareConformanceReports({ baseline: report([low, high]), current: report([high, high, invalid]) });
  assert.equal(comparison.sample.baseline, 2);
  assert.equal(comparison.sample.current, 3);
  assert.equal(comparison.sample.invalidRateDelta, 0.3333);
  assert.equal(comparison.scores.averageDelta, 50);
  assert.equal(comparison.priorityBands.find((item) => item.band === "high").delta, 0.5);
  assert.equal(comparison.decisions.find((item) => item.decision === "hold_payment_and_escalate").delta, 0.5);
  assert.ok(comparison.rules.every((item) => item.absoluteDelta === 0.5));
  assert.ok(comparison.contractViolations.some((item) => item.code === "required"));
});

test("comparison gates fail on operationally significant shifts", () => {
  const comparison = compareConformanceReports({
    baseline: report([low, high]),
    current: report([high, high, invalid]),
    gates: {
      minCurrentRecords: 10,
      maxInvalidRateIncrease: 0.1,
      maxBandRateDelta: 0.2,
      maxRuleRateDelta: 0.2,
      maxAverageScoreDelta: 20
    }
  });
  assert.equal(comparison.passed, false);
  assert.equal(comparison.gates.length, 5);
  assert.ok(comparison.gates.every((gate) => gate.passed === false));
});

test("comparison rejects policy and mapping identity changes", () => {
  const baseline = report([low]);
  const changedPolicy = structuredClone(baseline);
  changedPolicy.workflow.policyVersion = "2.0.0";
  assert.throws(() => compareConformanceReports({ baseline, current: changedPolicy }), /policy version and fingerprint/);

  const mappedBaseline = structuredClone(baseline);
  mappedBaseline.mapping = { enabled: true, fingerprint: `sha256:${"a".repeat(64)}`, errors: { counts: [] } };
  const mappedCurrent = structuredClone(mappedBaseline);
  mappedCurrent.mapping.fingerprint = `sha256:${"b".repeat(64)}`;
  assert.throws(() => compareConformanceReports({ baseline: mappedBaseline, current: mappedCurrent }), /mapping fingerprint/);
});

test("comparison rejects reports that could include raw data", () => {
  const unsafe = report([low]);
  unsafe.privacy.rawPayloadsIncluded = true;
  assert.throws(() => compareConformanceReports({ baseline: unsafe, current: report([low]) }), /not an aggregate-only/);
});

test("Markdown rendering carries identity, drift evidence, caveat, and no payload values", () => {
  const comparison = compareConformanceReports({ baseline: report([low]), current: report([high]) });
  const markdown = renderConformanceComparison(comparison);
  assert.match(markdown, /Conformance drift: invoice-exception-triage/);
  assert.match(markdown, /Rule-frequency movement/);
  assert.match(markdown, /not statistical or causal proof/);
  assert.equal(markdown.includes(low.invoiceId), false);
});

test("comparison CLI emits JSON and exits 2 for failed gates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "n8n-conformance-compare-"));
  const baselinePath = join(directory, "baseline.json");
  const currentPath = join(directory, "current.json");
  try {
    await Promise.all([
      writeFile(baselinePath, JSON.stringify(report([low, high]))),
      writeFile(currentPath, JSON.stringify(report([high, high, invalid])))
    ]);
    const result = spawnSync(process.execPath, [
      "scripts/conformance-compare-cli.mjs",
      baselinePath,
      currentPath,
      "--max-band-rate-delta", "0.2",
      "--json"
    ], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(JSON.parse(result.stdout).passed, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
