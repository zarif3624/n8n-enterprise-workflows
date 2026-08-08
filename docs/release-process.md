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
2. Review the generated diff and scan for credentials or customer data.
3. Confirm links, catalog metadata, and the generated OpenAPI contract.
4. Run the `n8n import compatibility` workflow for node-version or export-shape changes.
5. Merge through a focused pull request.
6. Tag a semantic version.
7. Write release notes around the business outcome, not the node count.
8. Publish a short example or implementation note for discovery.
