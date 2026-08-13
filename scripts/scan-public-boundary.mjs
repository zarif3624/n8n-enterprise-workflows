import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanTrackedPublicTree } from "./public-boundary-scan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const findings = await scanTrackedPublicTree(root);
if (findings.length) {
  console.error(`Public-boundary scan found ${findings.length} internal planning leak(s):`);
  for (const finding of findings) console.error(`- ${finding.path}:${finding.line} (${finding.kind})`);
  process.exitCode = 1;
} else {
  console.log("Public-boundary scan passed across every tracked repository file.");
}
