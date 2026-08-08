import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { evaluatePolicy } from "../scripts/policy-engine.mjs";
import { policyFor, thresholds, workflows } from "../scripts/workflow-definitions.mjs";

const root = new URL("../", import.meta.url).pathname;

function matchingValue(rule) {
  switch (rule.operator) {
    case "missing": return undefined;
    case "truthy": return true;
    case "falsy": return false;
    case "equals": return rule.value;
    case "includes": return [rule.value];
    case "gt": return Number(rule.value) + 1;
    case "gte": return Number(rule.value);
    case "lt": return Number(rule.value) - 1;
    default: throw new Error(`Unsupported rule operator: ${rule.operator}`);
  }
}

function expectedBand(score) {
  return score >= thresholds.high ? "high" : score >= thresholds.medium ? "medium" : "low";
}

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
