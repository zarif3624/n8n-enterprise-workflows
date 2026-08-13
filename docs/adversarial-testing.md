# Deterministic adversarial testing

The repository runs a fixed-seed adversarial corpus across every policy and
field-mapping boundary as part of `npm test`. The corpus is reproducible: a
failure can be rerun locally without preserving caller data or relying on a
random service.

```bash
npm run test:adversarial
```

## Covered input classes

- missing, null, empty, whitespace-only, oversized, Unicode, and CRLF strings;
- negative, fractional, non-finite, boolean, array, and nested-object values;
- null-prototype and JSON `__proto__`-shaped objects;
- non-JSON direct-library roots such as symbols, bigints, functions, and dates;
- source records with missing mappings, wrong mapped types, and private marker fields.

Across all sixteen public policies, the suite asserts that evaluation:

- never crashes for an input in the corpus;
- returns identical output for identical policy, input, time, and execution identity;
- emits only HTTP 200 decisions or structured HTTP 400 contract failures;
- keeps scores within 0–100 and matched rule IDs within the declared policy;
- returns only documented field-level violation codes;
- remains JSON-serializable and never echoes injected private markers.

The mapping/conformance portion additionally proves mapping failures use safe
target-field codes, aggregate reports are deterministic, and source values do
not cross the reporting boundary.

This is robustness evidence, not a substitute for source-specific UAT,
security review, runtime compatibility tests, or fuzzing the external systems
an adopter later connects.
