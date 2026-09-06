# Stage 3: typed filtration and local-weight experiments

Date: 2026-09-06. Status: adopted computational experiment contract.
The unit foundation and its frozen artifacts retain their original contract.

The [implemented R2 providers](METRIC_PROVIDERS.md) preserve the exact
`inverse-target-share-v1` ID and full-source context below. Necessity and typed
views remain selections/filtrations/channels, not implicit scalar metrics.
Existing artifacts are pinned in the [pre-regime baseline](BASELINE.md).

## Selection policy

`typed-source-parent-subgraph-v1` selects edges from the complete verified
`source-parent-directed-v1` projection. Every source node remains, including
isolated nodes. Every edge is accounted for as selected or excluded. Source
identity, full projection hash, normalized selection and selected graph hash
are bound in each experiment. Unsupported source layers, loops and parallel
edges still fail before selection; filtering cannot hide a malformed source.

- `all`: all edges.
- `necessity`, `through`: necessary; necessary + enabling; those + contextual;
  or all four categories including optional. Unknown/missing necessities fail.
- `roles`, `roles`: an explicitly selected nonempty subset of arising,
  maintenance and modulation. Arrays are canonical sets. Unknown/missing roles
  fail. Role sets form a subset lattice, not a scientifically privileged order.
  The reference suite includes all seven nonempty subsets.
- `channel`, `field`, `value`: a nonnegative integer code in `dependencyTypeId`,
  `interactionModeIds` or `causalDirectionIds`. Missing fields are excluded and
  reported separately; malformed present values fail. Array memberships are
  sets. An edge may occur in more than one channel, so channel counts must not
  be added as if they partitioned the graph. Codes remain local to this model.

Connectivity reports weak/strong component counts, cyclic node count and
isolated node count. They describe directed graphs, not persistent homology.
Necessary-to-optional transitions keep nodes and weights fixed and add edges.
Roles and multiplex views are separate axes, without category scalarization.

## Metric hypotheses and audit

Experiments require an explicit request (default selection `all`, metric
`unit-v1`). The second supported metric is `inverse-target-share-v1`:

```text
S(v) = sum of source weights on ALL incoming source edges of v
share(e: u -> v) = sourceWeight(e) / S(v)
length(e) = geometricEdgeWeight(e) = 1 / share(e)
vertexWeight(v) = 1
```

The normalization context is always the full source projection, even when
some edges are excluded by a selection. This keeps metric changes separate
from incidence changes across a filtration. Original values are never rewritten.
The source schema describes Weight as a relative contribution within a child's
parent population ([source definition](../../references/arising-schema.json)).
Inverse share is a modeling hypothesis, not calibrated distance or causal
strength. The three known non-unit incoming sums are disclosed, not repaired
in source data. There is no raw globally calibrated Weight policy or epsilon.

The audit reports each target's exact decimal sum, incoming edge IDs and
disposition, plus every missing, nonnumeric, zero, out-of-range or too-small
weight. This experiment admits weights from 0.000001 through 1. Invalid weights
make the weighted experiment fail with diagnostics; unit experiments and the
audit remain available. Nodes without parents have sum zero and no invented
denominator. The metric context hash binds all source lengths, not just selected
ones. Per-edge results include the exact rational length and the unit baseline.

## Directed curvature and deterministic numeric contract

Use equation (5) of [Saucan et al.](https://arxiv.org/abs/1809.07698), with unit
vertex weights and geometric edge weights equal to the declared lengths:

```text
F(e: u -> v) = 2
  - sum over a entering u of sqrt(length(e) / length(a))
  - sum over b leaving v of sqrt(length(e) / length(b))
```

Reciprocal edges contribute on both sides. Source number interpretation is the
exact decimal numeral in canonical JSON, not the original file's lexical
spelling or a claim of exact measured data. Ratios use reduced BigInt fractions.
For a ratio N/D, integer square root gives outward bounds on each radical at
scale 10^12. The lower integer q satisfies `q^2 D <= N 10^24 < (q+1)^2 D`.
The upper bound is q for an exact root, otherwise q+1. Subtraction reverses
the bounds; sums never round inward. Transport stores integer ticks as strings.
No platform-dependent floating square root enters identity-bearing output.

Intervals are computational bounds under the chosen decimal interpretation,
not confidence intervals. A sign is negative/positive only when the entire
interval has that sign; an exact [0,0] is zero, otherwise it is unresolved.
Comparison against the unit baseline likewise distinguishes lower, higher,
equal and overlapping. Means retain a count denominator. Minimum/maximum
intervals use componentwise minima/maxima; no arbitrary ordering of overlapping
intervals or precision-as-significance claim is made.

## Identity, resource and acceptance boundary

New `structural-metric-experiment` and `structural-weight-audit` artifacts bind
model ID/version/root/manifest, source projection, complete policies and hashes,
algorithm version, parameters and numeric contract. Replay requires the source
pack and the expected request. The initial full-model policy limits and canonical
codec bounds apply. A separate 100000 selected-incidence operation cap bounds
experiment work, including its unit baseline; exceeding it fails, with no
partial result. Suite manifests hold
artifact hashes and summaries; each full run is checked separately.

Acceptance requires nested membership checks, isolated-node retention, role and
overlapping-channel controls, exact audit anomalies, context preservation under
selection, local weight-rescaling invariance, source replay and tamper tests.
A separate Python Decimal/Fraction implementation checks weighted intervals on
small controls and the full-model experiment. No default metric is promoted:
descriptive agreement and sensitivity are not evidence of improved robustness,
interpretability, prediction or cross-domain equivalence.
