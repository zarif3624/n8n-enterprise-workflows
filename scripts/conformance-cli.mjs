import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeConformance, defaultMaxRecords, parseConformanceInput, renderConformanceReport } from "./conformance.mjs";
import { readCliInput } from "./read-cli-input.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `Usage:
  npm run conformance -- <workflow-slug> <records.json|records.jsonl|-> [options]

Options:
  --json                       Emit machine-readable JSON instead of Markdown
  --mapping <mapping.json>     Safely map source-shaped records before evaluation
  --max-records <integer>      Reject larger inputs (default: ${defaultMaxRecords})
  --min-records <integer>      Fail the conformance gate below this sample size
  --max-invalid-rate <0..1>    Fail above this contract-invalid fraction
  --min-rule-coverage <0..1>   Fail below this exercised-rule fraction
  --require-bands <csv>        Require any of low,medium,high in valid outcomes
`;
}

function parseArguments(argv) {
  const options = {};
  const positionals = [];
  const valueOptions = new Set(["mapping", "max-records", "min-records", "max-invalid-rate", "min-rule-coverage", "require-bands"]);
  while (argv.length) {
    const argument = argv.shift();
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const name = argument.slice(2);
    if (name === "json" || name === "help") {
      options[name] = true;
      continue;
    }
    if (!valueOptions.has(name)) throw new Error(`Unknown option: --${name}`);
    const value = argv.shift();
    if (value === undefined || value.startsWith("--")) throw new Error(`Option --${name} requires a value`);
    options[name] = value;
  }
  return { options, positionals };
}

function fractionOption(options, name) {
  if (options[name] === undefined) return undefined;
  const value = Number(options[name]);
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Option --${name} must be between 0 and 1`);
  return value;
}

function integerOption(options, name, fallback) {
  if (options[name] === undefined) return fallback;
  const value = Number(options[name]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`Option --${name} must be a positive integer`);
  return value;
}

async function main() {
  const { options, positionals } = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  if (positionals.length !== 2) throw new Error("A workflow slug and input path are required");
  const [slug, inputPath] = positionals;
  const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
  const snapshotPolicy = snapshot.policies.find((policy) => policy.slug === slug);
  if (!snapshotPolicy) throw new Error(`Unknown workflow slug: ${slug}`);

  let raw;
  try {
    raw = await readCliInput(inputPath);
  } catch {
    throw new Error("Could not read the conformance input; file-system details were omitted");
  }
  const records = parseConformanceInput(raw, { maxRecords: integerOption(options, "max-records", defaultMaxRecords) });
  let mapping;
  if (options.mapping) {
    try {
      mapping = JSON.parse(await readFile(options.mapping, "utf8"));
    } catch {
      throw new Error("Could not read or parse the mapping file");
    }
  }
  const requireBands = options["require-bands"] === undefined
    ? []
    : options["require-bands"].split(",").map((band) => band.trim()).filter(Boolean);
  if (options["require-bands"] !== undefined && !requireBands.length) {
    throw new Error("Option --require-bands requires at least one band");
  }
  const report = analyzeConformance({
    snapshotPolicy,
    records,
    mapping,
    gates: {
      minRecords: integerOption(options, "min-records"),
      maxInvalidRate: fractionOption(options, "max-invalid-rate"),
      minRuleCoverage: fractionOption(options, "min-rule-coverage"),
      requireBands
    }
  });
  process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : renderConformanceReport(report));
  if (!report.passed) process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exitCode = 1;
}
