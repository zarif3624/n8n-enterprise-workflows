import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { evaluatePolicy } from "../scripts/policy-engine.mjs";
import { schemaContractIssues } from "../scripts/schema-contract-check.mjs";
import { inputSchemaFor } from "../scripts/workflow-definitions.mjs";

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

test("definition-level contracts produce an OpenAPI-compatible request schema", () => {
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
    }
  };
  const schema = inputSchemaFor(definition);

  assert.deepEqual(schemaContractIssues({
    quantity: 4,
    approved: true,
    tier: "expedited",
    tags: ["ops", "risk"],
    scheduledAt: "2026-08-12T00:00:00.000Z",
    title: "Review"
  }, schema), []);
  assert.ok(schemaContractIssues({
    quantity: 0,
    approved: "true",
    tier: "unsupported",
    tags: ["x", "valid", "also-valid", "too-many"],
    scheduledAt: "not-a-date",
    title: "no"
  }, schema).length >= 6);
});

test("runtime and schema validation agree on raw patterns and strict RFC 3339 date-times", async () => {
  const invoiceEntry = catalog.find((entry) => entry.slug === "invoice-exception-triage");
  const changeEntry = catalog.find((entry) => entry.slug === "production-change-risk-gate");
  const invoicePolicy = snapshot.policies.find((policy) => policy.slug === invoiceEntry.slug);
  const changePolicy = snapshot.policies.find((policy) => policy.slug === changeEntry.slug);
  const [invoiceLow, changeLow] = await Promise.all([
    readFile(join(root, invoiceEntry.examples.lowRisk), "utf8").then(JSON.parse),
    readFile(join(root, changeEntry.examples.lowRisk), "utf8").then(JSON.parse)
  ]);
  const invoiceSchema = openApi.paths[invoiceEntry.endpoint].post.requestBody.content["application/json"].schema;
  const changeSchema = openApi.paths[changeEntry.endpoint].post.requestBody.content["application/json"].schema;

  const paddedCurrency = { ...invoiceLow, currency: " USD " };
  assert.ok(schemaContractIssues(paddedCurrency, invoiceSchema, openApi).some((issue) => issue.includes("pattern mismatch")));
  assert.equal(evaluate(invoicePolicy, paddedCurrency, "raw-pattern").httpStatus, 400);

  const whitespaceRequired = { ...invoiceLow, invoiceId: " \t " };
  assert.ok(schemaContractIssues(whitespaceRequired, invoiceSchema, openApi).some((issue) => issue.includes("pattern mismatch")));
  assert.equal(evaluate(invoicePolicy, whitespaceRequired, "whitespace-required").httpStatus, 400);

  const whitespaceOptional = { ...invoiceLow, purchaseOrderId: " \t " };
  assert.deepEqual(schemaContractIssues(whitespaceOptional, invoiceSchema, openApi), []);
  assert.equal(evaluate(invoicePolicy, whitespaceOptional, "whitespace-optional").ok, true);

  const whitespaceConstrained = { ...invoiceLow, currency: " \t " };
  assert.ok(schemaContractIssues(whitespaceConstrained, invoiceSchema, openApi).some((issue) => issue.includes("pattern mismatch")));
  assert.equal(evaluate(invoicePolicy, whitespaceConstrained, "whitespace-constrained").httpStatus, 400);

  for (const plannedAt of [
    "August 12, 2026 09:30 UTC",
    "2026-08-12",
    "2026-02-30T09:30:45Z",
    "2026-08-12T09:30:60Z",
    "2026-08-12T09:30:60+07:00"
  ]) {
    const body = { ...changeLow, plannedAt };
    assert.ok(schemaContractIssues(body, changeSchema, openApi).some((issue) => issue.includes("invalid date-time")), plannedAt);
    assert.equal(evaluate(changePolicy, body, `invalid-date-${plannedAt}`).httpStatus, 400, plannedAt);
  }

  for (const plannedAt of [
    "2026-08-12T09:30:45.123456+07:00",
    "2026-08-12t02:30:45z",
    "2026-08-12T09:30:59Z",
    "2026-08-12T09:30:59-04:30"
  ]) {
    const body = { ...changeLow, plannedAt };
    assert.deepEqual(schemaContractIssues(body, changeSchema, openApi), [], plannedAt);
    assert.equal(evaluate(changePolicy, body, `valid-date-${plannedAt}`).ok, true, plannedAt);
  }
});

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
