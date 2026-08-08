# Release process

The project targets two useful releases each week.

## Preferred release unit

One complete enterprise workflow package:

- Importable inactive workflow JSON
- Companion README
- Sample payload
- Security and human-approval notes
- Business metric and ROI model
- Catalog entry
- Passing validation

Improving an existing workflow is a release-worthy alternative when the change
fixes correctness, security, compatibility, observability, or adoption friction.

## Release checklist

1. Run `npm run check`, then review `npm run readiness`. A `ready` repository status is required; deployment blockers may remain when publishing intentionally inactive draft templates, but must be called out in release notes.
2. Confirm every changed policy fingerprint has an intentional semantic-version bump.
3. Review the generated diff, confirm `npm run scan:sensitive` passes, manually check for customer data the scanner cannot classify, and confirm `artifact-manifest.json` changed only where expected.
4. Confirm links, catalog metadata, the policy lock, policy snapshot, and generated OpenAPI contract.
5. Run the `n8n import compatibility` workflow for node-version or export-shape changes.
6. Merge through a focused pull request so CI can compare policy versions with the target branch.
7. Update `package.json` and tag that exact semantic version as `vMAJOR.MINOR.PATCH`.
8. Let the tag workflow rerun validation, reproduce the archives, verify every embedded bundle manifest and outer checksum, clean-install and validate the packaged source archive, create GitHub build-provenance attestations, and publish the release.
9. Verify one downloaded archive with both `SHA256SUMS` and `gh attestation verify`.
10. Write release notes around the business outcome, not the node count.
11. Publish a short example or implementation note for discovery.

## Distribution contract

`npm run build:release` creates `dist/` from validated source without timestamps or host-specific ownership metadata. It produces:

- One complete archive with generated artifacts, source policy tooling, CI/release metadata, documentation, and tests.
- One self-contained archive per department with that department's workflows; filtered catalog, OpenAPI, policy lock, policy snapshot, and lifecycle contract; plus runtime compatibility metadata, JSON Schemas, and deployment guidance.
- A `BUNDLE.json` inside every archive that hashes every other bundled file.
- `release-manifest.json`, which records archive scope, workflow count, byte size, and SHA-256 identity.
- `SHA256SUMS`, which covers every archive and the release manifest.

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
