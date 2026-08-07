# Route enterprise contract requests

Routes contract intake using document type, value, jurisdiction, data access, and non-standard terms.

## Business problem

Legal requests arrive without enough commercial or risk context, creating avoidable back-and-forth and slow review cycles.

## Business outcome

A normalized legal intake route with risk reasons and required reviewers.

- **Primary owner:** Legal Operations
- **Primary metric:** Contract request time to first review
- **ROI starting point:** `monthly contracts x reduction in intake rework minutes x legal hourly cost / 60`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `requestId`
- `contractType`
- `counterparty`
- `contractValue`

Optional signals: `nonStandardTerms`, `personalData`, `crossBorderData`, `autoRenewal`, `regulatedIndustry`.

### Sample payload

```json
{
  "requestId": "requestid-001",
  "contractType": "Example contractType",
  "counterparty": 120,
  "contractValue": 125000
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `nonStandardTerms` | truthy | 30 | Non-standard terms requested |
| `personalData` | truthy | 25 | Agreement involves personal data |
| `crossBorderData` | truthy | 30 | Cross-border data transfer involved |
| `autoRenewal` | truthy | 15 | Automatic renewal clause present |
| `regulatedIndustry` | truthy | 30 | Counterparty operates in a regulated industry |
| `contractValue` | gte 250000 | 25 | High-value agreement |

Scores below 30 use `use_standard_legal_queue`, scores from 30-69 use `assign_specialist_review`, and scores of 70+ use `open_cross_functional_review`.

## Recommended production extensions

- Create the legal matter.
- Attach the structured intake fields.
- Require legal approval before signature or redline acceptance.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n legal automation, enterprise n8n workflow, contract intake routing, workflow automation template.
