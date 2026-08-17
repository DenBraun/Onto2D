# Bootstrap Provenance Explorer

This focused research interface reads the committed artifacts from
`cases/live-bootstrap-provenance/`. It does not execute live-bootstrap and does
not replace Model Studio.

The Bootstrap Trace is derived from the pinned upstream manifest at commit
`9a268c4c39cae952b268bc86da342be2175f03d4`. The Explorer checks the identity
links between the source trace, deterministic state history, provenance
evidence, graph, finite construction space, regimes, and Historical Load bundle
before it exposes them.

Three interpretation layers stay separate:

- upstream facts are source text, source order, and bounded reviewed lines;
- derived facts are deterministic predicate, state, and graph projections;
- counterfactual paths and Historical Load results are Onto2D analysis.

The counterfactual paths are not branches that live-bootstrap executed or
declared. Historical Load is not a live-bootstrap metric. live-bootstrap does
not endorse Onto2D or this analysis.

With the default `event-count` cost and `bootstrappable` regime, the free
minimum is the one-event opaque-prebuilt-GCC path and the constrained minimum
is the 79-event pinned manifest prefix. Delta H is therefore `79 - 1 = +78`
counted events. It means that the modeled bootstrap-ancestry constraint adds 78
event units relative to that cheap alternative inside this three-path space.
It does not mean 78 seconds, 78 units of difficulty, or a quality, security, or
completeness score.

Graph nodes are bounded rounded cards. Labels wrap to at most three lines and
the last visible line is ellipsized when necessary; the complete identifier and
label remain available through the SVG title and evidence inspector.

Dependency evidence is intentionally incomplete where the consumed upstream
files do not demonstrate a dependency. In particular, source order is not
silently promoted to a build dependency, and unresolved compiler selection
remains `unknown`.

Serve the repository root and open:

```text
/apps/bootstrap-provenance-explorer/
```

The shared development server can be started with `npm run dev:site`.

Run the pure Explorer model and interpretation tests with:

```sh
node --test apps/bootstrap-provenance-explorer/*.test.mjs
```
