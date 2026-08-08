import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const excludedDirectories = new Set([".git", "node_modules", "dist", "coverage"]);
const directPatterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ["slack-token", /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g],
  ["openai-style-key", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/g]
];
const genericAssignment = /\b(api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|private[_-]?key)\b\s*["']?\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{12,})/gi;
const allowedCandidates = /^(?:example|sample|placeholder|changeme|replace[-_]?me|your[-_]|test[-_]|dummy[-_]|redacted|x{8,}|0{8,})/i;

function entropy(value) {
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((total, count) => {
    const probability = count / value.length;
    return total - probability * Math.log2(probability);
  }, 0);
}

function lineNumber(text, index) {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) if (text.charCodeAt(offset) === 10) line += 1;
  return line;
}

export function scanSensitiveText(path, text) {
  const findings = [];
  const allowedLines = new Set(
    text.split(/\r?\n/).map((line, index) => /secret-scan:\s*allow/i.test(line) ? index + 1 : null).filter(Boolean)
  );
  for (const [kind, pattern] of directPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const line = lineNumber(text, match.index);
      if (!allowedLines.has(line)) findings.push({ path, line, kind });
    }
  }
  genericAssignment.lastIndex = 0;
  for (const match of text.matchAll(genericAssignment)) {
    const candidate = match[2];
    const line = lineNumber(text, match.index);
    if (!allowedLines.has(line) && !allowedCandidates.test(candidate) && entropy(candidate) >= 3.25) {
      findings.push({ path, line, kind: "high-entropy-credential-assignment" });
    }
  }
  return findings.sort((left, right) => left.line - right.line || left.kind.localeCompare(right.kind));
}

async function repositoryFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await visit(root);
  return files.sort();
}

export async function scanRepository(root) {
  const findings = [];
  for (const path of await repositoryFiles(root)) {
    const content = await readFile(path);
    if (content.subarray(0, 8192).includes(0)) continue;
    findings.push(...scanSensitiveText(relative(root, path).replaceAll("\\", "/"), content.toString("utf8")));
  }
  return findings;
}
