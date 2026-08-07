import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { workflows as definitions } from "./workflow-definitions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const errors = [];
const webhookPaths = new Set();
const definitionsBySlug = new Map(definitions.map((definition) => [definition.slug, definition]));

function fail(path, message) {
  errors.push(`${path}: ${message}`);
}

for (const entry of catalog) {
  const workflowPath = join(root, entry.path, "workflow.json");
  const readmePath = join(root, entry.path, "README.md");
  let workflow;
  let raw;

  try {
    raw = await readFile(workflowPath, "utf8");
    workflow = JSON.parse(raw);
    await readFile(readmePath, "utf8");
  } catch (error) {
    fail(entry.path, error.message);
    continue;
  }

  if (!workflow.id || !workflow.name || !Array.isArray(workflow.nodes) || workflow.nodes.length < 3) fail(entry.path, "workflow shape is incomplete");
  if (workflow.active !== false) fail(entry.path, "template must ship inactive");
  if (!workflow.settings?.executionTimeout) fail(entry.path, "execution timeout is required");
  if (!workflow.nodes.some((node) => node.type === "n8n-nodes-base.stickyNote")) fail(entry.path, "activation guidance sticky note is required");

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
  if (triggers[0]?.parameters?.responseMode !== "responseNode") fail(entry.path, "webhook must use responseNode mode");
  const webhookPath = triggers[0]?.parameters?.path;
  if (!webhookPath || webhookPaths.has(webhookPath)) fail(entry.path, "webhook path must be present and globally unique");
  webhookPaths.add(webhookPath);

  const responder = workflow.nodes.find((node) => node.type === "n8n-nodes-base.respondToWebhook");
  if (!responder) fail(entry.path, "Respond to Webhook node is required");
  if (responder?.parameters?.responseBody !== "={{ $json }}") fail(entry.path, "JSON response must pass an object, not a stringified body");
  if (!responder?.parameters?.options?.responseCode) fail(entry.path, "explicit response code is required");

  const codeNode = workflow.nodes.find((node) => node.type === "n8n-nodes-base.code");
  const definition = definitionsBySlug.get(entry.slug);
  if (!codeNode?.parameters?.jsCode || !definition) {
    fail(entry.path, "executable policy definition is missing");
  } else {
    try {
      const evaluate = new Function("$input", "$execution", codeNode.parameters.jsCode);
      const validBody = Object.fromEntries(definition.required.map((field) => [field, `test-${field}`]));
      const validResult = evaluate({ first: () => ({ json: { body: validBody, headers: {} } }) }, { id: "test-execution" });
      const invalidResult = evaluate({ first: () => ({ json: { body: {}, headers: {} } }) }, { id: "test-execution" });
      if (validResult?.[0]?.json?.ok !== true || validResult?.[0]?.json?.httpStatus !== 200) fail(entry.path, "valid policy input did not return a success decision");
      if (invalidResult?.[0]?.json?.ok !== false || invalidResult?.[0]?.json?.httpStatus !== 400) fail(entry.path, "missing input did not return a validation error");
    } catch (error) {
      fail(entry.path, `policy code failed to execute: ${error.message}`);
    }
  }

  for (const [source, outputs] of Object.entries(workflow.connections ?? {})) {
    if (!names.has(source)) fail(entry.path, `connection source does not exist: ${source}`);
    for (const channel of outputs.main ?? []) {
      for (const connection of channel) {
        if (!names.has(connection.node)) fail(entry.path, `connection target does not exist: ${connection.node}`);
      }
    }
  }

  if (/api[_-]?key|bearer\s+[a-z0-9]|password\s*[:=]|exampleSlackCredId/i.test(raw)) fail(entry.path, "possible secret or credential placeholder detected");
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
if (catalog.length < 10) fail("catalog.json", "the initial release must include at least 10 workflows");

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${catalog.length} workflows across ${new Set(catalog.map((entry) => entry.department)).size} departments.`);
