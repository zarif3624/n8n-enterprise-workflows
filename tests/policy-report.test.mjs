import assert from "node:assert/strict";
import test from "node:test";
import { renderPolicyChangeReport } from "../scripts/report-policy-changes.mjs";

function policy(overrides = {}) {
  return {
    department: "finance",
    slug: "invoice-review",
    name: "Review invoices",
    owner: "Finance Operations",
    policyVersion: "1.0.0",
    fingerprint: "sha256:before",
    behavior: {
      inputSchema: {
        required: ["invoiceId"],
        properties: { invoiceId: { type: "string" } }
      },
      rules: [{ field: "amount", operator: "gte", value: 100, points: 20, reason: "High value" }],
      thresholds: { medium: 30, high: 70 },
      decisions: { low: "continue", medium: "review", high: "hold" },
      actions: ["Record decision"]
    },
    ...overrides
  };
}

test("policy report is quiet when snapshots are identical", () => {
  const snapshot = { policies: [policy()] };
  const report = renderPolicyChangeReport(snapshot, structuredClone(snapshot), { baseRef: "origin/main" });
  assert.match(report, /No policy definition.*changes detected/);
});

test("policy report explains contract, rule, decision, action, and owner changes", () => {
  const before = { policies: [policy()] };
  const changed = policy({
    owner: "Accounts Payable",
    policyVersion: "1.1.0",
    fingerprint: "sha256:after"
  });
  changed.behavior = structuredClone(changed.behavior);
  changed.behavior.inputSchema.required.push("vendorId");
  changed.behavior.inputSchema.properties.vendorId = { type: "string" };
  changed.behavior.rules[0].points = 40;
  changed.behavior.decisions.medium = "manual_review";
  changed.behavior.actions.push("Notify owner");
  const report = renderPolicyChangeReport(before, { policies: [changed] }, { baseRef: "origin/main" });
  assert.match(report, /1 policy change set/);
  assert.match(report, /Owner:/);
  assert.match(report, /Required fields: added `vendorId`/);
  assert.match(report, /Rule changed `amount_gte`/);
  assert.match(report, /medium decision:/);
  assert.match(report, /Recommended actions: added `Notify owner`/);
});

test("policy report handles first snapshots and additions", () => {
  assert.match(renderPolicyChangeReport(null, { policies: [policy()] }), /first governed snapshot/);
  const report = renderPolicyChangeReport({ policies: [] }, { policies: [policy()] });
  assert.match(report, /Added at policy version/);
});

test("policy report calls out shared schema and engine changes", () => {
  const before = { policySchemaVersion: "1.0", policyEngineVersion: "1.0.0", policyEngineFingerprint: "sha256:old", policies: [] };
  const after = { policySchemaVersion: "2.0", policyEngineVersion: "1.1.0", policyEngineFingerprint: "sha256:new", policies: [] };
  const report = renderPolicyChangeReport(before, after);
  assert.match(report, /Policy schema: `1.0` → `2.0`/);
  assert.match(report, /Shared policy engine: `1.0.0` → `1.1.0`/);
  assert.match(report, /Policy engine source fingerprint: `sha256:old` → `sha256:new`/);
});

test("policy report explains rule additions, removals, and threshold changes", () => {
  const original = policy();
  const changed = structuredClone(original);
  changed.policyVersion = "1.1.0";
  changed.fingerprint = "sha256:after";
  changed.behavior.rules = [{ field: "blocked", operator: "truthy", points: 80, reason: "Blocked vendor" }];
  changed.behavior.thresholds.high = 60;
  const report = renderPolicyChangeReport({ policies: [original] }, { policies: [changed] });
  assert.match(report, /Rule added `blocked_truthy`/);
  assert.match(report, /Rule removed `amount_gte`/);
  assert.match(report, /high threshold: `70` → `60`/);
});
