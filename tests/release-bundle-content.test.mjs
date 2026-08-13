import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix, join } from "node:path";
import test from "node:test";
import { buildRelease } from "../scripts/build-release.mjs";
import { scanPublicBoundaryFile } from "../scripts/public-boundary-scan.mjs";
import { readTarGzip } from "../scripts/release-archive.mjs";
import { schemaContractIssues } from "../scripts/schema-contract-check.mjs";

const root = new URL("../", import.meta.url).pathname;
const expectedDepartments = [
  "artificial-intelligence",
  "customer-success",
  "customer-support",
  "data-operations",
  "engineering",
  "field-operations",
  "finance",
  "incident-management",
  "information-technology",
  "operations",
  "people-operations",
  "proposal-management",
  "revenue-operations",
  "sales",
  "security"
];

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

function assertNoPublicBoundaryLeaks(files, archiveName) {
  assert.deepEqual(
    [...files].flatMap(([path, content]) => scanPublicBoundaryFile(path, content)),
    [],
    `${archiveName}: archive must not contain internal workspace or detailed commercialization planning`
  );
}

test("full and department release bundles carry lifecycle and compatibility contracts", async () => {
  const [bundleSchema, releaseSchema] = await Promise.all([
    readFile(join(root, "schemas", "bundle-manifest.schema.json"), "utf8").then(JSON.parse),
    readFile(join(root, "schemas", "release-manifest.schema.json"), "utf8").then(JSON.parse)
  ]);
  const manifest = await buildRelease();
  assert.deepEqual(schemaContractIssues(manifest, releaseSchema, releaseSchema), []);
  const full = manifest.archives.find((entry) => entry.scope === "full");
  const departments = manifest.archives.filter((entry) => entry.scope === "department");
  assert.ok(full);
  assert.equal(manifest.archiveCount, 16);
  assert.equal(manifest.archives.length, 16);
  assert.equal(full.workflowCount, 16);
  assert.equal(departments.length, 15);
  assert.deepEqual(departments.map((entry) => entry.department).sort(), expectedDepartments);
  const boundaryScannedArchives = [];

  const fullFiles = bundleFiles(await readFile(join(root, "dist", full.file)));
  assert.deepEqual(schemaContractIssues(JSON.parse(fullFiles.get("BUNDLE.json").toString("utf8")), bundleSchema, bundleSchema), []);
  assert.ok(fullFiles.has("policy-lifecycle.json"));
  assert.ok(fullFiles.has("portfolio.json"));
  assert.ok(fullFiles.has("runtime-compatibility.json"));
  assert.ok(fullFiles.has("schemas/policy-lifecycle.schema.json"));
  assert.ok(fullFiles.has("schemas/portfolio.schema.json"));
  assertNoPublicBoundaryLeaks(fullFiles, full.file);
  boundaryScannedArchives.push(full.file);

  for (const archive of departments) {
    const files = bundleFiles(await readFile(join(root, "dist", archive.file)));
    assertNoPublicBoundaryLeaks(files, archive.file);
    boundaryScannedArchives.push(archive.file);
    assert.deepEqual(schemaContractIssues(JSON.parse(files.get("BUNDLE.json").toString("utf8")), bundleSchema, bundleSchema), []);
    const lifecycle = JSON.parse(files.get("policy-lifecycle.json"));
    const catalog = JSON.parse(files.get("catalog.json"));
    assert.equal(catalog.length, archive.workflowCount);
    assert.ok(catalog.every((entry) => entry.department === archive.department));
    assert.deepEqual(lifecycle.policies.map((entry) => entry.slug).sort(), catalog.map((entry) => entry.slug).sort());
    assert.ok(lifecycle.policies.every((entry) => entry.status === "draft"));
    assert.ok(files.has("runtime-compatibility.json"));
    assert.ok(files.has("schemas/runtime-compatibility.schema.json"));
    assert.ok(files.has("docs/policy-lifecycle.md"));
    assert.ok(files.has("docs/field-mapping.md"));
    assert.ok(files.has("docs/conformance-testing.md"));
    assert.ok(files.has("docs/drift-monitoring.md"));
    const mappingSchema = JSON.parse(files.get("schemas/field-mapping.schema.json"));
    for (const entry of catalog) {
      const mapping = JSON.parse(files.get(`mappings/${entry.slug}.json`));
      const lifecycleEntry = lifecycle.policies.find((policy) => policy.slug === entry.slug);
      assert.deepEqual(schemaContractIssues(mapping, mappingSchema, mappingSchema), []);
      assert.equal(mapping.workflow, entry.slug);
      assert.equal(mapping.policyFingerprint, lifecycleEntry.fingerprint);
      assert.ok(Object.keys(mapping.fields).length > 0);
    }
    assertInternalMarkdownLinks(files);
  }
  assert.equal(boundaryScannedArchives.length, manifest.archives.length, "public-boundary scan must cover every built archive");
});
