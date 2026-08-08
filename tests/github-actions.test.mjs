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
