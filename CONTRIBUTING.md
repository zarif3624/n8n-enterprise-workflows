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

## Pull requests

Keep each pull request focused. Explain the business outcome, test evidence,
and any production assumptions. Add or update catalog metadata when workflows
change.
