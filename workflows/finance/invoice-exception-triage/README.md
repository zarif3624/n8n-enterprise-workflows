# Triage enterprise invoice exceptions

Scores invoice exceptions and routes clean invoices, finance reviews, and payment holds through a consistent policy.

## Business problem

Accounts payable teams lose time manually interpreting missing purchase orders, duplicate invoices, amount mismatches, and risky vendors.

## Business outcome

A structured decision with a risk score, matched policy reasons, and the next recommended action.

- **Primary owner:** Accounts Payable Operations
- **Primary metric:** Minutes of manual review avoided per invoice
- **Policy version:** `1.0.3`
- **ROI starting point:** `monthly invoice volume x exception rate x minutes saved x loaded hourly cost / 60`

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
| `invoiceId` | Yes | string |
| `vendorId` | Yes | string |
| `amount` | Yes | number, min 0 |
| `currency` | Yes | string, pattern ^[A-Z]{3}$ |
| `purchaseOrderId` | No | string |
| `duplicateDetected` | No | boolean |
| `amountMismatchPercent` | No | number, min 0, max 100 |
| `restrictedVendor` | No | boolean |
| `newBankDetails` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `purchaseOrderId_missing_1` | `purchaseOrderId` | missing | 25 | — | Purchase order is missing |
| `duplicateDetected_truthy_2` | `duplicateDetected` | truthy | 50 | high | Potential duplicate invoice |
| `amountMismatchPercent_gt_3` | `amountMismatchPercent` | gt 2 | 25 | — | Invoice and purchase order differ by more than 2% |
| `restrictedVendor_truthy_4` | `restrictedVendor` | truthy | 60 | high | Vendor appears on a restricted list |
| `newBankDetails_truthy_5` | `newBankDetails` | truthy | 35 | — | Payment destination changed |

Scores below 30 use `continue_standard_processing`, scores from 30-69 use `route_to_finance_review`, and scores of 70+ use `hold_payment_and_escalate`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "invoice-exception-triage",
  "policyVersion": "1.0.3",
  "decision": "continue_standard_processing",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Persist the decision in the ERP or AP queue",
    "Require human approval for payment holds",
    "Notify the invoice owner with matched policy reasons"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_payment_and_escalate` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Persist the decision in the ERP or AP queue.
- Require human approval for payment holds.
- Notify the invoice owner with matched policy reasons.

Typical adapters: SAP, Oracle, NetSuite, Coupa, Slack.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `monthly invoice volume x exception rate x minutes saved x loaded hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n finance automation, enterprise n8n workflow, invoice exception triage, workflow automation template.
