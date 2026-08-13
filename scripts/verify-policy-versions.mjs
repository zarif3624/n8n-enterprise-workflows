import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { policyLockIssues } from "./policy-governance.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseRef = process.argv[2];

if (!baseRef) {
  console.error("Usage: node scripts/verify-policy-versions.mjs <git-base-ref>");
  process.exit(2);
}

let previous;
try {
  previous = JSON.parse(execFileSync("git", ["show", `${baseRef}:policy-lock.json`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }));
} catch {
  console.log(`No policy lock exists at ${baseRef}; treating this as the governance baseline.`);
  process.exit(0);
}

const current = await readFile(join(root, "policy-lock.json"), "utf8").then(JSON.parse);
const issues = policyLockIssues(previous, current);

if (issues.length) {
  console.error(`Policy version verification failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Verified policy versions against ${baseRef}: every behavior change has a newer version.`);
