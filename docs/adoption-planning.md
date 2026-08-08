# Catalog discovery and adoption planning

The catalog CLI turns repository metadata into a practical selection and rollout workflow. It is read-only, uses no credentials, calls no external systems, and never activates an n8n workflow.

## Find the right starting point

List everything or filter by department and typical adapter:

```bash
npm run catalog -- list
npm run catalog -- list --department security
npm run catalog -- list --adapter "Microsoft Teams"
```

Search across workflow names, slugs, departments, adapters, summaries, outcomes, owners, and metrics. Every term must match somewhere in the same catalog entry:

```bash
npm run catalog -- search "phishing security"
npm run catalog -- search "approval" --adapter Slack
```

Inspect a workflow's typed fields, rules, hard gates, decisions, owner, endpoint, version, and fingerprint:

```bash
npm run catalog -- show invoice-exception-triage
```

Add `--json` to `list`, `search`, `show`, or `plan` when another tool will consume the result, and invoke it as `npm run --silent catalog -- ... --json` so npm's own banner does not contaminate the JSON stream.

## Generate an adoption plan

The plan command creates a fill-in field-mapping worksheet, evaluates the shipped fixtures, identifies the policy approver, and adds security, reliability, promotion, rollback, observability, and value-measurement gates:

```bash
npm run catalog -- plan invoice-exception-triage --adapter SAP
```

The adapter is a planning label, not a node configuration. A catalog suggestion is recognized explicitly; custom selections remain allowed because enterprise system landscapes differ. Configure credentials only in n8n and discover current node parameters before implementation.

## Add a capacity-value scenario

Provide all three inputs together to add a conservative annual capacity estimate:

```bash
npm run catalog -- plan invoice-exception-triage \
  --monthly-volume 5000 \
  --minutes-saved 4 \
  --hourly-cost 60
```

This calculation is `monthly volume × 12 × minutes saved × loaded hourly cost ÷ 60`. It is an illustrative capacity value, not guaranteed cash savings. The generated plan also shows the workflow-specific ROI model, which may require factors such as exception rate, error reduction, conversion, retention, or avoided loss. Replace assumptions with observed values after rollout.

## Complete the plan before production

The generated Markdown intentionally contains `<map source field>`, `<classify>`, and `<assign>` placeholders. Complete every required mapping, retain low/high/invalid fixture evidence, run the included [privacy-safe conformance](conformance-testing.md) command against sanitized mapped records, test duplicate and failure paths, and obtain the named owner's approval for the exact policy fingerprint. The plan complements the [enterprise readiness checklist](enterprise-readiness.md); it does not replace security, privacy, legal, or change-management review.
