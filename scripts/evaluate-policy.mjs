import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { evaluatePolicy } from "./policy-engine.mjs";
import { policyFor, workflows } from "./workflow-definitions.mjs";

const [slug, inputPath] = process.argv.slice(2);

if (!slug || !inputPath) {
  console.error("Usage: npm run evaluate -- <workflow-slug> <payload.json|->");
  console.error(`Available workflows: ${workflows.map((workflow) => workflow.slug).join(", ")}`);
  process.exit(1);
}

const definition = workflows.find((workflow) => workflow.slug === slug);
if (!definition) {
  console.error(`Unknown workflow slug: ${slug}`);
  process.exit(1);
}

let payload;
try {
  const raw = await readFile(inputPath === "-" ? 0 : inputPath, "utf8");
  payload = JSON.parse(raw);
} catch (error) {
  console.error(`Could not read a JSON payload: ${error.message}`);
  process.exit(1);
}

const result = evaluatePolicy({
  policy: policyFor(definition),
  envelope: { body: payload, headers: { "x-request-id": `local-${randomUUID()}` } },
  executionId: `local-${randomUUID()}`,
  evaluatedAt: new Date().toISOString()
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 2;
