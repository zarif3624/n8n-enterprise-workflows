import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const actual = process.argv[2];
const expected = `v${packageManifest.version}`;

if (actual !== expected) {
  console.error(`Release tag ${actual ?? "<missing>"} does not match package version ${expected}.`);
  process.exit(1);
}

console.log(`Verified release tag ${actual}.`);
