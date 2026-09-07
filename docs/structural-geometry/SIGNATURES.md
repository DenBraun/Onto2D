# Structural Geometry — Signatures

- [Immutable structural probe sandbox](#immutable-structural-probe-sandbox)
- [Measured structural invariance probes](#measured-structural-invariance-probes)
- [Graph-native response probes](#graph-native-response-probes)
- [Graph-native ResponseSignature-v0](#graph-native-responsesignature-v0)
- [Fixed-domain StructuralPseudometric-v0](#fixed-domain-structuralpseudometric-v0)
- [GeometricSignature-v1](#geometricsignature-v1)

<a id="immutable-structural-probe-sandbox"></a>

## Immutable structural probe sandbox

The sandbox executes finite transformations on independent shadow graphs.
Source records remain immutable. Measured invariance, responses and signatures
use separate APIs over the verified transformation evidence.

<a id="immutable-structural-probe-sandbox--source-and-graph-boundary"></a>

### Source and graph boundary

`@onto2d/structural-geometry/sandbox` accepts one verified Model Pack, an explicit
existing regime and an optional full/induced scope. It preserves the unchanged
regime preparation, including complete source verification, all boundary edge
partitions, source/dictionary identity, isolates and the regime's graph limits.
Source records are never edited or returned with altered content under an old
Model Pack identity.

The baseline and every applied transformation are separate `structural-shadow-graph`
objects, not Model Packs. They bind the original source context and scope, regime,
node/edge records and their own graph hash. Node IDs `n000`… and edge IDs `e000`…
are assigned by exact source-ID order. Explicit source/shadow mappings preserve
opaque source spelling, including whitespace. These IDs and graph hashes are
provenance, not canonical orbits or invariant comparison coordinates.

Untyped regimes retain only directed adjacency. The typed regime retains the
five existing typed fields as joint edge annotations, sorting declared sets.
Absent fields stay absent; no default or invented evidence is supplied. All
present typed fields in the complete source are validated before scoping.
Reversal carries annotations unchanged: it is a graph operation, not automatic
recoding of domain-specific causal meaning. No geometric lengths, layout,
scientific confidence or history are added.

<a id="immutable-structural-probe-sandbox--finite-transformation-contract"></a>

### Finite transformation contract

Requests contain `regimeId`, optional `scope`, and required `transformation`:

- `{ kind: "identity" }` copies the entire scoped graph once, including edgeless
  graphs. It is an execution control, not a passed invariance test.
- `{ kind: "remove-edges", targets: "all-scoped-edges" | "each-scoped-edge" }`
  removes the selected edge set while retaining every scoped node.
- `{ kind: "reverse-edges", targets: "all-scoped-edges" | "each-scoped-edge" }`
  reverses selected directed endpoints simultaneously.

`all-scoped-edges` creates one target containing every internal edge.
`each-scoped-edge` enumerates every internal edge as a separate singleton target.
Every run starts from the same immutable baseline, never the previous run.
No source-ID target override, first-edge choice, truncation, random sampling,
caller callback, executable code, filesystem/network access or custom policy is
accepted. The sandbox is a bounded data interpreter, not process isolation for
arbitrary user code.

Eligible and selected source/shadow IDs are explicit. Sorting determines only
artifact serialization, not membership. Exhaustive selection commutes with
allowed relabeling: every source edge has a transported target. Later response
registries must aggregate the complete target multiset invariantly and must not
use source order as feature coordinates. A scope itself is an explicit source
selection and must also be transported when testing relabeling.

<a id="immutable-structural-probe-sandbox--rejection-and-provenance"></a>

### Rejection and provenance

Reversing a singleton in a reciprocal pair would create parallel edges. That
target is retained with `execution: "rejected"`, a
`parallel-edge-after-reversal` reason identifying the conflicting source edges,
and null output graph/mapping/changes. No edge is silently merged or discarded.
The baseline and other independently executed targets remain available.

An edgeless removal/reversal has `execution.state: "unavailable"`, reason
`empty-target-set` and zero runs, never a fabricated success. Otherwise the
batch is `completed`, meaning all planned targets have an applied or rejected
record. Explicit target/applied/rejected counts prevent treating rejected runs
as successful probes. `observationEvaluation` is always `not-run`.

Each run binds its target, baseline graph hash, transformation, output graph or
rejection, preserved/removed/reversed source-edge mappings and changes. The
unchanged baseline node mapping applies to every output. Removed edges retain
their before-shadow ID and a null after-shadow ID; retained edges keep their
original shadow ID, even when other edges are removed. Complete artifacts and
all nested values are immutable.

Malformed sources/requests, unknown contracts, exceeded limits and corrupted
artifacts throw validation errors. Expected transformation rejection is distinct
from invalid input. Rejection never hides a corrupt excluded source edge.

<a id="immutable-structural-probe-sandbox--limits-and-verification"></a>

### Limits and verification

The frozen `immutable-structural-probe-sandbox-v1` policy permits at most 32
targets and 1,024 transformation edge visits, inheriting the selected regime's
node/edge limits (six/30 for exact or typed; 64/256 for topology). An edge visit
counts one baseline edge examined for one target; source validation, preparation
and serialization are excluded from that diagnostic. Work is bounded before
target execution, with no partial result on exhaustion. Serialization permits
500,000 canonical entries and a 4 MiB complete artifact. Cumulative emitted
bytes are checked during execution and the complete envelope is checked finally.
Individual graph/run encodings and inherited canonical string/depth limits also
apply. No graph canonicalization, response observation or comparison runs here.

`runStructuralProbeSandbox(pack, input)` returns the complete artifact;
`verifyStructuralProbeSandbox(artifact, pack, input)` reconstructs it from
independently expected sources and request. Rehashing a changed target,
mapping, rejected run or graph cannot authorize it. The public engine factory
`createStructuralProbeSandboxAnalysis()` is opt-in and requires an authentic
engine Model. The same deterministic API runs in Node and browsers.

Hash domains are `onto2d:structural-sandbox-policy:v1`,
`onto2d:structural-sandbox-graph:v1`, `onto2d:structural-sandbox-run:v1` and
`onto2d:structural-sandbox-artifact:v1`. Separate suite/reference domains bind
computational controls. Two closed schemas cover requests and complete results;
runtime replay additionally enforces cross-record identity and arithmetic.

The suite uses `onto2d:structural-sandbox-reference:v1` and
`onto2d:structural-sandbox-suite:v1`. Future observation adapters must consume
verified shadow graphs with this provenance, rather than present them as original
Model Packs or use provenance hashes as invariant response coordinates.

<a id="immutable-structural-probe-sandbox--acceptance-gate"></a>

### Acceptance gate

<a id="measured-structural-invariance-probes"></a>

## Measured structural invariance probes

Four fixed probes measure whether observations survive their declared
transformations. Invariance is established only for the tested regime, scope
and admissible transformations.

<a id="measured-structural-invariance-probes--what-a-result-means"></a>

### What a result means

An invariance probe asks whether the selected analysis gives exactly the same
structural values after a change that its regime declares irrelevant. All four
probes run for every request, against independent copies of one baseline:

| Probe | Actual change | Structural expectation |
|---|---|---|
| Record order | Reverse node/edge record arrays and recursive object-key order; indent JSON | All selected observable values agree |
| Node renaming | Rename every node to a fresh `vertex:` namespace with reversed ordinals; transport both edge endpoints | All selected observable values agree |
| Edge renaming | Rename every edge to a fresh `link:` namespace with reversed ordinals | All selected observable values agree |
| Presentation | Replace synthetic node/edge labels, node positions, edge colors and viewport zoom | All selected observable values agree |

`passed` means every mandatory observable was measured and equal. `failed` means
all were measured and at least one differed. `indeterminate` means mandatory
evidence is missing, even if another observable differs. Components retain
`equal`, `different` and `indeterminate` diagnostics. Overall coverage counts
observed baseline/transformed observable pairs across all four probes; it is
neither an edge count nor a similarity percentage. Any incomplete probe makes
the overall result indeterminate. Empty profiles cannot pass.

An edgeless graph has an explicit no-op edge-renaming control with
`payloadChanged: false` and an empty edge mapping. Its observable comparison can
pass; this supplies no evidence about renaming an actual edge. Other probes
still change their payload, including on a singleton graph. Topology agreement
does not imply isomorphism; the topology regime retains its known collisions.

<a id="measured-structural-invariance-probes--source-and-observation-boundary"></a>

### Source and observation boundary

`@onto2d/structural-geometry/invariance` accepts only a verified Model Pack and
the existing explicit regime/optional scope request. It rebuilds the identity
sandbox internally, preserving its full source/dictionary context, preparation,
scope partitions, isolated nodes and graph limits. All present typed fields in
the full source are audited, including excluded edges. Source data is immutable.

The artifact binds the sandbox policy and identity artifact hash, baseline
shadow-graph hash and exact source/shadow mappings. Each probe transports every
scoped node and edge; source-ID ordering only serializes exhaustive mappings.
It never selects a preferred structural representative or first target.

Representations are separate JSON payload strings with synthetic presentation,
not Model Packs. Keeping the exact string preserves record order, object-key
order and whitespace through canonical artifact serialization. `payloadHash`
binds those bytes. `graphHash` binds ID-sensitive graph records sorted by ID,
excluding presentation: it is provenance, not an invariant geometry coordinate.
All four transformations start from the same baseline string.

The private source-bound adapter parses each payload afresh. At that declared
boundary it excludes presentation and viewport, then invokes the existing
canonical directed graph, directed topology, or joint five-field typed evaluator.
The implementation descriptors and original observation
artifacts retain their identities. The new adapter has its own descriptor and
observation hash domain; it does not fabricate an old source observation.

Canonical mode measures one graph value, topology mode all seven summary
values, and typed mode both the untyped graph and joint typed graph. Missing
typed fields produce a null typed value/hash with explicit source-edge/field
reasons, transported through relabeling. Untyped observations remain available.
Typed codes stay in the same verified source context; cross-source semantic
compatibility is never inferred. Comparison also checks source, scope, adapter,
observable and implementation bindings before exact value comparison.

This exercises the representation adapter. It does not test the website renderer
or arbitrary Model Pack encoders. `evaluation: "measured"` records that the
observations were attempted; the summary determines whether evidence is complete.

<a id="measured-structural-invariance-probes--fixed-contract-limits-and-verification"></a>

### Fixed contract, limits and verification

The exported `STRUCTURAL_INVARIANCE_REGISTRY` fixes four versioned probe
definitions, families, parameters, targets and content hashes before outcomes.
`STRUCTURAL_INVARIANCE_POLICY` binds that registry and strict aggregation.
`STRUCTURAL_SHADOW_OBSERVATION_ADAPTER` binds extraction and evaluator versions.
The original regimes' empty `probeSets` remain frozen preparation declarations;
actual execution evidence lives in this separate registry and result artifact.

Requests cannot override the registry, select a subset, inject callbacks, change
policies or supply an independently asserted shadow source. Invalid inputs or
exhausted bounds throw without a partial artifact. Finite limits are five
representations, five observation evaluations and at most ten canonicalizer
calls, each retaining the existing 100,000-state search limit. The existing
regime bounds remain six nodes/30 edges for exact and typed analysis, or
64 nodes/256 edges for topology. Output is limited to 500,000 canonical entries
and 4 MiB, checked cumulatively and on the final artifact. Inherited per-string
and depth limits also apply. Work counters describe observation evaluation;
source validation, sandbox copying, serialization and hashing are separate costs.

`runStructuralInvarianceProbes(pack, input)` returns a deeply frozen artifact.
`verifyStructuralInvarianceProbes(artifact, pack, input)` reconstructs every
payload, mapping, measurement, comparison and hash from independently expected
source and request. Rehashing a forged result never authorizes it. Two closed
schemas check request/result structure; exact replay additionally checks JSON
payload contents, cross-record arithmetic and source identity. The optional
`createStructuralInvarianceAnalysis()` factory requires an authentic engine Model.
Node and browser execution produce identical artifacts.

Hash domains use `onto2d:structural-invariance-<kind>:v1`, with kinds `probe`,
`registry`, `policy`, `adapter`, `payload`, `graph`, `value`, `observation`, `run`
and `artifact`. The independent controls use separate `reference` and `suite`
kinds. Source bindings and provenance hashes never enter observable coordinates.

<a id="measured-structural-invariance-probes--computational-acceptance"></a>

### Computational acceptance

Thirteen frozen artifacts cover all three regimes, a Causal Emergence scope,
reciprocal/mixed graphs, missing fields, typed sets, boundaries, isolates, opaque
IDs, a singleton, the complete six-node typed graph and the 64-node/256-edge
topology boundary. Twelve are complete passes; missing typed evidence is the
one indeterminate case. Their 52 probe comparisons retain the corresponding
48 passed and four indeterminate outcomes.

The independent Python reference constructs transformations from source records,
enumerates all bijections for untyped/typed graph orbits and uses Boolean closure
for topology. It checks all 69 loopless directed graphs on one through three
nodes in three regimes: 207 requests and 828 probe results. All 3,280 strict
aggregation profiles through seven components are independently checked.
Destructive controls detect an edge deletion and a type change; deletion with
missing typed evidence retains a difference while staying indeterminate. These
controls are explicitly outside the invariance registry.

This is bounded computational agreement, not proof of universal invariance or
scientific added value. The implementation provides separately fixed graph-native
response probes and diagnostic target histograms; The implementation provides
[ResponseSignature-v0](#graph-native-responsesignature-v0) under a separately frozen
feature/applicability policy and requires the invariance gate to pass.

<a id="graph-native-response-probes"></a>

## Graph-native response probes

Five fixed graph transformations measure responses under a declared regime.
These are structural edits, not simulations of biological interventions.
Unavailable targets and rejected transformations remain explicit.

<a id="graph-native-response-probes--public-contract"></a>

### Public contract

`@onto2d/structural-geometry/responses` exports
`runStructuralResponseProbes(pack, input)`,
`verifyStructuralResponseProbes(value, pack, input)`,
`createStructuralResponseAnalysis()`, the input/artifact schema URLs and three
content-bound descriptors: `STRUCTURAL_RESPONSE_REGISTRY`,
`STRUCTURAL_RESPONSE_POLICY` and `STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER`.
The only request fields are an explicit existing `regimeId` and optional
full/induced `scope`. Callers cannot supply a target list, probe subset, callback,
transformation or resource override.

The runner verifies the complete source through the existing identity sandbox,
preserves its preparation and scope partitions, then plans every target before
observing the baseline. Every target transforms an independent copy of that
baseline. Source packs, manifest identity, original schemas and earlier artifacts
are unchanged. Derived graphs retain the existing shadow-graph contract and
their own hashes; their response execution records have a separate hash domain.
The old sandbox's `observationEvaluation: "not-run"` and the preparation's empty
probe-set declarations remain unchanged. The actual measured registry is bound
separately in the response artifact.

<a id="graph-native-response-probes--fixed-probes-and-target-rules"></a>

### Fixed probes and target rules

The registry is `structural-response-probes-v1`. Every compatible probe is
mandatory. Canonical and topology regimes run three probes; typed relations run
all five. The artifact records both the ordered compatible profile and excluded
probe IDs. Untyped profiles do not inspect necessity to select typed targets.

| Probe | Exhaustive baseline selector | Independent transformation |
|---|---|---|
| `feedback-edge-ablation-v1` | Every internal edge u→v for which v reaches u | Delete that edge |
| `necessary-parent-ablation-v1` | Every internal edge with declared `necessity: "necessary"`; typed regime only | Delete that edge |
| `enabling-parent-ablation-v1` | Every internal edge with declared `necessity: "enabling"`; typed regime only | Delete that edge |
| `edge-direction-reversal-v1` | Every internal edge | Reverse that edge, retaining its annotations |
| `redundant-support-path-ablation-v1` | Every nonempty simple directed path whose entire edge deletion leaves a route between the same ordered endpoints | Delete that path's whole edge set |

All paths have distinct vertices; single-edge paths are included. The surviving
alternative shares no removed edge, but may share interior vertices. Both routes
of a diamond are separate targets. Target order serializes evidence; source IDs
never choose a preferred representative or change histogram coordinates.
All scoped nodes remain, including nodes isolated by a path deletion.
Boundary/external edges are recorded in preparation but never transformed.

Necessary/enabling probes operationalize already declared dependency constraints.
They neither infer physical necessity nor identify a domain boundary relation.
Domain constraint/boundary roles require separately sourced, reviewed mappings
under the [research plan](RESEARCH.md). Reversal carries all joint types unchanged; it does not reinterpret
causal-direction annotations or claim a physically valid intervention.
If a reversal would create parallel edges, that target is explicitly rejected.

If any scoped edge lacks necessity, both typed necessity selectors are
`unresolved`: retain known eligible and unknown source-edge IDs, but execute
neither incomplete target set. Other compatible probes still execute.
Malformed present typed fields anywhere in the full source fail validation
before scoped analysis. Missing other fields affects observations without
silently changing the selected targets.

<a id="graph-native-response-probes--observations-and-result-states"></a>

### Observations and result states

A private source-bound adapter measures the baseline and each applied graph
using the existing regime's full ordered profile:

- Canonical structure: one exact untyped directed graph value.
- Directed topology: seven fixed node/edge, weak/strong component, reachability,
  cyclic-node and isolated-node observables.
- Typed relations: exact untyped structure and one joint five-field typed value,
  using one common vertex bijection and the unchanged source vocabulary context.

Every observation binds source context, scope, regime, graph, adapter and
implementation. Missing typed observations have null values/hashes and explicit
source-edge/field reasons. Removing an edge with missing types can make the
after-value available, but cannot repair the missing baseline measurement.

Each target compares exact before/after values. Scalar integer observables also
report signed `after - before` deltas. Graph values and sorted component-size
vectors have null deltas; no arbitrary vector alignment or distance is invented.

| State | Interpretation |
|---|---|
| Target `changed` | Every mandatory observable is available; at least one differs |
| Target `unchanged` | Every mandatory observable is available; all are equal |
| Target `indeterminate` | A mandatory before/after observation is missing; other measured differences are retained |
| Execution `rejected` | Reversal would create a parallel edge; graph, mapping, changes, observation and response are null |
| Probe `unavailable / no-eligible-targets` | Exhaustive selection completed with no eligible target |
| Probe `unavailable / missing-selector-evidence` | Necessity evidence cannot establish the complete target set |

Changed is not a universal success criterion. For example, reversing the only
edge of a two-node graph can leave an unlabeled graph observation unchanged.
The probes report measured effects under the selected regime.

Per-probe coverage is the number of comparable before/after observable pairs
over all planned targets multiplied by all mandatory regime observables.
Rejected targets remain in that denominator. A zero denominator is incomplete,
not a measured zero response. Overall coverage counts fully observed compatible
probes over the fixed profile of three or five. Any unavailable, unresolved,
rejected or incomplete probe keeps the overall result `indeterminate`.
Per-target evidence remains inspectable regardless of the overall status.

Each probe also exposes a diagnostic effect histogram: the complete multiset
of component states, scalar deltas and rejection categories, with multiplicity.
Source IDs, provenance hashes, target order and work counters do not enter its
keys. It remains available for incomplete probes, with the gaps retained.
This histogram is not `ResponseSignature-v0` or a numeric distance.

<a id="graph-native-response-probes--finite-work-and-verification"></a>

### Finite work and verification

The fixed composite limits are 32 targets per probe, 64 total targets, 2,048
transformation edge visits, 4,096 simple-path extensions, 131,072 selector
adjacency-entry scans, 65 observation evaluations and 130 individually bounded
canonicalizer calls. Existing graph limits remain six nodes/30 edges for exact
regimes and 64 nodes/256 edges for topology. Exhaustive direction selection
also makes more than 32 scoped edges a response-budget error.

Selectors complete before baseline observation or target execution. Budget
overflow throws without sampling, truncation or a partial result. Output
serialization allows 500,000 canonical entries and 4 MiB cumulative/final bytes,
including probe envelopes and histograms; inherited per-string/depth limits
apply. Traversal counters describe implementation work, not response features.
Finite work and output limits can further restrict otherwise valid graph inputs.

The verifier rebuilds the complete artifact from the expected pack and request.
Schema validity or a recomputed artifact hash alone cannot authorize targets,
transforms, source identity, arithmetic, coverage or scientific claims.
The two new closed schemas describe the versioned input/artifact shapes and
discriminated result states. Readonly declarations, browser replay and explicit
engine registration use the same public implementation.

<a id="graph-native-response-probes--controls-and-next-gate"></a>

### Computational controls

The [16 controls](../../cases/structural-geometry/responses/README.md) cover 158
targets, including complete effects, missingness, absent targets, rejection,
scope boundaries and maximum work. Independent source-based Python calculations
agree on all 207 small-graph requests / 1,438 targets. Transport tests cover
417 requests, including every relabeling of the typed diamond with feedback.

The implementation provides [graph-native ResponseSignature-v0](#graph-native-responsesignature-v0)
through a separate entrypoint, with frozen joint features, applicability,
aggregation and invariant eligibility. An empty target family never acquires a
numeric zero through an implicit default. The separate
[response pseudometric](#fixed-domain-structuralpseudometric-v0) compares complete features within
fixed untyped/source-local typed domains, with strict null gaps. SG2-023
remains mandatory before any compatible History profile ships; it is not fake
complete evidence required for the first three regimes. Conditional abstractions,
higher-order/domain semantics, broader typed metric domains, geometric added value and the
public page retain their separate gates.

<a id="graph-native-responsesignature-v0"></a>

## Graph-native ResponseSignature-v0

ResponseSignature-v0 records fixed joint response multisets with complete
probe and invariance evidence. Missing mandatory families make the signature
ineligible for complete comparison; they are not filled with zeros.

<a id="graph-native-responsesignature-v0--public-api-and-evidence"></a>

### Public API and evidence

`@onto2d/structural-geometry/signature` exports
`runStructuralResponseSignature(pack, input)`,
`verifyStructuralResponseSignature(value, pack, input)`,
`createStructuralResponseSignatureAnalysis()`,
`STRUCTURAL_RESPONSE_SIGNATURE_POLICY` and the input/artifact schema URLs.
The input contains an explicit existing `regimeId` and optional full/induced
`scope`. Feature subsets, callbacks, supplied outcomes, weights, distances and
resource overrides are not accepted.

The runner executes both existing [response probes](#graph-native-response-probes) and
[invariance probes](#measured-structural-invariance-probes) against the same verified source.
It checks their complete preparation agreement and embeds both exact artifacts
as `evidence.responses` and `evidence.invariance`. Their source, scope,
policies, registries, adapters, observations, target mappings and work remain
independently inspectable. Existing regime declarations and upstream artifacts
are unchanged; the new composition binds its own actual feature profile.

The conceptual signature version is v0. Its policy ID is
`graph-native-response-signature-v0`, contract version `"1"`, with schema
version `"1"` in the additive artifact. The fixed profile binds policy,
regime, ordered feature/probe identities and observable references.

<a id="graph-native-responsesignature-v0--feature-map"></a>

### Feature map

Each compatible response probe contributes exactly one mandatory feature.

| Feature | Supplier probe | Regimes |
|---|---|---|
| `feedback-response-multiset-v0` | Feedback-edge ablation | All three |
| `necessary-response-multiset-v0` | Declared necessary-parent ablation | Typed only |
| `enabling-response-multiset-v0` | Declared enabling-parent ablation | Typed only |
| `direction-response-multiset-v0` | Single-edge reversal | All three |
| `support-response-multiset-v0` | Redundant-support-path ablation | All three |

The value of one feature is a finite joint response multiset. For every target,
take all ordered mandatory component responses: observable ID, exact
`equal`/`different` state and signed scalar integer delta. Group identical
joint rows, retain a positive integer count and sort their canonical encodings.
Graph values and component-size vectors have null deltas; their exact
equal/different states remain. No arbitrary vector alignment is introduced.

For example, if three topology targets have the same seven-component response,
the feature contains one row with `count: 3`. If one target differs, two rows
retain counts two and one. Joint grouping preserves correlations between
components; separately matching each component's marginal distribution could
lose those correlations. Multiplicity records structural target count and is
not normalized away.

The complete value is the ordered tuple `{ features: [{ id, value }, ...] }`.
It contains three features for canonical/topology profiles and five for typed
relations. Baseline graph values, IDs, target names, graph/provenance hashes,
availability, rejection codes, coverage, timing and resource counters are not
feature coordinates. Geometry is excluded.

<a id="graph-native-responsesignature-v0--completeness-and-missingness"></a>

### Completeness and missingness

A feature is observed only when its baseline selector is complete and nonempty,
every selected transformation applies and every mandatory before/after component
is observed. Its value and value hash are otherwise null. Preserve reasons:

| Reason | Meaning of count |
|---|---|
| `no-eligible-targets` | One exhaustive but empty family |
| `missing-selector-evidence` | One unresolved complete target set |
| `rejected-transformations` | Number of rejected targets |
| `missing-observations` | Number of applied targets with incomplete observations |

Rejection and missing-observation reasons can coexist. Complete upstream
diagnostics remain in evidence, but no partial histogram or numeric zero
substitutes for the missing feature.

Per-feature coverage retains the response probe's comparable observable pairs
over all planned targets and mandatory observables. Signature feature coverage
counts observed features over the fixed profile of three or five. It does not
drop an empty family from the denominator.

The whole signature is `complete` only if all features are observed and every
invariance control passes. Otherwise its status is `indeterminate`, with null
whole value/hash and explicit incomplete-feature or invariance reasons.
Complete individual features remain inspectable. Feature coverage and invariance
acceptance are separate: even full feature coverage cannot override a failed
invariance control. An empty feature profile cannot complete.

<a id="graph-native-responsesignature-v0--fingerprints-comparability-and-limits"></a>

### Fingerprints, comparability and limits

Feature and whole-value hashes bind the fixed profile and exact values.
They exclude provenance, so allowed renaming/order/presentation changes preserve
fingerprints while source/artifact hashes change. They are equality fingerprints,
not numeric distances or semantic-comparability certificates.

Typed signatures expose `comparisonContext: { kind: "source-local-typed",
contextHash }` separately from feature values. Equal fingerprints in different
source contexts do not authorize a shared vocabulary meaning. Any future
cross-source typed comparison must establish compatible semantic authority.
Untyped signatures identify their graph-only comparison context explicitly.

Verification reconstructs the entire artifact from the expected source and
request. Rehashing fabricated feature counts, values, coverage, source bindings
or embedded evidence cannot make them valid. The two closed schemas constrain
fixed profiles, joint rows, result states, invariant acceptance and null values;
expected-source replay establishes cross-record arithmetic and authenticity.
Readonly declarations, browser replay and opt-in authentic engine models use
the same implementation.

All upstream source, graph, target, path, byte and per-evaluation bounds still
apply. The composite permits at most 70 observations, 140 individually bounded
canonicalizer calls, 64 feature rows and 448 feature-component visits.
Serialization permits 1,000,000 canonical entries and 8 MiB cumulative/final
bytes, with inherited string/depth limits. Both complete evidence artifacts are
accounted for before features, and the full output is checked before return.
Overflow throws without a partial artifact.

<a id="graph-native-responsesignature-v0--what-the-controls-establish"></a>

### What the controls establish

The [27 controls](../../cases/structural-geometry/signatures/README.md) produce
12 complete signatures and 15 explicitly indeterminate results. All nine frozen
contrasts agree with source-based independent expectations:

- Subdividing the feedback edge changes complete signatures in all three regimes.
- Changing a contextual edge's necessity changes the typed signature and leaves
  both untyped signatures equal.
- Adding an isolated node leaves all three signatures equal despite different
  baseline graphs. This disclosed collision shows the response-only map's limits.

The complete census on 69 directed loopless graphs of one through three nodes
contains 207 requests and 345 observed individual features, but no complete
signature under the fixed mandatory families. Every incomplete result remains.
This is not evidence of universal separation or empirical utility.
Tests check 465 exhaustive bijection requests plus four scope/missingness
transports, including complete values in all three regimes.

<a id="fixed-domain-structuralpseudometric-v0"></a>

## Fixed-domain StructuralPseudometric-v0

The response pseudometric compares complete signatures in one fixed domain
using exact categorical-family fractions. It is a bounded mathematical
comparison contract, not a calibrated biological response distance.

<a id="fixed-domain-structuralpseudometric-v0--public-contract"></a>

### Public contract

`@onto2d/structural-geometry/pseudometric` exports
`compareStructuralSignatures(leftPack, rightPack, input)`,
`verifyStructuralPseudometric(value, leftPack, rightPack, input)`,
`createStructuralPseudometricAnalysis(rightPack)`, the fixed policy and two schema
URLs. Both arguments are expected verified Model Packs. The runner rebuilds both
[response signatures](#graph-native-responsesignature-v0); caller-supplied feature values,
fingerprints or outcome declarations cannot authorize a comparison.

```js
import { compareStructuralSignatures, verifyStructuralPseudometric }
  from "@onto2d/structural-geometry/pseudometric";

const input = {
  regimeId: "topology-only-v1",
  leftScope: { kind: "induced", nodeIds: ["a", "b", "c", "d"] },
  rightScope: { kind: "induced", nodeIds: ["w", "x", "y", "z"] },
  diagnostics: "partial-with-coverage"
};
const result = compareStructuralSignatures(leftPack, rightPack, input);
verifyStructuralPseudometric(result, leftPack, rightPack, input);
console.log(result.status, result.distance, result.coverage);
```

Scopes default to full and retain existing induced-scope normalization, limits
and full-source validation. Diagnostics default to `coverage-only`. Closed input
accepts no weights, component selection, scales, tolerances, callbacks, vocabulary
mappings or pairwise approval overrides. The engine factory snapshots a verified
right pack and accepts only an authentic engine Model as its left source.

The policy ID is `fixed-domain-response-pseudometric-v0`, contract version `"1"`.
Schema version remains `"1"`. Existing `/comparison` continues its frozen
observation-level discrete 0/1 contract. Existing signature and probe artifacts,
kernel identity, source packs and website behavior retain their own contracts.

<a id="fixed-domain-structuralpseudometric-v0--coordinates-arithmetic-and-meaning"></a>

### Coordinates, arithmetic and meaning

Each mandatory **whole joint response multiset** is one categorical coordinate.
Untyped regimes have three coordinates; typed-relations has five. Comparison
uses exact canonical values, including correlations, multiplicities and scalar
response deltas. Hashes identify evidence but do not replace value comparison.

For every family, exact equality gives `delta_j = 0`, otherwise `delta_j = 1`.
All weights and scales are fixed to one before evaluation:

```text
d(A,B) = number of differing mandatory families / fixed number of families
```

Distance is a reduced integer fraction `{ numerator, denominator }`, bounded by
zero and one. Zero is always `0/1`, one always `1/1`; no floating approximation,
tolerance or numerical zeroing enters classification. Counts never exceed five.
Each family has equal weight regardless of how many targets or observables it
contains. The distance describes which families differ, not the magnitude of
their differences, a causal probability or a calibrated similarity percentage.

| Status | Full distance | Meaning |
|---|---|---|
| `indistinguishable-under-signature` | `0/1` | All mandatory family values coincide within a complete common domain |
| `distinguishable-under-signature` | Positive exact fraction | At least one family differs, and every family is comparable |
| `indeterminate` | `null` | A required family, invariance gate or common domain is unavailable |

Source provenance, scope IDs, coverage, evidence reasons and hashes are excluded
from coordinates. Geometry, histories and semantic authority are not inferred.

<a id="fixed-domain-structuralpseudometric-v0--fixed-domains-and-proof"></a>

### Fixed domains and proof

A profile fixes the regime, signature profile, ordered component set and policy.
Its mathematical domain contains only source/scoped objects with complete
signatures and passed invariance. Untyped objects share a domain across sources.
For typed-relations, **one exact verified full-source context defines one domain**:
induced fragments from that same context can be compared, but different source
contexts remain incomparable even with identical dictionaries and feature hashes.

Separately approved pairwise code mappings do not construct a global,
transitive semantic coordinate system. This v0 therefore provides no mapping
override. A future cross-source typed domain needs an explicitly accepted,
globally consistent vocabulary/probe policy before scores are generated. Domain mappings and History integration remain separate gates; this bounded
implementation does not claim to solve them.

For a fixed nonempty coordinate set, categorical mismatch obeys nonnegativity,
symmetry, self-zero and triangle: when `x != z`, at least one of `x != y` or
`y != z` holds. Summing these inequalities with the same positive weights and
constant denominator preserves them. The resulting distance is a metric on
feature tuples. Composing it with the fixed feature map yields a pseudometric
on structures because distinct structures may share a tuple. The isolate
collision below demonstrates this limitation directly.

Representation invariance of the feature map makes the pullback invariant.
For typed source renaming, the **entire domain is transported simultaneously**;
within-domain distances survive, while its provenance-bound hash changes.
Comparing an original typed source directly with a renamed source is a
cross-context pair and remains indeterminate. Untyped one-sided renaming is
comparable and has zero distance. No metric law is asserted outside a complete
common domain.

<a id="fixed-domain-structuralpseudometric-v0--missingness-and-exploratory-diagnostics"></a>

### Missingness and exploratory diagnostics

Each component records observed/indeterminate measurements on both sides,
0/1/null component distance and ordered reasons with side and exact count.
Empty selectors, unresolved selection evidence, rejected transformations and
missing observations retain their upstream reasons. An unpassed invariance gate
disables all coordinates on that side. Domain mismatch disables every coordinate
even when both signatures are complete. Coverage counts comparable families
over the fixed three or five; known differences never override a missing family.

The default diagnostics list equal, different and incomplete feature IDs, with
`partial: null`. Opt-in `partial-with-coverage` adds an explicitly exploratory
pairwise available mean, `guarantee: "none"`, its coverage and an exact fraction
or null when no coordinate is usable. Even a zero partial value cannot establish
indistinguishability. It must not be passed to algorithms requiring a metric.

The frozen counterexample works in both actual dimensions `N=3` and `N=5`:

```text
A = (0, missing, 0, ...)   B = (0, 0, 0, ...)   C = (1, 0, 0, ...)
partial(A,B) = 0; partial(B,C) = 1/N; partial(A,C) = 1/(N-1)
1/(N-1) > 0 + 1/N
```

Thus pair-dependent omission breaks triangle. Full distances involving A are
null under the strict contract. An empty abstract component set is also
indeterminate; the public fixed profiles are always nonempty.

<a id="fixed-domain-structuralpseudometric-v0--artifact-verification-and-limits"></a>

### Artifact, verification and limits

The separate comparison artifact embeds both full signatures, including their
response/invariance evidence, fixed policy/profile, normalized request, both
domains and membership eligibility, ordered components, status/distance,
coverage/diagnostics, cumulative work and artifact hash. Domain compatibility
and object membership are distinct: compatible domains can contain ineligible
inputs, and two eligible typed inputs can belong to incompatible domains.

Verification reconstructs the entire artifact from expected sources and input,
then checks exact canonical equality. Rehashing a forged distance, profile,
domain, feature, nested probe result, reason, count or work total is insufficient.
Closed schemas check structural constraints; cross-record arithmetic and source
authority require this replay. Browser and Node use the same portable runner.

All upstream budgets remain, plus five components, 140 cumulative observations,
280 bounded canonicalizer calls, two million canonical entries and 16 MiB
cumulative/final output. Canonical depth and per-string bounds are inherited.
Inputs and outputs are immutable snapshots. Unsupported requests, malformed
sources, exceeded limits and invalid encodings throw without a partial artifact.

<a id="fixed-domain-structuralpseudometric-v0--observed-controls-and-next-stage"></a>

### Observed controls

The 60 frozen comparisons produce 28 indistinguishable, 22 distinguishable and
10 indeterminate results. Complete 4×4 matrices in all three regimes use induced
fragments of a common verified source. Subdividing the feedback edge has distance
`2/3` canonical, `1/1` topology and `3/5` typed. Changing contextual necessity has
distance `1/5` typed and zero in both untyped regimes. Adding an isolated node
has zero in all three regimes despite the different node count.

Independent Python reconstructs graph responses/signatures and computes exact
fractions. Exhaustive categorical controls cover 59,778 ordered pairs and
14,368,590 ordered triangles. All 728 aggregation profiles of lengths zero
through five cover both diagnostic modes. Forty-eight source-pair transports
check representation invariance. These are bounded computational checks, not
evidence of empirical usefulness or universal separation.

<a id="geometricsignature-v1"></a>

## GeometricSignature-v1

GeometricSignature-v1 combines certified curvature and flow descriptors for
one source-bound population. It records coverage, alignment and stopping
events. These descriptors alone establish no empirical added value.

<a id="geometricsignature-v1--public-api-and-evidence"></a>

### Public API and evidence

`@onto2d/structural-geometry/geometric-signature` exports
`buildGeometricSignature(pack, input, expectedEvidence)`,
`verifyGeometricSignature(value, pack, input, expectedEvidence)`,
`createGeometricSignatureAnalysis(expectedEvidence)`, the fixed policy and two
schema URLs. The policy ID is `geometric-signature-v1`, contract/schema version
`"1"`. Earlier response signatures, pseudometrics and geometric solvers retain
their exact contracts and artifacts.

```js
import { buildGeometricSignature, verifyGeometricSignature }
  from "@onto2d/structural-geometry/geometric-signature";

// A locally computed Forman layer; external layers are explicitly not requested.
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

Every request explicitly declares all three layers. Non-null slots accept the
existing provider-analysis, Ollivier or flow request respectively. Forman uses
the existing provider wrapper and is recomputed locally. Ollivier and flow use
externally supplied **expected artifacts**, verified against the expected pack
and request with their existing exact certificate checkers. Their existing
analyzers/adapters can produce those artifacts; this module does not introduce
another solver or a network call.

A null request means `not-requested`; a requested external layer with null
evidence means `missing-evidence`. Malformed, mismatched or uncertified evidence
throws. Evidence for an unrequested layer also throws. Availability is part of
expected verification: a forged artifact cannot discard known evidence and
legitimately replace it with a missing result. No caller bins, summaries,
callbacks, distances, weights or feature subsets are accepted.

<a id="geometricsignature-v1--one-population-and-bounded-compatibility"></a>

### One population and bounded compatibility

All requested layers must address exactly the same source node and edge sets,
even when external receipts are missing. The common population is prepared from
the verified full source. Ollivier may analyze only some edges of that graph;
its partial coverage is explicit. Different layer populations are rejected.

The bounded common population has at most 64 nodes and 64 edges. Forman retains
the existing full-node population and optional typed edge selection, including
full-source weight normalization/audit. It does not gain a new induced-scope
adapter here. Consequently a Forman selection can combine with another layer
only when their actual populations coincide. Existing induced real-source
Ollivier/flow controls can disable Forman explicitly. This boundary prevents
combining curvature from a full model with a flow on a different fragment.

When all layers are disabled, the source population remains bound and the whole
signature is indeterminate. Empty curvature populations yield no measured
distribution or extrema. No target truncation or hidden sampling is performed.

<a id="geometricsignature-v1--scalar-distributions-and-extrema"></a>

### Scalar distributions and extrema

Each scalar descriptor records the exact multiset of closed rational intervals,
with exact multiplicity and signs. Rational numerators/denominators are reduced
integer strings. Unit Forman and transport scalars are point intervals. Weighted
Forman preserves both certified outward interval endpoints at the existing
12-decimal scale, converted exactly to rational bounds. No midpoint, rounding
to a point or tolerance-based equality is introduced.

Signs are negative when the upper bound is below zero, positive when the lower
bound is above zero, zero only for `[0,0]`, and unresolved otherwise. An observed
interval descriptor does not assert that its underlying exact value is resolved.

For a family of intervals `[l_e,u_e]`, minimum bounds are
`[min(l_e), min(u_e)]`; maximum bounds are `[max(l_e), max(u_e)]`.
A possible minimum edge has `l_e <= min(u_e)`. A certain minimum has
`u_e <= l_other` for every other edge. Maximum rules reverse the inequalities.
Possible and certain attaining sets are inclusive, preserving all exact ties.
For a singleton interval both sets contain its sole edge, even if its value is
uncertain.

Extrema have invariant role multisets containing the source and target in/out
degrees in the common graph. These are numerical endpoint roles, not inferred
semantic categories. Exact attaining source edge IDs are retained separately
in provenance. IDs, source hashes and presentation fields do not enter values.

<a id="geometricsignature-v1--flow-alignment-stopping-and-cut-events"></a>

### Flow alignment, stopping and cut events

The flow layer consumes every verified state. Each observed frame contains the
joint normalized length/curvature multiset, both scalar distributions/extrema,
actual maximum changes from the preceding frame and the existing stable-step
count. Joint rows preserve correlations that separate marginal histograms lose.

Frame slots run from absolute iteration zero through the declared cap. A slot
after termination has `value: null` and `reason: "after-<termination>"`. There is
no carry-forward, zero padding, interpolation, time rescaling or best-match
alignment. A short trace remains a partial fixed-horizon feature, even when its
termination is a valid fixed point. Later framewise comparison must use the same
integer iteration and observed coverage on both sides.

| Termination | Preserved meaning |
|---|---|
| `fixed-point` | Exact normalized metric repeated on the next state |
| `cycle` | Exact metric recurrence with cycle start and period |
| `tolerance` | Existing consecutive stability criterion was met |
| `iteration-limit` | Requested cap reached; no convergence inference |
| `degenerate-length` | Stopped before a prohibited zero-length update |

Full frame coverage can occur at an iteration limit; it describes coverage,
not convergence. All source termination evidence remains embedded. Numeric,
process, validation or resource errors still throw rather than become fabricated
terminal observations.

The final cut retains its exact policy, iteration, removed count, weak/strong
component-size multisets and connectivity. Source IDs and full partitions remain
in provenance. For a configured strict final-length threshold, additional
descriptors report above-threshold, entering and exiting counts at each actual
frame, and the multiset of consecutive terminal above-threshold run lengths for
edges above threshold at the final state. Equality with the threshold is not
above it. Counts at frame zero compare against an empty prior set; it is the
initial membership event, not a preceding measured transition.

These measured persistence events can identify candidate boundaries for further
study. They do not establish semantic bottlenecks or stability across parameters.
No-cut requests have `thresholdEvents: null`, which is distinct from a measured
empty above-threshold set. Future unobserved frames do not contribute events.

<a id="geometricsignature-v1--coverage-hashes-and-interpretation"></a>

### Coverage, hashes and interpretation

There are three ordered mandatory families: `forman-curvature-v1`,
`ollivier-curvature-v1`, `flow-trajectory-v1`.

| Feature state | Value | Coverage |
|---|---|---|
| `observed` | Complete measured descriptor | All common edges, or all declared frame slots |
| `partial` | Measured descriptor with explicit omissions | Partial Ollivier edge set or early-stop flow horizon |
| `unavailable` | `null` | Not requested, missing evidence or empty curvature population |

Feature value hashes also identify measured partial descriptors; their presence
does not certify completeness. A whole value and its profile-bound fingerprint
exist only when all three families are observed. Otherwise whole value/hash are
null and the summary lists partial and unavailable families. Four of the 25
controls are complete under this policy; 21 retain explicit indeterminate states.

Profiles bind provider/selection/numeric/transport policies and flow settings.
Explicit unit lengths normalize to the same initialization kind as omitted unit
lengths. Other explicit assignments are marked `explicit-source-lengths`.
Full source/scopes, edge assignments, provider contexts and certificates remain
in requests/evidence. Raw IDs and explicit edge-to-length assignments are excluded
from invariant profile/value fingerprints. Matching fingerprints alone do not
authorize comparison across sources, vocabularies, interval uncertainties or
different initial metric assignments.

This module exports no distance, equivalence status or geometry-added-value score.
The response-only pseudometric is unchanged. The [separate study](EVIDENCE.md#finite-prospective-response-versus-geometry-evaluation)
freezes full-source topology responses, exact unit initialization/curvature
and complete frame/edge coverage. Other initializations and unresolved interval
profiles remain outside that comparison domain. Full descriptor coverage alone
does not supply those comparison decisions.

<a id="geometricsignature-v1--verification-bounds-and-evidence"></a>

### Verification, bounds and evidence

The additive artifact contains the verified source context, common population,
normalized request, fixed policy/profile, full provider/curvature/flow evidence,
features/provenance, coverage, whole value/hash, work and artifact hash.
Verification reconstructs this entire artifact from expected inputs and receipts.
Rehashing an altered distribution, extreme role, future frame, event, termination,
certificate, population or work count does not bypass replay.

Output and engine evidence snapshots are immutable. Browser verification uses
the same certificate/descriptor code without running a solver. Two closed schemas
and readonly types preserve null/partial states; cross-record arithmetic, source
authority and certificate validity still require runtime verification.

All upstream budgets remain. Composition permits 25 frames, 3,328 scalar samples,
1,600 joint samples, two million canonical entries and 24 MiB cumulative/final
output. Rational bounds inherit the existing exact representation. There is no
partial-success artifact after an error.

Independent source measurements use pinned NetworkX 3.2.1 network simplex and
Dijkstra plus the separate Decimal/Fraction Forman reference. A second, standard
library Python reference independently derives distributions, interval feasibility,
degree roles, horizon coverage and backward threshold runs. The 25 source controls,
781 interval profiles, 820 threshold traces and 40 coverage adjudications agree.
All 25 source/request transports preserve values, hashes, coverage and events.
These are bounded computational checks, not empirical validation of geometry.
