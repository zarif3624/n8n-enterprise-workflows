# Gate agent releases with evaluation evidence

Reviews quality, safety, latency, cost, and evaluation coverage signals before an agent change is considered for release.

## Business problem

Agent changes can introduce quality, safety, latency, or cost regressions when release evidence is incomplete or compared inconsistently.

## Business outcome

An explainable release recommendation and evidence route that leaves release approval and deployment with the accountable owner.

- **Primary owner:** AI Platform & SRE
- **Primary metric:** Regression escape rate
- **Policy version:** `1.0.7`
- **ROI starting point:** `agent releases per month x evaluation review minutes saved x engineering hourly cost / 60`

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
| `evaluationRunId` | Yes | string, pattern \S |
| `changeType` | Yes | string, pattern \S |
| `evaluationCoveragePercent` | Yes | number, min 0, max 100 |
| `qualityScore` | Yes | number, min 0, max 100 |
| `safetyRegression` | No | boolean |
| `latencyRegressionPercent` | No | number, min 0, max 1000 |
| `costRegressionPercent` | No | number, min 0, max 1000 |
| `baselineAvailable` | No | boolean |
| `exceptionRequested` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `evaluationCoveragePercent_lt_1` | `evaluationCoveragePercent` | lt 90 | 30 | — | Evaluation coverage is below 90% |
| `qualityScore_lt_2` | `qualityScore` | lt 80 | 35 | — | Quality score is below the release target |
| `safetyRegression_truthy_3` | `safetyRegression` | truthy | 70 | high | Evaluation detected a safety regression |
| `latencyRegressionPercent_gt_4` | `latencyRegressionPercent` | gt 25 | 25 | — | Latency regressed by more than 25% |
| `costRegressionPercent_gt_5` | `costRegressionPercent` | gt 25 | 20 | — | Unit cost regressed by more than 25% |
| `baselineAvailable_falsy_6` | `baselineAvailable` | falsy | 40 | — | No approved baseline is available for comparison |
| `exceptionRequested_truthy_7` | `exceptionRequested` | truthy | 70 | high | Release requires an owner-approved policy exception |

Scores below 30 use `recommend_release_candidate_for_owner_approval`, scores from 30-69 use `route_release_evidence_to_owner_review`, and scores of 70+ use `hold_release_for_owner_exception_review`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "agent-evaluation-release-gate",
  "policyVersion": "1.0.7",
  "decision": "recommend_release_candidate_for_owner_approval",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present evaluation evidence to the release owner",
    "Recommend remediation for failed quality, safety, latency, or cost gates",
    "Keep deployment outside the starter until a release owner approves the evidence"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_release_for_owner_exception_review` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present evaluation evidence to the release owner.
- Recommend remediation for failed quality, safety, latency, or cost gates.
- Keep deployment outside the starter until a release owner approves the evidence.

Typical adapters: Evaluation service, Model providers, Source control, Ticketing, Observability.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `agent releases per month x evaluation review minutes saved x engineering hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n artificial intelligence automation, enterprise n8n workflow, agent evaluation release gate, workflow automation template.
