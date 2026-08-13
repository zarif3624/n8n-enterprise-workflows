# Review closed-won launch readiness

Checks order, scope, prerequisites, ownership, and provisioning exceptions before implementation launch activities are recommended.

## Business problem

Closed-won handoffs lose scope and delay time to value when order details, prerequisites, owners, and provisioning exceptions are incomplete.

## Business outcome

An explainable launch-readiness recommendation that keeps provisioning, entitlement changes, and scheduling human-controlled.

- **Primary owner:** Revenue Operations
- **Primary metric:** Time to kickoff
- **Policy version:** `1.0.7`
- **ROI starting point:** `closed-won launches per month x handoff minutes saved x revenue operations hourly cost / 60`

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
| `opportunityId` | Yes | string, pattern \S |
| `accountId` | Yes | string, pattern \S |
| `scopeConfirmed` | Yes | boolean |
| `prerequisiteCompletionPercent` | Yes | number, min 0, max 100 |
| `orderValidated` | No | boolean |
| `complexScope` | No | boolean |
| `provisioningException` | No | boolean |
| `entitlementChangeProposed` | No | boolean |
| `kickoffScheduled` | No | boolean |
| `launchOwnerAssigned` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `scopeConfirmed_falsy_1` | `scopeConfirmed` | falsy | 45 | — | Implementation scope is not confirmed |
| `prerequisiteCompletionPercent_lt_2` | `prerequisiteCompletionPercent` | lt 100 | 30 | — | Launch prerequisites are incomplete |
| `orderValidated_falsy_3` | `orderValidated` | falsy | 40 | — | The closed-won order has not been validated |
| `complexScope_truthy_4` | `complexScope` | truthy | 35 | — | The opportunity has complex implementation scope |
| `provisioningException_truthy_5` | `provisioningException` | truthy | 70 | high | Provisioning requires an exception |
| `entitlementChangeProposed_truthy_6` | `entitlementChangeProposed` | truthy | 70 | high | An entitlement change is proposed |
| `launchOwnerAssigned_falsy_7` | `launchOwnerAssigned` | falsy | 35 | — | No accountable launch owner is assigned |

Scores below 30 use `recommend_launch_checklist_for_owner_review`, scores from 30-69 use `route_launch_gaps_to_revenue_operations`, and scores of 70+ use `hold_provisioning_for_exception_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "closed-won-launch-readiness",
  "policyVersion": "1.0.7",
  "decision": "recommend_launch_checklist_for_owner_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present scope and prerequisite evidence to the launch owner",
    "Recommend owners for unresolved launch checklist items",
    "Keep workspace creation, provisioning, entitlements, and scheduling outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_provisioning_for_exception_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present scope and prerequisite evidence to the launch owner.
- Recommend owners for unresolved launch checklist items.
- Keep workspace creation, provisioning, entitlements, and scheduling outside the starter.

Typical adapters: CRM, Project system, Product APIs, Calendar, Document tools.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `closed-won launches per month x handoff minutes saved x revenue operations hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n revenue operations automation, enterprise n8n workflow, closed won launch readiness, workflow automation template.
