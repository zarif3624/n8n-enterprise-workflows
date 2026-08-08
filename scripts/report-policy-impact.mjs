import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPolicyImpactReport, replayPolicyImpact, ruleWitnessCases } from "./policy-replay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureNames = ["low-risk", "high-risk", "invalid"];

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
}

function verifyBaseRef(baseRef) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`], { stdio: "ignore" });
  } catch {
    throw new Error(`Base Git ref not found: ${baseRef}`);
  }
}

function readBaseText(baseRef, path) {
  try {
    return git(["show", `${baseRef}:${path}`]);
  } catch {
    return null;
  }
}

function safeIdentity(policy) {
  if (!/^[a-z0-9-]+$/.test(policy.department) || !/^[a-z0-9-]+$/.test(policy.slug)) {
    throw new Error(`Unsafe policy identity in snapshot: ${policy.department}/${policy.slug}`);
  }
}

function policyForReplay(snapshotEntry) {
  return { ...snapshotEntry.behavior, policyVersion: snapshotEntry.policyVersion };
}

async function fixtureCases(policy, source, baseRef) {
  safeIdentity(policy);
  const cases = [];
  const directory = `workflows/${policy.department}/${policy.slug}/examples`;
  let lowRisk;
  for (const name of fixtureNames) {
    const path = `${directory}/${name}.json`;
    const text = source === "base" ? readBaseText(baseRef, path) : await readFile(join(root, path), "utf8").catch(() => null);
    if (text === null) continue;
    const payload = JSON.parse(text);
    cases.push({ labels: [`${source}:fixture:${name}`], payload });
    if (name === "low-risk") lowRisk = payload;
  }
  if (lowRisk) cases.push(...ruleWitnessCases(policyForReplay(policy), lowRisk, source));
  return cases;
}

export async function buildPolicyImpactChangeSets(previous, current, { baseRef }) {
  const oldBySlug = new Map((previous?.policies ?? []).map((policy) => [policy.slug, policy]));
  const newBySlug = new Map((current.policies ?? []).map((policy) => [policy.slug, policy]));
  const slugs = [...new Set([...oldBySlug.keys(), ...newBySlug.keys()])].sort();
  const changeSets = [];
  for (const slug of slugs) {
    const before = oldBySlug.get(slug);
    const after = newBySlug.get(slug);
    if (!before) {
      changeSets.push({ slug, status: "added", afterVersion: after.policyVersion });
      continue;
    }
    if (!after) {
      changeSets.push({ slug, status: "removed", beforeVersion: before.policyVersion });
      continue;
    }
    if (before.fingerprint === after.fingerprint) continue;
    const cases = [
      ...await fixtureCases(before, "base", baseRef),
      ...await fixtureCases(after, "current", baseRef)
    ];
    const replay = replayPolicyImpact({
      before: policyForReplay(before),
      after: policyForReplay(after),
      cases
    });
    changeSets.push({
      slug,
      status: "changed",
      beforeVersion: before.policyVersion,
      afterVersion: after.policyVersion,
      ...replay
    });
  }
  return changeSets;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const baseRef = process.argv[2];
  if (!baseRef) {
    console.error("Usage: node scripts/report-policy-impact.mjs <git-base-ref>");
    process.exit(2);
  }
  try {
    verifyBaseRef(baseRef);
    const current = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
    const previousText = readBaseText(baseRef, "policy-snapshot.json");
    const previous = previousText === null ? null : JSON.parse(previousText);
    const changeSets = await buildPolicyImpactChangeSets(previous, current, { baseRef });
    process.stdout.write(renderPolicyImpactReport(changeSets, {
      baseRef,
      baselineMissing: previous === null,
      engineChanged: previous !== null && previous.policyEngineFingerprint !== current.policyEngineFingerprint
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
