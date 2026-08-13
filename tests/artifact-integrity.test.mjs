import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildArtifactManifest, generatedArtifactDescriptors, sha256 } from "../scripts/artifact-integrity.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const policyLock = JSON.parse(await readFile(join(root, "policy-lock.json"), "utf8"));
const expectedWorkflowSlugs = [
  "agent-evaluation-release-gate",
  "closed-won-launch-readiness",
  "customer-health-action-review",
  "enterprise-data-reconciliation-control",
  "field-service-completion-review",
  "incident-rca-evidence-review",
  "invoice-exception-triage",
  "meeting-to-action-review",
  "multi-model-routing-fallback",
  "people-operations-case-routing",
  "phishing-report-triage",
  "production-change-risk-gate",
  "research-to-crm-review",
  "rfp-response-evidence-review",
  "service-desk-priority-routing",
  "support-escalation-command-center"
];
const expectedDepartments = [
  "artificial-intelligence",
  "customer-success",
  "customer-support",
  "data-operations",
  "engineering",
  "field-operations",
  "finance",
  "incident-management",
  "information-technology",
  "operations",
  "people-operations",
  "proposal-management",
  "revenue-operations",
  "sales",
  "security"
];
const expectedFixturePaths = [
  "workflows/artificial-intelligence/agent-evaluation-release-gate/examples/high-risk.json",
  "workflows/artificial-intelligence/agent-evaluation-release-gate/examples/invalid.json",
  "workflows/artificial-intelligence/agent-evaluation-release-gate/examples/low-risk.json",
  "workflows/artificial-intelligence/multi-model-routing-fallback/examples/high-risk.json",
  "workflows/artificial-intelligence/multi-model-routing-fallback/examples/invalid.json",
  "workflows/artificial-intelligence/multi-model-routing-fallback/examples/low-risk.json",
  "workflows/customer-success/customer-health-action-review/examples/high-risk.json",
  "workflows/customer-success/customer-health-action-review/examples/invalid.json",
  "workflows/customer-success/customer-health-action-review/examples/low-risk.json",
  "workflows/customer-support/support-escalation-command-center/examples/high-risk.json",
  "workflows/customer-support/support-escalation-command-center/examples/invalid.json",
  "workflows/customer-support/support-escalation-command-center/examples/low-risk.json",
  "workflows/data-operations/enterprise-data-reconciliation-control/examples/high-risk.json",
  "workflows/data-operations/enterprise-data-reconciliation-control/examples/invalid.json",
  "workflows/data-operations/enterprise-data-reconciliation-control/examples/low-risk.json",
  "workflows/engineering/production-change-risk-gate/examples/high-risk.json",
  "workflows/engineering/production-change-risk-gate/examples/invalid.json",
  "workflows/engineering/production-change-risk-gate/examples/low-risk.json",
  "workflows/field-operations/field-service-completion-review/examples/high-risk.json",
  "workflows/field-operations/field-service-completion-review/examples/invalid.json",
  "workflows/field-operations/field-service-completion-review/examples/low-risk.json",
  "workflows/finance/invoice-exception-triage/examples/high-risk.json",
  "workflows/finance/invoice-exception-triage/examples/invalid.json",
  "workflows/finance/invoice-exception-triage/examples/low-risk.json",
  "workflows/incident-management/incident-rca-evidence-review/examples/high-risk.json",
  "workflows/incident-management/incident-rca-evidence-review/examples/invalid.json",
  "workflows/incident-management/incident-rca-evidence-review/examples/low-risk.json",
  "workflows/information-technology/service-desk-priority-routing/examples/high-risk.json",
  "workflows/information-technology/service-desk-priority-routing/examples/invalid.json",
  "workflows/information-technology/service-desk-priority-routing/examples/low-risk.json",
  "workflows/operations/meeting-to-action-review/examples/high-risk.json",
  "workflows/operations/meeting-to-action-review/examples/invalid.json",
  "workflows/operations/meeting-to-action-review/examples/low-risk.json",
  "workflows/people-operations/people-operations-case-routing/examples/high-risk.json",
  "workflows/people-operations/people-operations-case-routing/examples/invalid.json",
  "workflows/people-operations/people-operations-case-routing/examples/low-risk.json",
  "workflows/proposal-management/rfp-response-evidence-review/examples/high-risk.json",
  "workflows/proposal-management/rfp-response-evidence-review/examples/invalid.json",
  "workflows/proposal-management/rfp-response-evidence-review/examples/low-risk.json",
  "workflows/revenue-operations/closed-won-launch-readiness/examples/high-risk.json",
  "workflows/revenue-operations/closed-won-launch-readiness/examples/invalid.json",
  "workflows/revenue-operations/closed-won-launch-readiness/examples/low-risk.json",
  "workflows/sales/research-to-crm-review/examples/high-risk.json",
  "workflows/sales/research-to-crm-review/examples/invalid.json",
  "workflows/sales/research-to-crm-review/examples/low-risk.json",
  "workflows/security/phishing-report-triage/examples/high-risk.json",
  "workflows/security/phishing-report-triage/examples/invalid.json",
  "workflows/security/phishing-report-triage/examples/low-risk.json"
];

test("artifact descriptors cover every generated public file exactly once", () => {
  const descriptors = generatedArtifactDescriptors(catalog);
  assert.equal(descriptors.length, 23 + catalog.length * 5);
  assert.equal(new Set(descriptors.map((entry) => entry.path)).size, descriptors.length);
  assert.deepEqual(descriptors.map((entry) => entry.path), [...descriptors.map((entry) => entry.path)].sort());
});

test("artifact manifest deterministically hashes the complete generated catalog", async () => {
  const options = {
    root,
    catalog,
    packageVersion: packageManifest.version,
    policySchemaVersion: policyLock.policySchemaVersion,
    policyEngineVersion: policyLock.policyEngineVersion,
    policyEngineFingerprint: policyLock.policyEngineFingerprint
  };
  const first = await buildArtifactManifest(options);
  const second = await buildArtifactManifest(options);
  assert.deepEqual(first, second);
  assert.equal(first.artifactCount, 103);
  assert.equal(first.workflowCount, 16);
  assert.equal(first.departmentCount, 15);
  assert.deepEqual(catalog.map((entry) => entry.slug).sort(), expectedWorkflowSlugs);
  assert.deepEqual([...new Set(catalog.map((entry) => entry.department))].sort(), expectedDepartments);
  const fixtures = first.artifacts.filter((entry) => entry.path.includes("/examples/"));
  assert.equal(fixtures.length, 48);
  assert.deepEqual([...new Set(fixtures.map((entry) => entry.path.split("/")[2]))].sort(), expectedWorkflowSlugs);
  assert.deepEqual([...new Set(fixtures.map((entry) => entry.path.split("/").at(-1)))].sort(), ["high-risk.json", "invalid.json", "low-risk.json"]);
  assert.deepEqual(fixtures.map((entry) => entry.path), expectedFixturePaths);
  assert.ok(first.artifacts.every((entry) => entry.bytes > 0 && /^sha256:[a-f0-9]{64}$/.test(entry.sha256)));
});

test("generated workflow contract tables render every catalog enum", async () => {
  const enumFields = catalog.flatMap((workflow) => Object.entries(workflow.inputSchema.properties)
    .filter(([, contract]) => Array.isArray(contract.enum))
    .map(([field, contract]) => ({ workflow, field, values: contract.enum })));

  assert.ok(enumFields.length > 0, "catalog must exercise generated enum documentation");
  for (const { workflow, field, values } of enumFields) {
    const readme = await readFile(join(root, workflow.path, "README.md"), "utf8");
    const contractRow = readme.split("\n").find((line) => line.startsWith(`| \`${field}\` |`));
    assert.ok(contractRow, `${workflow.slug}: README is missing the ${field} contract row`);
    assert.ok(
      contractRow.includes(`one of ${values.join(", ")}`),
      `${workflow.slug}: README does not render every ${field} enum value`
    );
  }
});

test("SHA-256 helper hashes bytes without platform-dependent transformations", () => {
  assert.equal(sha256(Buffer.from("enterprise\n")), "sha256:9c169fe900ff79790395784287bfa82f0dc0059375a34a2881b9b745c8efd42e");
});
