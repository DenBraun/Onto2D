# Model Studio

Model Studio is a static browser projection of exact releases in the
hash-pinned Model Pack registry. It loads the registry through a bounded
read-only snapshot, resolves the selected model and version, and loads every
required split file through
the bounded `@onto2d/model-pack/browser` transport, reconstructs the pack, and
verifies its semantic hashes and derived indexes before creating an
exact-identity lazy presentation through `@onto2d/engine/presentation`.

The browser verifies the exact bytes it receives and binds all workspace URL
state to the exact model and version. Switching releases resets an incompatible
node selection. It does not reinterpret relations or replace scientific review
of either release. Model-specific labels and evidence-boundary copy come only
from explicit presentation metadata in the verified pack; generic Studio code
does not branch on a model ID. Version comparison remains distinct from model
selection and requires reviewed lineage.

The interface uses a compact IDE workbench with a catalogue Explorer, graph
editor, and node Inspector. A click inspects a node without changing the
layout; a double-click makes it the graph focus. Hovering a node or edge
highlights its immediate graph context. Every interface label remains at least
12 pixels, and the stacked narrow layout preserves the same controls. Graph
nodes are rounded cards with bounded dimensions; dense layouts reduce their
width deterministically, labels wrap to three lines, and only the last visible
line is ellipsized. Explorer
loads lightweight records in 60-row pages. Graph projections omit full source
records; selecting a node requests its complete Inspector record explicitly.
This UI paging never becomes partial semantic execution.

The square `+` beside the active editor opens the local RDF mapping import.
Select one exact reviewed set: `data.nt`, `shapes.nt`, and
`mapping-policy.json`. Studio replays bounded N-Triples import, SHACL
validation, mapping-policy verification, and Model Pack construction in the
browser. The policy carries both source IDs and all three evidence hashes, so
an arbitrary or mixed set fails closed. A successful import replaces the
current in-memory presentation; it is not uploaded, cached as a release, or
added to the registry, and a page reload restores the bundled release.

From the repository root, run `npm run dev:site` and open
`http://127.0.0.1:8080/apps/model-studio/`.
