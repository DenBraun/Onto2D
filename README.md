# Onto2D

Onto2D is an ontology-backed JavaScript toolkit being refactored into a
deterministic admissibility-closure kernel for complex-system modelling.

## Current status

The repository now has a dependency-free Node.js workspace prepared for
development. Shipped application behavior remains the catalogue-backed legacy
runtime in `onto2d.js`. The new `@onto2d/kernel` package now implements its
deterministic package and graph-identity foundation, but not candidate
decoration, predicate evaluation, or closure.

Available foundations include:

- five packages with explicit dependency boundaries;
- guarded canonical JSON and domain-separated SHA-256 identities;
- deterministic `RulePackage` normalization, structural validation, and
  `createKernel().loadPackage()`;
- exact refinement/individualization canonicalization for supplied candidate
  graphs, with separate candidate and skeleton identities;
- bounded connected-unlabeled skeleton enumeration through six nodes and a
  deterministic candidate deduplication store;
- JSON Schema Draft 2020-12 contracts for the first kernel artifacts;
- a non-mutating loader and reproducible audit for all 249 catalogue cards;
- characterization tests for the legacy ontology/world API;
- locked identities for the supplied theory sources;
- repository, documentation, schema, source, and catalogue checks.

No current command changes `scr/` catalogue records or claims that raw
`ParentCode` relations are generative. Relation classification, SCC
condensation, decorated-candidate enumeration, closure, scientific predicates,
and sensitivity execution remain scheduled implementation work.

## Start developing

Prerequisite: Node.js 20 or newer with npm.

```sh
npm ci
npm test
npm run check
npm run build
```

There are no third-party runtime or development dependencies in this bootstrap
slice. `npm run build` performs the complete readiness validation; packages are
served directly from checked source, so it does not create a transpiled `dist/`
tree.

Additional commands:

```sh
npm run audit:catalogue
npm run check:docs
npm run check:schemas
npm run test:legacy
npm run test:kernel
```

See [Development Guide](docs/DEVELOPMENT.md) and
[Contributing](CONTRIBUTING.md) for the workflow.

## Repository map

- `onto2d.js` — stable UMD/CommonJS legacy ontology and world validator.
- `scr/` — source catalogue, legacy schema, and preserved theory PDFs.
- `packages/kernel/` — dependency-free model, canonical graph/hash, and package-loader foundation.
- `packages/schemas/` — versioned machine-readable contracts.
- `packages/catalog-adapter/` — legacy catalogue loading and read-only audit.
- `packages/scientific-adapter/` — validated port for future scientific tools.
- `packages/legacy-runtime/` — compatibility package for `onto2d.js`.
- `cases/` — research-case source locks and, later, executable fixtures.
- `scripts/` — zero-dependency repository checks and test orchestration.
- `test/` — cross-package, legacy, source-lock, and golden fixtures.
- `docs/` — normative architecture, migration plan, and source accounting.

The exact current layout and intended growth path are documented in
[Project Structure](docs/PROJECT_STRUCTURE.md).

## Legacy runtime example

```js
const fs = require("node:fs");
const Onto2D = require("./onto2d.js");

const levels = Array.from({ length: 8 }, (_, index) => {
  return JSON.parse(fs.readFileSync(`scr/level-${index}.json`, "utf8"));
});
const descriptions = JSON.parse(fs.readFileSync("scr/descriptions.json", "utf8"));

const engine = new Onto2D.Onto2DEngine();
engine.loadOntology({ levels, descriptions });

const world = engine.createWorld();
world.createBody({
  id: "protein_1",
  name: "Example protein",
  category: "3.0"
});

const capabilities = world.getCapabilities("protein_1");
const contacts = world.step().contacts;
```

The same API is available through `@onto2d/legacy-runtime` after `npm ci`.

## Architecture documentation

- [Kernel Architecture](docs/KERNEL_ARCHITECTURE.md) — detailed normative
  target architecture in English.
- [Foundational Paper Analysis](docs/FOUNDATIONAL_PAPER_ANALYSIS.md) —
  page/equation-level analysis of `scr/topology-of-arising.pdf` and
  computational traceability.
- [Kernel Refactor Plan](docs/KERNEL_REFACTOR_PLAN.md) — staged repository
  migration, work packages, tests, and delivery gates.
- [Kernel Implementation Status](docs/KERNEL_IMPLEMENTATION_STATUS.md) — exact
  implemented and pending runtime boundaries.
- [Review Guide](docs/REVIEW_GUIDE.md) — review order, decision points, static
  verification record, and deferred execution gates.
- [Draft/Addendum Omissions, Corrections, and Additions](docs/KERNEL_DRAFT_OMISSIONS.md)
  — explicit accounting for source material not placed verbatim in the
  architecture and all addendum dispositions.

## Compatibility

The development workspace requires Node.js 20 or newer. The root `onto2d.js`
file retains its UMD wrapper for direct CommonJS and browser-script use; browser
compatibility is a legacy contract but is not covered by the initial Node-only
CI matrix yet.

## License

Onto2D is developed by Denis Britov as part of the Causal Emergence Catalogue
project and is distributed under the [MIT License](LICENSE).
