# Enterprise workflow catalog

The catalog is organized by the team that owns the business outcome, not by the vendor node used to implement it. Every package ships as an inactive, credential-free decision service with a versioned policy, typed input contract, explainable score, representative fixtures, and an ROI starting point.

| Department | Workflow | Primary metric | Typical production adapters |
| --- | --- | --- | --- |
| Finance | [Triage enterprise invoice exceptions](../workflows/finance/invoice-exception-triage) | Minutes of manual review avoided per invoice | SAP, Oracle, NetSuite, Coupa, Slack |
| Information Technology | [Route enterprise service desk incidents](../workflows/information-technology/service-desk-priority-routing) | Mean time to assignment | ServiceNow, Jira Service Management, PagerDuty |
| Security | [Triage employee phishing reports](../workflows/security/phishing-report-triage) | Minutes from report to analyst triage | Microsoft 365, Google Workspace, SIEM, SOAR |
| Engineering | [Gate production changes by operational risk](../workflows/engineering/production-change-risk-gate) | Change lead time without increasing failure rate | GitHub, GitLab, Jira, change management, incident management |
| Artificial Intelligence | [Gate agent releases with evaluation evidence](../workflows/artificial-intelligence/agent-evaluation-release-gate) | Regression escape rate | Evaluation service, Model providers, Source control, Ticketing, Observability |
| Artificial Intelligence | [Review multi-model routing and fallback](../workflows/artificial-intelligence/multi-model-routing-fallback) | Fallback rate | Approved model providers, Policy store, Observability, Cost telemetry |
| Data Operations | [Control enterprise data reconciliation exceptions](../workflows/data-operations/enterprise-data-reconciliation-control) | Variance rate | Databases, Data warehouses, Spreadsheets, Case store, Data quality tools |
| Operations | [Review meeting decisions and actions](../workflows/operations/meeting-to-action-review) | Follow-through rate | Calendar, Meeting system, Document store, CRM, Ticketing |
| Sales | [Review source-backed research for CRM action](../workflows/sales/research-to-crm-review) | Signal-to-action conversion | Research providers, CRM, Document store, Collaboration, Data enrichment |
| Revenue Operations | [Review closed-won launch readiness](../workflows/revenue-operations/closed-won-launch-readiness) | Time to kickoff | CRM, Project system, Product APIs, Calendar, Document tools |
| Incident Management | [Review incident RCA evidence](../workflows/incident-management/incident-rca-evidence-review) | Evidence completeness | Collaboration, Observability, Work tracking, Source control, Knowledge base |
| Proposal Management | [Review RFP response evidence](../workflows/proposal-management/rfp-response-evidence-review) | Unsupported-claim rate | File processing, Knowledge base, Document generation, CRM, Review queue |
| Customer Support | [Review support escalation command-center readiness](../workflows/customer-support/support-escalation-command-center) | Time to mobilize | Support platform, CRM, Collaboration, Engineering tracker, Telemetry |
| People Operations | [Route people operations cases for review](../workflows/people-operations/people-operations-case-routing) | Case cycle time | HRIS, Identity, Payroll, Workplace service systems, Forms |
| Customer Success | [Review customer health actions](../workflows/customer-success/customer-health-action-review) | Risk coverage | Product usage, CRM, Support, Billing, Communication, Data warehouse |
| Field Operations | [Review field service completion evidence](../workflows/field-operations/field-service-completion-review) | Documentation completeness | Field-service system, Accounting, Documents, Inventory and assets, Messaging |

## Community roadmap

- Deeper vendor-neutral mappings and adoption guides for the sixteen public workflows
- Reusable safety, privacy, validation, and error-handling patterns
- Stronger conformance, governance, compatibility, and release evidence

The public catalog is intentionally focused. Read the [open-core model](open-core-model.md) before proposing another workflow family.
