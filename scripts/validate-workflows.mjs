import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePolicy, policyEngineVersion, policySchemaVersion } from "./policy-engine.mjs";
import { buildPolicyLock, buildPolicySnapshot, policyLockVersion, policySnapshotVersion } from "./policy-governance.mjs";
import { inputSchemaFor, policyFor, workflows as definitions } from "./workflow-definitions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const openApi = JSON.parse(await readFile(join(root, "openapi.json"), "utf8"));
const policyLock = JSON.parse(await readFile(join(root, "policy-lock.json"), "utf8"));
const policySnapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const engineSource = await readFile(join(root, "scripts", "policy-engine.mjs"), "utf8");
const errors = [];
const webhookPaths = new Set();
const definitionsBySlug = new Map(definitions.map((definition) => [definition.slug, definition]));

function fail(path, message) {
  errors.push(`${path}: ${message}`);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reachableNodeNames(workflow, triggerName) {
  const seen = new Set();
  const queue = [triggerName];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    for (const outputType of Object.values(workflow.connections?.[name] ?? {})) {
      for (const channel of outputType ?? []) {
        for (const connection of channel ?? []) queue.push(connection.node);
      }
    }
  }
  return seen;
}

function evaluateExpression(expression, envelope) {
  const source = expression.replace(/^=\{\{/, "").replace(/\}\}$/, "").trim();
  const getNode = () => ({ first: () => ({ json: envelope }), item: { json: envelope } });
  const now = { toUTC: () => ({ toISO: () => "2026-08-07T03:00:00.000Z" }) };
  return new Function("$", "$execution", "$now", `return (${source});`)(getNode, { id: "test-execution" }, now);
}

if (!Array.isArray(catalog)) fail("catalog.json", "catalog root must be an array");
if (catalog.length !== definitions.length) fail("catalog.json", "catalog and workflow definitions must contain the same number of entries");
const expectedPolicyLock = buildPolicyLock({
  definitions,
  policyFor,
  schemaVersion: policySchemaVersion,
  engineVersion: policyEngineVersion,
  engineSource
});
const expectedPolicySnapshot = buildPolicySnapshot({
  definitions,
  policyFor,
  schemaVersion: policySchemaVersion,
  engineVersion: policyEngineVersion,
  engineSource
});
if (policyLock.lockVersion !== policyLockVersion) fail("policy-lock.json", "lock format version is unsupported");
if (!sameJson(policyLock, expectedPolicyLock)) fail("policy-lock.json", "policy fingerprints drifted from source definitions or engine");
if (policySnapshot.snapshotVersion !== policySnapshotVersion) fail("policy-snapshot.json", "snapshot format version is unsupported");
if (!sameJson(policySnapshot, expectedPolicySnapshot)) fail("policy-snapshot.json", "review snapshot drifted from source definitions or engine");
if (new Set(definitions.map((definition) => definition.slug)).size !== definitions.length) fail("workflow-definitions.mjs", "workflow slugs must be unique");
for (const definition of definitions) {
  const path = `workflow-definitions.mjs:${definition.slug}`;
  const allFields = [...definition.required, ...definition.optional];
  if (!/^\d+\.\d+\.\d+$/.test(definition.policyVersion ?? "")) fail(path, "policyVersion must use semantic versioning");
  if (new Set(allFields).size !== allFields.length) fail(path, "required and optional fields must be unique and disjoint");
  if (!definition.required.length || !definition.rules.length || !definition.actions.length) fail(path, "required fields, rules, and actions cannot be empty");
  if (!["low", "medium", "high"].every((band) => typeof definition.decisions?.[band] === "string")) fail(path, "all three decision bands are required");
  for (const rule of definition.rules) {
    if (!allFields.includes(rule.field)) fail(path, `rule references undeclared field ${rule.field}`);
    if (rule.operator === "missing" && definition.required.includes(rule.field)) fail(path, `missing rule on required field ${rule.field} can never execute`);
    if (!["missing", "truthy", "falsy", "equals", "includes", "gt", "gte", "lt"].includes(rule.operator)) fail(path, `unsupported rule operator ${rule.operator}`);
    if (!Number.isFinite(rule.points) || !rule.reason) fail(path, `rule ${rule.field} needs finite points and a reason`);
    if (rule.minimumBand && !["medium", "high"].includes(rule.minimumBand)) fail(path, `rule ${rule.field} has an invalid minimum band`);
  }
}
if (openApi.openapi !== "3.1.0" || openApi.info?.version !== packageManifest.version) fail("openapi.json", "OpenAPI version metadata is invalid");
if (Object.keys(openApi.paths ?? {}).length !== definitions.length) fail("openapi.json", "OpenAPI must expose exactly one path per workflow");

for (const entry of catalog) {
  const workflowPath = join(root, entry.path, "workflow.json");
  const readmePath = join(root, entry.path, "README.md");
  const definition = definitionsBySlug.get(entry.slug);
  let workflow;
  let raw;
  let readme;

  try {
    raw = await readFile(workflowPath, "utf8");
    workflow = JSON.parse(raw);
    readme = await readFile(readmePath, "utf8");
  } catch (error) {
    fail(entry.path, error.message);
    continue;
  }

  if (!definition) {
    fail(entry.path, "catalog entry has no policy definition");
    continue;
  }
  if (entry.schemaVersion !== policySchemaVersion || entry.policyVersion !== definition.policyVersion) fail(entry.path, "catalog policy/schema version is missing or unsupported");
  if (!sameJson(entry.inputSchema, inputSchemaFor(definition))) fail(entry.path, "catalog input schema drifted from the definition");
  if (!entry.outcome || !entry.owner || !entry.metric || !entry.examples || !Array.isArray(entry.adapters)) fail(entry.path, "catalog adoption metadata is incomplete");
  const openApiOperation = openApi.paths?.[entry.endpoint]?.post;
  if (!openApiOperation || openApiOperation.operationId !== `evaluate${entry.slug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`) fail(entry.path, "OpenAPI operation is missing or unstable");
  if (!sameJson(openApiOperation?.requestBody?.content?.["application/json"]?.schema, entry.inputSchema)) fail(entry.path, "OpenAPI input schema drifted from the catalog");
  for (const status of ["200", "400", "500"]) {
    const headers = openApiOperation?.responses?.[status]?.headers;
    if (!headers?.["X-Request-Id"] || headers?.["Cache-Control"]?.schema?.const !== "no-store") fail(entry.path, `OpenAPI ${status} response headers are incomplete`);
  }
  const decisionOverlay = openApiOperation?.responses?.["200"]?.content?.["application/json"]?.schema?.allOf?.[1]?.properties;
  if (decisionOverlay?.workflow?.const !== definition.slug || decisionOverlay?.policyVersion?.const !== definition.policyVersion) fail(entry.path, "OpenAPI success identity is not policy-specific");
  if (!sameJson(decisionOverlay?.decision?.enum, Object.values(definition.decisions))) fail(entry.path, "OpenAPI decision enum drifted from the policy");
  if (openApiOperation?.responses?.["500"]?.content?.["application/json"]?.schema?.$ref !== "#/components/schemas/InternalErrorResponse") fail(entry.path, "OpenAPI internal-error contract is missing");

  if (!workflow.id || !workflow.name || !Array.isArray(workflow.nodes) || workflow.nodes.length < 5) fail(entry.path, "workflow shape is incomplete");
  if (!workflow.description || workflow.description.split(/[.!?](?:\s|$)/).filter(Boolean).length < 2) fail(entry.path, "workflow description must explain what it does and why");
  if (workflow.active !== false) fail(entry.path, "template must ship inactive");
  if (workflow.settings?.executionTimeout !== 120) fail(entry.path, "execution timeout must be 120 seconds");
  if (workflow.settings?.timezone !== "UTC") fail(entry.path, "workflow timezone must be explicit");
  if (workflow.settings?.saveDataSuccessExecution !== "none") fail(entry.path, "success payload retention must default to none");
  if (!workflow.nodes.some((node) => node.type === "n8n-nodes-base.stickyNote")) fail(entry.path, "activation guidance sticky note is required");
  if (workflow.nodes.some((node) => node.type === "n8n-nodes-base.code")) fail(entry.path, "single-item policy templates must use native expressions, not Code nodes");

  const ids = new Set();
  const names = new Set();
  for (const node of workflow.nodes) {
    if (!node.id || ids.has(node.id)) fail(entry.path, `duplicate or missing node id: ${node.name}`);
    if (!node.name || names.has(node.name)) fail(entry.path, `duplicate or missing node name: ${node.name}`);
    ids.add(node.id);
    names.add(node.name);
    if (node.credentials) fail(entry.path, `${node.name} contains credential metadata`);
  }

  const triggers = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.webhook");
  if (triggers.length !== 1) fail(entry.path, "exactly one webhook trigger is required");
  const trigger = triggers[0];
  if (trigger?.parameters?.responseMode !== "responseNode") fail(entry.path, "webhook must use responseNode mode");
  if (trigger?.parameters?.authentication !== "none") fail(entry.path, "local template authentication mode must be explicit");
  const webhookPath = trigger?.parameters?.path;
  if (!webhookPath || webhookPaths.has(webhookPath) || !/^enterprise\/[a-z-]+\/[a-z-]+$/.test(webhookPath)) fail(entry.path, "webhook path must be safe and globally unique");
  webhookPaths.add(webhookPath);

  const sticky = workflow.nodes.find((node) => node.type === "n8n-nodes-base.stickyNote");
  if (!/inactive template|unauthenticated webhook|before activation/i.test(sticky?.parameters?.content ?? "")) fail(entry.path, "sticky note must make the unauthenticated local-test gate explicit");

  const evaluator = workflow.nodes.find((node) => node.name === "Evaluate policy signals");
  if (evaluator?.type !== "n8n-nodes-base.set" || evaluator?.typeVersion !== 3.4) fail(entry.path, "policy evaluator must use Edit Fields (Set) v3.4");
  if (evaluator?.parameters?.mode !== "raw" || evaluator?.parameters?.includeOtherFields !== false) fail(entry.path, "policy evaluator must return a clean raw object");
  if (!evaluator?.parameters?.jsonOutput?.startsWith("={{")) fail(entry.path, "policy evaluator expression is missing");
  if (evaluator?.onError !== "continueErrorOutput") fail(entry.path, "policy evaluator must route thrown errors to a dedicated output");
  if (!evaluator?.parameters?.jsonOutput?.endsWith("}}") || evaluator?.parameters?.jsonOutput?.slice(3, -2).includes("}}")) {
    fail(entry.path, "policy evaluator contains an internal n8n expression terminator");
  }

  const responders = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.respondToWebhook");
  const responder = responders.find((node) => node.name === "Return structured decision");
  const errorResponder = responders.find((node) => node.name === "Return internal error");
  if (responders.length !== 2) fail(entry.path, "exactly two webhook responders are required");
  if (!responder) fail(entry.path, "Respond to Webhook node is required");
  if (responder?.typeVersion !== 1.5) fail(entry.path, "Respond to Webhook must use v1.5");
  if (responder?.parameters?.responseBody !== "={{ $('Evaluate policy signals').item.json }}") fail(entry.path, "response must reference the evaluator by name and pass an object");
  if (responder?.parameters?.options?.responseCode !== "={{ $('Evaluate policy signals').item.json.httpStatus }}") fail(entry.path, "response status must reference the evaluator by name");
  const responseHeaders = Object.fromEntries((responder?.parameters?.options?.responseHeaders?.entries ?? []).map(({ name, value }) => [name.toLowerCase(), value]));
  if (responseHeaders["cache-control"] !== "no-store") fail(entry.path, "decision responses must disable intermediary caching");
  if (responseHeaders["x-request-id"] !== "={{ $('Evaluate policy signals').item.json.requestId }}") fail(entry.path, "decision responses must expose the correlation ID as a header");

  if (errorResponder?.typeVersion !== 1.5) fail(entry.path, "internal-error responder must use v1.5");
  if (errorResponder?.parameters?.options?.responseCode !== 500) fail(entry.path, "internal-error responder must return HTTP 500");
  if (!errorResponder?.parameters?.responseBody?.startsWith("={{") || !errorResponder?.parameters?.responseBody?.includes("internal_error")) fail(entry.path, "internal-error responder body is missing");
  if (/stack|details|node/i.test(errorResponder?.parameters?.responseBody ?? "")) fail(entry.path, "internal-error response may expose implementation details");
  const errorHeaders = Object.fromEntries((errorResponder?.parameters?.options?.responseHeaders?.entries ?? []).map(({ name, value }) => [name.toLowerCase(), value]));
  if (errorHeaders["cache-control"] !== "no-store" || !errorHeaders["x-request-id"]?.startsWith("={{")) fail(entry.path, "internal-error response headers are incomplete");
  const evaluatorOutputs = workflow.connections?.["Evaluate policy signals"]?.main;
  if (evaluatorOutputs?.length !== 2 || evaluatorOutputs?.[0]?.[0]?.node !== responder?.name || evaluatorOutputs?.[1]?.[0]?.node !== errorResponder?.name) {
    fail(entry.path, "policy evaluator success and error outputs are not both wired to responders");
  }

  for (const [source, outputs] of Object.entries(workflow.connections ?? {})) {
    if (!names.has(source)) fail(entry.path, `connection source does not exist: ${source}`);
    for (const [outputType, channels] of Object.entries(outputs)) {
      if (outputType !== "main") fail(entry.path, `unsupported output type: ${outputType}`);
      for (const channel of channels ?? []) {
        for (const connection of channel ?? []) {
          if (!names.has(connection.node)) fail(entry.path, `connection target does not exist: ${connection.node}`);
          if (connection.type !== "main" || connection.index !== 0) fail(entry.path, `invalid connection to ${connection.node}`);
        }
      }
    }
  }

  if (trigger) {
    const reachable = reachableNodeNames(workflow, trigger.name);
    for (const node of workflow.nodes.filter((item) => item.type !== "n8n-nodes-base.stickyNote")) {
      if (!reachable.has(node.name)) fail(entry.path, `unreachable executable node: ${node.name}`);
    }
    if (!reachable.has(responder?.name)) fail(entry.path, "webhook path does not terminate in a response");
  }

  const requiredSections = ["## Five-minute adoption", "## Input contract", "## Policy rules", "## Response contract", "## Security and operations", "## ROI worksheet"];
  for (const section of requiredSections) if (!readme.includes(section)) fail(entry.path, `README is missing ${section}`);
  if (!readme.includes("human approval") || !readme.includes("examples/high-risk.json")) fail(entry.path, "README is missing human-approval or representative-test guidance");

  const examplePayloads = {};
  for (const [key, relativePath] of Object.entries(entry.examples)) {
    try {
      examplePayloads[key] = JSON.parse(await readFile(join(root, relativePath), "utf8"));
    } catch (error) {
      fail(entry.path, `${key} example is missing or invalid: ${error.message}`);
    }
  }

  if (evaluator?.parameters?.jsonOutput && Object.keys(examplePayloads).length === 3) {
    try {
      const low = evaluateExpression(evaluator.parameters.jsonOutput, { body: examplePayloads.lowRisk, headers: { "x-request-id": "test-low" } });
      const high = evaluateExpression(evaluator.parameters.jsonOutput, { body: examplePayloads.highRisk, headers: { "x-request-id": "test-high" } });
      const invalid = evaluateExpression(evaluator.parameters.jsonOutput, { body: examplePayloads.invalid, headers: {} });
      const directLow = evaluatePolicy({ policy: policyFor(definition), envelope: { body: examplePayloads.lowRisk, headers: { "x-request-id": "test-low" } }, executionId: "test-execution", evaluatedAt: "2026-08-07T03:00:00.000Z" });
      if (!sameJson(low, directLow)) fail(entry.path, "generated n8n expression drifted from the source policy engine");
      if (low.ok !== true || low.priorityBand !== "low") fail(entry.path, "low-risk fixture must return a low-band success");
      if (high.ok !== true || high.priorityBand !== "high") fail(entry.path, "high-risk fixture must return a high-band success");
      if (invalid.ok !== false || invalid.httpStatus !== 400 || invalid.details?.violations?.length < 2) fail(entry.path, "invalid fixture must return multiple field-level violations");
    } catch (error) {
      fail(entry.path, `policy expression failed to execute: ${error.message}`);
    }
  }

  if (/(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*["'=:\s]+[A-Za-z0-9_\-]{12,}|bearer\s+[A-Za-z0-9._\-]{12,}|sk-[A-Za-z0-9]{12,}/i.test(raw)) {
    fail(entry.path, "possible secret detected in workflow export");
  }
}

const discovered = [];
for (const department of await readdir(join(root, "workflows"), { withFileTypes: true })) {
  if (!department.isDirectory()) continue;
  for (const workflow of await readdir(join(root, "workflows", department.name), { withFileTypes: true })) {
    if (workflow.isDirectory()) discovered.push(`workflows/${department.name}/${workflow.name}`);
  }
}

const catalogPaths = new Set(catalog.map((entry) => entry.path));
for (const path of discovered) if (!catalogPaths.has(path)) fail(path, "workflow is missing from catalog.json");
for (const path of catalogPaths) if (!discovered.includes(path)) fail(path, "catalog entry points to a missing workflow package");
if (catalog.length < 10) fail("catalog.json", "the catalog must include at least 10 workflows");

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${catalog.length} workflows: contracts, fixtures, policy fingerprints, review snapshots, expression parity, graph reachability, safety, and documentation.`);
