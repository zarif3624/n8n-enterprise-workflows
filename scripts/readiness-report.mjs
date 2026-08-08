import { buildPolicyLifecycleReport } from "./policy-lifecycle.mjs";

export function buildReadinessReport({
  asOf,
  packageManifest,
  catalog,
  artifactManifest,
  policyLock,
  lifecycle,
  compatibility,
  registry,
  artifactManifestMatches,
  contractIssues,
  lifecycleIssues,
  compatibilityIssues
}) {
  const lifecycleReport = buildPolicyLifecycleReport(lifecycle, { asOf });
  const issues = [
    ...contractIssues.map((issue) => `contract: ${issue}`),
    ...lifecycleIssues.map((issue) => `lifecycle: ${issue}`),
    ...compatibilityIssues.map((issue) => `compatibility: ${issue}`),
    ...(!artifactManifestMatches ? ["integrity: artifact manifest does not match repository bytes"] : [])
  ];
  const blockers = [];
  if (lifecycleReport.summary.draft > 0) blockers.push({
    code: "owner_approval_required",
    count: lifecycleReport.summary.draft,
    message: "Draft policies require a real review by their named business owners before production use"
  });
  if (lifecycleReport.summary.overdue > 0) blockers.push({
    code: "policy_review_overdue",
    count: lifecycleReport.summary.overdue,
    message: "Overdue policy reviews must be completed before production use"
  });
  return {
    reportVersion: 1,
    asOf,
    packageVersion: packageManifest.version,
    repositoryStatus: issues.length ? "invalid" : "ready",
    deploymentStatus: blockers.length ? "blocked" : "requires-environment-configuration",
    inventory: {
      workflows: catalog.length,
      departments: new Set(catalog.map((entry) => entry.department)).size,
      artifacts: artifactManifest.artifactCount
    },
    policyGovernance: {
      engineVersion: policyLock.policyEngineVersion,
      engineFingerprint: policyLock.policyEngineFingerprint,
      draft: lifecycleReport.summary.draft,
      active: lifecycleReport.summary.active,
      deprecated: lifecycleReport.summary.deprecated,
      dueSoon: lifecycleReport.summary.dueSoon,
      overdue: lifecycleReport.summary.overdue
    },
    runtimeCompatibility: {
      minimumSupportedN8nVersion: compatibility.minimumSupportedN8nVersion,
      scheduledN8nVersions: compatibility.scheduledN8nVersions,
      nodeVersion: compatibility.nodeVersion,
      representativeWorkflow: compatibility.scope.representativeWorkflow,
      probeCount: compatibility.scope.probes.length
    },
    contractCoverage: {
      repositoryDocuments: registry.documents.length,
      generatedOutputs: registry.outputs.length,
      schemas: new Set([...registry.documents, ...registry.outputs].map((entry) => entry.schema)).size
    },
    evidence: {
      artifactManifestMatches,
      contractRegistryValid: contractIssues.length === 0,
      lifecycleContractValid: lifecycleIssues.length === 0,
      runtimeCompatibilityValid: compatibilityIssues.length === 0,
      issues
    },
    deploymentBlockers: blockers,
    requiredDeploymentControls: [
      "Configure built-in webhook authentication",
      "Map and test enterprise source fields",
      "Connect downstream systems only in a development environment",
      "Assign human approval for consequential actions",
      "Configure monitoring, error handling, retention, and rollback"
    ],
    limitations: [
      "This report validates checked-in metadata and integrity; run npm run check for executable tests",
      "Live n8n runtime evidence is produced separately by the scheduled compatibility workflow",
      "A ready repository is not approval to deploy any policy in a specific organization"
    ],
    privacy: { rawPayloadsIncluded: false, perRecordResultsIncluded: false }
  };
}

export function renderReadinessReport(report) {
  const lines = [
    "# Enterprise workflow readiness",
    "",
    `Repository: **${report.repositoryStatus}**. Deployment: **${report.deploymentStatus}**.`,
    "",
    `Inventory: ${report.inventory.workflows} workflows, ${report.inventory.departments} departments, ${report.inventory.artifacts} integrity-covered artifacts.`,
    `Governance: ${report.policyGovernance.draft} draft, ${report.policyGovernance.active} active, ${report.policyGovernance.deprecated} deprecated, ${report.policyGovernance.dueSoon} due soon, ${report.policyGovernance.overdue} overdue.`,
    `Compatibility: n8n ${report.runtimeCompatibility.scheduledN8nVersions.join(", ")} on Node ${report.runtimeCompatibility.nodeVersion}, ${report.runtimeCompatibility.probeCount} live probes.`,
    `Contracts: ${report.contractCoverage.repositoryDocuments} documents, ${report.contractCoverage.generatedOutputs} generated outputs, ${report.contractCoverage.schemas} schemas.`,
    ""
  ];
  if (report.deploymentBlockers.length) {
    lines.push("## Deployment blockers", "");
    for (const blocker of report.deploymentBlockers) lines.push(`- ${blocker.message} (${blocker.count})`);
    lines.push("");
  }
  lines.push("## Required environment controls", "", ...report.requiredDeploymentControls.map((item) => `- ${item}`), "", "## Evidence limits", "", ...report.limitations.map((item) => `- ${item}`), "");
  return `${lines.join("\n").trimEnd()}\n`;
}
