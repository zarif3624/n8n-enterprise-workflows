# Control enterprise data reconciliation exceptions

Classifies cross-system variances, duplicates, missing records, ambiguous corrections, and certification evidence for review.

## Business problem

Cross-system data drift is slow to certify when material variances, duplicates, missing records, and correction authority are not evaluated consistently.

## Business outcome

A reconciliation recommendation and exception record that reserves material or ambiguous corrections for human review.

- **Primary owner:** Data & Analytics
- **Primary metric:** Variance rate
- **Policy version:** `1.0.7`
- **ROI starting point:** `reconciliations per month x certification minutes saved x data operations hourly cost / 60`

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
| `reconciliationId` | Yes | string, pattern \S |
| `sourceRecordCount` | Yes | number, min 0 |
| `targetRecordCount` | Yes | number, min 0 |
| `varianceRatePercent` | Yes | number, min 0, max 100 |
| `duplicateCount` | No | number, min 0 |
| `missingRecordCount` | No | number, min 0 |
| `materialVariance` | No | boolean |
| `ambiguousCorrection` | No | boolean |
| `certificationEvidenceComplete` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `varianceRatePercent_gt_1` | `varianceRatePercent` | gt 1 | 30 | — | Cross-system variance rate exceeds 1% |
| `duplicateCount_gt_2` | `duplicateCount` | gt 0 | 25 | — | Duplicate records were detected |
| `missingRecordCount_gt_3` | `missingRecordCount` | gt 0 | 30 | — | Records are missing from one side of the reconciliation |
| `materialVariance_truthy_4` | `materialVariance` | truthy | 70 | high | The variance is classified as material |
| `ambiguousCorrection_truthy_5` | `ambiguousCorrection` | truthy | 70 | high | The proposed correction is ambiguous |
| `certificationEvidenceComplete_falsy_6` | `certificationEvidenceComplete` | falsy | 40 | — | Certification evidence is incomplete |

Scores below 30 use `recommend_reconciliation_for_certification`, scores from 30-69 use `route_variances_to_data_steward_review`, and scores of 70+ use `hold_corrections_for_material_exception_review`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "enterprise-data-reconciliation-control",
  "policyVersion": "1.0.7",
  "decision": "recommend_reconciliation_for_certification",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present variance evidence to the data steward",
    "Recommend investigation targets without changing source records",
    "Keep corrections and certification outside the starter until human approval"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_corrections_for_material_exception_review` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present variance evidence to the data steward.
- Recommend investigation targets without changing source records.
- Keep corrections and certification outside the starter until human approval.

Typical adapters: Databases, Data warehouses, Spreadsheets, Case store, Data quality tools.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `reconciliations per month x certification minutes saved x data operations hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n data operations automation, enterprise n8n workflow, enterprise data reconciliation control, workflow automation template.
