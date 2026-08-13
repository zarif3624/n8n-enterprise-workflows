# Triage employee phishing reports

Scores reported messages using credential theft, attachment, impersonation, click, and campaign indicators.

## Business problem

Security teams receive large volumes of suspicious-email reports with uneven context and limited prioritization.

## Business outcome

A rapid containment recommendation without automatically taking destructive security actions.

- **Primary owner:** Security Operations
- **Primary metric:** Minutes from report to analyst triage
- **Policy version:** `1.0.7`
- **ROI starting point:** `reports per month x minutes saved in initial triage x analyst hourly cost / 60`

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
| `reportId` | Yes | string, pattern \S |
| `reporterId` | Yes | string, pattern \S |
| `sender` | Yes | string, pattern \S |
| `subject` | Yes | string, pattern \S |
| `credentialRequested` | No | boolean |
| `suspiciousAttachment` | No | boolean |
| `executiveImpersonation` | No | boolean |
| `linkClicked` | No | boolean |
| `multipleRecipients` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `credentialRequested_truthy_1` | `credentialRequested` | truthy | 40 | — | Message requests credentials |
| `suspiciousAttachment_truthy_2` | `suspiciousAttachment` | truthy | 35 | — | Suspicious attachment present |
| `executiveImpersonation_truthy_3` | `executiveImpersonation` | truthy | 30 | — | Executive impersonation detected |
| `linkClicked_truthy_4` | `linkClicked` | truthy | 55 | high | A user clicked the reported link |
| `multipleRecipients_truthy_5` | `multipleRecipients` | truthy | 25 | — | Possible campaign affects multiple recipients |

Scores below 30 use `queue_analyst_review`, scores from 30-69 use `expedite_investigation`, and scores of 70+ use `initiate_containment_review`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "phishing-report-triage",
  "policyVersion": "1.0.7",
  "decision": "queue_analyst_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create a case in the security queue",
    "Preserve message evidence",
    "Require analyst approval before quarantine or account actions"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `initiate_containment_review` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Create a case in the security queue.
- Preserve message evidence.
- Require analyst approval before quarantine or account actions.

Typical adapters: Microsoft 365, Google Workspace, SIEM, SOAR.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `reports per month x minutes saved in initial triage x analyst hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n security automation, enterprise n8n workflow, phishing report triage, workflow automation template.
