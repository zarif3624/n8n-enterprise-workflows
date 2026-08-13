# Review meeting decisions and actions

Checks extracted decisions, owners, due dates, approved context, and proposed follow-ups before any task, message, or system update.

## Business problem

Meeting decisions and commitments are lost or misapplied when extracted actions lack owners, due dates, approved context, or review.

## Business outcome

A reviewed action package recommendation that keeps external communication and system writes behind human approval.

- **Primary owner:** Sales & Operations
- **Primary metric:** Follow-through rate
- **Policy version:** `1.0.7`
- **ROI starting point:** `meetings per month x action-review minutes saved x operations hourly cost / 60`

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
| `meetingId` | Yes | string, pattern \S |
| `meetingEndedAt` | Yes | string, date-time, pattern \S |
| `actionCount` | Yes | number, min 0 |
| `decisionCount` | Yes | number, min 0 |
| `externalFollowUpDrafted` | No | boolean |
| `crmUpdateProposed` | No | boolean |
| `ownerMissing` | No | boolean |
| `dueDateMissing` | No | boolean |
| `sensitiveContent` | No | boolean |
| `sourceContextApproved` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `ownerMissing_truthy_1` | `ownerMissing` | truthy | 35 | — | At least one action has no accountable owner |
| `dueDateMissing_truthy_2` | `dueDateMissing` | truthy | 25 | — | At least one action has no due date |
| `externalFollowUpDrafted_truthy_3` | `externalFollowUpDrafted` | truthy | 35 | — | An external follow-up draft requires review |
| `crmUpdateProposed_truthy_4` | `crmUpdateProposed` | truthy | 30 | — | A CRM update is proposed |
| `sensitiveContent_truthy_5` | `sensitiveContent` | truthy | 70 | high | The meeting record contains sensitive content |
| `sourceContextApproved_falsy_6` | `sourceContextApproved` | falsy | 45 | — | The source context has not been approved for action extraction |

Scores below 30 use `recommend_action_package_for_review`, scores from 30-69 use `route_draft_actions_to_owner_review`, and scores of 70+ use `hold_follow_up_for_human_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "meeting-to-action-review",
  "policyVersion": "1.0.7",
  "decision": "recommend_action_package_for_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present extracted decisions, owners, and due dates for review",
    "Recommend corrections to incomplete action records",
    "Keep task creation, CRM writes, and external follow-ups outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_follow_up_for_human_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present extracted decisions, owners, and due dates for review.
- Recommend corrections to incomplete action records.
- Keep task creation, CRM writes, and external follow-ups outside the starter.

Typical adapters: Calendar, Meeting system, Document store, CRM, Ticketing.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `meetings per month x action-review minutes saved x operations hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n operations automation, enterprise n8n workflow, meeting to action review, workflow automation template.
