# Review incident RCA evidence

Checks incident artifacts, timeline coverage, redaction, root-cause support, remediation ownership, and publication readiness.

## Business problem

Incident learning is delayed or unreliable when timelines, evidence, redaction, root-cause support, and remediation ownership are incomplete.

## Business outcome

A structured RCA evidence recommendation that reserves publication and closure for the incident or release owner.

- **Primary owner:** Engineering & SRE
- **Primary metric:** Evidence completeness
- **Policy version:** `1.0.7`
- **ROI starting point:** `incidents per month x RCA drafting minutes saved x SRE hourly cost / 60`

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
| `incidentId` | Yes | string, pattern \S |
| `incidentClosedAt` | Yes | string, date-time, pattern \S |
| `evidenceArtifactCount` | Yes | number, min 0 |
| `timelineCoveragePercent` | Yes | number, min 0, max 100 |
| `sensitiveDataRedacted` | No | boolean |
| `rootCauseSupported` | No | boolean |
| `remediationOwnersAssigned` | No | boolean |
| `publicationProposed` | No | boolean |
| `evidenceGapCount` | No | number, min 0 |
| `releaseEvidenceIncluded` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `evidenceArtifactCount_lt_1` | `evidenceArtifactCount` | lt 3 | 30 | — | Fewer than three incident evidence artifacts are attached |
| `timelineCoveragePercent_lt_2` | `timelineCoveragePercent` | lt 90 | 35 | — | Incident timeline coverage is below 90% |
| `sensitiveDataRedacted_falsy_3` | `sensitiveDataRedacted` | falsy | 70 | high | Sensitive data has not been confirmed as redacted |
| `rootCauseSupported_falsy_4` | `rootCauseSupported` | falsy | 40 | — | The proposed root cause is not supported by evidence |
| `remediationOwnersAssigned_falsy_5` | `remediationOwnersAssigned` | falsy | 30 | — | Remediation actions do not all have owners |
| `publicationProposed_truthy_6` | `publicationProposed` | truthy | 70 | high | RCA publication requires owner approval |
| `evidenceGapCount_gt_7` | `evidenceGapCount` | gt 0 | 30 | — | The evidence package contains unresolved gaps |

Scores below 30 use `recommend_rca_evidence_for_owner_review`, scores from 30-69 use `route_evidence_gaps_to_incident_owner`, and scores of 70+ use `hold_rca_publication_for_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "incident-rca-evidence-review",
  "policyVersion": "1.0.7",
  "decision": "recommend_rca_evidence_for_owner_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present the redacted timeline and evidence index to the incident owner",
    "Recommend owners for remediation and evidence gaps",
    "Keep publication, ticket changes, and RCA closure outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_rca_publication_for_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present the redacted timeline and evidence index to the incident owner.
- Recommend owners for remediation and evidence gaps.
- Keep publication, ticket changes, and RCA closure outside the starter.

Typical adapters: Collaboration, Observability, Work tracking, Source control, Knowledge base.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `incidents per month x RCA drafting minutes saved x SRE hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n incident management automation, enterprise n8n workflow, incident rca evidence review, workflow automation template.
