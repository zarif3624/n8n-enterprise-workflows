import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const artifactManifestVersion = 1;

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function generatedArtifactDescriptors(catalog) {
  const descriptors = [
    { path: "schemas/artifact-manifest.schema.json", kind: "json-schema" },
    { path: "schemas/bundle-manifest.schema.json", kind: "json-schema" },
    { path: "catalog.json", kind: "catalog" },
    { path: "contract-registry.json", kind: "contract-registry" },
    { path: "docs/catalog.md", kind: "catalog-documentation" },
    { path: "openapi.json", kind: "api-contract" },
    { path: "policy-lifecycle.json", kind: "policy-lifecycle" },
    { path: "policy-lock.json", kind: "policy-lock" },
    { path: "policy-snapshot.json", kind: "policy-snapshot" },
    { path: "runtime-compatibility.json", kind: "runtime-compatibility" },
    { path: "schemas/catalog.schema.json", kind: "json-schema" },
    { path: "schemas/conformance-comparison.schema.json", kind: "json-schema" },
    { path: "schemas/conformance-report.schema.json", kind: "json-schema" },
    { path: "schemas/contract-registry.schema.json", kind: "json-schema" },
    { path: "schemas/field-mapping.schema.json", kind: "json-schema" },
    { path: "schemas/policy-lifecycle.schema.json", kind: "json-schema" },
    { path: "schemas/policy-lock.schema.json", kind: "json-schema" },
    { path: "schemas/policy-snapshot.schema.json", kind: "json-schema" },
    { path: "schemas/release-manifest.schema.json", kind: "json-schema" },
    { path: "schemas/runtime-compatibility.schema.json", kind: "json-schema" }
  ];

  for (const entry of catalog) {
    const identity = { department: entry.department, workflow: entry.slug };
    descriptors.push(
      { path: entry.workflow, kind: "workflow", ...identity },
      { path: `${entry.path}/README.md`, kind: "workflow-documentation", ...identity },
      { path: entry.examples.lowRisk, kind: "fixture-low-risk", ...identity },
      { path: entry.examples.highRisk, kind: "fixture-high-risk", ...identity },
      { path: entry.examples.invalid, kind: "fixture-invalid", ...identity }
    );
  }

  return descriptors.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

export async function buildArtifactManifest({
  root,
  catalog,
  packageVersion,
  policySchemaVersion,
  policyEngineVersion,
  policyEngineFingerprint
}) {
  const descriptors = generatedArtifactDescriptors(catalog);
  const paths = descriptors.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) throw new Error("Generated artifact paths must be unique");

  const artifacts = [];
  for (const descriptor of descriptors) {
    const content = await readFile(join(root, descriptor.path));
    artifacts.push({
      ...descriptor,
      bytes: content.byteLength,
      sha256: sha256(content)
    });
  }

  return {
    manifestVersion: artifactManifestVersion,
    packageVersion,
    policySchemaVersion,
    policyEngineVersion,
    policyEngineFingerprint,
    artifactCount: artifacts.length,
    departmentCount: new Set(catalog.map((entry) => entry.department)).size,
    workflowCount: catalog.length,
    artifacts
  };
}
