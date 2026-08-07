# Route enterprise service desk incidents

Assigns incident priority from impact, urgency, affected users, outage state, and executive visibility.

## Business problem

Inconsistent ticket priority creates noisy queues while genuinely disruptive incidents wait too long for the right team.

## Business outcome

A defensible routing decision with urgency, ownership guidance, and escalation reasons.

- **Primary owner:** IT Service Management
- **Primary metric:** Mean time to assignment
- **ROI starting point:** `incidents per month x minutes faster assignment x outage cost per minute`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `ticketId`
- `category`
- `summary`
- `affectedUsers`

Optional signals: `serviceDown`, `securityImpact`, `executiveAffected`, `revenueImpact`, `workaroundAvailable`.

### Sample payload

```json
{
  "ticketId": "ticketid-001",
  "category": "2026-08-07T03:00:00Z",
  "summary": "Example summary",
  "affectedUsers": 120
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `serviceDown` | truthy | 45 | Business service is unavailable |
| `securityImpact` | truthy | 55 | Potential security impact |
| `executiveAffected` | truthy | 15 | Executive user affected |
| `revenueImpact` | truthy | 35 | Incident affects revenue operations |
| `workaroundAvailable` | falsy | 20 | No workaround is available |
| `affectedUsers` | gt 100 | 30 | More than 100 users affected |

Scores below 30 use `route_standard_queue`, scores from 30-69 use `assign_priority_support`, and scores of 70+ use `open_major_incident`.

## Recommended production extensions

- Create or update the ITSM incident.
- Page the on-call team for major incidents.
- Start stakeholder communications with a human owner.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n information technology automation, enterprise n8n workflow, service desk priority routing, workflow automation template.
