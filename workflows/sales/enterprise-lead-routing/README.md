# Route enterprise sales leads

Scores enterprise leads using account fit, buying intent, geography, engagement, and consent before assignment.

## Business problem

High-value leads are often delayed or misrouted because qualification logic differs across forms, regions, and teams.

## Business outcome

A transparent routing recommendation with matched reasons and a clear next action for RevOps.

- **Primary owner:** Revenue Operations
- **Primary metric:** Speed to lead for qualified accounts
- **ROI starting point:** `qualified leads x conversion lift x average contract value`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `leadId`
- `company`
- `email`
- `region`

Optional signals: `employeeCount`, `targetAccount`, `highIntent`, `requestedDemo`, `marketingConsent`.

### Sample payload

```json
{
  "leadId": "leadid-001",
  "company": "Example company",
  "email": "buyer@example.com",
  "region": "North America"
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `targetAccount` | truthy | 35 | Company is a named target account |
| `employeeCount` | gte 1000 | 25 | Enterprise employee threshold met |
| `highIntent` | truthy | 25 | High-intent behavior detected |
| `requestedDemo` | truthy | 25 | Buyer requested a demonstration |
| `marketingConsent` | falsy | -40 | Marketing consent is not present |

Scores below 30 use `route_to_nurture_or_review`, scores from 30-69 use `assign_sdr_queue`, and scores of 70+ use `assign_enterprise_owner`.

## Recommended production extensions

- Upsert the lead in CRM.
- Apply regional ownership rules.
- Start an SLA timer for qualified handoff.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n sales automation, enterprise n8n workflow, enterprise lead routing, workflow automation template.
