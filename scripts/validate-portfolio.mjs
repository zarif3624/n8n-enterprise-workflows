import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { portfolioPolicyIssues } from "./portfolio-policy.mjs";
import { schemaContractIssues } from "./schema-contract-check.mjs";
import { workflows } from "./workflow-definitions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function printHelp(stream = process.stdout) {
  stream.write("Usage: npm run portfolio:validate\n");
}

async function readJson(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function discoverWorkflowPaths() {
  const paths = [];
  for (const department of await readdir(join(root, "workflows"), { withFileTypes: true })) {
    if (!department.isDirectory()) continue;
    for (const workflow of await readdir(join(root, "workflows", department.name), { withFileTypes: true })) {
      if (workflow.isDirectory()) paths.push(`workflows/${department.name}/${workflow.name}`);
    }
  }
  return paths;
}

const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
  printHelp();
} else if (args.length) {
  process.stderr.write(`Unknown argument: ${args[0]}\n`);
  printHelp(process.stderr);
  process.exitCode = 1;
} else {
  try {
    const [portfolio, catalog, schema, discoveredPaths] = await Promise.all([
      readJson("portfolio.json"),
      readJson("catalog.json"),
      readJson("schemas/portfolio.schema.json"),
      discoverWorkflowPaths()
    ]);
    const issues = [
      ...schemaContractIssues(portfolio, schema, schema).map((issue) => `portfolio.json ${issue}`),
      ...portfolioPolicyIssues({ portfolio, catalog, definitions: workflows, discoveredPaths })
    ];
    if (issues.length) {
      process.stderr.write(`Portfolio validation failed with ${issues.length} issue(s):\n${issues.map((issue) => `- ${issue}`).join("\n")}\n`);
      process.exitCode = 2;
    } else {
      const { allocation } = portfolio;
      process.stdout.write(`Validated open-core portfolio: ${allocation.openSource} of ${allocation.evaluatedWorkflowFamilies} workflow families are open source; ${allocation.commercialReserve} are reserved for the product.\n`);
    }
  } catch {
    process.stderr.write("Portfolio validation could not read a required repository contract.\n");
    process.exitCode = 1;
  }
}
