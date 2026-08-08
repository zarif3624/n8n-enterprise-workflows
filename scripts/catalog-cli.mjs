import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAdoptionPlan,
  renderAdoptionPlan,
  renderCatalogTable,
  renderWorkflowDetail,
  searchCatalog,
  workflowDetail
} from "./catalog-planner.mjs";
import { evaluatePolicy } from "./policy-engine.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `Usage:
  npm run catalog -- list [--department <name>] [--adapter <name>] [--json]
  npm run catalog -- search <terms...> [--department <name>] [--adapter <name>] [--json]
  npm run catalog -- show <workflow-slug> [--json]
  npm run catalog -- plan <workflow-slug> [--adapter <name>] [--monthly-volume <n> --minutes-saved <n> --hourly-cost <n>] [--json]
`;
}

function parseArguments(argv) {
  const command = argv.shift();
  const options = {};
  const positionals = [];
  const valueFlags = new Set(["department", "adapter", "monthly-volume", "minutes-saved", "hourly-cost"]);
  while (argv.length) {
    const argument = argv.shift();
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const flag = argument.slice(2);
    if (flag === "json" || flag === "help") {
      options[flag] = true;
      continue;
    }
    if (!valueFlags.has(flag)) throw new Error(`Unknown option: --${flag}`);
    const value = argv.shift();
    if (!value || value.startsWith("--")) throw new Error(`Option --${flag} requires a value`);
    options[flag] = value;
  }
  return { command, options, positionals };
}

function numberOption(options, name) {
  if (options[name] === undefined) return undefined;
  const value = Number(options[name]);
  if (!Number.isFinite(value)) throw new Error(`Option --${name} must be a finite number`);
  return value;
}

function rejectUnsupportedOptions(options, allowed) {
  const unsupported = Object.keys(options).filter((name) => !allowed.has(name));
  if (unsupported.length) throw new Error(`Option --${unsupported[0]} is not supported by this command`);
}

async function fixtureOutcomes(entry, snapshotPolicy) {
  const executablePolicy = { ...snapshotPolicy.behavior, policyVersion: snapshotPolicy.policyVersion };
  const outcomes = [];
  for (const [name, path] of Object.entries(entry.examples)) {
    const payload = JSON.parse(await readFile(join(root, path), "utf8"));
    const result = evaluatePolicy({
      policy: executablePolicy,
      envelope: { body: payload, headers: { "x-request-id": `catalog-${name}` } },
      executionId: `catalog-${name}`,
      evaluatedAt: "2026-01-01T00:00:00.000Z"
    });
    outcomes.push({
      name,
      httpStatus: result.httpStatus,
      ...(result.ok
        ? { priorityBand: result.priorityBand, score: result.score, decision: result.decision }
        : { error: result.error })
    });
  }
  return outcomes;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage());
    return;
  }
  const parsed = parseArguments(args);
  if (parsed.options.help || !parsed.command) {
    process.stdout.write(usage());
    return;
  }
  const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
  const snapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
  const filters = { department: parsed.options.department, adapter: parsed.options.adapter };

  if (parsed.command === "list" || parsed.command === "search") {
    rejectUnsupportedOptions(parsed.options, new Set(["department", "adapter", "json", "help"]));
    if (parsed.command === "list" && parsed.positionals.length) throw new Error("list does not accept search terms");
    if (parsed.command === "search" && !parsed.positionals.length) throw new Error("search requires one or more terms");
    const entries = searchCatalog(catalog, parsed.command === "search" ? parsed.positionals.join(" ") : "", filters);
    if (parsed.options.json) process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    else process.stdout.write(renderCatalogTable(entries));
    if (!entries.length) process.exitCode = 1;
    return;
  }

  if (parsed.command === "show" || parsed.command === "plan") {
    rejectUnsupportedOptions(
      parsed.options,
      new Set(parsed.command === "show"
        ? ["json", "help"]
        : ["adapter", "monthly-volume", "minutes-saved", "hourly-cost", "json", "help"])
    );
    if (parsed.positionals.length !== 1) throw new Error(`${parsed.command} requires exactly one workflow slug`);
    const entry = catalog.find((candidate) => candidate.slug === parsed.positionals[0]);
    if (!entry) throw new Error(`Unknown workflow slug: ${parsed.positionals[0]}`);
    const detail = workflowDetail(entry, snapshot);
    if (parsed.command === "show") {
      if (parsed.options.json) process.stdout.write(`${JSON.stringify(detail, null, 2)}\n`);
      else process.stdout.write(renderWorkflowDetail(detail));
      return;
    }
    const capacityValues = {
      monthlyVolume: numberOption(parsed.options, "monthly-volume"),
      minutesSaved: numberOption(parsed.options, "minutes-saved"),
      hourlyCost: numberOption(parsed.options, "hourly-cost")
    };
    const hasCapacityInput = Object.values(capacityValues).some((value) => value !== undefined);
    const snapshotPolicy = snapshot.policies.find((candidate) => candidate.slug === entry.slug);
    const plan = buildAdoptionPlan(detail, {
      adapter: parsed.options.adapter,
      capacity: hasCapacityInput ? capacityValues : undefined,
      fixtureOutcomes: await fixtureOutcomes(entry, snapshotPolicy)
    });
    if (parsed.options.json) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    else process.stdout.write(renderAdoptionPlan(plan));
    return;
  }

  throw new Error(`Unknown command: ${parsed.command}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exitCode = 2;
}
