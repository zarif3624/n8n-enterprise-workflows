# Contributing

Contributions should make a workflow safer, easier to adopt, or more valuable
to an enterprise team.

## Propose a workflow

Open a workflow request before implementing a large addition. Describe the
department, business problem, trigger, expected outcome, systems involved,
human approval points, risk level, and measurable value.

Search the existing catalog first with `npm run catalog -- search <terms>` so proposals extend rather than duplicate an existing policy service.

## Quality bar

Every workflow must:

1. Ship inactive and contain no secrets or credential identifiers.
2. Include input validation and a structured response or observable outcome.
3. Include a companion README with setup, sample input, risks, ROI model, and
   extension points.
4. Use descriptive workflow and node names.
5. Explain where a human must approve consequential actions.
6. Pass `npm run check`.

## Source of truth

Do not hand-edit generated `workflow.json`, package README, example fixture,
`catalog.json`, `openapi.json`, `policy-lock.json`, `policy-snapshot.json`, `artifact-manifest.json`, or `docs/catalog.md` files. Define workflow behavior in
`scripts/workflow-definitions.mjs`; the generator produces the importable and
human-readable artifacts together.

For a policy change:

1. Define required and optional fields. Every field must resolve to a typed contract.
2. Add explainable rules with stable field/operator semantics.
3. Use `minimumBand: "high"` when a safety or compliance signal must not be canceled by negative points.
4. Increase the definition's `policyVersion` using the compatibility rules in the authoring guide.
5. Run `npm run check`; generation rejects behavior changes that keep the old version.
6. Review every generated diff, especially the policy fingerprint and low-risk, high-risk, and invalid fixtures.
7. Run `npm run report:policy-changes -- origin/main` and review the human-readable definition summary with the named policy owner.
8. Run `npm run report:policy-impact -- origin/main` and review every changed fixture/rule-witness outcome.
9. Confirm `git diff --exit-code` is clean after committing generated artifacts.

See [policy authoring](docs/policy-authoring.md) for the scoring and compatibility contract.

For adopter or deployment evidence, run the workflow against a sanitized JSON
array or JSONL sample with `npm run conformance -- <workflow-slug> <input>`.
Never commit source payloads; share only an aggregate report after checking
small-cohort privacy risk. See [conformance testing](docs/conformance-testing.md).

## Pull requests

Keep each pull request focused. Explain the business outcome, test evidence,
and any production assumptions. Add or update catalog metadata when workflows
change.
