# Triage employee access requests

Classifies employee access requests using role, privilege, environment, and approval signals before provisioning begins.

## Business problem

Access requests often arrive through inconsistent channels and reach IT without enough context or the required approvals.

## Business outcome

A normalized access decision that separates standard fulfillment, security review, and blocked requests.

- **Primary owner:** People Operations and Identity Management
- **Primary metric:** Access-request cycle time
- **ROI starting point:** `monthly access requests x minutes saved x loaded hourly cost / 60`

## Import and configure

1. Import `workflow.json` into an n8n development project.
2. Review the policy rules and thresholds with the named business owner.
3. Configure built-in authentication on **Receive request**. Do not activate an unauthenticated production webhook.
4. Send the sample payload to the test webhook URL.
5. Connect approved downstream systems only after the decision output is verified.
6. Add error outputs and a private logging destination to every external node you introduce.

## Required input

- `requestId`
- `employeeId`
- `system`
- `accessLevel`

Optional signals: `managerApproved`, `privilegedAccess`, `productionAccess`, `contractor`, `endDate`.

### Sample payload

```json
{
  "requestId": "requestid-001",
  "employeeId": "employeeid-001",
  "system": "Example system",
  "accessLevel": "Example accessLevel"
}
```

## Policy rules

| Field | Match | Points | Reason |
| --- | --- | ---: | --- |
| `managerApproved` | falsy | 45 | Manager approval is missing |
| `privilegedAccess` | truthy | 45 | Privileged access requested |
| `productionAccess` | truthy | 30 | Production access requested |
| `contractor` | truthy | 20 | Requester is a contractor |
| `endDate` | missing | 20 | Time-bound access has no end date |

Scores below 30 use `queue_standard_fulfillment`, scores from 30-69 use `require_security_review`, and scores of 70+ use `block_until_approved`.

## Recommended production extensions

- Create an identity-governance ticket.
- Require a named approver for elevated access.
- Set an expiration date before provisioning.

Keep consequential actions behind explicit human approval. The template returns a recommendation; it does not make irreversible changes.

## Search terms

n8n human resources automation, enterprise n8n workflow, employee access request triage, workflow automation template.
