# Model Studio

Model Studio is a static browser projection of the frozen Causal Emergence
Model Pack release `2026.08.15`. It loads every required split file through
the bounded `@onto2d/model-pack/browser` transport, reconstructs the pack, and
verifies its semantic hashes and derived indexes before exposing any data to
`@onto2d/view` for deterministic catalogue and neighborhood projections.

The browser verifies the exact bytes it receives; it does not reinterpret
`source-parent` relations as reviewed causation or replace scientific review
of the release. Version comparison is intentionally absent until a second
real release and reviewed lineage record exist.

The interface uses a compact IDE workbench with a catalogue Explorer, graph
editor, and node Inspector. A click inspects a node without changing the
layout; a double-click makes it the graph focus. Hovering a node or edge
highlights its immediate graph context. Every interface label remains at least
12 pixels, and the stacked narrow layout preserves the same controls.

From the repository root, run `npm run dev:site` and open
`http://127.0.0.1:8080/apps/model-studio/`.
