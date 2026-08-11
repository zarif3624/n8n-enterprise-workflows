import assert from "node:assert/strict";
import test from "node:test";
import { workflows } from "../scripts/workflow-definitions.mjs";

test("AI governance intake preserves accountable review for consequential use cases", () => {
  const definition = workflows.find(({ slug }) => slug === "ai-use-case-risk-intake");

  assert.ok(definition, "AI governance workflow definition is required");
  assert.equal(definition.department, "risk-and-compliance");
  assert.equal(definition.owner, "Enterprise Risk and AI Governance");
  assert.equal(definition.primaryMetric, "Time from AI use-case submission to accountable decision");
  assert.equal(definition.decisions.low, "approve_controlled_pilot");
  assert.equal(definition.decisions.high, "hold_for_ai_governance_approval");

  for (const field of ["consequentialDecision", "regulatedProcess"]) {
    const rule = definition.rules.find((candidate) => candidate.field === field);
    assert.ok(rule, `${field} rule is required`);
    assert.equal(rule.minimumBand, "high");
  }
});
