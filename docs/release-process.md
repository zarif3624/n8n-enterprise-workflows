# Release process

The project ships when a coherent improvement clears every validation and release gate. There is no release-count or workflow-count quota.

## Preferred release unit

Prefer one focused improvement to the existing community surface:

- safer or clearer behavior in one of the sixteen workflow starters;
- better contracts, fixtures, governance, compatibility, or release evidence; or
- lower-friction adoption documentation and tooling.

A new public workflow is exceptional. It must pass the selection process in the [open-core model](open-core-model.md) and preserve an explicitly approved portfolio allocation. Commercial product work is released through its own private process, never through dependencies hidden inside a community archive.

## Release checklist

1. Run `npm run check`, then review `npm run readiness`. A `ready` repository status is required; deployment blockers may remain when publishing intentionally inactive draft templates, but must be called out in release notes.
2. Confirm every changed policy fingerprint has an intentional semantic-version bump.
3. Review the generated diff, confirm `npm run scan:sensitive` passes, manually check for customer data the scanner cannot classify, and confirm `artifact-manifest.json` changed only where expected.
4. Confirm links, catalog metadata, the policy lock, policy snapshot, and generated OpenAPI contract.
5. Confirm `npm run portfolio:validate` reports 16 of 64 public and 48 of 64 reserved. Run `npm run portfolio:continuity -- --base <trusted-base-portfolio.json>` against a protected merge-target or release-tag copy; candidate-local edits cannot authorize removal of a previously public workflow. Confirm that the full release builds without private files or network-fetched implementation code.
6. Run the `n8n import compatibility` workflow for node-version or export-shape changes.
7. Merge through a focused pull request so CI can compare policy versions with the target branch.
8. Update `package.json` and tag that exact semantic version as `vMAJOR.MINOR.PATCH`.
9. Let the tag workflow rerun validation, reproduce the archives, verify every embedded bundle manifest and outer checksum, clean-install and validate the packaged source archive, create GitHub build-provenance attestations, and publish the release.
10. Verify one downloaded archive with both `SHA256SUMS` and `gh attestation verify`.
11. Write release notes around the business outcome, not the node count.
12. Publish a short example or implementation note for discovery.

## Distribution contract

`npm run build:release` creates `dist/` from validated source without timestamps or host-specific ownership metadata. It produces:

- One complete archive with the portfolio contract, generated artifacts, source policy tooling, CI/release metadata, documentation, and tests.
- Fifteen self-contained department archives, one per represented public department, with that department's workflows; filtered catalog, OpenAPI, policy lock, policy snapshot, and lifecycle contract; fingerprint-bound field-mapping templates; plus conformance, drift, runtime compatibility, JSON Schema, and deployment guidance.
- A `BUNDLE.json` inside every archive that hashes every other bundled file.
- `release-manifest.json`, which records archive scope, workflow count, byte size, and SHA-256 identity.
- `SHA256SUMS`, which covers every archive and the release manifest.

The `0.4.0` release therefore produces sixteen archives: one complete source archive and fifteen department archives.

The builder extracts every archive in memory and verifies its USTAR headers and internal file manifest before writing the release index. Release CI also extracts the complete source archive into a fresh directory, performs `npm ci --ignore-scripts`, and runs the full check from inside the package. CI builds releases only from a pre-existing tag that exactly matches `package.json`; `gh release create --verify-tag` prevents the publication command from silently creating or moving a tag.

Consumers can verify the downloaded files from their containing directory:

```bash
sha256sum --check SHA256SUMS
gh attestation verify <archive.tar.gz> -R zarif3624/n8n-enterprise-workflows
npm run verify:bundle -- <archive.tar.gz>
```

Use `shasum -a 256 -c SHA256SUMS` instead of `sha256sum` on macOS. Run
`verify:bundle` from a trusted checkout: it limits decompression, accepts only
regular safe-path entries under one root, and requires the exact byte count and
SHA-256 identity of every file declared by `BUNDLE.json`. The embedded manifest
is not an authenticity mechanism by itself; verify the outer checksum and
provenance first.
