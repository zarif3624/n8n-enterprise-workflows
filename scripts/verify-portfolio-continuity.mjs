import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function publicWorkflows(portfolio) {
  return Array.isArray(portfolio?.publicWorkflows) ? portfolio.publicWorkflows : [];
}

function identity(workflow) {
  return `${workflow.department}/${workflow.slug}`;
}

export function portfolioContinuityIssues({ basePortfolio, candidatePortfolio, approvedRemovalIdentities = [] } = {}) {
  const candidateIdentities = new Set(publicWorkflows(candidatePortfolio).map(identity));
  const approvedIdentities = new Set(Array.isArray(approvedRemovalIdentities) ? approvedRemovalIdentities : []);
  const issues = [];

  for (const workflow of publicWorkflows(basePortfolio)) {
    const workflowIdentity = identity(workflow);
    if (!candidateIdentities.has(workflowIdentity) && !approvedIdentities.has(workflowIdentity)) {
      issues.push(`${workflowIdentity}: public workflow removal requires external approval`);
    }
  }
  return issues.sort();
}

function printHelp(stream = process.stdout) {
  stream.write("Usage: npm run portfolio:continuity -- --base <trusted-portfolio.json> [--candidate <portfolio.json>] [--approved-removals <approved-identities.json>]\n");
}

function parseArgs(args) {
  const parsed = { candidate: "portfolio.json" };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (!["--base", "--candidate", "--approved-removals"].includes(argument) || !args[index + 1]) return { error: `Unknown or incomplete argument: ${argument}` };
    parsed[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = args[index + 1];
    index += 1;
  }
  return parsed.base ? parsed : { error: "--base is required" };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
  } else if (parsed.error) {
    process.stderr.write(`${parsed.error}\n`);
    printHelp(process.stderr);
    process.exitCode = 1;
  } else {
    try {
      const [basePortfolio, candidatePortfolio, approvedRemovalIdentities] = await Promise.all([
        readJson(parsed.base),
        readJson(parsed.candidate),
        parsed.approvedRemovals ? readJson(parsed.approvedRemovals) : []
      ]);
      const issues = portfolioContinuityIssues({ basePortfolio, candidatePortfolio, approvedRemovalIdentities });
      if (issues.length) {
        process.stderr.write(`Portfolio continuity verification failed with ${issues.length} issue(s):\n${issues.map((issue) => `- ${issue}`).join("\n")}\n`);
        process.exitCode = 2;
      } else {
        process.stdout.write("Verified public workflow continuity against the supplied trusted base.\n");
      }
    } catch {
      process.stderr.write("Portfolio continuity verification could not read a required portfolio document.\n");
      process.exitCode = 1;
    }
  }
}
