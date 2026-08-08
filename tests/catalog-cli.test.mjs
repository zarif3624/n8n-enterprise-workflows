import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildAdoptionPlan,
  renderAdoptionPlan,
  renderCatalogTable,
  renderWorkflowDetail,
  searchCatalog,
  workflowDetail
} from "../scripts/catalog-planner.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));

test("catalog search ranks business terms and filters departments and adapters", () => {
  assert.equal(searchCatalog(catalog, "phishing security")[0].slug, "phishing-report-triage");
  assert.deepEqual(searchCatalog(catalog, "", { department: "finance" }).map((entry) => entry.slug), ["invoice-exception-triage"]);
  assert.ok(searchCatalog(catalog, "", { adapter: "Slack" }).length >= 4);
  assert.deepEqual(searchCatalog(catalog, "term-that-does-not-exist"), []);
});

test("workflow details combine catalog adoption metadata with policy behavior", () => {
  const entry = catalog.find((candidate) => candidate.slug === "invoice-exception-triage");
  const detail = workflowDetail(entry, snapshot);
  assert.equal(detail.rules.length, 5);
  assert.equal(detail.hardGateCount, 2);
  assert.equal(detail.fields.filter((field) => field.required).length, 4);
  assert.match(detail.roiModel, /monthly invoice volume/);
  assert.match(renderWorkflowDetail(detail), /hold_payment_and_escalate/);
});

test("adoption plans expose controls and calculate conservative capacity value", () => {
  const entry = catalog.find((candidate) => candidate.slug === "invoice-exception-triage");
  const detail = workflowDetail(entry, snapshot);
  const plan = buildAdoptionPlan(detail, {
    adapter: "SAP",
    capacity: { monthlyVolume: 5000, minutesSaved: 4, hourlyCost: 60 },
    fixtureOutcomes: [{ name: "lowRisk", httpStatus: 200, priorityBand: "low", score: 0, decision: "continue" }]
  });
  assert.equal(plan.adapter.listedAsTypical, true);
  assert.equal(plan.roi.capacityEstimate.annualCapacityValue, 240000);
  assert.equal(plan.rolloutGates.length, 8);
  assert.ok(plan.rolloutGates.some((entry) => entry.gate === "Ingress protection" && /body size and rate limits/.test(entry.evidence)));
  assert.equal(plan.verificationCommands.length, 3);
  assert.equal(plan.mappingCommands.length, 2);
  assert.match(plan.mappingCommands[0], /^npm run --silent mapping/);
  assert.match(plan.conformanceCommand, /sanitized-records\.jsonl/);
  assert.match(renderAdoptionPlan(plan), /Illustrative annual capacity value: \*\*\$240,000\*\*/);
});

test("adoption plans reject partial or unsafe ROI assumptions", () => {
  const detail = workflowDetail(catalog[0], snapshot);
  assert.throws(() => buildAdoptionPlan(detail, { capacity: { monthlyVolume: 100 } }), /requires monthly volume/);
  assert.throws(
    () => buildAdoptionPlan(detail, { capacity: { monthlyVolume: 100, minutesSaved: -1, hourlyCost: 50 } }),
    /non-negative finite/
  );
  assert.match(renderCatalogTable([]), /No workflows matched/);
});

test("catalog CLI supports machine-readable output and fails clearly for unknown workflows", () => {
  const success = spawnSync(process.execPath, ["scripts/catalog-cli.mjs", "list", "--department", "finance", "--json"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout)[0].slug, "invoice-exception-triage");

  const failure = spawnSync(process.execPath, ["scripts/catalog-cli.mjs", "plan", "unknown-workflow"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(failure.status, 2);
  assert.match(failure.stderr, /Unknown workflow slug/);

  const ignoredOption = spawnSync(process.execPath, ["scripts/catalog-cli.mjs", "show", "invoice-exception-triage", "--adapter", "SAP"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(ignoredOption.status, 2);
  assert.match(ignoredOption.stderr, /not supported by this command/);
});
