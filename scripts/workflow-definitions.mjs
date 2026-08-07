export const workflows = [
  {
    department: "finance",
    slug: "invoice-exception-triage",
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
      { field: "duplicateDetected", operator: "truthy", points: 50, reason: "Potential duplicate invoice" },
      { field: "amountMismatchPercent", operator: "gt", value: 2, points: 25, reason: "Invoice and purchase order differ by more than 2%" },
      { field: "restrictedVendor", operator: "truthy", points: 60, reason: "Vendor appears on a restricted list" },
      { field: "newBankDetails", operator: "truthy", points: 35, reason: "Payment destination changed" }
    ],
    decisions: { low: "continue_standard_processing", medium: "route_to_finance_review", high: "hold_payment_and_escalate" },
    actions: ["Persist the decision in the ERP or AP queue", "Require human approval for payment holds", "Notify the invoice owner with matched policy reasons"],
    roiExample: "monthly invoice volume x exception rate x minutes saved x loaded hourly cost / 60"
  },
  {
    department: "human-resources",
    slug: "employee-access-request-triage",
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
      { field: "linkClicked", operator: "truthy", points: 55, reason: "A user clicked the reported link" },
      { field: "multipleRecipients", operator: "truthy", points: 25, reason: "Possible campaign affects multiple recipients" }
    ],
    decisions: { low: "queue_analyst_review", medium: "expedite_investigation", high: "initiate_containment_review" },
    actions: ["Create a case in the security queue", "Preserve message evidence", "Require analyst approval before quarantine or account actions"],
    roiExample: "reports per month x minutes saved in initial triage x analyst hourly cost / 60"
  },
  {
    department: "sales",
    slug: "enterprise-lead-routing",
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
    name: "Gate campaign leads for compliant follow-up",
    summary: "Checks consent, suppression, geography, engagement, and target-account status before campaign follow-up.",
    problem: "Campaign handoffs can create compliance risk and wasted spend when suppression and consent checks happen too late.",
    outcome: "A follow-up decision that keeps compliance facts visible and routes ambiguous records for review.",
    owner: "Marketing Operations",
    primaryMetric: "Compliant leads processed per campaign",
    required: ["leadId", "email", "campaignId", "country"],
    optional: ["consent", "suppressed", "targetAccount", "engagementScore", "existingCustomer"],
    rules: [
      { field: "consent", operator: "falsy", points: 60, reason: "Consent is missing" },
      { field: "suppressed", operator: "truthy", points: 80, reason: "Contact is on a suppression list" },
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
      { field: "dataRisk", operator: "truthy", points: 50, reason: "Potential data exposure or integrity risk" },
      { field: "workaroundAvailable", operator: "falsy", points: 20, reason: "No workaround is available" },
      { field: "regulatoryNotificationPossible", operator: "truthy", points: 45, reason: "Regulatory notification may be required" }
    ],
    decisions: { low: "standard_operations_update", medium: "activate_incident_command", high: "activate_executive_and_legal_response" },
    actions: ["Create the stakeholder brief", "Assign the next-update owner and deadline", "Require incident commander approval before external communication"],
    roiExample: "major incidents x minutes faster communication x affected staff loaded cost per minute"
  }
];

export const thresholds = {
  medium: 30,
  high: 70
};
