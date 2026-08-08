# Route enterprise sales leads

Scores enterprise leads using account fit, buying intent, geography, engagement, and consent before assignment.

## Business problem

High-value leads are often delayed or misrouted because qualification logic differs across forms, regions, and teams.

## Business outcome

A transparent routing recommendation with matched reasons and a clear next action for RevOps.

- **Primary owner:** Revenue Operations
- **Primary metric:** Speed to lead for qualified accounts
- **Policy version:** `1.0.3`
- **ROI starting point:** `qualified leads x conversion lift x average contract value`

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
| `leadId` | Yes | string |
| `company` | Yes | string |
| `email` | Yes | string, email |
| `region` | Yes | string |
| `employeeCount` | No | number, min 0 |
| `targetAccount` | No | boolean |
| `highIntent` | No | boolean |
| `requestedDemo` | No | boolean |
| `marketingConsent` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `targetAccount_truthy_1` | `targetAccount` | truthy | 35 | — | Company is a named target account |
| `employeeCount_gte_2` | `employeeCount` | gte 1000 | 25 | — | Enterprise employee threshold met |
| `highIntent_truthy_3` | `highIntent` | truthy | 25 | — | High-intent behavior detected |
| `requestedDemo_truthy_4` | `requestedDemo` | truthy | 25 | — | Buyer requested a demonstration |
| `marketingConsent_falsy_5` | `marketingConsent` | falsy | -40 | — | Marketing consent is not present |

Scores below 30 use `route_to_nurture_or_review`, scores from 30-69 use `assign_sdr_queue`, and scores of 70+ use `assign_enterprise_owner`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "enterprise-lead-routing",
  "policyVersion": "1.0.3",
  "decision": "route_to_nurture_or_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Upsert the lead in CRM",
    "Apply regional ownership rules",
    "Start an SLA timer for qualified handoff"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `assign_enterprise_owner` in the `high` band with score 70. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Upsert the lead in CRM.
- Apply regional ownership rules.
- Start an SLA timer for qualified handoff.

Typical adapters: Salesforce, HubSpot, enrichment and routing tools.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `qualified leads x conversion lift x average contract value`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n sales automation, enterprise n8n workflow, enterprise lead routing, workflow automation template.
