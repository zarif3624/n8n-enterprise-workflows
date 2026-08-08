import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contractRegistryIssues } from "./contract-registry.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(await readFile(join(root, "contract-registry.json"), "utf8"));
const command = process.argv[2] ?? "validate";
const usage = "Usage: npm run contracts -- [validate|list] [--json]\n";
if (command === "--help" || command === "-h") {
  process.stdout.write(usage);
} else if (command === "validate") {
  const issues = await contractRegistryIssues({ root, registry });
  if (issues.length) {
    console.error(`Contract registry validation failed:\n- ${issues.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Validated ${registry.documents.length} repository documents and ${registry.outputs.length} CLI output contracts with complete schema coverage.`);
} else if (command === "list") {
  if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(registry, null, 2)}\n`);
  else {
    for (const entry of registry.documents) console.log(`${entry.id}\t${entry.path}\t${entry.schema}`);
    for (const entry of registry.outputs) console.log(`${entry.id}\t<generated>\t${entry.schema}`);
  }
} else {
  console.error(usage.trimEnd());
  process.exit(2);
}
