import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPolicyLifecycleReport, policyLifecycleIssues, renderPolicyLifecycleReport } from "./policy-lifecycle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const command = args[0] ?? "report";
const asOfIndex = args.indexOf("--as-of");
const asOf = asOfIndex >= 0 ? args[asOfIndex + 1] : new Date().toISOString().slice(0, 10);
const json = args.includes("--json");
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
} else {
  console.error("Usage: node scripts/policy-lifecycle-cli.mjs [validate|report] [--as-of YYYY-MM-DD] [--json]");
  process.exit(2);
}
