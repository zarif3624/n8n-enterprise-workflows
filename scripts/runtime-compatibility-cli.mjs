import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { policyEngineVersion } from "./policy-engine.mjs";
import { runtimeCompatibilityIssues, runtimeCompatibilityMatrix } from "./runtime-compatibility.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const usage = "Usage: npm run compatibility -- [validate|matrix]\n";
const command = process.argv[2] ?? "validate";
if (command === "--help" || command === "-h") {
  process.stdout.write(usage);
  process.exit(0);
}
const [document, catalog] = await Promise.all([
  readFile(join(root, "runtime-compatibility.json"), "utf8").then(JSON.parse),
  readFile(join(root, "catalog.json"), "utf8").then(JSON.parse)
]);
const issues = runtimeCompatibilityIssues(document, { catalog, policyEngineVersion });
if (issues.length) {
  console.error(`Runtime compatibility plan is invalid:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

if (command === "validate") {
  console.log(`Validated ${document.scheduledN8nVersions.length} pinned n8n runtime targets for policy engine ${document.policyEngineVersion}.`);
} else if (command === "matrix") {
  process.stdout.write(`${JSON.stringify(runtimeCompatibilityMatrix(document))}\n`);
} else {
  console.error(usage.trimEnd());
  process.exit(2);
}
