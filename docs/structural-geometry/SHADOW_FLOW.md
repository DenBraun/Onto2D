# Normalized shadow geometry flow

Status: computational stage 5 implemented for a bounded reference profile.
Date: 2026-09-06.

## Adopted definition

Policy `directed-ollivier-shadow-flow-v1` evolves a separate array of positive
edge lengths over an immutable verified `source-parent` graph. Every edge in
the declared full or induced scope participates. Source Weight, quantization
and other annotations never become lengths or probabilities. The complete
source is verified before scope selection; excluded nodes, excluded edges and
boundary edges are counted. Scoped isolates remain throughout the analysis.

The [Ollivier in/out convention](GEOMETRY.md#directed-ollivier-reference-contract) extends to current
weighted directed shortest paths. For `u -> v`, the source distribution uses
predecessors of `u`, and the target distribution uses successors of `v`.
`idleness: "half"` retains half the mass at each endpoint; `"zero"` distributes
all mass over the chosen neighbors. An empty neighborhood is a Dirac mass at its
endpoint. Neighbor shares remain uniform as lengths evolve (the `p=0` choice).
Every required support pair has a finite directed path through the analyzed
edge. No strong-connectivity requirement or artificial unreachable cost is used.

At a state with lengths `l`, let `d` be directed shortest-path distance and `W_e`
the exact optimal transport cost between those distributions:

```text
kappa_e = 1 - W_e / d(u,v)
raw_e = (1 - epsilon) * d(u,v) + epsilon * W_e
closed_e = shortest_distance_under_raw(u,v)
factor = number_of_scoped_edges / sum_e(closed_e)
next_length_e = factor * closed_e
```

All edges update simultaneously. The initial supplied lengths also pass through
shortest-endpoint closure and mean-one normalization, so every stored length is
its current endpoint distance. Replacing edges by their shortest endpoint
distances preserves all shortest paths. This explicitly handles an initial edge
longer than an alternate directed route. Each state records the raw sum, closure
sum, normalization factor and every edge shortened by closure. The normalized
length sum equals the scoped edge count exactly at every state.

The update follows equation (4) and the metric normalization of Appendix C,
Algorithm 1, in [Ni et al., Community Detection on Networks with Ricci Flow (2019)](https://www.nature.com/articles/s41598-019-46380-9).
The [full paper with appendices](https://arxiv.org/html/1907.03993v1) supplies the
synthetic recurrence used below. Placing closure/normalization after each update
makes the stored state the input to the next transport calculation. The directed
in/out extension, bounded stopping rules and final-only cuts are the declared
project profile; the paper's undirected convergence result is not asserted for
arbitrary directed Onto2D graphs.

Supported steps are `"half"` (epsilon = 1/2, default) and `"one"` (epsilon = 1).
Default idleness is `"half"`. A half step keeps a positive contribution from the
previous length even when transport cost is zero. Neither setting is promoted as
a scientifically optimal choice. The published control uses step one and zero
idleness explicitly.

## Stopping and final cuts

State zero is the normalized initial geometry with its own transport
certificates. `maxIterations` counts transformations after state zero. Every
stored state recomputes curvature under its own lengths.

The deterministic stopping order is:

1. `fixed-point`: the normalized length vector exactly equals the previous one;
2. `cycle`: it exactly repeats an earlier nonadjacent vector, recording start and period;
3. `tolerance`: both maximum absolute length change and maximum absolute curvature
   change stay at or below the declared tolerance for `stableSteps` consecutive transitions;
4. `iteration-limit`: the requested number of transformations has completed;
5. `degenerate-length`: a proposed next raw length is zero; stop at the current
   positive state and report the affected edge IDs before applying the update.

The first state has null changes and zero stable steps. Defaults are 16
transformations, tolerance `1/1000000` and two stable transitions. A cycle, a
degenerate proposal and an iteration limit do not claim convergence. Even the
tolerance condition describes observed consecutive changes, not an asymptotic
proof. At an exact fixed normalized geometry curvature need not be zero.

`cut: {kind: "none"}` is the default. The optional
`{kind: "final-length", threshold: rational}` removes strictly longer edges
only from a final analytical connectivity view. It reports removed edge IDs,
weak and strong component memberships, cyclic nodes and isolates. Equality with
the threshold retains the edge. Cuts do not affect subsequent flow, edit source
data, contract nodes, or perform iterative graph surgery.

## Exact transport and identity

`@onto2d/structural-geometry/flow` provides portable request preparation,
orchestration and full-history verification. Its explicit `/flow/node` subpath
runs a packaged Python 3.9+ standard-library reference via the scientific adapter
interface. The Python oracle uses rational costs and integer mass units with
successive shortest augmenting paths. JavaScript verifies all marginal sums,
dual inequalities and exact primal/dual equality for every edge at every state.
No optimization library, floating-point transport or solver process is needed
to verify a stored artifact in the browser.

Reduced rational numerator/denominator strings encode lengths, costs, potentials,
curvatures and deltas. The transport `costNumerator` is the rational total cost
for integer mass units; dividing it by `massDenominator` gives `W`. It is not
necessarily an integer when lengths are rational. Different valid optimal plans
can prove the same values; the packaged solver's deterministic order fixes the
reference artifact bytes. IDs and supports use UTF-16 code-unit order.

The immutable request captures the complete source/model/root/manifest identity,
scoped record hashes, policy, initial lengths and all parameters before the first
await. Each transport request binds the flow request, current metric, iteration,
previous state hash and frozen solver identity. States form a hash chain, and
the artifact binds the entire history, termination and cuts. Canonical domains
are `onto2d:structural-flow-{policy,projection,request,metric,transport,state,artifact,suite}:v1`.
The metric hash deliberately omits iteration so exact cycles can be identified.

`verifyStructuralFlowArtifact(artifact, expectedPack, expectedInput)` rebuilds
the source request, every transport problem, each update, normalization, stopping
decision, cut and hash. It rejects truncated or extra histories and rehashed
fabrications. The supplied expected pack/input remain the authority. There is
no persistent cache or automatic browser page-load execution in this stage.

| Bound | Value |
|---|---:|
| Scoped nodes / edges | 64 / 64, with at least one edge |
| Transformations | 1–24; at most 25 states |
| Consecutive stable transitions | 1–8 |
| Nonzero support entries per measure | 16 |
| Transport cells per request / requested full history | 4096 / 32768 |
| Common mass denominator | 512 |
| Digits per reduced rational magnitude | 256 |
| Transport request / response / diagnostic pipe | 1 MiB each |
| Canonical artifact size / entry count | 8 MiB / 500000 |
| External process deadline per state | 30 seconds maximum |

The history budget is checked against the requested maximum before solving,
even if a graph might stop early. Full-source projection and canonical codec
bounds also apply. Exact rational growth can hit the digit bound before the
iteration cap, including on a small graph. Such a failure returns an explicit
error with no partial success artifact, rounding, clamping or silent truncation.
The two frozen real-source examples therefore declare six transformations.
Process startup uses isolated Python, a fixed packaged script and no shell.

## Published gate and interpretation

The [reference suite](../../cases/structural-geometry/flow/README.md) reproduces
`G(3,2)` from Appendix E of Ni et al.: three complete four-node groups, whose
three gateway vertices also form a complete graph. Reciprocal directed arcs
encode 21 undirected edges. For this symmetric graph, the directed measures and
distances coincide with the paper's undirected ones. Directed total length 42
is the same mean-one normalization as undirected total length 21.

The separate standard-library Python recurrence from Lemma E.1 agrees exactly
with all lengths, transport costs and curvatures over 17 states. After 16
transformations the six gateway arcs are about 2.960073, gateway-to-internal arcs
about 1.346642, and other internal arcs about 0.000000096536. A strict threshold
of 2 recovers the three known four-node groups. This is a finite benchmark
reproduction, not a claim that all internal arcs tend to zero under normalization
or that the finite run has converged.

A second reference independently rebuilds all 11 trajectories with NetworkX
3.2.1 Dijkstra paths, integer-scaled network simplex and rational arithmetic.
All 68 states / 1089 edge calculations, normalization traces, stopping records
and cuts agree. The two six-step Causal Emergence fragments illustrate relative
length changes after this computational gate. They are bounded induced graphs
with disclosed boundary counts, and both stop at their iteration limit.

The separate [star and bridge controls](../../cases/structural-geometry/flow-controls/README.md)
adds eight inward/outward-star profiles and one two-K4 single-bridge profile.
All 33 states / 506 edge calculations agree with a separate analytic derivation
and NetworkX. Stars preserve their normalized unequal lengths with zero
curvature; the bridge profile recovers its two groups at the declared cap and
threshold. It reaches `iteration-limit`, not a convergence result. The original
11 trajectories and their suite hash are unchanged.

These outputs describe the selected representation under the declared flow.
Community truth, causal significance, full-model scalability and empirical
usefulness remain open. Remaining response-versus-geometry evaluation follows the
[research plan](RESEARCH.md).
Directed persistence is conditional on a concrete unmet task.
