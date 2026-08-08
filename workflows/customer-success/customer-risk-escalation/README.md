# Escalate at-risk enterprise customers

Combines adoption, support, sentiment, renewal, and stakeholder signals into a customer-risk response.

## Business problem

Customer risk signals are distributed across systems and often become visible only after renewal conversations deteriorate.

## Business outcome

An explainable intervention priority and recommended customer-success action plan.

- **Primary owner:** Customer Success Operations
- **Primary metric:** At-risk accounts engaged before renewal
- **Policy version:** `1.0.1`
- **ROI starting point:** `at-risk ARR x reduction in preventable churn rate`

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
| `accountId` | Yes | string |
| `accountName` | Yes | string |
| `arr` | Yes | number, min 0 |
| `renewalDays` | Yes | number, min 0 |
| `usageDropPercent` | No | number, min 0, max 100 |
| `criticalTickets` | No | number, min 0 |
| `negativeSentiment` | No | boolean |
| `championLeft` | No | boolean |
| `execSponsorMissing` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `usageDropPercent_gte_1` | `usageDropPercent` | gte 30 | 30 | — | Usage dropped at least 30% |
| `criticalTickets_gte_2` | `criticalTickets` | gte 2 | 30 | — | Multiple critical support tickets |
| `negativeSentiment_truthy_3` | `negativeSentiment` | truthy | 25 | — | Negative customer sentiment detected |
| `championLeft_truthy_4` | `championLeft` | truthy | 35 | — | Customer champion departed |
| `execSponsorMissing_truthy_5` | `execSponsorMissing` | truthy | 20 | — | No executive sponsor is mapped |
| `renewalDays_lt_6` | `renewalDays` | lt 60 | 20 | — | Renewal is less than 60 days away |

Scores below 30 use `continue_success_plan`, scores from 30-69 use `open_risk_workstream`, and scores of 70+ use `launch_executive_save_plan`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "customer-risk-escalation",
  "policyVersion": "1.0.1",
  "decision": "continue_success_plan",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Update customer health in the CS platform",
    "Assign a named intervention owner",
    "Require executive review before commercial concessions"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `launch_executive_save_plan` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Update customer health in the CS platform.
- Assign a named intervention owner.
- Require executive review before commercial concessions.

Typical adapters: customer success platform, CRM, support desk.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `at-risk ARR x reduction in preventable churn rate`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n customer success automation, enterprise n8n workflow, customer risk escalation, workflow automation template.
