export const conformanceComparisonSchemaVersion = "1.0";

function rounded(value, places = 4) {
  return Number(value.toFixed(places));
}

function validateFraction(name, value) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
}

function assertRate(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be a rate between 0 and 1`);
}

function assertReport(report, label) {
  if (!report || typeof report !== "object" || Array.isArray(report)) throw new Error(`${label} must be a conformance report object`);
  if (report.schemaVersion !== "1.0") throw new Error(`${label} uses an unsupported conformance schema version`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(report.workflow?.slug ?? "") || !/^\d+\.\d+\.\d+$/.test(report.workflow?.policyVersion ?? "") || !/^sha256:[a-f0-9]{64}$/.test(report.workflow?.fingerprint ?? "")) {
    throw new Error(`${label} has invalid workflow identity`);
  }
  if (report.privacy?.rawPayloadsIncluded !== false || report.privacy?.requestIdentifiersIncluded !== false) {
    throw new Error(`${label} is not an aggregate-only conformance report`);
  }
  if (!Number.isInteger(report.sample?.total) || report.sample.total < 1) throw new Error(`${label} has an invalid sample size`);
  assertRate(report.sample.invalidRate, `${label} invalidRate`);
  if (!Array.isArray(report.outcomes?.priorityBands) || !Array.isArray(report.outcomes?.decisions) || !Array.isArray(report.rules?.counts)) {
    throw new Error(`${label} is missing outcome or rule aggregates`);
  }
  if (typeof report.mapping?.enabled !== "boolean") throw new Error(`${label} is missing mapping identity`);
  if (report.mapping.enabled && !/^sha256:[a-f0-9]{64}$/.test(report.mapping.fingerprint ?? "")) {
    throw new Error(`${label} has an invalid mapping fingerprint`);
  }
}

function indexRates(items, key) {
  const indexed = new Map();
  for (const item of items ?? []) {
    if (typeof item?.[key] !== "string" || indexed.has(item[key])) throw new Error(`Invalid or duplicate aggregate key: ${key}`);
    assertRate(item.rate, `${key} ${item[key]}`);
    indexed.set(item[key], item);
  }
  return indexed;
}

function compareRates(baselineItems, currentItems, key, metadata = []) {
  const baseline = indexRates(baselineItems, key);
  const current = indexRates(currentItems, key);
  return [...new Set([...baseline.keys(), ...current.keys()])]
    .sort()
    .map((name) => {
      const before = baseline.get(name);
      const after = current.get(name);
      const baselineRate = before?.rate ?? 0;
      const currentRate = after?.rate ?? 0;
      const delta = rounded(currentRate - baselineRate);
      return {
        [key]: name,
        ...Object.fromEntries(metadata.map((field) => [field, after?.[field] ?? before?.[field]])),
        baselineRate,
        currentRate,
        delta,
        absoluteDelta: rounded(Math.abs(delta))
      };
    })
    .sort((left, right) => right.absoluteDelta - left.absoluteDelta || String(left[key]).localeCompare(String(right[key])));
}

function maxDelta(rows) {
  return rows.length ? Math.max(...rows.map((row) => row.absoluteDelta)) : 0;
}

function keyedErrors(items) {
  return (items ?? []).map((item) => ({ ...item, key: `${item.field}:${item.code}` }));
}

function scoreDelta(baseline, current, field) {
  if (!baseline || !current) return null;
  return rounded(current[field] - baseline[field], 2);
}

function normalizeGates(gates = {}) {
  validateFraction("maxInvalidRateIncrease", gates.maxInvalidRateIncrease);
  validateFraction("maxBandRateDelta", gates.maxBandRateDelta);
  validateFraction("maxRuleRateDelta", gates.maxRuleRateDelta);
  if (gates.maxAverageScoreDelta !== undefined && (!Number.isFinite(gates.maxAverageScoreDelta) || gates.maxAverageScoreDelta < 0 || gates.maxAverageScoreDelta > 100)) {
    throw new Error("maxAverageScoreDelta must be between 0 and 100");
  }
  if (gates.minCurrentRecords !== undefined && (!Number.isInteger(gates.minCurrentRecords) || gates.minCurrentRecords < 1)) {
    throw new Error("minCurrentRecords must be a positive integer");
  }
  return gates;
}

export function compareConformanceReports({ baseline, current, gates }) {
  assertReport(baseline, "Baseline");
  assertReport(current, "Current report");
  if (baseline.workflow.slug !== current.workflow.slug) throw new Error("Reports must describe the same workflow");
  if (baseline.workflow.policyVersion !== current.workflow.policyVersion || baseline.workflow.fingerprint !== current.workflow.fingerprint) {
    throw new Error("Reports must use the same policy version and fingerprint; use the policy impact report for policy changes");
  }
  if (baseline.mapping.enabled !== current.mapping.enabled) throw new Error("Reports must use the same mapping mode");
  if (baseline.mapping.enabled && baseline.mapping.fingerprint !== current.mapping.fingerprint) {
    throw new Error("Reports must use the same mapping fingerprint");
  }
  const normalizedGates = normalizeGates(gates);
  const priorityBands = compareRates(baseline.outcomes.priorityBands, current.outcomes.priorityBands, "band");
  const decisions = compareRates(baseline.outcomes.decisions, current.outcomes.decisions, "decision");
  const rules = compareRates(baseline.rules.counts, current.rules.counts, "ruleId", ["field"]);
  const contractViolations = compareRates(keyedErrors(baseline.violations?.counts), keyedErrors(current.violations?.counts), "key", ["field", "code"]);
  const mappingErrors = compareRates(keyedErrors(baseline.mapping.errors?.counts), keyedErrors(current.mapping.errors?.counts), "key", ["field", "code"]);
  const invalidRateDelta = rounded(current.sample.invalidRate - baseline.sample.invalidRate);
  const averageScoreDelta = scoreDelta(baseline.scores, current.scores, "average");
  const gateResults = [];
  if (normalizedGates.minCurrentRecords !== undefined) {
    gateResults.push({ gate: "minCurrentRecords", expected: normalizedGates.minCurrentRecords, actual: current.sample.total, passed: current.sample.total >= normalizedGates.minCurrentRecords });
  }
  if (normalizedGates.maxInvalidRateIncrease !== undefined) {
    gateResults.push({ gate: "maxInvalidRateIncrease", expected: normalizedGates.maxInvalidRateIncrease, actual: invalidRateDelta, passed: invalidRateDelta <= normalizedGates.maxInvalidRateIncrease });
  }
  if (normalizedGates.maxBandRateDelta !== undefined) {
    const actual = maxDelta(priorityBands);
    gateResults.push({ gate: "maxBandRateDelta", expected: normalizedGates.maxBandRateDelta, actual, passed: actual <= normalizedGates.maxBandRateDelta });
  }
  if (normalizedGates.maxRuleRateDelta !== undefined) {
    const actual = maxDelta(rules);
    gateResults.push({ gate: "maxRuleRateDelta", expected: normalizedGates.maxRuleRateDelta, actual, passed: actual <= normalizedGates.maxRuleRateDelta });
  }
  if (normalizedGates.maxAverageScoreDelta !== undefined) {
    const actual = averageScoreDelta === null ? null : rounded(Math.abs(averageScoreDelta), 2);
    gateResults.push({ gate: "maxAverageScoreDelta", expected: normalizedGates.maxAverageScoreDelta, actual, passed: actual !== null && actual <= normalizedGates.maxAverageScoreDelta });
  }

  return {
    schemaVersion: conformanceComparisonSchemaVersion,
    workflow: {
      slug: current.workflow.slug,
      policyVersion: current.workflow.policyVersion,
      policyFingerprint: current.workflow.fingerprint,
      mappingFingerprint: current.mapping.enabled ? current.mapping.fingerprint : null
    },
    privacy: { mode: "aggregate-only", rawPayloadsIncluded: false, requestIdentifiersIncluded: false },
    sample: {
      baseline: baseline.sample.total,
      current: current.sample.total,
      baselineInvalidRate: baseline.sample.invalidRate,
      currentInvalidRate: current.sample.invalidRate,
      invalidRateDelta
    },
    scores: {
      baseline: baseline.scores,
      current: current.scores,
      averageDelta: averageScoreDelta,
      p50Delta: scoreDelta(baseline.scores, current.scores, "p50"),
      p95Delta: scoreDelta(baseline.scores, current.scores, "p95")
    },
    priorityBands,
    decisions,
    rules,
    contractViolations,
    mappingErrors,
    gates: gateResults,
    passed: gateResults.every((gate) => gate.passed),
    interpretation: "Rate deltas are absolute percentage-point changes between aggregate samples. They are monitoring signals, not statistical or causal proof."
  };
}

function percent(value) {
  return `${rounded(value * 100, 2)}%`;
}

function signedPercent(value) {
  return `${value > 0 ? "+" : ""}${percent(value)}`;
}

function safeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
}

function rateRows(rows, key, label) {
  if (!rows.length) return "| — | 0% | 0% | 0% |";
  return rows.map((row) => `| ${label === "code" ? `\`${safeCell(row[key])}\`` : safeCell(row[key])} | ${percent(row.baselineRate)} | ${percent(row.currentRate)} | ${signedPercent(row.delta)} |`).join("\n");
}

function errorRows(rows) {
  if (!rows.length) return "| — | — | 0% | 0% | 0% |";
  return rows.map((row) => `| \`${safeCell(row.field)}\` | \`${safeCell(row.code)}\` | ${percent(row.baselineRate)} | ${percent(row.currentRate)} | ${signedPercent(row.delta)} |`).join("\n");
}

export function renderConformanceComparison(report) {
  const gates = report.gates.length
    ? report.gates.map((gate) => `| \`${gate.gate}\` | ${JSON.stringify(gate.expected)} | ${JSON.stringify(gate.actual)} | ${gate.passed ? "PASS" : "FAIL"} |`).join("\n")
    : "| — | — | — | No gates configured |";
  return `# Conformance drift: ${report.workflow.slug}

- Policy: \`${report.workflow.policyVersion}\` (${report.workflow.policyFingerprint})
- Mapping: ${report.workflow.mappingFingerprint ? `\`${report.workflow.mappingFingerprint}\`` : "not applied"}
- Privacy mode: aggregate-only
- Gate result: **${report.passed ? "PASS" : "FAIL"}**

## Sample and score movement

| Metric | Baseline | Current | Delta |
| --- | ---: | ---: | ---: |
| Records | ${report.sample.baseline} | ${report.sample.current} | ${report.sample.current - report.sample.baseline} |
| Invalid rate | ${percent(report.sample.baselineInvalidRate)} | ${percent(report.sample.currentInvalidRate)} | ${signedPercent(report.sample.invalidRateDelta)} |
| Average score | ${report.scores.baseline?.average ?? "—"} | ${report.scores.current?.average ?? "—"} | ${report.scores.averageDelta ?? "—"} |
| p50 score | ${report.scores.baseline?.p50 ?? "—"} | ${report.scores.current?.p50 ?? "—"} | ${report.scores.p50Delta ?? "—"} |
| p95 score | ${report.scores.baseline?.p95 ?? "—"} | ${report.scores.current?.p95 ?? "—"} | ${report.scores.p95Delta ?? "—"} |

## Priority-band movement

| Band | Baseline | Current | Delta |
| --- | ---: | ---: | ---: |
${rateRows(report.priorityBands, "band", "band")}

## Decision movement

| Decision | Baseline | Current | Delta |
| --- | ---: | ---: | ---: |
${rateRows(report.decisions, "decision", "code")}

## Rule-frequency movement

| Rule | Baseline | Current | Delta |
| --- | ---: | ---: | ---: |
${rateRows(report.rules, "ruleId", "code")}

## Contract-violation movement

| Field | Code | Baseline | Current | Delta |
| --- | --- | ---: | ---: | ---: |
${errorRows(report.contractViolations)}

## Mapping-error movement

| Target field | Code | Baseline | Current | Delta |
| --- | --- | ---: | ---: | ---: |
${errorRows(report.mappingErrors)}

## Gates

| Gate | Expected | Actual | Result |
| --- | --- | --- | --- |
${gates}

> ${report.interpretation}
`;
}
