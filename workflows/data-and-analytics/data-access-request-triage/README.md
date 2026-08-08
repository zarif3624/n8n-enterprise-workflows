# Triage enterprise data access requests

Classifies data access requests by sensitivity, environment, sharing intent, retention, and owner approval before access is granted.

## Business problem

Data teams receive incomplete access requests that obscure privacy risk, production scope, retention needs, and accountable ownership.

## Business outcome

A transparent governance route that separates standard access from data-owner, privacy, and security review.

- **Primary owner:** Data Governance
- **Primary metric:** Time from request to governed data access
- **Policy version:** `1.0.0`
- **ROI starting point:** `monthly data requests x review minutes saved x governance hourly cost / 60`

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

The request body must be a JSON object. Unknown fields are preserved as caller context but are not echoed in the response.

| Field | Required | Contract |
| --- | --- | --- |
| `requestId` | Yes | string |
| `requesterId` | Yes | string |
| `dataset` | Yes | string |
| `purpose` | Yes | string |
| `containsSensitiveData` | No | boolean |
| `productionData` | No | boolean |
| `externalSharing` | No | boolean |
| `retentionDays` | No | number, min 0 |
| `ownerApproved` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `containsSensitiveData_truthy_1` | `containsSensitiveData` | truthy | 35 | — | Dataset contains sensitive data |
| `productionData_truthy_2` | `productionData` | truthy | 25 | — | Request includes production data |
| `externalSharing_truthy_3` | `externalSharing` | truthy | 50 | high | Data may be shared outside the organization |
| `retentionDays_gt_4` | `retentionDays` | gt 365 | 25 | — | Requested retention exceeds one year |
| `ownerApproved_falsy_5` | `ownerApproved` | falsy | 40 | — | Dataset owner approval is missing |

Scores below 30 use `approve_standard_data_access`, scores from 30-69 use `require_owner_and_privacy_review`, and scores of 70+ use `block_until_governance_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "data-access-request-triage",
  "policyVersion": "1.0.0",
  "decision": "approve_standard_data_access",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create the governed access ticket",
    "Record purpose and retention",
    "Require named approval before external sharing"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `block_until_governance_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Create the governed access ticket.
- Record purpose and retention.
- Require named approval before external sharing.

Typical adapters: Snowflake, Databricks, BigQuery, data catalog, ticketing.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `monthly data requests x review minutes saved x governance hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n data and analytics automation, enterprise n8n workflow, data access request triage, workflow automation template.
