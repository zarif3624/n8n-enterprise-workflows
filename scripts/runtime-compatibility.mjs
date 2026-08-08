const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function compareSemver(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

export function runtimeCompatibilityIssues(document, { catalog, policyEngineVersion }) {
  const issues = [];
  const versions = document?.scheduledN8nVersions;
  if (document?.policyEngineVersion !== policyEngineVersion) {
    issues.push(`policyEngineVersion must match ${policyEngineVersion}`);
  }
  if (!Array.isArray(versions) || versions.length < 2) {
    issues.push("scheduledN8nVersions must contain at least two releases");
  } else {
    if (versions.some((version) => !semverPattern.test(version))) issues.push("scheduled n8n versions must be exact semantic versions");
    if (new Set(versions).size !== versions.length) issues.push("scheduled n8n versions must be unique");
    const sorted = [...versions].sort(compareSemver);
    if (JSON.stringify(versions) !== JSON.stringify(sorted)) issues.push("scheduled n8n versions must be sorted oldest to newest");
    if (!versions.includes(document.minimumSupportedN8nVersion)) issues.push("the minimum supported n8n version must be exercised by the matrix");
  }
  if (!semverPattern.test(document?.minimumSupportedN8nVersion ?? "")) issues.push("minimumSupportedN8nVersion must be an exact semantic version");
  if (!/^\d+$/.test(document?.nodeVersion ?? "")) issues.push("nodeVersion must be a major version string");
  if (!catalog.some((entry) => entry.slug === document?.scope?.representativeWorkflow)) {
    issues.push("representativeWorkflow must identify a catalog workflow");
  }
  const expectedProbes = [
    "low-risk-decision",
    "high-risk-decision",
    "invalid-fixture",
    "null-body",
    "forced-internal-error"
  ];
  if (JSON.stringify(document?.scope?.probes) !== JSON.stringify(expectedProbes)) {
    issues.push("scope.probes must cover the complete runtime contract in stable order");
  }
  return issues;
}

export function runtimeCompatibilityMatrix(document) {
  return document.scheduledN8nVersions.map((version) => ({
    "n8n-version": version,
    "node-version": document.nodeVersion
  }));
}
