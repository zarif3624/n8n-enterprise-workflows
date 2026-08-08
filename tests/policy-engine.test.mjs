import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { evaluatePolicy, matchesRule } from "../scripts/policy-engine.mjs";
import { inputSchemaFor, policyFor, workflows } from "../scripts/workflow-definitions.mjs";

const root = new URL("../", import.meta.url).pathname;

function run(definition, body, headers = {}) {
  return evaluatePolicy({
    policy: policyFor(definition),
    envelope: { body, headers },
    executionId: "unit-test-execution",
    evaluatedAt: "2026-08-07T03:00:00.000Z"
  });
}

function wrongType(contract) {
  if (contract.type === "string") return 42;
  if (contract.type === "number") return "42";
  if (contract.type === "boolean") return "true";
  if (contract.type === "array") return {};
  return null;
}

function matchingValue(rule) {
  if (rule.operator === "missing") return undefined;
  if (rule.operator === "truthy") return true;
  if (rule.operator === "falsy") return false;
  if (rule.operator === "equals") return rule.value;
  if (rule.operator === "includes") return [rule.value];
  if (rule.operator === "gt") return Number(rule.value) + 1;
  if (rule.operator === "gte") return Number(rule.value);
  if (rule.operator === "lt") return Number(rule.value) - 1;
  throw new Error(`Unsupported rule operator: ${rule.operator}`);
}

test("every workflow has a complete typed contract", () => {
  for (const definition of workflows) {
    const schema = inputSchemaFor(definition);
    assert.equal(schema.type, "object");
    assert.deepEqual(Object.keys(schema.properties), [...definition.required, ...definition.optional]);
    assert.deepEqual(schema.required, definition.required);
    for (const rule of definition.rules) assert.ok(schema.properties[rule.field], `${definition.slug}:${rule.field}`);
  }
});

for (const definition of workflows) {
  test(`${definition.slug}: representative fixtures cover low, high, and invalid outcomes`, async () => {
    const directory = join(root, "workflows", definition.department, definition.slug, "examples");
    const [low, high, invalid] = await Promise.all([
      readFile(join(directory, "low-risk.json"), "utf8").then(JSON.parse),
      readFile(join(directory, "high-risk.json"), "utf8").then(JSON.parse),
      readFile(join(directory, "invalid.json"), "utf8").then(JSON.parse)
    ]);
    assert.equal(run(definition, low).priorityBand, "low");
    assert.equal(run(definition, high).priorityBand, "high");
    const invalidResult = run(definition, invalid);
    assert.equal(invalidResult.httpStatus, 400);
    assert.ok(invalidResult.details.violations.length >= 2);
  });

  test(`${definition.slug}: every required field fails closed when absent`, async () => {
    const lowPath = join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json");
    const low = JSON.parse(await readFile(lowPath, "utf8"));
    for (const field of definition.required) {
      const body = { ...low };
      delete body[field];
      const result = run(definition, body);
      assert.equal(result.ok, false, field);
      assert.ok(result.details.violations.some((item) => item.field === field && item.code === "required"), field);
    }
  });

  test(`${definition.slug}: every declared field rejects the wrong JSON type`, async () => {
    const lowPath = join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json");
    const low = JSON.parse(await readFile(lowPath, "utf8"));
    const schema = inputSchemaFor(definition);
    for (const [field, contract] of Object.entries(schema.properties)) {
      const result = run(definition, { ...low, [field]: wrongType(contract) });
      assert.equal(result.ok, false, field);
      assert.ok(result.details.violations.some((item) => item.field === field && item.code === "invalid_type"), field);
    }
  });
}

test("all supported rule operators match their documented boundary", () => {
  const rules = [
    { operator: "missing" },
    { operator: "truthy" },
    { operator: "falsy" },
    { operator: "equals", value: "x" },
    { operator: "includes", value: "x" },
    { operator: "gt", value: 10 },
    { operator: "gte", value: 10 },
    { operator: "lt", value: 10 }
  ];
  for (const rule of rules) assert.equal(matchesRule(rule, matchingValue(rule)), true, rule.operator);
  assert.equal(matchesRule({ operator: "gt", value: 10 }, 10), false);
  assert.equal(matchesRule({ operator: "gte", value: 10 }, 9), false);
  assert.equal(matchesRule({ operator: "lt", value: 10 }, 10), false);
});

test("format and range constraints fail closed", async () => {
  const cases = [
    ["invoice-exception-triage", "currency", "usd", "invalid_format"],
    ["enterprise-lead-routing", "email", "not-an-email", "invalid_format"],
    ["customer-risk-escalation", "arr", -1, "below_minimum"],
    ["campaign-lead-compliance-gate", "engagementScore", 101, "above_maximum"]
  ];
  for (const [slug, field, value, code] of cases) {
    const definition = workflows.find((item) => item.slug === slug);
    const lowPath = join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json");
    const low = JSON.parse(await readFile(lowPath, "utf8"));
    const result = run(definition, { ...low, [field]: value });
    assert.equal(result.ok, false, `${slug}:${field}`);
    assert.ok(result.details.violations.some((item) => item.field === field && item.code === code), `${slug}:${field}`);
  }
});

test("hard risk gates cannot be canceled by negative scoring signals", async () => {
  const definition = workflows.find((item) => item.slug === "campaign-lead-compliance-gate");
  const lowPath = join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json");
  const low = JSON.parse(await readFile(lowPath, "utf8"));
  const result = run(definition, {
    ...low,
    consent: false,
    targetAccount: true,
    engagementScore: 100
  });
  assert.equal(result.priorityBand, "high");
  assert.equal(result.decision, "suppress_automated_outreach");
});

test("request IDs propagate without echoing caller input", () => {
  const definition = workflows[0];
  const schema = inputSchemaFor(definition);
  const body = Object.fromEntries(definition.required.map((field) => [field, schema.properties[field].type === "number" ? 1 : field === "currency" ? "USD" : `${field}-001`]));
  const result = run(definition, { ...body, privateContext: "must-not-echo" }, { "x-request-id": "trace-123" });
  assert.equal(result.requestId, "trace-123");
  assert.equal(JSON.stringify(result).includes("must-not-echo"), false);
});

test("request IDs are safe to return as HTTP headers", () => {
  const definition = workflows[0];
  const schema = inputSchemaFor(definition);
  const body = Object.fromEntries(definition.required.map((field) => [field, schema.properties[field].type === "number" ? 1 : field === "currency" ? "USD" : `${field}-001`]));
  const result = run(definition, body, { "x-request-id": ` trace\r\nmalicious-${"x".repeat(300)} ` });
  assert.equal(result.requestId.includes("\r"), false);
  assert.equal(result.requestId.includes("\n"), false);
  assert.equal(result.requestId.length, 200);
});

test("non-object request bodies return a self-describing 400", () => {
  const definition = workflows[0];
  const result = evaluatePolicy({
    policy: policyFor(definition),
    envelope: { body: [], headers: {} },
    executionId: "unit-test-execution",
    evaluatedAt: "2026-08-07T03:00:00.000Z"
  });
  assert.equal(result.httpStatus, 400);
  assert.equal(result.details.violations[0].field, "$");
  assert.equal(result.requestSchema.type, "object");
});
