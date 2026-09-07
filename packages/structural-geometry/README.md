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

The [revised R0–R12 plan](../../docs/structural-geometry/RESEARCH.md) keeps
these analyses in this package. Providers, regime observations/comparison,
probes, graph-native response signatures, fixed-domain pseudometrics and certified geometric signatures are
implemented below. Existing entrypoints and
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
No provider is registered automatically. See the [contract](../../docs/structural-geometry/GEOMETRY.md#compatible-metric-providers)
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
[contract](../../docs/structural-geometry/OBSERVATIONS.md#distinguishability-regime-and-observable-contracts) and
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
[contract](../../docs/structural-geometry/OBSERVATIONS.md#exact-canonical-directed-observations) and
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
preserves this profile. The [contract](../../docs/structural-geometry/OBSERVATIONS.md#directed-topology-observations)
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
See the [contract](../../docs/structural-geometry/OBSERVATIONS.md#typed-directed-observations-and-vocabulary-alignment) and
[cases](../../cases/structural-geometry/typed/README.md).

## Strict comparison

`@onto2d/structural-geometry/comparison` compares the complete observable profile
of two verified sources in one explicitly selected regime:

```js
import { compareStructuralModels, verifyStructuralComparison }
  from "@onto2d/structural-geometry/comparison";

const input = { regimeId: "topology-only-v1" };
const result = compareStructuralModels(leftPack, rightPack, input);
verifyStructuralComparison(result, leftPack, rightPack, input);
```

Complete profiles give `indistinguishable-under-regime` / `0` or
`distinguishable-under-regime` / `1`. Missing mandatory evidence gives
`indeterminate` / `null`, with component and family coverage and any observed
differences retained. This distance expresses exact profile mismatch; it does
not measure the magnitude of a difference. Typed comparisons require the
existing vocabulary alignment, supplied as `vocabulary: { mapping,
approvedMappingHash }` when crossing source vocabularies.

Optional `leftScope`/`rightScope` select bounded induced fragments. Content-bound
`evidenceGaps` can declare unavailable/rejected comparison use for a side and
observable; they remove coverage and never suppress source/mapping validation.
Verification takes the independently expected request, including approvals and
restrictions. `createStructuralComparisonAnalysis(rightPack)` snapshots the right
source for explicit engine registration. The same API runs in Node and browsers.
See the [contract](../../docs/structural-geometry/OBSERVATIONS.md#strict-structural-comparison-and-mandatory-coverage),
[43 controls](../../cases/structural-geometry/comparison/README.md) and
[acceptance review](../../docs/structural-geometry/EVIDENCE.md).

## Immutable probe sandbox

Measured representation invariance is available separately through
[`/invariance`](#measured-invariance-probes).

`@onto2d/structural-geometry/sandbox` executes finite graph operations in separate
source-bound shadow graphs. Each target starts from the same unchanged baseline:

```js
import { runStructuralProbeSandbox, verifyStructuralProbeSandbox }
  from "@onto2d/structural-geometry/sandbox";

const input = {
  regimeId: "topology-only-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] },
  transformation: { kind: "reverse-edges", targets: "each-scoped-edge" }
};
const sandbox = runStructuralProbeSandbox(pack, input);
verifyStructuralProbeSandbox(sandbox, pack, input);
```

Operations are `identity`, `remove-edges` and `reverse-edges`. Edits require
`all-scoped-edges` or `each-scoped-edge`; every eligible edge participates.
There is no arbitrary source-ID selection or silent truncation. Removal retains
all nodes. Reversal preserves typed annotations and rejects a target that would
create parallel edges. Empty edit targets are explicitly unavailable. Applied,
rejected and total counts remain visible; these are execution results without
measured observations or scientific probe pass/fail claims.

Shadow graph IDs and hashes bind provenance, while source/shadow mappings preserve
exact identifiers and scope boundaries. Shadow graphs are distinct from Model
Packs. The API interprets bounded data operations and accepts no executable
callbacks. `createStructuralProbeSandboxAnalysis()` supplies opt-in engine
registration; the same artifact replays in Node and browsers. See the
[contract](../../docs/structural-geometry/SIGNATURES.md#immutable-structural-probe-sandbox),
[51 controls](../../cases/structural-geometry/sandbox/README.md) and
[review](../../docs/structural-geometry/EVIDENCE.md).

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
See the [contract](../../docs/structural-geometry/GEOMETRY.md#typed-filtration-and-local-weight-experiments) and
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
oracle with bounded pipes and a deadline. See the [contract](../../docs/structural-geometry/GEOMETRY.md#directed-ollivier-reference-contract)
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

See the [representation contract](../../docs/structural-geometry/GEOMETRY.md#representation-policies),
[mathematical definition](../../docs/structural-geometry/GEOMETRY.md#metric-and-algorithm-policies) and
[claim boundary](../../docs/structural-geometry/EVIDENCE.md#claim-boundaries). This statistic
describes the selected graph. It does not establish causality or emergence, and
under unit weights it contains no information beyond its endpoint degrees.

## Measured invariance probes

`@onto2d/structural-geometry/invariance` runs four mandatory controls against
independent copies of a verified source-bound baseline: record order, node
renaming, edge renaming and synthetic presentation changes.

```js
import { runStructuralInvarianceProbes, verifyStructuralInvarianceProbes }
  from "@onto2d/structural-geometry/invariance";

const input = { regimeId: "typed-relations-v1" };
const result = runStructuralInvarianceProbes(pack, input);
verifyStructuralInvarianceProbes(result, pack, input);
console.log(result.summary.status, result.summary.coverage);
```

Each representation retains its exact JSON string and transported source
mappings. A private adapter parses it afresh and measures all existing regime
observables, excluding declared presentation fields. Complete agreement passes;
a complete difference fails; missing mandatory evidence is indeterminate and
retains other measured differences. Edgeless edge renaming is an explicit no-op
with `payloadChanged: false`, not evidence of an exercised edge.

The registry, policy and adapter are exported as frozen content-bound constants.
The API accepts only an explicit regime and optional existing full/induced scope.
It has no probe subset, arbitrary callback or source-ID target selection.
`createStructuralInvarianceAnalysis()` provides opt-in engine integration. All
results are readonly and exactly reproducible in Node and browsers. Earlier
regime, sandbox and observation artifacts retain their identities.

This tests synthetic representation handling, not the website renderer. It
provides no response signature or distance. Five representations/evaluations and
at most ten bounded canonicalizer calls are allowed, with 500,000 canonical
entries and 4 MiB cumulative/final output; existing graph and codec limits apply.
See the [contract](../../docs/structural-geometry/SIGNATURES.md#measured-structural-invariance-probes),
[13 controls](../../cases/structural-geometry/invariance/README.md) and
[acceptance review](../../docs/structural-geometry/EVIDENCE.md).

## Measured response probes

`@onto2d/structural-geometry/responses` measures structural changes in independent
copies of a verified baseline. Canonical/topology profiles run three fixed
probes: feedback-edge deletion, edge-direction reversal and redundant-support-path
deletion. Typed relations also runs separate necessary/enabling dependency
deletions, using declared fields without inferring domain boundary roles.

```js
import { runStructuralResponseProbes, verifyStructuralResponseProbes }
  from "@onto2d/structural-geometry/responses";

const input = { regimeId: "typed-relations-v1" };
const result = runStructuralResponseProbes(pack, input);
verifyStructuralResponseProbes(result, pack, input);
console.log(result.summary);
```

An optional existing `scope` limits the induced graph. Target selection is
exhaustive: both diamond routes participate, including their whole edge sets.
Every target starts from the same baseline, retains all scoped nodes and binds
its source mapping. Reversal carries types unchanged and rejects parallel edges.
No target overrides, caller callbacks or partial target sampling are accepted.

Responses are `changed` or `unchanged` only with complete mandatory observations;
otherwise they remain `indeterminate` with known differences retained.
Scalar integer deltas report after minus before; graph/vector deltas are null.
Absent targets and unresolved necessity selection have distinct `unavailable`
reasons. Rejected operations have null graphs/observations/responses and still
count in coverage denominators. Any incomplete compatible probe keeps overall
coverage indeterminate; per-target evidence remains available.

Diagnostic histograms preserve effect multiplicity without source identifiers.
They are not a response signature or distance. The fixed policy bounds each
probe to 32 targets, the request to 64 targets/2,048 transformation edge visits,
path enumeration to 4,096 extensions/131,072 adjacency scans and observations to
65 graphs/130 individually bounded canonicalizer calls. Existing regime bounds
and 500,000-entry/4 MiB cumulative/final output limits also apply. Overflow throws
without a partial result.

`createStructuralResponseAnalysis()` supports explicit engine registration
using authentic models. Closed schemas, readonly declarations and browser replay
use the same runner. See the [contract](../../docs/structural-geometry/SIGNATURES.md#graph-native-response-probes),
[16 controls](../../cases/structural-geometry/responses/README.md) and
[acceptance review](../../docs/structural-geometry/EVIDENCE.md).

## Graph-native response signature

`@onto2d/structural-geometry/signature` builds ResponseSignature-v0 from the fixed
response and invariance registries. It embeds both complete source-bound
artifacts and fixes one mandatory joint response multiset per compatible probe.

```js
import { runStructuralResponseSignature, verifyStructuralResponseSignature }
  from "@onto2d/structural-geometry/signature";

const input = { regimeId: "topology-only-v1" };
const signature = runStructuralResponseSignature(pack, input);
verifyStructuralResponseSignature(signature, pack, input);
console.log(signature.summary, signature.value);
```

Canonical/topology profiles contain three features; typed relations contains
five. Rows retain ordered component states/scalar deltas and exact multiplicity.
Empty or unresolved target sets, rejected transformations and missing observations
produce null feature values with explicit reasons. The whole value/hash is
present only when all features are observed and every invariance control passes.
Partial evidence remains inspectable in the embedded artifacts.

Fingerprints exclude provenance. Typed source-local comparison authority remains
separate; equal hashes cannot approve cross-source semantic meanings. Graph-native
response equality can merge different graphs: the isolate-extension collision
is retained in all three regimes. Geometry, History, motif, admissibility and
kernel identity effects are unconfigured in this profile. No distance is supplied.

All upstream bounds apply, with composite limits of 70 observations, 140 bounded
canonicalizer calls, 64 feature rows, 448 component visits and 8 MiB cumulative/
final output. `createStructuralResponseSignatureAnalysis()` supports explicit
engine registration. Readonly types, closed schemas and browser replay use the
same runner. See the [contract](../../docs/structural-geometry/SIGNATURES.md#graph-native-responsesignature-v0),
[27 controls](../../cases/structural-geometry/signatures/README.md) and
[review](../../docs/structural-geometry/EVIDENCE.md).

## Fixed-domain response pseudometric

`@onto2d/structural-geometry/pseudometric` compares response signatures freshly
rebuilt from two expected Model Packs. Each whole mandatory family is one
categorical coordinate; exact equality gives zero and mismatch gives one.
Unit weights/scales and a fixed three/five-family denominator produce a reduced
integer fraction. A full distance requires every family and passed invariance.

```js
import { compareStructuralSignatures, verifyStructuralPseudometric }
  from "@onto2d/structural-geometry/pseudometric";
const input = { regimeId: "topology-only-v1", diagnostics: "partial-with-coverage" };
const result = compareStructuralSignatures(leftPack, rightPack, input);
verifyStructuralPseudometric(result, leftPack, rightPack, input);
console.log(result.status, result.distance, result.coverage);
```

`leftScope`/`rightScope` default to full. Untyped sources share a fixed profile
domain; typed comparisons require the same verified full-source context and can
compare induced scopes within it. Pairwise dictionary approvals are not a global
metric domain and have no override here. Missing families or incompatible domains
give `distance: null`. Opt-in partial means carry coverage and `guarantee: "none"`;
a partial zero cannot establish indistinguishability. The default is coverage-only.

The artifact embeds both complete signature/probe evidence trees, fixed domains,
membership, reasons, coverage and cumulative work. Verification reconstructs all
layers; caller hashes are insufficient. `createStructuralPseudometricAnalysis(rightPack)`
snapshots the right pack for explicit engine registration. All upstream limits
apply, plus 140 observations, 280 bounded canonicalizer calls and 16 MiB output.

See the [contract and proof](../../docs/structural-geometry/SIGNATURES.md#fixed-domain-structuralpseudometric-v0),
[60 controls](../../cases/structural-geometry/pseudometric/README.md) and
[review](../../docs/structural-geometry/EVIDENCE.md).
Fixed-family distance can merge different graphs; the controls preserve those
collisions. Broader geometric utility and cross-source typed semantic domains retain later gates.

## Certified geometric signature

`@onto2d/structural-geometry/geometric-signature` combines provider-backed Forman,
certified Ollivier and verified shadow-flow results into GeometricSignature-v1.
All three request slots are mandatory; `null` explicitly disables a layer:

```js
import { buildGeometricSignature, verifyGeometricSignature }
  from "@onto2d/structural-geometry/geometric-signature";

const input = {
  forman: { analysis: "structural-geometry", metricProviderId: "unit-v1" },
  ollivier: null,
  flow: null
};
const expectedEvidence = { ollivier: null, flow: null };
const signature = buildGeometricSignature(pack, input, expectedEvidence);
verifyGeometricSignature(signature, pack, input, expectedEvidence);
console.log(signature.features[0].value, signature.summary);
```

Forman is computed locally. To include Ollivier or flow, supply their existing
requests and the corresponding expected artifacts from their analyzers. Every
receipt is verified against the expected source/request. Requested null receipts
mean missing evidence; invalid receipts throw. All requested layers must share
the same exact node/edge population, even when receipts are missing. Existing
Forman selection/full-node limits and upstream solver bounds remain in effect.

Scalar descriptors preserve exact interval multisets, unresolved signs and
possible/certain extreme degree roles. Flow records joint length/curvature
frames at absolute iterations, termination, cut components and strict threshold
events. Early-stop tails stay null; partial coverage keeps measured descriptors
without completing the whole three-family signature. Source edge IDs and full
proofs remain in provenance. Fingerprints alone do not authorize comparison or
extend the R6 distance contract.

`createGeometricSignatureAnalysis(expectedEvidence)` snapshots receipts for
explicit engine registration. Closed schemas, readonly types and browser replay
use the same implementation without a solver. Composite limits are 64 nodes/edges,
25 frames, 3,328 scalar samples, 1,600 joint samples, two million canonical entries
and 24 MiB cumulative/final output. See the
[contract](../../docs/structural-geometry/SIGNATURES.md#geometricsignature-v1),
[25 controls](../../cases/structural-geometry/geometric-signatures/README.md) and
[review](../../docs/structural-geometry/EVIDENCE.md).
SG2-041's separate offline study is implemented below; SG2-042/043
sensitivity/robustness remain open.

## Prospective geometric added-value study

The [repository study](../../cases/structural-geometry/added-value/README.md)
uses these unchanged public APIs under a protocol frozen before measurements.
Thirty-two synthetic graph orbits, their representation transports and four
development sources give 68 unit artifacts and 531 pairs. Exact A/static/B
comparisons use the same complete population and seven graph baselines.

```sh
npm run structural-geometry:added-value:check
npm run structural-geometry:added-value:report
```

Response-only and response-plus-geometry both distinguish all 210 eligible
negative pairs; joint degrees already separate them. The added split count is
zero, 286 pairs lack complete responses and the degree-matched subgroup is empty.
These limitations remain in the verified result. The study fixes one exact unit
domain and does not extend the package's R6 comparison API. See the
[contract](../../docs/structural-geometry/EVIDENCE.md#finite-prospective-response-versus-geometry-evaluation) and
[review](../../docs/structural-geometry/EVIDENCE.md).
Provider/context sensitivity is next; flow robustness and broader scientific/site
gates remain open.
