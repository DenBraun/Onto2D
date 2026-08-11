# Onto2D

Onto2D is an ontology-backed JavaScript toolkit with a deterministic
admissibility-closure kernel for complex-system modelling.

## Current status

The runtime packages form a dependency-free Node.js workspace; repository
schema checks use a lockfile-pinned Ajv development dependency. The
`@onto2d/kernel` package implements the deterministic package and graph-identity foundation,
including normalized package/run binding and finite decorated-candidate
enumeration, verified primitive depth-population materialization, and
graph-only predicate evaluation with conservative partial-failure diagnostics
plus package-bound local candidate filtering with exact constant/count
comparisons, but not derived-element materialization, pruning authorization,
profile-domain/scalar invariant resolution, functional/coefficient execution,
substructure predicates,
selector admission, or closure.

Available foundations include:

- four packages with explicit dependency boundaries;
- guarded canonical JSON and domain-separated SHA-256 identities;
- deterministic `RulePackage` normalization, structural validation, and
  `createKernel().loadPackage()`;
- versioned multiplicative SI units, canonical quantity conversion, and
  tolerance-aware comparison;
- exact decimal arithmetic with declared rounding plus explicit rounded or
  unrounded accumulation artifacts;
- typed value-expression normalization, dimensional inference, dependency
  extraction, and domain-separated expression/analysis hashes;
- typed Boolean predicate analysis, conservative monotonicity/partial-data
  inference, and content-addressed predicate plans;
- verified complete evaluation of logical and graph-structural predicate plans
  with canonical witnesses, plus hashed partial persistent-failure diagnostics
  that explicitly cannot authorize pruning;
- package-bound local filtering that reproduces the run binding, proves a
  candidate belongs to its finite universe, resolves exact/profile
  constituents, and evaluates every graph or supported local-numeric top-level
  predicate without claiming selector admission;
- content-addressed local predicate evaluation for scalar constants, direct
  constant quantities, canonical node/edge counts, exact or compensated scalar
  and Quantity-valued structural-attribute sums with disclosed approximation
  state and conservative quantity-tolerance aggregation, compatible derived
  Quantity addition and scalar scaling, element-exact Quantity invariant
  resolution from the reproduced source population, scalar and Quantity
  balance over node/edge attributes, and dimensionless addition/multiplication
  under the reproduced run numeric policy;
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
- finite deterministic decoration with node references, directions, roles,
  structural attributes, enabled parallel edges/self-loops, reconciled counts,
  and explicit generation budgets;
- closed RunConfig normalization plus content-addressed package/run binding of
  a verified materialized depth-0 `Element` population, element/profile node
  alphabets, roles, connected skeletons, and execution limits, with unsupported
  generation semantics rejected explicitly;
- JSON Schema Draft 2020-12 contracts for the first kernel artifacts;
- a non-mutating loader and reproducible audit for all 249 catalogue cards;
- locked identities for the supplied theory sources;
- repository, documentation, schema, source, and catalogue checks.

No current command changes `scr/` catalogue records or claims that raw
`ParentCode` relations are generative. Authorship of actual policy content,
collection of actual annotations, access-controlled annotation-view delivery,
application to the current catalogue, node dispositions, SCC condensation,
derived-depth population binding, structural-attribute/profile-guard
derivation, profile/scalar-invariant, coefficient, general-Quantity-product,
cycle-set/substructure filtering,
selector admission, derived profile
extraction/materialization, partial pruning, closure, and sensitivity execution
remain scheduled implementation work. The existing partial graph diagnostic is
not connected to candidate enumeration.

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
