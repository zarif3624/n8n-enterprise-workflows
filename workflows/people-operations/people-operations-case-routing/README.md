# Route people operations cases for review

Evaluates identity, policy, sensitivity, approval, payroll, workplace, and completion-evidence signals for people cases.

## Business problem

People cases span HR, payroll, workplace, and manager responsibilities, creating privacy and completion risk when routing is inconsistent.

## Business outcome

A privacy-aware routing recommendation that leaves employee-impacting decisions and system changes with HR or the accountable manager.

- **Primary owner:** People Operations
- **Primary metric:** Case cycle time
- **Policy version:** `1.0.7`
- **ROI starting point:** `people cases per month x routing minutes saved x people operations hourly cost / 60`

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
| `caseId` | Yes | string, pattern \S |
| `caseType` | Yes | string, pattern \S |
| `requesterVerified` | Yes | boolean |
| `policyCheckComplete` | Yes | boolean |
| `sensitiveCase` | No | boolean |
| `managerApprovalRequired` | No | boolean |
| `hrApprovalRequired` | No | boolean |
| `payrollImpact` | No | boolean |
| `workplaceImpact` | No | boolean |
| `completionEvidenceComplete` | No | boolean |

## Policy rules

| Rule ID | Field | Match | Points | Minimum band | Reason |
| --- | --- | --- | ---: | --- | --- |
| `requesterVerified_falsy_1` | `requesterVerified` | falsy | 70 | high | The requester identity is not verified |
| `policyCheckComplete_falsy_2` | `policyCheckComplete` | falsy | 45 | — | The applicable people policy check is incomplete |
| `sensitiveCase_truthy_3` | `sensitiveCase` | truthy | 70 | high | The case is classified as sensitive |
| `managerApprovalRequired_truthy_4` | `managerApprovalRequired` | truthy | 35 | — | Manager approval is required |
| `hrApprovalRequired_truthy_5` | `hrApprovalRequired` | truthy | 70 | high | HR approval is required |
| `payrollImpact_truthy_6` | `payrollImpact` | truthy | 70 | high | The case can affect payroll |
| `workplaceImpact_truthy_7` | `workplaceImpact` | truthy | 45 | — | The case requires workplace coordination |
| `completionEvidenceComplete_falsy_8` | `completionEvidenceComplete` | falsy | 30 | — | Completion evidence is incomplete |

Scores below 30 use `recommend_standard_people_case_review`, scores from 30-69 use `route_case_to_manager_or_hr_review`, and scores of 70+ use `hold_employee_impacting_action_for_hr_approval`. A minimum band is a hard safety floor: negative rules cannot cancel it.

## Response contract

Successful requests return HTTP 200 with a request ID, policy version, decision, band, score, matched rules, recommended actions, and evaluation timestamp.

```json
{
  "ok": true,
  "httpStatus": 200,
  "requestId": "example-request-001",
  "workflow": "people-operations-case-routing",
  "policyVersion": "1.0.7",
  "decision": "recommend_standard_people_case_review",
  "priorityBand": "low",
  "score": 0,
  "matchedRules": [],
  "recommendedActions": [
    "Present only the minimum necessary case evidence to the assigned reviewer",
    "Recommend manager, HR, payroll, or workplace review based on matched rules",
    "Keep employee decisions and HRIS, payroll, identity, or messaging changes outside the starter"
  ],
  "evaluatedAt": "2026-08-07T03:00:00.000Z"
}
```

The high-risk example returns `hold_employee_impacting_action_for_hr_approval` in the `high` band with score 100. Invalid requests return HTTP 400 with `error: "validation_error"`, field-level violations, and the complete request schema so callers can self-correct. Unexpected evaluator failures follow the wired error output and return a sanitized, retryable HTTP 500 with `error: "internal_error"`; stack traces and caller data are never returned.

## Recommended production extensions

- Present only the minimum necessary case evidence to the assigned reviewer.
- Recommend manager, HR, payroll, or workplace review based on matched rules.
- Keep employee decisions and HRIS, payroll, identity, or messaging changes outside the starter.

Typical adapters: HRIS, Identity, Payroll, Workplace service systems, Forms.

## Security and operations

- Keep consequential actions behind explicit human approval. This template recommends; it does not make irreversible changes.
- Replace unauthenticated local testing with built-in webhook authentication before activation.
- Store secrets only in n8n credentials; never place tokens in expressions, fields, or exported JSON.
- Add retries only to safe, idempotent external calls and wire every fallible node to a structured 5xx response.
- Set a private workflow-level error workflow and review execution-data retention before processing sensitive data.
- Treat `requestId` as a correlation value, not proof of identity, and avoid returning source records in the response.

## ROI worksheet

Start with `people cases per month x routing minutes saved x people operations hourly cost / 60`. Record baseline volume, handling time, false-positive rate, and loaded cost before rollout; compare them with observed values after 30 days. Report capacity, risk reduction, and revenue impact separately.

## Search terms

n8n people operations automation, enterprise n8n workflow, people operations case routing, workflow automation template.
