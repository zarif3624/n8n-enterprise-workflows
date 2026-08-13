import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const scanner = join(root, "scripts", "scan-history-boundary.mjs");
const gitEnvironment = {
  ...process.env,
  GIT_AUTHOR_NAME: "Boundary Test",
  GIT_AUTHOR_EMAIL: "boundary@example.com",
  GIT_COMMITTER_NAME: "Boundary Test",
  GIT_COMMITTER_EMAIL: "boundary@example.com"
};

function git(repository, ...args) {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    env: gitEnvironment,
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

async function repositoryFixture(prefix) {
  const repository = await mkdtemp(join(tmpdir(), prefix));
  git(repository, "init", "--quiet");
  git(repository, "checkout", "--quiet", "-b", "main");
  return repository;
}

async function commitFile(repository, path, content, message) {
  const absolutePath = join(repository, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
  git(repository, "add", "--", path);
  git(repository, "commit", "--quiet", "-m", message);
  return git(repository, "rev-parse", "HEAD");
}

function scan(repository, ref = "HEAD") {
  return spawnSync(process.execPath, [scanner, "--repository", repository, "--ref", ref], {
    cwd: root,
    encoding: "utf8"
  });
}

test("history boundary scan rejects planning content deleted from the current tree", async () => {
  const repository = await repositoryFixture("history-boundary-tainted-");
  try {
    const marker = ["private", "product", "stash"].join("-");
    const artifact = ["COMMERCIAL", "PORTFOLIO.md"].join("_");
    await commitFile(repository, "docs/plan.md", `Create ../${marker}/${artifact} outside the public repository.\n`, "add internal plan");
    await rm(join(repository, "docs", "plan.md"));
    git(repository, "add", "--update");
    git(repository, "commit", "--quiet", "-m", "remove internal plan");

    const result = scan(repository);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Public-boundary history scan found 2 issue\(s\)/);
    assert.match(result.stderr, /docs\/plan\.md:1 \(named-private-planning-artifact\)/);
    assert.match(result.stderr, /docs\/plan\.md:1 \(private-workspace-path\)/);
    assert.doesNotMatch(result.stderr, new RegExp(["COMMERCIAL", "PORTFOLIO"].join("_")));
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("history boundary scan rejects planning markers in paths and commit messages", async () => {
  const repository = await repositoryFixture("history-boundary-metadata-");
  try {
    const marker = ["private", "product", "stash"].join("-");
    await commitFile(repository, `${marker}/notes.md`, "Private location metadata only.\n", "store local notes");
    await commitFile(repository, "README.md", "Public workflow catalog.\n", `Retire ../${marker}/ location`);

    const result = scan(repository);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, new RegExp(`${marker}/notes\\.md:1 \\(private-workspace-path\\)`));
    assert.match(result.stderr, /commit:[0-9a-f]{40}:1 \(private-workspace-path\)/);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("history boundary scan follows only the selected ref ancestry", async () => {
  const repository = await repositoryFixture("history-boundary-scope-");
  try {
    const cleanCommit = await commitFile(repository, "README.md", "Public workflow catalog.\n", "clean baseline");
    git(repository, "checkout", "--quiet", "-b", "local-private-notes");
    const marker = ["private", "product", "stash"].join("-");
    await commitFile(repository, "notes.md", `Stored in ../${marker}/ only.\n`, "local notes");
    git(repository, "checkout", "--quiet", "main");

    const result = scan(repository, cleanCommit);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "Public-boundary history scan passed across 1 commit(s) and 1 unique blob(s).\n");
    assert.equal(result.stderr, "");
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("history boundary scan is a documented no-op without Git metadata", async () => {
  const extractedSource = await mkdtemp(join(tmpdir(), "history-boundary-source-"));
  try {
    await writeFile(join(extractedSource, "README.md"), "Extracted public source archive.\n");
    const result = scan(extractedSource);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "No Git history is available; the source-tree boundary scan remains authoritative.\n");
    assert.equal(result.stderr, "");
  } finally {
    await rm(extractedSource, { recursive: true, force: true });
  }
});
