# `@onto2d/structural-geometry`

Read-only directed geometry of a complete verified Onto2D Model Pack. The initial
research implementation supports a closed `source-parent-directed-v1` projection
and `unit-v1` metric. It returns deterministic projections and non-augmented
directed Forman curvature with exact source replay.

```js
import {
  analyzeStructuralGeometry,
  projectStructuralGeometry,
  verifyStructuralGeometryArtifact
} from "@onto2d/structural-geometry";

const projection = projectStructuralGeometry(pack);
const artifact = analyzeStructuralGeometry(pack);
const checked = verifyStructuralGeometryArtifact(artifact, pack);
console.log(checked.result.summary);
```

`pack` must be a complete v1 Model Pack. Every public computation verifies it.
`verifyStructuralProjection(projection, pack)` and the artifact verifier replay
the full expected value from that pack; a supplied artifact is never its own
source authority. All outputs are deeply frozen. Unknown request fields or
unsupported policy IDs fail. Explicit selection is equivalent to the defaults:

```js
const artifact = analyzeStructuralGeometry(pack, {
  projectionPolicyId: "source-parent-directed-v1",
  metricPolicyId: "unit-v1"
});
```

## Engine registration

```js
import { Onto2D } from "@onto2d/engine";
import { structuralGeometryAnalysis } from "@onto2d/structural-geometry";

const engine = await Onto2D.create({
  models: [pack],
  model: `${pack.manifest.model.id}@${pack.manifest.model.version}`,
  analyses: [structuralGeometryAnalysis]
});
const artifact = await engine.analyze("structural-geometry", {});
```

Registration is explicit. The engine bridge reconstructs and checks the exact
source manifest; workspace labels or caller-supplied resolution metadata do not
replace source identity. The root and experiment entrypoints use portable code.
External Ollivier execution is isolated in its explicit Node subpath below.
The repository preview is not yet published.

The [revised R0–R12 plan](../../docs/structural-geometry/REVISED_ROADMAP.md) keeps
these analyses in this package. Providers are implemented below; regimes,
probes and comparative signatures remain planned. Existing entrypoints and
frozen v1 artifacts retain their exact policies and numeric representation.

## Metric providers

The portable `/providers` entrypoint supplies explicit numeric or discrete
capabilities over a verified full-source context:

```js
import {
  createStructuralMetricContext,
  createStructuralMetricProvider,
  analyzeStructuralGeometryWithProvider,
  verifyStructuralProviderAnalysis
} from "@onto2d/structural-geometry/providers";

const context = createStructuralMetricContext(pack);
const provider = createStructuralMetricProvider("unit-v1");
const metric = provider.build(context.projection, context);
console.log(metric.result.edges);

const request = {
  analysis: "structural-metric-experiment",
  metricProviderId: "inverse-target-share-v1",
  selection: { kind: "necessity", through: "enabling" }
};
const envelope = analyzeStructuralGeometryWithProvider(pack, request);
const checked = verifyStructuralProviderAnalysis(envelope, pack, request);
console.log(checked.legacyArtifact.result.summary);
```

`unit-v1` and `inverse-target-share-v1` produce positive rational lengths and
weights. `necessity-filtration-v1` produces four nested views. `role-subset-v1`
accepts `{roles}`; `typed-channel-v1` accepts `{field, values}` and preserves
overlapping channel membership. Those three discrete capabilities supply no
lengths. `requireStructuralMetricValues(artifact, pack, request)` verifies a
numeric result and rejects discrete capabilities for length consumers.

Contexts snapshot the complete source and bind local dictionaries. A copied
context object cannot declare itself verified; recreate it from the expected
pack. Weight denominators use all incoming source edges even when the legacy
experiment selects a subset. The envelope carries the exact original artifact
alongside provider identity, with a separate hash. The original APIs still
return their original output directly.

`buildStructuralProvider(pack, request)` and `verifyStructuralProviderArtifact`
are raw-output convenience functions. Opt-in engine registration uses
`createStructuralMetricProviderAnalysis()` for `structural-metric-provider`
and `createStructuralProviderAnalysis()` for `structural-provider-analysis`.
No provider is registered automatically. See the [contract](../../docs/structural-geometry/METRIC_PROVIDERS.md)
and [seven examples](../../cases/structural-geometry/providers/README.md).

## Distinguishability contract preparation

The portable `/regimes` entrypoint exposes three frozen observation contracts
and source-bound preparations. Exact canonical and typed profiles allow six
nodes; the lossy topology summary allows 64. All retain direction and explicitly
bind their matching, vocabulary and work limits.

```js
import { prepareStructuralRegime, verifyStructuralRegimePreparation }
  from "@onto2d/structural-geometry/regimes";

const request = { regimeId: "canonical-structure-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] } };
const preparation = prepareStructuralRegime(pack, request);
verifyStructuralRegimePreparation(preparation, pack, request);
```

Scope defaults to the complete source; oversized graphs require explicit induced
membership. Preparation verifies the complete pack and records all internal,
incoming, outgoing and external edges. It has `evaluation: "not-run"`, no
measured observations and no comparison distance or status. Engine registration
uses `createStructuralRegimePreparationAnalysis()` explicitly. See the
[contract](../../docs/structural-geometry/REGIME_CONTRACTS.md) and
[six examples](../../cases/structural-geometry/regimes/README.md).

## Exact canonical observations

The `/canonical` entrypoint now computes the exact untyped observation:

```js
import { observeCanonicalStructure, verifyCanonicalStructureObservation }
  from "@onto2d/structural-geometry/canonical";

const request = { regimeId: "canonical-structure-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] } };
const observation = observeCanonicalStructure(pack, request);
verifyCanonicalStructureObservation(observation, pack, request);
console.log(observation.observation.valueHash);
```

The measured artifact preserves the original preparation, adds directed
canonical adjacency and complete source node/edge mappings, and excludes source
labels and attributes from the observed value. Exact matching is limited to
six nodes and 30 edges. Engine registration uses
`createCanonicalStructureObservationAnalysis()` explicitly. This observation
does not contain a comparison status, distance or response signature. See the
[contract](../../docs/structural-geometry/CANONICAL_OBSERVATIONS.md) and
[17 examples](../../cases/structural-geometry/canonical/README.md).

## Directed topology observations

The `/topology` entrypoint measures the frozen seven-observable profile:

```js
import { observeStructuralTopology, verifyStructuralTopologyObservation }
  from "@onto2d/structural-geometry/topology";

const request = { regimeId: "topology-only-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] } };
const topology = observeStructuralTopology(pack, request);
verifyStructuralTopologyObservation(topology, pack, request);
console.log(topology.observation.value);
```

Values contain node/edge counts, sorted weak/strong component sizes, distinct
nonself reachable ordered pairs, cyclic nodes and isolates. The full source is
verified before scoping; source attributes and diagnostic memberships remain
outside observation coordinates. Bounds are 64 nodes, 256 edges and 4,096
source/target visits including self seeds. Register
`createStructuralTopologyObservationAnalysis()` explicitly with an engine.

Equal summaries can describe nonisomorphic graphs; reversing every edge always
preserves this profile. The [contract](../../docs/structural-geometry/TOPOLOGY_OBSERVATIONS.md)
and [23 examples](../../cases/structural-geometry/topology/README.md) document
independent matrix checks and explicit collisions against exact canonical
analysis. This API measures one graph and supplies no comparison result or
response signature.

## Typed observations and vocabulary alignment

The `/typed` entrypoint measures the two frozen `typed-relations-v1` observations:

```js
import { observeTypedRelations, verifyTypedRelationsObservation }
  from "@onto2d/structural-geometry/typed";

const request = { regimeId: "typed-relations-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] } };
const typed = observeTypedRelations(pack, request);
verifyTypedRelationsObservation(typed, pack, request);
console.log(typed.observations[1].availability);
```

One node bijection preserves directed edges and all five fields together:
dependency type, interaction modes, role, necessity and causal directions.
Explicit empty sets remain observed; absent fields leave a null typed result
with scoped evidence gaps and the untyped observation retained. Every present
field in the full source is validated. Bounds remain six nodes and 30 edges.
Engine integration uses `createTypedRelationsObservationAnalysis()` explicitly.

Canonical raw-code hashes do not establish cross-source semantic equality.
`createStructuralVocabularyMapping()` binds exact source endpoints and an
explicit declaration; it does not approve that declaration. `alignTypedRelations()`
requires the same exact source vocabulary or an externally approved mapping hash,
complete scoped coverage and joint recanonicalization after translation. It
supplies compatible/unresolved alignment with no final comparison or distance.
See the [contract](../../docs/structural-geometry/TYPED_OBSERVATIONS.md) and
[cases](../../cases/structural-geometry/typed/README.md).

## Stage-three experiments

The separate `@onto2d/structural-geometry/experiments` entrypoint adds typed
selections, an incoming-weight audit and an optional inverse-target-share metric:

```js
import {
  analyzeStructuralMetricExperiment,
  auditStructuralWeights,
  verifyStructuralMetricExperiment,
  structuralMetricExperimentAnalysis
} from "@onto2d/structural-geometry/experiments";

const audit = auditStructuralWeights(pack);
const request = {
  selection: { kind: "necessity", through: "enabling" },
  metricPolicyId: "inverse-target-share-v1"
};
const experiment = analyzeStructuralMetricExperiment(pack, request);
const checked = verifyStructuralMetricExperiment(experiment, pack, request);
```

Register `structuralMetricExperimentAnalysis` explicitly to call
`engine.analyze("structural-metric-experiment", request)`. Other selections are
`{kind: "all"}`, `{kind: "roles", roles: ["arising", "maintenance"]}`, and
`{kind: "channel", field: "dependencyTypeId", value: 10}`. Missing channel
fields are accounted for; malformed present codes and unknown categories fail.

The default experiment metric is unit; inverse target share is an experimental
hypothesis with fixed full-source normalization. Every source node remains.
Weighted output carries outward bounds in integer-string ticks at 10^-12,
not raw floating point scalars or confidence intervals. The full source weight
audit is replayable with `verifyStructuralWeightAudit(audit, pack)`. Invalid
weights block only weighted computation, with no epsilon substitution.
See the [contract](../../docs/structural-geometry/METRIC_EXPERIMENTS.md) and
[72-run reference suite](../../cases/structural-geometry/experiments/README.md).

## Certified external Ollivier

`@onto2d/structural-geometry/ollivier` prepares bounded directed transport requests
and verifies exact optimality certificates. Python 3.9+ is needed only to execute
the external reference through `@onto2d/structural-geometry/ollivier/node`:

```js
import {
  createOllivierAnalyzer, verifyOllivierArtifact
} from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";

// These node/edge IDs refer to the bundled Causal Emergence source.
const input = {
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2", "0.3"] },
  edgeIds: ["0.0->0.1", "0.1->0.3"],
  idleness: "zero"
};
const analyzer = createOllivierAnalyzer(createPythonOllivierAdapter(), { maxCacheEntries: 16 });
const artifact = await analyzer.analyze(pack, input);
const checked = verifyOllivierArtifact(artifact, pack, input);
console.log(checked.result.edges);
```

`prepareOllivierRequest(pack, input)` exposes the exact transport problems;
`acceptOllivierResponse(response, pack, input)` validates an external response and
constructs an artifact. Both require the independently supplied expected pack
and input. The response's self-reported identity is insufficient. Reduced rational
strings represent values; primal/dual equality proves optimal transport exactly.

`createOllivierAnalysis(adapter, options)` can be registered with the engine to
call `engine.analyze("structural-ollivier", input)`. Registration starts no process;
analysis is explicit. The cache is bounded, uses exact request identity, verifies
on read, and has `analyzer.clearCache()`. Set `maxCacheEntries: 0` to disable it.
Python adapter options are `pythonExecutable` and `timeoutMs` (1–30000).

Default scope is full, subject to 64 nodes / 256 edges. Explicit induced fragments
have their own geometry and report excluded/boundary counts. `edgeIds` selects
1–32 analyzed edges, retaining all scoped edges in distance computation. Unit
lengths and uniform in/out measures are fixed; supported idleness values are
`zero` and `half`. No source weight becomes a distance.

The portable subpath bundles for browsers without Python or Node imports; it can
verify stored results. The Node subpath invokes the packaged standard-library
oracle with bounded pipes and a deadline. See the [contract](../../docs/structural-geometry/OLLIVIER_CURVATURE.md)
and [independent reference suite](../../cases/structural-geometry/ollivier/README.md).

## Normalized shadow flow

`@onto2d/structural-geometry/flow` evolves a separate positive rational length
state with certified weighted Ollivier transport, metric closure and mean-one
normalization. The original Model Pack remains immutable. Python execution is
explicit through `@onto2d/structural-geometry/flow/node`:

```js
import { createStructuralFlowAnalyzer, verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";

// Bounded induced fragment of the bundled Causal Emergence Model Pack.
const input = {
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2", "0.3"] },
  maxIterations: 6, step: "half", idleness: "half"
};
const analyzer = createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter());
const artifact = await analyzer.analyze(pack, input);
const checked = verifyStructuralFlowArtifact(artifact, pack, input);
console.log(checked.termination, checked.states.at(-1).summary, checked.cuts);
```

`prepareStructuralFlow(pack, input)` exposes the immutable source request.
`createStructuralFlowAnalysis(adapter)` registers the explicit
`engine.analyze("structural-flow", input)` analysis. Every scoped edge evolves;
there is no analyzed-edge subset. Scope is full by default, bounded to 64 nodes
and 64 edges, with at least one edge. Optional `initialLengths` must cover all
scoped edges with `{edgeId, length: {numerator, denominator}}` reduced positive
rationals. Otherwise all initial lengths are one. Source weights are ignored.

Defaults are 16 transformations (maximum 24), half step, half idleness, tolerance
`1/1000000` and two stable transitions. `step: "one"` and `idleness: "zero"`
are explicit alternatives. `cut: {kind: "final-length", threshold:
{numerator: "2", denominator: "1"}}` reports final components after removing
strictly longer edges. Cuts never feed back into the trajectory. The default is
`{kind: "none"}`. Iteration caps and cycles do not claim convergence.

The portable verifier checks the entire state/certificate/hash chain without
Python. Python 3.9+ is required for the packaged solver; its Node options are
`pythonExecutable` and `timeoutMs` (1–30000). Numeric growth, transport-history
and artifact limits fail explicitly without partial artifacts. See the
[complete contract](../../docs/structural-geometry/SHADOW_FLOW.md) and
[published/independent reference suite](../../cases/structural-geometry/flow/README.md).

## Reading a foundation result

For an edge `u -> v`, unit curvature is `2 - indegree(u) - outdegree(v)`.
The two contributing degrees are reported next to each edge. Node records
contain incoming/outgoing sums and their difference. Summaries include an exact
rational mean, histogram, grouped source/target levels and relation annotations,
and all extrema ties. Empty edge sets have null mean and extrema.

Each artifact binds the source ID/version/root/manifest, projection and metric
policies, algorithm/version, parameters and projection hash. Original source
weights and quantization are traceable attributes, never curvature coefficients.
Self-loops, parallel directed edges and foreign relation layers fail; reciprocal
edges are supported. Count bounds and the canonical codec's bounds apply without
truncation. Category values are preserved, not scientifically validated.

See the [representation contract](../../docs/structural-geometry/REPRESENTATION_POLICIES.md),
[mathematical definition](../../docs/structural-geometry/METRIC_POLICIES.md) and
[claim boundary](../../docs/structural-geometry/CLAIM_BOUNDARIES.md). This statistic
describes the selected graph. It does not establish causality or emergence, and
under unit weights it contains no information beyond its endpoint degrees.
