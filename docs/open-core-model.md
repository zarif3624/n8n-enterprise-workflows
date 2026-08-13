# Open-core model

This project intentionally keeps a focused, complete community edition and reserves deeper operating capabilities for a commercial product. The evaluated portfolio contains 64 normalized, sellable workflow families: sixteen (25%) are open source and 48 (75%) are reserved for product development. [`portfolio.json`](../portfolio.json) is the machine-readable source of truth for that boundary.

The 64-family denominator combines 31 evidence-derived category slots with 33 newer named concepts. Repeated evidence records support prevalence and maturity analysis; they do not become duplicate products. The public lineage is four evidence-derived families plus twelve newer concepts. The private lineage is the remaining 27 evidence-derived families plus 21 newer concepts. This document publishes that arithmetic and the public identities without exposing the reserved backlog.

## What the community edition includes

The public repository is a self-contained starter system, not a teaser that requires private code. It includes sixteen importable, inactive, credential-free workflows across fifteen departments; typed contracts and fixtures; deterministic policy evaluation; governance and lifecycle evidence; conformance and drift tools; runtime compatibility checks; and reproducible, verifiable release archives.

A workflow belongs in the community edition when it is broadly useful, portable across vendors, educationally distinct, safe as a decision-only starter, unlikely to disclose product operating depth, and realistic for the maintainers to support well. The weighted criteria and current public identities are recorded in `portfolio.json`; `npm run portfolio:validate` fails if the source tree, catalog, or allocation drifts from them.

## What the commercial product adds

Commercial value is not a paywall around the sixteen public JSON files. It comes from maintained production adapters, multi-step resumable orchestration, role-aware approvals and exception handling, managed deployment and upgrades, observability, evidence retention, operating benchmarks, a control plane, and support. Product implementations live outside this public repository, and public releases must never import, download, or otherwise depend on private files.

The public portfolio contract describes product capability categories without publishing the proprietary workflow backlog or implementation plan.

## Historical licensing

Versions before `0.3.0` published 16 templates under the MIT license. Removing 12 never-approved draft implementations from the current release does not revoke those rights, erase Git history, or make previously published source secret. Users who depend on those templates may remain on `0.2.1` or fork the MIT-licensed history.

The commercial moat therefore begins with post-boundary product work and ongoing operation, not with attempting to reclaim earlier public code.

## Proposing a public workflow

Start with an issue describing the owner, problem, input contract, decision boundary, human authority, measurable outcome, vendor portability, and maintenance burden. A proposal must score well against every public-selection criterion and explain what distinct community learning value it adds.

Acceptance is intentionally selective. A useful request may inform the product roadmap without entering the public source tree. Maintainers may deepen one of the sixteen starters or improve shared safety, testing, documentation, and adoption tooling instead of increasing the public workflow count.

## Public continuity guard

Ordinary validation proves that the candidate repository is internally consistent; it cannot prove that a workflow was not quietly removed by editing the candidate contract and its tests together. The continuity guard therefore compares the candidate public identities with `portfolio.json` from a separately trusted base revision. Additions pass, while a missing previously public workflow fails unless an external approval artifact explicitly authorizes that slug.

Maintainers should obtain the base contract from the protected merge target or release tag and run:

```bash
npm run portfolio:continuity -- --base /path/to/trusted-base-portfolio.json
```

An approved-removals document is an exceptional, externally reviewed input to that command, not a mutable authorization list stored in the same candidate change. The twelve removals recorded at the `0.3.0` boundary remain immutable historical evidence and do not authorize any future deletion.

## Boundary rules

- Public artifacts are buildable, testable, and usable from the public repository alone.
- No public workflow calls a private service merely to recover missing core behavior.
- Credentials, customer data, proprietary adapters, and private implementation details never enter this repository.
- Changes to the 25/75 allocation require an explicit strategy decision, schema change, tests, migration notes, and a versioned release.
- Passing repository checks proves implementation consistency, not production approval; adopters still own authentication, mapping, policy review, monitoring, retention, and rollback.
