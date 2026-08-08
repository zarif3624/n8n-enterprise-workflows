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

1. Run `npm run check`.
2. Confirm every changed policy fingerprint has an intentional semantic-version bump.
3. Review the generated diff and scan for credentials or customer data; confirm `artifact-manifest.json` changed only where expected.
4. Confirm links, catalog metadata, the policy lock, policy snapshot, and generated OpenAPI contract.
5. Run the `n8n import compatibility` workflow for node-version or export-shape changes.
6. Merge through a focused pull request so CI can compare policy versions with the target branch.
7. Update `package.json` and tag that exact semantic version as `vMAJOR.MINOR.PATCH`.
8. Let the tag workflow rerun validation, reproduce the archives, verify their checksums, create GitHub build-provenance attestations, and publish the release.
9. Verify one downloaded archive with both `SHA256SUMS` and `gh attestation verify`.
10. Write release notes around the business outcome, not the node count.
11. Publish a short example or implementation note for discovery.

## Distribution contract

`npm run build:release` creates `dist/` from validated source without timestamps or host-specific ownership metadata. It produces:

- One complete archive with generated artifacts, source policy tooling, CI/release metadata, documentation, and tests.
- One self-contained archive per department with only that department's workflows and filtered catalog, OpenAPI, policy lock, and policy snapshot.
- A `BUNDLE.json` inside every archive that hashes every other bundled file.
- `release-manifest.json`, which records archive scope, workflow count, byte size, and SHA-256 identity.
- `SHA256SUMS`, which covers every archive and the release manifest.

The builder extracts every archive in memory and verifies its USTAR headers and internal file manifest before writing the release index. CI builds releases only from a pre-existing tag that exactly matches `package.json`; `gh release create --verify-tag` prevents the publication command from silently creating or moving a tag.

Consumers can verify the downloaded files from their containing directory:

```bash
sha256sum --check SHA256SUMS
gh attestation verify <archive.tar.gz> -R zarif3624/n8n-enterprise-workflows
```

Use `shasum -a 256 -c SHA256SUMS` instead of `sha256sum` on macOS.
