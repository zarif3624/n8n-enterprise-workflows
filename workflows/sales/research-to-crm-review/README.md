# Review source-backed research for CRM action

Evaluates entity resolution, citations, source freshness, unsupported claims, and proposed CRM or outreach actions.

## Business problem

Company and market research loses trust when signals are not source-backed or are written to CRM and outreach systems before review.

## Business outcome

A cited research brief recommendation with unsupported claims and consequential actions routed to human review.

- **Primary owner:** Revenue & Strategy
- **Primary metric:** Signal-to-action conversion
- **Policy version:** `1.0.7`
- **ROI starting point:** `research requests per month x research minutes saved x analyst hourly cost / 60`

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
| `researchId` | Yes | string, pattern \S |
| `accountId` | Yes | string, pattern \S |
| `sourceCount` | Yes | number, min 0 |
| `citationCoveragePercent` | Yes | number, min 0, max 100 |
| `unsupportedClaimCount` | No | number, min 0 |
| `entityMatchConfirmed` | No | boolean |
| `sensitiveSignal` | No | boolean |
| `crmWriteProposed` | No | boolean |
| `outreachProposed` | No | boolean |
| `sourceFreshnessDays` | No | number, min 0 |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `sourceCount_lt_1` | `sourceCount` | lt 2 | 30 | — | Research uses fewer than two approved sources |
| `citationCoveragePercent_lt_2` | `citationCoveragePercent` | lt 90 | 35 | — | Citation coverage is below 90% |
| `unsupportedClaimCount_gt_3` | `unsupportedClaimCount` | gt 0 | 45 | — | The brief contains unsupported claims |
| `entityMatchConfirmed_falsy_4` | `entityMatchConfirmed` | falsy | 45 | — | The account entity match is not confirmed |
| `sensitiveSignal_truthy_5` | `sensitiveSignal` | truthy | 70 | high | The research includes a sensitive signal |
| `crmWriteProposed_truthy_6` | `crmWriteProposed` | truthy | 70 | high | A CRM write is proposed |
| `outreachProposed_truthy_7` | `outreachProposed` | truthy | 70 | high | External outreach is proposed |
| `sourceFreshnessDays_gt_8` | `sourceFreshnessDays` | gt 30 | 25 | — | At least one source is older than 30 days |

Scores below 30 use `recommend_cited_brief_for_review`, scores from 30-69 use `route_research_gaps_to_analyst_review`, and scores of 70+ use `hold_crm_or_outreach_action_for_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "research-to-crm-review",
  "policyVersion": "1.0.7",
  "decision": "recommend_cited_brief_for_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present citations and entity evidence to the account owner",
    "Recommend research gaps for analyst follow-up",
    "Keep CRM writes, task creation, and outreach outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_crm_or_outreach_action_for_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present citations and entity evidence to the account owner.
- Recommend research gaps for analyst follow-up.
- Keep CRM writes, task creation, and outreach outside the starter.

Typical adapters: Research providers, CRM, Document store, Collaboration, Data enrichment.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `research requests per month x research minutes saved x analyst hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n sales automation, enterprise n8n workflow, research to crm review, workflow automation template.
