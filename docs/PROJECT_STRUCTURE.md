# Project Structure

## Dependency direction

```text
applications and cases
        |
        v
catalog-adapter   scientific-adapter   run-store
        \              |              /
         +-------------+-------------+
                       |
                       v
                kernel + schemas
```

Dependencies point inward. `@onto2d/kernel` has no package dependencies and
must not import adapters, filesystem code, UI code, catalogue formats, or
scientific implementations. Schemas describe transport shapes; runtime code
still verifies cross-record and semantic invariants.

## Ownership

| Location | Owns |
|---|---|
| `packages/kernel` | Deterministic semantic execution and verification |
| `packages/schemas` | Versioned external data shapes |
| `packages/catalog-adapter` | Catalogue loading, audit, and reviewed migration replay |
| `packages/scientific-adapter` | Interface for external numerical implementations |
| `packages/run-store` | Filesystem persistence of verified run bundles and execution records |
| `cases` | Source locks, case rules, reproducible scripts, and frozen results |
| `apps` | Explanatory interfaces over disclosed toy data or verified fixtures |
| `scr` | Preserved source catalogue and reference material |
| `scripts` | Repository checks and independent conformance tooling |
| `test` | Behavioral, schema, integration, case, and golden evidence |
| `docs/adr` | Accepted architectural decisions |

## Boundary rules

- Source data in `scr/` is not edited to satisfy an audit.
- Cases may call the kernel but must not add case-specific branches to it.
- Applications do not become authorities for scientific values or canonical
  identity; they project disclosed models or tested artifacts.
- Operational metadata such as timestamps and resource use does not enter
  semantic hashes.
- Generated run output belongs in ignored `runs/`; only reviewed fixtures are
  committed.

Use an ADR when a change affects canonical identity, evidence semantics,
scientific trust boundaries, or dependency direction.
