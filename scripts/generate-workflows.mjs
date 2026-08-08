import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifactManifest } from "./artifact-integrity.mjs";
import { buildPolicyExpression, evaluatePolicy, policyEngineVersion, policySchemaVersion } from "./policy-engine.mjs";
import { buildPolicyLock, buildPolicySnapshot, policyLockIssues } from "./policy-governance.mjs";
import { adaptersFor, inputSchemaFor, policyFor, thresholds, workflows } from "./workflow-definitions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const engineSource = await readFile(join(root, "scripts", "policy-engine.mjs"), "utf8");

function idFor(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function sampleValue(field, contract) {
  if (contract.type === "boolean") return false;
  if (contract.type === "number") return Math.max(contract.minimum ?? 0, 1);
  if (contract.format === "email") return "buyer@example.com";
  if (contract.format === "date-time") return "2026-08-07T03:00:00Z";
  if (field === "currency") return "USD";
  if (field === "region") return "North America";
  return `${field}-001`;
}

function nonMatchingValue(rule, contract) {
  switch (rule.operator) {
    case "missing": return sampleValue(rule.field, contract);
    case "truthy": return false;
    case "falsy": return true;
    case "equals": return typeof rule.value === "string" ? `${rule.value}-other` : null;
    case "includes": return [];
    case "gt": return rule.value;
    case "gte": return Number(rule.value) - 1;
    case "lt": return rule.value;
    default: return sampleValue(rule.field, contract);
  }
}

function matchingValue(rule) {
  switch (rule.operator) {
    case "missing": return undefined;
    case "truthy": return true;
    case "falsy": return false;
    case "equals": return rule.value;
    case "includes": return [rule.value];
    case "gt": return Number(rule.value) + 1;
    case "gte": return Number(rule.value);
    case "lt": return Number(rule.value) - 1;
    default: return undefined;
  }
}

export function examplesFor(definition) {
  const schema = inputSchemaFor(definition);
  const base = Object.fromEntries(
    definition.required.map((field) => [field, sampleValue(field, schema.properties[field])])
  );
  const lowRisk = { ...base };
  for (const rule of definition.rules) {
    const value = nonMatchingValue(rule, schema.properties[rule.field]);
    if (value !== undefined) lowRisk[rule.field] = value;
  }

  const highRisk = { ...base };
  for (const rule of definition.rules) {
    const value = matchingValue(rule);
    if (value === undefined) delete highRisk[rule.field];
    else highRisk[rule.field] = value;
  }

  const invalid = { ...base };
  delete invalid[definition.required[0]];
  const secondRequired = definition.required[1];
  if (secondRequired) invalid[secondRequired] = schema.properties[secondRequired].type === "number" ? "not-a-number" : 42;

  return { lowRisk, highRisk, invalid };
}

function buildWorkflow(definition) {
  const triggerName = "Receive request";
  const evaluateName = "Evaluate policy signals";
  const respondName = "Return structured decision";
  const errorRespondName = "Return internal error";
  const policy = policyFor(definition);

  return {
    id: idFor(`${definition.slug}:workflow`),
    name: definition.name,
    description: `${definition.summary} It exists to make the decision policy explainable and testable before enterprise systems or irreversible actions are connected.`,
    nodes: [
      {
        parameters: {
          content: `### ${definition.name}\n\n${definition.summary}\n\n**Production gate:** this inactive template uses an unauthenticated webhook for local testing only. Configure built-in webhook authentication, review policy version ${policy.policyVersion}, and assign a human owner before activation.`,
          height: 320,
          width: 460,
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
          authentication: "none",
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
          mode: "raw",
          jsonOutput: buildPolicyExpression(policy, triggerName),
          includeOtherFields: false,
          options: {}
        },
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [-60, 80],
        id: idFor(`${definition.slug}:evaluate`),
        name: evaluateName,
        notes: "Evaluates one request with a native expression, enforces the documented input contract, and returns matched reasons without external writes.",
        onError: "continueErrorOutput"
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: `={{ $('${evaluateName}').item.json }}`,
          options: {
            responseCode: `={{ $('${evaluateName}').item.json.httpStatus }}`,
            responseHeaders: {
              entries: [
                { name: "Content-Type", value: "application/json" },
                { name: "Cache-Control", value: "no-store" },
                { name: "X-Request-Id", value: `={{ $('${evaluateName}').item.json.requestId }}` }
              ]
            }
          }
        },
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.5,
        position: [240, 80],
        id: idFor(`${definition.slug}:respond`),
        name: respondName
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: `={{ (() => {
            const supplied = $('${triggerName}').first().json.headers?.['x-request-id'];
            const requestId = String(supplied ?? $execution.id).replace(/[\\r\\n]/g, '').trim().slice(0, 200) || String($execution.id);
            return {
              ok: false,
              httpStatus: 500,
              requestId,
              workflow: ${JSON.stringify(definition.slug)},
              policyVersion: ${JSON.stringify(definition.policyVersion)},
              error: 'internal_error',
              message: 'The policy could not be evaluated',
              retryable: true
            };
          })() }}`,
          options: {
            responseCode: 500,
            responseHeaders: {
              entries: [
                { name: "Content-Type", value: "application/json" },
                { name: "Cache-Control", value: "no-store" },
                {
                  name: "X-Request-Id",
                  value: `={{ (() => {
                    const supplied = $('${triggerName}').first().json.headers?.['x-request-id'];
                    return String(supplied ?? $execution.id).replace(/[\\r\\n]/g, '').trim().slice(0, 200) || String($execution.id);
                  })() }}`
                }
              ]
            }
          }
        },
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.5,
        position: [240, 260],
        id: idFor(`${definition.slug}:respond-error`),
        name: errorRespondName,
        notes: "Returns a sanitized, retryable 500 response without exposing stack traces, node details, or caller data."
      }
    ],
    connections: {
      [triggerName]: { main: [[{ node: evaluateName, type: "main", index: 0 }]] },
      [evaluateName]: {
        main: [
          [{ node: respondName, type: "main", index: 0 }],
          [{ node: errorRespondName, type: "main", index: 0 }]
        ]
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

function contractDetails(contract) {
  const details = [contract.type];
  if (contract.format) details.push(contract.format);
  if (contract.pattern) details.push(`pattern ${contract.pattern}`);
  if (contract.minimum !== undefined) details.push(`min ${contract.minimum}`);
  if (contract.maximum !== undefined) details.push(`max ${contract.maximum}`);
  return details.join(", ");
}

function expectedResult(definition, payload) {
  return evaluatePolicy({
    policy: policyFor(definition),
    envelope: { body: payload, headers: { "x-request-id": "example-request-001" } },
    executionId: "example-execution",
    evaluatedAt: "2026-08-07T03:00:00.000Z"
  });
}

function buildReadme(definition, examples) {
  const schema = inputSchemaFor(definition);
  const ruleRows = definition.rules.map((rule, index) => `| \`${rule.field}_${rule.operator}_${index + 1}\` | \`${rule.field}\` | ${rule.operator}${rule.value === undefined ? "" : ` ${rule.value}`} | ${rule.points} | ${rule.minimumBand ?? "—"} | ${rule.reason} |`).join("\n");
  const contractRows = Object.entries(schema.properties).map(([field, contract]) => `| \`${field}\` | ${schema.required.includes(field) ? "Yes" : "No"} | ${contractDetails(contract)} |`).join("\n");
  const lowResult = expectedResult(definition, examples.lowRisk);
  const highResult = expectedResult(definition, examples.highRisk);

  return `# ${definition.name}

${definition.summary}

## Business problem

${definition.problem}

## Business outcome

${definition.outcome}

- **Primary owner:** ${definition.owner}
- **Primary metric:** ${definition.primaryMetric}
- **Policy version:** \`${definition.policyVersion}\`
- **ROI starting point:** \`${definition.roiExample}\`

## Five-minute adoption

1. Import \`workflow.json\` into an n8n development project.
2. Review the policy rules, hard risk gates, and thresholds with the named business owner.
3. Keep the workflow inactive while testing. The imported webhook is intentionally unauthenticated for local evaluation.
4. Send \`examples/low-risk.json\`, \`examples/high-risk.json\`, and \`examples/invalid.json\` to the test webhook URL.
5. Configure Header Auth, Basic Auth, or another approved built-in webhook credential before activation.
6. Connect approved downstream systems only after the decision contract is verified.

\`\`\`bash
curl --fail-with-body --request POST "$N8N_TEST_WEBHOOK_URL" \\
  --header "Content-Type: application/json" \\
  --header "X-Request-Id: local-test-001" \\
  --data @examples/low-risk.json
\`\`\`

## Input contract

The request body must be a JSON object. Unknown fields are accepted for caller compatibility but ignored by the policy and never echoed in the response.

| Field | Required | Contract |
| --- | --- | --- |
${contractRows}

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
${ruleRows}

Scores below ${thresholds.medium} use \`${definition.decisions.low}\`, scores from ${thresholds.medium}-${thresholds.high - 1} use \`${definition.decisions.medium}\`, and scores of ${thresholds.high}+ use \`${definition.decisions.high}\`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

\`\`\`json
${JSON.stringify(lowResult, null, 2)}
\`\`\`

The high-risk example returns \`${highResult.decision}\` in the \`${highResult.priorityBand}\` band with score ${highResult.score}. Invalid requests return HTTP 400 with \`error: "validation_error"\`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with \`error: "internal_error"\`; stack traces and caller data are never returned.

## Recommended production extensions

${definition.actions.map((action) => `- ${action}.`).join("\n")}

Typical adapters: ${adaptersFor(definition).join(", ")}.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat \`requestId\` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with \`${definition.roiExample}\`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n ${definition.department.replaceAll("-", " ")} automation, enterprise n8n workflow, ${definition.slug.replaceAll("-", " ")}, workflow automation template.
`;
}

function buildCatalogDoc() {
  const rows = workflows.map((definition) => `| ${definition.department.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())} | [${definition.name}](../workflows/${definition.department}/${definition.slug}) | ${definition.primaryMetric} | ${adaptersFor(definition).join(", ")} |`).join("\n");
  return `# Enterprise workflow catalog

The catalog is organized by the team that owns the business outcome, not by the vendor node used to implement it. Every package ships as an inactive, credential-free decision service with a versioned policy, typed input contract, explainable score, representative fixtures, and an ROI starting point.

| Department | Workflow | Primary metric | Typical production adapters |
| --- | --- | --- | --- |
${rows}

## Planned departments and packs

- Product operations
- Quality and audit
- Enterprise risk and compliance
- Industry-specific controls and approval patterns
`;
}

function operationIdFor(slug) {
  return `evaluate${slug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`;
}

function openApiResponseHeaders() {
  return {
    "X-Request-Id": { description: "Correlation ID returned in the body", schema: { type: "string" } },
    "Cache-Control": { description: "Decision responses are not cacheable", schema: { type: "string", const: "no-store" } }
  };
}

function buildOpenApi() {
  const paths = {};
  for (const definition of workflows) {
    const examples = examplesFor(definition);
    const lowResponse = expectedResult(definition, examples.lowRisk);
    const highResponse = expectedResult(definition, examples.highRisk);
    const invalidResponse = expectedResult(definition, examples.invalid);
    paths[`/webhook/enterprise/${definition.department}/${definition.slug}`] = {
      post: {
        operationId: operationIdFor(definition.slug),
        tags: [definition.department],
        summary: definition.name,
        description: `${definition.summary} Configure the imported n8n webhook's authentication before using this production contract.`,
        security: [{ webhookHeader: [] }],
        parameters: [{
          name: "X-Request-Id",
          in: "header",
          required: false,
          description: "Caller-provided correlation ID. The workflow generates one when omitted.",
          schema: { type: "string", maxLength: 500 }
        }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: inputSchemaFor(definition),
              examples: {
                lowRisk: { summary: "Expected low-band decision", value: examples.lowRisk },
                highRisk: { summary: "Expected high-band decision", value: examples.highRisk }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Policy decision",
            headers: openApiResponseHeaders(),
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/DecisionResponse" },
                    {
                      type: "object",
                      properties: {
                        workflow: { const: definition.slug },
                        policyVersion: { const: definition.policyVersion },
                        decision: { enum: Object.values(definition.decisions) }
                      }
                    }
                  ]
                },
                examples: {
                  lowRisk: { summary: "Low-band decision", value: lowResponse },
                  highRisk: { summary: "High-band decision", value: highResponse }
                }
              }
            }
          },
          400: {
            description: "Input contract violation",
            headers: openApiResponseHeaders(),
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationResponse" },
                example: invalidResponse
              }
            }
          },
          500: {
            description: "Sanitized internal policy-evaluation failure",
            headers: openApiResponseHeaders(),
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InternalErrorResponse" },
                example: {
                  ok: false,
                  httpStatus: 500,
                  requestId: "example-request-001",
                  workflow: definition.slug,
                  policyVersion: definition.policyVersion,
                  error: "internal_error",
                  message: "The policy could not be evaluated",
                  retryable: true
                }
              }
            }
          }
        }
      }
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "n8n Enterprise Workflow Decision APIs",
      version: packageManifest.version,
      description: "Production contracts for the inactive n8n workflow templates in this repository. Authentication must be configured during adoption.",
      license: { name: "MIT", identifier: "MIT" }
    },
    servers: [{ url: "https://{n8nHost}", variables: { n8nHost: { default: "your-n8n.example.com" } } }],
    paths,
    components: {
      securitySchemes: {
        webhookHeader: {
          type: "apiKey",
          in: "header",
          name: "X-Webhook-Token",
          description: "Example production Header Auth contract. Match this name to the credential configured on the n8n Webhook node."
        }
      },
      schemas: {
        MatchedRule: {
          type: "object",
          required: ["ruleId", "field", "points", "reason"],
          properties: {
            ruleId: { type: "string" }, field: { type: "string" }, points: { type: "number" },
            reason: { type: "string" }, minimumBand: { type: "string", enum: ["medium", "high"] }
          },
          additionalProperties: false
        },
        DecisionResponse: {
          type: "object",
          required: ["ok", "httpStatus", "requestId", "workflow", "policyVersion", "decision", "priorityBand", "score", "matchedRules", "recommendedActions", "evaluatedAt"],
          properties: {
            ok: { type: "boolean", const: true }, httpStatus: { type: "integer", const: 200 },
            requestId: { type: "string" }, workflow: { type: "string" }, policyVersion: { type: "string" },
            decision: { type: "string" }, priorityBand: { type: "string", enum: ["low", "medium", "high"] },
            score: { type: "number", minimum: 0, maximum: 100 },
            matchedRules: { type: "array", items: { $ref: "#/components/schemas/MatchedRule" } },
            recommendedActions: { type: "array", items: { type: "string" } },
            evaluatedAt: { type: "string", format: "date-time" }
          },
          additionalProperties: false
        },
        ValidationViolation: {
          type: "object",
          required: ["field", "code", "message", "expected"],
          properties: { field: { type: "string" }, code: { type: "string" }, message: { type: "string" }, expected: {} },
          additionalProperties: false
        },
        ValidationResponse: {
          type: "object",
          required: ["ok", "httpStatus", "requestId", "error", "message", "details", "requestSchema"],
          properties: {
            ok: { type: "boolean", const: false }, httpStatus: { type: "integer", const: 400 },
            requestId: { type: "string" }, error: { type: "string", const: "validation_error" }, message: { type: "string" },
            details: {
              type: "object",
              required: ["violations", "missingFields"],
              properties: {
                violations: { type: "array", items: { $ref: "#/components/schemas/ValidationViolation" } },
                missingFields: { type: "array", items: { type: "string" } }
              }
            },
            requestSchema: { type: "object" }
          },
          additionalProperties: false
        },
        InternalErrorResponse: {
          type: "object",
          required: ["ok", "httpStatus", "requestId", "workflow", "policyVersion", "error", "message", "retryable"],
          properties: {
            ok: { type: "boolean", const: false },
            httpStatus: { type: "integer", const: 500 },
            requestId: { type: "string" },
            workflow: { type: "string" },
            policyVersion: { type: "string" },
            error: { type: "string", const: "internal_error" },
            message: { type: "string", const: "The policy could not be evaluated" },
            retryable: { type: "boolean", const: true }
          },
          additionalProperties: false
        }
      }
    }
  };
}

const policyLock = buildPolicyLock({
  definitions: workflows,
  policyFor,
  schemaVersion: policySchemaVersion,
  engineVersion: policyEngineVersion,
  engineSource
});
const policySnapshot = buildPolicySnapshot({
  definitions: workflows,
  policyFor,
  schemaVersion: policySchemaVersion,
  engineVersion: policyEngineVersion,
  engineSource
});

try {
  const previousPolicyLock = JSON.parse(await readFile(join(root, "policy-lock.json"), "utf8"));
  const issues = policyLockIssues(previousPolicyLock, policyLock);
  if (issues.length) {
    throw new Error(`Policy version guard rejected generation:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const catalog = [];
for (const definition of workflows) {
  const directory = join(root, "workflows", definition.department, definition.slug);
  const examplesDirectory = join(directory, "examples");
  const examples = examplesFor(definition);
  await mkdir(examplesDirectory, { recursive: true });
  await writeFile(join(directory, "workflow.json"), `${JSON.stringify(buildWorkflow(definition), null, 2)}\n`);
  await writeFile(join(directory, "README.md"), buildReadme(definition, examples));
  await writeFile(join(examplesDirectory, "low-risk.json"), `${JSON.stringify(examples.lowRisk, null, 2)}\n`);
  await writeFile(join(examplesDirectory, "high-risk.json"), `${JSON.stringify(examples.highRisk, null, 2)}\n`);
  await writeFile(join(examplesDirectory, "invalid.json"), `${JSON.stringify(examples.invalid, null, 2)}\n`);
  catalog.push({
    schemaVersion: policySchemaVersion,
    policyVersion: definition.policyVersion,
    department: definition.department,
    slug: definition.slug,
    name: definition.name,
    summary: definition.summary,
    outcome: definition.outcome,
    owner: definition.owner,
    metric: definition.primaryMetric,
    inputSchema: inputSchemaFor(definition),
    decisions: definition.decisions,
    adapters: adaptersFor(definition),
    path: `workflows/${definition.department}/${definition.slug}`,
    endpoint: `/webhook/enterprise/${definition.department}/${definition.slug}`,
    workflow: `workflows/${definition.department}/${definition.slug}/workflow.json`,
    examples: {
      lowRisk: `workflows/${definition.department}/${definition.slug}/examples/low-risk.json`,
      highRisk: `workflows/${definition.department}/${definition.slug}/examples/high-risk.json`,
      invalid: `workflows/${definition.department}/${definition.slug}/examples/invalid.json`
    }
  });
}

await writeFile(join(root, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(join(root, "openapi.json"), `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
await writeFile(join(root, "policy-lock.json"), `${JSON.stringify(policyLock, null, 2)}\n`);
await writeFile(join(root, "policy-snapshot.json"), `${JSON.stringify(policySnapshot, null, 2)}\n`);
await writeFile(join(root, "docs", "catalog.md"), buildCatalogDoc());
const artifactManifest = await buildArtifactManifest({
  root,
  catalog,
  packageVersion: packageManifest.version,
  policySchemaVersion,
  policyEngineVersion,
  policyEngineFingerprint: policyLock.policyEngineFingerprint
});
await writeFile(join(root, "artifact-manifest.json"), `${JSON.stringify(artifactManifest, null, 2)}\n`);
console.log(`Generated ${catalog.length} enterprise workflow packages and ${artifactManifest.artifactCount} integrity-checked artifacts.`);
