import { readFile } from "node:fs/promises";
import { compareConformanceReports, renderConformanceComparison } from "./conformance-compare.mjs";

function usage() {
  return `Usage:
  npm run conformance:compare -- <baseline.json> <current.json> [options]

Options:
  --json                              Emit machine-readable JSON
  --min-current-records <integer>     Require a minimum current sample size
  --max-invalid-rate-increase <0..1>  Limit invalid-rate increase
  --max-band-rate-delta <0..1>        Limit any absolute band-rate change
  --max-rule-rate-delta <0..1>        Limit any absolute rule-rate change
  --max-average-score-delta <0..100>  Limit absolute average-score change
`;
}

function parseArguments(argv) {
  const positionals = [];
  const options = {};
  const valueOptions = new Set(["min-current-records", "max-invalid-rate-increase", "max-band-rate-delta", "max-rule-rate-delta", "max-average-score-delta"]);
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
  return { positionals, options };
}

function numberOption(options, name, { integer = false, maximum } = {}) {
  if (options[name] === undefined) return undefined;
  const value = Number(options[name]);
  if (!Number.isFinite(value) || value < 0 || (integer && (!Number.isInteger(value) || value < 1)) || (maximum !== undefined && value > maximum)) {
    throw new Error(`Option --${name} has an invalid value`);
  }
  return value;
}

async function readReport(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`Could not read or parse the ${label} report`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage());
    return;
  }
  const { positionals, options } = parseArguments(args);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  if (positionals.length !== 2) throw new Error("Baseline and current report paths are required");
  const [baselinePath, currentPath] = positionals;
  const report = compareConformanceReports({
    baseline: await readReport(baselinePath, "baseline"),
    current: await readReport(currentPath, "current"),
    gates: {
      minCurrentRecords: numberOption(options, "min-current-records", { integer: true }),
      maxInvalidRateIncrease: numberOption(options, "max-invalid-rate-increase", { maximum: 1 }),
      maxBandRateDelta: numberOption(options, "max-band-rate-delta", { maximum: 1 }),
      maxRuleRateDelta: numberOption(options, "max-rule-rate-delta", { maximum: 1 }),
      maxAverageScoreDelta: numberOption(options, "max-average-score-delta", { maximum: 100 })
    }
  });
  process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : renderConformanceComparison(report));
  if (!report.passed) process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exitCode = 1;
}
