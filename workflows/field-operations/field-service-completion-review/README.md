# Review field service completion evidence

Checks evidence, completion criteria, parts and warranty exceptions, and proposed financial, scheduling, or customer actions after field work.

## Business problem

Field work cannot close reliably when documentation, parts, warranty, scheduling, customer, and billing exceptions are handled inconsistently.

## Business outcome

A completion recommendation and exception record that reserves financial, scheduling, customer, and closure actions for human review.

- **Primary owner:** Field Operations
- **Primary metric:** Documentation completeness
- **Policy version:** `1.0.7`
- **ROI starting point:** `field visits per month x completion-review minutes saved x field operations hourly cost / 60`

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
| `serviceJobId` | Yes | string, pattern \S |
| `visitCompletedAt` | Yes | string, date-time, pattern \S |
| `evidenceComplete` | Yes | boolean |
| `completionChecklistPercent` | Yes | number, min 0, max 100 |
| `paymentReleaseProposed` | No | boolean |
| `customerMessageDrafted` | No | boolean |
| `rescheduleProposed` | No | boolean |
| `partsException` | No | boolean |
| `warrantyException` | No | boolean |
| `humanResolutionRequired` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `evidenceComplete_falsy_1` | `evidenceComplete` | falsy | 45 | — | Required field-service evidence is incomplete |
| `completionChecklistPercent_lt_2` | `completionChecklistPercent` | lt 100 | 35 | — | The completion checklist is incomplete |
| `paymentReleaseProposed_truthy_3` | `paymentReleaseProposed` | truthy | 70 | high | A financial release is proposed |
| `customerMessageDrafted_truthy_4` | `customerMessageDrafted` | truthy | 40 | — | A customer-facing message requires review |
| `rescheduleProposed_truthy_5` | `rescheduleProposed` | truthy | 70 | high | A customer-impacting reschedule is proposed |
| `partsException_truthy_6` | `partsException` | truthy | 30 | — | A parts or inventory exception remains open |
| `warrantyException_truthy_7` | `warrantyException` | truthy | 35 | — | A warranty exception remains open |
| `humanResolutionRequired_truthy_8` | `humanResolutionRequired` | truthy | 70 | high | The case is explicitly marked for human resolution |

Scores below 30 use `recommend_service_completion_for_owner_review`, scores from 30-69 use `route_service_exceptions_to_field_operations`, and scores of 70+ use `hold_financial_customer_or_closure_action_for_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "field-service-completion-review",
  "policyVersion": "1.0.7",
  "decision": "recommend_service_completion_for_owner_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present completion evidence and open exceptions to the field-service owner",
    "Recommend follow-up for documentation, parts, or warranty gaps",
    "Keep billing, payment, scheduling, customer messaging, inventory writes, and closure outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_financial_customer_or_closure_action_for_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present completion evidence and open exceptions to the field-service owner.
- Recommend follow-up for documentation, parts, or warranty gaps.
- Keep billing, payment, scheduling, customer messaging, inventory writes, and closure outside the starter.

Typical adapters: Field-service system, Accounting, Documents, Inventory and assets, Messaging.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `field visits per month x completion-review minutes saved x field operations hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n field operations automation, enterprise n8n workflow, field service completion review, workflow automation template.
