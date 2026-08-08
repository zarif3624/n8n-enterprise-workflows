# Gate campaign leads for compliant follow-up

Checks consent, suppression, geography, engagement, and target-account status before campaign follow-up.

## Business problem

Campaign handoffs can create compliance risk and wasted spend when suppression and consent checks happen too late.

## Business outcome

A follow-up decision that keeps compliance facts visible and routes ambiguous records for review.

- **Primary owner:** Marketing Operations
- **Primary metric:** Compliant leads processed per campaign
- **Policy version:** `1.0.1`
- **ROI starting point:** `campaign leads x minutes saved in list review x marketing operations hourly cost / 60`

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
| `leadId` | Yes | string |
| `email` | Yes | string, email |
| `campaignId` | Yes | string |
| `country` | Yes | string |
| `consent` | No | boolean |
| `suppressed` | No | boolean |
| `targetAccount` | No | boolean |
| `engagementScore` | No | number, min 0, max 100 |
| `existingCustomer` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `consent_falsy_1` | `consent` | falsy | 60 | high | Consent is missing |
| `suppressed_truthy_2` | `suppressed` | truthy | 80 | high | Contact is on a suppression list |
| `targetAccount_truthy_3` | `targetAccount` | truthy | -20 | — | Contact belongs to a target account |
| `engagementScore_gte_4` | `engagementScore` | gte 70 | -15 | — | Strong engagement signal |
| `existingCustomer_truthy_5` | `existingCustomer` | truthy | 15 | — | Customer messaging policy may apply |

Scores below 30 use `allow_campaign_follow_up`, scores from 30-69 use `route_to_compliance_review`, and scores of 70+ use `suppress_automated_outreach`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "campaign-lead-compliance-gate",
  "policyVersion": "1.0.1",
  "decision": "allow_campaign_follow_up",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Record the policy decision",
    "Send approved contacts to the campaign sequence",
    "Route uncertain consent records to a human reviewer"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `suppress_automated_outreach` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Record the policy decision.
- Send approved contacts to the campaign sequence.
- Route uncertain consent records to a human reviewer.

Typical adapters: marketing automation, CRM, consent platform.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `campaign leads x minutes saved in list review x marketing operations hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n marketing automation, enterprise n8n workflow, campaign lead compliance gate, workflow automation template.
