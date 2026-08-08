# Aggregate conformance drift monitoring

Compare two privacy-safe conformance reports to detect operational movement
after a mapping, workflow, or upstream population is put into use. The comparer
never needs source records; it consumes only the aggregate JSON emitted by
`npm run conformance -- --json`.

## Capture an approved baseline

Use a representative, sanitized UAT sample and the approved mapping:

```bash
npm run conformance -- invoice-exception-triage ./sanitized-uat.jsonl \
  --mapping invoice-mapping.json --json > baseline-conformance.json
```

Retain the report with the deployment evidence. It contains policy and mapping
fingerprints, aggregate rates, and no raw or per-record results.

## Capture and compare a current sample

Run the same policy and mapping against a comparable current sample, then
compare the reports:

```bash
npm run conformance -- invoice-exception-triage ./sanitized-current.jsonl \
  --mapping invoice-mapping.json --json > current-conformance.json

npm run conformance:compare -- baseline-conformance.json current-conformance.json
```

The command refuses to compare different workflows, policy versions,
policy fingerprints, mapping modes, or mapping fingerprints. Use the pull
request policy-impact report to assess policy changes; establish a new approved
operational baseline after promotion.

## Configure monitoring gates

All rate thresholds are fractions from 0 to 1 and represent absolute
percentage-point movement:

```bash
npm run conformance:compare -- baseline-conformance.json current-conformance.json \
  --min-current-records 100 \
  --max-invalid-rate-increase 0.02 \
  --max-band-rate-delta 0.10 \
  --max-rule-rate-delta 0.15 \
  --max-average-score-delta 10
```

- `--max-invalid-rate-increase` catches worsening mapping or contract quality.
- `--max-band-rate-delta` limits the largest absolute low/medium/high shift.
- `--max-rule-rate-delta` limits the largest policy-signal frequency shift.
- `--max-average-score-delta` limits movement on the 0–100 score scale.
- `--min-current-records` prevents a tiny current sample from passing silently.

Use `--json` for machine-readable output. Exit code `0` means the comparison
completed and all configured gates passed, `2` means one or more gates failed,
and `1` means the report or command was invalid.

## Interpret responsibly

The report includes sample-size and invalid-rate changes, score movement,
priority-band and decision movement, rule-frequency changes, and contract or
mapping error shifts. These are operational monitoring signals—not proof of
statistical significance, causality, model quality, or business impact.

Compare equivalent time windows and populations, set thresholds with the
policy owner, and investigate upstream process changes before modifying policy.
Aggregate reports can still reveal information about very small cohorts; apply
the same privacy review and access controls used for the original conformance
evidence.
