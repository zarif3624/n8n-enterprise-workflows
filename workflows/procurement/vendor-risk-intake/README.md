# Triage enterprise vendor risk

Scores vendor intake using spend, data access, criticality, geography, subcontractors, and security evidence.

## Business problem

Procurement, security, privacy, and legal reviews often start late because vendor risk is not classified at intake.

## Business outcome

A coordinated due-diligence route with the reasons each review is required.

- **Primary owner:** Procurement Operations
- **Primary metric:** Vendor request time to correct review path
- **Policy version:** `1.0.1`
- **ROI starting point:** `vendor requests x days removed from routing delay x internal cost per delay day`

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
| `requestId` | Yes | string |
| `vendorName` | Yes | string |
| `annualSpend` | Yes | number, min 0 |
| `businessOwner` | Yes | string |
| `handlesPersonalData` | No | boolean |
| `businessCritical` | No | boolean |
| `foreignDataHosting` | No | boolean |
| `subprocessors` | No | boolean |
| `soc2Available` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `handlesPersonalData_truthy_1` | `handlesPersonalData` | truthy | 30 | — | Vendor handles personal data |
| `businessCritical_truthy_2` | `businessCritical` | truthy | 30 | — | Vendor supports a critical business process |
| `foreignDataHosting_truthy_3` | `foreignDataHosting` | truthy | 25 | — | Data is hosted in another jurisdiction |
| `subprocessors_truthy_4` | `subprocessors` | truthy | 20 | — | Vendor relies on subprocessors |
| `soc2Available_falsy_5` | `soc2Available` | falsy | 25 | — | SOC 2 evidence is unavailable |
| `annualSpend_gte_6` | `annualSpend` | gte 100000 | 20 | — | High annual spend |

Scores below 30 use `start_standard_procurement`, scores from 30-69 use `add_security_or_privacy_review`, and scores of 70+ use `open_full_vendor_due_diligence`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "vendor-risk-intake",
  "policyVersion": "1.0.1",
  "decision": "start_standard_procurement",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create the vendor record",
    "Assign required control owners",
    "Block purchase-order creation until mandatory approvals complete"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `open_full_vendor_due_diligence` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Create the vendor record.
- Assign required control owners.
- Block purchase-order creation until mandatory approvals complete.

Typical adapters: procurement suite, GRC, security questionnaires.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `vendor requests x days removed from routing delay x internal cost per delay day`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n procurement automation, enterprise n8n workflow, vendor risk intake, workflow automation template.
