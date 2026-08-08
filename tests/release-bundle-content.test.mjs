import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix, join } from "node:path";
import test from "node:test";
import { buildRelease } from "../scripts/build-release.mjs";
import { readTarGzip } from "../scripts/release-archive.mjs";
import { schemaContractIssues } from "../scripts/schema-contract-check.mjs";

const root = new URL("../", import.meta.url).pathname;

function bundleFiles(archive) {
  const entries = readTarGzip(archive);
  const rootName = entries[0].path.split("/")[0];
  return new Map(entries.map((entry) => [entry.path.slice(rootName.length + 1), entry.content]));
}

function assertInternalMarkdownLinks(files) {
  for (const [path, content] of files) {
    if (!path.endsWith(".md")) continue;
    for (const match of content.toString("utf8").matchAll(/\]\(([^)]+)\)/g)) {
      const destination = match[1].split("#")[0];
      if (!destination || /^[a-z][a-z0-9+.-]*:/i.test(destination)) continue;
      const resolved = posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(destination)));
      assert.ok(files.has(resolved), `${path}: bundled link target is missing: ${destination}`);
    }
  }
}

test("full and department release bundles carry lifecycle and compatibility contracts", async () => {
  const [bundleSchema, releaseSchema] = await Promise.all([
    readFile(join(root, "schemas", "bundle-manifest.schema.json"), "utf8").then(JSON.parse),
    readFile(join(root, "schemas", "release-manifest.schema.json"), "utf8").then(JSON.parse)
  ]);
  const manifest = await buildRelease();
  assert.deepEqual(schemaContractIssues(manifest, releaseSchema, releaseSchema), []);
  const full = manifest.archives.find((entry) => entry.scope === "full");
  const finance = manifest.archives.find((entry) => entry.department === "finance");
  assert.ok(full && finance);

  const fullFiles = bundleFiles(await readFile(join(root, "dist", full.file)));
  assert.deepEqual(schemaContractIssues(JSON.parse(fullFiles.get("BUNDLE.json").toString("utf8")), bundleSchema, bundleSchema), []);
  assert.ok(fullFiles.has("policy-lifecycle.json"));
  assert.ok(fullFiles.has("runtime-compatibility.json"));
  assert.ok(fullFiles.has("schemas/policy-lifecycle.schema.json"));

  const financeFiles = bundleFiles(await readFile(join(root, "dist", finance.file)));
  assert.deepEqual(schemaContractIssues(JSON.parse(financeFiles.get("BUNDLE.json").toString("utf8")), bundleSchema, bundleSchema), []);
  const lifecycle = JSON.parse(financeFiles.get("policy-lifecycle.json"));
  assert.deepEqual(lifecycle.policies.map((entry) => entry.slug), ["invoice-exception-triage"]);
  assert.equal(lifecycle.policies[0].status, "draft");
  assert.ok(financeFiles.has("runtime-compatibility.json"));
  assert.ok(financeFiles.has("schemas/runtime-compatibility.schema.json"));
  assert.ok(financeFiles.has("docs/policy-lifecycle.md"));
  assert.ok(financeFiles.has("docs/field-mapping.md"));
  assert.ok(financeFiles.has("docs/conformance-testing.md"));
  assert.ok(financeFiles.has("docs/drift-monitoring.md"));
  const mapping = JSON.parse(financeFiles.get("mappings/invoice-exception-triage.json"));
  const mappingSchema = JSON.parse(financeFiles.get("schemas/field-mapping.schema.json"));
  assert.deepEqual(schemaContractIssues(mapping, mappingSchema, mappingSchema), []);
  assert.equal(mapping.workflow, "invoice-exception-triage");
  assert.equal(mapping.policyFingerprint, lifecycle.policies[0].fingerprint);
  assert.ok(Object.keys(mapping.fields).length > 0);
  assertInternalMarkdownLinks(financeFiles);
});
