import assert from "node:assert/strict";
import test from "node:test";
import { scanRepository, scanSensitiveText } from "../scripts/sensitive-data-scan.mjs";

const root = new URL("../", import.meta.url).pathname;

test("scanner detects provider credentials, private keys, JWTs, and generic assignments without returning values", () => {
  const candidates = [
    `github=${"ghp_"}${"Ab3".repeat(12)}`,
    `aws=${"AKIA"}${"A1B2".repeat(4)}`,
    `slack=${"xoxb-"}${"1234567890-abcdef".repeat(2)}`,
    `openai=${"sk-"}${"Ab3_".repeat(8)}`,
    `jwt=${"eyJ"}${"aB3_".repeat(5)}.${"cD4_".repeat(5)}.${"eF5_".repeat(4)}`,
    `client_secret = ${"aB3dE5fG7hJ9kL2mN4pQ6rS8"}`,
    `-----BEGIN ${"PRIVATE KEY"}-----`
  ];
  const text = candidates.join("\n");
  const findings = scanSensitiveText("fixture.txt", text);
  assert.equal(findings.length, 7);
  assert.ok(findings.every((finding) => !Object.values(finding).some((value) => candidates.includes(value))));
  assert.deepEqual(new Set(findings.map((finding) => finding.kind)), new Set([
    "github-token", "aws-access-key", "slack-token", "openai-style-key", "jwt",
    "high-entropy-credential-assignment", "private-key"
  ]));
});

test("scanner permits placeholders and explicit same-line reviewed exceptions", () => {
  const text = [
    "api_key = example-placeholder-value",
    "password = replace-me-before-use",
    `token=${"ghp_"}${"Ab3".repeat(12)} # secret-scan: allow`,
    "client_secret = ${CLIENT_SECRET}"
  ].join("\n");
  assert.deepEqual(scanSensitiveText("safe.txt", text), []);
});

test("the complete repository text tree contains no detected sensitive values", async () => {
  assert.deepEqual(await scanRepository(root), []);
});
