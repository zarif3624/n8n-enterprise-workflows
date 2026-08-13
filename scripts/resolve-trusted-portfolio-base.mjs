import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const zeroRevision = "0".repeat(40);

function required(value, name) {
  if (typeof value !== "string" || !value) throw new Error(`${name} is required`);
  return value;
}

export function resolveTrustedPortfolioBase({ eventName, refName, defaultBranch, baseRef, before } = {}) {
  if (eventName === "pull_request") return `origin/${required(baseRef, "baseRef")}`;
  if (eventName === "workflow_dispatch") {
    const protectedBranch = required(defaultBranch, "defaultBranch");
    return required(refName, "refName") === protectedBranch ? "HEAD^" : `origin/${protectedBranch}`;
  }
  if (eventName === "push") return !before || before === zeroRevision ? "HEAD^" : before;
  throw new Error("unsupported GitHub event");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${resolveTrustedPortfolioBase({
      eventName: process.env.GITHUB_EVENT_NAME,
      refName: process.env.GITHUB_REF_NAME,
      defaultBranch: process.env.GITHUB_DEFAULT_BRANCH,
      baseRef: process.env.GITHUB_BASE_REF,
      before: process.env.GITHUB_EVENT_BEFORE
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
