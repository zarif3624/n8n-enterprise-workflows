# Expanded 64-family open-core portfolio implementation plan

**Goal:** Expand the project to an exact 64-family portfolio with 16 complete public n8n starter workflows and a separately maintained 48-family commercial reserve.

**Architecture:** Keep `scripts/workflow-definitions.mjs` as the public generator source of truth. Extend the machine-readable portfolio contract with source-lineage arithmetic, add twelve vendor-neutral decision workflows, protect public continuity against trusted base revisions, regenerate every public artifact, and keep all separate product work outside the public repository and release process.

**Tech stack:** Node.js 20+ ES modules, `node:test`, JSON Schema Draft 2020-12, generated n8n workflow JSON, reproducible tar/gzip archives, Git/GitHub Actions.

## Fixed public decisions

- Portfolio denominator: 64 normalized sellable workflow families.
- Source lineage: 31 evidence-derived families plus 33 newer named concepts.
- Public allocation: 16 families (25%); commercial reserve: 48 families (75%).
- Public lineage: four evidence-derived families plus twelve newer concepts.
- Reserved lineage: twenty-seven evidence-derived families plus twenty-one newer concepts.
- Release version: `0.4.0`.
- Public releases remain inactive, credential-free, vendor-neutral, deterministic, decision-only, and self-contained.
- Product implementation and planning remain outside the public Git repository and all public archives.

## Task 1: Lock the expanded portfolio contract

- Require 64/16/48 arithmetic, complete lineage partitioning, and the exact sixteen public identities.
- Validate the schema, generated catalog, source definitions, and workflow tree as one identity set.
- Add a continuity CLI that compares the candidate with a separately trusted base and cannot accept approval from candidate-controlled data.
- Wire continuity validation into CI and preserve the `0.3.0` removal list only as immutable history.

## Task 2: Extend definition-level workflow contracts

- Cover bounded numbers, booleans, enums, arrays, date-times, length-limited strings, and workflow-specific adapter classes with focused tests.
- Preserve deterministic evaluation, explainable policy rules, structured responses, error wiring, inactive exports, and credential-free JSON.

## Task 3: Define and generate the twelve additions

- Add the approved public identities with complete owners, input contracts, policy rules, decisions, actions, metrics, ROI guidance, fixtures, mappings, and security documentation.
- Keep all actions advisory and preserve explicit human review for consequential outcomes.
- Generate exactly sixteen workflow packages, forty-eight fixtures, sixteen OpenAPI operations, sixteen governed policies, and complete draft lifecycle ownership.

## Task 4: Update inventory and release expectations

- Assert identities as well as exact counts: 16 workflows, 15 public departments, 48 fixtures, 103 integrity-covered artifacts, and 16 release archives.
- Keep lifecycle tests deterministic and run the complete unit suite without weakening existing guarantees.

## Task 5: Publish public documentation and version `0.4.0`

- Explain the evidence-backed 64-family denominator, 16/48 allocation, lineage arithmetic, complete public starter surface, and clear community/product boundary.
- Preserve historical licensing statements and replace stale current-state counts and archive examples.
- Document the trusted-base continuity guard at user and maintainer level.
- Run link, sensitive-data, public-boundary, generator, and full repository validation.

## Task 6: Build and validate the separate private product seed

- Perform this work outside the public repository and public release contents.
- Preserve applicable historical evidence and create the separate product materials needed by the private process.
- Validate completeness, internal consistency, the approved aggregate allocation, and isolation from every public identity and artifact.
- Do not add customer-specific claims, secrets, production endpoints, or unsupported adoption claims.

## Task 7: Full public verification and reproducible release build

- Run `npm run check`, production coverage gates, package audit, and whitespace validation.
- Build the release twice and compare hashes for reproducibility.
- Verify every archive, its outer checksum, its embedded manifest, scope, and Markdown-link closure.
- Confirm one complete source archive plus one archive for each of the fifteen represented public departments.
- Extract the full source archive into a new temporary directory, install from the lockfile, and run the complete check suite.
- Run the pinned n8n import/runtime compatibility checks.
- Require zero private-boundary findings in the tracked public tree and actual release contents.

## Task 8: Review, publish, and verify

- Review the complete public diff for generated noise, accidental removals, stale claims, boundary leakage, and unrelated changes.
- Commit intentionally, reconcile the protected target branch non-destructively, and rerun proportional verification.
- Publish through the reviewed release workflow and require the local, remote, and GitHub commit identities plus CI result to agree before completion.
- After the public release is final, let the separate private process record the exact public baseline without adding its artifacts or operational details here.
