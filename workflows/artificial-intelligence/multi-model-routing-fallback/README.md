# Review multi-model routing and fallback

Evaluates task, policy, provider health, quality, cost, latency, and fallback evidence before recommending an approved model route.

## Business problem

Model routing can concentrate reliability risk or bypass quality and policy expectations when fallback choices are made without consistent evidence.

## Business outcome

A vendor-neutral routing recommendation with matched reasons, while policy exceptions and execution remain human-controlled.

- **Primary owner:** AI Platform Engineering
- **Primary metric:** Fallback rate
- **Policy version:** `1.0.7`
- **ROI starting point:** `monthly model tasks x routing review minutes saved x platform hourly cost / 60`

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
| `routingRequestId` | Yes | string, pattern \S |
| `taskType` | Yes | string, pattern \S |
| `approvedModelAvailable` | Yes | boolean |
| `expectedQualityScore` | Yes | number, min 0, max 100 |
| `policyException` | No | boolean |
| `primaryProviderHealthy` | No | boolean |
| `costBudgetExceeded` | No | boolean |
| `latencyBudgetExceeded` | No | boolean |
| `fallbackValidated` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `approvedModelAvailable_falsy_1` | `approvedModelAvailable` | falsy | 70 | high | No approved model is available for the task |
| `expectedQualityScore_lt_2` | `expectedQualityScore` | lt 80 | 35 | — | Expected quality is below the routing target |
| `policyException_truthy_3` | `policyException` | truthy | 70 | high | The proposed route requires a policy exception |
| `primaryProviderHealthy_falsy_4` | `primaryProviderHealthy` | falsy | 30 | — | The primary provider is not healthy |
| `costBudgetExceeded_truthy_5` | `costBudgetExceeded` | truthy | 25 | — | Estimated unit cost exceeds the task budget |
| `latencyBudgetExceeded_truthy_6` | `latencyBudgetExceeded` | truthy | 25 | — | Estimated latency exceeds the task budget |
| `fallbackValidated_falsy_7` | `fallbackValidated` | falsy | 40 | — | The fallback route has not been validated |

Scores below 30 use `recommend_approved_primary_model`, scores from 30-69 use `recommend_approved_fallback_for_review`, and scores of 70+ use `hold_route_for_policy_exception_review`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "multi-model-routing-fallback",
  "policyVersion": "1.0.7",
  "decision": "recommend_approved_primary_model",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present the recommended approved route and matched policy reasons",
    "Request owner review before selecting a fallback with unresolved evidence",
    "Keep model invocation and policy exceptions outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_route_for_policy_exception_review` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present the recommended approved route and matched policy reasons.
- Request owner review before selecting a fallback with unresolved evidence.
- Keep model invocation and policy exceptions outside the starter.

Typical adapters: Approved model providers, Policy store, Observability, Cost telemetry.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `monthly model tasks x routing review minutes saved x platform hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n artificial intelligence automation, enterprise n8n workflow, multi model routing fallback, workflow automation template.
