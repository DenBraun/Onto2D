# Model Studio

Model Studio is a static browser projection of the frozen Causal Emergence
Model Pack release `2026.08.15`. It loads the committed manifest, nodes, and
edges, then uses `@onto2d/view` for deterministic catalogue and neighborhood
layout projections.

The page does not recompute Model Pack hashes or reinterpret `source-parent`
relations as reviewed causation. Repository verification through
`@onto2d/model-pack` remains authoritative for pack integrity. Version
comparison is intentionally absent until a second real release and reviewed
lineage record exist.

The interface uses a compact IDE workbench with a catalogue Explorer, graph
editor, and node Inspector. A click inspects a node without changing the
layout; a double-click makes it the graph focus. Hovering a node or edge
highlights its immediate graph context. Every interface label remains at least
12 pixels, and the stacked narrow layout preserves the same controls.

From the repository root, run `npm run dev:site` and open
`http://127.0.0.1:8080/apps/model-studio/`.
