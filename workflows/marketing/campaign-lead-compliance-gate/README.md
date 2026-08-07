# Gate campaign leads for compliant follow-up

Checks consent, suppression, geography, engagement, and target-account status before campaign follow-up.

## Business problem

Campaign handoffs can create compliance risk and wasted spend when suppression and consent checks happen too late.

## Business outcome

A follow-up decision that keeps compliance facts visible and routes ambiguous records for review.

- **Primary owner:** Marketing Operations
- **Primary metric:** Compliant leads processed per campaign
- **ROI starting point:** `campaign leads x minutes saved in list review x marketing operations hourly cost / 60`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `leadId`
- `email`
- `campaignId`
- `country`

Optional signals: `consent`, `suppressed`, `targetAccount`, `engagementScore`, `existingCustomer`.

### Sample payload

```json
{
  "leadId": "leadid-001",
  "email": "buyer@example.com",
  "campaignId": "campaignid-001",
  "country": 120
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `consent` | falsy | 60 | Consent is missing |
| `suppressed` | truthy | 80 | Contact is on a suppression list |
| `targetAccount` | truthy | -20 | Contact belongs to a target account |
| `engagementScore` | gte 70 | -15 | Strong engagement signal |
| `existingCustomer` | truthy | 15 | Customer messaging policy may apply |

Scores below 30 use `allow_campaign_follow_up`, scores from 30-69 use `route_to_compliance_review`, and scores of 70+ use `suppress_automated_outreach`.

## Recommended production extensions

- Record the policy decision.
- Send approved contacts to the campaign sequence.
- Route uncertain consent records to a human reviewer.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n marketing automation, enterprise n8n workflow, campaign lead compliance gate, workflow automation template.
