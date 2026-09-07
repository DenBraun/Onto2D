# Contributing to Onto2D

Read [Development Guide](docs/DEVELOPMENT.md) and
[Project Structure](docs/PROJECT_STRUCTURE.md) before changing package
boundaries or catalogue semantics.

## Required local checks

```sh
npm ci
npm test
npm run check
```

Use Node.js 22 or newer. Runtime packages intentionally have no third-party
runtime dependencies; repository schema checks use the pinned `ajv`
development dependency.

## Change rules

- Do not rewrite `references/` data to make an audit pass. Update a reviewed golden
  only when the source change and its scientific rationale are intentional.
- Do not classify every `ParentCode` as generative. Source relation policy and
  node-resolution criteria must be frozen before topology-aware migration.
- Keep `@onto2d/kernel` dependency-free. Adapters may depend inward on kernel
  contracts; the kernel must never import an adapter.
- Add or update tests for behavior changes and update documentation in the same
  change.
- Never present a placeholder scientific adapter or a schema-valid artifact as
  scientific validation.

Contract changes to identity, quantities, source classification, evidence or
package boundaries must update the relevant [architecture guide](docs/README.md)
and its verification. Keep current requirements in that guide; use Git for
change history. Python 3.9+ is required for the normal test/reference suite.
