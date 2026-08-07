# Onto2D

Onto2D is an ontology-backed JavaScript toolkit with a deterministic
admissibility-closure kernel for complex-system modelling.

## Current status

The repository has a dependency-free Node.js workspace. The `@onto2d/kernel`
package implements the deterministic package and graph-identity foundation,
but not candidate decoration, predicate evaluation, or closure.

Available foundations include:

- four packages with explicit dependency boundaries;
- guarded canonical JSON and domain-separated SHA-256 identities;
- deterministic `RulePackage` normalization, structural validation, and
  `createKernel().loadPackage()`;
- versioned multiplicative SI units, canonical quantity conversion, and
  tolerance-aware comparison;
- exact decimal arithmetic with declared rounding and accumulation policies;
- typed value-expression normalization, dimensional inference, dependency
  extraction, and domain-separated expression/analysis hashes;
- typed Boolean predicate analysis, conservative monotonicity/partial-data
  inference, and content-addressed predicate plans;
- run-specific, content-addressed precision/tolerance bindings for compiled
  predicate numeric operations;
- content-addressed scientific-Oracle request/response validation without
  solver execution;
- content-addressed source-classification policy, independent-annotation,
  blind-adjudication, and node-resolution policy freezing, including exposure,
  forbidden-input, disagreement-risk, and reconciliation invariants, without
  assigning catalogue categories;
- policy-limited classification-view construction plus verified, lossless
  classified-relation and generative/formation-support SCC projections for
  caller-supplied data;
- exact refinement/individualization canonicalization for supplied candidate
  graphs and exhaustive permutation-minimum skeleton identities;
- bounded connected-unlabeled skeleton enumeration through six nodes and a
  deterministic candidate deduplication store;
- JSON Schema Draft 2020-12 contracts for the first kernel artifacts;
- a non-mutating loader and reproducible audit for all 249 catalogue cards;
- locked identities for the supplied theory sources;
- repository, documentation, schema, source, and catalogue checks.

No current command changes `scr/` catalogue records or claims that raw
`ParentCode` relations are generative. Authorship of actual policy content,
collection of actual annotations, access-controlled annotation-view delivery,
application to the current catalogue, node dispositions, SCC condensation,
decorated-candidate enumeration, closure, scientific predicates, and
sensitivity execution remain scheduled implementation work.

## Start developing

Prerequisite: Node.js 20 or newer with npm.

```sh
npm ci
npm test
npm run check
npm run build
```

There are no third-party runtime or development dependencies. `npm run build`
performs repository validation; packages are served directly from checked
source, so it does not create a transpiled `dist/` tree.

Additional commands:

```sh
npm run audit:catalogue
npm run check:docs
npm run check:schemas
npm run test:kernel
```

See [Development Guide](docs/DEVELOPMENT.md) and
[Contributing](CONTRIBUTING.md) for the workflow.

## Repository map

- `scr/` — source catalogue, source schema, and preserved theory PDFs.
- `packages/kernel/` — dependency-free model, canonical graph/hash, and package-loader foundation.
- `packages/schemas/` — versioned machine-readable contracts.
- `packages/catalog-adapter/` — source catalogue loading and read-only audit.
- `packages/scientific-adapter/` — validated boundary for external scientific tools.
- `cases/` — research-case source locks and, later, executable fixtures.
- `scripts/` — zero-dependency repository checks and test orchestration.
- `test/` — cross-package, source-lock, and golden fixtures.
- `docs/` — normative architecture, development plan, and design decisions.

The exact current layout and intended growth path are documented in
[Project Structure](docs/PROJECT_STRUCTURE.md).

## Architecture documentation

- [Kernel Architecture](docs/KERNEL_ARCHITECTURE.md) — detailed normative
  target architecture in English.
- [Foundational Paper Analysis](docs/FOUNDATIONAL_PAPER_ANALYSIS.md) —
  page/equation-level analysis of `scr/topology-of-arising.pdf` and
  computational traceability.
- [Kernel Development Plan](docs/KERNEL_DEVELOPMENT_PLAN.md) — implementation
  stages, work packages, tests, and delivery gates.
- [Kernel Implementation Status](docs/KERNEL_IMPLEMENTATION_STATUS.md) — exact
  implemented and pending runtime boundaries.
- [Review Guide](docs/REVIEW_GUIDE.md) — review order, decision points, static
  verification record, and deferred execution gates.
- [Kernel Design Decisions](docs/KERNEL_DESIGN_DECISIONS.md) — decisions,
  exclusions, and open scientific inputs behind the architecture.

## Requirements

The development workspace and published packages require Node.js 20 or newer.

## License

Onto2D is developed by Denis Britov as part of the Causal Emergence Catalogue
project and is distributed under the [MIT License](LICENSE).
