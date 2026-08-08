# Approve external enterprise communications

Routes proposed external communications using financial, customer, security, legal, and executive-approval signals.

## Business problem

External statements move quickly across teams while material, legal, security, and customer implications remain unclear.

## Business outcome

A visible approval route that prevents high-risk messages from bypassing accountable reviewers.

- **Primary owner:** Corporate Communications
- **Primary metric:** Time from draft to approved external communication
- **Policy version:** `1.0.1`
- **ROI starting point:** `external messages x coordination minutes saved x reviewer hourly cost / 60`

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
| `audience` | Yes | string |
| `channel` | Yes | string |
| `messageSummary` | Yes | string |
| `owner` | Yes | string |
| `materialFinancialInfo` | No | boolean |
| `customerImpact` | No | boolean |
| `securityIncident` | No | boolean |
| `legalReviewed` | No | boolean |
| `executiveApproved` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `materialFinancialInfo_truthy_1` | `materialFinancialInfo` | truthy | 60 | high | Message may contain material financial information |
| `customerImpact_truthy_2` | `customerImpact` | truthy | 30 | — | Message addresses customer impact |
| `securityIncident_truthy_3` | `securityIncident` | truthy | 60 | high | Message concerns a security incident |
| `legalReviewed_falsy_4` | `legalReviewed` | falsy | 35 | — | Legal review is not recorded |
| `executiveApproved_falsy_5` | `executiveApproved` | falsy | 25 | — | Executive approval is not recorded |

Scores below 30 use `continue_standard_editorial_review`, scores from 30-69 use `require_cross_functional_approval`, and scores of 70+ use `hold_for_executive_and_legal_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "external-communication-approval",
  "policyVersion": "1.0.1",
  "decision": "continue_standard_editorial_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create the communication approval record",
    "Attach the final approved wording",
    "Require named approval before publication"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_for_executive_and_legal_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Create the communication approval record.
- Attach the final approved wording.
- Require named approval before publication.

Typical adapters: content management, Slack, Microsoft Teams, approval tools.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `external messages x coordination minutes saved x reviewer hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n corporate communications automation, enterprise n8n workflow, external communication approval, workflow automation template.
