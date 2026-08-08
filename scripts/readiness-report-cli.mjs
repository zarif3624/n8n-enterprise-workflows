import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifactManifest } from "./artifact-integrity.mjs";
import { contractRegistryIssues } from "./contract-registry.mjs";
import { policyLifecycleIssues } from "./policy-lifecycle.mjs";
import { buildReadinessReport, renderReadinessReport } from "./readiness-report.mjs";
import { runtimeCompatibilityIssues } from "./runtime-compatibility.mjs";
import { assertSchemaContract } from "./schema-contract-check.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write("Usage: npm run readiness -- [--workflow <slug>] [--as-of YYYY-MM-DD] [--json]\n");
  process.exit(0);
}
let asOf = new Date().toISOString().slice(0, 10);
let workflowSlug;
let json = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--json") {
    json = true;
    continue;
  }
  if (argument === "--as-of" || argument === "--workflow") {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Option ${argument} requires a value`);
      process.exit(2);
    }
    if (argument === "--as-of") asOf = value;
    else workflowSlug = value;
    index += 1;
    continue;
  }
  console.error(`Unknown option: ${argument}`);
  process.exit(2);
}
const [
  packageManifest, catalog, artifactManifest, policyLock, lifecycle,
  compatibility, registry, readinessSchema, engineSource
] = await Promise.all([
  "package.json", "catalog.json", "artifact-manifest.json", "policy-lock.json",
  "policy-lifecycle.json", "runtime-compatibility.json", "contract-registry.json",
  "schemas/readiness-report.schema.json", "scripts/policy-engine.mjs"
].map((path) => readFile(join(root, path), "utf8").then((content) => path.endsWith(".json") ? JSON.parse(content) : content)));

const expectedArtifactManifest = await buildArtifactManifest({
  root,
  catalog,
  packageVersion: packageManifest.version,
  policySchemaVersion: policyLock.policySchemaVersion,
  policyEngineVersion: policyLock.policyEngineVersion,
  policyEngineFingerprint: policyLock.policyEngineFingerprint
});
let report;
try {
  report = buildReadinessReport({
    asOf,
    packageManifest,
    catalog,
    artifactManifest,
    policyLock,
    lifecycle,
    compatibility,
    registry,
    artifactManifestMatches: JSON.stringify(artifactManifest) === JSON.stringify(expectedArtifactManifest),
    contractIssues: await contractRegistryIssues({ root, registry }),
    lifecycleIssues: policyLifecycleIssues(lifecycle, { catalog, policyLock }),
    compatibilityIssues: runtimeCompatibilityIssues(compatibility, { catalog, policyEngineVersion: policyLock.policyEngineVersion }),
    workflowSlug
  });
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
assertSchemaContract(report, readinessSchema, readinessSchema, "Readiness report");
process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : renderReadinessReport(report));
if (report.repositoryStatus === "invalid") process.exitCode = 1;
