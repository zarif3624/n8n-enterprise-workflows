import { createHash } from "node:crypto";

export const policyLockVersion = 1;

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function fingerprint(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

export function engineSourceFingerprint(source) {
  return fingerprint(source.replace(/\r\n/g, "\n"));
}

export function buildPolicyLock({ definitions, policyFor, schemaVersion, engineVersion, engineSource }) {
  return {
    lockVersion: policyLockVersion,
    policySchemaVersion: schemaVersion,
    policyEngineVersion: engineVersion,
    policyEngineFingerprint: engineSourceFingerprint(engineSource),
    policies: definitions
      .map((definition) => {
        const { policyVersion, ...behavior } = policyFor(definition);
        return {
          department: definition.department,
          slug: definition.slug,
          policyVersion,
          fingerprint: fingerprint({
            policySchemaVersion: schemaVersion,
            policyEngineVersion: engineVersion,
            department: definition.department,
            ...behavior
          })
        };
      })
      .sort((left, right) => left.slug.localeCompare(right.slug))
  };
}

function parseSemanticVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  return match ? match.slice(1).map(Number) : null;
}

export function compareSemanticVersions(left, right) {
  const leftParts = parseSemanticVersion(left);
  const rightParts = parseSemanticVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return Math.sign(leftParts[index] - rightParts[index]);
  }
  return 0;
}

export function policyLockIssues(previous, current) {
  const issues = [];
  if (!previous || !current) return issues;

  if (previous.lockVersion !== current.lockVersion) {
    issues.push(`policy lock format changed from ${previous.lockVersion} to ${current.lockVersion}`);
  }

  const engineVersionComparison = compareSemanticVersions(
    current.policyEngineVersion,
    previous.policyEngineVersion
  );
  if (engineVersionComparison === null) {
    issues.push("policyEngineVersion must use MAJOR.MINOR.PATCH");
  } else if (engineVersionComparison < 0) {
    issues.push(
      `policyEngineVersion regressed from ${previous.policyEngineVersion} to ${current.policyEngineVersion}`
    );
  }

  if (
    previous.policyEngineFingerprint !== current.policyEngineFingerprint &&
    previous.policyEngineVersion === current.policyEngineVersion
  ) {
    issues.push(
      `policy engine source changed without increasing policyEngineVersion (${current.policyEngineVersion})`
    );
  }

  const previousBySlug = new Map((previous.policies ?? []).map((entry) => [entry.slug, entry]));
  const currentBySlug = new Map((current.policies ?? []).map((entry) => [entry.slug, entry]));
  for (const entry of previous.policies ?? []) {
    if (!currentBySlug.has(entry.slug)) {
      issues.push(`${entry.slug}: policy was removed; deprecate it before deleting its public contract`);
    }
  }
  for (const entry of current.policies ?? []) {
    const oldEntry = previousBySlug.get(entry.slug);
    if (!oldEntry) continue;
    const versionComparison = compareSemanticVersions(entry.policyVersion, oldEntry.policyVersion);
    if (versionComparison === null) {
      issues.push(`${entry.slug}: policy versions must use MAJOR.MINOR.PATCH`);
    } else if (versionComparison < 0) {
      issues.push(`${entry.slug}: policy version regressed from ${oldEntry.policyVersion} to ${entry.policyVersion}`);
    } else if (entry.fingerprint !== oldEntry.fingerprint && versionComparison === 0) {
      issues.push(
        `${entry.slug}: behavior changed without increasing policyVersion (${entry.policyVersion})`
      );
    }
  }

  return issues;
}
