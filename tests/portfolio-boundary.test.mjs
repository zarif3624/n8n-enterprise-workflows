import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { portfolioPolicyIssues } from "../scripts/portfolio-policy.mjs";
import { schemaContractIssues } from "../scripts/schema-contract-check.mjs";
import { workflows as publicDefinitions } from "../scripts/workflow-definitions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const continuityModule = await import("../scripts/verify-portfolio-continuity.mjs").catch(() => ({}));
const portfolioContinuityIssues = continuityModule.portfolioContinuityIssues
  ?? (() => ["portfolio continuity helper is missing"]);

const publicWorkflows = [
  { department: "engineering", slug: "production-change-risk-gate" },
  { department: "finance", slug: "invoice-exception-triage" },
  { department: "information-technology", slug: "service-desk-priority-routing" },
  { department: "security", slug: "phishing-report-triage" },
  { department: "artificial-intelligence", slug: "agent-evaluation-release-gate" },
  { department: "artificial-intelligence", slug: "multi-model-routing-fallback" },
  { department: "data-operations", slug: "enterprise-data-reconciliation-control" },
  { department: "operations", slug: "meeting-to-action-review" },
  { department: "sales", slug: "research-to-crm-review" },
  { department: "revenue-operations", slug: "closed-won-launch-readiness" },
  { department: "incident-management", slug: "incident-rca-evidence-review" },
  { department: "proposal-management", slug: "rfp-response-evidence-review" },
  { department: "customer-support", slug: "support-escalation-command-center" },
  { department: "people-operations", slug: "people-operations-case-routing" },
  { department: "customer-success", slug: "customer-health-action-review" },
  { department: "field-operations", slug: "field-service-completion-review" }
];
const expectedHistoricalRemovalIdentities = [
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
];

const portfolio = {
  portfolioVersion: 2,
  model: "open-core",
  allocation: {
    evaluatedWorkflowFamilies: 64,
    openSource: 16,
    commercialReserve: 48,
    openSourcePercent: 25,
    commercialReservePercent: 75
  },
  sourceLineage: { evidenceDerivedFamilies: 31, newerNamedConcepts: 33 },
  publicLineage: { evidenceDerivedFamilies: 4, newerNamedConcepts: 12 },
  privateLineage: { evidenceDerivedFamilies: 27, newerNamedConcepts: 21 },
  selectionCriteria: [
    { id: "community-value", weight: 60, description: "Broad, safe community utility." },
    { id: "maintenance-fit", weight: 40, description: "Sustainable public maintenance." }
  ],
  publicWorkflows,
  historicalRemovals: [],
  communitySurface: ["Inactive, credential-free workflow starters"],
  productBoundary: {
    reservedWorkflowFamilies: 48,
    implementationLocation: "outside-public-repository",
    includes: ["Maintained production adapters"]
  },
  historicalNotice: "Historical releases remain available under their existing licenses."
};

const catalog = publicWorkflows.map((entry) => ({
  ...entry,
  path: `workflows/${entry.department}/${entry.slug}`
}));
const definitions = publicWorkflows.map((entry) => ({ ...entry }));
const discoveredPaths = catalog.map((entry) => entry.path);

function identities(entries) {
  return entries.map(({ department, slug }) => `${department}/${slug}`).sort();
}

test("portfolio policy exposes a reusable validation interface", async () => {
  const module = await import("../scripts/portfolio-policy.mjs").catch(() => null);
  assert.equal(typeof module?.portfolioPolicyIssues, "function", "portfolioPolicyIssues must be exported");
});

test("portfolio validation CLI exposes side-effect-free help", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-portfolio.mjs", "--help"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: npm run portfolio:validate/);
});

test("portfolio continuity CLI exposes side-effect-free help", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-portfolio-continuity.mjs", "--help"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: npm run portfolio:continuity/);
});

test("checked-in portfolio declares the approved 64-family public boundary", async () => {
  const document = await readFile(join(root, "portfolio.json"), "utf8").then(JSON.parse).catch(() => null);
  const schema = await readFile(join(root, "schemas", "portfolio.schema.json"), "utf8").then(JSON.parse).catch(() => null);

  assert.ok(document, "portfolio.json must exist and contain JSON");
  assert.ok(schema, "portfolio schema must exist and contain JSON");
  assert.deepEqual(schemaContractIssues(document, schema, schema), []);
  assert.deepEqual(document.allocation, portfolio.allocation);
  assert.deepEqual(document.sourceLineage, portfolio.sourceLineage);
  assert.deepEqual(document.publicLineage, portfolio.publicLineage);
  assert.deepEqual(document.privateLineage, portfolio.privateLineage);
  assert.deepEqual(identities(document.publicWorkflows), identities(publicWorkflows));
  assert.equal(document.historicalRemovals.length, 12, "the 0.3.0 list remains historical boundary evidence");
  assert.deepEqual(identities(document.historicalRemovals), expectedHistoricalRemovalIdentities);
});

test("public workflow definitions exactly match the approved sixteen-workflow identity set", () => {
  assert.deepEqual(identities(publicDefinitions), identities(publicWorkflows));
});

test("portfolio policy rejects invalid source, public, and private lineage arithmetic", () => {
  const changed = structuredClone(portfolio);
  changed.sourceLineage.evidenceDerivedFamilies = 30;
  changed.publicLineage.newerNamedConcepts = 11;
  changed.privateLineage.evidenceDerivedFamilies = 25;

  const issues = portfolioPolicyIssues({ portfolio: changed, catalog, definitions, discoveredPaths });

  assert.ok(issues.includes("source lineage counts must add up to the evaluated workflow families"));
  assert.ok(issues.includes("public lineage counts must add up to the open-source allocation"));
  assert.ok(issues.includes("private lineage counts must add up to the commercial-reserve allocation"));
  assert.ok(issues.includes("evidence-derived lineage must partition between public and private portfolios"));
});

test("portfolio policy rejects allocation counts and percentages that diverge", () => {
  const changed = structuredClone(portfolio);
  changed.allocation.openSource = 15;
  changed.allocation.openSourcePercent = 24;
  changed.allocation.commercialReservePercent = 76;

  const issues = portfolioPolicyIssues({ portfolio: changed, catalog, definitions, discoveredPaths });

  assert.ok(issues.includes("allocation counts must add up to the evaluated workflow families"));
  assert.ok(issues.includes("open-source percentage must match the allocation counts"));
  assert.ok(issues.includes("commercial-reserve percentage must match the allocation counts"));
});

test("portfolio policy rejects invalid selection criteria", () => {
  const changed = structuredClone(portfolio);
  changed.selectionCriteria[0].weight = 59;
  changed.selectionCriteria[1].id = changed.selectionCriteria[0].id;

  const issues = portfolioPolicyIssues({ portfolio: changed, catalog, definitions, discoveredPaths });

  assert.ok(issues.includes("selection criterion weights must add up to 100"));
  assert.ok(issues.includes("selection criterion identifiers must be unique"));
});

test("portfolio policy rejects a public lineage that does not partition named concepts", () => {
  const changed = structuredClone(portfolio);
  changed.privateLineage.newerNamedConcepts = 20;

  const issues = portfolioPolicyIssues({ portfolio: changed, catalog, definitions, discoveredPaths });

  assert.ok(issues.includes("newer-concept lineage must partition between public and private portfolios"));
});

test("portfolio policy rejects duplicate public workflow identities", () => {
  const changed = structuredClone(portfolio);
  changed.publicWorkflows[15].slug = changed.publicWorkflows[0].slug;

  const issues = portfolioPolicyIssues({ portfolio: changed, catalog, definitions, discoveredPaths });

  assert.ok(issues.includes("public workflow slugs must be unique"));
});

test("portfolio policy keeps the 0.3.0 removal identities as immutable historical evidence", async () => {
  const changed = await readFile(join(root, "portfolio.json"), "utf8").then(JSON.parse);
  changed.historicalRemovals[1] = {
    ...changed.historicalRemovals[1],
    department: changed.historicalRemovals[0].department,
    slug: changed.historicalRemovals[0].slug
  };
  changed.historicalRemovals[2] = {
    ...changed.historicalRemovals[2],
    department: changed.publicWorkflows[0].department,
    slug: changed.publicWorkflows[0].slug
  };

  const issues = portfolioPolicyIssues({ portfolio: changed, catalog, definitions, discoveredPaths });

  assert.ok(issues.includes("historical removal identities must exactly match the 0.3.0 boundary authorization"));
  assert.ok(issues.includes("historical removal identities must be unique"));
  assert.ok(issues.includes("historical removals must not overlap the public portfolio"));
});

test("portfolio policy binds the product boundary to the commercial reserve", () => {
  const changed = structuredClone(portfolio);
  changed.productBoundary.reservedWorkflowFamilies = 47;

  const issues = portfolioPolicyIssues({ portfolio: changed, catalog, definitions, discoveredPaths });

  assert.ok(issues.includes("product boundary reserved families must match the commercial-reserve allocation"));
});

test("portfolio policy rejects catalog, source, and implementation identities outside the public selection", () => {
  const changedCatalog = structuredClone(catalog);
  const changedDefinitions = structuredClone(definitions);
  changedCatalog[0].slug = "different-workflow";
  changedDefinitions[1].department = "different-department";
  const changedPaths = [...discoveredPaths, "workflows/legal/private-implementation"];

  const issues = portfolioPolicyIssues({
    portfolio,
    catalog: changedCatalog,
    definitions: changedDefinitions,
    discoveredPaths: changedPaths
  });

  assert.ok(issues.includes("catalog workflow identities must exactly match the public portfolio"));
  assert.ok(issues.includes("source workflow identities must exactly match the public portfolio"));
  assert.ok(issues.includes("workflow implementation paths must exactly match the public portfolio"));
});

test("portfolio continuity allows additions to a supplied trusted base", () => {
  const basePortfolio = { publicWorkflows: publicWorkflows.slice(0, 4) };
  const candidatePortfolio = { publicWorkflows };

  assert.deepEqual(portfolioContinuityIssues({ basePortfolio, candidatePortfolio }), []);
});

test("portfolio continuity rejects a candidate removal even when its document claims approval", () => {
  const basePortfolio = { publicWorkflows: publicWorkflows.slice(0, 4) };
  const candidatePortfolio = {
    publicWorkflows: publicWorkflows.slice(1, 4),
    approvedRemovals: ["engineering/production-change-risk-gate"]
  };

  assert.deepEqual(portfolioContinuityIssues({ basePortfolio, candidatePortfolio }), [
    "engineering/production-change-risk-gate: public workflow removal requires external approval"
  ]);
});

test("portfolio continuity accepts an externally supplied approved removal", () => {
  const basePortfolio = { publicWorkflows: publicWorkflows.slice(0, 4) };
  const candidatePortfolio = { publicWorkflows: publicWorkflows.slice(1, 4) };

  assert.deepEqual(portfolioContinuityIssues({
    basePortfolio,
    candidatePortfolio,
    approvedRemovalIdentities: ["engineering/production-change-risk-gate"]
  }), []);
});

test("portfolio continuity treats a department move as a removal plus an addition", () => {
  const basePortfolio = { publicWorkflows: [{ department: "finance", slug: "invoice-exception-triage" }] };
  const candidatePortfolio = { publicWorkflows: [{ department: "operations", slug: "invoice-exception-triage" }] };

  assert.deepEqual(portfolioContinuityIssues({ basePortfolio, candidatePortfolio }), [
    "finance/invoice-exception-triage: public workflow removal requires external approval"
  ]);
  assert.deepEqual(portfolioContinuityIssues({
    basePortfolio,
    candidatePortfolio,
    approvedRemovalIdentities: ["invoice-exception-triage"]
  }), [
    "finance/invoice-exception-triage: public workflow removal requires external approval"
  ]);
});

test("portfolio continuity CLI ignores approval fields in the candidate document", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-continuity-"));
  try {
    const basePath = join(directory, "base.json");
    const candidatePath = join(directory, "candidate.json");
    const approvalsPath = join(directory, "approvals.json");
    await writeFile(basePath, JSON.stringify({ publicWorkflows: publicWorkflows.slice(0, 4) }));
    await writeFile(candidatePath, JSON.stringify({
      publicWorkflows: publicWorkflows.slice(1, 4),
      approvedRemovals: ["production-change-risk-gate"]
    }));
    await writeFile(approvalsPath, JSON.stringify(["engineering/production-change-risk-gate"]));

    const rejected = spawnSync(process.execPath, ["scripts/verify-portfolio-continuity.mjs", "--base", basePath, "--candidate", candidatePath], {
      cwd: root,
      encoding: "utf8"
    });
    assert.equal(rejected.status, 2, rejected.stderr);
    assert.match(rejected.stderr, /engineering\/production-change-risk-gate: public workflow removal requires external approval/);

    const approved = spawnSync(process.execPath, [
      "scripts/verify-portfolio-continuity.mjs",
      "--base", basePath,
      "--candidate", candidatePath,
      "--approved-removals", approvalsPath
    ], { cwd: root, encoding: "utf8" });
    assert.equal(approved.status, 0, approved.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
