import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([".git", "node_modules"]);
const markdownFiles = [];
const errors = [];

async function discover(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await discover(path);
    else if (entry.name.endsWith(".md")) markdownFiles.push(path);
  }
}

await discover(root);

for (const markdownPath of markdownFiles) {
  const markdown = await readFile(markdownPath, "utf8");
  const contaminatedJsonCommand = markdown.match(/npm run (?!--silent\b)[^`\n]*--json\b/);
  if (contaminatedJsonCommand) {
    errors.push(`${markdownPath}: machine JSON command must use npm run --silent: ${contaminatedJsonCommand[0]}`);
  }
  const links = markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (!rawTarget || rawTarget.startsWith("#") || /^(?:https?:|mailto:)/i.test(rawTarget)) continue;
    const targetWithoutAnchor = decodeURIComponent(rawTarget.split("#")[0]);
    const target = resolve(dirname(markdownPath), targetWithoutAnchor);
    if (!target.startsWith(root)) {
      errors.push(`${markdownPath}: link escapes the repository: ${rawTarget}`);
      continue;
    }
    try {
      await access(target);
    } catch {
      errors.push(`${markdownPath}: missing relative link target: ${rawTarget}`);
    }
  }
}

if (errors.length) {
  console.error(`Link validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated relative links across ${markdownFiles.length} Markdown files.`);
