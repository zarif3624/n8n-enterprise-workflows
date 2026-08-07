# Triage employee phishing reports

Scores reported messages using credential theft, attachment, impersonation, click, and campaign indicators.

## Business problem

Security teams receive large volumes of suspicious-email reports with uneven context and limited prioritization.

## Business outcome

A rapid containment recommendation without automatically taking destructive security actions.

- **Primary owner:** Security Operations
- **Primary metric:** Minutes from report to analyst triage
- **ROI starting point:** `reports per month x minutes saved in initial triage x analyst hourly cost / 60`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `reportId`
- `reporterId`
- `sender`
- `subject`

Optional signals: `credentialRequested`, `suspiciousAttachment`, `executiveImpersonation`, `linkClicked`, `multipleRecipients`.

### Sample payload

```json
{
  "reportId": "reportid-001",
  "reporterId": "reporterid-001",
  "sender": "Example sender",
  "subject": "Example subject"
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `credentialRequested` | truthy | 40 | Message requests credentials |
| `suspiciousAttachment` | truthy | 35 | Suspicious attachment present |
| `executiveImpersonation` | truthy | 30 | Executive impersonation detected |
| `linkClicked` | truthy | 55 | A user clicked the reported link |
| `multipleRecipients` | truthy | 25 | Possible campaign affects multiple recipients |

Scores below 30 use `queue_analyst_review`, scores from 30-69 use `expedite_investigation`, and scores of 70+ use `initiate_containment_review`.

## Recommended production extensions

- Create a case in the security queue.
- Preserve message evidence.
- Require analyst approval before quarantine or account actions.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n security automation, enterprise n8n workflow, phishing report triage, workflow automation template.
