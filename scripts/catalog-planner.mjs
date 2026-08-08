function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function contains(value, query) {
  return normalize(value).includes(normalize(query));
}

export function searchCatalog(catalog, query = "", { department, adapter } = {}) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const departmentFilter = normalize(department);
  const adapterFilter = normalize(adapter);
  return catalog
    .filter((entry) => !departmentFilter || contains(entry.department, departmentFilter))
    .filter((entry) => !adapterFilter || entry.adapters.some((value) => contains(value, adapterFilter)))
    .map((entry) => {
      const fields = {
        slug: normalize(entry.slug),
        department: normalize(entry.department),
        name: normalize(entry.name),
        adapters: normalize(entry.adapters.join(" ")),
        context: normalize([entry.summary, entry.outcome, entry.owner, entry.metric].join(" "))
      };
      let score = normalize(query) === fields.slug || normalize(query) === fields.name ? 100 : 0;
      for (const token of tokens) {
        const tokenScore = fields.slug.includes(token) ? 15
          : fields.department.includes(token) ? 12
            : fields.name.includes(token) ? 10
              : fields.adapters.includes(token) ? 8
                : fields.context.includes(token) ? 3
                  : 0;
        if (tokenScore === 0) return null;
        score += tokenScore;
      }
      return { entry, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || compareText(left.entry.slug, right.entry.slug))
    .map(({ entry }) => entry);
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderCatalogTable(entries) {
  if (!entries.length) return "No workflows matched.\n";
  const lines = [
    "| Department | Workflow | Owner | Typical adapters |",
    "| --- | --- | --- | --- |"
  ];
  for (const entry of entries) {
    lines.push(`| ${escapeCell(entry.department)} | ${escapeCell(entry.slug)} | ${escapeCell(entry.owner)} | ${escapeCell(entry.adapters.join(", "))} |`);
  }
  return `${lines.join("\n")}\n`;
}

function ruleId(rule, index) {
  return rule.id ?? `${rule.field}_${rule.operator}_${index + 1}`;
}

export function workflowDetail(entry, snapshot) {
  const policy = snapshot.policies.find((candidate) => candidate.slug === entry.slug);
  if (!policy) throw new Error(`Policy snapshot is missing ${entry.slug}`);
  const required = new Set(entry.inputSchema.required);
  return {
    schemaVersion: entry.schemaVersion,
    policyVersion: entry.policyVersion,
    policyFingerprint: policy.fingerprint,
    department: entry.department,
    slug: entry.slug,
    name: entry.name,
    summary: entry.summary,
    outcome: entry.outcome,
    owner: entry.owner,
    metric: entry.metric,
    roiModel: entry.roiModel,
    endpoint: entry.endpoint,
    path: entry.path,
    adapters: entry.adapters,
    fields: Object.entries(entry.inputSchema.properties).map(([field, contract]) => ({
      field,
      required: required.has(field),
      contract
    })),
    rules: policy.behavior.rules.map((rule, index) => ({ id: ruleId(rule, index), ...rule })),
    decisions: policy.behavior.decisions,
    thresholds: policy.behavior.thresholds,
    actions: policy.behavior.actions,
    hardGateCount: policy.behavior.rules.filter((rule) => rule.minimumBand).length,
    examples: entry.examples
  };
}

function formatContract(contract) {
  const parts = [contract.type];
  if (contract.format) parts.push(contract.format);
  if (contract.minimum !== undefined) parts.push(`min ${contract.minimum}`);
  if (contract.maximum !== undefined) parts.push(`max ${contract.maximum}`);
  if (contract.minLength !== undefined) parts.push(`minLength ${contract.minLength}`);
  if (contract.maxLength !== undefined) parts.push(`maxLength ${contract.maxLength}`);
  if (contract.pattern) parts.push(`pattern ${contract.pattern}`);
  if (contract.enum) parts.push(`one of ${contract.enum.join(", ")}`);
  return parts.join(", ");
}

function capacityEstimate(capacity) {
  if (!capacity) return null;
  const values = [capacity.monthlyVolume, capacity.minutesSaved, capacity.hourlyCost];
  if (values.some((value) => value === undefined)) {
    throw new Error("Capacity estimate requires monthly volume, minutes saved, and hourly cost together");
  }
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Capacity estimate inputs must be non-negative finite numbers");
  }
  return {
    monthlyVolume: capacity.monthlyVolume,
    annualVolume: capacity.monthlyVolume * 12,
    minutesSaved: capacity.minutesSaved,
    hourlyCost: capacity.hourlyCost,
    annualCapacityValue: capacity.monthlyVolume * 12 * capacity.minutesSaved * capacity.hourlyCost / 60,
    caveat: "This generic estimate omits workflow-specific factors such as exception rate or conversion; it is not guaranteed cash savings. Validate assumptions with observed post-launch data."
  };
}

export function buildAdoptionPlan(detail, { adapter, capacity, fixtureOutcomes = [] } = {}) {
  const selectedAdapter = adapter?.trim() || null;
  const suggestedAdapter = selectedAdapter
    ? detail.adapters.some((candidate) => normalize(candidate) === normalize(selectedAdapter))
    : false;
  return {
    planVersion: 1,
    workflow: {
      slug: detail.slug,
      name: detail.name,
      department: detail.department,
      owner: detail.owner,
      metric: detail.metric,
      policyVersion: detail.policyVersion,
      policyFingerprint: detail.policyFingerprint,
      endpoint: detail.endpoint,
      importFile: `${detail.path}/workflow.json`
    },
    adapter: {
      selected: selectedAdapter,
      listedAsTypical: suggestedAdapter,
      suggestions: detail.adapters
    },
    fieldMappings: detail.fields.map((field) => ({
      field: field.field,
      required: field.required,
      contract: formatContract(field.contract),
      source: "<map source field>",
      dataClassification: "<classify>",
      owner: "<assign>"
    })),
    policyReview: {
      thresholds: detail.thresholds,
      decisions: detail.decisions,
      ruleCount: detail.rules.length,
      hardGateCount: detail.hardGateCount,
      requiredApprover: detail.owner
    },
    fixtureOutcomes,
    verificationCommands: [
      `npm run evaluate -- ${detail.slug} ${detail.examples.lowRisk}`,
      `npm run evaluate -- ${detail.slug} ${detail.examples.highRisk}`,
      `npm run evaluate -- ${detail.slug} ${detail.examples.invalid}`
    ],
    mappingCommands: [
      `npm run mapping -- init ${detail.slug} > ${detail.slug}.mapping.json`,
      `npm run mapping -- check ${detail.slug}.mapping.json`
    ],
    conformanceCommand: `npm run conformance -- ${detail.slug} ./sanitized-records.jsonl --mapping ${detail.slug}.mapping.json --min-records 100 --max-invalid-rate 0.02 --min-rule-coverage 0.8`,
    rolloutGates: [
      { gate: "Policy approval", evidence: `Owner ${detail.owner} approves rules, thresholds, hard gates, decisions, and policy fingerprint.` },
      { gate: "Data mapping", evidence: "Every required and policy-relevant field has a typed source, classification, owner, and invalid-data path." },
      { gate: "Authentication", evidence: "The production webhook uses an approved built-in credential plus upstream authorization or allowlisting." },
      { gate: "Side-effect safety", evidence: "Credentials are least privilege; consequential writes require human approval; retries are idempotent." },
      { gate: "Failure handling", evidence: "External-node error outputs, timeout behavior, private alerts, sanitized 5xx responses, and rollback are tested." },
      { gate: "User acceptance", evidence: "Low-risk, high-risk, invalid, duplicate, timeout, downstream-failure, and aggregate batch-conformance evidence is retained." },
      { gate: "Promotion", evidence: "A reviewed version is published through environment promotion; the original inactive export is the rollback point." }
    ],
    observability: [
      "Propagate X-Request-Id through every downstream record and alert.",
      "Track 2xx, 4xx, 5xx, latency, timeout, retry, and duplicate rates.",
      "Monitor decision-band distribution and unexpected rule-frequency shifts.",
      "Compare fingerprint-matched aggregate conformance reports against the approved UAT baseline.",
      `Measure ${detail.metric} against a pre-launch baseline.`,
      "Review false positives, false negatives, and overrides with the policy owner."
    ],
    roi: {
      sourceModel: detail.roiModel,
      capacityEstimate: capacityEstimate(capacity)
    }
  };
}

export function renderWorkflowDetail(detail) {
  const lines = [
    `# ${detail.name}`,
    "",
    detail.summary,
    "",
    `- Slug: \`${detail.slug}\``,
    `- Department: ${detail.department}`,
    `- Owner: ${detail.owner}`,
    `- Metric: ${detail.metric}`,
    `- Policy: \`${detail.policyVersion}\` (${detail.policyFingerprint})`,
    `- Endpoint: \`${detail.endpoint}\``,
    `- Typical adapters: ${detail.adapters.join(", ")}`,
    "",
    "## Decisions",
    "",
    `- Low (<${detail.thresholds.medium}): \`${detail.decisions.low}\``,
    `- Medium (${detail.thresholds.medium}-${detail.thresholds.high - 1}): \`${detail.decisions.medium}\``,
    `- High (${detail.thresholds.high}+): \`${detail.decisions.high}\``,
    "",
    "## Fields",
    "",
    "| Field | Required | Contract |",
    "| --- | --- | --- |",
    ...detail.fields.map((field) => `| ${field.field} | ${field.required ? "yes" : "no"} | ${escapeCell(formatContract(field.contract))} |`),
    "",
    "## Rules",
    "",
    "| Rule | Points | Floor | Reason |",
    "| --- | ---: | --- | --- |",
    ...detail.rules.map((rule) => `| ${rule.id} | ${rule.points} | ${rule.minimumBand ?? "—"} | ${escapeCell(rule.reason)} |`),
    ""
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderAdoptionPlan(plan) {
  const selected = plan.adapter.selected
    ? `${plan.adapter.selected}${plan.adapter.listedAsTypical ? " (catalog suggestion)" : " (custom selection)"}`
    : "<choose an approved adapter>";
  const lines = [
    `# Adoption plan: ${plan.workflow.name}`,
    "",
    `- Business owner: ${plan.workflow.owner}`,
    `- Success metric: ${plan.workflow.metric}`,
    `- Policy identity: \`${plan.workflow.policyVersion}\` / \`${plan.workflow.policyFingerprint}\``,
    `- Import file: \`${plan.workflow.importFile}\``,
    `- Selected adapter: ${selected}`,
    `- Other typical adapters: ${plan.adapter.suggestions.join(", ")}`,
    "",
    "## Field mapping",
    "",
    "| Input | Required | Contract | Source | Classification | Owner |",
    "| --- | --- | --- | --- | --- | --- |",
    ...plan.fieldMappings.map((field) => `| ${field.field} | ${field.required ? "yes" : "no"} | ${escapeCell(field.contract)} | ${field.source} | ${field.dataClassification} | ${field.owner} |`),
    "",
    "## Policy acceptance",
    "",
    `Review ${plan.policyReview.ruleCount} rules and ${plan.policyReview.hardGateCount} hard gate(s) with ${plan.policyReview.requiredApprover}.`,
    "",
    "| Fixture | HTTP | Band | Score | Decision / error |",
    "| --- | ---: | --- | ---: | --- |",
    ...plan.fixtureOutcomes.map((outcome) => `| ${outcome.name} | ${outcome.httpStatus} | ${outcome.priorityBand ?? "—"} | ${outcome.score ?? "—"} | ${escapeCell(outcome.decision ?? outcome.error)} |`),
    "",
    "Run the same source policy locally before import:",
    "",
    "```bash",
    ...plan.verificationCommands,
    "```",
    "",
    "Create and validate a fingerprint-bound declarative mapping:",
    "",
    "```bash",
    ...plan.mappingCommands,
    "```",
    "",
    "Then evaluate sanitized source-shaped records with owner-approved gates:",
    "",
    "```bash",
    plan.conformanceCommand,
    "```",
    "",
    "## Rollout gates",
    "",
    ...plan.rolloutGates.map((gate, index) => `${index + 1}. **${gate.gate}:** ${gate.evidence}`),
    "",
    "## Observability and value",
    "",
    ...plan.observability.map((item) => `- ${item}`),
    "",
    `Source ROI model: \`${plan.roi.sourceModel}\``
  ];
  if (plan.roi.capacityEstimate) {
    const estimate = plan.roi.capacityEstimate;
    lines.push(
      "",
      `Illustrative annual capacity value: **${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(estimate.annualCapacityValue)}**`,
      "",
      `${estimate.annualVolume.toLocaleString("en-US")} annual executions × ${estimate.minutesSaved} minutes × ${estimate.hourlyCost.toLocaleString("en-US", { style: "currency", currency: "USD" })} / 60. ${estimate.caveat}`
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
