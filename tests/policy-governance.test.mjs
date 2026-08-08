import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPolicyLock,
  buildPolicySnapshot,
  canonicalize,
  compareSemanticVersions,
  fingerprint,
  policyLockIssues
} from "../scripts/policy-governance.mjs";
import { policyEngineVersion, policySchemaVersion } from "../scripts/policy-engine.mjs";
import { policyFor, workflows } from "../scripts/workflow-definitions.mjs";

const engineSource = await readFile(new URL("../scripts/policy-engine.mjs", import.meta.url), "utf8");

function lockFor(definitions = workflows, source = engineSource, engineVersion = policyEngineVersion) {
  return buildPolicyLock({
    definitions,
    policyFor,
    schemaVersion: policySchemaVersion,
    engineVersion,
    engineSource: source
  });
}

test("canonical fingerprints do not depend on object key order", () => {
  assert.deepEqual(canonicalize({ z: 1, a: { d: 2, c: 3 } }), { a: { c: 3, d: 2 }, z: 1 });
  assert.equal(fingerprint({ z: 1, a: 2 }), fingerprint({ a: 2, z: 1 }));
});

test("policy locks are deterministic and contain every definition", () => {
  const first = lockFor();
  const second = lockFor();
  assert.deepEqual(first, second);
  assert.equal(first.policies.length, workflows.length);
  assert.ok(first.policies.every((entry) => /^sha256:[a-f0-9]{64}$/.test(entry.fingerprint)));
});

test("policy review snapshots retain canonical executable behavior", () => {
  const snapshot = buildPolicySnapshot({
    definitions: workflows,
    policyFor,
    schemaVersion: policySchemaVersion,
    engineVersion: policyEngineVersion,
    engineSource
  });
  assert.equal(snapshot.policies.length, workflows.length);
  assert.deepEqual(snapshot.policies.map((entry) => entry.slug), [...snapshot.policies.map((entry) => entry.slug)].sort());
  assert.ok(snapshot.policies.every((entry) => entry.behavior.inputSchema && entry.behavior.rules.length));
  assert.match(snapshot.policyEngineFingerprint, /^sha256:[a-f0-9]{64}$/);
});

test("behavior changes require a newer per-policy version", () => {
  const before = lockFor();
  const changedDefinitions = structuredClone(workflows);
  changedDefinitions[0].rules[0].points += 1;
  const unchangedVersion = lockFor(changedDefinitions);
  assert.ok(policyLockIssues(before, unchangedVersion).some((issue) => issue.includes("behavior changed")));

  const [major, minor, patch] = changedDefinitions[0].policyVersion.split(".").map(Number);
  changedDefinitions[0].policyVersion = `${major}.${minor}.${patch + 1}`;
  const bumpedVersion = lockFor(changedDefinitions);
  assert.deepEqual(policyLockIssues(before, bumpedVersion), []);
});

test("policy versions cannot regress", () => {
  const beforeDefinitions = structuredClone(workflows);
  beforeDefinitions[0].policyVersion = "2.0.0";
  const issues = policyLockIssues(lockFor(beforeDefinitions), lockFor());
  assert.ok(issues.some((issue) => issue.includes("regressed")));
  assert.equal(compareSemanticVersions("1.2.0", "1.1.9"), 1);
  assert.equal(compareSemanticVersions("1.0", "1.0.0"), null);
});

test("policy removal and engine-version regression fail closed", () => {
  const before = lockFor();
  const removed = lockFor(workflows.slice(1));
  assert.ok(policyLockIssues(before, removed).some((issue) => issue.includes("policy was removed")));

  const newerEngine = lockFor(workflows, engineSource, "2.0.0");
  assert.ok(policyLockIssues(newerEngine, before).some((issue) => issue.includes("policyEngineVersion regressed")));
});

test("engine source changes require an engine version bump and policy bumps", () => {
  const before = lockFor();
  const sourceChanged = lockFor(workflows, `${engineSource}\n// behavior change`);
  assert.ok(policyLockIssues(before, sourceChanged).some((issue) => issue.includes("policy engine source changed")));

  const versionChanged = lockFor(workflows, `${engineSource}\n// behavior change`, "1.1.0");
  assert.equal(policyLockIssues(before, versionChanged).filter((issue) => issue.includes("behavior changed")).length, workflows.length);
});
