# Triage employee access requests

Classifies employee access requests using role, privilege, environment, and approval signals before provisioning begins.

## Business problem

Access requests often arrive through inconsistent channels and reach IT without enough context or the required approvals.

## Business outcome

A normalized access decision that separates standard fulfillment, security review, and blocked requests.

- **Primary owner:** People Operations and Identity Management
- **Primary metric:** Access-request cycle time
- **Policy version:** `1.0.1`
- **ROI starting point:** `monthly access requests x minutes saved x loaded hourly cost / 60`

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
| `employeeId` | Yes | string |
| `system` | Yes | string |
| `accessLevel` | Yes | string |
| `managerApproved` | No | boolean |
| `privilegedAccess` | No | boolean |
| `productionAccess` | No | boolean |
| `contractor` | No | boolean |
| `endDate` | No | string, date-time |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `managerApproved_falsy_1` | `managerApproved` | falsy | 45 | — | Manager approval is missing |
| `privilegedAccess_truthy_2` | `privilegedAccess` | truthy | 45 | — | Privileged access requested |
| `productionAccess_truthy_3` | `productionAccess` | truthy | 30 | — | Production access requested |
| `contractor_truthy_4` | `contractor` | truthy | 20 | — | Requester is a contractor |
| `endDate_missing_5` | `endDate` | missing | 20 | — | Time-bound access has no end date |

Scores below 30 use `queue_standard_fulfillment`, scores from 30-69 use `require_security_review`, and scores of 70+ use `block_until_approved`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "employee-access-request-triage",
  "policyVersion": "1.0.1",
  "decision": "queue_standard_fulfillment",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Create an identity-governance ticket",
    "Require a named approver for elevated access",
    "Set an expiration date before provisioning"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `block_until_approved` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct.

## Recommended production extensions

- Create an identity-governance ticket.
- Require a named approver for elevated access.
- Set an expiration date before provisioning.

Typical adapters: Workday, Okta, Microsoft Entra ID, ServiceNow.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `monthly access requests x minutes saved x loaded hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n human resources automation, enterprise n8n workflow, employee access request triage, workflow automation template.
