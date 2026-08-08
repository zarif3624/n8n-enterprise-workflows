import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createIdentityMapping, validateFieldMapping } from "./field-mapping.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `Usage:
  npm run mapping -- init <workflow-slug>
  npm run mapping -- check <mapping.json>
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage());
    return;
  }
  const [command, argument, ...extra] = args;
  if (!command || !argument || extra.length) throw new Error("A command and one argument are required");
  const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
  if (command === "init") {
    const policy = snapshot.policies.find((candidate) => candidate.slug === argument);
    if (!policy) throw new Error(`Unknown workflow slug: ${argument}`);
    process.stdout.write(`${JSON.stringify(createIdentityMapping(policy), null, 2)}\n`);
    return;
  }
  if (command === "check") {
    let mapping;
    try {
      mapping = JSON.parse(await readFile(argument, "utf8"));
    } catch {
      throw new Error("Could not read or parse the mapping file");
    }
    const policy = snapshot.policies.find((candidate) => candidate.slug === mapping.workflow);
    if (!policy) throw new Error("Mapping names an unknown workflow");
    const compiled = validateFieldMapping(mapping, policy);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      workflow: compiled.workflow,
      policyFingerprint: compiled.policyFingerprint,
      mappingFingerprint: compiled.fingerprint,
      mappedFieldCount: compiled.fields.length,
      policyRelevantFieldCount: compiled.policyRelevantFieldCount
    }, null, 2)}\n`);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exitCode = 1;
}
