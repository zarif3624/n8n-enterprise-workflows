# Declarative field mapping

The field-mapping layer lets adopters test records in their source-system shape
without writing JavaScript or generating intermediate payload files. A mapping
is bound to one workflow and exact policy fingerprint, uses standard JSON
Pointers for extraction, and permits only a small set of explicit transforms.
Its portable structure is published as
[`field-mapping.schema.json`](../schemas/field-mapping.schema.json).

## Create a mapping

Generate an identity template from the current policy snapshot:

```bash
npm run --silent mapping -- init invoice-exception-triage > invoice-mapping.json
```

The template maps each target field from a same-named top-level source field.
Edit each `source` to point at the real sanitized source shape:

```json
{
  "mappingVersion": 1,
  "workflow": "invoice-exception-triage",
  "policyFingerprint": "sha256:<generated-policy-fingerprint>",
  "fields": {
    "invoiceId": { "source": "/invoice/id", "transform": "trim" },
    "vendorId": { "source": "/supplier/id", "transform": "trim" },
    "amount": { "source": "/invoice/amount", "transform": "finiteNumber" },
    "currency": { "source": "/invoice/currency", "transform": "uppercase" },
    "duplicateDetected": { "source": "/flags/duplicate", "transform": "strictBoolean" }
  }
}
```

JSON Pointer escapes `/` as `~1` and `~` as `~0` inside a property name. Array
indices are supported. Prototype-related path segments are rejected and every
lookup reads own properties only.

## Supported transforms

| Transform | Behavior |
| --- | --- |
| `identity` | Preserve the source JSON value unchanged. |
| `trim` | Require a string and remove surrounding whitespace. |
| `uppercase` | Require a string, trim it, and convert it to uppercase. |
| `lowercase` | Require a string, trim it, and convert it to lowercase. |
| `finiteNumber` | Accept a finite number or a non-empty numeric string. |
| `strictBoolean` | Accept a boolean or the case-insensitive strings `true` and `false`. |

There are intentionally no expressions, arbitrary code, implicit truthiness,
or literal defaults. Required contract fields and every field referenced by a
policy rule must be mapped; otherwise mapping validation fails before records
are processed. Optional fields not used by policy may be omitted. This prevents
an absent mapping from silently disabling a signal or permanently activating a
`missing`/`falsy` rule. The policy’s typed contract runs after mapping and
remains the authority on valid target values.

## Validate and test

Check structure, required targets, transforms, workflow identity, and policy
fingerprint before using a mapping:

```bash
npm run mapping -- check invoice-mapping.json
```

Then apply it in aggregate-only conformance testing:

```bash
npm run conformance -- invoice-exception-triage ./sanitized-source-records.jsonl \
  --mapping invoice-mapping.json \
  --min-records 100 \
  --max-invalid-rate 0.02 \
  --min-rule-coverage 0.8
```

The report records a canonical mapping fingerprint and counts mapping failures
by target field and safe error code. It never includes source paths, source
values, mapped values, or per-record results. A policy change invalidates the
mapping binding, forcing review before new behavior is tested or deployed.

Mappings are local adoption configuration, not secrets. Still, source paths can
reveal internal schemas; review them before sharing and never put credentials or
customer data in a mapping file.
