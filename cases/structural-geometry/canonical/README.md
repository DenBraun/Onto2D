# Exact canonical directed observations

This suite checks the [SG2-011 evaluator](../../../docs/structural-geometry/OBSERVATIONS.md#exact-canonical-directed-observations).
The 17 stored observations are measured; their nested SG2-010 preparations remain
unchanged, with the preparatory `not-run` marker. No pairwise distance, tri-state
comparison, response signature or probe result is fabricated.

`controls.json` declares 16 source graphs and expected equality/difference
controls. The final fixture uses the existing complete Causal Emergence release
and source lock, selecting `0.0` through `0.5`: six nodes and 11 internal edges.
All boundary and external edges remain recorded in the preparation.

`reference.py` uses only Python's standard library and exhaustive permutations
of directed adjacency bitmasks. It produces `reference.json`, which pins source
file hashes and all 4,165 labelled loopless directed graphs on 1–4 nodes. The
238 independent classes must correspond one to one with production canonical
values, even though the algorithms choose different numbering conventions.
`census.mjs` also checks every mapping against directed source edges. A separate
six-node control is checked under all 720 relabelings.

Python additionally verifies each stored public value belongs to its source's
permutation orbit and that the complete node/edge witness reconstructs exactly
that directed graph. This covers isolates, disconnected graphs, orientation,
reciprocal edges, cycles, symmetric six-node limits and source provenance.
It is not exhaustive enumeration of all five/six-node graphs or an empirical
validation of domain equivalence.

```sh
npm run structural-geometry:canonical:check
npm run structural-geometry:canonical:report
```

The focused check verifies the independent reference, the exhaustive census,
720 relabelings, all frozen artifacts, 20 API/schema/browser tests and the old
117-file compatibility inventory. `npm test` additionally exposes the three
independent/reference checks as tests. Stored values are never rewritten by
checks or reports. Regeneration is explicit and separate:

```sh
python3 -B cases/structural-geometry/canonical/reference.py --write
npm run structural-geometry:canonical:build
```

The new suite and hash domains preserve all existing source, regime-preparation,
provider and numeric geometry artifacts. A symmetric graph's witness mapping
must not become a probe target-selection policy: it records one valid mapping,
not invariant node orbits.
