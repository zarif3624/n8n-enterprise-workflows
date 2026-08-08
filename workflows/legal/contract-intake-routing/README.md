# Route enterprise contract requests

Routes contract intake using document type, value, jurisdiction, data access, and non-standard terms.

## Business problem

Legal requests arrive without enough commercial or risk context, creating avoidable back-and-forth and slow review cycles.

## Business outcome

A normalized legal intake route with risk reasons and required reviewers.

- **Primary owner:** Legal Operations
- **Primary metric:** Contract request time to first review
- **Policy version:** `1.0.0`
- **ROI starting point:** `monthly contracts x reduction in intake rework minutes x legal hourly cost / 60`

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
| `contractType` | Yes | string |
| `counterparty` | Yes | string |
| `contractValue` | Yes | number, min 0 |
| `nonStandardTerms` | No | boolean |
| `personalData` | No | boolean |
| `crossBorderData` | No | boolean |
| `autoRenewal` | No | boolean |
| `regulatedIndustry` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `nonStandardTerms_truthy_1` | `nonStandardTerms` | truthy | 30 | — | Non-standard terms requested |
| `personalData_truthy_2` | `personalData` | truthy | 25 | — | Agreement involves personal data |
| `crossBorderData_truthy_3` | `crossBorderData` | truthy | 30 | — | Cross-border data transfer involved |
| `autoRenewal_truthy_4` | `autoRenewal` | truthy | 15 | — | Automatic renewal clause present |
| `regulatedIndustry_truthy_5` | `regulatedIndustry` | truthy | 30 | — | Counterparty operates in a regulated industry |
| `contractValue_gte_6` | `contractValue` | gte 250000 | 25 | — | High-value agreement |

Scores below 30 use `use_standard_legal_queue`, scores from 30-69 use `assign_specialist_review`, and scores of 70+ use `open_cross_functional_review`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "contract-intake-routing",
  "policyVersion": "1.0.0",
  "decision": "use_standard_legal_queue",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create the legal matter",
    "Attach the structured intake fields",
    "Require legal approval before signature or redline acceptance"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `open_cross_functional_review` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Create the legal matter.
- Attach the structured intake fields.
- Require legal approval before signature or redline acceptance.

Typical adapters: CLM, e-signature, ticketing, document storage.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `monthly contracts x reduction in intake rework minutes x legal hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n legal automation, enterprise n8n workflow, contract intake routing, workflow automation template.
