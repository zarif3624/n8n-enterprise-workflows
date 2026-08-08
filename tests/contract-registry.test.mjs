import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { contractRegistryIssues } from "../scripts/contract-registry.mjs";

const root = new URL("../", import.meta.url).pathname;
const registry = JSON.parse(await readFile(join(root, "contract-registry.json"), "utf8"));

test("contract registry validates every document and covers every published schema", async () => {
  assert.deepEqual(await contractRegistryIssues({ root, registry }), []);
});

test("contract registry rejects missing documents, duplicate IDs, and orphaned schemas without echoing content", async () => {
  const changed = structuredClone(registry);
  changed.documents[0].path = "missing.json";
  changed.documents[1].id = changed.documents[0].id;
  changed.outputs = changed.outputs.filter((entry) => entry.id !== "field-mapping");
  const issues = await contractRegistryIssues({ root, registry: changed });
  assert.ok(issues.some((issue) => issue.includes("could not be read as JSON")));
  assert.ok(issues.some((issue) => issue.includes("duplicate contract id")));
  assert.ok(issues.some((issue) => issue.includes("orphaned schema: schemas/field-mapping.schema.json")));
});

test("contract registry CLI lists machine-readable discovery metadata", () => {
  const result = spawnSync(process.execPath, ["scripts/contract-registry-cli.mjs", "list", "--json"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const listed = JSON.parse(result.stdout);
  assert.equal(listed.registryVersion, 1);
  assert.equal(listed.documents.length, 7);
  assert.equal(listed.outputs.length, 5);
});
