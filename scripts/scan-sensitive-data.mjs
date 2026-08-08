import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepository } from "./sensitive-data-scan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const findings = await scanRepository(root);
if (findings.length) {
  console.error(`Sensitive-data scan found ${findings.length} potential issue(s). Values are redacted:`);
  for (const finding of findings) console.error(`- ${finding.path}:${finding.line} (${finding.kind})`);
  console.error("Remove the value, rotate it if real, or add `secret-scan: allow` on the same line only for a reviewed false positive.");
  process.exitCode = 1;
} else {
  console.log("Sensitive-data scan passed across the complete repository text tree.");
}
