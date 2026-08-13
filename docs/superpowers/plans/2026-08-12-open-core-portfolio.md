# Open-core workflow portfolio implementation record

## Goal and outcome

Release `0.3.0` established a machine-enforced community catalog containing four of sixteen evaluated workflow families. The other twelve implementations were removed from the current public surface without changing the MIT rights or Git history of earlier releases.

## Public architecture

- `portfolio.json` and its strict schema record allocation arithmetic, public identities, selection criteria, and historical licensing notice.
- A pure policy module and CLI validate arithmetic plus catalog, definition, and workflow-tree identity.
- The public generator remains the single source of truth for workflow JSON, fixtures, catalog metadata, OpenAPI, policy artifacts, lifecycle data, documentation, and artifact hashes.
- The standard check covers portfolio consistency, workflow safety, contracts, runtime compatibility, links, sensitive data, and tests.
- Public release archives are reproducible, independently verifiable, and contain no dependency on product work outside this repository.

## Historical implementation sequence

1. Preserve the previously published baseline outside the public release process.
2. Add failing allocation, identity, schema, and CLI tests.
3. Implement the public portfolio contract and validation gate.
4. Reduce the generated current catalog to the approved four public workflows.
5. Update current documentation and package version to the `0.3.0` boundary.
6. Build reproducible release archives, extract the source archive into a clean environment, and run the complete check suite.
7. Confirm the release contains only approved public source and publish through reviewed CI.

## Durable constraints

- Previously published MIT rights remain intact; removal from a later release does not make earlier code private.
- Public workflow exports remain inactive, credential-free, decision-only, and human-reviewed.
- Product implementation details and planning remain outside the public repository and its archives.
- A new public workflow requires explicit selection, contract migration, tests, documentation, and a versioned release.

This record intentionally omits internal product identities, workspace locations, artifact names, packaging, prioritization, and roadmap detail.
