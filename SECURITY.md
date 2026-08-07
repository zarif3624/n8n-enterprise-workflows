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

These templates are starting points, not a substitute for your organization's
security review, privacy assessment, or change-management process.
