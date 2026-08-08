import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { analyzeConformance } from "../scripts/conformance.mjs";
import { applyFieldMapping, createIdentityMapping, validateFieldMapping } from "../scripts/field-mapping.mjs";

const root = new URL("../", import.meta.url).pathname;
const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
const snapshotPolicy = snapshot.policies.find((policy) => policy.slug === "invoice-exception-triage");
const low = JSON.parse(await readFile(join(root, "workflows", "finance", "invoice-exception-triage", "examples", "low-risk.json"), "utf8"));

test("identity mapping is fingerprint-bound and preserves workflow-shaped records", () => {
  const mapping = createIdentityMapping(snapshotPolicy);
  const compiled = validateFieldMapping(mapping, snapshotPolicy);
  const result = applyFieldMapping(compiled, low);
  assert.equal(compiled.policyFingerprint, snapshotPolicy.fingerprint);
  assert.match(compiled.fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result, { ok: true, value: low });
});

test("nested JSON Pointers and explicit transforms create typed policy input", () => {
  const mapping = createIdentityMapping(snapshotPolicy);
  mapping.fields.invoiceId = { source: "/invoice/id", transform: "trim" };
  mapping.fields.vendorId = { source: "/supplier/id", transform: "uppercase" };
  mapping.fields.amount = { source: "/invoice/amount", transform: "finiteNumber" };
  mapping.fields.currency = { source: "/invoice/currency", transform: "uppercase" };
  mapping.fields.duplicateDetected = { source: "/flags/duplicate", transform: "strictBoolean" };
  const result = applyFieldMapping(validateFieldMapping(mapping, snapshotPolicy), {
    invoice: { id: "  inv-1 ", amount: "42.5", currency: "usd" },
    supplier: { id: "vendor-7" },
    flags: { duplicate: "false" }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    invoiceId: "inv-1",
    vendorId: "VENDOR-7",
    amount: 42.5,
    currency: "USD",
    duplicateDetected: false
  });
});

test("mapping errors identify only target fields and safe error codes", () => {
  const privateValue = "sensitive-source-value";
  const mapping = createIdentityMapping(snapshotPolicy);
  mapping.fields.invoiceId = { source: "/private/id", transform: "trim" };
  mapping.fields.amount = { source: "/private/amount", transform: "finiteNumber" };
  const result = applyFieldMapping(validateFieldMapping(mapping, snapshotPolicy), {
    private: { amount: privateValue }
  });
  assert.deepEqual(result.errors, [
    { field: "amount", code: "transform_failed" },
    { field: "currency", code: "source_missing" },
    { field: "invoiceId", code: "source_missing" },
    { field: "vendorId", code: "source_missing" }
  ]);
  assert.equal(JSON.stringify(result).includes(privateValue), false);
});

test("mapping validation rejects drift, unknown targets, and unsafe paths", () => {
  const drifted = createIdentityMapping(snapshotPolicy);
  drifted.policyFingerprint = "sha256:stale";
  assert.throws(() => validateFieldMapping(drifted, snapshotPolicy), /current snapshot/);

  const unknown = createIdentityMapping(snapshotPolicy);
  unknown.fields.secretTarget = { source: "/secret" };
  assert.throws(() => validateFieldMapping(unknown, snapshotPolicy), /Unknown target field/);

  const unsafe = createIdentityMapping(snapshotPolicy);
  unsafe.fields.invoiceId = { source: "/__proto__/polluted" };
  assert.throws(() => validateFieldMapping(unsafe, snapshotPolicy), /unsafe property segment/);

  const missing = createIdentityMapping(snapshotPolicy);
  delete missing.fields.invoiceId;
  assert.throws(() => validateFieldMapping(missing, snapshotPolicy), /Required target field invoiceId/);

  const missingRuleSignal = createIdentityMapping(snapshotPolicy);
  delete missingRuleSignal.fields.duplicateDetected;
  assert.throws(() => validateFieldMapping(missingRuleSignal, snapshotPolicy), /Policy-relevant target field duplicateDetected/);

  const extra = { ...createIdentityMapping(snapshotPolicy), executable: "not-allowed" };
  assert.throws(() => validateFieldMapping(extra, snapshotPolicy), /unsupported option: executable/);
});

test("mapped conformance aggregates mapping failures without exposing sources", () => {
  const privateValue = "sensitive-source-value";
  const mapping = createIdentityMapping(snapshotPolicy);
  mapping.fields.invoiceId = { source: "/source/id", transform: "trim" };
  const report = analyzeConformance({
    snapshotPolicy,
    mapping,
    records: [{ ...low, source: { id: privateValue } }, low]
  });
  assert.equal(report.mapping.enabled, true);
  assert.equal(report.sample.mappingInvalid, 1);
  assert.equal(report.sample.contractInvalid, 0);
  assert.deepEqual(report.mapping.errors.counts, [{ field: "invoiceId", code: "source_missing", count: 1, rate: 1 }]);
  assert.equal(JSON.stringify(report).includes(privateValue), false);
  assert.equal(JSON.stringify(report).includes("/source/id"), false);
});

test("mapping CLI emits, checks, and applies a current identity template", async () => {
  const result = spawnSync(process.execPath, ["scripts/field-mapping-cli.mjs", "init", "invoice-exception-triage"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const mapping = JSON.parse(result.stdout);
  assert.equal(mapping.workflow, "invoice-exception-triage");
  assert.equal(mapping.policyFingerprint, snapshotPolicy.fingerprint);
  assert.equal(mapping.fields.invoiceId.source, "/invoiceId");

  const directory = await mkdtemp(join(tmpdir(), "n8n-field-mapping-"));
  const path = join(directory, "mapping.json");
  try {
    await writeFile(path, result.stdout);
    const checked = spawnSync(process.execPath, ["scripts/field-mapping-cli.mjs", "check", path], { cwd: root, encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr);
    assert.equal(JSON.parse(checked.stdout).mappedFieldCount, Object.keys(mapping.fields).length);
    const relevantFields = new Set([...snapshotPolicy.behavior.inputSchema.required, ...snapshotPolicy.behavior.rules.map((rule) => rule.field)]);
    assert.equal(JSON.parse(checked.stdout).policyRelevantFieldCount, relevantFields.size);

    const conformance = spawnSync(process.execPath, ["scripts/conformance-cli.mjs", "invoice-exception-triage", "-", "--mapping", path, "--json"], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify(low)
    });
    assert.equal(conformance.status, 0, conformance.stderr);
    assert.equal(JSON.parse(conformance.stdout).mapping.enabled, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
