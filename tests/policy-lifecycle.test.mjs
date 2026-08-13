import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildPolicyLifecycleReport, policyLifecycleIssues, renderPolicyLifecycleReport } from "../scripts/policy-lifecycle.mjs";

const root = new URL("../", import.meta.url).pathname;
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const [document, catalog, policyLock] = await Promise.all([readJson("policy-lifecycle.json"), readJson("catalog.json"), readJson("policy-lock.json")]);

test("every catalog policy has an honest draft, owner, and approval deadline", () => {
  assert.deepEqual(policyLifecycleIssues(document, { catalog, policyLock }), []);
  const report = buildPolicyLifecycleReport(document, { asOf: "2026-08-08" });
  assert.deepEqual(report.summary, { policyCount: 16, draft: 16, active: 0, deprecated: 0, current: 12, dueSoon: 4, overdue: 0 });
  assert.deepEqual(report.policies.filter((entry) => entry.daysUntilReview === 30).map((entry) => entry.slug).sort(), [
    "invoice-exception-triage",
    "phishing-report-triage",
    "production-change-risk-gate",
    "service-desk-priority-routing"
  ]);
  assert.equal(report.policies.filter((entry) => entry.daysUntilReview === 34).length, 12);
  assert.ok(report.policies.every((entry) => entry.lastReviewedOn === undefined));
});

test("review reports distinguish due-soon and overdue policies deterministically", () => {
  const dueSoon = buildPolicyLifecycleReport(document, { asOf: "2026-08-20" });
  assert.equal(dueSoon.summary.dueSoon, 16);
  const overdue = buildPolicyLifecycleReport(document, { asOf: "2026-09-12" });
  assert.equal(overdue.summary.overdue, 16);
  assert.match(renderPolicyLifecycleReport(overdue), /16 overdue/);
});

test("lifecycle validation rejects drifted owners, unsafe intervals, duplicates, and incomplete deprecation", () => {
  const changed = structuredClone(document);
  changed.policies[0].owner = "Unowned";
  changed.policies[0].reviewDueOn = "2028-01-01";
  changed.policies.push(structuredClone(changed.policies[0]));
  changed.policies[0].status = "deprecated";
  changed.policies[0].fingerprint = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  const issues = policyLifecycleIssues(changed, { catalog, policyLock });
  assert.ok(issues.some((issue) => issue.includes("owner must match")));
  assert.ok(issues.some((issue) => issue.includes("approval interval exceeds")));
  assert.ok(issues.some((issue) => issue.includes("duplicated")));
  assert.ok(issues.some((issue) => issue.includes("require real announcedOn")));
  assert.ok(issues.some((issue) => issue.includes("fingerprint must match policy lock")));
});

test("lifecycle CLI reserves exit 2 for overdue review gates", () => {
  const current = spawnSync(process.execPath, ["scripts/policy-lifecycle-cli.mjs", "validate", "--as-of", "2026-08-08"], { cwd: root, encoding: "utf8" });
  assert.equal(current.status, 0, current.stderr);
  assert.match(current.stdout, /no reviews are overdue/);
  const overdue = spawnSync(process.execPath, ["scripts/policy-lifecycle-cli.mjs", "validate", "--as-of", "2026-09-12"], { cwd: root, encoding: "utf8" });
  assert.equal(overdue.status, 2);
  assert.match(overdue.stderr, /16 policy review\(s\) are overdue/);
});

test("lifecycle CLI rejects ambiguous or ignored governance options", () => {
  const cases = [
    [["report", "--as-of"], /requires a value/],
    [["report", "--json", "--json"], /only be provided once/],
    [["validate", "--json"], /only supported by the report command/],
    [["report", "--unknown"], /Unknown option/],
    [["unknown"], /Unknown command/]
  ];
  for (const [args, expected] of cases) {
    const result = spawnSync(process.execPath, ["scripts/policy-lifecycle-cli.mjs", ...args], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 2, `${args.join(" ")}: ${result.stderr}`);
    assert.match(result.stderr, expected);
    assert.doesNotMatch(result.stderr, /node:internal|at file:/);
  }
});

test("documented silent lifecycle invocation emits uncontaminated JSON", () => {
  const result = spawnSync("npm", ["run", "--silent", "lifecycle", "--", "report", "--json", "--as-of", "2026-08-08"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).lifecycleVersion, 1);
  assert.doesNotMatch(result.stdout, /> n8n-enterprise-workflows/);
});
