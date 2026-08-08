import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildReadinessReport } from "../scripts/readiness-report.mjs";

const root = new URL("../", import.meta.url).pathname;

function run(...args) {
  return spawnSync(process.execPath, ["scripts/readiness-report-cli.mjs", ...args], { cwd: root, encoding: "utf8" });
}

test("readiness JSON separates repository validity from deployment authorization", () => {
  const result = run("--json", "--as-of", "2026-08-08");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.scope, { type: "catalog" });
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

test("workflow-scoped readiness reports only the selected policy's deployment gate", () => {
  const result = run("--json", "--workflow", "invoice-exception-triage", "--as-of", "2026-08-08");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.scope, {
    type: "workflow",
    workflow: "invoice-exception-triage",
    department: "finance",
    owner: "Accounts Payable Operations",
    lifecycleStatus: "draft",
    reviewDueOn: "2026-09-07",
    policyVersion: "1.0.4",
    policyFingerprint: "sha256:bf44281b1046fc732589a0d936e04ff1023ae938d68edfe2ffaca42faa4af5c2"
  });
  assert.equal(report.policyGovernance.draft, 1);
  assert.equal(report.policyGovernance.dueSoon, 1);
  assert.deepEqual(report.deploymentBlockers.map(({ code, count }) => ({ code, count })), [
    { code: "owner_approval_required", count: 1 }
  ]);
});

test("deprecated policies fail closed as deployment blockers", async () => {
  const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
  const [packageManifest, catalog, artifactManifest, policyLock, lifecycle, compatibility, registry] = await Promise.all([
    readJson("package.json"), readJson("catalog.json"), readJson("artifact-manifest.json"), readJson("policy-lock.json"),
    readJson("policy-lifecycle.json"), readJson("runtime-compatibility.json"), readJson("contract-registry.json")
  ]);
  const changedLifecycle = structuredClone(lifecycle);
  const selected = changedLifecycle.policies.find((entry) => entry.slug === "invoice-exception-triage");
  selected.status = "deprecated";
  selected.announcedOn = "2026-08-08";
  selected.sunsetOn = "2026-09-07";
  const report = buildReadinessReport({
    asOf: "2026-08-08", packageManifest, catalog, artifactManifest, policyLock,
    lifecycle: changedLifecycle, compatibility, registry, artifactManifestMatches: true,
    contractIssues: [], lifecycleIssues: [], compatibilityIssues: [], workflowSlug: selected.slug
  });
  assert.equal(report.deploymentStatus, "blocked");
  assert.ok(report.deploymentBlockers.some((entry) => entry.code === "policy_deprecated" && entry.count === 1));
});

test("workflow-scoped readiness rejects unknown slugs and malformed options", () => {
  const unknown = run("--workflow", "not-a-policy");
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown workflow slug/);
  assert.doesNotMatch(unknown.stderr, /node:internal|at buildReadinessReport/);
  const malformed = run("--workflow", "--json");
  assert.equal(malformed.status, 2);
  assert.match(malformed.stderr, /requires a value/);
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
  assert.equal(JSON.parse(result.stdout).reportVersion, 2);
  assert.doesNotMatch(result.stdout, /> n8n-enterprise-workflows/);
});
