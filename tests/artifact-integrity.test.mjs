import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildArtifactManifest, generatedArtifactDescriptors, sha256 } from "../scripts/artifact-integrity.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const policyLock = JSON.parse(await readFile(join(root, "policy-lock.json"), "utf8"));

test("artifact descriptors cover every generated public file exactly once", () => {
  const descriptors = generatedArtifactDescriptors(catalog);
  assert.equal(descriptors.length, 10 + catalog.length * 5);
  assert.equal(new Set(descriptors.map((entry) => entry.path)).size, descriptors.length);
  assert.deepEqual(descriptors.map((entry) => entry.path), [...descriptors.map((entry) => entry.path)].sort());
});

test("artifact manifest deterministically hashes the complete generated catalog", async () => {
  const options = {
    root,
    catalog,
    packageVersion: packageManifest.version,
    policySchemaVersion: policyLock.policySchemaVersion,
    policyEngineVersion: policyLock.policyEngineVersion,
    policyEngineFingerprint: policyLock.policyEngineFingerprint
  };
  const first = await buildArtifactManifest(options);
  const second = await buildArtifactManifest(options);
  assert.deepEqual(first, second);
  assert.equal(first.artifactCount, 85);
  assert.equal(first.workflowCount, 15);
  assert.equal(first.departmentCount, 15);
  assert.ok(first.artifacts.every((entry) => entry.bytes > 0 && /^sha256:[a-f0-9]{64}$/.test(entry.sha256)));
});

test("SHA-256 helper hashes bytes without platform-dependent transformations", () => {
  assert.equal(sha256(Buffer.from("enterprise\n")), "sha256:9c169fe900ff79790395784287bfa82f0dc0059375a34a2881b9b745c8efd42e");
});
