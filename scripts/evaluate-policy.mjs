import { randomUUID } from "node:crypto";
import { evaluatePolicy } from "./policy-engine.mjs";
import { readCliInput } from "./read-cli-input.mjs";
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
  const raw = await readCliInput(inputPath);
  payload = JSON.parse(raw);
} catch {
  console.error("Could not read or parse JSON input; payload and file-system details were omitted");
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
