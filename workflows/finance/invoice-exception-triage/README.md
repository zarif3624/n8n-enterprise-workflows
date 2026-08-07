# Triage enterprise invoice exceptions

Scores invoice exceptions and routes clean invoices, finance reviews, and payment holds through a consistent policy.

## Business problem

Accounts payable teams lose time manually interpreting missing purchase orders, duplicate invoices, amount mismatches, and risky vendors.

## Business outcome

A structured decision with a risk score, matched policy reasons, and the next recommended action.

- **Primary owner:** Accounts Payable Operations
- **Primary metric:** Minutes of manual review avoided per invoice
- **ROI starting point:** `monthly invoice volume x exception rate x minutes saved x loaded hourly cost / 60`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `invoiceId`
- `vendorId`
- `amount`
- `currency`

Optional signals: `purchaseOrderId`, `duplicateDetected`, `amountMismatchPercent`, `restrictedVendor`, `newBankDetails`.

### Sample payload

```json
{
  "invoiceId": "invoiceid-001",
  "vendorId": "vendorid-001",
  "amount": 125000,
  "currency": "USD"
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `purchaseOrderId` | missing | 25 | Purchase order is missing |
| `duplicateDetected` | truthy | 50 | Potential duplicate invoice |
| `amountMismatchPercent` | gt 2 | 25 | Invoice and purchase order differ by more than 2% |
| `restrictedVendor` | truthy | 60 | Vendor appears on a restricted list |
| `newBankDetails` | truthy | 35 | Payment destination changed |

Scores below 30 use `continue_standard_processing`, scores from 30-69 use `route_to_finance_review`, and scores of 70+ use `hold_payment_and_escalate`.

## Recommended production extensions

- Persist the decision in the ERP or AP queue.
- Require human approval for payment holds.
- Notify the invoice owner with matched policy reasons.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n finance automation, enterprise n8n workflow, invoice exception triage, workflow automation template.
