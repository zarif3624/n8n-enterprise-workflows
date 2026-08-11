import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("all external GitHub Actions are pinned to immutable commit SHAs", async () => {
  const workflowDirectory = join(root, ".github", "workflows");
  const files = (await readdir(workflowDirectory)).filter((name) => name.endsWith(".yml"));
  assert.ok(files.length >= 3);
  for (const file of files) {
    const source = await readFile(join(workflowDirectory, file), "utf8");
    const references = [...source.matchAll(/^\s*-?\s*uses:\s*([^@\s]+)@([^\s#]+)/gm)];
    assert.ok(references.length > 0, `${file} must declare at least one action`);
    for (const [, action, revision] of references) {
      if (action.startsWith("./")) continue;
      assert.match(revision, /^[a-f0-9]{40}$/, `${file}: ${action} must use a full commit SHA`);
    }
  }
});

test("the n8n compatibility workflow consumes the versioned runtime plan", async () => {
  const source = await readFile(join(root, ".github", "workflows", "n8n-import-smoke.yml"), "utf8");
  assert.match(source, /compatibility -- matrix/);
  assert.match(source, /fromJSON\(needs\.matrix\.outputs\.include\)/);
  assert.doesNotMatch(source, /n8n-version:\s*\[[^\]]+\]/);
});

test("the n8n compatibility workflow waits for published webhook registration", async () => {
  const source = await readFile(join(root, ".github", "workflows", "n8n-import-smoke.yml"), "utf8");
  assert.match(source, /wait_for_webhook\(\)/);
  assert.equal([...source.matchAll(/^\s+wait_for_webhook$/gm)].length, 2);
  assert.match(source, /\/webhook\/enterprise\/finance\/invoice-exception-triage/);
  assert.match(source, /400\|application\/json/);
});

test("validation CI publishes the honest readiness report without changing its exit semantics", async () => {
  const source = await readFile(join(root, ".github", "workflows", "validate.yml"), "utf8");
  assert.match(source, /npm run --silent readiness >> "\$GITHUB_STEP_SUMMARY"/);
  assert.doesNotMatch(source, /readiness -- --json/);
});

test("validation CI enforces explicit production-script coverage floors", async () => {
  const [workflow, packageManifest] = await Promise.all([
    readFile(join(root, ".github", "workflows", "validate.yml"), "utf8"),
    readFile(join(root, "package.json"), "utf8").then(JSON.parse)
  ]);
  assert.match(workflow, /npm run test:coverage/);
  assert.match(packageManifest.scripts["test:coverage"], /--test-coverage-include='scripts\/\*\.mjs'/);
  assert.match(packageManifest.scripts["test:coverage"], /--test-coverage-lines=90/);
  assert.match(packageManifest.scripts["test:coverage"], /--test-coverage-branches=70/);
  assert.match(packageManifest.scripts["test:coverage"], /--test-coverage-functions=90/);
});

test("release CI clean-installs and validates the packaged source archive", async () => {
  const source = await readFile(join(root, ".github", "workflows", "release.yml"), "utf8");
  assert.match(source, /Prove the packaged source is self-validating/);
  assert.match(source, /tar -xzf dist\/n8n-enterprise-workflows-v\$\{GITHUB_REF_NAME#v\}\.tar\.gz/);
  assert.match(source, /test -f "\$\{packaged_root\}\/package-lock\.json"/);
  assert.match(source, /cd "\$\{packaged_root\}"\s+npm ci --ignore-scripts\s+npm run check/);
});

test("validation CI cancels stale runs without weakening release completion", async () => {
  const [validation, release] = await Promise.all([
    readFile(join(root, ".github", "workflows", "validate.yml"), "utf8"),
    readFile(join(root, ".github", "workflows", "release.yml"), "utf8")
  ]);
  assert.match(validation, /group: validate-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/);
  assert.match(validation, /cancel-in-progress: true/);
  assert.match(release, /cancel-in-progress: false/);
});
