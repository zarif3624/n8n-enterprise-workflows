# Expanded open-core workflow portfolio design

## Decision

The project will expand from sixteen to sixty-four normalized, sellable workflow families. Sixteen families will be implemented as open-source starter workflows and forty-eight will be developed as a private commercial reserve. This preserves an exact 25% open-source / 75% private allocation while reflecting the much broader evidence in the new anonymized workbook.

The denominator is derived from two non-overlapping source strata:

- 31 evidence-derived source categories, represented in the workbook by 620 anonymized evidence rows consolidated into 13 safe functional groups; and
- 33 newer, explicitly named workflow concepts.

The 653 spreadsheet rows are evidence records, not 653 different products. Repeated rows support prevalence and maturity analysis; they must not inflate the number of sellable workflow families.

## Alternatives considered

### Use only the 33 newer concepts

This would produce a clean contemporary catalog, but it would ignore most of the historical evidence and cannot yield an exact 25/75 split without dropping or inventing a family. It would also overweight newer AI-platform ideas relative to proven operational workflows.

### Treat all 653 rows as products

This would appear expansive but would create hundreds of duplicates, destroy product clarity, and make the open-source allocation arbitrary. Evidence rows that share the same generalized objective, mechanism, and operating boundary are not separate products.

### Normalize to 64 sellable families

This is the selected approach. It retains all 31 evidence-derived category slots and all 33 newer concepts, supports an exact 16/48 allocation, and provides enough breadth for a credible community collection and separately managed product work.

## Public portfolio

The four existing public workflows remain:

1. `invoice-exception-triage`
2. `service-desk-priority-routing`
3. `phishing-report-triage`
4. `production-change-risk-gate`

Twelve newer workflow concepts will become open-source starter workflows:

5. `agent-evaluation-release-gate`
6. `multi-model-routing-fallback`
7. `enterprise-data-reconciliation-control`
8. `meeting-to-action-review`
9. `research-to-crm-review`
10. `closed-won-launch-readiness`
11. `incident-rca-evidence-review`
12. `rfp-response-evidence-review`
13. `support-escalation-command-center`
14. `people-operations-case-routing`
15. `customer-health-action-review`
16. `field-service-completion-review`

These twelve correspond to named workbook concepts with strong community utility and safe starter boundaries. They cover AI operations, data quality, sales, revenue operations, engineering, customer support, people operations, customer success, and field operations. Each public workflow will remain inactive, credential-free, vendor-neutral, deterministic, and decision-only. Consequential writes, external messages, deployments, financial actions, and regulated decisions remain outside the starter workflow or require an explicit human-reviewed handoff.

The public implementation lineage is therefore four evidence-derived families plus twelve newer concepts. The private lineage is the remaining twenty-seven evidence-derived families plus twenty-one newer concepts.

## Public workflow contract

Every new public workflow must include the same complete adoption surface as the existing collection:

- importable inactive n8n workflow JSON;
- typed input and output contracts;
- representative normal, review, and rejection fixtures;
- deterministic policy rules with explainable reasons;
- a field-mapping contract;
- an OpenAPI endpoint;
- readiness, conformance, drift, adversarial, and policy-replay support;
- adoption instructions, business value, ROI guidance, and security considerations; and
- department and full-collection release archives.

The generator remains the single source of truth. Hand-edited generated JSON is not allowed.

## Portfolio contract and validation

`portfolio.json` will be upgraded to record:

- 64 total evaluated workflow families;
- 16 public families and 48 commercial-reserve families;
- exact 25% and 75% arithmetic;
- source-lineage counts of 31 evidence-derived and 33 newer concepts;
- public-lineage counts of four evidence-derived and twelve newer concepts;
- the exact sixteen public workflow identities; and
- the historical licensing notice for previously published releases.

The schema and focused tests will reject inconsistent lineage, duplicate public identities, mismatches between definitions and catalog output, unexpected workflow directories, or allocation drift.

The previous removal authorization mechanism will also be hardened. A contributor must not be able to delete a published public workflow merely by adding its slug to a mutable list in the same change. Validation will compare the candidate public set with a trusted base revision and reject unapproved removals. The twelve removals already recorded by the `0.3.0` boundary remain historical facts, not a reusable deletion escape hatch.

## Separate product work

The forty-eight-family commercial reserve is developed and validated outside the public Git repository and public release process. Public records retain only the approved aggregate allocation, lineage arithmetic, commercial boundary, and isolation requirement. Product identities, workspace locations, artifact names, schemas, packaging, scoring, prioritization, and roadmap details are intentionally omitted.

## Commercial boundary

The sellable product is not a larger pile of workflow JSON. Commercial differentiation must come from new post-boundary work:

- maintained real-system adapters;
- authenticated tenant and environment isolation;
- resumable and idempotent multi-step orchestration;
- role-aware approvals and exception operation;
- policy configuration and safe migrations;
- telemetry, alerting, operator intervention, and service objectives;
- deployment, rollback, evidence retention, and audit export; and
- support, upgrade windows, and operating benchmarks.

Previously published MIT-licensed templates remain available under their historical license. Separate product work may use them as demand evidence and behavioral reference, but cannot claim historical code as newly proprietary.

## Versioning

The expanded public collection will be released as `0.4.0`. The change adds twelve workflows and expands the portfolio contract without removing the four workflows present in `0.3.0`.

The separate private process may record the final `0.4.0` public baseline after release. Public release archives must not contain or reference private paths, product identities, scores, or private implementation details.

## Verification

Completion requires evidence that:

- the portfolio contract proves 16 of 64 public and 48 of 64 private;
- all sixteen public definitions generate complete workflow packages;
- every new workflow has three fixtures and the required documentation surface;
- the public catalog, OpenAPI document, policy artifacts, and release manifests contain exactly sixteen workflows;
- `npm run check` and production-script coverage thresholds pass;
- the n8n import compatibility smoke test remains stable;
- the release build emits one full archive plus one archive for every represented public department, with reproducible checksums;
- a fresh source-archive extraction installs and passes the complete check suite;
- trusted-base validation prevents self-authorized public workflow removals;
- the separate private process validates its complete 48-family allocation without writing product detail into the public tree;
- public-tree and release-archive scans find no private catalog or path leakage; and
- the final commit is pushed to GitHub `main`, the remote commit matches locally, and GitHub Actions passes.
