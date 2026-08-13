import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { evaluatePolicy } from "../scripts/policy-engine.mjs";
import { matchingValue } from "../scripts/policy-replay.mjs";
import { adaptersFor, inputSchemaFor, policyFor, thresholds, workflows } from "../scripts/workflow-definitions.mjs";

const root = new URL("../", import.meta.url).pathname;

function expectedBand(score) {
  return score >= thresholds.high ? "high" : score >= thresholds.medium ? "medium" : "low";
}

test("definition contracts and adapters override generic workflow defaults", () => {
  const definition = {
    department: "synthetic",
    slug: "contract-capability-probe",
    policyVersion: "1.0.4",
    required: ["quantity", "approved", "tier", "tags", "scheduledAt", "title"],
    optional: [],
    fieldContracts: {
      quantity: { type: "number", minimum: 1, maximum: 25 },
      approved: { type: "boolean" },
      tier: { type: "string", enum: ["standard", "expedited"], minLength: 1, maxLength: 20 },
      tags: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 2, maxLength: 12 } },
      scheduledAt: { type: "string", format: "date-time", minLength: 1, maxLength: 64 },
      title: { type: "string", minLength: 3, maxLength: 80 }
    },
    adapters: ["Synthetic queue", "Synthetic record store"]
  };

  assert.deepEqual(inputSchemaFor(definition), {
    type: "object",
    required: ["quantity", "approved", "tier", "tags", "scheduledAt", "title"],
    properties: {
      quantity: { type: "number", minimum: 1, maximum: 25 },
      approved: { type: "boolean" },
      tier: { type: "string", enum: ["standard", "expedited"], minLength: 1, maxLength: 20, pattern: "\\S" },
      tags: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 2, maxLength: 12 } },
      scheduledAt: { type: "string", format: "date-time", minLength: 1, maxLength: 64, pattern: "\\S" },
      title: { type: "string", minLength: 3, maxLength: 80, pattern: "\\S" }
    },
    additionalProperties: true
  });
  assert.deepEqual(adaptersFor(definition), ["Synthetic queue", "Synthetic record store"]);
});

test("definitions without adapters retain their legacy department fallback", () => {
  const definition = { department: "finance" };

  assert.deepEqual(adaptersFor(definition), ["SAP", "Oracle", "NetSuite", "Coupa", "Slack"]);
});

test("support escalation severity rejects noncanonical casing, whitespace, and aliases", async () => {
  const definition = workflows.find((candidate) => candidate.slug === "support-escalation-command-center");
  const canonicalSeverities = ["low", "medium", "high", "critical"];
  const baseline = JSON.parse(await readFile(
    join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json"),
    "utf8"
  ));

  for (const severity of ["Critical", " critical", "critical ", "P1", "SEV-1"]) {
    const result = evaluatePolicy({
      policy: policyFor(definition),
      envelope: { body: { ...baseline, severity }, headers: { "x-request-id": "severity-regression" } },
      executionId: "severity-regression",
      evaluatedAt: "2026-08-12T03:00:00.000Z"
    });

    assert.equal(result.ok, false, `${JSON.stringify(severity)} must fail closed`);
    assert.equal(result.httpStatus, 400);
    assert.deepEqual(result.details.violations, [{
      field: "severity",
      code: "invalid_value",
      message: "severity must be one of the supported values",
      expected: "low|medium|high|critical"
    }]);
  }

  assert.deepEqual(definition.fieldContracts.severity.enum, canonicalSeverities);
  assert.ok(canonicalSeverities.includes(baseline.severity), "generated low-risk severity must be canonical");

  for (const severity of canonicalSeverities) {
    const result = evaluatePolicy({
      policy: policyFor(definition),
      envelope: { body: { ...baseline, severity }, headers: { "x-request-id": "severity-canonical" } },
      executionId: "severity-canonical",
      evaluatedAt: "2026-08-12T03:00:00.000Z"
    });

    assert.equal(result.ok, true, `${severity} must satisfy the canonical contract`);
    assert.equal(result.priorityBand, severity === "critical" ? "high" : "low");
  }
});

for (const definition of workflows) {
  const lowPath = join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json");
  const baseline = JSON.parse(await readFile(lowPath, "utf8"));

  for (const [index, rule] of definition.rules.entries()) {
    const ruleId = rule.id ?? `${rule.field}_${rule.operator}_${index + 1}`;
    test(`${definition.slug}:${ruleId} independently affects the decision`, () => {
      const body = structuredClone(baseline);
      const value = matchingValue(rule);
      if (value === undefined) delete body[rule.field];
      else body[rule.field] = value;

      const result = evaluatePolicy({
        policy: policyFor(definition),
        envelope: { body, headers: { "x-request-id": `rule-test-${index}` } },
        executionId: "rule-coverage",
        evaluatedAt: "2026-08-07T03:00:00.000Z"
      });

      assert.equal(result.ok, true);
      assert.deepEqual(result.matchedRules.map((item) => item.ruleId), [ruleId]);
      assert.deepEqual(result.matchedRules[0], {
        ruleId,
        field: rule.field,
        points: rule.points,
        reason: rule.reason,
        ...(rule.minimumBand ? { minimumBand: rule.minimumBand } : {})
      });

      const floor = rule.minimumBand ? thresholds[rule.minimumBand] : 0;
      const expectedScore = Math.max(0, Math.min(100, Math.max(rule.points, floor)));
      const band = expectedBand(expectedScore);
      assert.equal(result.score, expectedScore);
      assert.equal(result.priorityBand, band);
      assert.equal(result.decision, definition.decisions[band]);
    });
  }
}
