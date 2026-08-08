# Gate production changes by operational risk

Scores planned production changes using customer, database, rollback, peak-period, and security signals before deployment.

## Business problem

Change approvals become inconsistent when risk context is scattered across pull requests, tickets, and release conversations.

## Business outcome

An explainable release route that preserves human authority for elevated and security-relevant changes.

- **Primary owner:** Engineering Operations
- **Primary metric:** Change lead time without increasing failure rate
- **Policy version:** `1.0.1`
- **ROI starting point:** `monthly changes x approval minutes saved x engineering hourly cost / 60`

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
| `changeId` | Yes | string |
| `service` | Yes | string |
| `changeType` | Yes | string |
| `plannedAt` | Yes | string, date-time |
| `customerImpact` | No | boolean |
| `databaseMigration` | No | boolean |
| `rollbackTested` | No | boolean |
| `duringPeakHours` | No | boolean |
| `securityRelevant` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `customerImpact_truthy_1` | `customerImpact` | truthy | 30 | — | Change can affect customers |
| `databaseMigration_truthy_2` | `databaseMigration` | truthy | 25 | — | Change includes a database migration |
| `rollbackTested_falsy_3` | `rollbackTested` | falsy | 45 | — | Rollback has not been tested |
| `duringPeakHours_truthy_4` | `duringPeakHours` | truthy | 20 | — | Change is planned during peak hours |
| `securityRelevant_truthy_5` | `securityRelevant` | truthy | 45 | high | Change affects a security control or boundary |

Scores below 30 use `continue_standard_change_process`, scores from 30-69 use `require_senior_engineering_review`, and scores of 70+ use `hold_for_change_advisory_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "production-change-risk-gate",
  "policyVersion": "1.0.1",
  "decision": "continue_standard_change_process",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Update the change record",
    "Attach rollback evidence",
    "Require an accountable approver before deployment"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_for_change_advisory_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Update the change record.
- Attach rollback evidence.
- Require an accountable approver before deployment.

Typical adapters: GitHub, GitLab, Jira, change management, incident management.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `monthly changes x approval minutes saved x engineering hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n engineering automation, enterprise n8n workflow, production change risk gate, workflow automation template.
