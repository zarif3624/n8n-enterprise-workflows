# Route enterprise service desk incidents

Assigns incident priority from impact, urgency, affected users, outage state, and executive visibility.

## Business problem

Inconsistent ticket priority creates noisy queues while genuinely disruptive incidents wait too long for the right team.

## Business outcome

A defensible routing decision with urgency, ownership guidance, and escalation reasons.

- **Primary owner:** IT Service Management
- **Primary metric:** Mean time to assignment
- **Policy version:** `1.0.1`
- **ROI starting point:** `incidents per month x minutes faster assignment x outage cost per minute`

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

The request body must be a JSON object. Unknown fields are accepted for caller compatibility but ignored by the policy and never echoed in the response.

| Field | Required | Contract |
| --- | --- | --- |
| `ticketId` | Yes | string |
| `category` | Yes | string |
| `summary` | Yes | string |
| `affectedUsers` | Yes | number, min 0 |
| `serviceDown` | No | boolean |
| `securityImpact` | No | boolean |
| `executiveAffected` | No | boolean |
| `revenueImpact` | No | boolean |
| `workaroundAvailable` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `serviceDown_truthy_1` | `serviceDown` | truthy | 45 | — | Business service is unavailable |
| `securityImpact_truthy_2` | `securityImpact` | truthy | 55 | — | Potential security impact |
| `executiveAffected_truthy_3` | `executiveAffected` | truthy | 15 | — | Executive user affected |
| `revenueImpact_truthy_4` | `revenueImpact` | truthy | 35 | — | Incident affects revenue operations |
| `workaroundAvailable_falsy_5` | `workaroundAvailable` | falsy | 20 | — | No workaround is available |
| `affectedUsers_gt_6` | `affectedUsers` | gt 100 | 30 | — | More than 100 users affected |

Scores below 30 use `route_standard_queue`, scores from 30-69 use `assign_priority_support`, and scores of 70+ use `open_major_incident`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "service-desk-priority-routing",
  "policyVersion": "1.0.1",
  "decision": "route_standard_queue",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create or update the ITSM incident",
    "Page the on-call team for major incidents",
    "Start stakeholder communications with a human owner"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `open_major_incident` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Create or update the ITSM incident.
- Page the on-call team for major incidents.
- Start stakeholder communications with a human owner.

Typical adapters: ServiceNow, Jira Service Management, PagerDuty.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `incidents per month x minutes faster assignment x outage cost per minute`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n information technology automation, enterprise n8n workflow, service desk priority routing, workflow automation template.
