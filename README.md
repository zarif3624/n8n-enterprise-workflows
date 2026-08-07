# n8n Enterprise Workflows

Production-minded, open-source n8n workflow templates for enterprise teams.
Each package combines an importable workflow, implementation instructions,
sample data, policy logic, security gates, business value, and an ROI model.

[![Validate workflows](https://github.com/zarif3624/n8n-enterprise-workflows/actions/workflows/validate.yml/badge.svg)](https://github.com/zarif3624/n8n-enterprise-workflows/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-111827.svg)](LICENSE)
[![n8n](https://img.shields.io/badge/n8n-workflows-EA4B71.svg)](https://n8n.io/)

> Start with a decision workflow, prove the policy, then connect enterprise
> systems. Templates never include credentials or make irreversible changes.

## Why this project exists

Most workflow galleries show what a tool can connect. Enterprise teams need
more: ownership, input contracts, failure behavior, human approvals, security
controls, measurable outcomes, and a path from development to production.

This project makes those concerns part of each workflow package.

## Workflow catalog

| Department | Workflow | Business outcome |
| --- | --- | --- |
| Finance | [Invoice exception triage](workflows/finance/invoice-exception-triage) | Route clean invoices, reviews, and payment holds consistently |
| Human Resources | [Employee access request triage](workflows/human-resources/employee-access-request-triage) | Separate standard access from privileged review |
| Information Technology | [Service desk priority routing](workflows/information-technology/service-desk-priority-routing) | Reduce incident assignment time |
| Security | [Phishing report triage](workflows/security/phishing-report-triage) | Prioritize containment review without destructive automation |
| Sales | [Enterprise lead routing](workflows/sales/enterprise-lead-routing) | Improve speed to lead for qualified accounts |
| Marketing | [Campaign lead compliance gate](workflows/marketing/campaign-lead-compliance-gate) | Keep consent and suppression decisions visible |
| Customer Success | [Customer risk escalation](workflows/customer-success/customer-risk-escalation) | Engage at-risk accounts before renewal |
| Legal | [Contract intake routing](workflows/legal/contract-intake-routing) | Send contracts to the correct review path sooner |
| Procurement | [Vendor risk intake](workflows/procurement/vendor-risk-intake) | Start security, privacy, and legal diligence earlier |
| Operations | [Major incident stakeholder brief](workflows/operations/major-incident-stakeholder-brief) | Accelerate consistent incident communications |

Browse the machine-readable [catalog](catalog.json) or the
[department index](docs/catalog.md).

## Five-minute start

### Option A: Import in n8n

1. Download a package's `workflow.json`.
2. In an n8n development project, choose **Import from File**.
3. Read the sticky note and companion README.
4. Send the sample payload to the test webhook URL.
5. Review the response with the business owner before connecting downstream systems.

The templates ship inactive and use unauthenticated webhooks for local testing.
Configure n8n's built-in webhook authentication before production activation.

### Option B: Attach a workflow to Codex through n8n MCP

1. Follow [Set up n8n MCP](docs/mcp-setup.md).
2. Install the [official n8n agent skills](https://github.com/n8n-io/skills).
3. Attach [the starter invoice workflow](workflows/finance/invoice-exception-triage/workflow.json) to your Codex task.
4. Use the prompt in [MCP-assisted adoption](docs/mcp-adoption.md).
5. Let Codex validate and create the workflow in your n8n development project.

## Enterprise design principles

- **Policy before plumbing:** validate decision logic before adding external writes.
- **Human authority:** consequential financial, security, legal, employment, and customer actions require approval.
- **No embedded secrets:** configure credentials only in n8n's credential system.
- **Inactive by default:** importing a template cannot expose a live endpoint.
- **Observable outcomes:** every workflow returns a request ID, score, reasons, decision, and recommended actions.
- **Promotion discipline:** test in development and promote through reviewed environments.
- **Measurable value:** every workflow names an operational metric and ROI starting point.

Read the complete [enterprise readiness checklist](docs/enterprise-readiness.md)
and [security model](SECURITY.md).

## Validate locally

```bash
npm run check
```

The validator checks workflow shape, node identity, connection integrity,
unique webhook paths, inactive status, response behavior, credential leakage,
companion documentation, and catalog coverage.

## Release rhythm

The project targets two useful releases each week. A release should normally add
one enterprise workflow package. Improvements to an existing workflow are
appropriate when they fix a real adoption, correctness, security, or operability
problem. See the [release process](docs/release-process.md).

## Roadmap

- Native adapters for Salesforce, ServiceNow, Slack, Microsoft Teams, SAP, Workday, and common data warehouses
- Human-approval sub-workflows and reusable error handlers
- Industry packs for financial services, healthcare, software, and professional services
- Automated import validation against supported n8n releases
- Outcome benchmarks and community-submitted deployment notes

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Workflow requests are especially
valuable when they include the department, trigger, systems, approval points,
risk level, and measurable outcome.

## License

MIT. n8n is a trademark of n8n GmbH. This community project is not an official
n8n project and is not endorsed by n8n GmbH.

Built by [Zarif](https://github.com/zarif3624), creator of
[Zarif Automates](https://zarifautomates.com).
