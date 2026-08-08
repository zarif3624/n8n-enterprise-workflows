import assert from "node:assert/strict";
import test from "node:test";
import {
  renderPolicyImpactReport,
  replayPolicyImpact,
  ruleWitnessCases,
  uniqueReplayCases
} from "../scripts/policy-replay.mjs";

function policy(overrides = {}) {
  return {
    slug: "invoice-review",
    policyVersion: "1.0.0",
    inputSchema: {
      type: "object",
      required: ["amount"],
      properties: { amount: { type: "number", minimum: 0 } },
      additionalProperties: true
    },
    rules: [{ field: "amount", operator: "gte", value: 100, points: 40, reason: "High value" }],
    thresholds: { medium: 30, high: 70 },
    decisions: { low: "continue", medium: "review", high: "hold" },
    actions: ["Record decision"],
    ...overrides
  };
}

test("rule witnesses isolate each rule and duplicate payloads retain their labels", () => {
  const witnesses = ruleWitnessCases(policy(), { amount: 10 }, "current");
  assert.deepEqual(witnesses[0], {
    labels: ["current:rule:amount_gte_1"],
    payload: { amount: 100 }
  });
  const unique = uniqueReplayCases([
    witnesses[0],
    { labels: ["current:fixture:high-risk"], payload: { amount: 100 } }
  ]);
  assert.equal(unique.length, 1);
  assert.deepEqual(unique[0].labels, ["current:fixture:high-risk", "current:rule:amount_gte_1"]);
});

test("policy replay reports changed scores, bands, decisions, rules, and actions", () => {
  const before = policy();
  const after = policy({
    policyVersion: "1.1.0",
    rules: [{ field: "amount", operator: "gte", value: 100, points: 80, reason: "Material value" }],
    actions: ["Record decision", "Require approval"]
  });
  const impact = replayPolicyImpact({
    before,
    after,
    cases: [{ labels: ["current:fixture:high-risk"], payload: { amount: 100 } }]
  });
  assert.equal(impact.caseCount, 1);
  assert.equal(impact.changes.length, 1);
  const report = renderPolicyImpactReport([{ slug: "invoice-review", status: "changed", ...impact }]);
  assert.match(report, /score `40` → `80`/);
  assert.match(report, /band `medium` → `high`/);
  assert.match(report, /decision `review` → `hold`/);
  assert.match(report, /Require approval/);
  assert.match(report, /Material value/);
});

test("policy replay exposes validation-contract impact", () => {
  const before = policy();
  const after = policy({
    inputSchema: {
      type: "object",
      required: ["amount", "owner"],
      properties: { amount: { type: "number" }, owner: { type: "string" } },
      additionalProperties: true
    }
  });
  const impact = replayPolicyImpact({
    before,
    after,
    cases: [{ labels: ["base:fixture:low-risk"], payload: { amount: 10 } }]
  });
  const report = renderPolicyImpactReport([{ slug: "invoice-review", status: "changed", ...impact }]);
  assert.match(report, /HTTP `200` → `400`/);
  assert.match(report, /owner\/required\/string/);
});

test("impact report handles unchanged corpora, new baselines, and engine warnings", () => {
  const impact = replayPolicyImpact({
    before: policy(),
    after: structuredClone(policy()),
    cases: [{ labels: ["base:fixture:low-risk"], payload: { amount: 10 } }]
  });
  const report = renderPolicyImpactReport([{ slug: "invoice-review", status: "changed", ...impact }], { engineChanged: true });
  assert.match(report, /0 of 1/);
  assert.match(report, /evidence, not proof/);
  assert.match(report, /current evaluator/);
  assert.match(renderPolicyImpactReport([], { baselineMissing: true }), /establishes the behavioral replay baselines/);
});
