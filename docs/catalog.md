# Enterprise workflow catalog

The catalog is organized by the team that owns the business outcome, not by the vendor node used to implement it. Every package ships as an inactive, credential-free decision service with a versioned policy, typed input contract, explainable score, representative fixtures, and an ROI starting point.

| Department | Workflow | Primary metric | Typical production adapters |
| --- | --- | --- | --- |
| Finance | [Triage enterprise invoice exceptions](../workflows/finance/invoice-exception-triage) | Minutes of manual review avoided per invoice | SAP, Oracle, NetSuite, Coupa, Slack |
| Human Resources | [Triage employee access requests](../workflows/human-resources/employee-access-request-triage) | Access-request cycle time | Workday, Okta, Microsoft Entra ID, ServiceNow |
| Information Technology | [Route enterprise service desk incidents](../workflows/information-technology/service-desk-priority-routing) | Mean time to assignment | ServiceNow, Jira Service Management, PagerDuty |
| Security | [Triage employee phishing reports](../workflows/security/phishing-report-triage) | Minutes from report to analyst triage | Microsoft 365, Google Workspace, SIEM, SOAR |
| Sales | [Route enterprise sales leads](../workflows/sales/enterprise-lead-routing) | Speed to lead for qualified accounts | Salesforce, HubSpot, enrichment and routing tools |
| Marketing | [Gate campaign leads for compliant follow-up](../workflows/marketing/campaign-lead-compliance-gate) | Compliant leads processed per campaign | marketing automation, CRM, consent platform |
| Customer Success | [Escalate at-risk enterprise customers](../workflows/customer-success/customer-risk-escalation) | At-risk accounts engaged before renewal | customer success platform, CRM, support desk |
| Legal | [Route enterprise contract requests](../workflows/legal/contract-intake-routing) | Contract request time to first review | CLM, e-signature, ticketing, document storage |
| Procurement | [Triage enterprise vendor risk](../workflows/procurement/vendor-risk-intake) | Vendor request time to correct review path | procurement suite, GRC, security questionnaires |
| Operations | [Prepare major incident stakeholder briefs](../workflows/operations/major-incident-stakeholder-brief) | Minutes from incident declaration to first stakeholder brief | incident management, Slack, Microsoft Teams, status page |
| Data And Analytics | [Triage enterprise data access requests](../workflows/data-and-analytics/data-access-request-triage) | Time from request to governed data access | Snowflake, Databricks, BigQuery, data catalog, ticketing |
| Engineering | [Gate production changes by operational risk](../workflows/engineering/production-change-risk-gate) | Change lead time without increasing failure rate | GitHub, GitLab, Jira, change management, incident management |
| Facilities | [Route workplace incidents safely](../workflows/facilities/workplace-incident-routing) | Minutes from report to accountable responder | facilities management, physical security, Slack, Microsoft Teams |
| Corporate Communications | [Approve external enterprise communications](../workflows/corporate-communications/external-communication-approval) | Time from draft to approved external communication | content management, Slack, Microsoft Teams, approval tools |
| Privacy | [Triage data subject requests](../workflows/privacy/data-subject-request-triage) | Data subject requests completed within policy deadline | privacy management, CRM, data catalog, ticketing, document storage |
| Risk And Compliance | [Triage enterprise AI use cases](../workflows/risk-and-compliance/ai-use-case-risk-intake) | Time from AI use-case submission to accountable decision | GRC, AI inventory, model registry, data catalog, ServiceNow, Jira |

## Planned departments and packs

- Product operations
- Quality and audit
- Industry-specific controls and approval patterns
