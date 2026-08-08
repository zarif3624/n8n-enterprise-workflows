import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;

function run(script, ...args) {
  return spawnSync(process.execPath, [`scripts/${script}`, ...args], { cwd: root, encoding: "utf8" });
}

test("runtime compatibility CLI rejects ignored arguments", () => {
  for (const args of [["matrix", "extra"], ["validate", "--json"], ["unknown"]]) {
    const result = run("runtime-compatibility-cli.mjs", ...args);
    assert.equal(result.status, 2, `${args.join(" ")}: ${result.stderr}`);
    assert.match(result.stderr, /Unknown command|Unexpected argument/);
  }
});

test("contract registry CLI rejects unknown, repeated, and incompatible options", () => {
  for (const args of [["list", "--unknown"], ["list", "--json", "--json"], ["validate", "--json"], ["unknown"]]) {
    const result = run("contract-registry-cli.mjs", ...args);
    assert.equal(result.status, 2, `${args.join(" ")}: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /node:internal|at file:/);
  }
});

test("silent governance discovery commands emit uncontaminated JSON", () => {
  const commands = [
    ["compatibility", "matrix"],
    ["contracts", "list", "--json"]
  ];
  for (const [script, ...args] of commands) {
    const result = spawnSync("npm", ["run", "--silent", script, "--", ...args], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotThrow(() => JSON.parse(result.stdout));
    assert.doesNotMatch(result.stdout, /> n8n-enterprise-workflows/);
  }
});
