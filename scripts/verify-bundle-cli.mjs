import { readFile } from "node:fs/promises";
import { renderBundleVerification, verifyReleaseBundle } from "./verify-bundle.mjs";

const maxCompressedBytes = 256 * 1024 * 1024;

function usage() {
  return `Usage: npm run verify:bundle -- <archive.tar.gz> [--json]\n`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage());
    return;
  }
  const json = args.includes("--json");
  const unknown = args.filter((argument) => argument.startsWith("--") && !["--json"].includes(argument));
  if (unknown.length) throw new Error(`Unknown option: ${unknown[0]}`);
  const paths = args.filter((argument) => !argument.startsWith("--"));
  if (paths.length !== 1) throw new Error("Exactly one release archive path is required");
  let archive;
  try {
    archive = await readFile(paths[0]);
  } catch {
    throw new Error("Could not read the release archive");
  }
  if (archive.byteLength > maxCompressedBytes) throw new Error("Compressed release archive exceeds the 256 MiB verification limit");
  const report = verifyReleaseBundle(archive);
  process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : renderBundleVerification(report));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exitCode = 1;
}
