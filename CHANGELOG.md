# Changelog

All notable changes to this project are documented here. The project follows Semantic Versioning for repository releases; individual decision policies carry their own policy version in responses and catalog metadata.

## Unreleased

No changes yet.

## 0.4.1 - 2026-08-13

### Changed

- Updated the current-stable compatibility target from n8n `2.33.7` to `2.34.5` while retaining `2.13.0` as the minimum supported release.
- Added a regression test that pins both scheduled runtime targets so compatibility coverage cannot silently drift to an outdated stable release.

### Validation

- Imported all 16 inactive workflows with n8n `2.34.5` and passed the representative low-risk, high-risk, invalid-fixture, null-body, unsupported-content-type, and forced-internal-error webhook probes.

## 0.4.0 - 2026-08-12

### Added

- Twelve complete inactive, credential-free starter workflows: agent evaluation release gate, multi-model routing fallback, enterprise data reconciliation control, meeting-to-action review, research to CRM review, closed-won launch readiness, incident RCA evidence review, RFP response evidence review, support escalation command center, people operations case routing, customer health action review, and field service completion review.
- Typed contracts, normal/review/rejection fixtures, deterministic decision policies, OpenAPI operations, lifecycle entries, field mappings, adoption guidance, ROI models, and security considerations for every new starter.
- A trusted-base public-continuity command that rejects removal of a previously public workflow unless maintainers provide a separately reviewed approval artifact.

### Changed

- Expanded the evidence-backed portfolio contract to 64 normalized sellable families: 31 evidence-derived category slots and 33 newer named concepts, partitioned into 16 public and 48 commercial-reserve families without publishing the reserved backlog.
- Expanded the self-contained public collection from four to sixteen workflows across fifteen departments. Public lineage is four evidence-derived families and twelve newer concepts; reserved lineage is 27 evidence-derived and 21 newer concepts.
- Expanded release output to sixteen reproducible archives: one complete source archive and one archive for each of the fifteen represented public departments.
- Hardened generated workflow documentation so enum-constrained input contracts render their supported values in README tables.

### Security

- Prevented a contributor from self-authorizing deletion of a published public workflow by modifying the candidate contract and its authorization data in the same change.
- Sanitized tracked design records and added tracked-tree plus full-source-archive boundary scanning so internal workspace locators and detailed commercialization material cannot enter public releases.

## 0.3.0 - 2026-08-12

### Added

- A machine-readable, schema-validated `portfolio.json` contract that enforces the exact 4-of-16 open-source and 12-of-16 commercial-reserve allocation.
- A documented open-core model with weighted public selection criteria, a no-private-dependency guarantee, contribution routing, and an explicit historical MIT licensing notice.
- A portfolio validation CLI and CI gate that bind the allocation to the source definitions, generated catalog, workflow tree, and a code-pinned one-time removal authorization.

### Changed

- Reframed the repository as a focused four-workflow community edition across finance, IT, security, and engineering. The complete contract, policy, lifecycle, conformance, compatibility, and release toolchain remains public and self-contained.
- Reduced the generated inventory to 43 integrity-checked artifacts, four policy lifecycles, four OpenAPI operations, and five reproducible release archives.
- Replaced the public workflow-growth quota and vendor-adapter roadmap with quality-driven improvements to the four starters and shared safety/adoption tooling.
- Users who need a removed template can remain on `0.2.1` or fork its MIT-licensed history. This boundary does not revoke prior rights or make historical Git objects secret.

### Removed

- Twelve never-approved draft workflow implementations from the current public catalog: AI use-case risk intake, employee access request triage, enterprise lead routing, campaign lead compliance gate, customer risk escalation, contract intake routing, vendor risk intake, major incident stakeholder brief, data access request triage, workplace incident routing, external communication approval, and data subject request triage.

## 0.2.1

### Added

- Enterprise AI use-case risk intake with hard approval floors for consequential decisions and regulated processes.
- Standardized successful `--help` and `-h` discovery across all documented operator CLIs.
- CI-enforced production-script coverage floors (90% lines, 70% branches, and 90% functions) with a local file-level coverage command.
- Tagged release CI now clean-installs and runs the full validation suite from inside the packaged source archive before attestation and publication.
- Department release bundles now include schema-valid, fingerprint-bound mapping templates and the field-mapping, conformance, and drift guidance required to use them safely.
- Release tests now require every relative Markdown link in a department archive to resolve entirely within that archive.
- Release coverage validates mapping schemas, lifecycle fingerprints, catalog scope, internal manifests, and documentation closure across all 16 department archives rather than one representative bundle.
- Readiness and security guidance now require upstream request-body size limits as well as rate limiting, since accepted-but-ignored fields are not a total payload-size bound.
- Generated rollout plans now include ingress body-size/rate gates and use silent npm invocation when redirecting mapping JSON, preventing unusable plan-generated artifacts.
- Markdown validation now rejects non-silent npm commands that claim to emit machine JSON, making clean stdout a documented contract.
- Validation CI now cancels obsolete runs for the same ref while tagged release jobs remain non-canceling.
- A deterministic `policy-lock.json` with canonical SHA-256 fingerprints for all executable policy behavior.
- Local generation and pull-request guards that reject silent policy changes, engine changes without an engine-version bump, and policy-version regressions.
- Governance tests for deterministic fingerprints, behavior-change detection, engine discipline, and semantic-version ordering.
- A reusable HTTP runtime smoke tester and scheduled success, validation, and forced-error webhook checks across the supported n8n compatibility matrix.
- Dedicated evaluator error outputs and sanitized retryable HTTP 500 responders across all 16 workflows.
- Independent decision assertions for all 85 declared policy rules plus governance, integrity, impact, report, archive, CLI, mapping, conformance, drift, schema, OpenAPI, adversarial, sensitive-data, privacy, lifecycle, readiness, and CI supply-chain coverage, increasing the suite from 58 to more than 260 tests.
- A canonical `policy-snapshot.json` and pull-request report that explains contract, rule, threshold, decision, action, owner, version, and fingerprint changes.
- A generated SHA-256 manifest covering all 101 public generated and machine-contract artifacts.
- Reproducible full-catalog and per-department release archives with internal file manifests, outer checksums, strict tag/version matching, and GitHub Actions build-provenance attestations.
- Immutable full-SHA pins for every external GitHub Action plus monthly Dependabot update checks.
- Pull-request behavior replay across both branches' representative fixtures and isolated old/new rule witnesses, with observable decision deltas in the job summary.
- A no-dependency catalog CLI for discovery, machine-readable inspection, and workflow-specific adoption plans with field mapping, controls, fixture evidence, observability, rollback, and optional capacity-value scenarios.
- A privacy-safe batch conformance CLI for JSON or JSONL samples with aggregate contract, outcome, score, rule-coverage, violation, and configurable rollout-gate evidence.
- A fingerprint-bound declarative field-mapping CLI with safe JSON Pointer extraction, explicit transforms, drift rejection, and aggregate-only mapping failure evidence.
- Aggregate conformance baseline comparison with strict policy/mapping identity, score and distribution deltas, configurable operational gates, and explicit statistical limitations.
- Published JSON Schema Draft 2020-12 contracts for mappings, conformance reports, and conformance comparisons, all covered by release integrity hashes.
- Fixed-seed adversarial testing across every policy and mapping boundary for crash safety, determinism, score/rule bounds, prototype-shaped data, safe serialization, and private-marker non-echo.
- A consumer-facing release bundle verifier with decompression limits, safe-path/type parsing, exact file-set enforcement, and per-file byte/SHA-256 checks against `BUNDLE.json`.
- Redacted full-repository sensitive-data scanning for provider tokens, private keys, JWTs, and high-entropy credential assignments, enforced by the standard local and CI check.
- Executable OpenAPI conformance across all 16 operations: valid/invalid requests and real 200/400 plus sanitized 500 response objects are checked against their published schemas, with negative leakage and decision-drift tests.

### Changed

- Readiness evidence can now be scoped and fingerprint-bound to one workflow, exposing its exact owner, lifecycle, review date, and deployment gates without catalog-wide approval noise; deprecated policies now fail closed.
- Clarified that unknown request fields are accepted for compatibility but ignored and never echoed.
- Pretty-serialized embedded policy JSON so n8n cannot misread nested `}}` as an early expression terminator; all policies and the shared engine move to patch version `1.0.1`.
- OpenAPI operations now constrain workflow identity, policy version, and decision enums per endpoint and document correlation/cache headers on 200, 400, and 500 responses.

### Fixed

- Compatibility smoke tests now wait for published webhook registration after n8n health readiness, avoiding a startup race on current stable releases.
- A runtime-only failure where importable workflows produced empty HTTP 200 responses because the Edit Fields raw-expression parser rejected compact nested policy JSON.
- Documented stdin (`-`) support now reads piped JSON reliably in both single-record evaluation and batch conformance commands without echoing malformed input.
- Mapping validation now rejects omitted optional fields that drive policy rules, preventing silent signal suppression or permanently triggered `missing`/`falsy` behavior.
- Explicit `body: null` engine envelopes now produce the root `invalid_type` violation instead of being mistaken for the surrounding envelope; live compatibility probes also verify n8n's transport-normalized empty-object form fails closed with a contract-valid 400. The shared engine and embedded policies move to patch version `1.0.3`.
- A schema-validated `runtime-compatibility.json` contract now drives the scheduled n8n matrix, eliminating version and probe-scope drift between CI, documentation, and release artifacts.
- Honest draft status, owner-bound approval/review schedules, current/due-soon/overdue reports, an overdue CI gate, and explicit deprecation notice windows now prevent unapproved or unchanged policies from aging silently.
- A strict catalog JSON Schema now gives consumers a stable contract for workflow discovery, business metadata, typed inputs, decision names, adapters, endpoints, and fixture locations.
- Strict artifact-manifest and policy-lock JSON Schemas now let external consumers validate integrity metadata and governed behavior identities without executing repository code.
- A strict policy-snapshot JSON Schema now exposes the complete review baseline—typed contracts, rules, thresholds, decisions, and actions—to portable governance tooling.
- A self-validating contract registry now maps every repository document and structured CLI output to its schema, rejects missing or duplicate entries, and fails when any schema is orphaned.
- Portable bundle and release manifest schemas now validate embedded file identities plus the outer archive inventory, scopes, byte sizes, and digests produced by the release builder.
- A privacy-safe readiness report now separates repository validity from deployment authorization, surfaces draft and overdue policy blockers, enumerates required environment controls, and states the limits of its evidence.
- Validation CI now publishes the readiness report to the job summary, while contribution, pull-request, and release guidance explicitly preserve draft/approval truthfulness.
- All 200, 400, and sanitized 500 webhook responses now send `X-Content-Type-Options: nosniff`; OpenAPI, structural validation, and real-runtime smoke checks enforce the header.
- Explicit non-JSON request media types now fail closed with a sanitized, documented HTTP 415 response; JSON suffix media types remain compatible. The shared engine and all embedded policies move to patch version `1.0.4`.
- Static workflow validation and the live forced-error probe now require explicit JSON response media types on both normal and internal-error paths.
- Lifecycle reporting now rejects unknown, duplicated, missing-value, and command-incompatible options instead of silently ignoring ambiguous governance input.
- Machine-output documentation now uses silent npm invocation, preventing npm banners from corrupting redirected JSON mapping, conformance, lifecycle, readiness, catalog, and contract artifacts.
- Runtime-compatibility and contract-registry commands now reject extra, repeated, unknown, and command-incompatible arguments instead of emitting ambiguous governance evidence.
- Policy lifecycle entries are now bound to the exact policy version and behavior fingerprint, preventing prior approval metadata from silently carrying forward after executable behavior changes.

## 0.2.0

### Added

- Five workflow packages for data governance, engineering changes, workplace incidents, external communications, and privacy requests.
- Typed JSON input contracts with field-level violations across all 15 workflows.
- Low-risk, high-risk, and invalid fixtures for every package.
- A deterministic source policy engine and a local `npm run evaluate` command.
- An OpenAPI 3.1 contract covering every webhook decision endpoint.
- A 52-test policy suite covering fixtures, required fields, types, constraints, rule boundaries, safety floors, correlation IDs, and response privacy.
- Scheduled n8n 2.13 and 2.33 import-compatibility checks.
- Policy-authoring, threat-model, operations, and release guidance.

### Changed

- Replaced single-item Code nodes with native Edit Fields expressions generated from the source policy engine.
- Added stable rule IDs, policy/schema versions, named-node references, `Cache-Control: no-store`, and `X-Request-Id` response headers.
- Hardened validation for graph reachability, expression parity, schema/catalog/OpenAPI drift, unsafe retention defaults, credential metadata, and representative fixtures.
- Added repository-wide validation for broken or escaping relative Markdown links.
- Added hard high-risk floors so compliance and safety gates cannot be canceled by mitigating negative scores.
- Made CI installs reproducible with `npm ci`.

### Security

- Sanitized caller-provided request IDs before reflecting them in response headers.
- Kept request bodies out of decision responses and documented adopter-owned trust boundaries.
