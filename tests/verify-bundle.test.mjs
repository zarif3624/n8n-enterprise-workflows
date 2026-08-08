import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { sha256 } from "../scripts/artifact-integrity.mjs";
import { createTarGzip, readTarGzip } from "../scripts/release-archive.mjs";
import { renderBundleVerification, verifyReleaseBundle } from "../scripts/verify-bundle.mjs";

const root = new URL("../", import.meta.url).pathname;

function fixtureBundle({ files, manifestChanges = {}, extraEntries = [] } = {}) {
  const sourceFiles = files ?? [
    { path: "README.md", content: Buffer.from("# Bundle\n") },
    { path: "workflow.json", content: Buffer.from("{}\n") }
  ];
  const manifest = {
    bundleManifestVersion: 1,
    packageVersion: "0.2.0",
    scope: "department",
    department: "finance",
    sourceArtifactManifestSha256: `sha256:${"a".repeat(64)}`,
    workflows: [{ slug: "invoice-exception-triage" }],
    fileCount: sourceFiles.length,
    files: sourceFiles.map((file) => ({ path: file.path, bytes: file.content.length, sha256: sha256(file.content) })),
    ...manifestChanges
  };
  return createTarGzip([
    ...sourceFiles.map((file) => ({ path: `bundle/${file.path}`, content: file.content })),
    { path: "bundle/BUNDLE.json", content: `${JSON.stringify(manifest, null, 2)}\n` },
    ...extraEntries
  ]);
}

function recalculateHeaderChecksum(header) {
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.fill(0, 148, 156);
  Buffer.from(`${checksum.toString(8).padStart(6, "0")}\0 `).copy(header, 148);
}

function mutateFirstHeader(archive, mutate) {
  const tar = gunzipSync(archive);
  const header = tar.subarray(0, 512);
  mutate(header);
  recalculateHeaderChecksum(header);
  return gzipSync(tar);
}

test("bundle verifier authenticates the complete internal file set", () => {
  const report = verifyReleaseBundle(fixtureBundle());
  assert.equal(report.ok, true);
  assert.equal(report.scope, "department");
  assert.equal(report.department, "finance");
  assert.equal(report.fileCount, 2);
  assert.equal(report.workflowCount, 1);
  assert.match(report.archiveSha256, /^sha256:[a-f0-9]{64}$/);
  assert.match(renderBundleVerification(report), /Bundle verification: PASS/);
});

test("bundle verifier rejects changed bytes and dishonest file sets", () => {
  const wrongHash = fixtureBundle({ manifestChanges: {
    files: [
      { path: "README.md", bytes: 9, sha256: `sha256:${"0".repeat(64)}` },
      { path: "workflow.json", bytes: 3, sha256: sha256("{}\n") }
    ]
  } });
  assert.throws(() => verifyReleaseBundle(wrongHash), /SHA-256 mismatch/);

  const extra = fixtureBundle({ extraEntries: [{ path: "bundle/unmanifested.txt", content: "extra" }] });
  assert.throws(() => verifyReleaseBundle(extra), /file set does not match/);

  const missing = fixtureBundle({ manifestChanges: { fileCount: 3, files: [
    { path: "README.md", bytes: 9, sha256: sha256("# Bundle\n") },
    { path: "workflow.json", bytes: 3, sha256: sha256("{}\n") },
    { path: "missing.txt", bytes: 1, sha256: sha256("x") }
  ] } });
  assert.throws(() => verifyReleaseBundle(missing), /file set does not match/);
});

test("bundle verifier rejects multiple archive roots and malformed manifests", () => {
  const multipleRoots = fixtureBundle({ extraEntries: [{ path: "other/file.txt", content: "other" }] });
  assert.throws(() => verifyReleaseBundle(multipleRoots), /exactly one root directory/);
  const malformed = createTarGzip([{ path: "bundle/BUNDLE.json", content: "not-json" }]);
  assert.throws(() => verifyReleaseBundle(malformed), /not valid JSON/);
});

test("tar reader rejects unsafe paths, special entries, and oversized expansion", () => {
  const archive = createTarGzip([{ path: "bundle/a.txt", content: "safe" }]);
  const unsafe = mutateFirstHeader(archive, (header) => {
    header.fill(0, 0, 100);
    Buffer.from("../escape").copy(header, 0);
  });
  assert.throws(() => readTarGzip(unsafe), /Unsafe archive path/);
  const special = mutateFirstHeader(archive, (header) => { header[156] = "2".charCodeAt(0); });
  assert.throws(() => readTarGzip(special), /Unsupported tar entry type/);
  assert.throws(() => readTarGzip(archive, { maxOutputBytes: 1024 }), /Cannot create a Buffer larger|larger than/);
});

test("bundle verification CLI emits machine-readable evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "n8n-bundle-verify-"));
  const path = join(directory, "bundle.tar.gz");
  try {
    await writeFile(path, fixtureBundle());
    const result = spawnSync(process.execPath, ["scripts/verify-bundle-cli.mjs", path, "--json"], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
