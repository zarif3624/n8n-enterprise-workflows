const dayMilliseconds = 86_400_000;

function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function daysBetween(left, right) {
  return Math.round((right.valueOf() - left.valueOf()) / dayMilliseconds);
}

export function policyLifecycleIssues(document, { catalog, policyLock }) {
  const issues = [];
  const catalogEntries = Array.isArray(catalog) ? catalog : [];
  const catalogBySlug = new Map(catalogEntries.map((entry) => [entry.slug, entry]));
  const lockBySlug = new Map((Array.isArray(policyLock?.policies) ? policyLock.policies : []).map((entry) => [entry.slug, entry]));
  const policies = Array.isArray(document?.policies) ? document.policies : [];
  const seen = new Set();
  if (document?.lifecycleVersion !== 1) issues.push("lifecycleVersion must be 1");
  if (!Array.isArray(document?.policies)) issues.push("policies must be an array");
  const slugs = policies.map((entry) => entry?.slug ?? "");
  if (JSON.stringify(slugs) !== JSON.stringify([...slugs].sort())) issues.push("policies must be sorted by slug");
  if (!Number.isInteger(document?.defaultReviewPeriodDays) || document.defaultReviewPeriodDays < 30 || document.defaultReviewPeriodDays > 365) {
    issues.push("defaultReviewPeriodDays must be an integer from 30 through 365");
  }
  if (!Number.isInteger(document?.defaultDraftApprovalDays) || document.defaultDraftApprovalDays < 1 || document.defaultDraftApprovalDays > 90) {
    issues.push("defaultDraftApprovalDays must be an integer from 1 through 90");
  }
  for (const entry of policies) {
    const label = entry?.slug ?? "<missing slug>";
    if (seen.has(label)) issues.push(`${label}: lifecycle entry is duplicated`);
    seen.add(label);
    const catalogEntry = catalogBySlug.get(label);
    const lockEntry = lockBySlug.get(label);
    if (!catalogEntry) issues.push(`${label}: lifecycle entry has no catalog policy`);
    else if (entry.owner !== catalogEntry.owner) issues.push(`${label}: lifecycle owner must match catalog owner`);
    if (!lockEntry) issues.push(`${label}: lifecycle entry has no policy-lock identity`);
    else {
      if (entry.policyVersion !== lockEntry.policyVersion) issues.push(`${label}: lifecycle policyVersion must match policy lock`);
      if (entry.fingerprint !== lockEntry.fingerprint) issues.push(`${label}: lifecycle fingerprint must match policy lock`);
    }
    if (!["draft", "active", "deprecated"].includes(entry?.status)) issues.push(`${label}: status must be draft, active, or deprecated`);
    const due = dateValue(entry?.reviewDueOn);
    if (!due) issues.push(`${label}: reviewDueOn must be a real YYYY-MM-DD date`);
    if (entry?.status === "draft") {
      const introduced = dateValue(entry.introducedOn);
      if (!introduced) issues.push(`${label}: draft policies require a real introducedOn date`);
      if (entry.lastReviewedOn !== undefined) issues.push(`${label}: draft policies cannot claim a completed owner review`);
      if (entry.deprecation !== undefined) issues.push(`${label}: draft policies cannot carry deprecation metadata`);
      if (introduced && due) {
        const period = daysBetween(introduced, due);
        if (period <= 0) issues.push(`${label}: reviewDueOn must follow introducedOn`);
        if (period > document.defaultDraftApprovalDays) issues.push(`${label}: draft approval interval exceeds ${document.defaultDraftApprovalDays} days`);
      }
    }
    if (["active", "deprecated"].includes(entry?.status)) {
      const reviewed = dateValue(entry.lastReviewedOn);
      if (!reviewed) issues.push(`${label}: ${entry.status} policies require a real lastReviewedOn date`);
      if (entry.introducedOn !== undefined) issues.push(`${label}: ${entry.status} policies must use lastReviewedOn as their review basis`);
      if (reviewed && due) {
        const period = daysBetween(reviewed, due);
        if (period <= 0) issues.push(`${label}: reviewDueOn must follow lastReviewedOn`);
        if (period > document.defaultReviewPeriodDays) issues.push(`${label}: review interval exceeds ${document.defaultReviewPeriodDays} days`);
      }
    }
    if (entry?.status === "active" && entry.deprecation !== undefined) issues.push(`${label}: active policies cannot carry deprecation metadata`);
    if (entry?.status === "deprecated") {
      const announced = dateValue(entry.deprecation?.announcedOn);
      const sunset = dateValue(entry.deprecation?.sunsetOn);
      if (!announced || !sunset) issues.push(`${label}: deprecated policies require real announcedOn and sunsetOn dates`);
      else if (daysBetween(announced, sunset) <= 0) issues.push(`${label}: sunsetOn must follow announcedOn`);
      const replacement = entry.deprecation?.replacementSlug;
      if (replacement && (!catalogBySlug.has(replacement) || replacement === label)) issues.push(`${label}: replacementSlug must identify another catalog policy`);
    }
  }
  for (const slug of catalogBySlug.keys()) if (!seen.has(slug)) issues.push(`${slug}: catalog policy is missing lifecycle metadata`);
  return issues;
}

export function buildPolicyLifecycleReport(document, { asOf }) {
  const asOfDate = dateValue(asOf);
  if (!asOfDate) throw new Error("asOf must be a real YYYY-MM-DD date");
  const policies = document.policies.map((entry) => {
    const daysUntilReview = daysBetween(asOfDate, dateValue(entry.reviewDueOn));
    const reviewState = daysUntilReview < 0 ? "overdue" : daysUntilReview <= 30 ? "due-soon" : "current";
    return { ...entry, daysUntilReview, reviewState };
  });
  return {
    lifecycleVersion: document.lifecycleVersion,
    asOf,
    summary: {
      policyCount: policies.length,
      draft: policies.filter((entry) => entry.status === "draft").length,
      active: policies.filter((entry) => entry.status === "active").length,
      deprecated: policies.filter((entry) => entry.status === "deprecated").length,
      current: policies.filter((entry) => entry.reviewState === "current").length,
      dueSoon: policies.filter((entry) => entry.reviewState === "due-soon").length,
      overdue: policies.filter((entry) => entry.reviewState === "overdue").length
    },
    policies
  };
}

export function renderPolicyLifecycleReport(report) {
  const lines = [
    "# Policy lifecycle report",
    "",
    `As of \`${report.asOf}\`: ${report.summary.policyCount} policies; ${report.summary.draft} draft, ${report.summary.active} active, ${report.summary.deprecated} deprecated; ${report.summary.current} current, ${report.summary.dueSoon} due soon, ${report.summary.overdue} overdue.`,
    "",
    "| Policy | Owner | Status | Review basis | Review due | Review state |",
    "| --- | --- | --- | --- | --- | --- |"
  ];
  for (const entry of report.policies) {
    lines.push(`| ${entry.slug} | ${entry.owner} | ${entry.status} | ${entry.lastReviewedOn ?? entry.introducedOn} | ${entry.reviewDueOn} | ${entry.reviewState} (${entry.daysUntilReview} days) |`);
  }
  return `${lines.join("\n")}\n`;
}
