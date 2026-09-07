# Onto2D

Onto2D is a JavaScript toolkit for deterministic, finite admissibility-closure
models. Declared structures, rules and construction steps become
content-addressed artifacts that can be replayed and compared.

The project is **in development; the first project release has not been
published**. Package version fields and frozen Model Pack versions identify
working contracts and datasets; they are not a project release announcement.

## Start here

- [Documentation](docs/README.md): architecture, research, examples and development.
- [Current roadmap](docs/ROADMAP.md): implemented capabilities and remaining work.
- [Development guide](docs/DEVELOPMENT.md): setup, checks and local testing.
- [History case portfolio](docs/history/PORTFOLIO.md): examples and their evidence boundaries.
- [Structural Geometry](docs/structural-geometry/README.md): methods, results and the DREAM4 / C. elegans research program.

## Run locally

Use Node.js 22+ and Python 3.9+.

```sh
npm ci
npm test
npm run build
npm run dev:site
```

The development server prints its local URL. `npm run build` includes repository
checks. Independent NetworkX verification has a separate environment described
in the [development guide](docs/DEVELOPMENT.md).

## What is implemented

The schema-v1 kernel has a closed capability registry for canonical identity,
exact quantities, bounded candidate generation, admissibility, closure,
null-model execution and verified evidence bundles. Closure of this software
contract does not establish the foundational theory empirically.

The engine verifies Model Packs and provides exact-version queries, traversal,
isolated workspaces, declared-lineage diff and registered analyses. Model Studio
and the case explorers present verified inputs and disclosed interpretations.

History Matters implements replayable semantic controls and empirical study
preparation. Structural Geometry implements directed Forman and certified
Ollivier curvature, normalized shadow flow, observation regimes, probes,
signatures and bounded comparisons. Its finite synthetic study found zero
additional discrimination on 210 eligible pairs; general usefulness is open.
The next research work uses independent response targets from DREAM4 and
C. elegans, with source acquisition and applicability gates before scoring.

## Engine preview

```js
import { Onto2D } from "onto2d";

const engine = await Onto2D.create();
const node = engine.model.require("0.8");
const parents = engine.model.parents(node.id);
```

The private root facade selects the bundled Causal Emergence Model Pack.
Source-parent relations retain their source meaning. Graph structure alone
is not a reviewed generative or causal interpretation.

See [package ownership](docs/PROJECT_STRUCTURE.md) and
[engine contracts](docs/architecture/ENGINE.md) for integration.

## License and source attribution

Project code is covered by [LICENSE](LICENSE). Source datasets retain their own
terms and attribution; see case source locks, notices and case guides.
