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
  compatibilityIssues,
  workflowSlug
}) {
  const scopedEntry = workflowSlug ? catalog.find((entry) => entry.slug === workflowSlug) : undefined;
  if (workflowSlug && !scopedEntry) throw new Error(`Unknown workflow slug: ${workflowSlug}`);
  const scopedLifecycle = workflowSlug
    ? { ...lifecycle, policies: lifecycle.policies.filter((entry) => entry.slug === workflowSlug) }
    : lifecycle;
  const scopedLifecycleEntry = workflowSlug ? scopedLifecycle.policies[0] : undefined;
  const lifecycleReport = buildPolicyLifecycleReport(scopedLifecycle, { asOf });
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
  if (lifecycleReport.summary.deprecated > 0) blockers.push({
    code: "policy_deprecated",
    count: lifecycleReport.summary.deprecated,
    message: "Deprecated policies must not be used for new production deployments"
  });
  return {
    reportVersion: 2,
    asOf,
    packageVersion: packageManifest.version,
    scope: workflowSlug
      ? {
          type: "workflow",
          workflow: workflowSlug,
          department: scopedEntry.department,
          owner: scopedLifecycleEntry.owner,
          lifecycleStatus: scopedLifecycleEntry.status,
          reviewDueOn: scopedLifecycleEntry.reviewDueOn,
          policyVersion: scopedLifecycleEntry.policyVersion,
          policyFingerprint: scopedLifecycleEntry.fingerprint
        }
      : { type: "catalog" },
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
      "Enforce ingress request-body size and rate limits before the webhook",
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
    `Scope: ${report.scope.type === "workflow" ? `workflow \`${report.scope.workflow}\` (${report.scope.department})` : "complete catalog"}.`,
    ...(report.scope.type === "workflow"
      ? [`Policy identity: ${report.scope.policyVersion}, \`${report.scope.policyFingerprint}\`; ${report.scope.lifecycleStatus}, owned by ${report.scope.owner}, review due ${report.scope.reviewDueOn}.`]
      : []),
    `Repository inventory: ${report.inventory.workflows} workflows, ${report.inventory.departments} departments, ${report.inventory.artifacts} integrity-covered artifacts.`,
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
