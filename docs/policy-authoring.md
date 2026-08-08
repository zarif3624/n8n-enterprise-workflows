# Policy authoring guide

The catalog treats each workflow as a small, versioned decision service. The policy definition is the source; importable workflow JSON, examples, package documentation, and catalog metadata are projections of that source.

## Architecture

```text
scripts/workflow-definitions.mjs
        │
        ├── input contracts and policy rules
        ▼
scripts/policy-engine.mjs ──► deterministic validation and scoring
        │
        ▼
scripts/generate-workflows.mjs
        │
        ├── workflow.json
        ├── README.md
        ├── examples/*.json
        ├── catalog.json
        ├── openapi.json
        ├── policy-lock.json
        ├── policy-snapshot.json
        ├── artifact-manifest.json
        └── docs/catalog.md
        │
        ▼
scripts/validate-workflows.mjs + tests/policy-*.test.mjs
```

Only edit generated artifacts to diagnose generator output. Make lasting changes in the source definition or engine, regenerate, and review the complete diff.

## Input contracts

Every required and optional field resolves to a contract with one of four JSON types: `string`, `number`, `boolean`, or `array`. Contracts can also specify:

- `minLength` and `maxLength` for strings.
- `minimum` and `maximum` for numbers.
- `format: "email"` or `format: "date-time"`.
- `pattern` for a regular-expression constraint.
- `enum` for a closed list of supported strings.

The runtime rejects numeric strings such as `"42"` for number fields and string booleans such as `"true"` for boolean fields. Fail-closed typing prevents silent coercion from changing a decision.

Unknown fields are allowed so callers can carry integration context, but the policy response never echoes the request body. This limits accidental data disclosure and keeps the response contract stable.

## Rule semantics

Supported operators are deliberately small:

| Operator | Match behavior |
| --- | --- |
| `missing` | Field is absent, `null`, or an empty/whitespace-only string |
| `truthy` | Value is exactly boolean `true` |
| `falsy` | Value is anything other than boolean `true` |
| `equals` | Strict equality with the configured value |
| `includes` | Array contains the configured value |
| `gt` | Numeric value is greater than the configured value |
| `gte` | Numeric value is greater than or equal to the configured value |
| `lt` | Numeric value is less than the configured value |

Rules return their stable ID, field, points, reason, and optional minimum band. Reasons should explain the business fact, not restate the operator.

## Scores and hard risk floors

Normal rules add or subtract points. The raw total is clamped to 0–100, then mapped to the shared thresholds:

- `low`: 0–29
- `medium`: 30–69
- `high`: 70–100

Negative points are useful for mitigating signals, but they must never override a non-negotiable compliance or safety condition. Set `minimumBand: "high"` on rules such as a suppression-list match, restricted vendor, clicked phishing link, or possible regulatory notification. A matched hard gate raises the final score to at least the high threshold regardless of offsets.

Hard gates are consequential policy. Explain them in the pull request and have the named business owner review them before a template is used with production systems.

## Versioning

The response carries `policyVersion`; catalog entries carry both `policyVersion` and `schemaVersion`.

- Patch: wording, documentation, or test improvements that do not change decisions.
- Minor: backward-compatible optional fields or rules that can change scoring.
- Major: required-field, response-shape, operator-semantics, or decision-label changes.

When one policy's behavior changes, update that definition's policy version and include before/after fixture evidence. Policies are versioned independently; they began at `1.0.0` and are currently recorded in `policy-lock.json`, while the shared response schema is version `1.0`.

`policy-lock.json` stores a canonical SHA-256 fingerprint for every policy's executable behavior. Generation fails when a fingerprint changes without a newer `policyVersion`, and pull-request CI compares the committed lock with the target branch so manually replacing the lock cannot bypass the rule. Version regressions also fail.

`policy-snapshot.json` records that same executable behavior in a stable, human-reviewable form. Pull-request CI compares the snapshot with the target branch and writes a Markdown summary of added, removed, and changed contracts, rules, thresholds, decisions, actions, owners, versions, and fingerprints to the job summary. Review this report with the named policy owner; the lock proves that behavior changed, while the snapshot explains what changed.

CI also performs an executable behavior replay for every changed fingerprint. It builds a corpus from both branches' low-risk, high-risk, and invalid fixtures, adds one isolated witness for every old and new rule, removes duplicate payloads, and evaluates the corpus against both policy snapshots. The job summary lists observable changes in validation status, matched rules and reasons, score, priority band, decision, and recommended actions. A clean corpus is useful evidence, not proof of equivalence; combinations and organization-specific edge cases still require owner review.

`artifact-manifest.json` hashes all 83 public generated and machine-contract artifacts: the catalog, API and policy contracts, three adoption JSON Schemas, plus each workflow, companion README, and three fixtures. Validation recomputes every byte count and SHA-256 digest so generated files cannot drift independently of their recorded release identity.

The lock separately fingerprints `scripts/policy-engine.mjs`. Any engine source change requires increasing `policyEngineVersion`; because that shared version participates in every policy fingerprint, each affected policy must then receive an explicit version bump. This deliberately favors auditable change control over silent refactors in decision-critical code.

## Required tests

`npm run check` regenerates artifacts, validates every graph, package, and policy fingerprint, and runs the policy suite. The suite must prove:

- Low-risk, high-risk, and invalid fixtures behave as named.
- Every required field fails closed when absent.
- Every declared field rejects the wrong JSON type.
- Rule operator boundaries behave consistently.
- Hard gates cannot be canceled by negative scoring.
- Generated n8n expressions produce the same result as the source engine.
- Generated expressions contain no internal `}}` delimiter that n8n would interpret as an early expression terminator.
- Every declared policy rule independently matches, contributes its exact points and hard floor, and maps to the expected decision band.
- Every evaluator has both `onError: "continueErrorOutput"` and a wired error output terminating in a sanitized HTTP 500 responder.

The weekly compatibility workflow imports the complete catalog into isolated n8n versions, publishes one credential-free representative workflow, and sends low-risk, high-risk, and invalid requests through the real production webhook path. It then imports a test-only copy whose evaluator deliberately throws and proves the error output returns the sanitized 500 contract. This catches parser and runtime behavior that JSON import validation cannot.

After the check, inspect the generated diff. A green test cannot decide whether a policy is appropriate for a particular organization; it only proves the implementation matches the declared policy.

To preview the same policy summary shown in pull-request CI, compare the current branch with another Git ref:

```bash
npm run report:policy-changes -- origin/main
npm run report:policy-impact -- origin/main
```

When the shared engine changes, the replay report clearly limits its claim: both policy definitions are run through the current source evaluator. The scheduled live n8n compatibility matrix remains the required evidence for parser and runtime semantics.

For a quick local inspection without importing n8n:

```bash
npm run evaluate -- <workflow-slug> <payload.json>
```

Pass `-` as the payload path to read JSON from standard input. Contract violations print the full structured 400 body and exit with status 2, which makes the evaluator useful in CI and policy-review scripts.
