# Enterprise readiness checklist

An imported workflow is a starting point. Complete this checklist before using
one with production data or systems.

Start with `npm run catalog -- plan <workflow-slug>` to generate a workflow-specific field-mapping and rollout worksheet, then complete the controls below.

## Ownership and policy

- Assign a business owner and technical owner.
- Review required fields, score weights, thresholds, and decision labels.
- Identify every action that requires human approval.
- Document exceptions and an escalation path.

## Security and privacy

- Configure n8n's built-in webhook authentication.
- Store secrets only in n8n credentials or an approved external secret store.
- Apply least-privilege credentials and project access.
- Minimize personal, financial, customer, and security-sensitive data.
- Review execution-data retention and redact logs where necessary.
- Verify the production endpoint against `openapi.json` and remove any response fields callers do not need.
- Add rate limiting or an upstream API gateway for externally reachable webhooks.

## Reliability

- Add error outputs to every external API, database, and communication node.
- Set retry behavior only for safe, idempotent operations.
- Add deduplication or idempotency keys before creating external records.
- Configure timeouts and a private error workflow.
- Test 4xx, 5xx, timeout, duplicate, and partial-data paths.
- Preserve the template's evaluator error output and sanitized 500 responder when extending the success path.
- Run all three package fixtures and preserve the observed decision evidence with the release.
- Run a sanitized representative batch through `npm run conformance`, agree invalid-rate and rule-coverage gates with the policy owner, and preserve only the aggregate report.
- Propagate `X-Request-Id` through downstream systems and alerts.

## Deployment

- Develop and test outside production.
- Use reviewed source-control promotion where available.
- Keep production protected from ad hoc edits.
- Publish a specific reviewed version and retain rollback instructions.
- Monitor execution failures, latency, throughput, and business outcomes.
- Compare a current aggregate conformance report with the approved fingerprint-matched baseline and alert on owner-approved drift gates.
- Record the policy and schema versions deployed in each environment.

## Value measurement

- Record the baseline cycle time, error rate, backlog, or conversion rate.
- Measure adoption and automation volume separately from business impact.
- Review false-positive and false-negative decisions with the process owner.
- Retire automation that cannot demonstrate value or safe operation.
