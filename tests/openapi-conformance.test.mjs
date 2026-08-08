import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { evaluatePolicy } from "../scripts/policy-engine.mjs";
import { schemaContractIssues } from "../scripts/schema-contract-check.mjs";

const root = new URL("../", import.meta.url).pathname;
const [catalog, openApi, snapshot] = await Promise.all([
  readFile(join(root, "catalog.json"), "utf8").then(JSON.parse),
  readFile(join(root, "openapi.json"), "utf8").then(JSON.parse),
  readFile(join(root, "policy-snapshot.json"), "utf8").then(JSON.parse)
]);

function responseSchema(operation, status) {
  return operation.responses[status].content["application/json"].schema;
}

function evaluate(snapshotPolicy, body, requestId, contentType) {
  return evaluatePolicy({
    policy: { ...snapshotPolicy.behavior, policyVersion: snapshotPolicy.policyVersion },
    envelope: { body, headers: { "x-request-id": requestId, ...(contentType ? { "content-type": contentType } : {}) } },
    executionId: requestId,
    evaluatedAt: "2026-08-08T00:00:00.000Z"
  });
}

for (const entry of catalog) {
  test(`${entry.slug}: fixtures and observable responses conform to the published OpenAPI operation`, async () => {
    const operation = openApi.paths[entry.endpoint].post;
    const requestSchema = operation.requestBody.content["application/json"].schema;
    const snapshotPolicy = snapshot.policies.find((policy) => policy.slug === entry.slug);
    const [low, high, invalid] = await Promise.all([
      readFile(join(root, entry.examples.lowRisk), "utf8").then(JSON.parse),
      readFile(join(root, entry.examples.highRisk), "utf8").then(JSON.parse),
      readFile(join(root, entry.examples.invalid), "utf8").then(JSON.parse)
    ]);

    assert.deepEqual(schemaContractIssues(low, requestSchema, openApi), []);
    assert.deepEqual(schemaContractIssues(high, requestSchema, openApi), []);
    assert.ok(schemaContractIssues(invalid, requestSchema, openApi).length >= 2);
    assert.ok(schemaContractIssues(null, requestSchema, openApi).length >= 1);

    const lowResult = evaluate(snapshotPolicy, low, `openapi-low-${entry.slug}`);
    const highResult = evaluate(snapshotPolicy, high, `openapi-high-${entry.slug}`);
    const invalidResult = evaluate(snapshotPolicy, invalid, `openapi-invalid-${entry.slug}`);
    const nullResult = evaluate(snapshotPolicy, null, `openapi-null-${entry.slug}`);
    const unsupportedResult = evaluate(snapshotPolicy, low, `openapi-media-${entry.slug}`, "text/plain");
    assert.deepEqual(schemaContractIssues(lowResult, responseSchema(operation, "200"), openApi), []);
    assert.deepEqual(schemaContractIssues(highResult, responseSchema(operation, "200"), openApi), []);
    assert.deepEqual(schemaContractIssues(invalidResult, responseSchema(operation, "400"), openApi), []);
    assert.deepEqual(schemaContractIssues(nullResult, responseSchema(operation, "400"), openApi), []);
    assert.deepEqual(schemaContractIssues(unsupportedResult, responseSchema(operation, "415"), openApi), []);
    assert.deepEqual(nullResult.details.violations.map(({ field, code }) => ({ field, code })), [{ field: "$", code: "invalid_type" }]);
    assert.equal(unsupportedResult.error, "unsupported_media_type");

    const internalError = {
      ok: false,
      httpStatus: 500,
      requestId: `openapi-error-${entry.slug}`,
      workflow: entry.slug,
      policyVersion: entry.policyVersion,
      error: "internal_error",
      message: "The policy could not be evaluated",
      retryable: true
    };
    assert.deepEqual(schemaContractIssues(internalError, responseSchema(operation, "500"), openApi), []);
  });
}

test("OpenAPI response contracts reject undocumented decisions, leaked fields, and unsafe error detail", () => {
  const entry = catalog[0];
  const operation = openApi.paths[entry.endpoint].post;
  const snapshotPolicy = snapshot.policies.find((policy) => policy.slug === entry.slug);
  const valid = evaluate(snapshotPolicy, Object.fromEntries(
    Object.entries(entry.inputSchema.properties).map(([field, contract]) => [
      field,
      contract.type === "number" ? Math.max(contract.minimum ?? 0, 1)
        : contract.type === "boolean" ? false
          : contract.type === "array" ? []
            : contract.format === "email" ? "user@example.com"
              : contract.format === "date-time" ? "2026-08-08T00:00:00Z"
                : field === "currency" ? "USD"
                  : `${field}-001`
    ])
  ), "openapi-negative");
  assert.ok(schemaContractIssues({ ...valid, decision: "undocumented_decision" }, responseSchema(operation, "200"), openApi).some((issue) => issue.includes("enum mismatch")));
  assert.ok(schemaContractIssues({ ...valid, privateContext: "must-not-appear" }, responseSchema(operation, "200"), openApi).some((issue) => issue.includes("unknown privateContext")));
  const unsafeError = {
    ok: false,
    httpStatus: 500,
    requestId: "openapi-negative",
    workflow: entry.slug,
    policyVersion: entry.policyVersion,
    error: "internal_error",
    message: "The policy could not be evaluated",
    retryable: true,
    stack: "must-not-appear"
  };
  assert.ok(schemaContractIssues(unsafeError, responseSchema(operation, "500"), openApi).some((issue) => issue.includes("unknown stack")));
});
