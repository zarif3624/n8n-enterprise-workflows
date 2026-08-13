# Review RFP response evidence

Evaluates evidence coverage, citations, confidence, unsupported claims, sensitive answers, and expert-review readiness.

## Business problem

RFP and security questionnaire responses create claim risk when drafts are not cited, supported by approved evidence, or routed to domain experts.

## Business outcome

A response-package recommendation that highlights gaps and keeps sensitive claims and document export behind expert approval.

- **Primary owner:** Revenue Engineering
- **Primary metric:** Unsupported-claim rate
- **Policy version:** `1.0.7`
- **ROI starting point:** `questionnaires per month x response review minutes saved x revenue engineering hourly cost / 60`

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
| `questionnaireId` | Yes | string, pattern \S |
| `questionCount` | Yes | number, min 1 |
| `evidenceCoveragePercent` | Yes | number, min 0, max 100 |
| `citedAnswerCount` | Yes | number, min 0 |
| `unsupportedAnswerCount` | No | number, min 0 |
| `sensitiveAnswerCount` | No | number, min 0 |
| `domainExpertAssigned` | No | boolean |
| `exportProposed` | No | boolean |
| `evidenceApproved` | No | boolean |
| `confidenceScore` | No | number, min 0, max 100 |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `evidenceCoveragePercent_lt_1` | `evidenceCoveragePercent` | lt 90 | 35 | — | Approved evidence covers less than 90% of questions |
| `unsupportedAnswerCount_gt_2` | `unsupportedAnswerCount` | gt 0 | 70 | high | The draft contains unsupported answers |
| `sensitiveAnswerCount_gt_3` | `sensitiveAnswerCount` | gt 0 | 70 | high | The draft contains sensitive answers requiring expert approval |
| `domainExpertAssigned_falsy_4` | `domainExpertAssigned` | falsy | 35 | — | No domain expert is assigned to review gaps |
| `exportProposed_truthy_5` | `exportProposed` | truthy | 70 | high | Questionnaire export is proposed |
| `evidenceApproved_falsy_6` | `evidenceApproved` | falsy | 45 | — | The supporting evidence has not been approved |
| `confidenceScore_lt_7` | `confidenceScore` | lt 80 | 25 | — | Draft confidence is below the review target |

Scores below 30 use `recommend_response_package_for_expert_review`, scores from 30-69 use `route_evidence_gaps_to_domain_experts`, and scores of 70+ use `hold_sensitive_response_or_export_for_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "rfp-response-evidence-review",
  "policyVersion": "1.0.7",
  "decision": "recommend_response_package_for_expert_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present cited answers and confidence evidence to domain experts",
    "Recommend owners for unsupported questions",
    "Keep document export, CRM writes, and external submission outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_sensitive_response_or_export_for_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present cited answers and confidence evidence to domain experts.
- Recommend owners for unsupported questions.
- Keep document export, CRM writes, and external submission outside the starter.

Typical adapters: File processing, Knowledge base, Document generation, CRM, Review queue.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `questionnaires per month x response review minutes saved x revenue engineering hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n proposal management automation, enterprise n8n workflow, rfp response evidence review, workflow automation template.
