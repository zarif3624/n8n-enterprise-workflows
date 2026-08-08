import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { analyzeConformance } from "../scripts/conformance.mjs";
import { applyFieldMapping, createIdentityMapping, validateFieldMapping } from "../scripts/field-mapping.mjs";
import { evaluatePolicy } from "../scripts/policy-engine.mjs";
import { inputSchemaFor, policyFor, workflows } from "../scripts/workflow-definitions.mjs";

const root = new URL("../", import.meta.url).pathname;
const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
const allowedViolationCodes = new Set([
  "required", "invalid_type", "invalid_contract", "too_short", "too_long",
  "invalid_format", "invalid_value", "below_minimum", "above_maximum"
]);

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function adversarialValues(marker) {
  const nullPrototype = Object.create(null);
  nullPrototype.value = marker;
  return [
    undefined,
    null,
    "",
    " \t\n ",
    marker,
    `${marker}\r\nX-Injected: true`,
    `🚨${marker}漢字`,
    marker.repeat(300),
    0,
    -1,
    1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    true,
    false,
    [],
    [marker],
    {},
    { value: marker },
    nullPrototype,
    JSON.parse(`{"__proto__":{"polluted":"${marker}"}}`)
  ];
}

function evaluate(definition, body) {
  return evaluatePolicy({
    policy: policyFor(definition),
    envelope: { body, headers: { "x-request-id": "fuzz-request-001" } },
    executionId: "fuzz-execution-001",
    evaluatedAt: "2026-08-08T00:00:00.000Z"
  });
}

function assertSafeResult(definition, result, marker) {
  assert.equal(typeof result.ok, "boolean");
  assert.equal(JSON.stringify(result).includes(marker), false, `${definition.slug}: private marker leaked`);
  assert.doesNotThrow(() => JSON.stringify(result));
  if (result.ok) {
    assert.equal(result.httpStatus, 200);
    assert.ok(Number.isFinite(result.score) && result.score >= 0 && result.score <= 100);
    assert.ok(["low", "medium", "high"].includes(result.priorityBand));
    assert.equal(result.workflow, definition.slug);
    assert.equal(result.policyVersion, definition.policyVersion);
    const declaredRuleIds = new Set(definition.rules.map((rule, index) => rule.id ?? `${rule.field}_${rule.operator}_${index + 1}`));
    assert.ok(result.matchedRules.every((rule) => declaredRuleIds.has(rule.ruleId)));
  } else {
    assert.equal(result.httpStatus, 400);
    assert.equal(result.error, "validation_error");
    assert.ok(result.details.violations.length > 0);
    assert.ok(result.details.violations.every((violation) => allowedViolationCodes.has(violation.code)));
  }
}

test("fixed-seed adversarial field mutations stay deterministic, bounded, and private across every policy", async () => {
  const random = generator(0x5eed1234);
  for (const definition of workflows) {
    const marker = `private-fuzz-${definition.slug}`;
    const values = adversarialValues(marker);
    const fields = Object.keys(inputSchemaFor(definition).properties);
    const lowPath = join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json");
    const low = JSON.parse(await readFile(lowPath, "utf8"));
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const body = { ...low, privateFuzzContext: marker };
      const mutations = 1 + Math.floor(random() * Math.min(3, fields.length));
      for (let index = 0; index < mutations; index += 1) {
        const field = fields[Math.floor(random() * fields.length)];
        body[field] = values[Math.floor(random() * values.length)];
      }
      const first = evaluate(definition, body);
      const second = evaluate(definition, body);
      assert.deepEqual(first, second, `${definition.slug}: nondeterministic result`);
      assertSafeResult(definition, first, marker);
    }
  }
});

test("non-JSON roots and prototype-shaped inputs fail safely without polluting objects", () => {
  const roots = [undefined, null, false, 0, "text", Symbol("input"), 1n, () => null, [], new Date(0), JSON.parse('{"__proto__":{"polluted":true}}')];
  for (const definition of workflows) {
    for (const body of roots) {
      const result = evaluate(definition, body);
      assertSafeResult(definition, result, "never-present-private-marker");
    }
  }
  assert.equal({}.polluted, undefined);
});

test("mapping and aggregate conformance remain private over adversarial source records", async () => {
  for (const definition of workflows) {
    const snapshotPolicy = snapshot.policies.find((policy) => policy.slug === definition.slug);
    const mapping = createIdentityMapping(snapshotPolicy);
    const compiled = validateFieldMapping(mapping, snapshotPolicy);
    const marker = `private-mapping-fuzz-${definition.slug}`;
    const lowPath = join(root, "workflows", definition.department, definition.slug, "examples", "low-risk.json");
    const low = JSON.parse(await readFile(lowPath, "utf8"));
    const records = [
      { ...low, privateFuzzContext: marker },
      { ...low, [definition.required[0]]: marker, privateFuzzContext: marker },
      { ...low, [definition.required[0]]: { nested: marker }, privateFuzzContext: marker },
      JSON.parse(`{"__proto__":{"private":"${marker}"}}`),
      null,
      []
    ];
    for (const record of records) {
      const mapped = applyFieldMapping(compiled, record);
      assert.equal(JSON.stringify(mapped).includes(marker), mapped.ok && JSON.stringify(mapped.value).includes(marker));
      if (!mapped.ok) assert.ok(mapped.errors.every((error) => ["source_not_object", "source_missing", "transform_failed"].includes(error.code)));
    }
    const first = analyzeConformance({ snapshotPolicy, records, mapping });
    const second = analyzeConformance({ snapshotPolicy, records, mapping });
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first).includes(marker), false, `${definition.slug}: aggregate report leaked source data`);
  }
});
