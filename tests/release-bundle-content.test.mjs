import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
});
