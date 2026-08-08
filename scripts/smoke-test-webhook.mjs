import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function smokeTestWebhook({ baseUrl, slug }) {
  const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
  const entry = catalog.find((item) => item.slug === slug);
  assert.ok(entry, `Unknown workflow slug: ${slug}`);

  const cases = [
    { name: "low", fixture: entry.examples.lowRisk, status: 200, band: "low" },
    { name: "high", fixture: entry.examples.highRisk, status: 200, band: "high" },
    { name: "invalid", fixture: entry.examples.invalid, status: 400, error: "validation_error", minimumViolations: 2 },
    // n8n normalizes an HTTP JSON null body to an empty object before the
    // workflow executes. The engine itself still preserves explicit body:null.
    { name: "null-body", payload: null, status: 400, error: "validation_error", minimumViolations: 1 },
    { name: "non-json", fixture: entry.examples.lowRisk, contentType: "text/plain", status: 415, error: "unsupported_media_type" }
  ];

  for (const testCase of cases) {
    const requestId = `runtime-smoke-${testCase.name}`;
    const fixture = testCase.fixture
      ? JSON.parse(await readFile(join(root, testCase.fixture), "utf8"))
      : testCase.payload;
    const requestBody = fixture && typeof fixture === "object" && !Array.isArray(fixture)
      ? { ...fixture, privateSmokeContext: "must-not-echo" }
      : fixture;
    const response = await fetch(new URL(entry.endpoint, baseUrl), {
      method: "POST",
      headers: {
        "content-type": testCase.contentType ?? "application/json",
        "x-request-id": requestId
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10_000)
    });
    const body = await response.json();

    assert.equal(response.status, testCase.status, `${testCase.name}: HTTP status`);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/i, `${testCase.name}: content type`);
    assert.equal(response.headers.get("cache-control"), "no-store", `${testCase.name}: cache control`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${testCase.name}: MIME sniffing protection`);
    assert.equal(response.headers.get("x-request-id"), requestId, `${testCase.name}: response header request ID`);
    assert.equal(body.requestId, requestId, `${testCase.name}: response body request ID`);
    assert.equal(JSON.stringify(body).includes("must-not-echo"), false, `${testCase.name}: private input leaked`);

    if (testCase.band) {
      assert.equal(body.ok, true, `${testCase.name}: success flag`);
      assert.equal(body.workflow, entry.slug, `${testCase.name}: workflow identity`);
      assert.equal(body.policyVersion, entry.policyVersion, `${testCase.name}: policy version`);
      assert.equal(body.priorityBand, testCase.band, `${testCase.name}: priority band`);
      assert.ok(Array.isArray(body.matchedRules), `${testCase.name}: matched rules`);
    } else {
      assert.equal(body.ok, false, `${testCase.name}: success flag`);
      assert.equal(body.error, testCase.error, `${testCase.name}: error code`);
      if (testCase.minimumViolations) assert.ok(body.details?.violations?.length >= testCase.minimumViolations, `${testCase.name}: field violations`);
      if (testCase.status === 415) assert.equal(body.expectedContentType, "application/json", `${testCase.name}: expected content type`);
    }
  }

  console.log(`Runtime-smoked ${entry.slug}: low/high decisions, fixture/null 400s, non-JSON 415, headers, version, and response privacy.`);
}

export async function smokeTestInternalError({ baseUrl, slug }) {
  const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
  const entry = catalog.find((item) => item.slug === slug);
  assert.ok(entry, `Unknown workflow slug: ${slug}`);
  const fixture = JSON.parse(await readFile(join(root, entry.examples.lowRisk), "utf8"));
  const requestId = "runtime-smoke-forced-error";
  const response = await fetch(new URL(entry.endpoint, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ ...fixture, privateSmokeContext: "must-not-echo" }),
    signal: AbortSignal.timeout(10_000)
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-request-id"), requestId);
  assert.deepEqual(body, {
    ok: false,
    httpStatus: 500,
    requestId,
    workflow: entry.slug,
    policyVersion: entry.policyVersion,
    error: "internal_error",
    message: "The policy could not be evaluated",
    retryable: true
  });
  assert.equal(JSON.stringify(body).includes("must-not-echo"), false);
  assert.equal(/stack|node|intentional runtime error probe/i.test(JSON.stringify(body)), false);
  console.log(`Runtime-smoked ${entry.slug}: forced evaluator failure returned a sanitized retryable 500.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [baseUrl, slug = "invoice-exception-triage", mode] = process.argv.slice(2);
  if (!baseUrl) {
    console.error("Usage: node scripts/smoke-test-webhook.mjs <base-url> [workflow-slug]");
    process.exit(2);
  }
  if (mode === "--expect-internal-error") await smokeTestInternalError({ baseUrl, slug });
  else await smokeTestWebhook({ baseUrl, slug });
}
