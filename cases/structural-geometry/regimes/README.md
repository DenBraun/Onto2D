# Regime contract preparations

Six frozen preparations demonstrate the [SG2-010 contract](../../../docs/structural-geometry/OBSERVATIONS.md#distinguishability-regime-and-observable-contracts).
They contain source/scope bindings and observation specifications. Every artifact
has `evaluation: "not-run"`; these are not graph comparisons or benchmark scores.

Each of `canonical-structure-v1`, `topology-only-v1` and `typed-relations-v1`
has two examples:

- A declared five-node graph with a directed four-cycle and an isolated node.
- The six-node induced Causal Emergence scope `0.0` through `0.5`, bound to the
  complete release and existing source lock. All excluded and crossing edges
  remain accounted for in the preparation.

The registry contains nine observable specs; the three profiles select one,
seven and two mandatory specs respectively. A spec shared by multiple profiles
keeps its content identity. Dictionary hashes record local provenance and do
not by themselves authorize cross-model typed comparison.

```sh
npm run structural-geometry:regimes:check
npm run structural-geometry:regimes:report
```

Both commands verify exact stored bytes; the focused check also exercises source
replay, limits, tampering, closed schemas, engine and browser behavior and the
117-file legacy compatibility inventory. Deliberate regeneration uses
`npm run structural-geometry:regimes:build`. The suite has its own hash domain;
existing geometry/provider examples retain their original bytes.
