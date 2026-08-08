import { sha256 } from "./artifact-integrity.mjs";
import { readTarGzip } from "./release-archive.mjs";

const sha256Pattern = /^sha256:[a-f0-9]{64}$/;

function safeRelativePath(path) {
  return typeof path === "string" && path && !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..");
}

function assertManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("BUNDLE.json must contain an object");
  if (manifest.bundleManifestVersion !== 1) throw new Error("Unsupported bundle manifest version");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.packageVersion ?? "")) throw new Error("Bundle packageVersion is invalid");
  if (!sha256Pattern.test(manifest.sourceArtifactManifestSha256 ?? "")) throw new Error("Bundle source artifact identity is invalid");
  if (!["full", "department"].includes(manifest.scope)) throw new Error("Bundle scope is invalid");
  if (manifest.scope === "department" && !/^[a-z]+(?:-[a-z]+)*$/.test(manifest.department ?? "")) throw new Error("Department bundle identity is invalid");
  if (!Number.isSafeInteger(manifest.fileCount) || manifest.fileCount < 1 || !Array.isArray(manifest.files) || manifest.files.length !== manifest.fileCount) {
    throw new Error("Bundle file count is invalid");
  }
  if (!Array.isArray(manifest.workflows) || !manifest.workflows.length) throw new Error("Bundle workflow identity is missing");
  const paths = new Set();
  for (const file of manifest.files) {
    if (!safeRelativePath(file?.path) || file.path === "BUNDLE.json") throw new Error("Bundle manifest contains an unsafe file path");
    if (paths.has(file.path)) throw new Error(`Bundle manifest contains duplicate path: ${file.path}`);
    paths.add(file.path);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || !sha256Pattern.test(file.sha256 ?? "")) {
      throw new Error(`Bundle manifest identity is invalid for ${file.path}`);
    }
  }
}

export function verifyReleaseBundle(archive) {
  const archiveBytes = Buffer.from(archive);
  const entries = readTarGzip(archiveBytes);
  if (!entries.length) throw new Error("Release bundle is empty");
  const roots = new Set(entries.map((entry) => entry.path.split("/")[0]));
  if (roots.size !== 1 || entries.some((entry) => !entry.path.includes("/"))) throw new Error("Release bundle must contain exactly one root directory");
  const root = [...roots][0];
  const manifestEntry = entries.find((entry) => entry.path === `${root}/BUNDLE.json`);
  if (!manifestEntry) throw new Error("Release bundle is missing BUNDLE.json");
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.content.toString("utf8"));
  } catch {
    throw new Error("BUNDLE.json is not valid JSON");
  }
  assertManifest(manifest);

  const actual = new Map(
    entries
      .filter((entry) => entry !== manifestEntry)
      .map((entry) => [entry.path.slice(root.length + 1), entry.content])
  );
  if (actual.size !== manifest.files.length) throw new Error("Bundle file set does not match BUNDLE.json");
  for (const file of manifest.files) {
    const content = actual.get(file.path);
    if (!content) throw new Error(`Bundle is missing manifested file: ${file.path}`);
    if (content.byteLength !== file.bytes) throw new Error(`Bundle byte count mismatch: ${file.path}`);
    if (sha256(content) !== file.sha256) throw new Error(`Bundle SHA-256 mismatch: ${file.path}`);
  }
  for (const path of actual.keys()) {
    if (!manifest.files.some((file) => file.path === path)) throw new Error(`Bundle contains unmanifested file: ${path}`);
  }

  return {
    ok: true,
    bundleManifestVersion: manifest.bundleManifestVersion,
    packageVersion: manifest.packageVersion,
    scope: manifest.scope,
    ...(manifest.department ? { department: manifest.department } : {}),
    root,
    fileCount: manifest.fileCount,
    workflowCount: manifest.workflows.length,
    sourceArtifactManifestSha256: manifest.sourceArtifactManifestSha256,
    archiveSha256: sha256(archiveBytes)
  };
}

export function renderBundleVerification(report) {
  return `Bundle verification: PASS

- Archive SHA-256: ${report.archiveSha256}
- Package version: ${report.packageVersion}
- Scope: ${report.scope}${report.department ? ` (${report.department})` : ""}
- Root: ${report.root}
- Files verified: ${report.fileCount}
- Workflows: ${report.workflowCount}
- Source artifact manifest: ${report.sourceArtifactManifestSha256}
`;
}
