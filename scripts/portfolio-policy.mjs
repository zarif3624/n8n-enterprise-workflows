function identities(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => `${entry.department}/${entry.slug}`)
    .sort();
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export const openCoreBoundaryRemovalIdentities = Object.freeze([
  "corporate-communications/external-communication-approval",
  "customer-success/customer-risk-escalation",
  "data-and-analytics/data-access-request-triage",
  "facilities/workplace-incident-routing",
  "human-resources/employee-access-request-triage",
  "legal/contract-intake-routing",
  "marketing/campaign-lead-compliance-gate",
  "operations/major-incident-stakeholder-brief",
  "privacy/data-subject-request-triage",
  "procurement/vendor-risk-intake",
  "risk-and-compliance/ai-use-case-risk-intake",
  "sales/enterprise-lead-routing"
]);

export function portfolioPolicyIssues({ portfolio, catalog, definitions, discoveredPaths }) {
  const issues = [];
  const allocation = portfolio?.allocation ?? {};
  if (allocation.openSource + allocation.commercialReserve !== allocation.evaluatedWorkflowFamilies) {
    issues.push("allocation counts must add up to the evaluated workflow families");
  }
  if (allocation.openSource * 100 !== allocation.evaluatedWorkflowFamilies * allocation.openSourcePercent) {
    issues.push("open-source percentage must match the allocation counts");
  }
  if (allocation.commercialReserve * 100 !== allocation.evaluatedWorkflowFamilies * allocation.commercialReservePercent) {
    issues.push("commercial-reserve percentage must match the allocation counts");
  }

  const sourceLineage = portfolio?.sourceLineage ?? {};
  const publicLineage = portfolio?.publicLineage ?? {};
  const privateLineage = portfolio?.privateLineage ?? {};
  if (sourceLineage.evidenceDerivedFamilies + sourceLineage.newerNamedConcepts !== allocation.evaluatedWorkflowFamilies) {
    issues.push("source lineage counts must add up to the evaluated workflow families");
  }
  if (publicLineage.evidenceDerivedFamilies + publicLineage.newerNamedConcepts !== allocation.openSource) {
    issues.push("public lineage counts must add up to the open-source allocation");
  }
  if (privateLineage.evidenceDerivedFamilies + privateLineage.newerNamedConcepts !== allocation.commercialReserve) {
    issues.push("private lineage counts must add up to the commercial-reserve allocation");
  }
  if (publicLineage.evidenceDerivedFamilies + privateLineage.evidenceDerivedFamilies !== sourceLineage.evidenceDerivedFamilies) {
    issues.push("evidence-derived lineage must partition between public and private portfolios");
  }
  if (publicLineage.newerNamedConcepts + privateLineage.newerNamedConcepts !== sourceLineage.newerNamedConcepts) {
    issues.push("newer-concept lineage must partition between public and private portfolios");
  }

  const selectionCriteria = Array.isArray(portfolio?.selectionCriteria) ? portfolio.selectionCriteria : [];
  if (selectionCriteria.reduce((sum, entry) => sum + entry.weight, 0) !== 100) {
    issues.push("selection criterion weights must add up to 100");
  }
  const criterionIds = selectionCriteria.map((entry) => entry.id);
  if (new Set(criterionIds).size !== criterionIds.length) {
    issues.push("selection criterion identifiers must be unique");
  }

  const publicWorkflows = Array.isArray(portfolio?.publicWorkflows) ? portfolio.publicWorkflows : [];
  const publicSlugs = publicWorkflows.map((entry) => entry.slug);
  if (publicWorkflows.length !== allocation.openSource) {
    issues.push("public workflow identity count must match the open-source allocation");
  }
  if (new Set(publicSlugs).size !== publicSlugs.length) {
    issues.push("public workflow slugs must be unique");
  }

  const historicalRemovals = Array.isArray(portfolio?.historicalRemovals) ? portfolio.historicalRemovals : [];
  const historicalIdentities = identities(historicalRemovals);
  if (!sameValues(historicalIdentities, openCoreBoundaryRemovalIdentities)) {
    issues.push("historical removal identities must exactly match the 0.3.0 boundary authorization");
  }
  if (new Set(historicalIdentities).size !== historicalIdentities.length) {
    issues.push("historical removal identities must be unique");
  }
  const publicIdentities = new Set(identities(publicWorkflows));
  if (historicalIdentities.some((identity) => publicIdentities.has(identity))) {
    issues.push("historical removals must not overlap the public portfolio");
  }

  const productBoundary = portfolio?.productBoundary ?? {};
  if (productBoundary.reservedWorkflowFamilies !== allocation.commercialReserve) {
    issues.push("product boundary reserved families must match the commercial-reserve allocation");
  }
  if (!sameValues(identities(catalog), identities(publicWorkflows))) {
    issues.push("catalog workflow identities must exactly match the public portfolio");
  }
  if (!sameValues(identities(definitions), identities(publicWorkflows))) {
    issues.push("source workflow identities must exactly match the public portfolio");
  }
  const expectedPaths = publicWorkflows
    .map((entry) => `workflows/${entry.department}/${entry.slug}`)
    .sort();
  const actualPaths = [...(Array.isArray(discoveredPaths) ? discoveredPaths : [])].sort();
  if (!sameValues(actualPaths, expectedPaths)) {
    issues.push("workflow implementation paths must exactly match the public portfolio");
  }
  return issues;
}
