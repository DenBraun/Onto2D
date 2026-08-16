# Project Structure

## Dependency direction

```text
applications and cases
        |
        v
 view + engine + model-pack + adapters + solvers + run-store
                  |
                  v
           kernel + schemas
```

Dependencies point inward. `@onto2d/kernel` has no package dependencies and
must not import adapters, filesystem code, UI code, catalogue formats, or
scientific implementations. Schemas describe transport shapes; runtime code
still verifies cross-record and semantic invariants.

`@onto2d/engine` is catalogue-independent. A facade or application supplies
verified Model Packs; the private root facade supplies the bundled Causal
Emergence snapshot.

## Ownership

| Location | Owns |
|---|---|
| `packages/kernel` | Deterministic semantic execution and verification |
| `packages/schemas` | Versioned external data shapes |
| `packages/model-pack` | Canonical model release assembly and verification |
| `packages/engine` | Headless model access, traversal, workspaces, analyses, and diff |
| `packages/canonical-identity-analysis` | Replayable kernel-backed identity analysis |
| `packages/view` | Deterministic presentation projections and graph layout |
| `packages/catalog-adapter` | Catalogue loading, audit, and reviewed migration replay |
| `packages/scientific-adapter` | Interface for external numerical implementations |
| `packages/level-zero-solver` | Bounded Phase-B numerical implementation outside the kernel |
| `packages/run-store` | Filesystem persistence of verified run bundles and execution records |
| `cases` | Source locks, case rules, reproducible scripts, and frozen results |
| `apps` | Explanatory studies and model readers over disclosed or versioned inputs |
| `models` | Reproducible, reviewed Model Pack releases and their compilers |
| `src` | Private root facade that composes the engine with bundled releases |
| `scr` | Preserved source catalogue and reference material |
| `scripts` | Repository checks and independent conformance tooling |
| `test` | Behavioral, schema, integration, case, and golden evidence |
| `docs/adr` | Accepted architectural decisions |

## Boundary rules

- Source data in `scr/` is not edited to satisfy an audit.
- Cases may call the kernel but must not add case-specific branches to it.
- Scientific solvers may implement adapter contracts but must not import the kernel.
- Applications do not become authorities for scientific values or canonical
  identity; they project disclosed models or tested artifacts.
- View layouts are derived presentation output and never enter model identity.
- Model Pack indexes are derived accelerators and never authority over the
  canonical model files.
- Operational metadata such as timestamps and resource use does not enter
  semantic hashes.
- Generated run output belongs in ignored `runs/`; only reviewed fixtures are
  committed.

Use an ADR when a change affects canonical identity, evidence semantics,
scientific trust boundaries, or dependency direction.
