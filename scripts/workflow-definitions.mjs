export const workflows = [
  {
    department: "finance",
    slug: "invoice-exception-triage",
    policyVersion: "1.0.3",
    name: "Triage enterprise invoice exceptions",
    summary: "Scores invoice exceptions and routes clean invoices, finance reviews, and payment holds through a consistent policy.",
    problem: "Accounts payable teams lose time manually interpreting missing purchase orders, duplicate invoices, amount mismatches, and risky vendors.",
    outcome: "A structured decision with a risk score, matched policy reasons, and the next recommended action.",
    owner: "Accounts Payable Operations",
    primaryMetric: "Minutes of manual review avoided per invoice",
    required: ["invoiceId", "vendorId", "amount", "currency"],
    optional: ["purchaseOrderId", "duplicateDetected", "amountMismatchPercent", "restrictedVendor", "newBankDetails"],
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
    department: "human-resources",
    slug: "employee-access-request-triage",
    policyVersion: "1.0.3",
    name: "Triage employee access requests",
    summary: "Classifies employee access requests using role, privilege, environment, and approval signals before provisioning begins.",
    problem: "Access requests often arrive through inconsistent channels and reach IT without enough context or the required approvals.",
    outcome: "A normalized access decision that separates standard fulfillment, security review, and blocked requests.",
    owner: "People Operations and Identity Management",
    primaryMetric: "Access-request cycle time",
    required: ["requestId", "employeeId", "system", "accessLevel"],
    optional: ["managerApproved", "privilegedAccess", "productionAccess", "contractor", "endDate"],
    rules: [
      { field: "managerApproved", operator: "falsy", points: 45, reason: "Manager approval is missing" },
      { field: "privilegedAccess", operator: "truthy", points: 45, reason: "Privileged access requested" },
      { field: "productionAccess", operator: "truthy", points: 30, reason: "Production access requested" },
      { field: "contractor", operator: "truthy", points: 20, reason: "Requester is a contractor" },
      { field: "endDate", operator: "missing", points: 20, reason: "Time-bound access has no end date" }
    ],
    decisions: { low: "queue_standard_fulfillment", medium: "require_security_review", high: "block_until_approved" },
    actions: ["Create an identity-governance ticket", "Require a named approver for elevated access", "Set an expiration date before provisioning"],
    roiExample: "monthly access requests x minutes saved x loaded hourly cost / 60"
  },
  {
    department: "information-technology",
    slug: "service-desk-priority-routing",
    policyVersion: "1.0.3",
    name: "Route enterprise service desk incidents",
    summary: "Assigns incident priority from impact, urgency, affected users, outage state, and executive visibility.",
    problem: "Inconsistent ticket priority creates noisy queues while genuinely disruptive incidents wait too long for the right team.",
    outcome: "A defensible routing decision with urgency, ownership guidance, and escalation reasons.",
    owner: "IT Service Management",
    primaryMetric: "Mean time to assignment",
    required: ["ticketId", "category", "summary", "affectedUsers"],
    optional: ["serviceDown", "securityImpact", "executiveAffected", "revenueImpact", "workaroundAvailable"],
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
    policyVersion: "1.0.3",
    name: "Triage employee phishing reports",
    summary: "Scores reported messages using credential theft, attachment, impersonation, click, and campaign indicators.",
    problem: "Security teams receive large volumes of suspicious-email reports with uneven context and limited prioritization.",
    outcome: "A rapid containment recommendation without automatically taking destructive security actions.",
    owner: "Security Operations",
    primaryMetric: "Minutes from report to analyst triage",
    required: ["reportId", "reporterId", "sender", "subject"],
    optional: ["credentialRequested", "suspiciousAttachment", "executiveImpersonation", "linkClicked", "multipleRecipients"],
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
    department: "sales",
    slug: "enterprise-lead-routing",
    policyVersion: "1.0.3",
    name: "Route enterprise sales leads",
    summary: "Scores enterprise leads using account fit, buying intent, geography, engagement, and consent before assignment.",
    problem: "High-value leads are often delayed or misrouted because qualification logic differs across forms, regions, and teams.",
    outcome: "A transparent routing recommendation with matched reasons and a clear next action for RevOps.",
    owner: "Revenue Operations",
    primaryMetric: "Speed to lead for qualified accounts",
    required: ["leadId", "company", "email", "region"],
    optional: ["employeeCount", "targetAccount", "highIntent", "requestedDemo", "marketingConsent"],
    rules: [
      { field: "targetAccount", operator: "truthy", points: 35, reason: "Company is a named target account" },
      { field: "employeeCount", operator: "gte", value: 1000, points: 25, reason: "Enterprise employee threshold met" },
      { field: "highIntent", operator: "truthy", points: 25, reason: "High-intent behavior detected" },
      { field: "requestedDemo", operator: "truthy", points: 25, reason: "Buyer requested a demonstration" },
      { field: "marketingConsent", operator: "falsy", points: -40, reason: "Marketing consent is not present" }
    ],
    decisions: { low: "route_to_nurture_or_review", medium: "assign_sdr_queue", high: "assign_enterprise_owner" },
    actions: ["Upsert the lead in CRM", "Apply regional ownership rules", "Start an SLA timer for qualified handoff"],
    roiExample: "qualified leads x conversion lift x average contract value"
  },
  {
    department: "marketing",
    slug: "campaign-lead-compliance-gate",
    policyVersion: "1.0.3",
    name: "Gate campaign leads for compliant follow-up",
    summary: "Checks consent, suppression, geography, engagement, and target-account status before campaign follow-up.",
    problem: "Campaign handoffs can create compliance risk and wasted spend when suppression and consent checks happen too late.",
    outcome: "A follow-up decision that keeps compliance facts visible and routes ambiguous records for review.",
    owner: "Marketing Operations",
    primaryMetric: "Compliant leads processed per campaign",
    required: ["leadId", "email", "campaignId", "country"],
    optional: ["consent", "suppressed", "targetAccount", "engagementScore", "existingCustomer"],
    rules: [
      { field: "consent", operator: "falsy", points: 60, minimumBand: "high", reason: "Consent is missing" },
      { field: "suppressed", operator: "truthy", points: 80, minimumBand: "high", reason: "Contact is on a suppression list" },
      { field: "targetAccount", operator: "truthy", points: -20, reason: "Contact belongs to a target account" },
      { field: "engagementScore", operator: "gte", value: 70, points: -15, reason: "Strong engagement signal" },
      { field: "existingCustomer", operator: "truthy", points: 15, reason: "Customer messaging policy may apply" }
    ],
    decisions: { low: "allow_campaign_follow_up", medium: "route_to_compliance_review", high: "suppress_automated_outreach" },
    actions: ["Record the policy decision", "Send approved contacts to the campaign sequence", "Route uncertain consent records to a human reviewer"],
    roiExample: "campaign leads x minutes saved in list review x marketing operations hourly cost / 60"
  },
  {
    department: "customer-success",
    slug: "customer-risk-escalation",
    policyVersion: "1.0.3",
    name: "Escalate at-risk enterprise customers",
    summary: "Combines adoption, support, sentiment, renewal, and stakeholder signals into a customer-risk response.",
    problem: "Customer risk signals are distributed across systems and often become visible only after renewal conversations deteriorate.",
    outcome: "An explainable intervention priority and recommended customer-success action plan.",
    owner: "Customer Success Operations",
    primaryMetric: "At-risk accounts engaged before renewal",
    required: ["accountId", "accountName", "arr", "renewalDays"],
    optional: ["usageDropPercent", "criticalTickets", "negativeSentiment", "championLeft", "execSponsorMissing"],
    rules: [
      { field: "usageDropPercent", operator: "gte", value: 30, points: 30, reason: "Usage dropped at least 30%" },
      { field: "criticalTickets", operator: "gte", value: 2, points: 30, reason: "Multiple critical support tickets" },
      { field: "negativeSentiment", operator: "truthy", points: 25, reason: "Negative customer sentiment detected" },
      { field: "championLeft", operator: "truthy", points: 35, reason: "Customer champion departed" },
      { field: "execSponsorMissing", operator: "truthy", points: 20, reason: "No executive sponsor is mapped" },
      { field: "renewalDays", operator: "lt", value: 60, points: 20, reason: "Renewal is less than 60 days away" }
    ],
    decisions: { low: "continue_success_plan", medium: "open_risk_workstream", high: "launch_executive_save_plan" },
    actions: ["Update customer health in the CS platform", "Assign a named intervention owner", "Require executive review before commercial concessions"],
    roiExample: "at-risk ARR x reduction in preventable churn rate"
  },
  {
    department: "legal",
    slug: "contract-intake-routing",
    policyVersion: "1.0.3",
    name: "Route enterprise contract requests",
    summary: "Routes contract intake using document type, value, jurisdiction, data access, and non-standard terms.",
    problem: "Legal requests arrive without enough commercial or risk context, creating avoidable back-and-forth and slow review cycles.",
    outcome: "A normalized legal intake route with risk reasons and required reviewers.",
    owner: "Legal Operations",
    primaryMetric: "Contract request time to first review",
    required: ["requestId", "contractType", "counterparty", "contractValue"],
    optional: ["nonStandardTerms", "personalData", "crossBorderData", "autoRenewal", "regulatedIndustry"],
    rules: [
      { field: "nonStandardTerms", operator: "truthy", points: 30, reason: "Non-standard terms requested" },
      { field: "personalData", operator: "truthy", points: 25, reason: "Agreement involves personal data" },
      { field: "crossBorderData", operator: "truthy", points: 30, reason: "Cross-border data transfer involved" },
      { field: "autoRenewal", operator: "truthy", points: 15, reason: "Automatic renewal clause present" },
      { field: "regulatedIndustry", operator: "truthy", points: 30, reason: "Counterparty operates in a regulated industry" },
      { field: "contractValue", operator: "gte", value: 250000, points: 25, reason: "High-value agreement" }
    ],
    decisions: { low: "use_standard_legal_queue", medium: "assign_specialist_review", high: "open_cross_functional_review" },
    actions: ["Create the legal matter", "Attach the structured intake fields", "Require legal approval before signature or redline acceptance"],
    roiExample: "monthly contracts x reduction in intake rework minutes x legal hourly cost / 60"
  },
  {
    department: "procurement",
    slug: "vendor-risk-intake",
    policyVersion: "1.0.3",
    name: "Triage enterprise vendor risk",
    summary: "Scores vendor intake using spend, data access, criticality, geography, subcontractors, and security evidence.",
    problem: "Procurement, security, privacy, and legal reviews often start late because vendor risk is not classified at intake.",
    outcome: "A coordinated due-diligence route with the reasons each review is required.",
    owner: "Procurement Operations",
    primaryMetric: "Vendor request time to correct review path",
    required: ["requestId", "vendorName", "annualSpend", "businessOwner"],
    optional: ["handlesPersonalData", "businessCritical", "foreignDataHosting", "subprocessors", "soc2Available"],
    rules: [
      { field: "handlesPersonalData", operator: "truthy", points: 30, reason: "Vendor handles personal data" },
      { field: "businessCritical", operator: "truthy", points: 30, reason: "Vendor supports a critical business process" },
      { field: "foreignDataHosting", operator: "truthy", points: 25, reason: "Data is hosted in another jurisdiction" },
      { field: "subprocessors", operator: "truthy", points: 20, reason: "Vendor relies on subprocessors" },
      { field: "soc2Available", operator: "falsy", points: 25, reason: "SOC 2 evidence is unavailable" },
      { field: "annualSpend", operator: "gte", value: 100000, points: 20, reason: "High annual spend" }
    ],
    decisions: { low: "start_standard_procurement", medium: "add_security_or_privacy_review", high: "open_full_vendor_due_diligence" },
    actions: ["Create the vendor record", "Assign required control owners", "Block purchase-order creation until mandatory approvals complete"],
    roiExample: "vendor requests x days removed from routing delay x internal cost per delay day"
  },
  {
    department: "operations",
    slug: "major-incident-stakeholder-brief",
    policyVersion: "1.0.3",
    name: "Prepare major incident stakeholder briefs",
    summary: "Turns operational incident facts into a severity decision and a consistent stakeholder communication plan.",
    problem: "During incidents, teams lose time reconciling impact facts and deciding who needs which update cadence.",
    outcome: "A severity tier, communication cadence, stakeholder list, and next update deadline.",
    owner: "Business Operations and Incident Command",
    primaryMetric: "Minutes from incident declaration to first stakeholder brief",
    required: ["incidentId", "service", "startedAt", "summary"],
    optional: ["customersAffected", "revenueImpact", "dataRisk", "workaroundAvailable", "regulatoryNotificationPossible"],
    rules: [
      { field: "customersAffected", operator: "gte", value: 100, points: 30, reason: "At least 100 customers affected" },
      { field: "revenueImpact", operator: "truthy", points: 35, reason: "Revenue operations are affected" },
      { field: "dataRisk", operator: "truthy", points: 50, minimumBand: "high", reason: "Potential data exposure or integrity risk" },
      { field: "workaroundAvailable", operator: "falsy", points: 20, reason: "No workaround is available" },
      { field: "regulatoryNotificationPossible", operator: "truthy", points: 45, minimumBand: "high", reason: "Regulatory notification may be required" }
    ],
    decisions: { low: "standard_operations_update", medium: "activate_incident_command", high: "activate_executive_and_legal_response" },
    actions: ["Create the stakeholder brief", "Assign the next-update owner and deadline", "Require incident commander approval before external communication"],
    roiExample: "major incidents x minutes faster communication x affected staff loaded cost per minute"
  },
  {
    department: "data-and-analytics",
    slug: "data-access-request-triage",
    policyVersion: "1.0.3",
    name: "Triage enterprise data access requests",
    summary: "Classifies data access requests by sensitivity, environment, sharing intent, retention, and owner approval before access is granted.",
    problem: "Data teams receive incomplete access requests that obscure privacy risk, production scope, retention needs, and accountable ownership.",
    outcome: "A transparent governance route that separates standard access from data-owner, privacy, and security review.",
    owner: "Data Governance",
    primaryMetric: "Time from request to governed data access",
    required: ["requestId", "requesterId", "dataset", "purpose"],
    optional: ["containsSensitiveData", "productionData", "externalSharing", "retentionDays", "ownerApproved"],
    rules: [
      { field: "containsSensitiveData", operator: "truthy", points: 35, reason: "Dataset contains sensitive data" },
      { field: "productionData", operator: "truthy", points: 25, reason: "Request includes production data" },
      { field: "externalSharing", operator: "truthy", points: 50, minimumBand: "high", reason: "Data may be shared outside the organization" },
      { field: "retentionDays", operator: "gt", value: 365, points: 25, reason: "Requested retention exceeds one year" },
      { field: "ownerApproved", operator: "falsy", points: 40, reason: "Dataset owner approval is missing" }
    ],
    decisions: { low: "approve_standard_data_access", medium: "require_owner_and_privacy_review", high: "block_until_governance_approval" },
    actions: ["Create the governed access ticket", "Record purpose and retention", "Require named approval before external sharing"],
    roiExample: "monthly data requests x review minutes saved x governance hourly cost / 60"
  },
  {
    department: "engineering",
    slug: "production-change-risk-gate",
    policyVersion: "1.0.3",
    name: "Gate production changes by operational risk",
    summary: "Scores planned production changes using customer, database, rollback, peak-period, and security signals before deployment.",
    problem: "Change approvals become inconsistent when risk context is scattered across pull requests, tickets, and release conversations.",
    outcome: "An explainable release route that preserves human authority for elevated and security-relevant changes.",
    owner: "Engineering Operations",
    primaryMetric: "Change lead time without increasing failure rate",
    required: ["changeId", "service", "changeType", "plannedAt"],
    optional: ["customerImpact", "databaseMigration", "rollbackTested", "duringPeakHours", "securityRelevant"],
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
    department: "facilities",
    slug: "workplace-incident-routing",
    policyVersion: "1.0.3",
    name: "Route workplace incidents safely",
    summary: "Prioritizes workplace incidents using injury, immediate danger, access control, operational disruption, and people-impact signals.",
    problem: "Facilities incidents arrive through inconsistent channels, delaying the right safety, security, or operations response.",
    outcome: "A defensible urgency tier with clear escalation reasons and a named human response path.",
    owner: "Workplace Operations",
    primaryMetric: "Minutes from report to accountable responder",
    required: ["incidentId", "site", "category", "description"],
    optional: ["injuryReported", "immediateDanger", "accessControlImpact", "operationsDisrupted", "peopleAffected"],
    rules: [
      { field: "injuryReported", operator: "truthy", points: 55, minimumBand: "high", reason: "An injury has been reported" },
      { field: "immediateDanger", operator: "truthy", points: 70, minimumBand: "high", reason: "People may face immediate danger" },
      { field: "accessControlImpact", operator: "truthy", points: 30, reason: "Physical access controls are affected" },
      { field: "operationsDisrupted", operator: "truthy", points: 25, reason: "Workplace operations are disrupted" },
      { field: "peopleAffected", operator: "gte", value: 25, points: 25, reason: "At least 25 people are affected" }
    ],
    decisions: { low: "route_standard_facilities_queue", medium: "dispatch_urgent_workplace_response", high: "activate_safety_and_security_response" },
    actions: ["Create the facilities incident", "Assign an on-site response owner", "Require human confirmation before closing a safety event"],
    roiExample: "workplace incidents x minutes faster routing x disruption cost per minute"
  },
  {
    department: "corporate-communications",
    slug: "external-communication-approval",
    policyVersion: "1.0.3",
    name: "Approve external enterprise communications",
    summary: "Routes proposed external communications using financial, customer, security, legal, and executive-approval signals.",
    problem: "External statements move quickly across teams while material, legal, security, and customer implications remain unclear.",
    outcome: "A visible approval route that prevents high-risk messages from bypassing accountable reviewers.",
    owner: "Corporate Communications",
    primaryMetric: "Time from draft to approved external communication",
    required: ["requestId", "audience", "channel", "messageSummary", "owner"],
    optional: ["materialFinancialInfo", "customerImpact", "securityIncident", "legalReviewed", "executiveApproved"],
    rules: [
      { field: "materialFinancialInfo", operator: "truthy", points: 60, minimumBand: "high", reason: "Message may contain material financial information" },
      { field: "customerImpact", operator: "truthy", points: 30, reason: "Message addresses customer impact" },
      { field: "securityIncident", operator: "truthy", points: 60, minimumBand: "high", reason: "Message concerns a security incident" },
      { field: "legalReviewed", operator: "falsy", points: 35, reason: "Legal review is not recorded" },
      { field: "executiveApproved", operator: "falsy", points: 25, reason: "Executive approval is not recorded" }
    ],
    decisions: { low: "continue_standard_editorial_review", medium: "require_cross_functional_approval", high: "hold_for_executive_and_legal_approval" },
    actions: ["Create the communication approval record", "Attach the final approved wording", "Require named approval before publication"],
    roiExample: "external messages x coordination minutes saved x reviewer hourly cost / 60"
  },
  {
    department: "privacy",
    slug: "data-subject-request-triage",
    policyVersion: "1.0.3",
    name: "Triage data subject requests",
    summary: "Prioritizes privacy requests using identity, deadline, sensitivity, third-party, and legal-hold signals.",
    problem: "Privacy requests have strict deadlines and often require coordination across identity, legal, security, and data-owning teams.",
    outcome: "A deadline-aware route that keeps identity verification and legal constraints visible before fulfillment.",
    owner: "Privacy Operations",
    primaryMetric: "Data subject requests completed within policy deadline",
    required: ["requestId", "requestType", "requesterRegion", "receivedAt"],
    optional: ["identityVerified", "deadlineDays", "sensitiveData", "thirdPartyData", "legalHold"],
    rules: [
      { field: "identityVerified", operator: "falsy", points: 50, minimumBand: "high", reason: "Requester identity is not verified" },
      { field: "deadlineDays", operator: "lt", value: 7, points: 35, reason: "Fewer than seven days remain" },
      { field: "sensitiveData", operator: "truthy", points: 30, reason: "Request involves sensitive data" },
      { field: "thirdPartyData", operator: "truthy", points: 25, reason: "Responsive records may contain third-party data" },
      { field: "legalHold", operator: "truthy", points: 60, minimumBand: "high", reason: "Responsive data is subject to legal hold" }
    ],
    decisions: { low: "continue_standard_privacy_queue", medium: "assign_privacy_specialist_review", high: "hold_for_identity_or_legal_review" },
    actions: ["Create the privacy case", "Record the governing deadline", "Require privacy or legal approval before disclosure or deletion"],
    roiExample: "annual privacy requests x handling hours saved x privacy operations hourly cost"
  }
];

export const thresholds = {
  medium: 30,
  high: 70
};

const numberContracts = {
  amount: { type: "number", minimum: 0 },
  amountMismatchPercent: { type: "number", minimum: 0, maximum: 100 },
  affectedUsers: { type: "number", minimum: 0 },
  employeeCount: { type: "number", minimum: 0 },
  engagementScore: { type: "number", minimum: 0, maximum: 100 },
  arr: { type: "number", minimum: 0 },
  renewalDays: { type: "number", minimum: 0 },
  usageDropPercent: { type: "number", minimum: 0, maximum: 100 },
  criticalTickets: { type: "number", minimum: 0 },
  contractValue: { type: "number", minimum: 0 },
  annualSpend: { type: "number", minimum: 0 },
  customersAffected: { type: "number", minimum: 0 },
  retentionDays: { type: "number", minimum: 0 },
  peopleAffected: { type: "number", minimum: 0 },
  deadlineDays: { type: "number", minimum: 0 }
};

const booleanFields = new Set([
  "duplicateDetected", "restrictedVendor", "newBankDetails", "managerApproved",
  "privilegedAccess", "productionAccess", "contractor", "serviceDown",
  "securityImpact", "executiveAffected", "revenueImpact", "workaroundAvailable",
  "credentialRequested", "suspiciousAttachment", "executiveImpersonation", "linkClicked",
  "multipleRecipients", "targetAccount", "highIntent", "requestedDemo",
  "marketingConsent", "consent", "suppressed", "existingCustomer", "negativeSentiment",
  "championLeft", "execSponsorMissing", "nonStandardTerms", "personalData",
  "crossBorderData", "autoRenewal", "regulatedIndustry", "handlesPersonalData",
  "businessCritical", "foreignDataHosting", "subprocessors", "soc2Available", "dataRisk",
  "regulatoryNotificationPossible", "containsSensitiveData", "productionData", "externalSharing",
  "ownerApproved", "customerImpact", "databaseMigration", "rollbackTested", "duringPeakHours",
  "securityRelevant", "injuryReported", "immediateDanger", "accessControlImpact", "operationsDisrupted",
  "materialFinancialInfo", "securityIncident", "legalReviewed", "executiveApproved", "identityVerified",
  "sensitiveData", "thirdPartyData", "legalHold"
]);

const adaptersByDepartment = {
  finance: ["SAP", "Oracle", "NetSuite", "Coupa", "Slack"],
  "human-resources": ["Workday", "Okta", "Microsoft Entra ID", "ServiceNow"],
  "information-technology": ["ServiceNow", "Jira Service Management", "PagerDuty"],
  security: ["Microsoft 365", "Google Workspace", "SIEM", "SOAR"],
  sales: ["Salesforce", "HubSpot", "enrichment and routing tools"],
  marketing: ["marketing automation", "CRM", "consent platform"],
  "customer-success": ["customer success platform", "CRM", "support desk"],
  legal: ["CLM", "e-signature", "ticketing", "document storage"],
  procurement: ["procurement suite", "GRC", "security questionnaires"],
  operations: ["incident management", "Slack", "Microsoft Teams", "status page"],
  "data-and-analytics": ["Snowflake", "Databricks", "BigQuery", "data catalog", "ticketing"],
  engineering: ["GitHub", "GitLab", "Jira", "change management", "incident management"],
  facilities: ["facilities management", "physical security", "Slack", "Microsoft Teams"],
  "corporate-communications": ["content management", "Slack", "Microsoft Teams", "approval tools"],
  privacy: ["privacy management", "CRM", "data catalog", "ticketing", "document storage"]
};

function contractFor(field) {
  if (numberContracts[field]) return numberContracts[field];
  if (booleanFields.has(field)) return { type: "boolean" };
  if (field === "email") return { type: "string", format: "email", minLength: 3, maxLength: 320 };
  if (["startedAt", "endDate", "plannedAt", "receivedAt"].includes(field)) return { type: "string", format: "date-time", minLength: 1, maxLength: 64 };
  if (field === "currency") return { type: "string", pattern: "^[A-Z]{3}$", minLength: 3, maxLength: 3 };
  if (field === "summary") return { type: "string", minLength: 1, maxLength: 5000 };
  return { type: "string", minLength: 1, maxLength: 500 };
}

export function inputSchemaFor(definition) {
  return {
    type: "object",
    required: [...definition.required],
    properties: Object.fromEntries(
      [...definition.required, ...definition.optional].map((field) => [field, contractFor(field)])
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
  return adaptersByDepartment[definition.department] ?? [];
}
