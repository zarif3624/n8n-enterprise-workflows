# Contributing

Contributions should make a workflow safer, easier to adopt, or more valuable
to an enterprise team.

## Propose a workflow

Open a workflow request before implementing a large addition. Describe the
department, business problem, trigger, expected outcome, systems involved,
human approval points, risk level, and measurable value.

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
`catalog.json`, or `docs/catalog.md` files. Define workflow behavior in
`scripts/workflow-definitions.mjs`; the generator produces the importable and
human-readable artifacts together.

For a policy change:

1. Define required and optional fields. Every field must resolve to a typed contract.
2. Add explainable rules with stable field/operator semantics.
3. Use `minimumBand: "high"` when a safety or compliance signal must not be canceled by negative points.
4. Run `npm run check`.
5. Review every generated diff, especially the low-risk, high-risk, and invalid fixtures.
6. Confirm `git diff --exit-code` is clean after committing generated artifacts.

See [policy authoring](docs/policy-authoring.md) for the scoring and compatibility contract.

## Pull requests

Keep each pull request focused. Explain the business outcome, test evidence,
and any production assumptions. Add or update catalog metadata when workflows
change.
