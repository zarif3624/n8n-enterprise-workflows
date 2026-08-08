# Machine-readable contracts

These JSON Schema Draft 2020-12 documents describe the stable JSON exchanged by
the local adoption tools:

- `catalog.schema.json` — workflow discovery, business metadata, typed inputs, paths, and fixtures;
- `artifact-manifest.schema.json` — integrity metadata, safe artifact paths, byte sizes, and SHA-256 digests;
- `field-mapping.schema.json` — declarative source-to-policy mapping files;
- `conformance-report.schema.json` — aggregate output from `npm run conformance -- --json`;
- `conformance-comparison.schema.json` — aggregate output from `npm run conformance:compare -- --json`;
- `contract-registry.schema.json` — discovery links from repository documents and CLI outputs to schemas;
- `policy-lifecycle.schema.json` — owner review, due-date, and deprecation metadata;
- `policy-lock.schema.json` — engine and per-policy versions and behavior fingerprints;
- `policy-snapshot.schema.json` — complete reviewable contracts, rules, thresholds, decisions, and actions;
- `runtime-compatibility.schema.json` — the pinned n8n/Node matrix and runtime probe scope.

The schemas validate portable structure. Runtime checks additionally bind a
mapping to a workflow's current policy fingerprint and require every workflow-
specific required target field.

The dependency-free supported-subset checker used by the test suite resolves
local references and enforces composition, types, bounds, formats, object
closure, and Draft 2020-12 `unevaluatedProperties` behavior used by these
contracts. It also checks actual policy results against `openapi.json`.

All ten schema files are covered by `artifact-manifest.json` and included in
the reproducible full-catalog release archive.
