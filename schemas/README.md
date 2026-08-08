# Machine-readable contracts

These JSON Schema Draft 2020-12 documents describe the stable JSON exchanged by
the local adoption tools:

- `field-mapping.schema.json` — declarative source-to-policy mapping files;
- `conformance-report.schema.json` — aggregate output from `npm run conformance -- --json`;
- `conformance-comparison.schema.json` — aggregate output from `npm run conformance:compare -- --json`;
- `runtime-compatibility.schema.json` — the pinned n8n/Node matrix and runtime probe scope.

The schemas validate portable structure. Runtime checks additionally bind a
mapping to a workflow's current policy fingerprint and require every workflow-
specific required target field.

The dependency-free supported-subset checker used by the test suite resolves
local references and enforces composition, types, bounds, formats, object
closure, and Draft 2020-12 `unevaluatedProperties` behavior used by these
contracts. It also checks actual policy results against `openapi.json`.

All four schema files are covered by `artifact-manifest.json` and included in
the reproducible full-catalog release archive.
