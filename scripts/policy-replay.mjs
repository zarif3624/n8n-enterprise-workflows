import { evaluatePolicy } from "./policy-engine.mjs";
import { canonicalize } from "./policy-governance.mjs";

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function matchingValue(rule) {
  switch (rule.operator) {
    case "missing": return undefined;
    case "truthy": return true;
    case "falsy": return false;
    case "equals": return rule.value;
    case "includes": return [rule.value];
    case "gt": return Number(rule.value) + 1;
    case "gte": return Number(rule.value);
    case "lt": return Number(rule.value) - 1;
    default: throw new Error(`Unsupported rule operator: ${rule.operator}`);
  }
}

export function ruleWitnessCases(policy, lowRiskPayload, source) {
  return policy.rules.map((rule, index) => {
    const payload = structuredClone(lowRiskPayload);
    const value = matchingValue(rule);
    if (value === undefined) delete payload[rule.field];
    else payload[rule.field] = value;
    const ruleId = rule.id ?? `${rule.field}_${rule.operator}_${index + 1}`;
    return { labels: [`${source}:rule:${ruleId}`], payload };
  });
}

export function uniqueReplayCases(cases) {
  const byPayload = new Map();
  for (const replayCase of cases) {
    const key = JSON.stringify(canonicalize(replayCase.payload));
    const existing = byPayload.get(key);
    if (existing) existing.labels.push(...replayCase.labels);
    else byPayload.set(key, { labels: [...replayCase.labels], payload: replayCase.payload });
  }
  return [...byPayload.values()]
    .map((entry) => ({ ...entry, labels: [...new Set(entry.labels)].sort(compareText) }))
    .sort((left, right) => compareText(left.labels[0], right.labels[0]));
}

function comparableResult(result) {
  if (result.evaluationError) return result;
  if (!result.ok) {
    return {
      ok: false,
      httpStatus: result.httpStatus,
      violations: result.details?.violations?.map(({ field, code, expected }) => ({ field, code, expected })) ?? []
    };
  }
  return {
    ok: true,
    httpStatus: result.httpStatus,
    decision: result.decision,
    priorityBand: result.priorityBand,
    score: result.score,
    matchedRules: result.matchedRules,
    recommendedActions: result.recommendedActions
  };
}

function run(policy, payload) {
  try {
    return evaluatePolicy({
      policy,
      envelope: { body: payload, headers: { "x-request-id": "policy-impact-replay" } },
      executionId: "policy-impact-replay",
      evaluatedAt: "2026-01-01T00:00:00.000Z"
    });
  } catch (error) {
    return { evaluationError: error instanceof Error ? error.message : String(error) };
  }
}

export function replayPolicyImpact({ before, after, cases }) {
  const uniqueCases = uniqueReplayCases(cases);
  const changes = [];
  for (const replayCase of uniqueCases) {
    const beforeResult = run(before, replayCase.payload);
    const afterResult = run(after, replayCase.payload);
    if (JSON.stringify(comparableResult(beforeResult)) !== JSON.stringify(comparableResult(afterResult))) {
      changes.push({ labels: replayCase.labels, before: beforeResult, after: afterResult });
    }
  }
  return { caseCount: uniqueCases.length, changes };
}

function inline(value) {
  return `\`${String(value).replaceAll("`", "\\`")}\``;
}

function list(value) {
  return value.length ? value.map(inline).join(", ") : "none";
}

function ruleSummary(result) {
  return (result.matchedRules ?? []).map((rule) => `${rule.ruleId}:${rule.points}:${rule.reason}`);
}

function violationSummary(result) {
  return (result.details?.violations ?? []).map((violation) => `${violation.field}/${violation.code}/${violation.expected ?? ""}`);
}

export function describeResultDelta(before, after) {
  if (before.evaluationError || after.evaluationError) {
    return `evaluation: ${inline(before.evaluationError ?? "ok")} → ${inline(after.evaluationError ?? "ok")}`;
  }
  const deltas = [];
  if (before.httpStatus !== after.httpStatus) deltas.push(`HTTP ${inline(before.httpStatus)} → ${inline(after.httpStatus)}`);
  if (before.priorityBand !== after.priorityBand) deltas.push(`band ${inline(before.priorityBand ?? "invalid")} → ${inline(after.priorityBand ?? "invalid")}`);
  if (before.score !== after.score) deltas.push(`score ${inline(before.score ?? "n/a")} → ${inline(after.score ?? "n/a")}`);
  if (before.decision !== after.decision) deltas.push(`decision ${inline(before.decision ?? "n/a")} → ${inline(after.decision ?? "n/a")}`);
  const beforeRules = ruleSummary(before);
  const afterRules = ruleSummary(after);
  if (JSON.stringify(beforeRules) !== JSON.stringify(afterRules)) deltas.push(`matched rules ${list(beforeRules)} → ${list(afterRules)}`);
  const beforeActions = before.recommendedActions ?? [];
  const afterActions = after.recommendedActions ?? [];
  if (JSON.stringify(beforeActions) !== JSON.stringify(afterActions)) deltas.push(`actions ${list(beforeActions)} → ${list(afterActions)}`);
  const beforeViolations = violationSummary(before);
  const afterViolations = violationSummary(after);
  if (JSON.stringify(beforeViolations) !== JSON.stringify(afterViolations)) deltas.push(`violations ${list(beforeViolations)} → ${list(afterViolations)}`);
  return deltas.join("<br>") || "Response contract changed outside the summarized fields.";
}

function tableCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderPolicyImpactReport(changeSets, { baseRef = "base", engineChanged = false, baselineMissing = false } = {}) {
  const lines = [
    "## Policy behavior replay",
    "",
    `Compared ${inline(baseRef)} with the generated working tree using representative fixtures and one isolated witness per declared rule.`,
    ""
  ];
  if (baselineMissing) {
    lines.push("No target-branch policy snapshot exists; this change establishes the behavioral replay baselines.", "");
    return `${lines.join("\n").trimEnd()}\n`;
  }
  if (engineChanged) {
    lines.push(
      "> The shared policy engine version changed. Both snapshots are replayed through the current evaluator, so this report isolates definition-level impact; live n8n compatibility evidence remains required for engine semantics.",
      ""
    );
  }
  if (!changeSets.length) {
    lines.push("No changed policy fingerprint requires behavioral replay.", "");
    return `${lines.join("\n").trimEnd()}\n`;
  }
  for (const changeSet of changeSets) {
    lines.push(`### ${changeSet.slug}`, "");
    if (changeSet.status === "added") {
      lines.push(`New policy ${inline(changeSet.afterVersion)} has no target-branch behavior to replay.`, "");
      continue;
    }
    if (changeSet.status === "removed") {
      lines.push(`Removed policy ${inline(changeSet.beforeVersion)} cannot be replayed against a current definition.`, "");
      continue;
    }
    lines.push(`${changeSet.changes.length} of ${changeSet.caseCount} replay case(s) produced a changed observable outcome.`, "");
    if (!changeSet.changes.length) {
      lines.push("No changed outcome was observed in this corpus; this is evidence, not proof of behavioral equivalence.", "");
      continue;
    }
    lines.push("| Replay case | Observed change |", "| --- | --- |");
    for (const change of changeSet.changes) {
      lines.push(`| ${tableCell(change.labels.join("<br>"))} | ${tableCell(describeResultDelta(change.before, change.after))} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
