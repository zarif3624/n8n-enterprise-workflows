# Prepare major incident stakeholder briefs

Turns operational incident facts into a severity decision and a consistent stakeholder communication plan.

## Business problem

During incidents, teams lose time reconciling impact facts and deciding who needs which update cadence.

## Business outcome

A severity tier, communication cadence, stakeholder list, and next update deadline.

- **Primary owner:** Business Operations and Incident Command
- **Primary metric:** Minutes from incident declaration to first stakeholder brief
- **Policy version:** `1.0.0`
- **ROI starting point:** `major incidents x minutes faster communication x affected staff loaded cost per minute`

## Five-minute adoption

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules, hard risk gates, and thresholds with the named business owner.
3. Keep the workflow inactive while testing. The imported webhook is intentionally unauthenticated for local evaluation.
4. Send `examples/low-risk.json`, `examples/high-risk.json`, and `examples/invalid.json` to the test webhook URL.
5. Configure Header Auth, Basic Auth, or another approved built-in webhook credential before activation.
6. Connect approved downstream systems only after the decision contract is verified.

```bash
curl --fail-with-body --request POST "$N8N_TEST_WEBHOOK_URL" \
  --header "Content-Type: application/json" \
  --header "X-Request-Id: local-test-001" \
  --data @examples/low-risk.json
```

## Input contract

The request body must be a JSON object. Unknown fields are preserved as caller context but are not echoed in the response.

| Field | Required | Contract |
| --- | --- | --- |
| `incidentId` | Yes | string |
| `service` | Yes | string |
| `startedAt` | Yes | string, date-time |
| `summary` | Yes | string |
| `customersAffected` | No | number, min 0 |
| `revenueImpact` | No | boolean |
| `dataRisk` | No | boolean |
| `workaroundAvailable` | No | boolean |
| `regulatoryNotificationPossible` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `customersAffected_gte_1` | `customersAffected` | gte 100 | 30 | — | At least 100 customers affected |
| `revenueImpact_truthy_2` | `revenueImpact` | truthy | 35 | — | Revenue operations are affected |
| `dataRisk_truthy_3` | `dataRisk` | truthy | 50 | high | Potential data exposure or integrity risk |
| `workaroundAvailable_falsy_4` | `workaroundAvailable` | falsy | 20 | — | No workaround is available |
| `regulatoryNotificationPossible_truthy_5` | `regulatoryNotificationPossible` | truthy | 45 | high | Regulatory notification may be required |

Scores below 30 use `standard_operations_update`, scores from 30-69 use `activate_incident_command`, and scores of 70+ use `activate_executive_and_legal_response`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "major-incident-stakeholder-brief",
  "policyVersion": "1.0.0",
  "decision": "standard_operations_update",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create the stakeholder brief",
    "Assign the next-update owner and deadline",
    "Require incident commander approval before external communication"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `activate_executive_and_legal_response` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Create the stakeholder brief.
- Assign the next-update owner and deadline.
- Require incident commander approval before external communication.

Typical adapters: incident management, Slack, Microsoft Teams, status page.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `major incidents x minutes faster communication x affected staff loaded cost per minute`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n operations automation, enterprise n8n workflow, major incident stakeholder brief, workflow automation template.
