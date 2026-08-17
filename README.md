# Onto2D

Onto2D is a JavaScript toolkit for deterministic, finite admissibility-closure
models. It turns declared structures, rules, and construction steps into
content-addressed artifacts that can be replayed and compared.

## Status

The schema-v1 kernel is locally closed: its public capability registry has no
pending kernel operations, and the repository includes conformance tests,
independent canonicalization goldens, JSON Schemas, and TypeScript declarations.
The implementation baseline passes the supported CI matrix. Tagging `v0.1.0`
still requires independent review of the canonical identity fixtures and a
green run on the exact release commit.

The repository includes a bounded external Phase-B reference solver, but no
general scientific solver or empirical validation of the foundational theory.
Those claims require explicit external evidence through the scientific-adapter
boundary.

The repository also contains a private engine preview: a deterministic Model
Pack contract, separate frozen Causal Emergence and live-bootstrap provenance
releases, and a headless API for exact model queries and traversal. It is not
yet a published npm package.

## Engine preview

```js
import { Onto2D } from "onto2d";

const engine = await Onto2D.create();
const node = engine.model.require("0.8");
const parents = engine.model.parents(node.id);

const identity = await engine.analyze("canonical-identity", {
  candidate: myCandidate
});
```

The bundled release preserves source relations as `source-parent` and records
known catalogue findings; it does not silently upgrade them into reviewed
generative semantics. See the
[Engine Architecture](docs/ONTO2D_ENGINE_ARCHITECTURE.md).

## Try the studies

- [Historical Load Explorer](https://denbraun.github.io/Onto2D/apps/historical-load-explorer/)
  uses a disclosed finite toy model ([source notes](apps/historical-load-explorer/README.md)).
- [Three-Node Motif Explorer](https://denbraun.github.io/Onto2D/apps/three-node-motif-explorer/)
  projects a frozen reproduction of the published *E. coli* motif result
  ([source notes](apps/three-node-motif-explorer/README.md)).
- [Canonical Identity Lab](https://denbraun.github.io/Onto2D/apps/canonical-identity-lab/)
  replays tested candidate-identity fixtures
  ([source notes](apps/canonical-identity-lab/README.md)).

The [Level-0 Numerical Validation](https://denbraun.github.io/Onto2D/apps/level-zero-validation/)
presents the expanded bounded negative result as an artifact-backed gate
sequence, interactive branch comparison, and asymmetric complex search
([source notes](apps/level-zero-validation/README.md)).

The [Model Studio](https://denbraun.github.io/Onto2D/apps/model-studio/)
bounds and fully verifies its hash-pinned registry and selected exact Model
Pack in the browser before exposing lazy catalogue pages, directed
neighborhoods, and explicit source-record inspection. It can switch between
the separate Causal Emergence and Live Bootstrap Provenance releases without
reusing incompatible workspace selection.
Its `+` action also opens an exact local `data.nt` + `shapes.nt` +
`mapping-policy.json` set after replaying the complete RDF verification chain
([source notes](apps/model-studio/README.md)).

The [Bootstrap Provenance Explorer](https://denbraun.github.io/Onto2D/apps/bootstrap-provenance-explorer/)
reads the pinned live-bootstrap trace, evidence classes, trust roots, and
separately disclosed finite counterfactual analysis
([method](docs/LIVE_BOOTSTRAP_PROVENANCE_METHOD.md)).

Run the static site:

```sh
npm run dev:site
```

Then open `http://127.0.0.1:8080/`, or use the
[published GitHub Pages site](https://denbraun.github.io/Onto2D/).

## Verify the repository

Node.js 22 or newer is required; Node.js 24 LTS is recommended.

```sh
npm ci
npm test
npm run check
npm run build
```

`npm run build` is a validation build; packages run from source and no `dist/`
tree is generated. See the [Development Guide](docs/DEVELOPMENT.md) for focused
commands and fixture policy.

The read-only CLI can verify and inspect a transparent local Model Pack from
either its split directory or a bounded ZIP transport:

```sh
node packages/cli/src/bin.js verify ./models/causal-emergence/releases/2026.08.15
node packages/cli/src/bin.js verify ./causal-emergence.onto2d.zip
node packages/cli/src/bin.js node ./models/causal-emergence/releases/2026.08.15 0.8
```

## Packages

| Package | Responsibility |
|---|---|
| [`@onto2d/kernel`](packages/kernel/README.md) | Deterministic model, identity, evaluation, closure, and artifacts |
| [`@onto2d/cli`](packages/cli/README.md) | Read-only local Model Pack verification and engine queries |
| [`@onto2d/schemas`](packages/schemas/README.md) | JSON Schema Draft 2020-12 transport contracts |
| [`@onto2d/model-pack`](packages/model-pack/README.md) | Canonical releases plus bounded transports, workers, verified caching, and read-only registry resolution |
| [`@onto2d/engine`](packages/engine/README.md) | Headless exact-version model API, workspaces, analyses, diff, and verified presentation composition |
| [`@onto2d/canonical-identity-analysis`](packages/canonical-identity-analysis/README.md) | Replayable kernel-backed candidate identity analysis |
| [`@onto2d/view`](packages/view/README.md) | Browser-safe paged catalogue, explicit inspection, neighborhood, and deterministic layout projections |
| [`@onto2d/rdf-import`](packages/rdf-import/README.md) | Bounded RDF 1.1 N-Triples import artifacts and semantics-neutral graph projections |
| [`@onto2d/shacl-validation`](packages/shacl-validation/README.md) | Closed, deterministic SHACL 1.0 Core validation over exact RDF import artifacts |
| [`@onto2d/rdf-mapping`](packages/rdf-mapping/README.md) | Reviewed RDF-to-Onto2D policy, complete source accounting, and Model Pack projection |
| [`@onto2d/catalog-adapter`](packages/catalog-adapter/README.md) | Source-catalogue audit and reviewed migration replay |
| [`@onto2d/scientific-adapter`](packages/scientific-adapter/README.md) | Boundary for external numerical implementations |
| [`@onto2d/level-zero-solver`](packages/level-zero-solver/README.md) | Bounded external Phase-B reference solver |
| [`@onto2d/run-store`](packages/run-store/README.md) | Verified local persistence of semantic run bundles |

Research inputs and reproductions live in [`cases/`](cases). The
[Level-0 oscillator case](cases/level-0-oscillator/README.md) contains a bounded
Phase-B numerical reference benchmark and a negative Phase-C boundedness
preflight, a bounded objecthood search, a real-time persistence probe, and a
preregistered asymmetric/complex extension; the
[three-node-motif case](cases/three-node-motifs/README.md) is an executable,
frozen empirical reproduction. The
[RDF mapping reference](cases/rdf-mapping-reference/README.md) replays a
W3C-derived conforming graph through import, SHACL validation, explicit mapping,
and complete Model Pack verification. The
[live-bootstrap provenance case](cases/live-bootstrap-provenance/README.md)
pins exact upstream bytes, preserves 205 manifest events and 442 classified
evidence records, builds a separate content-addressed Model Pack, and keeps its
finite counterfactual analysis outside extracted upstream facts.

## Documentation

- [Architecture](docs/KERNEL_ARCHITECTURE.md) explains the system boundaries and
  execution model.
- [Engine Architecture](docs/ONTO2D_ENGINE_ARCHITECTURE.md) defines Model Packs,
  model access, workspace state, and comparison boundaries.
- [Engine Roadmap](docs/ENGINE_ROADMAP.md) separates the implemented foundation
  from Studio, adapters, loaders, and operational work.
- [Implementation Status](docs/KERNEL_IMPLEMENTATION_STATUS.md) separates the
  closed kernel from remaining external work.
- [Scientific Roadmap](docs/SCIENTIFIC_ROADMAP.md) defines the numerical,
  catalogue-migration, solver, and empirical work that follows kernel closure.
- [Project Structure](docs/PROJECT_STRUCTURE.md) defines dependency and ownership
  rules.
- [Foundational Paper Analysis](docs/FOUNDATIONAL_PAPER_ANALYSIS.md) records
  theory traceability and scientific limitations.
- [Live Bootstrap Provenance Method](docs/LIVE_BOOTSTRAP_PROVENANCE_METHOD.md)
  defines the pinned source, evidence classes, finite analysis, and trust
  boundary for the external bootstrap case.
- [Review Guide](docs/REVIEW_GUIDE.md) defines the independent golden review
  required for release.
- [ADRs](docs/adr) preserve decisions that affect identity, evidence, or package
  boundaries.
- [Release Checklist](docs/RELEASE_CHECKLIST.md) lists release evidence.

## License

Onto2D is developed by Denis Britov as part of the Causal Emergence Catalogue
project and is distributed under the [MIT License](LICENSE).
