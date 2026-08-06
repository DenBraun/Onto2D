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

Use Node.js 20 or newer. The repository intentionally has no third-party
dependencies in the bootstrap slice.

## Change rules

- Preserve the public behavior of `onto2d.js` unless a breaking change is
  explicitly reviewed and documented.
- Do not rewrite `scr/` data to make an audit pass. Update a reviewed golden
  only when the source change and its scientific rationale are intentional.
- Do not classify every `ParentCode` as generative. Source relation policy and
  node-resolution criteria must be frozen before topology-aware migration.
- Keep `@onto2d/kernel` dependency-free. Adapters may depend inward on kernel
  contracts; the kernel must never import an adapter.
- Add or update tests for behavior changes and update documentation in the same
  change.
- Never present a placeholder scientific adapter or a schema-valid artifact as
  scientific validation.

Architecture decisions that alter canonical identity, quantities, relation
classification, cluster resolution, evidence semantics, or package boundaries
need an ADR based on [the ADR template](docs/adr/0000-template.md).
