# Review customer health actions

Evaluates account signals, health evidence, ownership, billing and support risk, outreach, and commercial-action proposals.

## Business problem

Customer health signals produce inconsistent onboarding, risk, renewal, or expansion actions when evidence and ownership are scattered.

## Business outcome

An explainable play recommendation that keeps high-impact outreach and commercial actions with the customer owner.

- **Primary owner:** Customer Success
- **Primary metric:** Risk coverage
- **Policy version:** `1.0.7`
- **ROI starting point:** `managed accounts x health-review minutes saved per month x customer success hourly cost / 60`

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
| `accountId` | Yes | string, pattern \S |
| `lifecycleStage` | Yes | string, pattern \S |
| `signalCount` | Yes | number, min 0 |
| `healthEvidenceComplete` | Yes | boolean |
| `highImpactOutreachProposed` | No | boolean |
| `commercialActionProposed` | No | boolean |
| `billingRisk` | No | boolean |
| `supportEscalationOpen` | No | boolean |
| `ownerAssigned` | No | boolean |
| `outcomeTrackingConfigured` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `healthEvidenceComplete_falsy_1` | `healthEvidenceComplete` | falsy | 45 | — | Customer health evidence is incomplete |
| `signalCount_lt_2` | `signalCount` | lt 2 | 30 | — | The recommendation is supported by fewer than two signals |
| `highImpactOutreachProposed_truthy_3` | `highImpactOutreachProposed` | truthy | 70 | high | High-impact customer outreach is proposed |
| `commercialActionProposed_truthy_4` | `commercialActionProposed` | truthy | 70 | high | A renewal, expansion, or other commercial action is proposed |
| `billingRisk_truthy_5` | `billingRisk` | truthy | 35 | — | The account has a billing risk signal |
| `supportEscalationOpen_truthy_6` | `supportEscalationOpen` | truthy | 40 | — | The account has an open support escalation |
| `ownerAssigned_falsy_7` | `ownerAssigned` | falsy | 35 | — | No customer owner is assigned |
| `outcomeTrackingConfigured_falsy_8` | `outcomeTrackingConfigured` | falsy | 25 | — | Outcome tracking is not configured |

Scores below 30 use `recommend_customer_play_for_owner_review`, scores from 30-69 use `route_health_risks_to_customer_owner`, and scores of 70+ use `hold_outreach_or_commercial_action_for_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "customer-health-action-review",
  "policyVersion": "1.0.7",
  "decision": "recommend_customer_play_for_owner_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present the supporting account signals and matched reasons",
    "Recommend an onboarding, risk, renewal, or expansion play for owner review",
    "Keep CRM tasks, customer outreach, billing changes, and commercial actions outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_outreach_or_commercial_action_for_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present the supporting account signals and matched reasons.
- Recommend an onboarding, risk, renewal, or expansion play for owner review.
- Keep CRM tasks, customer outreach, billing changes, and commercial actions outside the starter.

Typical adapters: Product usage, CRM, Support, Billing, Communication, Data warehouse.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `managed accounts x health-review minutes saved per month x customer success hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n customer success automation, enterprise n8n workflow, customer health action review, workflow automation template.
