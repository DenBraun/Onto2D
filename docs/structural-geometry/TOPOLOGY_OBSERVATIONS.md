# Directed topology observations

Status: SG2-012 implemented for the frozen `topology-only-v1` profile.
Date: 2026-09-06. Acceptance: [review](TOPOLOGY_OBSERVATION_REVIEW.md).

The evaluator measures seven graph summaries from one verified source scope.
Equal summaries can describe different directed graphs. It preserves all
[SG2-010 contracts](REGIME_CONTRACTS.md), including the explicitly unevaluated
preparation, and returns a separate measured artifact. Pairwise comparison,
missingness results, probes and response signatures remain later tasks in the
[operative roadmap](REVISED_ROADMAP.md).

## Observations and interpretation

The implementation binds these fields to the existing ordered spec references:

| Position / observable | Value field | Meaning |
|---|---|---|
| 1 / `node-count-v1` | `nodeCount` | All scoped nodes, including isolates |
| 2 / `edge-count-v1` | `edgeCount` | Directed edges with both endpoints in scope |
| 3 / `weak-component-sizes-v1` | `weakComponentSizes` | Sizes of connected groups when direction is ignored, sorted numerically ascending |
| 4 / `strong-component-sizes-v1` | `strongComponentSizes` | Sizes of groups in which every node can reach every other along directed paths, sorted numerically ascending |
| 5 / `reachable-ordered-pair-count-v1` | `reachableOrderedPairCount` | Distinct ordered pairs `(u,v)`, `u != v`, connected by a directed path; each pair counts once |
| 6 / `cyclic-node-count-v1` | `cyclicNodeCount` | Nodes in strong components of size greater than one |
| 7 / `isolated-node-count-v1` | `isolatedNodeCount` | Nodes with zero incoming and outgoing scoped edges |

Both component vectors include singleton isolates. Multiple paths do not add
extra reachable pairs; returning to the starting node on a cycle adds no self
pair. The existing source policy rejects loops and parallel directed arcs.
Cyclic-node count does not count cycles or enumerate their paths. Values are
exact bounded integers, without tolerance, normalization or learned weights.

For `a → b` and `a → c`, the value is:

```json
{
  "nodeCount": 3,
  "edgeCount": 2,
  "weakComponentSizes": [3],
  "strongComponentSizes": [1, 1, 1],
  "reachableOrderedPairCount": 2,
  "cyclicNodeCount": 0,
  "isolatedNodeCount": 0
}
```

Reversing both arrows gives exactly this value, although the
[exact canonical evaluator](CANONICAL_OBSERVATIONS.md) separates the two graphs.
More generally, reversing **every edge** preserves all seven summaries:
components keep their memberships, reachable pairs transpose, and cyclic and
isolated nodes stay the same. Directed traversal is still necessary; for
example, a three-node directed chain has three reachable pairs, whereas either
star has two. The summary's equality is intentionally weaker than isomorphism.

## Public API and source binding

```js
import {
  observeStructuralTopology,
  verifyStructuralTopologyObservation,
  createStructuralTopologyObservationAnalysis
} from "@onto2d/structural-geometry/topology";

const input = {
  regimeId: "topology-only-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2", "0.3", "0.4", "0.5"] }
};
const result = observeStructuralTopology(pack, input);
verifyStructuralTopologyObservation(result, pack, input);
console.log(result.observation.value);
// Register createStructuralTopologyObservationAnalysis() explicitly with an engine.
```

The request requires the literal regime ID. Scope defaults to full source;
induced membership is explicit, unique and nonempty. Verification checks the
**complete** Model Pack and source projection before scoping. Incoming,
outgoing and external edges remain in preparation provenance but contribute no
scoped edges or paths. A path leaving and reentering the scope is excluded.
No attribute, dictionary code, source ID or scientific confidence enters a value.

The immutable output contains:

- `evaluation: "measured"`, fixed implementation descriptor and its hash;
- the unchanged SG2-010 `preparation`, whose own `evaluation` stays `"not-run"`;
- `observation`: regime, ordered seven spec references, implementation reference,
  seven-field value and `valueHash`;
- `diagnostics`: source-ID weak/strong memberships, reachable counts by source,
  and traversal work; these are provenance, not extra observation coordinates;
- `artifactHash`, binding the entire source-specific envelope.

Members and groups are ordered by source IDs using JavaScript string ordering;
groups use their least member. Component-size vectors use numeric ordering.
Changing IDs or annotations may change diagnostics and full artifact identity
while preserving the content-qualified value. Diagnostics do not identify
invariant probe targets. Empty probe declarations remain unchanged and no
probe execution is implied by the evaluator's invariance tests.

Hash domains are `onto2d:structural-topology-{implementation,value,artifact}:v1`.
The value hash excludes source preparation and diagnostics, but includes the
regime, ordered spec references and implementation reference. Verification
rebuilds the entire expected artifact from the supplied pack and request; a
rehashed alteration or a different source with the same summary still rejects.

## Algorithm, bounds and errors

For each scoped node, breadth-first search computes directed reachability.
Mutual reachability defines strong components. A separate breadth-first search
over incoming and outgoing adjacency computes weak components. No canonicalizer
is used by this evaluator.

The frozen bounds are 1–64 scoped nodes, at most 256 scoped edges, at most 4,096
distinct source/target visits, 100,000 canonical entries and 1 MiB per complete
artifact. The visit count includes one self seed per source, so it equals
`reachableOrderedPairCount + nodeCount`; its bound is inclusive. The separate
`reachabilityEdgeScans` counts only adjacency entries examined during directed
reachability, at most `nodeCount × edgeCount = 16,384`. These two diagnostics
do not claim to measure all validation, component or serialization work.

The graph algorithm takes `O(N × (N + E))` work and `O(N² + E)` storage within
these limits. Invalid source/request data, unsupported regime and resource
exhaustion throw explicit errors with no truncated or partially measured
artifact. Existing Model Pack/projection/preparation errors propagate;
evaluator errors use the `STRUCTURAL_TOPOLOGY_` prefix. Browser and Node use
the same implementation. Two additive closed schemas and readonly declarations
cover the public input/artifact and opt-in engine definition. Schema checks
shape; expected-source replay checks arithmetic, partitions and identities.

## Independent evidence

The [case suite](../../cases/structural-geometry/topology/README.md) freezes 23
artifacts. Python standard-library Boolean Floyd–Warshall closure independently
computes all values, component memberships and analytic traversal totals.
It does not import the production traversal. For every directed loopless graph
on 1–4 nodes, it also uses the earlier independent permutation reference to
classify which nonisomorphic graphs share a summary.

| Nodes | Labeled graphs | Isomorphism classes | Summary classes | Summary classes containing multiple isomorphism classes | Largest collision |
|---|---:|---:|---:|---:|---:|
| 1 | 1 | 1 | 1 | 0 | 1 |
| 2 | 4 | 3 | 3 | 0 | 1 |
| 3 | 64 | 16 | 12 | 4 | 2 |
| 4 | 4096 | 218 | 53 | 34 | 22 |

All 4,165 graph values agree with the independent matrix reference. Every
isomorphism class has one summary; different classes may merge as shown.
Transposition equality is checked throughout this census. The outward/inward
star control additionally runs both public evaluators and freezes their equal
topology and unequal exact canonical value hashes.

The Causal Emergence examples use the unchanged 2026.08.15 source lock. The
six-node fragment has 11 edges and 14 reachable ordered pairs. The second
fragment declares 32 explicit IDs in the fixture: 88 edges, 377 reachable pairs,
four isolates and three cyclic nodes. It is a declared fragment, not a selected
scientific finding or a full-model result. The complete 249-node source exceeds
this regime's scope bound.

```sh
npm run structural-geometry:topology:check
npm run structural-geometry:topology:report
```

The report verifies frozen bytes before printing values and collision counts.
For deliberate regeneration, first review source changes and run
`python3 -B cases/structural-geometry/topology/reference.py --write`, then
`npm run structural-geometry:topology:build`. Generation refuses stale source
hashes or disagreement with independent expectations. Checks never regenerate.
Algorithm agreement is computational evidence, not independent scientific
review or evidence of cross-domain explanatory usefulness.
