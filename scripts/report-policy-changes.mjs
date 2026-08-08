import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function inline(value) {
  return `\`${String(value).replaceAll("`", "\\`")}\``;
}

function listDiff(before = [], after = []) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((value) => !beforeSet.has(value)),
    removed: before.filter((value) => !afterSet.has(value))
  };
}

function describeListChange(label, before, after) {
  const { added, removed } = listDiff(before, after);
  const parts = [];
  if (added.length) parts.push(`added ${added.map(inline).join(", ")}`);
  if (removed.length) parts.push(`removed ${removed.map(inline).join(", ")}`);
  return parts.length ? `- ${label}: ${parts.join("; ")}.` : null;
}

function ruleKey(rule, index, rules) {
  if (rule.id) return rule.id;
  const base = `${rule.field}_${rule.operator}`;
  const duplicates = rules.filter((candidate) => `${candidate.field}_${candidate.operator}` === base);
  return duplicates.length > 1 ? `${base}_${index + 1}` : base;
}

function describeRule(rule) {
  const comparison = rule.value === undefined ? rule.operator : `${rule.operator} ${JSON.stringify(rule.value)}`;
  const floor = rule.minimumBand ? `, floor ${rule.minimumBand}` : "";
  return `${rule.field} ${comparison}, ${rule.points} points${floor}, “${rule.reason}”`;
}

function policyChanges(before, after) {
  const lines = [];
  if (before.name !== after.name) lines.push(`- Name: ${inline(before.name)} → ${inline(after.name)}.`);
  if (before.owner !== after.owner) lines.push(`- Owner: ${inline(before.owner)} → ${inline(after.owner)}.`);
  if (before.department !== after.department) lines.push(`- Department: ${inline(before.department)} → ${inline(after.department)}.`);

  const oldBehavior = before.behavior ?? {};
  const newBehavior = after.behavior ?? {};
  const required = describeListChange("Required fields", oldBehavior.inputSchema?.required, newBehavior.inputSchema?.required);
  if (required) lines.push(required);
  const properties = describeListChange(
    "Declared fields",
    Object.keys(oldBehavior.inputSchema?.properties ?? {}),
    Object.keys(newBehavior.inputSchema?.properties ?? {})
  );
  if (properties) lines.push(properties);
  for (const field of Object.keys(newBehavior.inputSchema?.properties ?? {})) {
    const oldContract = oldBehavior.inputSchema?.properties?.[field];
    const newContract = newBehavior.inputSchema.properties[field];
    if (oldContract && JSON.stringify(oldContract) !== JSON.stringify(newContract)) {
      lines.push(`- Contract ${inline(field)}: ${inline(JSON.stringify(oldContract))} → ${inline(JSON.stringify(newContract))}.`);
    }
  }

  const oldRules = oldBehavior.rules ?? [];
  const newRules = newBehavior.rules ?? [];
  const oldByKey = new Map(oldRules.map((rule, index) => [ruleKey(rule, index, oldRules), rule]));
  const newByKey = new Map(newRules.map((rule, index) => [ruleKey(rule, index, newRules), rule]));
  for (const [key, rule] of newByKey) {
    const oldRule = oldByKey.get(key);
    if (!oldRule) lines.push(`- Rule added ${inline(key)}: ${describeRule(rule)}.`);
    else if (JSON.stringify(oldRule) !== JSON.stringify(rule)) lines.push(`- Rule changed ${inline(key)}: ${describeRule(oldRule)} → ${describeRule(rule)}.`);
  }
  for (const [key, rule] of oldByKey) {
    if (!newByKey.has(key)) lines.push(`- Rule removed ${inline(key)}: ${describeRule(rule)}.`);
  }

  for (const band of ["low", "medium", "high"]) {
    if (oldBehavior.decisions?.[band] !== newBehavior.decisions?.[band]) {
      lines.push(`- ${band} decision: ${inline(oldBehavior.decisions?.[band])} → ${inline(newBehavior.decisions?.[band])}.`);
    }
  }
  for (const threshold of ["medium", "high"]) {
    if (oldBehavior.thresholds?.[threshold] !== newBehavior.thresholds?.[threshold]) {
      lines.push(`- ${threshold} threshold: ${inline(oldBehavior.thresholds?.[threshold])} → ${inline(newBehavior.thresholds?.[threshold])}.`);
    }
  }
  const actions = describeListChange("Recommended actions", oldBehavior.actions, newBehavior.actions);
  if (actions) lines.push(actions);
  return lines;
}

export function renderPolicyChangeReport(previous, current, { baseRef = "base" } = {}) {
  const lines = ["## Policy change report", "", `Compared ${inline(baseRef)} with the generated working-tree snapshot.`, ""];
  if (!previous) {
    lines.push(`This is the first governed snapshot. It establishes ${current.policies?.length ?? 0} policy baselines.`);
    return `${lines.join("\n")}\n`;
  }

  const oldBySlug = new Map((previous.policies ?? []).map((policy) => [policy.slug, policy]));
  const newBySlug = new Map((current.policies ?? []).map((policy) => [policy.slug, policy]));
  let sharedChanged = false;
  if (previous.policySchemaVersion !== current.policySchemaVersion) {
    sharedChanged = true;
    lines.push(`- Policy schema: ${inline(previous.policySchemaVersion)} → ${inline(current.policySchemaVersion)}.`, "");
  }
  if (previous.policyEngineVersion !== current.policyEngineVersion) {
    sharedChanged = true;
    lines.push(`- Shared policy engine: ${inline(previous.policyEngineVersion)} → ${inline(current.policyEngineVersion)}.`, "");
  }
  if (previous.policyEngineFingerprint !== current.policyEngineFingerprint) {
    sharedChanged = true;
    lines.push(`- Policy engine source fingerprint: ${inline(previous.policyEngineFingerprint)} → ${inline(current.policyEngineFingerprint)}.`, "");
  }
  let changed = 0;
  for (const slug of [...new Set([...oldBySlug.keys(), ...newBySlug.keys()])].sort()) {
    const before = oldBySlug.get(slug);
    const after = newBySlug.get(slug);
    if (!before) {
      changed += 1;
      lines.push(`### ${slug}`, "", `- Added at policy version ${inline(after.policyVersion)} with owner ${inline(after.owner)}.`, "");
      continue;
    }
    if (!after) {
      changed += 1;
      lines.push(`### ${slug}`, "", `- Removed policy version ${inline(before.policyVersion)}.`, "");
      continue;
    }
    const details = policyChanges(before, after);
    const metadataChanged = before.name !== after.name || before.owner !== after.owner;
    if (before.fingerprint === after.fingerprint && before.policyVersion === after.policyVersion && !metadataChanged) continue;
    changed += 1;
    lines.push(`### ${slug} (${before.policyVersion} → ${after.policyVersion})`, "");
    if (!details.length) lines.push("- Version or fingerprint metadata changed; executable fields are otherwise identical.");
    else lines.push(...details);
    lines.push("");
  }

  if (changed === 0 && !sharedChanged) lines.push("No policy definition, contract, rule, decision, action, owner, or version changes detected.", "");
  else if (changed === 0) lines.push("No individual policy metadata or behavior changes detected.", "");
  else lines.splice(4, 0, `${changed} policy change set(s) detected.`, "");
  return `${lines.join("\n").trimEnd()}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const baseRef = process.argv[2];
  if (!baseRef) {
    console.error("Usage: node scripts/report-policy-changes.mjs <git-base-ref>");
    process.exit(2);
  }
  const current = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`], {
      cwd: root,
      stdio: "ignore"
    });
  } catch {
    console.error(`Base Git ref not found: ${baseRef}`);
    process.exit(2);
  }
  let previousText;
  try {
    previousText = execFileSync("git", ["show", `${baseRef}:policy-snapshot.json`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    previousText = null;
  }
  const previous = previousText === null ? null : JSON.parse(previousText);
  process.stdout.write(renderPolicyChangeReport(previous, current, { baseRef }));
}
