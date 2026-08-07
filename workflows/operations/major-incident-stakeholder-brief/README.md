# Prepare major incident stakeholder briefs

Turns operational incident facts into a severity decision and a consistent stakeholder communication plan.

## Business problem

During incidents, teams lose time reconciling impact facts and deciding who needs which update cadence.

## Business outcome

A severity tier, communication cadence, stakeholder list, and next update deadline.

- **Primary owner:** Business Operations and Incident Command
- **Primary metric:** Minutes from incident declaration to first stakeholder brief
- **ROI starting point:** `major incidents x minutes faster communication x affected staff loaded cost per minute`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `incidentId`
- `service`
- `startedAt`
- `summary`

Optional signals: `customersAffected`, `revenueImpact`, `dataRisk`, `workaroundAvailable`, `regulatoryNotificationPossible`.

### Sample payload

```json
{
  "incidentId": "incidentid-001",
  "service": "Example service",
  "startedAt": "2026-08-07T03:00:00Z",
  "summary": "Example summary"
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `customersAffected` | gte 100 | 30 | At least 100 customers affected |
| `revenueImpact` | truthy | 35 | Revenue operations are affected |
| `dataRisk` | truthy | 50 | Potential data exposure or integrity risk |
| `workaroundAvailable` | falsy | 20 | No workaround is available |
| `regulatoryNotificationPossible` | truthy | 45 | Regulatory notification may be required |

Scores below 30 use `standard_operations_update`, scores from 30-69 use `activate_incident_command`, and scores of 70+ use `activate_executive_and_legal_response`.

## Recommended production extensions

- Create the stakeholder brief.
- Assign the next-update owner and deadline.
- Require incident commander approval before external communication.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n operations automation, enterprise n8n workflow, major incident stakeholder brief, workflow automation template.
