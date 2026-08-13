import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname;
const commands = [
  "catalog-cli.mjs",
  "contract-registry-cli.mjs",
  "field-mapping-cli.mjs",
  "conformance-cli.mjs",
  "conformance-compare-cli.mjs",
  "runtime-compatibility-cli.mjs",
  "policy-lifecycle-cli.mjs",
  "readiness-report-cli.mjs",
  "verify-bundle-cli.mjs",
  "validate-portfolio.mjs",
  "evaluate-policy.mjs"
];

for (const script of commands) {
  test(`${script} exposes successful, side-effect-free help`, () => {
    for (const flag of ["--help", "-h"]) {
      const result = spawnSync(process.execPath, [`scripts/${script}`, flag], {
        cwd: root,
        encoding: "utf8"
      });
      assert.equal(result.status, 0, `${flag}: ${result.stderr}`);
      assert.match(result.stdout, /^Usage:/);
      assert.equal(result.stderr, "");
    }
  });
}
