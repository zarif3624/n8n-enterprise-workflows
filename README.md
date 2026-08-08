# n8n Enterprise Workflows

Production-minded, open-source n8n workflow templates for enterprise teams.
Each package combines an importable workflow, implementation instructions,
sample data, policy logic, security gates, business value, and an ROI model.

[![Validate workflows](https://github.com/zarif3624/n8n-enterprise-workflows/actions/workflows/validate.yml/badge.svg)](https://github.com/zarif3624/n8n-enterprise-workflows/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-111827.svg)](LICENSE)
[![n8n](https://img.shields.io/badge/n8n-workflows-EA4B71.svg)](https://n8n.io/)

> Start with a decision workflow, prove the policy, then connect enterprise
> systems. Templates never include credentials or make irreversible changes.

## What makes a template production-minded

Every workflow package includes:

- A typed, machine-readable JSON input contract with field-level validation.
- Low-risk, high-risk, and invalid fixtures that can be sent to the test webhook.
- Explainable scoring with stable rule IDs, policy versions, and hard risk floors.
- Tamper-evident policy fingerprints with CI-enforced version bumps for behavior changes.
- Fingerprint-bound draft/approval status, owner review deadlines, overdue CI gates, and explicit deprecation windows.
- Human-readable policy snapshots and pull-request summaries for owner review.
- Before/after policy replay across both branches' fixtures and every declared rule witness.
- A SHA-256 artifact manifest and reproducible full-catalog and per-department release archives.
- Privacy-safe batch conformance analysis with contract, outcome, score, and rule-coverage gates.
- Fingerprint-locked aggregate drift comparison for invalid-rate, score, outcome, rule, and mapping shifts.
- Structured HTTP 200, 400, 415, and sanitized retryable 500 responses with correlation IDs, no-store caching, and MIME-sniffing protection.
- A credential-free, inactive workflow that uses native n8n expressions instead of a Code node.
- Security, operations, human-approval, adapter, and ROI guidance.

The shared test suite checks these guarantees across the full catalog instead of relying on screenshots or manual import checks.
It also runs a fixed-seed [adversarial corpus](docs/adversarial-testing.md) across every policy and mapping boundary to catch crashes, nondeterminism, unsafe bounds, prototype-shaped inputs, and payload echo.
The scheduled compatibility matrix also boots the versions pinned in the machine-readable [runtime compatibility plan](runtime-compatibility.json), exercises a representative webhook over HTTP, and forces an evaluator exception to prove the sanitized 500 path. This catches runtime behavior that import checks cannot see and prevents CI from drifting away from documented support.
Pull-request CI separately replays changed policies against target-branch and current fixtures plus isolated rule witnesses, then summarizes any score, band, decision, matched-rule, action, or validation delta for business-owner review.
The suite also executes every low/high/invalid fixture through the source engine and validates the resulting 200/400 objects plus the sanitized 500 shape against that endpoint's published OpenAPI schema.

## Why this project exists

Most workflow galleries show what a tool can connect. Enterprise teams need
more: ownership, input contracts, failure behavior, human approvals, security
controls, measurable outcomes, and a path from development to production.

This project makes those concerns part of each workflow package.

## Workflow catalog

| Department | Workflow | Business outcome |
| --- | --- | --- |
| Finance | [Invoice exception triage](workflows/finance/invoice-exception-triage) | Route clean invoices, reviews, and payment holds consistently |
| Human Resources | [Employee access request triage](workflows/human-resources/employee-access-request-triage) | Separate standard access from privileged review |
| Information Technology | [Service desk priority routing](workflows/information-technology/service-desk-priority-routing) | Reduce incident assignment time |
| Security | [Phishing report triage](workflows/security/phishing-report-triage) | Prioritize containment review without destructive automation |
| Sales | [Enterprise lead routing](workflows/sales/enterprise-lead-routing) | Improve speed to lead for qualified accounts |
| Marketing | [Campaign lead compliance gate](workflows/marketing/campaign-lead-compliance-gate) | Keep consent and suppression decisions visible |
| Customer Success | [Customer risk escalation](workflows/customer-success/customer-risk-escalation) | Engage at-risk accounts before renewal |
| Legal | [Contract intake routing](workflows/legal/contract-intake-routing) | Send contracts to the correct review path sooner |
| Procurement | [Vendor risk intake](workflows/procurement/vendor-risk-intake) | Start security, privacy, and legal diligence earlier |
| Operations | [Major incident stakeholder brief](workflows/operations/major-incident-stakeholder-brief) | Accelerate consistent incident communications |
| Data and Analytics | [Data access request triage](workflows/data-and-analytics/data-access-request-triage) | Govern sensitive and externally shared data access |
| Engineering | [Production change risk gate](workflows/engineering/production-change-risk-gate) | Preserve accountable review for risky releases |
| Facilities | [Workplace incident routing](workflows/facilities/workplace-incident-routing) | Escalate safety and security events quickly |
| Corporate Communications | [External communication approval](workflows/corporate-communications/external-communication-approval) | Prevent high-risk messages from bypassing reviewers |
| Privacy | [Data subject request triage](workflows/privacy/data-subject-request-triage) | Keep identity, deadline, and legal constraints visible |

Browse the machine-readable [catalog](catalog.json), the generated
[OpenAPI 3.1 contract](openapi.json), the [reviewable policy snapshot](policy-snapshot.json), the [policy lifecycle contract](policy-lifecycle.json), the [runtime compatibility plan](runtime-compatibility.json), the [artifact manifest](artifact-manifest.json), or the [department index](docs/catalog.md).
Machine integrations can validate adoption-tool JSON against the published
[Draft 2020-12 schemas](schemas/README.md), including the complete catalog contract.
Use `npm run contracts -- list --json` to discover every repository document and generated CLI output with its schema; `npm run contracts -- validate` checks the registry, every document, and complete schema coverage.

Get an honest deployment-facing summary without exposing payloads:

```bash
npm run readiness
npm run --silent readiness -- --json
npm run readiness -- --workflow invoice-exception-triage
```

The report distinguishes valid repository evidence from production authorization. Scope it to one workflow for a fingerprint-bound adoption preflight with only that policy's governance gates. A green repository can still be deployment-blocked by draft, overdue, or deprecated policies, and every template still requires environment-specific authentication, field mapping, adapters, human approvals, monitoring, retention, and rollback.
Every documented CLI supports `--help` and `-h` with a successful exit, so commands can be discovered safely without supplying files or running an analysis.

Find a starting point by business language or system, then generate a rollout worksheet:

```bash
npm run catalog -- search "security approval"
npm run catalog -- plan invoice-exception-triage --adapter SAP
```

The planner combines typed field mapping, expected fixture outcomes, owner approval, production controls, observability, rollback, and optional capacity-value assumptions. See [catalog discovery and adoption planning](docs/adoption-planning.md).

## Five-minute start

### Option A: Import in n8n

1. Download a package's `workflow.json`.
2. In an n8n development project, choose **Import from File**.
3. Read the sticky note and companion README.
4. Send the sample payload to the test webhook URL.
5. Review the response with the business owner before connecting downstream systems.

Each package includes ready-to-send fixtures:

```text
examples/low-risk.json
examples/high-risk.json
examples/invalid.json
```

The templates ship inactive and use unauthenticated webhooks for local testing.
Configure n8n's built-in webhook authentication before production activation.

To inspect a decision before importing n8n, run the exact same source policy locally:

```bash
npm run evaluate -- invoice-exception-triage \
  workflows/finance/invoice-exception-triage/examples/high-risk.json
```

The command exits 0 for a valid decision, 2 for a contract violation, and 1 for CLI or file errors.

After mapping source fields, evaluate a sanitized JSON array or JSONL sample
without emitting payload values or per-record results:

```bash
npm run mapping -- init invoice-exception-triage > invoice-mapping.json
npm run mapping -- check invoice-mapping.json
npm run conformance -- invoice-exception-triage ./sanitized-invoices.jsonl \
  --mapping invoice-mapping.json \
  --min-records 100 --max-invalid-rate 0.02 --min-rule-coverage 0.8
```

The declarative mapper uses safe JSON Pointers and explicit transforms, is bound
to the exact policy fingerprint, and never executes adopter code. The aggregate report records the exact policy fingerprint, outcome mix, score
distribution, rule coverage, and field/code violation counts. Optional gates
exit nonzero for CI or UAT. See [field mapping](docs/field-mapping.md) and [privacy-safe conformance testing](docs/conformance-testing.md).

After approval, retain the aggregate baseline and compare a comparable current
sample without reloading source records:

```bash
npm run conformance:compare -- baseline-conformance.json current-conformance.json \
  --min-current-records 100 --max-invalid-rate-increase 0.02 \
  --max-band-rate-delta 0.10 --max-rule-rate-delta 0.15
```

The comparison refuses policy or mapping identity changes and clearly labels
rate movement as a monitoring signal, not causal proof. See [aggregate drift monitoring](docs/drift-monitoring.md).

### Option B: Attach a workflow to Codex through n8n MCP

1. Follow [Set up n8n MCP](docs/mcp-setup.md).
2. Install the [official n8n agent skills](https://github.com/n8n-io/skills).
3. Attach [the starter invoice workflow](workflows/finance/invoice-exception-triage/workflow.json) to your Codex task.
4. Use the prompt in [MCP-assisted adoption](docs/mcp-adoption.md).
5. Let Codex validate and create the workflow in your n8n development project.

## Enterprise design principles

- **Policy before plumbing:** validate decision logic before adding external writes.
- **Human authority:** consequential financial, security, legal, employment, and customer actions require approval.
- **No embedded secrets:** configure credentials only in n8n's credential system.
- **Inactive by default:** importing a template cannot expose a live endpoint.
- **Observable outcomes:** every workflow returns a request ID, score, reasons, decision, and recommended actions.
- **Promotion discipline:** test in development and promote through reviewed environments.
- **Measurable value:** every workflow names an operational metric and ROI starting point.

Read the complete [enterprise readiness checklist](docs/enterprise-readiness.md)
and [security model](SECURITY.md).

## Validate locally

```bash
npm run check
```

The validator checks workflow shape, node identity, graph reachability,
policy-expression parity, policy fingerprints, review-snapshot parity and version discipline, independent rule coverage, typed contracts, representative fixtures, unique
webhook paths, inactive status, response behavior, credential leakage,
companion documentation, and catalog coverage. The test suite then exercises
every required field, declared type, rule boundary, safety floor, and deterministic adversarial-input invariant.
The same command also runs a redacted sensitive-data scan across every repository text file, not only exported workflows.
It fails when a policy-owner review is overdue; see [policy lifecycle governance](docs/policy-lifecycle.md) for the review and deprecation process.

## Extend the catalog

The source of truth is [scripts/workflow-definitions.mjs](scripts/workflow-definitions.mjs); workflow JSON, package READMEs, examples, and catalog metadata are generated artifacts. Read [policy authoring](docs/policy-authoring.md) before changing scoring behavior, then run:

```bash
npm run check
npm run report:policy-changes -- origin/main
npm run report:policy-impact -- origin/main
git diff --exit-code
```

The final command should only be clean after generated changes have been reviewed and committed.

## Verify a release

Each tagged release publishes one complete source/catalog archive and one self-contained archive per department. `SHA256SUMS` covers every archive and the release manifest; each archive's `BUNDLE.json` then covers every file inside it.

```bash
# Run from the directory containing the downloaded release files.
sha256sum --check SHA256SUMS

# Verify GitHub Actions build provenance for a chosen archive.
gh attestation verify n8n-enterprise-workflows-finance-v0.2.0.tar.gz \
  -R zarif3624/n8n-enterprise-workflows

# From a trusted checkout, verify the archive's embedded file manifest.
npm run verify:bundle -- /path/to/n8n-enterprise-workflows-finance-v0.2.0.tar.gz
```

On macOS, use `shasum -a 256 -c SHA256SUMS` for the checksum step. Outer checksums and GitHub provenance establish the downloaded archive's identity; the bundle verifier then rejects unsafe tar structure and checks the exact internal file set against `BUNDLE.json`. Maintainers can reproduce the exact archives locally with `npm run build:release`; the build omits timestamps, user IDs, file-system ordering, and platform-specific gzip metadata.

## Release rhythm

The project targets two useful releases each week. A release should normally add
one enterprise workflow package. Improvements to an existing workflow are
appropriate when they fix a real adoption, correctness, security, or operability
problem. See the [release process](docs/release-process.md).

## Roadmap

- Native adapters for Salesforce, ServiceNow, Slack, Microsoft Teams, SAP, Workday, and common data warehouses
- Human-approval sub-workflows and reusable error handlers
- Industry packs for financial services, healthcare, software, and professional services
- Broaden the scheduled import compatibility matrix as supported n8n releases evolve
- Outcome benchmarks and community-submitted deployment notes

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Workflow requests are especially
valuable when they include the department, trigger, systems, approval points,
risk level, and measurable outcome.

## License

MIT. n8n is a trademark of n8n GmbH. This community project is not an official
n8n project and is not endorsed by n8n GmbH.

Built by [Zarif](https://github.com/zarif3624), creator of
[Zarif Automates](https://zarifautomates.com).
