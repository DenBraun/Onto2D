# SG2-004: fixed supplemental flow controls

This protocol was written before generating or accepting the new runtime
artifacts. It freezes the [graphs, inputs and expectations](protocol.json), SHA-256
`52aa6ac26060a17ab17bcd99e31a1ffd3027c88ee5d9d5fa06b68325562f02c6`.
It is a local computational control protocol, not external preregistration.
Any changed graph, setting or hypothesis requires a separately reviewed version;
retain a failed expectation instead of adjusting this fixture to its output.

The existing [flow policy](../../../docs/structural-geometry/SHADOW_FLOW.md)
applies without changes: uniform predecessors to successors, endpoint Dirac
fallback, simultaneous updates, directed shortest-endpoint closure, and total
length equal to the number of scoped arcs. Every run uses the full declared
synthetic graph, exact rational arithmetic, tolerance `1/10^30` and two stable
transitions. The supplied source records and the original 11-run suite remain
unchanged. Source weights do not enter these controls.

## Directed stars

Use four leaves and one center, with all four arcs pointing inward or outward.
For each direction, run all four combinations of step `half`/`one` and idleness
`zero`/`half`. Initial lengths, indexed by leaf 1–4, are `1,2,3,4`; cap eight
transformations; no cut. Unequal lengths test preservation of relative geometry
as well as initial mean-one normalization.

Every arc has a source with no predecessors and a target with no successors.
Thus both measures are endpoint Dirac masses, at either idleness, and there is
no alternative directed path between its endpoints. Consequently `W=l`,
`kappa=0` and either step preserves the metric. The exact expected normalized
lengths are `2/5,4/5,6/5,8/5`. Each run must stop at `fixed-point`, iteration 1,
with two stored states. This also explains the unit-length case analytically.

## Two K4 groups and a single bridge

Use vertices `a0..a3` and `b0..b3`. Each group is complete, and `a0--b0` is the
only connection between groups. Every undirected edge is encoded by reciprocal
arcs: eight vertices and 26 arcs. All initial lengths are one. Fix step `one`,
idleness `zero`, cap 16 transformations, and a final strict length threshold 2.
These settings permit an exact small-graph transport derivation and match the
step/idleness/cap/cut of the existing published control. They are not selected
by a search over separation scores. This is a separate barbell control, not an
application of the published `G(a,b)` theorem outside its stated parameter range.

By symmetry there are three length classes: bridge `B` (2 arcs), gateway to
another vertex within its group `S` (12 arcs), and the remaining within-group
edges `I` (12 arcs). Starting at `(1,1,1)`, the unnormalized transport costs are:

```text
W_B = B/2 + 3*S/2
W_S = B/4 + S/12 + I/6
W_I = I/3
factor = 26 / (2*W_B + 12*W_S + 12*W_I)
(B,S,I)_next = factor * (W_B,W_S,W_I)
kappa_class = 1 - W_class / length_class
```

Here `I <= 2*S`, so the direct edge lengths are shortest endpoint distances.
That inequality holds initially and is preserved: `I_next_raw = I/3` and
`2*S_next_raw = B/2 + S/6 + I/3`. All raw lengths stay positive, closure makes
no change, and normalization preserves the inequality.

The costs have explicit optimality witnesses independent of the runtime solver:

- Bridge: send `1/4` from left internal vertices to the left gateway, `1/4`
  from the right gateway to right internal vertices, and the remaining `1/2`
  across both spokes and the bridge. A 1-Lipschitz potential takes values
  `S+B/2, B/2, -B/2, -S-B/2` on left internals, left gateway, right gateway,
  right internals. Its expectation difference is `3*S/2+B/2`.
- Gateway `u` to internal `v`: keep common mass `1/4` at each of the other
  two internal vertices; send `1/4` from the opposite gateway to `u`, `1/12`
  from `v` to `u`, and `1/12` from `v` to each remaining internal vertex.
  The cost is `B/4+S/12+I/6`. A matching potential is `0` at `u`, `S` at `v`,
  `S-I` at the other two internal vertices, and `B` throughout the opposite
  group. The condition `I <= 2*S` makes it 1-Lipschitz.
- Internal edge: the two measures share `2/3` of their mass; the remaining
  `1/3` travels between its endpoints at distance `I`. A matching potential
  is `0` at the source, `I` at the target and `I/2` everywhere else.

Reciprocal arcs have equal costs because the metric is symmetric. Feasible
transport with a matching Lipschitz lower bound establishes each optimum.
The recurrence, implemented separately using Python `Fraction`, predicts the
whole trajectory without a graph/transport library or runtime imports.

The first transformed class lengths must be `26/7,13/14,13/21`; this is a simple
exact anchor before checking the later recurrence. The declared finite contrast
is `B > 2`, `S < 2`, `I < 2` at state 16. A strict final cut should therefore
remove exactly `a0->b0` and `b0->a0`, recovering the two known four-node groups.
Record the actual stopping reason. Reaching the cap is not convergence.

## Acceptance and limits

Check every state against the analytic expectation and an independent NetworkX
3.2.1 replay using Dijkstra paths and integer-scaled network simplex. Verify
normalization, stopping and final connectivity as well as per-edge values.
The production verifier must bind all results to the expected source and input.
Tests also change parameters, source topology and certificates, and exercise
the exact cut boundary. Keep these nine trajectories in their own suite.

These are selected synthetic arithmetic/behavior controls. They establish no
general community-detection accuracy, asymptotic convergence, cross-domain
equivalence or added value over graph/response baselines. The stars intentionally
show that directed branching alone does not imply nonzero in/out curvature.
