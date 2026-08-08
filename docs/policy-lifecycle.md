# Policy lifecycle governance

Decision logic can become unsafe without a code change. Regulations, risk
appetite, operating procedures, and system behavior evolve, so every catalog
policy has an accountable owner and a bounded approval or review interval in
[`policy-lifecycle.json`](../policy-lifecycle.json).

## Review gate

Run the current-date gate with the rest of the repository checks:

```bash
npm run lifecycle -- validate
```

The command exits `0` when the contract is structurally valid and no review is
overdue, `2` when at least one review is overdue, and `1` for a malformed
lifecycle contract. For audit or planning, produce a Markdown or JSON report:

```bash
npm run lifecycle -- report
npm run lifecycle -- report --json
npm run lifecycle -- report --as-of 2027-01-20
```

`current` means more than 30 days remain, `due-soon` means 0–30 days remain,
and `overdue` means the next review date has passed. The report contains only
policy metadata; it never includes webhook inputs or conformance samples.

## Draft approval and recurring review

The catalog starts in `draft` status: these are reusable templates, not claims
that the named business teams have approved the policies for production. Drafts
record `introducedOn` and must receive owner review by `reviewDueOn` within
`defaultDraftApprovalDays`.

After a real owner review, change the status to `active`, remove `introducedOn`,
record `lastReviewedOn`, and set `reviewDueOn` no later than
`defaultReviewPeriodDays`. Never infer or backfill an approval date from a code
review, passing test, or repository release.

The named owner should review the typed input contract, every rule and hard
floor, thresholds, outcome names, recommended actions, human-approval gates,
and recent aggregate conformance evidence. Then run `npm run check` and commit the regenerated
artifact manifest.

A review date is evidence that the declared policy was considered, not proof
that the policy is legally or operationally appropriate. Teams remain
responsible for approvals in their own environment.

## Deprecation

Set `status` to `deprecated` before removing a public workflow. Add an
`announcedOn` date, a later `sunsetOn` date, and, when available, a different
catalog `replacementSlug`. Active policies cannot carry deprecation metadata,
and deprecated policies cannot omit the notice window. This complements the
policy-lock removal guard: consumers get an explicit migration period before a
workflow contract disappears.
