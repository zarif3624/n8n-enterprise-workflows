# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or exposed secret.
Use GitHub's private vulnerability reporting for this repository.

## Template security model

- Every workflow ships inactive.
- No workflow contains credentials, tokens, customer data, or credential IDs.
- Webhook templates use no authentication only to make local evaluation easy.
- Before production use, configure n8n's built-in Header Auth, Basic Auth, or
  another appropriate trigger credential.
- Review data retention, execution logging, RBAC, and environment promotion
  policies for your organization.

## Trust boundaries

The imported Webhook node is a public network boundary. Treat every field as
untrusted even when a trusted system is expected to call it. The generated
policy engine validates JSON types, lengths, formats, and numeric ranges before
scoring. Unknown fields are allowed for integration compatibility but are not
echoed in responses.

The templates are pure decision services: they do not call external systems,
write records, send messages, or provision access. Those side effects are an
adopter-controlled trust boundary. Before adding one:

1. Use a least-privilege n8n credential and never copy its value into a node field.
2. Require a human approval for financial, employment, legal, security, privacy,
   customer, and externally visible actions.
3. Make retries idempotent and define a stable domain or idempotency key.
4. Wire the node's error output to a structured failure response or private error workflow.
5. Confirm execution-data retention is appropriate for the payload classification.

## Threats the templates address

- **Accidental public activation:** workflows ship inactive and contain an on-canvas authentication warning.
- **Silent type coercion:** number and boolean fields fail closed instead of accepting strings.
- **Policy bypass through offsets:** non-negotiable signals use hard minimum bands that negative points cannot cancel.
- **Sensitive response leakage:** responses contain decisions and reasons, not the source request body.
- **Intermediary caching:** response headers include `Cache-Control: no-store`.
- **Untraceable calls:** callers can provide `X-Request-Id`; CR/LF is removed, the value is capped at 200 characters, and every response returns it in both the body and header.
- **Generated-artifact drift:** validation executes the exported n8n expression and compares it with the source policy engine.
- **Silent evaluator failure:** the evaluator's dedicated error output terminates in a sanitized, retryable HTTP 500 instead of an empty success response; stack traces and node details remain private.
- **Unreviewed policy mutation:** canonical fingerprints and target-branch CI comparison require a newer policy version for executable behavior changes.

## Threats adopters must address

- Authentication, authorization, network allowlisting, and rate limiting.
- Tenant isolation and payload-level access control.
- Data residency, privacy notices, retention, and deletion requirements.
- Downstream API timeouts, retries, partial failures, and duplicate writes.
- Monitoring, incident response, rollback, and policy-owner review.
- Organization-specific legal or regulatory interpretation.

The generated [OpenAPI contract](openapi.json) models a production Header Auth
scheme as an example. The imported template deliberately does not include a
credential reference; configure the chosen built-in authentication scheme in
the target n8n environment before activation.

These templates are starting points, not a substitute for your organization's
security review, privacy assessment, or change-management process.
