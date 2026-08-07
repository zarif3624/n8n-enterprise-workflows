import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { thresholds, workflows } from "./workflow-definitions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function idFor(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function buildCode(definition) {
  return `const envelope = $input.first().json;
const input = envelope.body ?? envelope;
const requestId = envelope.headers?.['x-request-id'] ?? String($execution.id);
const requiredFields = ${JSON.stringify(definition.required)};
const missingFields = requiredFields.filter((field) => input[field] === undefined || input[field] === null || input[field] === '');

if (missingFields.length > 0) {
  return [{
    json: {
      ok: false,
      httpStatus: 400,
      requestId,
      error: 'validation_error',
      message: 'Required fields are missing',
      details: { missingFields },
      requiredFields
    }
  }];
}

const rules = ${JSON.stringify(definition.rules, null, 2)};

function matches(rule, value) {
  switch (rule.operator) {
    case 'missing': return value === undefined || value === null || value === '';
    case 'truthy': return value === true;
    case 'falsy': return value !== true;
    case 'equals': return value === rule.value;
    case 'includes': return Array.isArray(value) && value.includes(rule.value);
    case 'gt': return Number(value) > Number(rule.value);
    case 'gte': return Number(value) >= Number(rule.value);
    case 'lt': return Number(value) < Number(rule.value);
    default: return false;
  }
}

const matchedRules = rules
  .filter((rule) => matches(rule, input[rule.field]))
  .map(({ field, points, reason }) => ({ field, points, reason }));
const score = Math.max(0, Math.min(100, matchedRules.reduce((total, rule) => total + rule.points, 0)));
const priorityBand = score >= ${thresholds.high} ? 'high' : score >= ${thresholds.medium} ? 'medium' : 'low';
const decisions = ${JSON.stringify(definition.decisions)};

return [{
  json: {
    ok: true,
    httpStatus: 200,
    requestId,
    workflow: '${definition.slug}',
    decision: decisions[priorityBand],
    priorityBand,
    score,
    matchedRules,
    recommendedActions: ${JSON.stringify(definition.actions)},
    evaluatedAt: new Date().toISOString()
  }
}];`;
}

function buildWorkflow(definition) {
  const triggerName = "Receive request";
  const evaluateName = "Evaluate policy signals";
  const respondName = "Return structured decision";

  return {
    id: idFor(`${definition.slug}:workflow`),
    name: definition.name,
    nodes: [
      {
        parameters: {
          content: `### ${definition.name}\n\n${definition.summary}\n\n**Production gate:** configure built-in webhook authentication, review the policy thresholds, and assign a human owner before activation.`,
          height: 300,
          width: 420,
          color: 4
        },
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-520, -260],
        id: idFor(`${definition.slug}:note`),
        name: "Read before activation"
      },
      {
        parameters: {
          httpMethod: "POST",
          path: `enterprise/${definition.department}/${definition.slug}`,
          responseMode: "responseNode",
          options: {}
        },
        type: "n8n-nodes-base.webhook",
        typeVersion: 2.1,
        position: [-360, 80],
        id: idFor(`${definition.slug}:webhook`),
        name: triggerName,
        webhookId: idFor(`${definition.slug}:webhook-id`)
      },
      {
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: buildCode(definition)
        },
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [-80, 80],
        id: idFor(`${definition.slug}:evaluate`),
        name: evaluateName,
        notes: "Pure policy evaluation. It performs no external writes and returns matched reasons for human review."
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: "={{ $json }}",
          options: {
            responseCode: "={{ $json.httpStatus }}",
            responseHeaders: {
              entries: [{ name: "Content-Type", value: "application/json" }]
            }
          }
        },
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.4,
        position: [220, 80],
        id: idFor(`${definition.slug}:respond`),
        name: respondName
      }
    ],
    connections: {
      [triggerName]: {
        main: [[{ node: evaluateName, type: "main", index: 0 }]]
      },
      [evaluateName]: {
        main: [[{ node: respondName, type: "main", index: 0 }]]
      }
    },
    active: false,
    settings: {
      executionOrder: "v1",
      executionTimeout: 120,
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "none",
      saveManualExecutions: true,
      timezone: "UTC"
    },
    tags: []
  };
}

function sampleValue(field) {
  const lower = field.toLowerCase();
  if (lower.includes("amount") || lower.includes("spend") || lower === "arr" || lower.includes("value")) return 125000;
  if (lower.includes("count") || lower.includes("users") || lower.includes("days")) return 120;
  if (lower.includes("email")) return "buyer@example.com";
  if (lower.includes("at")) return "2026-08-07T03:00:00Z";
  if (lower.includes("id")) return `${field.toLowerCase()}-001`;
  if (lower === "currency") return "USD";
  if (lower === "region") return "North America";
  return `Example ${field}`;
}

function buildReadme(definition) {
  const sample = Object.fromEntries(definition.required.map((field) => [field, sampleValue(field)]));
  const ruleRows = definition.rules.map((rule) => `| \`${rule.field}\` | ${rule.operator}${rule.value === undefined ? "" : ` ${rule.value}`} | ${rule.points} | ${rule.reason} |`).join("\n");
  return `# ${definition.name}

${definition.summary}

## Business problem

${definition.problem}

## Business outcome

${definition.outcome}

- **Primary owner:** ${definition.owner}
- **Primary metric:** ${definition.primaryMetric}
- **ROI starting point:** \`${definition.roiExample}\`

## Import and configure

1. Import \`workflow.json\` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

${definition.required.map((field) => `- \`${field}\``).join("\n")}

Optional signals: ${definition.optional.map((field) => `\`${field}\``).join(", ")}.

### Sample payload

\`\`\`json
${JSON.stringify(sample, null, 2)}
\`\`\`

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
${ruleRows}

Scores below ${thresholds.medium} use \`${definition.decisions.low}\`, scores from ${thresholds.medium}-${thresholds.high - 1} use \`${definition.decisions.medium}\`, and scores of ${thresholds.high}+ use \`${definition.decisions.high}\`.

## Recommended production extensions

${definition.actions.map((action) => `- ${action}.`).join("\n")}

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n ${definition.department.replaceAll("-", " ")} automation, enterprise n8n workflow, ${definition.slug.replaceAll("-", " ")}, workflow automation template.
`;
}

const catalog = [];
for (const definition of workflows) {
  const directory = join(root, "workflows", definition.department, definition.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "workflow.json"), `${JSON.stringify(buildWorkflow(definition), null, 2)}\n`);
  await writeFile(join(directory, "README.md"), buildReadme(definition));
  catalog.push({
    department: definition.department,
    slug: definition.slug,
    name: definition.name,
    summary: definition.summary,
    owner: definition.owner,
    metric: definition.primaryMetric,
    path: `workflows/${definition.department}/${definition.slug}`
  });
}

await writeFile(join(root, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Generated ${catalog.length} enterprise workflow packages.`);
