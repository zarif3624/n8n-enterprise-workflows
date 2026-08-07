# Escalate at-risk enterprise customers

Combines adoption, support, sentiment, renewal, and stakeholder signals into a customer-risk response.

## Business problem

Customer risk signals are distributed across systems and often become visible only after renewal conversations deteriorate.

## Business outcome

An explainable intervention priority and recommended customer-success action plan.

- **Primary owner:** Customer Success Operations
- **Primary metric:** At-risk accounts engaged before renewal
- **ROI starting point:** `at-risk ARR x reduction in preventable churn rate`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `accountId`
- `accountName`
- `arr`
- `renewalDays`

Optional signals: `usageDropPercent`, `criticalTickets`, `negativeSentiment`, `championLeft`, `execSponsorMissing`.

### Sample payload

```json
{
  "accountId": 120,
  "accountName": 120,
  "arr": 125000,
  "renewalDays": 120
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `usageDropPercent` | gte 30 | 30 | Usage dropped at least 30% |
| `criticalTickets` | gte 2 | 30 | Multiple critical support tickets |
| `negativeSentiment` | truthy | 25 | Negative customer sentiment detected |
| `championLeft` | truthy | 35 | Customer champion departed |
| `execSponsorMissing` | truthy | 20 | No executive sponsor is mapped |
| `renewalDays` | lt 60 | 20 | Renewal is less than 60 days away |

Scores below 30 use `continue_success_plan`, scores from 30-69 use `open_risk_workstream`, and scores of 70+ use `launch_executive_save_plan`.

## Recommended production extensions

- Update customer health in the CS platform.
- Assign a named intervention owner.
- Require executive review before commercial concessions.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n customer success automation, enterprise n8n workflow, customer risk escalation, workflow automation template.
