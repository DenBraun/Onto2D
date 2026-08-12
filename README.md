# Onto2D

Onto2D is an ontology-backed JavaScript toolkit with a deterministic
admissibility-closure kernel for finite complex-system models.

## Current status

The schema-v1 kernel implementation is locally closed: the public registry
contains 195 implemented capabilities and no pending kernel operations. The
current 410-test suite, repository checks, and validation build pass locally on
macOS arm64 with Node.js 20 and 22.

Release acceptance still requires the configured
Ubuntu/macOS/Windows × Node.js 20/22 CI matrix and independent review of the
canonical identity fixtures. After that gate, `POST-CLOSURE-VIS-01` requires a
complete reproducible case and a generated visual presentation, preferably on
GitHub Pages.

The existing `cases/level-0-oscillator/` directory currently freezes theory
source identities only. It does not claim that the paper's resonant triad has
been numerically implemented, empirically validated, or published as a demo.

## What is implemented

- deterministic canonical JSON and domain-separated SHA-256 identities;
- exact candidate-graph and simple-skeleton canonicalization;
- bounded skeleton and decorated-candidate enumeration with explicit budgets;
- normalized schema-v1 rule packages and run configurations;
- typed quantities, decimal arithmetic, expressions, predicates, and
  functionals;
- candidate filtering, complete censuses, cohorts, ranking, sensitivity, and
  selector admission;
- residual profiles, derived elements, generalized depth closure, ladders,
  bounded current-level fixpoints, and carrier promotion;
- audited pruning with differential conformance against exhaustive execution;
- deterministic null-model planning, proposals, trial evaluation, and
  baselines;
- verified level explanations, result censuses, semantic run bundles, and
  local atomic run persistence;
- source-policy artifact freezing and a loss-preserving catalogue migration
  pipeline for caller-supplied reviewed inputs;
- 130 JSON Schema Draft 2020-12 contracts and public TypeScript declarations.

The detailed capability boundary and its evidence are maintained in
[Kernel Implementation Status](docs/KERNEL_IMPLEMENTATION_STATUS.md) and
[Review Guide](docs/REVIEW_GUIDE.md).

## What is not included yet

This repository does not currently publish:

- a visual examples gallery or GitHub Pages application;
- healthcare, biological, cognitive, or organizational demo applications;
- a browser development server or an `npm run dev` command;
- a plugin marketplace, diagnostic UI, or named AI-assistant integration;
- a scientific solver or a claim of empirical validation;
- reviewed policy, annotation, and disposition data for migration of the
  current catalogue.

Those items must not be inferred from the implemented kernel APIs. The first
visual result will be generated from verified run artifacts only after the
release-acceptance gate.

## Development and verification

Prerequisite: Node.js 20 or newer with npm.

```sh
npm ci
npm test
npm run check
npm run build
```

These commands are defined by the root `package.json`. `npm run build` is a
validation build: packages are used directly from checked source and no
transpiled `dist/` directory is produced.

Focused checks:

```sh
npm run test:kernel
npm run check:closure
npm run check:goldens
npm run check:schemas
npm run check:docs
npm run audit:catalogue
```

`check:closure` verifies the closed capability registry, complete
capability-to-test evidence, independent fixture hashes, required CI matrix,
and mandatory visualization gate. `check:goldens` independently reconstructs
the canonical and skeleton fixtures in memory and compares them byte-for-byte
without modifying the repository.

See the [Development Guide](docs/DEVELOPMENT.md) and
[Contributing Guide](CONTRIBUTING.md) for the full workflow.

## Repository map

- `packages/kernel/` — dependency-free closure-kernel runtime;
- `packages/schemas/` — versioned JSON Schema contracts;
- `packages/catalog-adapter/` — non-mutating catalogue audit and reviewed
  migration transformations;
- `packages/scientific-adapter/` — validated boundary for external scientific
  implementations;
- `packages/run-store/` — verified local run persistence and operational
  records;
- `cases/` — research-case source locks and future executable case artifacts;
- `scr/` — preserved source catalogue and theory documents;
- `scripts/` — repository checks and independent conformance tooling;
- `test/` — cross-package, source-lock, schema, and golden fixtures;
- `docs/` — normative architecture, plans, decisions, and review material.

The exact dependency direction and ownership rules are documented in
[Project Structure](docs/PROJECT_STRUCTURE.md).

## Documentation

- [Kernel Architecture](docs/KERNEL_ARCHITECTURE.md) — normative model and
  execution contracts;
- [Kernel Development Plan](docs/KERNEL_DEVELOPMENT_PLAN.md) — stages and
  acceptance gates;
- [Kernel Implementation Status](docs/KERNEL_IMPLEMENTATION_STATUS.md) —
  implemented boundary and external inputs;
- [Kernel Design Decisions](docs/KERNEL_DESIGN_DECISIONS.md) and
  [ADRs](docs/adr/) — decisions and versioned invariants;
- [Foundational Paper Analysis](docs/FOUNDATIONAL_PAPER_ANALYSIS.md) — theory
  traceability and scientific limitations;
- [Review Guide](docs/REVIEW_GUIDE.md) — verification order and remaining
  release evidence.

## License

Onto2D is developed by Denis Britov as part of the Causal Emergence Catalogue
project and is distributed under the [MIT License](LICENSE).
