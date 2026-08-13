import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { TextDecoder } from "node:util";

const stashLocator = ["private", "product", "stash"].join("[-_ ]");
const localHomeLocators = [
  ["/", "Users", "/"].join(""),
  ["/", "home", "/"].join(""),
  ["[A-Za-z]:", "\\\\", "Users", "\\\\"].join("")
].join("|");
const namedArtifactMarkers = [
  ["COMMERCIAL", "PORTFOLIO\\.md"].join("_"),
  ["commercial", "portfolio", "v\\d[^\\s`]*"].join("-"),
  ["pack", "briefs?"].join(" "),
  ["pack", "roadmap"].join(" "),
  ["packaging", "tier guidance"].join("\\/"),
  ["productization", "phase"].join(" "),
  ["phased", "productization roadmap"].join(" "),
  ["monetization", "priorities"].join(" "),
  ["commercialization", "map"].join(" ")
].join("|");

const detailedPrivatePackPlanPattern = new RegExp([
  String.raw`\b(?:organized into|allocate(?:d)?[^\n.]*?to)(?: each of)? (?:four|4|eight|8) (?:sellable )?(?:product )?packs?\b`,
  String.raw`\b(?:six|6)\b[^\n.]{0,120}\b(?:eight|8) (?:sellable )?(?:product )?packs?\b`,
  String.raw`\b(?:eight|8) (?:sellable )?(?:product )?packs?\b[^\n.]{0,120}\b(?:six|6)\b(?: famil(?:y|ies)\b)?`
].join("|"), "gi");
const detailedPrivatePackPlanAnchorPattern = /\b(?:organized into|allocate(?:d)?|six|6|eight|8)\b/gi;
const detailedPrivatePackPlanLeakPattern = ["detailed-private-pack-plan", detailedPrivatePackPlanPattern];
const leakPatterns = [
  ["absolute-local-path", new RegExp(`(?:${localHomeLocators})[^\\s\`\"')]+`, "g")],
  ["private-workspace-path", new RegExp(`(?:^|[/\\\\])${stashLocator}(?:[/\\\\]|$)`, "gim")],
  ["named-private-planning-artifact", new RegExp(`\\b(?:${namedArtifactMarkers})\\b`, "gi")],
  detailedPrivatePackPlanLeakPattern
];
const excludedDirectories = new Set([".git", "node_modules", "dist", "coverage"]);
const maximumJoinedBinaryRuns = 6;
const maximumJoinedBinaryTextLength = 256;
const textExtensions = new Set([".cjs", ".css", ".csv", ".html", ".js", ".json", ".md", ".mjs", ".sh", ".txt", ".xml", ".yaml", ".yml"]);
const textBasenames = new Set([".gitignore", "LICENSE", "SHA256SUMS"]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const binaryUtf8Decoder = new TextDecoder("utf-8");
const knownBinarySignatures = [
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from("GIF87a", "ascii"),
  Buffer.from("GIF89a", "ascii"),
  Buffer.from("%PDF-", "ascii"),
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
  Buffer.from([0x1f, 0x8b]),
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  Buffer.from("wOFF", "ascii"),
  Buffer.from("wOF2", "ascii"),
  Buffer.from([0x00, 0x00, 0x01, 0x00])
];

function hasKnownBinarySignature(bytes) {
  return knownBinarySignatures.some((signature) => bytes.length >= signature.length && bytes.subarray(0, signature.length).equals(signature));
}

function readableTextRunsFromBinary(bytes) {
  return binaryUtf8Decoder
    .decode(bytes)
    .split(/[\u0000-\u001f\u007f-\u009f\ufffd]+/gu)
    .map((run) => run.normalize("NFKC").trim())
    .filter(Boolean);
}

function lineNumber(text, index) {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) if (text.charCodeAt(offset) === 10) line += 1;
  return line;
}

function scanNormalizedText(path, normalizedText, patterns) {
  const findings = [];
  for (const [kind, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of normalizedText.matchAll(pattern)) findings.push({ path, line: lineNumber(normalizedText, match.index), kind });
  }
  return findings.sort((left, right) => left.line - right.line || left.kind.localeCompare(right.kind));
}

export function scanPublicBoundaryText(path, text) {
  return scanNormalizedText(path, text.normalize("NFKC"), leakPatterns);
}

function scanReadableBinary(path, bytes) {
  const runs = readableTextRunsFromBinary(bytes);
  const findings = runs.flatMap((run) => scanNormalizedText(path, run, leakPatterns));
  if (findings.some(({ kind }) => kind === detailedPrivatePackPlanLeakPattern[0])) return findings;

  for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
    detailedPrivatePackPlanAnchorPattern.lastIndex = 0;
    for (const anchor of runs[runIndex].matchAll(detailedPrivatePackPlanAnchorPattern)) {
      let candidate = "";
      let crossedBoundary = false;
      const end = Math.min(runs.length, runIndex + maximumJoinedBinaryRuns);
      for (let index = runIndex; index < end; index += 1) {
        const runPortion = index === runIndex ? runs[index].slice(anchor.index) : runs[index];
        const separator = candidate ? " " : "";
        const availableLength = maximumJoinedBinaryTextLength - candidate.length - separator.length;
        if (availableLength <= 0) break;
        candidate += separator + runPortion.slice(0, availableLength);
        if (index > runIndex) crossedBoundary = true;
        if (runPortion.length > availableLength) break;
      }
      if (crossedBoundary && scanNormalizedText(path, candidate, [detailedPrivatePackPlanLeakPattern]).length > 0) {
        return [...findings, { path, line: 1, kind: detailedPrivatePackPlanLeakPattern[0] }]
          .sort((left, right) => left.line - right.line || left.kind.localeCompare(right.kind));
      }
    }
  }
  return findings;
}

export function scanPublicBoundaryFile(path, content) {
  const bytes = Buffer.from(content);
  const declaredText = textBasenames.has(basename(path)) || textExtensions.has(extname(path).toLowerCase());
  if (!declaredText && hasKnownBinarySignature(bytes)) return scanReadableBinary(path, bytes);
  if (bytes.includes(0)) return [{ path, line: 1, kind: "invalid-text" }];
  try {
    return scanPublicBoundaryText(path, utf8Decoder.decode(bytes));
  } catch {
    return [{ path, line: 1, kind: "invalid-text" }];
  }
}

async function publicPaths(root) {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
  } catch {
    const paths = [];
    async function visit(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile()) paths.push(relative(root, path).replaceAll("\\", "/"));
      }
    }
    await visit(root);
    return paths.sort();
  }
}

export async function scanTrackedPublicTree(root) {
  const paths = await publicPaths(root);
  const findings = [];
  for (const path of paths) findings.push(...scanPublicBoundaryFile(path, await readFile(join(root, path))));
  return findings;
}
