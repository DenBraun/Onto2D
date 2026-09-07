# Structural Geometry — Geometry

- [Structural Geometry terms](#structural-geometry-terms)
- [Representation policies](#representation-policies)
- [Metric and algorithm policies](#metric-and-algorithm-policies)
- [typed filtration and local-weight experiments](#typed-filtration-and-local-weight-experiments)
- [compatible metric providers](#compatible-metric-providers)
- [Directed Ollivier reference contract](#directed-ollivier-reference-contract)

<a id="structural-geometry-terms"></a>

## Structural Geometry terms

| Term | Meaning and implementation status |
|---|---|
| Verified Model Pack | A complete v1 pack reconstructed by the existing verifier, including its semantic files, indexes and manifest |
| Structural projection | An immutable, policy-bound directed graph derived from that exact pack; no inferred edges |
| Structural metric | An explicit intra-graph assignment of lengths/weights; unit and experimental inverse-target-share policies exist |
| Shadow geometry | Derived geometric data that never overwrites source weights, requirements, evidence, IDs or relations |
| Directed Forman curvature | The non-augmented incoming-at-source/outgoing-at-target edge statistic defined in the metric policy |
| Structural flow | Implemented bounded rational evolution of separate edge lengths with metric closure, normalization, certificates and explicit stopping |
| Topological persistence | A future invariant of a specified filtered construction, distinct from graph curvature and statistical significance |
| Metric provider | Planned explicit producer of metric values or capability-tagged filtrations/channels; it preserves existing policy/context semantics |
| Distinguishability regime | Planned versioned declaration of observable differences, matching/invariance, probes, missingness and aggregation |
| Intra-graph geometry | Lengths, directed path distances, curvature and flow within one scoped graph |
| Inter-structure geometry | Planned comparison of two structures through compatible complete regime signatures |
| Invariance probe | A declared transformation whose scientific descriptor should remain unchanged under a particular regime; provenance may change |
| Response probe | A controlled shadow transformation whose declared graph response is measured; not automatically a physical intervention |
| Response signature v0 | Planned graph-native finite response profile with separate coverage; baseline excludes curvature and flow |
| Geometric signature v1 | Planned separate curvature/flow descriptors tested for added value over response-only |
| Structural pseudometric | Planned fixed-domain symmetric distance between signatures; zero may join different structures observationally |
| Indeterminate comparison | Mandatory information is unavailable, incompatible or unresolved; no complete distance or equality claim |
| Partial comparison | Exploratory available-component diagnostic with coverage; no automatic pseudometric or equivalence guarantee |
| Structural signature | An explicitly layered descriptor contract, not one universal similarity scalar or semantic identity |
| Candidate structural analogue | A hypothesis about comparable organization that requires reviewed domain evidence and baselines |

`source-parent` records the relation supplied by a catalogue. Its field names
such as `causalDirections` do not establish reviewed causal or generative
semantics. Model verification checks integrity, not scientific truth.

An edge length is not a physical distance or a causal strength. Unit lengths
can induce directed path distances, including unreachable pairs. Ollivier and
flow compute the finite directed support distances required by their bounded
profiles; these are not the planned symmetric inter-structure pseudometric.
Scientific status and evidence stay epistemic annotations, independent of metric
weights. Source/artifact identity is distinct from regime-relative equality.

The [revised design](RESEARCH.md) fixes these distinctions before
providers or comparisons are implemented. Distinguishability is an analytical
proposal and catalogue motif, not an empirically established origin of space.

<a id="representation-policies"></a>

## Representation policies

<a id="representation-policies--source-parent-directed-v1-version-1"></a>

### `source-parent-directed-v1`, version `1`

This closed policy replaces the proposal's provisional `causal-directed-v1`
name. The current Causal Emergence release contains source-parent relations,
including known source findings, rather than reviewed causal relations.

The policy consumes the complete verified v1 model. Every node and every edge
is represented once with its original ID and endpoints. Each edge must have
`relationLayer: "source-parent"`. Other layers, self-loops and parallel edges
with the same ordered endpoints fail explicitly. Reciprocal edges are allowed.
There is no silent filtering, symmetrization, fragment scope, condensation,
inferred hyperedge or induced simplex. Missing categories are preserved as
missing; all declared necessities and ontological roles are included.

Projection nodes retain, when present: `level`, `phase`, `phaseId`, `typeRole`,
`typeRoleId`, `scienceIds`, `scientificStatus`, and `requirements`.
Projection edges retain, when present: `relationLayer`, `causalDirections`,
`causalDirectionIds`, `interactionModes`, `interactionModeIds`, `weight`,
`necessity`, `dependencyType`, `dependencyTypeId`, `ontologicalRole`, and
`quantization`. Values are copied without recoding or repair. Preserving these
typed channels does not validate their scientific interpretation or dictionary
consistency. Unknown source fields remain in the source record, not in the
projection's closed attribute profile.

Each projected record contains a `sourceRecordHash` over the entire original
record (domain `onto2d:structural-source-record:v1`, input `{kind, record}`).
Names, descriptions, evidence and layout coordinates are excluded from geometry;
they remain traceable through the original ID, record hash and exact pack.
Local dictionary codes acquire meaning only within that exact pack.

The canonical projection body contains `schemaVersion`, `model`, `policy`,
`policyHash`, `nodes` and `edges`. Nodes and edges sort by original ID using
UTF-16 code-unit order, as in Model Pack v1. `projectionHash` hashes that body
under `onto2d:structural-projection:v1`. The model binding always includes
`modelId`, `modelVersion`, `modelRootHash` and `manifestHash`; a semantic root
alone does not pin a release manifest. The complete policy is hashed under
`onto2d:structural-projection-policy:v1`.

V1 permits at most 4096 nodes and 16384 edges, with the existing canonical
codec's 100000-entry, depth and string bounds also applying. Exceeding a bound
fails; a partial graph is never reported as a complete result. Input size limits
are not a guarantee that every graph below the count bounds fits the codec.

<a id="representation-policies--replay-and-invariance"></a>

### Replay and invariance

Public projection and analysis calls verify a Model Pack before consuming it.
The engine bridge reconstructs the pack from its Model and checks its exact
manifest. Verification of a stored projection or result requires the source
pack and recomputes the complete expected object; matching a self-declared hash
is insufficient. Input objects and verified results remain immutable.

Reordering input records before building a pack, or changing JSON key order,
preserves canonical output. Relabeling IDs gives equivariant numerical results
after mapping IDs back, but deliberately changes source and artifact hashes.
Changing labels or source annotations also changes provenance, even when
curvature is unchanged. Relabeling is not exact artifact identity. Edge
subdivision, fragment boundaries and added neighbors need not preserve values.

Future [distinguishability regimes](RESEARCH.md) may compare
separate invariant descriptors under declared matching rules. They do not change
this source/projection identity policy or make Model Pack canonical serialization
an unlabeled graph-isomorphism algorithm. Conditional abstraction probes require
their own reviewed rules; source-parent annotations are not automatically causal.

<a id="metric-and-algorithm-policies"></a>

## Metric and algorithm policies

This page defines the original unit foundation. The separate
[typed experiment contract](#typed-filtration-and-local-weight-experiments) adds typed selections
and an optional local inverse-share metric with deterministic interval bounds.
It does not change these policies or their frozen artifacts.
The separate [Ollivier contract](#directed-ollivier-reference-contract) defines directed unit
transport, idleness, scope boundaries and exact external-solver certificates.

The [revised provider design](RESEARCH.md) will wrap these
policies without changing their IDs, numeric semantics or v1 output. A provider
is an explicit implementation/context boundary, not a scientific justification
by itself. Filtration/channel outputs and inter-structure pseudometrics remain
distinct from positive intra-graph edge lengths. Provider APIs are planned.

<a id="metric-and-algorithm-policies--unit-v1-version-1"></a>

### `unit-v1`, version `1`

Every projected vertex has weight 1, every edge has weight 1 and length 1.
Source `weight` and `quantization` are retained for traceability and never used
as distance, strength, confidence or curvature coefficients. Necessity, roles,
levels and scientific status are not scalarized. The full metric policy is
bound under `onto2d:structural-metric-policy:v1`.

<a id="metric-and-algorithm-policies--forman-directed-unit-version-1"></a>

### `forman-directed-unit`, version `1`

Use the non-augmented directed definition of Saucan et al., equation (5):
incoming edges at the **source** and outgoing edges at the **target** contribute
to the edge neighborhood. With all weights equal to one, for `e: u -> v`:

```text
F(e) = 2 - indegree(u) - outdegree(v)
```

A reciprocal `v -> u` edge contributes once on each side. Loops and parallel
edges are rejected by the initial projection policy, so no loop convention or
multiplicity interpretation is implicit. The derivation and node aggregates
follow [Saucan et al., Discrete Ricci curvatures for directed networks,
equations (5)–(8)](https://arxiv.org/abs/1809.07698).

For each vertex, report the sum on incoming edges, the sum on outgoing edges,
and their difference `balance = incomingCurvature - outgoingCurvature`.
The word balance describes arithmetic; it does not assert conservation of a
physical quantity. Each edge reports its two contributing endpoint degrees.
All curvature arithmetic is integer and exact within the declared bounds.

Distribution summaries contain count, sum, minimum, maximum and an exact mean
represented as `{numerator: sum, denominator: count}`. Empty populations have
sum zero, null extrema and null mean. Histograms sort by increasing curvature.
Grouped summaries use source level, target level, dependency type, necessity and
ontological role as separate channels. Missing attributes have an explicit
`present: false` group, distinct from a declared null value. Extrema list all
tied edge IDs in canonical order, without a hidden top-k cutoff.

The closed request selects the two policy IDs and has no tunable parameters.
Artifacts include the complete policies and their hashes, exact model binding,
projection hash, algorithm ID/version, empty `parameters` and its hash, result,
and `artifactHash`. Hash domains are `onto2d:structural-geometry-parameters:v1`
and `onto2d:structural-geometry-artifact:v1`. Timestamps, execution environment
and wall time are excluded. Transport shape checks never replace source replay.

<a id="metric-and-algorithm-policies--mathematical-limits-of-the-baseline"></a>

### Mathematical limits of the baseline

Unit curvature is exactly determined by the ordered endpoint degree pair. It
cannot add information beyond a baseline containing those same degrees. A
positive later result must identify information added by a different metric,
algorithm or representation, and compare it against an adequate degree baseline.

Reversing every edge preserves the curvature of its corresponding reversed
edge: indegree and outdegree exchange together. Node incoming/outgoing sums
exchange and balance changes sign. Reversing a path is also an isomorphism;
it cannot be required to have a distinct curvature distribution. A feed-forward
triangle and a directed cycle do provide a useful same-undirected-graph control.
These are consequences of the declared equation, not universal properties of
all directed curvature definitions.

<a id="typed-filtration-and-local-weight-experiments"></a>

## typed filtration and local-weight experiments

The unit foundation and its frozen artifacts retain their original contract.

The [implemented providers](#compatible-metric-providers) preserve the exact
`inverse-target-share-v1` ID and full-source context below. Necessity and typed
views remain selections/filtrations/channels, not implicit scalar metrics.
Existing artifacts are pinned in the [pre-regime baseline](EVIDENCE.md).

<a id="typed-filtration-and-local-weight-experiments--selection-policy"></a>

### Selection policy

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

<a id="typed-filtration-and-local-weight-experiments--metric-hypotheses-and-audit"></a>

### Metric hypotheses and audit

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

<a id="typed-filtration-and-local-weight-experiments--directed-curvature-and-deterministic-numeric-contract"></a>

### Directed curvature and deterministic numeric contract

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

<a id="typed-filtration-and-local-weight-experiments--identity-resource-and-acceptance-boundary"></a>

### Identity, resource and acceptance boundary

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

<a id="compatible-metric-providers"></a>

## compatible metric providers

Implemented under [Documentation](GEOMETRY.md).
The [evidence](EVIDENCE.md) and research plan track acceptance.

<a id="compatible-metric-providers--public-boundary"></a>

### Public boundary

Add `@onto2d/structural-geometry/providers` inside the existing package. Keep
the root, experiments, Ollivier and flow exports and all closed v1 artifacts.
No external provider plugins, response-derived lengths, regimes or UI are part
of this contract. A provider supplies positive edge costs or discrete views;
these are not inter-structure distances or scientific confidence values.

`createStructuralMetricContext(pack)` verifies and snapshots the complete Model
Pack and its projection. It returns a frozen context containing `projection`
and a serializable `binding`. The context has a private runtime brand: a copied
or deserialized binding is not authority to declare a source verified. Recreate
a context from the expected pack when replaying. The binding records the model,
full source projection, projection policy, full-source normalization rule and
an explicit hash of the model-local dictionaries.

`createStructuralMetricProvider(id)` returns an immutable descriptor and
`build(projection, context, parameters)` method. The projection must match the
context's complete verified projection exactly. `buildStructuralProvider(pack,
request)` is the convenience entrypoint, and `verifyStructuralProviderArtifact`
rebuilds against an expected pack and request. No caller-supplied self-hash or
lookalike context substitutes for source verification.

| Provider ID | Output capability | Parameters and compatibility |
|---|---|---|
| `unit-v1` | `metric-values` | Empty parameters; unit rational vertex/edge weights and positive edge lengths, source weights ignored |
| `inverse-target-share-v1` | `metric-values` | Empty parameters; original weight audit and exact decimal interpretation, full-source incoming denominator, unit vertex weights and edge weights equal to lengths |
| `necessity-filtration-v1` | `filtration` | Empty parameters; all four nested necessary → enabling → contextual → optional stages, with every source node retained |
| `role-subset-v1` | `selection` | Explicit nonempty unique `roles`; canonical set order; original category validation and accounting |
| `typed-channel-v1` | `channels` | One supported `field` and 1–32 unique nonnegative integer `values`; numerically sorted channels; original overlapping membership and missing-field accounting |

All providers retain the original projection and selection-policy semantics.
Typed codes remain local to the bound dictionaries; unknown requested codes
can yield empty selections under the existing policy. A dictionary hash does
not assert a cross-model vocabulary mapping. Invalid category/weight data
cannot be hidden by selecting away its edges. Metric context hashes bind every
source length before selection, exactly as in the original experiments.

`requireStructuralMetricValues(artifact, pack, request)` verifies the artifact
and rejects filtration/selection/channel capabilities when a consumer requires
lengths. There is no implicit ordinal length for necessity or mixture of channels.
The raw costs need not equal shortest endpoint distances; a flow consumer still
performs its own metric closure and normalization.

<a id="compatible-metric-providers--additive-analysis-envelope"></a>

### Additive analysis envelope

`analyzeStructuralGeometryWithProvider(pack, request)` accepts an explicit
`analysis` and `metricProviderId`, with an optional experiment `selection`:

- `structural-geometry`: `unit-v1` only, no selection;
- `structural-metric-experiment`: either metric provider and any existing
  selection (default `all`). A selected view is produced by its explicit view
  provider; necessity references the requested stage of the complete filtration.

The result binds the normalized request, context, metric provider artifact,
optional view provider artifact, and **unmodified legacy artifact**. It has its
own `structural-provider-analysis` identity and hash. The existing unit
integer results and weighted outward intervals are preserved in that legacy
artifact, not converted to another numeric representation.

`verifyStructuralProviderAnalysis` replays the full envelope from expected
sources and request. Opt-in engine definitions are
`createStructuralMetricProviderAnalysis()` (raw provider output) and
`createStructuralProviderAnalysis()` (analysis envelope). Both require the
authentic engine Model bridge. The portable entrypoint has no filesystem,
Python process or browser-global dependency.

<a id="compatible-metric-providers--compatibility-matrix"></a>

### Compatibility matrix

| Existing path | Provider treatment |
|---|---|
| Root unit Forman | Reproduced byte for byte inside the additive analysis envelope |
| 72 typed/local-weight experiments | Shared original selection/audit/metric functions; provider envelope preserves exact legacy output, selection, normalization context and intervals |
| Unit Ollivier | Existing API/policy and all 40 artifacts remain unchanged; provider unit values agree on every scoped edge, with existing scope/support bounds retained |
| Shadow flow | Existing API/policy and all 20 original/supplemental trajectories remain unchanged; explicit initial lengths and flow normalization remain separate operations |

The provider contract does not replace Ollivier's unit transport policy with arbitrary costs or
override explicit flow initial lengths. Raw metric outputs can supply lengths
to an explicitly declared compatible consumer. Such an integration must retain
its scope and initialization policy; merely attaching a provider does not
authorize a changed transport measure or flow request.

<a id="compatible-metric-providers--identity-bounds-and-acceptance"></a>

### Identity, bounds and acceptance

New closed schemas describe the descriptor, serializable context binding,
provider input/artifact and analysis input/artifact. Versions remain string
`"1"`. All declarations and nested outputs are readonly. Hash domains are
`onto2d:structural-provider-{descriptor,dictionaries,context,artifact,analysis}:v1`.
The existing metric, selected-projection and metric-context hashes retain
their original domains and values.

Projection/source codec limits still apply. The new envelope profile permits
at most 4096 nodes, 16384 source edges, 32 views, 32768 total selected view-edge
occurrences, 500000 canonical entries and 8 MiB per artifact. No truncation or
partial success is allowed. Legacy Forman incidence and Ollivier/flow work
bounds apply independently to their own analyses.

Acceptance requires byte-identical legacy replay, full-source weight context,
fixed nodes/nested necessities/overlapping channels, explicit capability
rejection, source/context/input tampering tests, immutable snapshots, browser
and engine parity, closed schema/TypeScript checks and numeric references.
The original baseline and nine supplemental flow artifacts are preserved.
Run the complete repository tests/build after implementation and record the
actual evidence for this implemented provider contract.

<a id="directed-ollivier-reference-contract"></a>

## Directed Ollivier reference contract

<a id="directed-ollivier-reference-contract--definition"></a>

### Definition

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
Ollivier only. It does not promote the weighted Forman hypothesis.

<a id="directed-ollivier-reference-contract--scope-and-disconnected-graphs"></a>

### Scope and disconnected graphs

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

<a id="directed-ollivier-reference-contract--exact-external-transport"></a>

### Exact external transport

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

<a id="directed-ollivier-reference-contract--identity-and-cache"></a>

### Identity and cache

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

<a id="directed-ollivier-reference-contract--verification-and-remaining-gate"></a>

### Verification and limits

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
interpretation remain unestablished. The [shadow-flow contract](SHADOW_FLOW.md)
implements rational weighted transport specifically for normalized shadow flow,
with separate length, normalization, stopping and benchmark policies.
