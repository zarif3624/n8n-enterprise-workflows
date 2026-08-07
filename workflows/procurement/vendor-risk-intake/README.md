# Triage enterprise vendor risk

Scores vendor intake using spend, data access, criticality, geography, subcontractors, and security evidence.

## Business problem

Procurement, security, privacy, and legal reviews often start late because vendor risk is not classified at intake.

## Business outcome

A coordinated due-diligence route with the reasons each review is required.

- **Primary owner:** Procurement Operations
- **Primary metric:** Vendor request time to correct review path
- **ROI starting point:** `vendor requests x days removed from routing delay x internal cost per delay day`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `requestId`
- `vendorName`
- `annualSpend`
- `businessOwner`

Optional signals: `handlesPersonalData`, `businessCritical`, `foreignDataHosting`, `subprocessors`, `soc2Available`.

### Sample payload

```json
{
  "requestId": "requestid-001",
  "vendorName": "Example vendorName",
  "annualSpend": 125000,
  "businessOwner": "Example businessOwner"
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `handlesPersonalData` | truthy | 30 | Vendor handles personal data |
| `businessCritical` | truthy | 30 | Vendor supports a critical business process |
| `foreignDataHosting` | truthy | 25 | Data is hosted in another jurisdiction |
| `subprocessors` | truthy | 20 | Vendor relies on subprocessors |
| `soc2Available` | falsy | 25 | SOC 2 evidence is unavailable |
| `annualSpend` | gte 100000 | 20 | High annual spend |

Scores below 30 use `start_standard_procurement`, scores from 30-69 use `add_security_or_privacy_review`, and scores of 70+ use `open_full_vendor_due_diligence`.

## Recommended production extensions

- Create the vendor record.
- Assign required control owners.
- Block purchase-order creation until mandatory approvals complete.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n procurement automation, enterprise n8n workflow, vendor risk intake, workflow automation template.
