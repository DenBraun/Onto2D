# Frozen typed observation and vocabulary cases

SG2-013 implements the two frozen typed-regime observations and explicit
vocabulary alignment. See the [contract](../../../docs/structural-geometry/TYPED_OBSERVATIONS.md)
and the [declared control protocol](PROTOCOL.md).

[controls.json](controls.json) freezes 25 synthetic graphs, the six-node Causal
scope, five partial-bijection declarations and eight approval/coverage controls.
Synthetic graphs test each field, cross-field correlations, set ordering and
empty versus missing values, source relabeling and metadata/dictionary changes,
cycles, isolates and complete six-node graphs. Causal Emergence retains the
existing [source lock](../causal-emergence/source-lock.json); all 11 scoped edges
have all five fields. No parent relationship is upgraded to reviewed causality.

[reference.py](reference.py) uses independent Python node permutations. It
checks every original/remapped directed witness and the joint five-field graph
orbit. An exhaustive 1–3 node census over absent/A/B edges covers 739 labeled
graphs and 145 typed isomorphism classes. [census.mjs](census.mjs) checks both
directions of the class mapping and all 720 relabelings of the six-node control.
The reused [untyped reference](../canonical/reference.py) supplies independent
untyped orbits; no production matching or mapping implementation is imported
by Python. [reference.json](reference.json) pins expectations and source hashes.

[suite.json](suite.json) binds 26 observation artifacts (24 measured, two
incomplete), five mapping artifacts and eight alignments. Four alignments are
compatible and four remain unresolved. Equal local code graphs across different
sources do not pass without an explicitly approved mapping. The renumbering
control requires a new canonical numbering after translation. Missing fields
and uncovered map values leave `aligned: null` even with fixture authorization.

The mapping protocol and fixtures are declared computational controls. Their
`approve` flag represents test policy, not a completed external scientific
review. Public callers must supply their own independently accepted mapping
hash; creating a mapping does not approve it.

```sh
npm run structural-geometry:typed:check
npm run structural-geometry:typed:report
```

The focused check verifies pinned legacy compatibility, independent expectations,
all case bytes, Python witness/translation replay and 37 API/schema/browser tests.
`npm test` also discovers three reference/census tests; `npm run build` includes
the focused gate. A server is unnecessary for this computational stage.

Deliberate regeneration: first review source and protocol changes, then run
`python3 -B cases/structural-geometry/typed/reference.py --write` followed by
`npm run structural-geometry:typed:build`. The builder checks all source hashes,
independent graph orbits, coverage and acceptance controls before writing.
Previous geometry cases and regime identities remain unchanged.
