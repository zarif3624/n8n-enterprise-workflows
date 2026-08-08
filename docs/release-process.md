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
3. Review the generated diff and scan for credentials or customer data.
4. Confirm links, catalog metadata, the policy lock, and the generated OpenAPI contract.
5. Run the `n8n import compatibility` workflow for node-version or export-shape changes.
6. Merge through a focused pull request so CI can compare policy versions with the target branch.
7. Tag a semantic version.
8. Write release notes around the business outcome, not the node count.
9. Publish a short example or implementation note for discovery.
