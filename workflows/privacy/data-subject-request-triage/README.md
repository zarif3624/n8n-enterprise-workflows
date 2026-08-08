# Triage data subject requests

Prioritizes privacy requests using identity, deadline, sensitivity, third-party, and legal-hold signals.

## Business problem

Privacy requests have strict deadlines and often require coordination across identity, legal, security, and data-owning teams.

## Business outcome

A deadline-aware route that keeps identity verification and legal constraints visible before fulfillment.

- **Primary owner:** Privacy Operations
- **Primary metric:** Data subject requests completed within policy deadline
- **Policy version:** `1.0.1`
- **ROI starting point:** `annual privacy requests x handling hours saved x privacy operations hourly cost`

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
| `requestId` | Yes | string |
| `requestType` | Yes | string |
| `requesterRegion` | Yes | string |
| `receivedAt` | Yes | string, date-time |
| `identityVerified` | No | boolean |
| `deadlineDays` | No | number, min 0 |
| `sensitiveData` | No | boolean |
| `thirdPartyData` | No | boolean |
| `legalHold` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `identityVerified_falsy_1` | `identityVerified` | falsy | 50 | high | Requester identity is not verified |
| `deadlineDays_lt_2` | `deadlineDays` | lt 7 | 35 | — | Fewer than seven days remain |
| `sensitiveData_truthy_3` | `sensitiveData` | truthy | 30 | — | Request involves sensitive data |
| `thirdPartyData_truthy_4` | `thirdPartyData` | truthy | 25 | — | Responsive records may contain third-party data |
| `legalHold_truthy_5` | `legalHold` | truthy | 60 | high | Responsive data is subject to legal hold |

Scores below 30 use `continue_standard_privacy_queue`, scores from 30-69 use `assign_privacy_specialist_review`, and scores of 70+ use `hold_for_identity_or_legal_review`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "data-subject-request-triage",
  "policyVersion": "1.0.1",
  "decision": "continue_standard_privacy_queue",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create the privacy case",
    "Record the governing deadline",
    "Require privacy or legal approval before disclosure or deletion"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_for_identity_or_legal_review` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Create the privacy case.
- Record the governing deadline.
- Require privacy or legal approval before disclosure or deletion.

Typical adapters: privacy management, CRM, data catalog, ticketing, document storage.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `annual privacy requests x handling hours saved x privacy operations hourly cost`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n privacy automation, enterprise n8n workflow, data subject request triage, workflow automation template.
