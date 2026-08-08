import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;

function run(...args) {
  return spawnSync(process.execPath, ["scripts/readiness-report-cli.mjs", ...args], { cwd: root, encoding: "utf8" });
}

test("readiness JSON separates repository validity from deployment authorization", () => {
  const result = run("--json", "--as-of", "2026-08-08");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.repositoryStatus, "ready");
  assert.equal(report.deploymentStatus, "blocked");
  assert.equal(report.inventory.workflows, 15);
  assert.equal(report.inventory.artifacts, 96);
  assert.equal(report.policyGovernance.draft, 15);
  assert.equal(report.policyGovernance.active, 0);
  assert.equal(report.contractCoverage.schemas, 13);
  assert.deepEqual(report.privacy, { rawPayloadsIncluded: false, perRecordResultsIncluded: false });
});

test("readiness Markdown makes owner approval and evidence limits prominent", () => {
  const result = run("--as-of", "2026-08-08");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Repository: \*\*ready\*\*\. Deployment: \*\*blocked\*\*/);
  assert.match(result.stdout, /real review by their named business owners/);
  assert.match(result.stdout, /not approval to deploy/);
});

test("overdue reviews become explicit deployment blockers without falsifying repository evidence", () => {
  const result = run("--json", "--as-of", "2026-09-08");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.repositoryStatus, "ready");
  assert.equal(report.policyGovernance.overdue, 15);
  assert.ok(report.deploymentBlockers.some((entry) => entry.code === "policy_review_overdue" && entry.count === 15));
});

test("readiness CLI rejects impossible evidence dates without a stack trace", () => {
  const result = run("--json", "--as-of", "2026-02-30");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /asOf must be a real YYYY-MM-DD date/);
  assert.doesNotMatch(result.stderr, /at buildPolicyLifecycleReport|node:internal/);
});

test("documented npm invocation emits parseable JSON without a package-script banner", () => {
  const result = spawnSync("npm", ["run", "--silent", "readiness", "--", "--json", "--as-of", "2026-08-08"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).reportVersion, 1);
  assert.doesNotMatch(result.stdout, /> n8n-enterprise-workflows/);
});
