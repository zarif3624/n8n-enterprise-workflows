import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanPublicBoundaryFile } from "./public-boundary-scan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return "Usage: node scripts/scan-history-boundary.mjs [--repository <path>] [--ref <commit>]";
}

function parseArguments(args) {
  const options = { repository: root, ref: "HEAD" };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument !== "--repository" && argument !== "--ref") {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("-")) throw new Error(`${argument} requires a value`);
    const key = argument === "--repository" ? "repository" : "ref";
    if (options[key] !== (key === "repository" ? root : "HEAD")) throw new Error(`${argument} may only be supplied once`);
    options[key] = value;
    index += 1;
  }
  return { ...options, repository: resolve(options.repository) };
}

function git(repository, args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: repository,
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 128 * 1024 * 1024
  });
}

function hasGitHistory(repository) {
  try {
    git(repository, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

function treeBlobs(repository, commit) {
  const output = git(repository, ["ls-tree", "-r", "-z", "--full-tree", commit], "buffer");
  return output.toString("utf8").split("\0").filter(Boolean).map((entry) => {
    const tab = entry.indexOf("\t");
    if (tab < 0) throw new Error(`Malformed tree entry at ${commit}`);
    const [mode, type, oid] = entry.slice(0, tab).split(" ");
    if (!mode || !type || !oid) throw new Error(`Malformed tree entry at ${commit}`);
    return { type, oid, path: entry.slice(tab + 1) };
  }).filter(({ type }) => type === "blob");
}

function scanHistory(repository, ref) {
  let resolvedRef;
  try {
    resolvedRef = git(repository, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`Git ref does not resolve to a commit: ${ref}`);
  }
  const commits = git(repository, ["rev-list", "--reverse", resolvedRef]).trim().split("\n").filter(Boolean);
  const blobContent = new Map();
  const scannedPaths = new Set();
  const uniqueBlobs = new Set();
  const findings = [];

  for (const commit of commits) {
    const message = git(repository, ["show", "--quiet", "--format=%B", commit], "buffer");
    findings.push(...scanPublicBoundaryFile(`commit:${commit}`, message));
    for (const { oid, path } of treeBlobs(repository, commit)) {
      uniqueBlobs.add(oid);
      const key = `${oid}\0${path}`;
      if (scannedPaths.has(key)) continue;
      scannedPaths.add(key);
      findings.push(...scanPublicBoundaryFile(path, Buffer.from(path, "utf8")));
      if (!blobContent.has(oid)) blobContent.set(oid, git(repository, ["cat-file", "blob", oid], "buffer"));
      findings.push(...scanPublicBoundaryFile(path, blobContent.get(oid)));
    }
  }

  return {
    commits: commits.length,
    blobs: uniqueBlobs.size,
    findings: findings.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.kind.localeCompare(right.kind))
  };
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  console.error(usage());
  process.exit(2);
}

if (options.help) {
  console.log(usage());
} else if (!hasGitHistory(options.repository)) {
  console.log("No Git history is available; the source-tree boundary scan remains authoritative.");
} else {
  try {
    const result = scanHistory(options.repository, options.ref);
    if (result.findings.length > 0) {
      console.error(`Public-boundary history scan found ${result.findings.length} issue(s):`);
      for (const finding of result.findings) console.error(`- ${finding.path}:${finding.line} (${finding.kind})`);
      process.exitCode = 1;
    } else {
      console.log(`Public-boundary history scan passed across ${result.commits} commit(s) and ${result.blobs} unique blob(s).`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
