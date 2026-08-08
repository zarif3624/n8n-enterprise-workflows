import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildPolicyLifecycleReport, policyLifecycleIssues, renderPolicyLifecycleReport } from "../scripts/policy-lifecycle.mjs";

const root = new URL("../", import.meta.url).pathname;
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const [document, catalog] = await Promise.all([readJson("policy-lifecycle.json"), readJson("catalog.json")]);

test("every catalog policy has an honest draft, owner, and approval deadline", () => {
  assert.deepEqual(policyLifecycleIssues(document, { catalog }), []);
  const report = buildPolicyLifecycleReport(document, { asOf: "2026-08-08" });
  assert.deepEqual(report.summary, { policyCount: 15, draft: 15, active: 0, deprecated: 0, current: 0, dueSoon: 15, overdue: 0 });
  assert.ok(report.policies.every((entry) => entry.daysUntilReview === 30));
  assert.ok(report.policies.every((entry) => entry.lastReviewedOn === undefined));
});

test("review reports distinguish due-soon and overdue policies deterministically", () => {
  const dueSoon = buildPolicyLifecycleReport(document, { asOf: "2026-08-20" });
  assert.equal(dueSoon.summary.dueSoon, 15);
  const overdue = buildPolicyLifecycleReport(document, { asOf: "2026-09-08" });
  assert.equal(overdue.summary.overdue, 15);
  assert.match(renderPolicyLifecycleReport(overdue), /15 overdue/);
});

test("lifecycle validation rejects drifted owners, unsafe intervals, duplicates, and incomplete deprecation", () => {
  const changed = structuredClone(document);
  changed.policies[0].owner = "Unowned";
  changed.policies[0].reviewDueOn = "2028-01-01";
  changed.policies.push(structuredClone(changed.policies[0]));
  changed.policies[0].status = "deprecated";
  const issues = policyLifecycleIssues(changed, { catalog });
  assert.ok(issues.some((issue) => issue.includes("owner must match")));
  assert.ok(issues.some((issue) => issue.includes("approval interval exceeds")));
  assert.ok(issues.some((issue) => issue.includes("duplicated")));
  assert.ok(issues.some((issue) => issue.includes("require real announcedOn")));
});

test("lifecycle CLI reserves exit 2 for overdue review gates", () => {
  const current = spawnSync(process.execPath, ["scripts/policy-lifecycle-cli.mjs", "validate", "--as-of", "2026-08-08"], { cwd: root, encoding: "utf8" });
  assert.equal(current.status, 0, current.stderr);
  assert.match(current.stdout, /no reviews are overdue/);
  const overdue = spawnSync(process.execPath, ["scripts/policy-lifecycle-cli.mjs", "validate", "--as-of", "2026-09-08"], { cwd: root, encoding: "utf8" });
  assert.equal(overdue.status, 2);
  assert.match(overdue.stderr, /15 policy review\(s\) are overdue/);
});
