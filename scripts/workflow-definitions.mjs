export const workflows = [
  {
    department: "finance",
    slug: "invoice-exception-triage",
    policyVersion: "1.0.7",
    name: "Triage enterprise invoice exceptions",
    summary: "Scores invoice exceptions and routes clean invoices, finance reviews, and payment holds through a consistent policy.",
    problem: "Accounts payable teams lose time manually interpreting missing purchase orders, duplicate invoices, amount mismatches, and risky vendors.",
    outcome: "A structured decision with a risk score, matched policy reasons, and the next recommended action.",
    owner: "Accounts Payable Operations",
    primaryMetric: "Minutes of manual review avoided per invoice",
    required: ["invoiceId", "vendorId", "amount", "currency"],
    optional: ["purchaseOrderId", "duplicateDetected", "amountMismatchPercent", "restrictedVendor", "newBankDetails"],
    fieldContracts: {
      invoiceId: { type: "string", minLength: 1, maxLength: 500 },
      vendorId: { type: "string", minLength: 1, maxLength: 500 },
      amount: { type: "number", minimum: 0 },
      currency: { type: "string", pattern: "^[A-Z]{3}$", minLength: 3, maxLength: 3 },
      purchaseOrderId: { type: "string", minLength: 1, maxLength: 500 },
      duplicateDetected: { type: "boolean" },
      amountMismatchPercent: { type: "number", minimum: 0, maximum: 100 },
      restrictedVendor: { type: "boolean" },
      newBankDetails: { type: "boolean" }
    },
    rules: [
      { field: "purchaseOrderId", operator: "missing", points: 25, reason: "Purchase order is missing" },
      { field: "duplicateDetected", operator: "truthy", points: 50, minimumBand: "high", reason: "Potential duplicate invoice" },
      { field: "amountMismatchPercent", operator: "gt", value: 2, points: 25, reason: "Invoice and purchase order differ by more than 2%" },
      { field: "restrictedVendor", operator: "truthy", points: 60, minimumBand: "high", reason: "Vendor appears on a restricted list" },
      { field: "newBankDetails", operator: "truthy", points: 35, reason: "Payment destination changed" }
    ],
    decisions: { low: "continue_standard_processing", medium: "route_to_finance_review", high: "hold_payment_and_escalate" },
    actions: ["Persist the decision in the ERP or AP queue", "Require human approval for payment holds", "Notify the invoice owner with matched policy reasons"],
    roiExample: "monthly invoice volume x exception rate x minutes saved x loaded hourly cost / 60"
  },
  {
    department: "information-technology",
    slug: "service-desk-priority-routing",
    policyVersion: "1.0.7",
    name: "Route enterprise service desk incidents",
    summary: "Assigns incident priority from impact, urgency, affected users, outage state, and executive visibility.",
    problem: "Inconsistent ticket priority creates noisy queues while genuinely disruptive incidents wait too long for the right team.",
    outcome: "A defensible routing decision with urgency, ownership guidance, and escalation reasons.",
    owner: "IT Service Management",
    primaryMetric: "Mean time to assignment",
    required: ["ticketId", "category", "summary", "affectedUsers"],
    optional: ["serviceDown", "securityImpact", "executiveAffected", "revenueImpact", "workaroundAvailable"],
    fieldContracts: {
      ticketId: { type: "string", minLength: 1, maxLength: 500 },
      category: { type: "string", minLength: 1, maxLength: 500 },
      summary: { type: "string", minLength: 1, maxLength: 5000 },
      affectedUsers: { type: "number", minimum: 0 },
      serviceDown: { type: "boolean" },
      securityImpact: { type: "boolean" },
      executiveAffected: { type: "boolean" },
      revenueImpact: { type: "boolean" },
      workaroundAvailable: { type: "boolean" }
    },
    rules: [
      { field: "serviceDown", operator: "truthy", points: 45, reason: "Business service is unavailable" },
      { field: "securityImpact", operator: "truthy", points: 55, reason: "Potential security impact" },
      { field: "executiveAffected", operator: "truthy", points: 15, reason: "Executive user affected" },
      { field: "revenueImpact", operator: "truthy", points: 35, reason: "Incident affects revenue operations" },
      { field: "workaroundAvailable", operator: "falsy", points: 20, reason: "No workaround is available" },
      { field: "affectedUsers", operator: "gt", value: 100, points: 30, reason: "More than 100 users affected" }
    ],
    decisions: { low: "route_standard_queue", medium: "assign_priority_support", high: "open_major_incident" },
    actions: ["Create or update the ITSM incident", "Page the on-call team for major incidents", "Start stakeholder communications with a human owner"],
    roiExample: "incidents per month x minutes faster assignment x outage cost per minute"
  },
  {
    department: "security",
    slug: "phishing-report-triage",
    policyVersion: "1.0.7",
    name: "Triage employee phishing reports",
    summary: "Scores reported messages using credential theft, attachment, impersonation, click, and campaign indicators.",
    problem: "Security teams receive large volumes of suspicious-email reports with uneven context and limited prioritization.",
    outcome: "A rapid containment recommendation without automatically taking destructive security actions.",
    owner: "Security Operations",
    primaryMetric: "Minutes from report to analyst triage",
    required: ["reportId", "reporterId", "sender", "subject"],
    optional: ["credentialRequested", "suspiciousAttachment", "executiveImpersonation", "linkClicked", "multipleRecipients"],
    fieldContracts: {
      reportId: { type: "string", minLength: 1, maxLength: 500 },
      reporterId: { type: "string", minLength: 1, maxLength: 500 },
      sender: { type: "string", minLength: 1, maxLength: 500 },
      subject: { type: "string", minLength: 1, maxLength: 500 },
      credentialRequested: { type: "boolean" },
      suspiciousAttachment: { type: "boolean" },
      executiveImpersonation: { type: "boolean" },
      linkClicked: { type: "boolean" },
      multipleRecipients: { type: "boolean" }
    },
    rules: [
      { field: "credentialRequested", operator: "truthy", points: 40, reason: "Message requests credentials" },
      { field: "suspiciousAttachment", operator: "truthy", points: 35, reason: "Suspicious attachment present" },
      { field: "executiveImpersonation", operator: "truthy", points: 30, reason: "Executive impersonation detected" },
      { field: "linkClicked", operator: "truthy", points: 55, minimumBand: "high", reason: "A user clicked the reported link" },
      { field: "multipleRecipients", operator: "truthy", points: 25, reason: "Possible campaign affects multiple recipients" }
    ],
    decisions: { low: "queue_analyst_review", medium: "expedite_investigation", high: "initiate_containment_review" },
    actions: ["Create a case in the security queue", "Preserve message evidence", "Require analyst approval before quarantine or account actions"],
    roiExample: "reports per month x minutes saved in initial triage x analyst hourly cost / 60"
  },
  {
    department: "engineering",
    slug: "production-change-risk-gate",
    policyVersion: "1.0.7",
    name: "Gate production changes by operational risk",
    summary: "Scores planned production changes using customer, database, rollback, peak-period, and security signals before deployment.",
    problem: "Change approvals become inconsistent when risk context is scattered across pull requests, tickets, and release conversations.",
    outcome: "An explainable release route that preserves human authority for elevated and security-relevant changes.",
    owner: "Engineering Operations",
    primaryMetric: "Change lead time without increasing failure rate",
    required: ["changeId", "service", "changeType", "plannedAt"],
    optional: ["customerImpact", "databaseMigration", "rollbackTested", "duringPeakHours", "securityRelevant"],
    fieldContracts: {
      changeId: { type: "string", minLength: 1, maxLength: 500 },
      service: { type: "string", minLength: 1, maxLength: 500 },
      changeType: { type: "string", minLength: 1, maxLength: 500 },
      plannedAt: { type: "string", format: "date-time", minLength: 1, maxLength: 64 },
      customerImpact: { type: "boolean" },
      databaseMigration: { type: "boolean" },
      rollbackTested: { type: "boolean" },
      duringPeakHours: { type: "boolean" },
      securityRelevant: { type: "boolean" }
    },
    rules: [
      { field: "customerImpact", operator: "truthy", points: 30, reason: "Change can affect customers" },
      { field: "databaseMigration", operator: "truthy", points: 25, reason: "Change includes a database migration" },
      { field: "rollbackTested", operator: "falsy", points: 45, reason: "Rollback has not been tested" },
      { field: "duringPeakHours", operator: "truthy", points: 20, reason: "Change is planned during peak hours" },
      { field: "securityRelevant", operator: "truthy", points: 45, minimumBand: "high", reason: "Change affects a security control or boundary" }
    ],
    decisions: { low: "continue_standard_change_process", medium: "require_senior_engineering_review", high: "hold_for_change_advisory_approval" },
    actions: ["Update the change record", "Attach rollback evidence", "Require an accountable approver before deployment"],
    roiExample: "monthly changes x approval minutes saved x engineering hourly cost / 60"
  },
  {
    department: "artificial-intelligence",
    slug: "agent-evaluation-release-gate",
    policyVersion: "1.0.7",
    name: "Gate agent releases with evaluation evidence",
    summary: "Reviews quality, safety, latency, cost, and evaluation coverage signals before an agent change is considered for release.",
    problem: "Agent changes can introduce quality, safety, latency, or cost regressions when release evidence is incomplete or compared inconsistently.",
    outcome: "An explainable release recommendation and evidence route that leaves release approval and deployment with the accountable owner.",
    owner: "AI Platform & SRE",
    primaryMetric: "Regression escape rate",
    required: ["evaluationRunId", "changeType", "evaluationCoveragePercent", "qualityScore"],
    optional: ["safetyRegression", "latencyRegressionPercent", "costRegressionPercent", "baselineAvailable", "exceptionRequested"],
    fieldContracts: {
      evaluationRunId: { type: "string", minLength: 1, maxLength: 500 },
      changeType: { type: "string", minLength: 1, maxLength: 200 },
      evaluationCoveragePercent: { type: "number", minimum: 0, maximum: 100 },
      qualityScore: { type: "number", minimum: 0, maximum: 100 },
      safetyRegression: { type: "boolean" },
      latencyRegressionPercent: { type: "number", minimum: 0, maximum: 1000 },
      costRegressionPercent: { type: "number", minimum: 0, maximum: 1000 },
      baselineAvailable: { type: "boolean" },
      exceptionRequested: { type: "boolean" }
    },
    rules: [
      { field: "evaluationCoveragePercent", operator: "lt", value: 90, points: 30, reason: "Evaluation coverage is below 90%" },
      { field: "qualityScore", operator: "lt", value: 80, points: 35, reason: "Quality score is below the release target" },
      { field: "safetyRegression", operator: "truthy", points: 70, minimumBand: "high", reason: "Evaluation detected a safety regression" },
      { field: "latencyRegressionPercent", operator: "gt", value: 25, points: 25, reason: "Latency regressed by more than 25%" },
      { field: "costRegressionPercent", operator: "gt", value: 25, points: 20, reason: "Unit cost regressed by more than 25%" },
      { field: "baselineAvailable", operator: "falsy", points: 40, reason: "No approved baseline is available for comparison" },
      { field: "exceptionRequested", operator: "truthy", points: 70, minimumBand: "high", reason: "Release requires an owner-approved policy exception" }
    ],
    decisions: { low: "recommend_release_candidate_for_owner_approval", medium: "route_release_evidence_to_owner_review", high: "hold_release_for_owner_exception_review" },
    actions: ["Present evaluation evidence to the release owner", "Recommend remediation for failed quality, safety, latency, or cost gates", "Keep deployment outside the starter until a release owner approves the evidence"],
    adapters: ["Evaluation service", "Model providers", "Source control", "Ticketing", "Observability"],
    roiExample: "agent releases per month x evaluation review minutes saved x engineering hourly cost / 60"
  },
  {
    department: "artificial-intelligence",
    slug: "multi-model-routing-fallback",
    policyVersion: "1.0.7",
    name: "Review multi-model routing and fallback",
    summary: "Evaluates task, policy, provider health, quality, cost, latency, and fallback evidence before recommending an approved model route.",
    problem: "Model routing can concentrate reliability risk or bypass quality and policy expectations when fallback choices are made without consistent evidence.",
    outcome: "A vendor-neutral routing recommendation with matched reasons, while policy exceptions and execution remain human-controlled.",
    owner: "AI Platform Engineering",
    primaryMetric: "Fallback rate",
    required: ["routingRequestId", "taskType", "approvedModelAvailable", "expectedQualityScore"],
    optional: ["policyException", "primaryProviderHealthy", "costBudgetExceeded", "latencyBudgetExceeded", "fallbackValidated"],
    fieldContracts: {
      routingRequestId: { type: "string", minLength: 1, maxLength: 500 },
      taskType: { type: "string", minLength: 1, maxLength: 500 },
      approvedModelAvailable: { type: "boolean" },
      expectedQualityScore: { type: "number", minimum: 0, maximum: 100 },
      policyException: { type: "boolean" },
      primaryProviderHealthy: { type: "boolean" },
      costBudgetExceeded: { type: "boolean" },
      latencyBudgetExceeded: { type: "boolean" },
      fallbackValidated: { type: "boolean" }
    },
    rules: [
      { field: "approvedModelAvailable", operator: "falsy", points: 70, minimumBand: "high", reason: "No approved model is available for the task" },
      { field: "expectedQualityScore", operator: "lt", value: 80, points: 35, reason: "Expected quality is below the routing target" },
      { field: "policyException", operator: "truthy", points: 70, minimumBand: "high", reason: "The proposed route requires a policy exception" },
      { field: "primaryProviderHealthy", operator: "falsy", points: 30, reason: "The primary provider is not healthy" },
      { field: "costBudgetExceeded", operator: "truthy", points: 25, reason: "Estimated unit cost exceeds the task budget" },
      { field: "latencyBudgetExceeded", operator: "truthy", points: 25, reason: "Estimated latency exceeds the task budget" },
      { field: "fallbackValidated", operator: "falsy", points: 40, reason: "The fallback route has not been validated" }
    ],
    decisions: { low: "recommend_approved_primary_model", medium: "recommend_approved_fallback_for_review", high: "hold_route_for_policy_exception_review" },
    actions: ["Present the recommended approved route and matched policy reasons", "Request owner review before selecting a fallback with unresolved evidence", "Keep model invocation and policy exceptions outside the starter"],
    adapters: ["Approved model providers", "Policy store", "Observability", "Cost telemetry"],
    roiExample: "monthly model tasks x routing review minutes saved x platform hourly cost / 60"
  },
  {
    department: "data-operations",
    slug: "enterprise-data-reconciliation-control",
    policyVersion: "1.0.7",
    name: "Control enterprise data reconciliation exceptions",
    summary: "Classifies cross-system variances, duplicates, missing records, ambiguous corrections, and certification evidence for review.",
    problem: "Cross-system data drift is slow to certify when material variances, duplicates, missing records, and correction authority are not evaluated consistently.",
    outcome: "A reconciliation recommendation and exception record that reserves material or ambiguous corrections for human review.",
    owner: "Data & Analytics",
    primaryMetric: "Variance rate",
    required: ["reconciliationId", "sourceRecordCount", "targetRecordCount", "varianceRatePercent"],
    optional: ["duplicateCount", "missingRecordCount", "materialVariance", "ambiguousCorrection", "certificationEvidenceComplete"],
    fieldContracts: {
      reconciliationId: { type: "string", minLength: 1, maxLength: 500 },
      sourceRecordCount: { type: "number", minimum: 0 },
      targetRecordCount: { type: "number", minimum: 0 },
      varianceRatePercent: { type: "number", minimum: 0, maximum: 100 },
      duplicateCount: { type: "number", minimum: 0 },
      missingRecordCount: { type: "number", minimum: 0 },
      materialVariance: { type: "boolean" },
      ambiguousCorrection: { type: "boolean" },
      certificationEvidenceComplete: { type: "boolean" }
    },
    rules: [
      { field: "varianceRatePercent", operator: "gt", value: 1, points: 30, reason: "Cross-system variance rate exceeds 1%" },
      { field: "duplicateCount", operator: "gt", value: 0, points: 25, reason: "Duplicate records were detected" },
      { field: "missingRecordCount", operator: "gt", value: 0, points: 30, reason: "Records are missing from one side of the reconciliation" },
      { field: "materialVariance", operator: "truthy", points: 70, minimumBand: "high", reason: "The variance is classified as material" },
      { field: "ambiguousCorrection", operator: "truthy", points: 70, minimumBand: "high", reason: "The proposed correction is ambiguous" },
      { field: "certificationEvidenceComplete", operator: "falsy", points: 40, reason: "Certification evidence is incomplete" }
    ],
    decisions: { low: "recommend_reconciliation_for_certification", medium: "route_variances_to_data_steward_review", high: "hold_corrections_for_material_exception_review" },
    actions: ["Present variance evidence to the data steward", "Recommend investigation targets without changing source records", "Keep corrections and certification outside the starter until human approval"],
    adapters: ["Databases", "Data warehouses", "Spreadsheets", "Case store", "Data quality tools"],
    roiExample: "reconciliations per month x certification minutes saved x data operations hourly cost / 60"
  },
  {
    department: "operations",
    slug: "meeting-to-action-review",
    policyVersion: "1.0.7",
    name: "Review meeting decisions and actions",
    summary: "Checks extracted decisions, owners, due dates, approved context, and proposed follow-ups before any task, message, or system update.",
    problem: "Meeting decisions and commitments are lost or misapplied when extracted actions lack owners, due dates, approved context, or review.",
    outcome: "A reviewed action package recommendation that keeps external communication and system writes behind human approval.",
    owner: "Sales & Operations",
    primaryMetric: "Follow-through rate",
    required: ["meetingId", "meetingEndedAt", "actionCount", "decisionCount"],
    optional: ["externalFollowUpDrafted", "crmUpdateProposed", "ownerMissing", "dueDateMissing", "sensitiveContent", "sourceContextApproved"],
    fieldContracts: {
      meetingId: { type: "string", minLength: 1, maxLength: 500 },
      meetingEndedAt: { type: "string", format: "date-time", minLength: 1, maxLength: 64 },
      actionCount: { type: "number", minimum: 0 },
      decisionCount: { type: "number", minimum: 0 },
      externalFollowUpDrafted: { type: "boolean" },
      crmUpdateProposed: { type: "boolean" },
      ownerMissing: { type: "boolean" },
      dueDateMissing: { type: "boolean" },
      sensitiveContent: { type: "boolean" },
      sourceContextApproved: { type: "boolean" }
    },
    rules: [
      { field: "ownerMissing", operator: "truthy", points: 35, reason: "At least one action has no accountable owner" },
      { field: "dueDateMissing", operator: "truthy", points: 25, reason: "At least one action has no due date" },
      { field: "externalFollowUpDrafted", operator: "truthy", points: 35, reason: "An external follow-up draft requires review" },
      { field: "crmUpdateProposed", operator: "truthy", points: 30, reason: "A CRM update is proposed" },
      { field: "sensitiveContent", operator: "truthy", points: 70, minimumBand: "high", reason: "The meeting record contains sensitive content" },
      { field: "sourceContextApproved", operator: "falsy", points: 45, reason: "The source context has not been approved for action extraction" }
    ],
    decisions: { low: "recommend_action_package_for_review", medium: "route_draft_actions_to_owner_review", high: "hold_follow_up_for_human_approval" },
    actions: ["Present extracted decisions, owners, and due dates for review", "Recommend corrections to incomplete action records", "Keep task creation, CRM writes, and external follow-ups outside the starter"],
    adapters: ["Calendar", "Meeting system", "Document store", "CRM", "Ticketing"],
    roiExample: "meetings per month x action-review minutes saved x operations hourly cost / 60"
  },
  {
    department: "sales",
    slug: "research-to-crm-review",
    policyVersion: "1.0.7",
    name: "Review source-backed research for CRM action",
    summary: "Evaluates entity resolution, citations, source freshness, unsupported claims, and proposed CRM or outreach actions.",
    problem: "Company and market research loses trust when signals are not source-backed or are written to CRM and outreach systems before review.",
    outcome: "A cited research brief recommendation with unsupported claims and consequential actions routed to human review.",
    owner: "Revenue & Strategy",
    primaryMetric: "Signal-to-action conversion",
    required: ["researchId", "accountId", "sourceCount", "citationCoveragePercent"],
    optional: ["unsupportedClaimCount", "entityMatchConfirmed", "sensitiveSignal", "crmWriteProposed", "outreachProposed", "sourceFreshnessDays"],
    fieldContracts: {
      researchId: { type: "string", minLength: 1, maxLength: 500 },
      accountId: { type: "string", minLength: 1, maxLength: 500 },
      sourceCount: { type: "number", minimum: 0 },
      citationCoveragePercent: { type: "number", minimum: 0, maximum: 100 },
      unsupportedClaimCount: { type: "number", minimum: 0 },
      entityMatchConfirmed: { type: "boolean" },
      sensitiveSignal: { type: "boolean" },
      crmWriteProposed: { type: "boolean" },
      outreachProposed: { type: "boolean" },
      sourceFreshnessDays: { type: "number", minimum: 0 }
    },
    rules: [
      { field: "sourceCount", operator: "lt", value: 2, points: 30, reason: "Research uses fewer than two approved sources" },
      { field: "citationCoveragePercent", operator: "lt", value: 90, points: 35, reason: "Citation coverage is below 90%" },
      { field: "unsupportedClaimCount", operator: "gt", value: 0, points: 45, reason: "The brief contains unsupported claims" },
      { field: "entityMatchConfirmed", operator: "falsy", points: 45, reason: "The account entity match is not confirmed" },
      { field: "sensitiveSignal", operator: "truthy", points: 70, minimumBand: "high", reason: "The research includes a sensitive signal" },
      { field: "crmWriteProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "A CRM write is proposed" },
      { field: "outreachProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "External outreach is proposed" },
      { field: "sourceFreshnessDays", operator: "gt", value: 30, points: 25, reason: "At least one source is older than 30 days" }
    ],
    decisions: { low: "recommend_cited_brief_for_review", medium: "route_research_gaps_to_analyst_review", high: "hold_crm_or_outreach_action_for_approval" },
    actions: ["Present citations and entity evidence to the account owner", "Recommend research gaps for analyst follow-up", "Keep CRM writes, task creation, and outreach outside the starter"],
    adapters: ["Research providers", "CRM", "Document store", "Collaboration", "Data enrichment"],
    roiExample: "research requests per month x research minutes saved x analyst hourly cost / 60"
  },
  {
    department: "revenue-operations",
    slug: "closed-won-launch-readiness",
    policyVersion: "1.0.7",
    name: "Review closed-won launch readiness",
    summary: "Checks order, scope, prerequisites, ownership, and provisioning exceptions before implementation launch activities are recommended.",
    problem: "Closed-won handoffs lose scope and delay time to value when order details, prerequisites, owners, and provisioning exceptions are incomplete.",
    outcome: "An explainable launch-readiness recommendation that keeps provisioning, entitlement changes, and scheduling human-controlled.",
    owner: "Revenue Operations",
    primaryMetric: "Time to kickoff",
    required: ["opportunityId", "accountId", "scopeConfirmed", "prerequisiteCompletionPercent"],
    optional: ["orderValidated", "complexScope", "provisioningException", "entitlementChangeProposed", "kickoffScheduled", "launchOwnerAssigned"],
    fieldContracts: {
      opportunityId: { type: "string", minLength: 1, maxLength: 500 },
      accountId: { type: "string", minLength: 1, maxLength: 500 },
      scopeConfirmed: { type: "boolean" },
      prerequisiteCompletionPercent: { type: "number", minimum: 0, maximum: 100 },
      orderValidated: { type: "boolean" },
      complexScope: { type: "boolean" },
      provisioningException: { type: "boolean" },
      entitlementChangeProposed: { type: "boolean" },
      kickoffScheduled: { type: "boolean" },
      launchOwnerAssigned: { type: "boolean" }
    },
    rules: [
      { field: "scopeConfirmed", operator: "falsy", points: 45, reason: "Implementation scope is not confirmed" },
      { field: "prerequisiteCompletionPercent", operator: "lt", value: 100, points: 30, reason: "Launch prerequisites are incomplete" },
      { field: "orderValidated", operator: "falsy", points: 40, reason: "The closed-won order has not been validated" },
      { field: "complexScope", operator: "truthy", points: 35, reason: "The opportunity has complex implementation scope" },
      { field: "provisioningException", operator: "truthy", points: 70, minimumBand: "high", reason: "Provisioning requires an exception" },
      { field: "entitlementChangeProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "An entitlement change is proposed" },
      { field: "launchOwnerAssigned", operator: "falsy", points: 35, reason: "No accountable launch owner is assigned" }
    ],
    decisions: { low: "recommend_launch_checklist_for_owner_review", medium: "route_launch_gaps_to_revenue_operations", high: "hold_provisioning_for_exception_approval" },
    actions: ["Present scope and prerequisite evidence to the launch owner", "Recommend owners for unresolved launch checklist items", "Keep workspace creation, provisioning, entitlements, and scheduling outside the starter"],
    adapters: ["CRM", "Project system", "Product APIs", "Calendar", "Document tools"],
    roiExample: "closed-won launches per month x handoff minutes saved x revenue operations hourly cost / 60"
  },
  {
    department: "incident-management",
    slug: "incident-rca-evidence-review",
    policyVersion: "1.0.7",
    name: "Review incident RCA evidence",
    summary: "Checks incident artifacts, timeline coverage, redaction, root-cause support, remediation ownership, and publication readiness.",
    problem: "Incident learning is delayed or unreliable when timelines, evidence, redaction, root-cause support, and remediation ownership are incomplete.",
    outcome: "A structured RCA evidence recommendation that reserves publication and closure for the incident or release owner.",
    owner: "Engineering & SRE",
    primaryMetric: "Evidence completeness",
    required: ["incidentId", "incidentClosedAt", "evidenceArtifactCount", "timelineCoveragePercent"],
    optional: ["sensitiveDataRedacted", "rootCauseSupported", "remediationOwnersAssigned", "publicationProposed", "evidenceGapCount", "releaseEvidenceIncluded"],
    fieldContracts: {
      incidentId: { type: "string", minLength: 1, maxLength: 500 },
      incidentClosedAt: { type: "string", format: "date-time", minLength: 1, maxLength: 64 },
      evidenceArtifactCount: { type: "number", minimum: 0 },
      timelineCoveragePercent: { type: "number", minimum: 0, maximum: 100 },
      sensitiveDataRedacted: { type: "boolean" },
      rootCauseSupported: { type: "boolean" },
      remediationOwnersAssigned: { type: "boolean" },
      publicationProposed: { type: "boolean" },
      evidenceGapCount: { type: "number", minimum: 0 },
      releaseEvidenceIncluded: { type: "boolean" }
    },
    rules: [
      { field: "evidenceArtifactCount", operator: "lt", value: 3, points: 30, reason: "Fewer than three incident evidence artifacts are attached" },
      { field: "timelineCoveragePercent", operator: "lt", value: 90, points: 35, reason: "Incident timeline coverage is below 90%" },
      { field: "sensitiveDataRedacted", operator: "falsy", points: 70, minimumBand: "high", reason: "Sensitive data has not been confirmed as redacted" },
      { field: "rootCauseSupported", operator: "falsy", points: 40, reason: "The proposed root cause is not supported by evidence" },
      { field: "remediationOwnersAssigned", operator: "falsy", points: 30, reason: "Remediation actions do not all have owners" },
      { field: "publicationProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "RCA publication requires owner approval" },
      { field: "evidenceGapCount", operator: "gt", value: 0, points: 30, reason: "The evidence package contains unresolved gaps" }
    ],
    decisions: { low: "recommend_rca_evidence_for_owner_review", medium: "route_evidence_gaps_to_incident_owner", high: "hold_rca_publication_for_approval" },
    actions: ["Present the redacted timeline and evidence index to the incident owner", "Recommend owners for remediation and evidence gaps", "Keep publication, ticket changes, and RCA closure outside the starter"],
    adapters: ["Collaboration", "Observability", "Work tracking", "Source control", "Knowledge base"],
    roiExample: "incidents per month x RCA drafting minutes saved x SRE hourly cost / 60"
  },
  {
    department: "proposal-management",
    slug: "rfp-response-evidence-review",
    policyVersion: "1.0.7",
    name: "Review RFP response evidence",
    summary: "Evaluates evidence coverage, citations, confidence, unsupported claims, sensitive answers, and expert-review readiness.",
    problem: "RFP and security questionnaire responses create claim risk when drafts are not cited, supported by approved evidence, or routed to domain experts.",
    outcome: "A response-package recommendation that highlights gaps and keeps sensitive claims and document export behind expert approval.",
    owner: "Revenue Engineering",
    primaryMetric: "Unsupported-claim rate",
    required: ["questionnaireId", "questionCount", "evidenceCoveragePercent", "citedAnswerCount"],
    optional: ["unsupportedAnswerCount", "sensitiveAnswerCount", "domainExpertAssigned", "exportProposed", "evidenceApproved", "confidenceScore"],
    fieldContracts: {
      questionnaireId: { type: "string", minLength: 1, maxLength: 500 },
      questionCount: { type: "number", minimum: 1 },
      evidenceCoveragePercent: { type: "number", minimum: 0, maximum: 100 },
      citedAnswerCount: { type: "number", minimum: 0 },
      unsupportedAnswerCount: { type: "number", minimum: 0 },
      sensitiveAnswerCount: { type: "number", minimum: 0 },
      domainExpertAssigned: { type: "boolean" },
      exportProposed: { type: "boolean" },
      evidenceApproved: { type: "boolean" },
      confidenceScore: { type: "number", minimum: 0, maximum: 100 }
    },
    rules: [
      { field: "evidenceCoveragePercent", operator: "lt", value: 90, points: 35, reason: "Approved evidence covers less than 90% of questions" },
      { field: "unsupportedAnswerCount", operator: "gt", value: 0, points: 70, minimumBand: "high", reason: "The draft contains unsupported answers" },
      { field: "sensitiveAnswerCount", operator: "gt", value: 0, points: 70, minimumBand: "high", reason: "The draft contains sensitive answers requiring expert approval" },
      { field: "domainExpertAssigned", operator: "falsy", points: 35, reason: "No domain expert is assigned to review gaps" },
      { field: "exportProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "Questionnaire export is proposed" },
      { field: "evidenceApproved", operator: "falsy", points: 45, reason: "The supporting evidence has not been approved" },
      { field: "confidenceScore", operator: "lt", value: 80, points: 25, reason: "Draft confidence is below the review target" }
    ],
    decisions: { low: "recommend_response_package_for_expert_review", medium: "route_evidence_gaps_to_domain_experts", high: "hold_sensitive_response_or_export_for_approval" },
    actions: ["Present cited answers and confidence evidence to domain experts", "Recommend owners for unsupported questions", "Keep document export, CRM writes, and external submission outside the starter"],
    adapters: ["File processing", "Knowledge base", "Document generation", "CRM", "Review queue"],
    roiExample: "questionnaires per month x response review minutes saved x revenue engineering hourly cost / 60"
  },
  {
    department: "customer-support",
    slug: "support-escalation-command-center",
    policyVersion: "1.0.8",
    name: "Review support escalation command-center readiness",
    summary: "Prioritizes high-severity escalation evidence, ownership, telemetry, stale actions, timelines, and external-update drafts.",
    problem: "High-severity support cases lose time when customer, product, engineering, and telemetry context is incomplete or out of sync.",
    outcome: "An explainable command-center recommendation that preserves human review for external communication and case closure.",
    owner: "Customer Support",
    primaryMetric: "Time to mobilize",
    required: ["escalationId", "severity", "customerImpactSummary", "openActionCount"],
    optional: ["telemetryAttached", "staleActionCount", "externalUpdateDrafted", "engineeringOwnerAssigned", "timelineSynchronized", "closureProposed"],
    fieldContracts: {
      escalationId: { type: "string", minLength: 1, maxLength: 500 },
      severity: { type: "string", enum: ["low", "medium", "high", "critical"], minLength: 1, maxLength: 100 },
      customerImpactSummary: { type: "string", minLength: 1, maxLength: 5000 },
      openActionCount: { type: "number", minimum: 0 },
      telemetryAttached: { type: "boolean" },
      staleActionCount: { type: "number", minimum: 0 },
      externalUpdateDrafted: { type: "boolean" },
      engineeringOwnerAssigned: { type: "boolean" },
      timelineSynchronized: { type: "boolean" },
      closureProposed: { type: "boolean" }
    },
    rules: [
      { field: "severity", operator: "equals", value: "critical", points: 70, minimumBand: "high", reason: "The escalation is classified as critical" },
      { field: "telemetryAttached", operator: "falsy", points: 35, reason: "Telemetry evidence is not attached" },
      { field: "staleActionCount", operator: "gt", value: 0, points: 30, reason: "The escalation has stale actions" },
      { field: "externalUpdateDrafted", operator: "truthy", points: 70, minimumBand: "high", reason: "An external customer update requires review" },
      { field: "engineeringOwnerAssigned", operator: "falsy", points: 35, reason: "No engineering owner is assigned" },
      { field: "timelineSynchronized", operator: "falsy", points: 30, reason: "The escalation timeline is not synchronized" },
      { field: "closureProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "Escalation closure requires human review" }
    ],
    decisions: { low: "recommend_command_center_record_for_review", medium: "route_stale_or_incomplete_actions_to_owners", high: "hold_external_update_or_closure_for_approval" },
    actions: ["Present the escalation timeline, telemetry, and ownership gaps", "Recommend action owners and evidence follow-ups", "Keep external messages, support-system writes, and closure outside the starter"],
    adapters: ["Support platform", "CRM", "Collaboration", "Engineering tracker", "Telemetry"],
    roiExample: "high-severity escalations per month x mobilization minutes saved x support hourly cost / 60"
  },
  {
    department: "people-operations",
    slug: "people-operations-case-routing",
    policyVersion: "1.0.7",
    name: "Route people operations cases for review",
    summary: "Evaluates identity, policy, sensitivity, approval, payroll, workplace, and completion-evidence signals for people cases.",
    problem: "People cases span HR, payroll, workplace, and manager responsibilities, creating privacy and completion risk when routing is inconsistent.",
    outcome: "A privacy-aware routing recommendation that leaves employee-impacting decisions and system changes with HR or the accountable manager.",
    owner: "People Operations",
    primaryMetric: "Case cycle time",
    required: ["caseId", "caseType", "requesterVerified", "policyCheckComplete"],
    optional: ["sensitiveCase", "managerApprovalRequired", "hrApprovalRequired", "payrollImpact", "workplaceImpact", "completionEvidenceComplete"],
    fieldContracts: {
      caseId: { type: "string", minLength: 1, maxLength: 500 },
      caseType: { type: "string", minLength: 1, maxLength: 500 },
      requesterVerified: { type: "boolean" },
      policyCheckComplete: { type: "boolean" },
      sensitiveCase: { type: "boolean" },
      managerApprovalRequired: { type: "boolean" },
      hrApprovalRequired: { type: "boolean" },
      payrollImpact: { type: "boolean" },
      workplaceImpact: { type: "boolean" },
      completionEvidenceComplete: { type: "boolean" }
    },
    rules: [
      { field: "requesterVerified", operator: "falsy", points: 70, minimumBand: "high", reason: "The requester identity is not verified" },
      { field: "policyCheckComplete", operator: "falsy", points: 45, reason: "The applicable people policy check is incomplete" },
      { field: "sensitiveCase", operator: "truthy", points: 70, minimumBand: "high", reason: "The case is classified as sensitive" },
      { field: "managerApprovalRequired", operator: "truthy", points: 35, reason: "Manager approval is required" },
      { field: "hrApprovalRequired", operator: "truthy", points: 70, minimumBand: "high", reason: "HR approval is required" },
      { field: "payrollImpact", operator: "truthy", points: 70, minimumBand: "high", reason: "The case can affect payroll" },
      { field: "workplaceImpact", operator: "truthy", points: 45, reason: "The case requires workplace coordination" },
      { field: "completionEvidenceComplete", operator: "falsy", points: 30, reason: "Completion evidence is incomplete" }
    ],
    decisions: { low: "recommend_standard_people_case_review", medium: "route_case_to_manager_or_hr_review", high: "hold_employee_impacting_action_for_hr_approval" },
    actions: ["Present only the minimum necessary case evidence to the assigned reviewer", "Recommend manager, HR, payroll, or workplace review based on matched rules", "Keep employee decisions and HRIS, payroll, identity, or messaging changes outside the starter"],
    adapters: ["HRIS", "Identity", "Payroll", "Workplace service systems", "Forms"],
    roiExample: "people cases per month x routing minutes saved x people operations hourly cost / 60"
  },
  {
    department: "customer-success",
    slug: "customer-health-action-review",
    policyVersion: "1.0.7",
    name: "Review customer health actions",
    summary: "Evaluates account signals, health evidence, ownership, billing and support risk, outreach, and commercial-action proposals.",
    problem: "Customer health signals produce inconsistent onboarding, risk, renewal, or expansion actions when evidence and ownership are scattered.",
    outcome: "An explainable play recommendation that keeps high-impact outreach and commercial actions with the customer owner.",
    owner: "Customer Success",
    primaryMetric: "Risk coverage",
    required: ["accountId", "lifecycleStage", "signalCount", "healthEvidenceComplete"],
    optional: ["highImpactOutreachProposed", "commercialActionProposed", "billingRisk", "supportEscalationOpen", "ownerAssigned", "outcomeTrackingConfigured"],
    fieldContracts: {
      accountId: { type: "string", minLength: 1, maxLength: 500 },
      lifecycleStage: { type: "string", minLength: 1, maxLength: 200 },
      signalCount: { type: "number", minimum: 0 },
      healthEvidenceComplete: { type: "boolean" },
      highImpactOutreachProposed: { type: "boolean" },
      commercialActionProposed: { type: "boolean" },
      billingRisk: { type: "boolean" },
      supportEscalationOpen: { type: "boolean" },
      ownerAssigned: { type: "boolean" },
      outcomeTrackingConfigured: { type: "boolean" }
    },
    rules: [
      { field: "healthEvidenceComplete", operator: "falsy", points: 45, reason: "Customer health evidence is incomplete" },
      { field: "signalCount", operator: "lt", value: 2, points: 30, reason: "The recommendation is supported by fewer than two signals" },
      { field: "highImpactOutreachProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "High-impact customer outreach is proposed" },
      { field: "commercialActionProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "A renewal, expansion, or other commercial action is proposed" },
      { field: "billingRisk", operator: "truthy", points: 35, reason: "The account has a billing risk signal" },
      { field: "supportEscalationOpen", operator: "truthy", points: 40, reason: "The account has an open support escalation" },
      { field: "ownerAssigned", operator: "falsy", points: 35, reason: "No customer owner is assigned" },
      { field: "outcomeTrackingConfigured", operator: "falsy", points: 25, reason: "Outcome tracking is not configured" }
    ],
    decisions: { low: "recommend_customer_play_for_owner_review", medium: "route_health_risks_to_customer_owner", high: "hold_outreach_or_commercial_action_for_approval" },
    actions: ["Present the supporting account signals and matched reasons", "Recommend an onboarding, risk, renewal, or expansion play for owner review", "Keep CRM tasks, customer outreach, billing changes, and commercial actions outside the starter"],
    adapters: ["Product usage", "CRM", "Support", "Billing", "Communication", "Data warehouse"],
    roiExample: "managed accounts x health-review minutes saved per month x customer success hourly cost / 60"
  },
  {
    department: "field-operations",
    slug: "field-service-completion-review",
    policyVersion: "1.0.7",
    name: "Review field service completion evidence",
    summary: "Checks evidence, completion criteria, parts and warranty exceptions, and proposed financial, scheduling, or customer actions after field work.",
    problem: "Field work cannot close reliably when documentation, parts, warranty, scheduling, customer, and billing exceptions are handled inconsistently.",
    outcome: "A completion recommendation and exception record that reserves financial, scheduling, customer, and closure actions for human review.",
    owner: "Field Operations",
    primaryMetric: "Documentation completeness",
    required: ["serviceJobId", "visitCompletedAt", "evidenceComplete", "completionChecklistPercent"],
    optional: ["paymentReleaseProposed", "customerMessageDrafted", "rescheduleProposed", "partsException", "warrantyException", "humanResolutionRequired"],
    fieldContracts: {
      serviceJobId: { type: "string", minLength: 1, maxLength: 500 },
      visitCompletedAt: { type: "string", format: "date-time", minLength: 1, maxLength: 64 },
      evidenceComplete: { type: "boolean" },
      completionChecklistPercent: { type: "number", minimum: 0, maximum: 100 },
      paymentReleaseProposed: { type: "boolean" },
      customerMessageDrafted: { type: "boolean" },
      rescheduleProposed: { type: "boolean" },
      partsException: { type: "boolean" },
      warrantyException: { type: "boolean" },
      humanResolutionRequired: { type: "boolean" }
    },
    rules: [
      { field: "evidenceComplete", operator: "falsy", points: 45, reason: "Required field-service evidence is incomplete" },
      { field: "completionChecklistPercent", operator: "lt", value: 100, points: 35, reason: "The completion checklist is incomplete" },
      { field: "paymentReleaseProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "A financial release is proposed" },
      { field: "customerMessageDrafted", operator: "truthy", points: 40, reason: "A customer-facing message requires review" },
      { field: "rescheduleProposed", operator: "truthy", points: 70, minimumBand: "high", reason: "A customer-impacting reschedule is proposed" },
      { field: "partsException", operator: "truthy", points: 30, reason: "A parts or inventory exception remains open" },
      { field: "warrantyException", operator: "truthy", points: 35, reason: "A warranty exception remains open" },
      { field: "humanResolutionRequired", operator: "truthy", points: 70, minimumBand: "high", reason: "The case is explicitly marked for human resolution" }
    ],
    decisions: { low: "recommend_service_completion_for_owner_review", medium: "route_service_exceptions_to_field_operations", high: "hold_financial_customer_or_closure_action_for_approval" },
    actions: ["Present completion evidence and open exceptions to the field-service owner", "Recommend follow-up for documentation, parts, or warranty gaps", "Keep billing, payment, scheduling, customer messaging, inventory writes, and closure outside the starter"],
    adapters: ["Field-service system", "Accounting", "Documents", "Inventory and assets", "Messaging"],
    roiExample: "field visits per month x completion-review minutes saved x field operations hourly cost / 60"
  },
];

export const thresholds = {
  medium: 30,
  high: 70
};

const adaptersByDepartment = {
  finance: ["SAP", "Oracle", "NetSuite", "Coupa", "Slack"],
  "information-technology": ["ServiceNow", "Jira Service Management", "PagerDuty"],
  security: ["Microsoft 365", "Google Workspace", "SIEM", "SOAR"],
  engineering: ["GitHub", "GitLab", "Jira", "change management", "incident management"]
};

function contractFor(definition, field) {
  if (definition.fieldContracts?.[field]) return definition.fieldContracts[field];
  return { type: "string", minLength: 1, maxLength: 500 };
}

function schemaContractFor(definition, field) {
  const contract = { ...contractFor(definition, field) };
  if (!definition.required.includes(field) || contract.type !== "string") return contract;
  if (contract.pattern) return { ...contract, allOf: [...(contract.allOf ?? []), { pattern: "\\S" }] };
  return { ...contract, pattern: "\\S" };
}

export function inputSchemaFor(definition) {
  return {
    type: "object",
    required: [...definition.required],
    properties: Object.fromEntries(
      [...definition.required, ...definition.optional].map((field) => [field, schemaContractFor(definition, field)])
    ),
    additionalProperties: true
  };
}

export function policyFor(definition) {
  return {
    slug: definition.slug,
    policyVersion: definition.policyVersion,
    inputSchema: inputSchemaFor(definition),
    rules: definition.rules,
    thresholds,
    decisions: definition.decisions,
    actions: definition.actions
  };
}

export function adaptersFor(definition) {
  return definition.adapters ?? adaptersByDepartment[definition.department] ?? [];
}
