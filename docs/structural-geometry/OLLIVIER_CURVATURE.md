# Directed Ollivier reference contract

Status: stage 4 computational reference path implemented; scientific validation open.
Date: 2026-09-06.

## Definition

For a directed edge `u -> v`, transport a probability measure on the predecessors
of `u` to a measure on the successors of `v`. Use forward directed shortest-path
distance in the declared scope. With unit edge lengths, `d(u,v) = 1` and:

```text
W = min sum_ij distance(i,j) * transport(i,j)
kappa(u,v) = 1 - W / d(u,v) = 1 - W
```

This follows the unweighted incoming/outgoing convention of section 2.3,
equation (18), in [Saucan et al., Discrete Ricci curvatures for directed networks](https://arxiv.org/abs/1809.07698).
The directed transport quantity is asymmetric and is not a metric in the usual
symmetric sense. The source-parent representation retains its existing meaning.

Policy `ollivier-directed-in-out-unit-v1` supports two explicit idleness values:

- `zero` (default): distribute all mass uniformly over the specified neighbors;
- `half`: retain half at the endpoint and distribute half uniformly over neighbors.

An empty specified neighborhood places all mass at its endpoint, for either
idleness. This completes the definition at sources and sinks; it is an explicit
project convention, not a claimed prescription for empty neighborhoods in the
paper. The same fallback and incoming-source/outgoing-target convention appear
in the [GraphRicciCurvature reference code](https://graphriccicurvature.readthedocs.io/en/latest/_modules/GraphRicciCurvature/OllivierRicci.html).
Our frozen independent numerical check uses NetworkX, not that curvature package.

Source Weight, quantization, role and necessity are preserved through source
identity but do not set distances or probabilities. This stage implements unit
Ollivier only. It does not promote the stage-three weighted Forman hypothesis.

## Scope and disconnected graphs

The full Model Pack and complete source-parent projection are verified before
selection. `scope: {kind: "full"}` is the default and must fit the bounds below.
Larger models require an explicit `{kind: "induced", nodeIds: [...]}` scope.
All source edges between the selected nodes are included; `edgeIds` chooses
which of these edges to analyze, without removing other edges from distances.
The request records excluded node/edge counts and the count of edges crossing
the scope boundary. No automatic sampling or truncation occurs.

Distances and measures are recomputed within the induced scope. A fragment value
is consequently not a full-model value for that edge. Removing an outside path
or a neighbor can change it. Full source identity, source record hashes, the
explicit node set and scoped projection identity accompany every result.

Unrelated disconnected components and isolated scoped vertices are retained.
Every required support pair has a directed path via `i -> u -> v -> j`, with
endpoint terms omitted where appropriate. Thus a support distance is always an
integer from 0 to 3 under this policy, even in a DAG. Strong connectivity is
unnecessary. An unreachable required pair is an error; infinity, fabricated
large costs and undirected fallbacks are forbidden. Reverse transport need not
exist under the unchanged graph.

## Exact external transport

The [scientific adapter interface](../../packages/scientific-adapter/README.md)
provides the `id/version/method/evaluate` boundary. Ollivier has its own versioned
request/response contract; it is not a kernel closure Oracle response and is
never passed to kernel admissibility validation.

`prepareOllivierRequest(pack, input)` constructs ordered measures, integral mass
units and the directed cost matrix. A common denominator represents each measure
exactly. The Python standard-library oracle solves integer min-cost flow with
successive shortest augmenting paths and returns a transport matrix plus dual
potentials. It uses no floating point or entropic approximation.

JavaScript performs verification, not transport optimization. For each response:

1. replay the exact request from the expected pack and caller-supplied input;
2. verify solver/request identity and closed bounded response structure;
3. check nonnegative integral flows and both marginal sums;
4. check `a_i + b_j <= distance(i,j)` for every dual constraint;
5. require equality of primal cost, dual cost and reported numerator.

Feasibility and equal objectives prove an optimum. Checks use BigInt, and
Wasserstein values, curvature and summary means are reduced rational strings.
No tolerance or rounding policy is needed. An optimal plan need not be unique:
the packaged solver has deterministic iteration order, while the verifier accepts
any exact valid certificate. Different valid certificates can have different
artifact hashes while proving the same unique optimal value.

All node/edge request ID sets and measure supports use UTF-16 code-unit ordering.
Output values are deeply immutable. The Node adapter starts the packaged Python
script with isolated mode, no shell, bounded pipes and a deadline. The portable
entrypoint can prepare requests and verify certificates in a browser; executing
Python is an explicit Node operation.

| Bound | Value |
|---|---:|
| Scoped nodes / edges | 64 / 256 |
| Explicit analyzed edges | 1–32 |
| Nonzero support entries per measure | 16 |
| Transport cells per edge / request | 256 / 4096 |
| Common mass denominator | 512 |
| Absolute certificate potential | 4096 |
| Request / response / diagnostic pipe bytes | 1 MiB each |
| Node process deadline | 30 seconds maximum |
| Analyzer cache entries | 16 default; configurable 0–128 |

The existing canonical codec and full source projection bounds also apply.
Oversized graphs, malformed inputs, unsupported source relations, unknown IDs,
failed solvers and invalid certificates fail without a partial artifact.

## Identity and cache

Versioned canonical hash domains bind the policy (`structural-ollivier-policy`),
scoped projection (`structural-ollivier-projection`), request
(`structural-ollivier-request`), artifact (`structural-ollivier-artifact`) and
reference suite (`structural-ollivier-suite`), each under `onto2d:...:v1`.

Request identity includes the exact model ID, version, root and manifest,
complete source projection, scoped graph and record hashes, selection, idleness,
policy and solver identity. The bounded in-memory LRU cache uses this request
hash. Hits replay source preparation and verify cached certificates; failed
results never enter the cache. No persistent storage or network service is added.
Timing and cache hits do not enter artifacts.

## Verification and remaining gate

The [reference suite](../../cases/structural-geometry/ollivier/README.md) freezes
40 runs / 242 edge values: 18 synthetic graphs and two explicit source-bound
Causal Emergence fragments, each at both idleness values. An external NetworkX
3.2.1 run independently reconstructs measures and shortest paths, then uses its
[network simplex algorithm](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.flow.network_simplex.html)
with integer demands and costs. Its optimal values agree exactly. The recorded
version and algorithm source SHA-256 make the reference implementation identifiable.

Analytic controls and exhaustive tiny transport enumeration complement that
comparison. The same-endpoint-degree shortcut pair has unit Forman value 0 in
both graphs, while zero-idleness Ollivier changes from -2 to 0. This demonstrates
additional information on that constructed pair, not general predictive power.
Global edge reversal transposes corresponding unit transport problems and leaves
their optimum unchanged; reversing only a shortcut is a distinguishable control.

Computational stage 4 is complete within this bounded unit profile. Independent
scientific review, full-model scalability, metric usefulness and causal
interpretation remain unestablished. The subsequent [stage-five contract](SHADOW_FLOW.md)
implements rational weighted transport specifically for normalized shadow flow,
with separate length, normalization, stopping and benchmark policies.
