# Open-core workflow portfolio design record

## Decision

The `0.3.0` boundary selected four of sixteen evaluated workflow families for the current public repository, producing an exact 25% public / 75% commercial-reserve allocation. The selected public workflows were invoice exception triage, service desk priority routing, phishing report triage, and production change risk gate.

The public set formed a portable learning path across finance, IT operations, security, and engineering. Each workflow remained inactive, credential-free, vendor-neutral, decision-only, and backed by the repository's policy, contract, testing, and release machinery.

## Historical constraint

All sixteen pre-boundary templates had already been published under the MIT license. Removing twelve implementations from a later branch did not revoke granted rights, erase Git history, or make historical versions secret. Commercial differentiation therefore had to come from new post-boundary production work and ongoing operation.

## Public selection method

Public candidates were evaluated for community utility, vendor portability, educational coverage, safe starter behavior, low moat leakage, and maintenance fit. The machine-readable portfolio contract recorded the public identities and aggregate allocation without publishing the commercial backlog.

## Public repository architecture

- `portfolio.json` and `schemas/portfolio.schema.json` define the reviewed boundary.
- Portfolio validation checks allocation arithmetic, unique public identities, and exact parity with generated catalog, source definitions, and workflow paths.
- Generated workflow, fixture, catalog, OpenAPI, policy, lifecycle, README, and artifact-manifest output comes from the public definitions.
- Current documentation explains the public/product boundary, contribution gate, no-private-dependency rule, and historical MIT rights.
- Release verification checks reproducibility, archive integrity, clean source extraction, and public-boundary isolation.

## Commercial boundary

The public repository describes only generic categories of post-boundary differentiation, such as maintained adapters, resumable orchestration, role-aware approvals, observability, managed deployment, evidence retention, upgrades, benchmarks, and support. Internal product identities, file locations, packaging, scoring, and roadmap details are intentionally outside this design record and public releases.

## Supersession

The expanded `0.4.0` design supersedes the four-workflow current-state decision while preserving this licensing and boundary history.
