import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifactManifest, sha256 } from "./artifact-integrity.mjs";
import { createTarGzip, readTarGzip } from "./release-archive.mjs";
import { verifyReleaseBundle } from "./verify-bundle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "dist");

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function json(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function titleCase(value) {
  return value.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

async function filesUnder(relativeDirectory) {
  const files = [];
  async function visit(relativePath) {
    const entries = await readdir(join(root, relativePath), { withFileTypes: true });
    for (const entry of entries) {
      const child = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) files.push(child);
      else throw new Error(`Release source must not contain links or special files: ${child}`);
    }
  }
  await visit(relativeDirectory);
  return files.sort(compareText);
}

async function readEntries(paths) {
  const entries = [];
  for (const path of [...new Set(paths)].sort(compareText)) {
    entries.push({ path, content: await readFile(join(root, path)) });
  }
  return entries;
}

function bundleManifest(entries, metadata) {
  const files = entries.map((entry) => ({
    path: entry.path,
    bytes: entry.content.byteLength,
    sha256: sha256(entry.content)
  })).sort((left, right) => compareText(left.path, right.path));
  return {
    bundleManifestVersion: 1,
    ...metadata,
    fileCount: files.length,
    files
  };
}

function archiveFor(entries, rootName, metadata) {
  const manifest = bundleManifest(entries, metadata);
  const contents = [...entries, { path: "BUNDLE.json", content: json(manifest) }]
    .map((entry) => ({ ...entry, path: `${rootName}/${entry.path}` }));
  const archive = createTarGzip(contents);
  const extracted = readTarGzip(archive);
  const extractedByPath = new Map(extracted.map((entry) => [entry.path, entry.content]));
  if (extractedByPath.size !== contents.length) {
    throw new Error(`Release archive verification failed for ${rootName}`);
  }
  const extractedManifest = JSON.parse(extractedByPath.get(`${rootName}/BUNDLE.json`) ?? "null");
  if (JSON.stringify(extractedManifest) !== JSON.stringify(manifest)) {
    throw new Error(`Bundle manifest verification failed for ${rootName}`);
  }
  for (const file of manifest.files) {
    const content = extractedByPath.get(`${rootName}/${file.path}`);
    if (!content || content.byteLength !== file.bytes || sha256(content) !== file.sha256) {
      throw new Error(`Bundled file verification failed for ${rootName}/${file.path}`);
    }
  }
  return archive;
}

function departmentReadme(department, entries, version) {
  const rows = entries.map((entry) => `- **${entry.name}** — import \`${entry.workflow}\``).join("\n");
  return Buffer.from(`# ${titleCase(department)} workflow bundle\n\nVersion ${version} of the n8n Enterprise Workflows ${titleCase(department)} bundle.\n\n${rows}\n\nEvery workflow ships inactive and credential-free. Read its companion README, use the supplied fixtures on the test webhook, configure authentication, and obtain the named business owner's approval before production activation.\n\n- \`catalog.json\` describes the included workflows and typed inputs.\n- \`openapi.json\` describes their HTTP contracts.\n- \`policy-lock.json\` and \`policy-snapshot.json\` identify the exact decision behavior.\n- \`BUNDLE.json\` records a SHA-256 hash for every other file in this archive.\n\nVerify the archive itself with the release's \`SHA256SUMS\` file before extraction.\n`);
}

function filteredOpenApi(openApi, entries) {
  const allowedPaths = new Set(entries.map((entry) => entry.endpoint));
  return {
    ...openApi,
    paths: Object.fromEntries(Object.entries(openApi.paths).filter(([path]) => allowedPaths.has(path)))
  };
}

function filteredPolicies(document, entries) {
  const allowedSlugs = new Set(entries.map((entry) => entry.slug));
  return { ...document, policies: document.policies.filter((entry) => allowedSlugs.has(entry.slug)) };
}

export async function buildRelease() {
  const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
  const openApi = JSON.parse(await readFile(join(root, "openapi.json"), "utf8"));
  const policyLock = JSON.parse(await readFile(join(root, "policy-lock.json"), "utf8"));
  const policySnapshot = JSON.parse(await readFile(join(root, "policy-snapshot.json"), "utf8"));
  const artifactManifestBytes = await readFile(join(root, "artifact-manifest.json"));
  const artifactManifest = JSON.parse(artifactManifestBytes);
  const expectedArtifactManifest = await buildArtifactManifest({
    root,
    catalog,
    packageVersion: packageManifest.version,
    policySchemaVersion: policyLock.policySchemaVersion,
    policyEngineVersion: policyLock.policyEngineVersion,
    policyEngineFingerprint: policyLock.policyEngineFingerprint
  });
  if (JSON.stringify(artifactManifest) !== JSON.stringify(expectedArtifactManifest)) {
    throw new Error("Refusing to package a release whose artifact manifest does not match the generated files");
  }

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const version = packageManifest.version;
  const sourceManifestSha256 = sha256(artifactManifestBytes);
  const workflowIdentities = catalog.map(({ department, slug, name, policyVersion, workflow }) => ({
    department, slug, name, policyVersion, workflow
  }));
  const rootFiles = [
    "CHANGELOG.md", "CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "LICENSE", "README.md", "SECURITY.md",
    "artifact-manifest.json", "catalog.json", "openapi.json", "package-lock.json", "package.json",
    "policy-lock.json", "policy-snapshot.json"
  ];
  const sourceFiles = [
    ...rootFiles,
    ...await filesUnder(".github"),
    ...await filesUnder("docs"),
    ...await filesUnder("schemas"),
    ...await filesUnder("scripts"),
    ...await filesUnder("tests"),
    ...await filesUnder("workflows")
  ];
  const fullEntries = await readEntries(sourceFiles);
  const archives = [];

  async function emitArchive({ file, scope, department, workflows, entries }) {
    const rootName = file.replace(/\.tar\.gz$/, "");
    const archive = archiveFor(entries, rootName, {
      packageVersion: version,
      scope,
      ...(department ? { department } : {}),
      sourceArtifactManifestSha256: sourceManifestSha256,
      workflows
    });
    const verification = verifyReleaseBundle(archive);
    if (verification.packageVersion !== version || verification.scope !== scope || verification.workflowCount !== workflows.length) {
      throw new Error(`Consumer bundle verification failed for ${file}`);
    }
    await writeFile(join(outputDirectory, file), archive);
    archives.push({
      file,
      scope,
      ...(department ? { department } : {}),
      workflowCount: workflows.length,
      bytes: archive.byteLength,
      sha256: sha256(archive)
    });
  }

  await emitArchive({
    file: `n8n-enterprise-workflows-v${version}.tar.gz`,
    scope: "full",
    workflows: workflowIdentities,
    entries: fullEntries
  });

  const departments = [...new Set(catalog.map((entry) => entry.department))].sort(compareText);
  for (const department of departments) {
    const departmentCatalog = catalog.filter((entry) => entry.department === department);
    const artifactPaths = artifactManifest.artifacts
      .filter((entry) => entry.department === department)
      .map((entry) => entry.path);
    const entries = await readEntries([
      "LICENSE",
      "SECURITY.md",
      "docs/enterprise-readiness.md",
      "docs/roi-model.md",
      ...artifactPaths
    ]);
    const replace = new Map([
      ["README.md", departmentReadme(department, departmentCatalog, version)],
      ["catalog.json", json(departmentCatalog)],
      ["openapi.json", json(filteredOpenApi(openApi, departmentCatalog))],
      ["policy-lock.json", json(filteredPolicies(policyLock, departmentCatalog))],
      ["policy-snapshot.json", json(filteredPolicies(policySnapshot, departmentCatalog))]
    ]);
    for (const [path, content] of replace) entries.push({ path, content });
    const workflows = workflowIdentities.filter((entry) => entry.department === department);
    await emitArchive({
      file: `n8n-enterprise-workflows-${department}-v${version}.tar.gz`,
      scope: "department",
      department,
      workflows,
      entries
    });
  }

  archives.sort((left, right) => compareText(left.file, right.file));
  const releaseManifest = {
    releaseManifestVersion: 1,
    packageVersion: version,
    sourceArtifactManifestSha256: sourceManifestSha256,
    archiveCount: archives.length,
    archives
  };
  const releaseManifestBytes = json(releaseManifest);
  await writeFile(join(outputDirectory, "release-manifest.json"), releaseManifestBytes);
  const checksums = [
    ...archives.map((entry) => ({ file: entry.file, sha256: entry.sha256 })),
    { file: "release-manifest.json", sha256: sha256(releaseManifestBytes) }
  ].sort((left, right) => compareText(left.file, right.file));
  await writeFile(
    join(outputDirectory, "SHA256SUMS"),
    `${checksums.map((entry) => `${entry.sha256.slice("sha256:".length)}  ${entry.file}`).join("\n")}\n`
  );
  console.log(`Built ${archives.length} reproducible release archives for v${version} in dist/.`);
  return releaseManifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await buildRelease();
}
