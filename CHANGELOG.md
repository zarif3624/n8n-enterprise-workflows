# Changelog

All notable changes to this project are documented here. The project follows Semantic Versioning for repository releases; individual decision policies carry their own policy version in responses and catalog metadata.

## Unreleased

### Added

- A deterministic `policy-lock.json` with canonical SHA-256 fingerprints for all executable policy behavior.
- Local generation and pull-request guards that reject silent policy changes, engine changes without an engine-version bump, and policy-version regressions.
- Governance tests for deterministic fingerprints, behavior-change detection, engine discipline, and semantic-version ordering.
- A reusable HTTP runtime smoke tester and scheduled success, validation, and forced-error webhook checks across the supported n8n compatibility matrix.
- Dedicated evaluator error outputs and sanitized retryable HTTP 500 responders across all 15 workflows.
- Independent decision assertions for all 79 declared policy rules plus governance, integrity, impact, report, archive, CLI, mapping, conformance, drift, schema, adversarial, sensitive-data, privacy, and CI supply-chain coverage, increasing the suite from 58 to 192 tests.
- A canonical `policy-snapshot.json` and pull-request report that explains contract, rule, threshold, decision, action, owner, version, and fingerprint changes.
- A generated SHA-256 manifest covering all 83 public generated and machine-contract artifacts.
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

### Changed

- Clarified that unknown request fields are accepted for compatibility but ignored and never echoed.
- Pretty-serialized embedded policy JSON so n8n cannot misread nested `}}` as an early expression terminator; all policies and the shared engine move to patch version `1.0.1`.
- OpenAPI operations now constrain workflow identity, policy version, and decision enums per endpoint and document correlation/cache headers on 200, 400, and 500 responses.

### Fixed

- A runtime-only failure where importable workflows produced empty HTTP 200 responses because the Edit Fields raw-expression parser rejected compact nested policy JSON.
- Documented stdin (`-`) support now reads piped JSON reliably in both single-record evaluation and batch conformance commands without echoing malformed input.

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
