import { evaluatePolicy } from "./policy-engine.mjs";

export const conformanceSchemaVersion = "1.0";
export const defaultMaxRecords = 10_000;

function rounded(value, places = 4) {
  return Number(value.toFixed(places));
}

function rate(count, total) {
  return total === 0 ? 0 : rounded(count / total);
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function entriesByCount(map, makeEntry) {
  return [...map.entries()]
    .map(([key, count]) => makeEntry(key, count))
    .sort((left, right) => right.count - left.count || JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

function ruleId(rule, index) {
  return rule.id ?? `${rule.field}_${rule.operator}_${index + 1}`;
}

function validateFraction(name, value) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }
}

function normalizeGates(gates = {}) {
  validateFraction("maxInvalidRate", gates.maxInvalidRate);
  validateFraction("minRuleCoverage", gates.minRuleCoverage);
  if (gates.minRecords !== undefined && (!Number.isInteger(gates.minRecords) || gates.minRecords < 1)) {
    throw new Error("minRecords must be a positive integer");
  }
  const requireBands = gates.requireBands ?? [];
  if (!Array.isArray(requireBands) || requireBands.some((band) => !["low", "medium", "high"].includes(band))) {
    throw new Error("requireBands may only contain low, medium, and high");
  }
  return { ...gates, requireBands: [...new Set(requireBands)] };
}

export function parseConformanceInput(raw, { maxRecords = defaultMaxRecords } = {}) {
  if (!Number.isInteger(maxRecords) || maxRecords < 1) throw new Error("maxRecords must be a positive integer");
  const text = String(raw).trim();
  if (!text) throw new Error("Conformance input is empty");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    parsed = lines.map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON on non-empty line ${index + 1}; input values were omitted from this error`);
      }
    });
  }

  const records = Array.isArray(parsed) ? parsed : [parsed];
  if (!records.length) throw new Error("Conformance input must contain at least one record");
  if (records.length > maxRecords) {
    throw new Error(`Conformance input has ${records.length} records; the configured limit is ${maxRecords}`);
  }
  return records;
}

export function analyzeConformance({ snapshotPolicy, records, gates }) {
  if (!snapshotPolicy?.behavior || !snapshotPolicy.fingerprint) throw new Error("A complete snapshot policy is required");
  if (!Array.isArray(records) || !records.length) throw new Error("At least one conformance record is required");
  const normalizedGates = normalizeGates(gates);
  const policy = { ...snapshotPolicy.behavior, policyVersion: snapshotPolicy.policyVersion };
  const declaredRules = policy.rules.map((rule, index) => ({
    ruleId: ruleId(rule, index),
    field: rule.field
  }));
  const ruleFields = new Map(declaredRules.map((rule) => [rule.ruleId, rule.field]));
  const bandCounts = new Map([["low", 0], ["medium", 0], ["high", 0]]);
  const decisionCounts = new Map();
  const ruleCounts = new Map(declaredRules.map((rule) => [rule.ruleId, 0]));
  const violationCounts = new Map();
  const scores = [];
  let valid = 0;
  let invalid = 0;
  let violationTotal = 0;

  records.forEach((record, index) => {
    const result = evaluatePolicy({
      policy,
      envelope: { body: record, headers: { "x-request-id": `conformance-${index + 1}` } },
      executionId: `conformance-${index + 1}`,
      evaluatedAt: "1970-01-01T00:00:00.000Z"
    });
    if (result.ok) {
      valid += 1;
      scores.push(result.score);
      increment(bandCounts, result.priorityBand);
      increment(decisionCounts, result.decision);
      for (const rule of result.matchedRules) increment(ruleCounts, rule.ruleId);
      return;
    }
    invalid += 1;
    for (const violation of result.details?.violations ?? []) {
      violationTotal += 1;
      increment(violationCounts, JSON.stringify([violation.field, violation.code]));
    }
  });

  scores.sort((left, right) => left - right);
  const total = records.length;
  const observedRules = [...ruleCounts.values()].filter((count) => count > 0).length;
  const ruleCoverage = rate(observedRules, declaredRules.length);
  const invalidRate = rate(invalid, total);
  const observedBands = [...bandCounts.entries()].filter(([, count]) => count > 0).map(([band]) => band);
  const gateResults = [];
  if (normalizedGates.minRecords !== undefined) {
    gateResults.push({ gate: "minRecords", expected: normalizedGates.minRecords, actual: total, passed: total >= normalizedGates.minRecords });
  }
  if (normalizedGates.maxInvalidRate !== undefined) {
    gateResults.push({ gate: "maxInvalidRate", expected: normalizedGates.maxInvalidRate, actual: invalidRate, passed: invalidRate <= normalizedGates.maxInvalidRate });
  }
  if (normalizedGates.minRuleCoverage !== undefined) {
    gateResults.push({ gate: "minRuleCoverage", expected: normalizedGates.minRuleCoverage, actual: ruleCoverage, passed: ruleCoverage >= normalizedGates.minRuleCoverage });
  }
  if (normalizedGates.requireBands.length) {
    const missing = normalizedGates.requireBands.filter((band) => !observedBands.includes(band));
    gateResults.push({ gate: "requireBands", expected: normalizedGates.requireBands, actual: observedBands, missing, passed: missing.length === 0 });
  }

  return {
    schemaVersion: conformanceSchemaVersion,
    workflow: {
      slug: snapshotPolicy.slug,
      department: snapshotPolicy.department,
      owner: snapshotPolicy.owner,
      policyVersion: snapshotPolicy.policyVersion,
      policyEngineVersion: policy.policyEngineVersion,
      fingerprint: snapshotPolicy.fingerprint
    },
    privacy: {
      mode: "aggregate-only",
      rawPayloadsIncluded: false,
      requestIdentifiersIncluded: false
    },
    sample: { total, valid, invalid, invalidRate },
    outcomes: {
      priorityBands: [...bandCounts.entries()].map(([band, count]) => ({ band, count, rate: rate(count, valid) })),
      decisions: entriesByCount(decisionCounts, (decision, count) => ({ decision, count, rate: rate(count, valid) }))
    },
    scores: scores.length
      ? {
          count: scores.length,
          min: scores[0],
          max: scores.at(-1),
          average: rounded(scores.reduce((sum, score) => sum + score, 0) / scores.length, 2),
          p50: percentile(scores, 0.5),
          p95: percentile(scores, 0.95)
        }
      : null,
    rules: {
      total: declaredRules.length,
      observed: observedRules,
      coverageRate: ruleCoverage,
      unobservedRuleIds: declaredRules.filter((rule) => ruleCounts.get(rule.ruleId) === 0).map((rule) => rule.ruleId),
      counts: entriesByCount(ruleCounts, (id, count) => ({ ruleId: id, field: ruleFields.get(id), count, rate: rate(count, valid) }))
    },
    violations: {
      total: violationTotal,
      counts: entriesByCount(violationCounts, (key, count) => {
        const [field, code] = JSON.parse(key);
        return { field, code, count, rate: rate(count, invalid) };
      })
    },
    gates: gateResults,
    passed: gateResults.every((gate) => gate.passed)
  };
}

function percent(value) {
  return `${rounded(value * 100, 2)}%`;
}

function tableOrNone(rows, emptyText) {
  return rows.length ? rows.join("\n") : emptyText;
}

export function renderConformanceReport(report) {
  const bands = report.outcomes.priorityBands.map((item) => `| ${item.band} | ${item.count} | ${percent(item.rate)} |`);
  const rules = report.rules.counts.map((item) => `| \`${item.ruleId}\` | \`${item.field}\` | ${item.count} | ${percent(item.rate)} |`);
  const violations = report.violations.counts.map((item) => `| \`${item.field}\` | \`${item.code}\` | ${item.count} | ${percent(item.rate)} |`);
  const gates = report.gates.map((gate) => `| \`${gate.gate}\` | ${JSON.stringify(gate.expected)} | ${JSON.stringify(gate.actual)} | ${gate.passed ? "PASS" : "FAIL"} |`);
  const scoreSummary = report.scores
    ? `min ${report.scores.min}, average ${report.scores.average}, p50 ${report.scores.p50}, p95 ${report.scores.p95}, max ${report.scores.max}`
    : "No valid records";

  return `# Conformance report: ${report.workflow.slug}

- Policy: \`${report.workflow.policyVersion}\` (${report.workflow.fingerprint})
- Owner: ${report.workflow.owner}
- Privacy mode: aggregate-only; raw payloads and request identifiers are not included
- Gate result: **${report.passed ? "PASS" : "FAIL"}**

## Sample

| Total | Valid | Invalid | Invalid rate | Rule coverage |
| ---: | ---: | ---: | ---: | ---: |
| ${report.sample.total} | ${report.sample.valid} | ${report.sample.invalid} | ${percent(report.sample.invalidRate)} | ${percent(report.rules.coverageRate)} |

Score distribution: ${scoreSummary}.

## Priority bands

| Band | Count | Rate of valid records |
| --- | ---: | ---: |
${bands.join("\n")}

## Rule exercise

| Rule | Field | Matches | Rate of valid records |
| --- | --- | ---: | ---: |
${rules.join("\n")}

Unobserved rules: ${report.rules.unobservedRuleIds.length ? report.rules.unobservedRuleIds.map((id) => `\`${id}\``).join(", ") : "none"}.

## Contract violations

| Field | Code | Occurrences | Rate of invalid records |
| --- | --- | ---: | ---: |
${tableOrNone(violations, "| — | — | 0 | 0% |")}

## Gates

| Gate | Expected | Actual | Result |
| --- | --- | --- | --- |
${tableOrNone(gates, "| — | — | — | No gates configured |")}
`;
}
