import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/create-runtime-error-probe.mjs <workflow.json> <output.json>");
  process.exit(2);
}

const input = resolve(inputPath);
const output = resolve(outputPath);
if (input === output) throw new Error("Runtime probe output must not overwrite the source workflow");

const workflow = JSON.parse(await readFile(input, "utf8"));
const evaluator = workflow.nodes.find((node) => node.name === "Evaluate policy signals");
if (!evaluator) throw new Error("Policy evaluator not found");
if (evaluator.onError !== "continueErrorOutput") throw new Error("Policy evaluator has no dedicated error output");

workflow.name = `${workflow.name} [runtime error probe]`;
evaluator.parameters.jsonOutput = "={{ (() => { throw new Error('intentional runtime error probe') })() }}";

await writeFile(output, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Created isolated error-path probe at ${output}`);
