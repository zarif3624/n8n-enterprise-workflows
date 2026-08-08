# Privacy-safe conformance testing

Use the local conformance analyzer after field mapping and before connecting a
workflow to production systems. It evaluates a sanitized batch with the exact
versioned policy in `policy-snapshot.json` and reports only aggregate evidence.
JSON output conforms to
[`conformance-report.schema.json`](../schemas/conformance-report.schema.json).

## Prepare input

The input may be a JSON array, one JSON object, or newline-delimited JSON
(JSONL). Each record is treated as a webhook request body. Keep the dataset
outside source control, remove direct identifiers and unnecessary fields, and
use synthetic values where the policy only needs a type or category.

If records still use a source-system shape, create a fingerprint-bound
[declarative field mapping](field-mapping.md) and pass it with `--mapping`.

The command defaults to 10,000 records to prevent accidental unbounded local
processing. Override the cap deliberately with `--max-records`.

```bash
npm run conformance -- invoice-exception-triage ./sanitized-invoices.jsonl
```

Use `-` as the input path to read from standard input. Malformed-input and
file-read errors omit payload and file-system details.

## What the report measures

The Markdown report includes:

- valid and invalid record counts and the contract-invalid rate;
- low, medium, and high outcome distribution;
- min, average, p50, p95, and max scores for valid records;
- match counts and coverage for every stable rule ID;
- contract-violation counts grouped by field and code;
- the policy version and SHA-256 fingerprint evaluated.

Raw payloads, field values, request IDs, and per-record outcomes are never
included. Field names, rule IDs, decisions, and aggregate counts are policy
metadata and may still be sensitive in a very small cohort. Run the analyzer
locally and do not publish small-sample reports without a privacy review.
When a mapping is used, the report adds only its fingerprint, mapped-target
count, and target-field/error aggregates; source paths remain private.

## Add rollout gates

Optional gates make the command useful in UAT and CI:

```bash
npm run conformance -- invoice-exception-triage ./sanitized-invoices.jsonl \
  --min-records 100 \
  --max-invalid-rate 0.02 \
  --min-rule-coverage 0.8 \
  --require-bands low,medium,high
```

- `--min-records` requires a meaningful sample size.
- `--max-invalid-rate` accepts a fraction from 0 to 1.
- `--min-rule-coverage` requires that the sample exercise a fraction of policy rules.
- `--require-bands` requires named outcome bands to appear among valid records.

Choose thresholds with the policy owner. A rule that does not appear in
historical data still needs a synthetic boundary test; a passing aggregate
report does not prove the mapping, downstream side effects, or approval path is
safe.

Use `--json` for a machine-readable report:

```bash
npm run --silent conformance -- invoice-exception-triage ./sanitized-invoices.jsonl \
  --max-invalid-rate 0.02 --json > conformance-report.json
```

The command exits `0` when analysis succeeds and every configured gate passes,
`2` when analysis succeeds but a gate fails, and `1` for usage, input, or
configuration errors.

## Respond to findings

- Contract violations: correct mappings or upstream normalization; do not make required fields optional merely to improve the rate.
- Unobserved rules: add sanitized or synthetic boundary records and have the owner confirm the expected decision.
- Unexpected band mix: investigate mappings and policy assumptions before connecting actions.
- Gate failure: retain the aggregate report as UAT evidence, remediate, and rerun against the same policy fingerprint.

Complete the [enterprise readiness checklist](enterprise-readiness.md) after
conformance testing. The analyzer evaluates decision behavior, not n8n
credentials, external nodes, retries, approvals, or production access controls.
After approval, use the aggregate JSON as an operational
[drift-monitoring baseline](drift-monitoring.md).
