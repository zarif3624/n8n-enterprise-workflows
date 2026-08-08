import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contractRegistryIssues } from "./contract-registry.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const command = args[0] ?? "validate";
const options = args.slice(1);
const usage = "Usage: npm run contracts -- validate\n       npm run contracts -- list [--json]\n";
if (command === "--help" || command === "-h") {
  process.stdout.write(usage);
  process.exit(0);
}
if (!new Set(["validate", "list"]).has(command)) {
  console.error(`Unknown command: ${command}`);
  console.error(usage.trimEnd());
  process.exit(2);
}
if (options.some((option) => option !== "--json") || new Set(options).size !== options.length || (command === "validate" && options.length)) {
  console.error("Invalid or command-incompatible contract registry options");
  console.error(usage.trimEnd());
  process.exit(2);
}
const registry = JSON.parse(await readFile(join(root, "contract-registry.json"), "utf8"));
if (command === "validate") {
  const issues = await contractRegistryIssues({ root, registry });
  if (issues.length) {
    console.error(`Contract registry validation failed:\n- ${issues.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Validated ${registry.documents.length} repository documents and ${registry.outputs.length} CLI output contracts with complete schema coverage.`);
} else if (command === "list") {
  if (options.includes("--json")) process.stdout.write(`${JSON.stringify(registry, null, 2)}\n`);
  else {
    for (const entry of registry.documents) console.log(`${entry.id}\t${entry.path}\t${entry.schema}`);
    for (const entry of registry.outputs) console.log(`${entry.id}\t<generated>\t${entry.schema}`);
  }
}
