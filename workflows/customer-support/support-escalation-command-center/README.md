# Review support escalation command-center readiness

Prioritizes high-severity escalation evidence, ownership, telemetry, stale actions, timelines, and external-update drafts.

## Business problem

High-severity support cases lose time when customer, product, engineering, and telemetry context is incomplete or out of sync.

## Business outcome

An explainable command-center recommendation that preserves human review for external communication and case closure.

- **Primary owner:** Customer Support
- **Primary metric:** Time to mobilize
- **Policy version:** `1.0.8`
- **ROI starting point:** `high-severity escalations per month x mobilization minutes saved x support hourly cost / 60`

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
| `escalationId` | Yes | string, pattern \S |
| `severity` | Yes | string, one of low, medium, high, critical, pattern \S |
| `customerImpactSummary` | Yes | string, pattern \S |
| `openActionCount` | Yes | number, min 0 |
| `telemetryAttached` | No | boolean |
| `staleActionCount` | No | number, min 0 |
| `externalUpdateDrafted` | No | boolean |
| `engineeringOwnerAssigned` | No | boolean |
| `timelineSynchronized` | No | boolean |
| `closureProposed` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `severity_equals_1` | `severity` | equals critical | 70 | high | The escalation is classified as critical |
| `telemetryAttached_falsy_2` | `telemetryAttached` | falsy | 35 | — | Telemetry evidence is not attached |
| `staleActionCount_gt_3` | `staleActionCount` | gt 0 | 30 | — | The escalation has stale actions |
| `externalUpdateDrafted_truthy_4` | `externalUpdateDrafted` | truthy | 70 | high | An external customer update requires review |
| `engineeringOwnerAssigned_falsy_5` | `engineeringOwnerAssigned` | falsy | 35 | — | No engineering owner is assigned |
| `timelineSynchronized_falsy_6` | `timelineSynchronized` | falsy | 30 | — | The escalation timeline is not synchronized |
| `closureProposed_truthy_7` | `closureProposed` | truthy | 70 | high | Escalation closure requires human review |

Scores below 30 use `recommend_command_center_record_for_review`, scores from 30-69 use `route_stale_or_incomplete_actions_to_owners`, and scores of 70+ use `hold_external_update_or_closure_for_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "support-escalation-command-center",
  "policyVersion": "1.0.8",
  "decision": "recommend_command_center_record_for_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present the escalation timeline, telemetry, and ownership gaps",
    "Recommend action owners and evidence follow-ups",
    "Keep external messages, support-system writes, and closure outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_external_update_or_closure_for_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present the escalation timeline, telemetry, and ownership gaps.
- Recommend action owners and evidence follow-ups.
- Keep external messages, support-system writes, and closure outside the starter.

Typical adapters: Support platform, CRM, Collaboration, Engineering tracker, Telemetry.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `high-severity escalations per month x mobilization minutes saved x support hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n customer support automation, enterprise n8n workflow, support escalation command center, workflow automation template.
