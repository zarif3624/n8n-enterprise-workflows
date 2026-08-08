import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPolicyLifecycleReport, policyLifecycleIssues, renderPolicyLifecycleReport } from "./policy-lifecycle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const usage = "Usage: npm run lifecycle -- [validate|report] [--as-of YYYY-MM-DD] [--json]\n";
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(usage);
  process.exit(0);
}
let command = "report";
let asOf = new Date().toISOString().slice(0, 10);
let json = false;
const remaining = [...args];
if (remaining[0] && !remaining[0].startsWith("-")) command = remaining.shift();
try {
  if (!new Set(["validate", "report"]).has(command)) throw new Error(`Unknown command: ${command}`);
  const seen = new Set();
  while (remaining.length) {
    const argument = remaining.shift();
    if (!new Set(["--as-of", "--json"]).has(argument)) throw new Error(`Unknown option: ${argument}`);
    if (seen.has(argument)) throw new Error(`Option ${argument} may only be provided once`);
    seen.add(argument);
    if (argument === "--json") {
      json = true;
      continue;
    }
    const value = remaining.shift();
    if (!value || value.startsWith("--")) throw new Error("Option --as-of requires a value");
    asOf = value;
  }
  if (command === "validate" && json) throw new Error("Option --json is only supported by the report command");
} catch (error) {
  console.error(error.message);
  console.error(usage.trimEnd());
  process.exit(2);
}
const [document, catalog, policyLock] = await Promise.all([
  readFile(join(root, "policy-lifecycle.json"), "utf8").then(JSON.parse),
  readFile(join(root, "catalog.json"), "utf8").then(JSON.parse),
  readFile(join(root, "policy-lock.json"), "utf8").then(JSON.parse)
]);
const issues = policyLifecycleIssues(document, { catalog, policyLock });
if (issues.length) {
  console.error(`Policy lifecycle contract is invalid:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

let report;
try {
  report = buildPolicyLifecycleReport(document, { asOf });
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
if (command === "validate") {
  if (report.summary.overdue > 0) {
    console.error(`${report.summary.overdue} policy review(s) are overdue as of ${asOf}.`);
    process.exit(2);
  }
  console.log(`Validated ${report.summary.policyCount} policy lifecycles; no reviews are overdue as of ${asOf}. ${report.summary.draft} draft(s) await owner approval.`);
} else if (command === "report") {
  process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : renderPolicyLifecycleReport(report));
}
