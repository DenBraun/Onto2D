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
The [DREAM4 pilot](cases/structural-geometry/dream4/README.md) reports improved
primary knockout ranking and worse secondary knockdown ranking under the fixed
learner. The [C. elegans study](cases/structural-geometry/celegans/README.md)
finds worse full-model ranking on 9 eligible source groups and 60 pairs.
The [robustness studies](cases/structural-geometry/robustness/README.md) test
constrained graph nulls, adult-anatomy sensitivity and expanded graph-feature
controls, five metric/idleness/initialization variants, and exhaustive scope and
low-degree coverage. The matched scope study shows population and baseline
dependence; Dataset7 has no eligible low-degree pairs. Mixed and unavailable
outcomes remain explicit. The [Structural Geometry Lab](apps/structural-geometry-lab/README.md)
presents the verified evidence alongside interactive graph, geometry, flow and
signature views. The homepage organizes the research directions around an
explicit distinguishability foundation.

## Try the engine

After `npm ci`, save either example as `example.mjs` in the repository root and
run `node example.mjs` with Node.js 22+. These examples use the local workspace;
the root `onto2d` package is private and has not been published to npm.

### Read a catalogue node and its direct parents

`Onto2D.create()` loads and verifies the bundled Causal Emergence catalogue.
A Model Pack contains the model's nodes, connections and metadata. Here,
`"0.8"` is a record ID in that catalogue, not a numerical parameter.

```js
import { Onto2D } from "onto2d";

const engine = await Onto2D.create();
const model = engine.model;
console.log(`${model.name}: ${model.nodes().length} nodes, ${model.edges().length} connections`);

const node = model.require("0.8"); // Look up this record; throw if it is missing.
console.log(node.name);

// Follow incoming connections in the catalogue's source-parent relation layer.
const parents = model.parents(node.id, { relationLayer: "source-parent" });
console.log("Direct parent IDs:", parents.map(parent => parent.id).join(", "));
```

Expected output:

```text
Causal Emergence Catalogue: 249 nodes, 971 connections
Resonant Localized Configuration (CRT-Node)
Direct parent IDs: 0.18, 0.19, 0.20, 0.21, 0.22, 0.6, 0.7
```

Each parent is a node with its own `id`, `name` and `description`, so you can
inspect it in the same way. These are connections recorded in the source
catalogue; the engine does not establish that they are causal relationships.

### Check whether two directed graphs have the same structure

Consider three steps connected as a chain. Changing their numbering should
preserve the graph's identity; changing the chain into a fork should not.
This example supplies its own small graphs to the built-in `canonical-identity`
analysis. It does not edit the catalogue.

```js
import { Onto2D } from "onto2d";
import { hashCanonical } from "@onto2d/kernel";

const engine = await Onto2D.create();
// All three nodes refer to the same content: a generic step.
const ref = hashCanonical("onto2d:artifact:v1", { kind: "step" });

async function graphId(connections) {
  const artifact = await engine.analyze("canonical-identity", {
    candidate: {
      domain: "single-candidate",
      nodes: [{ ref }, { ref }, { ref }],
      // Each pair contains the zero-based source and target node indices.
      edges: connections.map(([from, to]) => ({ from, to, role: "precedes" }))
    }
  });
  return artifact.result.candidateId;
}

const chain = await graphId([[0, 1], [1, 2]]);      // 0 → 1 → 2
const renumbered = await graphId([[2, 0], [0, 1]]); // 2 → 0 → 1
const fork = await graphId([[0, 1], [0, 2]]);       // 0 → 1 and 0 → 2

console.log("Renumbered chain is identical:", chain === renumbered);
console.log("Fork is identical to chain:", chain === fork);
```

Expected output:

```text
Renumbered chain is identical: true
Fork is identical to chain: false
```

The candidate ID is a deterministic hash of the canonical graph. Node content,
edge directions and edge roles participate in identity; input numbering does
not. This is useful for detecting duplicate structures or checking whether a
graph edit changes structure. Compare `result.candidateId` for this purpose:
the full analysis artifact also records the request and selected model.

See [package ownership](docs/PROJECT_STRUCTURE.md) and
[engine contracts](docs/architecture/ENGINE.md) for integration.

## License and source attribution

Project code is covered by [LICENSE](LICENSE). Source datasets retain their own
terms and attribution; see case source locks, notices and case guides.
