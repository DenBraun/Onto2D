# Structural Geometry — Observations

- [distinguishability regime and observable contracts](#distinguishability-regime-and-observable-contracts)
- [exact canonical directed observations](#exact-canonical-directed-observations)
- [Directed topology observations](#directed-topology-observations)
- [Typed directed observations and vocabulary alignment](#typed-directed-observations-and-vocabulary-alignment)
- [Strict structural comparison and mandatory coverage](#strict-structural-comparison-and-mandatory-coverage)

<a id="distinguishability-regime-and-observable-contracts"></a>

## distinguishability regime and observable contracts

Three frozen regimes define what is observed, which evidence is mandatory and
how matching works. Preparation binds a verified source and scope; measured
observations and comparisons are separate artifacts.

<a id="distinguishability-regime-and-observable-contracts--delivered-boundary"></a>

### Delivered boundary

`@onto2d/structural-geometry/regimes` publishes three frozen regimes, nine
observable specifications and source-bound preparation/verification. Preparation
is useful for inspecting the precise observation contract, selecting a feasible
scope and recording source provenance before running an evaluator.

**This API does not compute observations or compare two structures.** Every
preparation has `evaluation: "not-run"`; its closed schema excludes measured
values, comparison status and distance. Suppliers identify exact operations;
their declarations alone do not install evaluators. Empty probe-set declarations
mean no probes are configured or executed by these preparation artifacts. They
are not successful invariance tests. The implementation provides a separate
[invariance registry](SIGNATURES.md#measured-structural-invariance-probes); The implementation provides the separately bound
[response registry](SIGNATURES.md#graph-native-response-probes). Both retain these frozen declarations.

Canonical, topology and typed evaluators produce separate measured artifacts.
Strict comparison, probes and signatures consume them under their own contracts
below. Remaining biological work is owned by the [research plan](RESEARCH.md).

<a id="distinguishability-regime-and-observable-contracts--fixed-profiles"></a>

### Fixed profiles

| Regime | Mandatory ordered observations | Scoped limit | Matching boundary |
|---|---|---|---|
| `canonical-structure-v1` | Canonical directed structure, including isolates | 1–6 nodes, 30 edges | Exact directed graph isomorphism, all node bijections permitted; source IDs and attributes excluded |
| `topology-only-v1` | Node count; edge count; sorted weak-component sizes; sorted SCC sizes; reachable ordered-pair count; cyclic-node count; isolated-node count | 1–64 nodes, 256 edges | Equality of this lossy seven-component profile; no graph-isomorphism claim |
| `typed-relations-v1` | Canonical directed structure; canonical directed structure with edge types | 1–6 nodes, 30 edges | One common node bijection must preserve adjacency and all five edge fields |

Reachability counts distinct ordered pairs `(u,v)` with `u != v` connected by
a directed path, once per pair. Component vectors include singleton isolates
and sort numerically ascending. Cyclic nodes belong to SCCs of size greater
than one; the inherited source policy rejects self-loops. No simple-cycle
enumeration, path multiplicity, diameter or adjacency matrix is hidden in the
summary profile. For example, an outward star and its inward reversal have
the same listed summaries, although their directed structures differ. SG2-012
retains this explicit collision and verifies separation with the exact evaluator.

Typed fields are `dependencyTypeId`, `interactionModeIds`, `ontologicalRole`,
`necessity`, `causalDirectionIds`. Codes are nonnegative safe integers. ID
arrays represent sets sorted numerically; duplicates are invalid. Role and
necessity universes reuse the established typed-selection policy. Absent fields
are mandatory evidence gaps, whereas explicitly declared empty sets are observed
empty sets. Neither weights nor scientific confidence become type coordinates.

<a id="distinguishability-regime-and-observable-contracts--identity-and-matching-policy"></a>

### Identity and matching policy

All contracts use string schema/version `"1"`. A regime binds the source
projection policy, induced-scope policy, matching, vocabulary, ordered observable
references, declared invariances, both probe sets, missingness, aggregation and
resource bounds. Each reference contains ID, version and content hash. Observable
specs bind value type, scope, units, normalization, mandatory evidence, definition
and supplier operation. Nested policy hashes use their complete closed content.

Hash domains start with `onto2d:structural-regime-` and end with `:v1`:
`policy`, `observable`, `descriptor`, `node-color`, `scope`, `preparation` and the
case `suite`. The projection hash uses the existing projection-policy domain;
source/dictionary/context bindings reuse MetricProvider's existing domains.
No old hash, schema or numeric artifact changes.

Exact matching is bounded at 100,000 kernel search states per canonicalizer
call, including its skeleton and candidate phases. The untyped profile requires
one such observation; the typed profile declares two, so its total allowance
is at most 200,000 states before any future reuse. The declared
`canonicalizeCandidate` translation uses `single-candidate`, a uniform synthetic
SHA-256 node reference, a constant `source-parent` edge role, preserved direction
and a disconnected-compatible graph policy. The synthetic reference is a uniform
color, not a source record or kernel-package identity. Typed set attributes must
be encoded as canonical JSON strings of sorted integer arrays because the kernel
accepts scalar attributes, not arrays. A contract test checks interface feasibility;
The implementation provides independent untyped matching checks; SG2-013 now independently
checks joint typed matching and approved code remapping. Exhaustion must
raise an error, never produce a heuristic exact identity. No kernel changes are
introduced. The summary profile uses no graph canonicalizer and permits at most
4,096 distinct reachability pair visits, with its node/edge bounds also limiting
traversal work. All preparations use at most 100,000 canonical entries and 1 MiB.

Permitted relabeling changes source and preparation hashes. Observation values
are invariant under the declared mapping; source-bound witnesses may change. Canonical JSON
serializes a labeled object deterministically; it is not graph isomorphism.
Scope membership must travel with any node renaming. Presentation changes have
no comparison coordinates. A direction-reversal response is not silently added
to the declared invariance set.

Typed meanings are bound to the full source dictionary hash. Equal code numbers,
or even equal dictionary bytes in different models, do not authorize a common
vocabulary. Cross-model comparison requires an explicit reviewed shared-vocabulary
binding or mapping; this preparation API neither accepts nor manufactures one.
SG2-013 now provides a separate mapping and alignment API; missing compatibility
produces unresolved alignment with null values. Final comparison will translate
that evidence gap to indeterminate. Availability/provenance metadata remains
outside future distance coordinates.

The frozen strict policy requires null complete distance and indeterminate
status for mandatory missing/unavailable/rejected/unresolved evidence, retaining
observed differences as diagnostics. Invalid artifacts raise validation errors.
Exact complete equality/difference has no tolerance threshold. Intervals and
partial distances are unsupported; numerical distance construction remains a
separate comparison contract. These are declarations, not implemented comparisons.

<a id="distinguishability-regime-and-observable-contracts--source-bound-preparation-api"></a>

### Source-bound preparation API

```js
import {
  getDistinguishabilityRegime, prepareStructuralRegime,
  verifyStructuralRegimePreparation
} from "@onto2d/structural-geometry/regimes";

const regime = getDistinguishabilityRegime("canonical-structure-v1");
const input = {
  regimeId: regime.id,
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] }
};
const preparation = prepareStructuralRegime(verifiedCausalPack, input);
verifyStructuralRegimePreparation(preparation, verifiedCausalPack, input);
// preparation.evaluation === "not-run"
```

An explicit regime ID is required. Omitting `scope` means the complete source;
an oversized source fails instead of choosing a fragment automatically. Induced
scope IDs must be distinct, present in the source and within the regime bound;
request order is normalized without mutating the request. Empty scopes fail.
Source node and edge IDs are opaque Model Pack strings: leading/trailing
whitespace is preserved exactly in requests, witnesses and boundary partitions.
An untrimmed ID and its trimmed spelling are different identifiers. Input and
preparation schemas accept the same source spelling as the runtime.

The complete Model Pack and full projection are verified **before** scope
selection, so corrupt or forbidden excluded records cannot be hidden. The
artifact retains the R2 context, including the full dictionary hash. This does
not compute metric values or normalize a length state. Selected isolates remain.
Every source edge belongs to exactly one recorded partition: internal, incoming
boundary, outgoing boundary or external. The scope hash includes the full source
projection identity. Boundary edges do not silently enter scoped observations.

`verifyDistinguishabilityRegime(value, expectedId)` and
`verifyStructuralObservationSpec(value, expectedId)` require exact built-in
content. Rehashing an altered policy is insufficient. Preparation verification
reconstructs everything from the expected source and request; a self-asserted
artifact or context hash supplies no authority.

Four additive closed schemas cover observable spec, regime, input and preparation.
Schema validation checks shape and fixed profiles; runtime replay additionally
checks source identity, partition completeness and cross-record relationships.
Readonly TypeScript declarations and browser bundles expose the same API.
`createStructuralRegimePreparationAnalysis()` opts into engine analysis
`structural-regime-preparation` through the authentic Model bridge.

<a id="distinguishability-regime-and-observable-contracts--reproducible-examples"></a>

### Reproducible examples

The [six examples](../../cases/structural-geometry/regimes/README.md) bind each
regime to a declared five-node control and a six-node Causal Emergence fragment.

```sh
npm run structural-geometry:regimes:check
npm run structural-geometry:regimes:report
```

Only `structural-geometry:regimes:build` regenerates the frozen preparations.
The report verifies stored bytes before displaying scope counts and `not-run`.
No benchmark discrimination score or scientific validation is produced here.

<a id="exact-canonical-directed-observations"></a>

## exact canonical directed observations

Exact canonical observation measures bounded directed graph structure, including
isolates, independently of source labels. Its witnesses bind the canonical
structure back to the original source and scope.

<a id="exact-canonical-directed-observations--implemented-boundary"></a>

### Implemented boundary

`@onto2d/structural-geometry/canonical` computes the first mandatory observation
declared by the [SG2-010 contracts](#distinguishability-regime-and-observable-contracts). It preserves the directed
adjacency and every selected node, including isolates, modulo arbitrary node
renaming. Source IDs, names, attributes, dictionaries, geometry and scientific
confidence remain outside the observed value.

This is a measured observation of one verified scoped graph. It is not the
three-regime comparison API, a response signature or an empirical equivalence
claim. Topology and typed evaluators and
[strict three-regime comparison](#strict-structural-comparison-and-mandatory-coverage) now implement the
remaining bounded R3 contracts in separate artifacts. The
[immutable sandbox](SIGNATURES.md#immutable-structural-probe-sandbox) now supplies the next execution layer;
the separate [invariance registry](SIGNATURES.md#measured-structural-invariance-probes) now measures its controls,
and the separate [response registry](SIGNATURES.md#graph-native-response-probes) measures exhaustive
graph-native transformations. The implementation provides separate
[response signatures](SIGNATURES.md#graph-native-responsesignature-v0); their separate
[fixed-domain pseudometric](SIGNATURES.md#fixed-domain-structuralpseudometric-v0) now completes bounded R6.

<a id="exact-canonical-directed-observations--api-and-artifacts"></a>

### API and artifacts

```js
import {
  observeCanonicalStructure, verifyCanonicalStructureObservation,
  createCanonicalStructureObservationAnalysis
} from "@onto2d/structural-geometry/canonical";

const input = {
  regimeId: "canonical-structure-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] }
};
const artifact = observeCanonicalStructure(causalPack, input);
verifyCanonicalStructureObservation(artifact, causalPack, input);
console.log(artifact.observation.value, artifact.observation.valueHash);
```

The regime must be explicit. Omitting scope selects the full source. Supported
scopes contain 1–6 nodes and at most 30 loopless, nonparallel directed edges.
The full 249-node Causal Emergence release therefore requires an explicit induced
fragment. Oversized graphs, invalid source records, unsupported regimes and
undeclared parameters raise errors; they do not yield a partial observation.

The evaluator verifies and snapshots the complete Model Pack, then invokes the
unchanged preparation API. It uses only that frozen source for later reads.
Corrupt records and unsupported topology outside the selected scope still fail.
Boundary-edge accounting remains attached to the exact original preparation.

The closed artifact contains:

- `evaluation: "measured"`, an explicit analysis and implementation identity;
- `preparation`, byte-identical to the existing SG2-010 preparation, including
  its own `evaluation: "not-run"` marker for that preparatory step;
- `observation`, with regime/spec/implementation content references, canonical
  `{nodeCount, edges: [{from, to}]}` and its content hash;
- `witness`, with every source node mapped to a canonical integer in `0..n-1`,
  every source edge mapped to directed canonical endpoints, kernel candidate
  and skeleton hashes, and deterministic search statistics;
- a separate source-bound `artifactHash` over the complete artifact.

`valueHash` excludes source metadata, source IDs, scope provenance and witness
tie choices. It binds the exact canonical payload and regime/spec/implementation
references. Equal verified values under those same contracts express the same
directed structure under permitted relabeling. They do not imply identical Model
Packs, shared mechanisms or matching domain semantics. An outward and inward
three-node star have different values despite equal counts and weak skeletons.

`verifyCanonicalStructureObservation(artifact, expectedPack, expectedInput)`
recomputes both preparation and matching. Merely rehashing a forged value or
mapping cannot satisfy replay. A different valid automorphism witness is still
a different artifact: verification promises the deterministic source replay,
not acceptance of every possible isomorphism certificate.

No `distance`, comparison `status`, probe result or response signature is added.
Two additive schemas and readonly TypeScript declarations cover the new API;
all old closed v1 schemas and artifacts are preserved. The engine factory opts
into `structural-canonical-observation` through the authentic Model bridge.
The same API computes and verifies all examples in a browser bundle.

<a id="exact-canonical-directed-observations--faithful-translation-and-exact-matching"></a>

### Faithful translation and exact matching

The adapter reuses the frozen `directed-candidate-matching-v1` contract. Each
selected node receives the same synthetic content-hash reference. Each edge
receives the same `source-parent` role and retains its ordered endpoints. No
attributes are passed. Disconnected graphs are explicitly permitted. Source
node and edge IDs determine input order only, and are kept in the witness.

This translation is faithful: any directed-graph isomorphism preserves the
uniform candidate labels and ordered edges. Conversely, any candidate
isomorphism preserves the original directed adjacency and node count because
all labels are uniform and every edge is represented exactly once. The kernel's
undirected skeleton is a redundant derived part of candidate identity; it
does not replace the directed candidate comparison. The observed value retains
the canonical directed endpoints returned by the candidate canonicalizer.

Canonical JSON alone does not perform this matching. The production kernel
uses bounded graph canonicalization, while the independent reference enumerates
all node permutations and minimizes a directed adjacency bitmask. The two
implementations need not choose the same canonical numbering. Their isomorphism
partitions must coincide in both directions, and every output must remain in
the source graph's independently computed orbit.

One witness mapping is **not an invariant target selector** on a symmetric
graph. Permuting indistinguishable leaves may change which source leaf receives
a particular canonical number. Future probes must use their declared orbit,
role or invariant aggregation policy; they must not select a scientific target
by an arbitrary witness number or lexicographically first source ID.

Matching uses the unchanged six-node/30-edge/100,000-search-state limits. The
budget counts both kernel skeleton and candidate phases in one call. Kernel
budget exhaustion propagates as an error; there is no approximate identity or
fallback. Canonical serialization remains bounded at 100,000 entries and each
complete observation artifact at 1 MiB. A preparation near its own byte limit
can exceed the observation envelope's limit after adding a value and witness;
that produces an explicit error.

The additive `@onto2d/kernel/graph-canonicalizer` export routes directly to the
existing functions and declarations. It allows browser use without importing
the full kernel's Node-only Oracle validator. No graph algorithm, kernel
operation, default policy or previous result changes.

Hash domains use `onto2d:structural-canonical-{kind}:v1`: `implementation`,
`value`, `artifact`, and the case `reference`, `census-value`, `census`, `suite`.
The immutable implementation ID is `canonical-directed-observation-v1`.
Changes to the scientific profile or canonical numbering contract require a
separately identified implementation/profile and review of frozen outputs.

<a id="exact-canonical-directed-observations--independent-acceptance-controls"></a>

### Independent acceptance controls

The [case suite](../../cases/structural-geometry/canonical/README.md) contains:

| Nodes | All labelled loopless directed graphs | Independent isomorphism classes |
|---|---:|---:|
| 1 | 1 | 1 |
| 2 | 4 | 3 |
| 3 | 64 | 16 |
| 4 | 4,096 | 218 |

For all 4,165 graphs, the adapter's canonical values match the 238 independently
enumerated classes with no false merge or split. The census also checks that
every value and node mapping reconstruct the source's directed edges. All 720
relabelings of a declared asymmetric six-node graph preserve the canonical
value. This does not claim exhaustive enumeration of all five/six-node graphs.

Seventeen frozen public observations include isolates, directed/reciprocal
edges, opposite star orientations, cycles, disconnected graphs, six-node
symmetry, relabeling/annotation controls and the six-node/11-edge real source
fragment. Python independently checks their permutation orbits and complete
mapping witnesses. Explicit UTF-8 I/O preserves Unicode controls across platforms.

```sh
npm run structural-geometry:canonical:check
npm run structural-geometry:canonical:report
```

Both commands replay frozen outputs. Deliberate observation regeneration uses
`structural-geometry:canonical:build`; the independent reference has a separate
explicit `python3 -B cases/structural-geometry/canonical/reference.py --write`.
These controls establish bounded computational agreement, not empirical usefulness.

<a id="directed-topology-observations"></a>

## Directed topology observations

Seven directed summaries provide a deliberately lossy description of graph
organization. Exact canonical controls expose collisions; equal topology
summaries do not prove graph isomorphism.

<a id="directed-topology-observations--observations-and-interpretation"></a>

### Observations and interpretation

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
[exact canonical evaluator](#exact-canonical-directed-observations) separates the two graphs.
More generally, reversing **every edge** preserves all seven summaries:
components keep their memberships, reachable pairs transpose, and cyclic and
isolated nodes stay the same. Directed traversal is still necessary; for
example, a three-node directed chain has three reachable pairs, whereas either
star has two. The summary's equality is intentionally weaker than isomorphism.

<a id="directed-topology-observations--public-api-and-source-binding"></a>

### Public API and source binding

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

<a id="directed-topology-observations--algorithm-bounds-and-errors"></a>

### Algorithm, bounds and errors

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

<a id="directed-topology-observations--independent-evidence"></a>

### Independent evidence

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

<a id="typed-directed-observations-and-vocabulary-alignment"></a>

## Typed directed observations and vocabulary alignment

Typed observation requires one common graph matching that preserves all declared
edge types. Cross-source vocabulary alignment is explicit and separately
verified; missing type evidence does not become an empty observed value.

<a id="typed-directed-observations-and-vocabulary-alignment--one-common-graph-matching"></a>

### One common graph matching

| Field | Accepted value | Interpretation |
|---|---|---|
| `dependencyTypeId` | Nonnegative safe integer | Local dependency-type code |
| `interactionModeIds` | Distinct nonnegative safe integers | Local code set, sorted numerically |
| `ontologicalRole` | `arising`, `maintenance`, `modulation` | Declared role |
| `necessity` | `necessary`, `enabling`, `contextual`, `optional` | Declared necessity class |
| `causalDirectionIds` | Distinct nonnegative safe integers | Local code set, sorted numerically |

One node bijection must preserve directed endpoints and **all five fields
together**. The implementation translates to the existing kernel candidate
canonicalizer using the frozen uniform node reference, fixed source-parent role,
disconnected support and the five structural edge attributes. Arrays become
canonical JSON strings of numerically sorted sets for the kernel's scalar
attribute interface; the public result decodes them back to arrays.

Independent per-field matching is insufficient. Two reciprocal-edge controls
have the same untyped graph and a valid matching for each individual field,
but disagree on which dependency and interaction codes belong together. Their
joint typed values differ. This control prevents a false match from independently
canonicalizing each field or comparing only type histograms.

Source node IDs, edge IDs, labels, weights, confidence, scientific status,
quantization and other annotations do not enter observation coordinates.
Isolates and directed structure remain. A witness records one deterministic
bijection with every normalized edge tuple; it neither computes canonical
orbits nor supplies invariant probe targets.

<a id="typed-directed-observations-and-vocabulary-alignment--measurement-missing-evidence-and-local-code-identity"></a>

### Measurement, missing evidence and local code identity

```js
import { observeTypedRelations, verifyTypedRelationsObservation,
  createTypedRelationsObservationAnalysis } from "@onto2d/structural-geometry/typed";

const input = {
  regimeId: "typed-relations-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2", "0.3", "0.4", "0.5"] }
};
const result = observeTypedRelations(pack, input);
verifyTypedRelationsObservation(result, pack, input);
console.log(result.observations[1].availability);
// Register createTypedRelationsObservationAnalysis() explicitly with an engine.
```

Scope defaults to the full graph. The full Model Pack and its source projection
are verified before scoped measurement. Every **present** typed field in the
complete source is validated, so an invalid excluded field cannot be hidden.
Absent excluded fields do not create scoped gaps. Internal edges alone supply
the measured tuples; all boundary partitions remain in preparation provenance.

An absent scoped field is missing mandatory evidence. An explicitly declared
empty code array is a valid observed empty set. Null, wrong types, duplicate set
members, unknown role/necessity strings and unsafe integers are validation
errors. No default role, code or empty set fills a missing field.

The immutable artifact contains the unchanged preparation, full local vocabulary
binding, two ordered observations, field-evidence accounting and an artifact hash:

- `observations[0]` always measures the exact untyped graph under the typed
  regime's first spec. Its value agrees with SG2-011; its value hash binds the
  typed regime/implementation, so it is not the SG2-011 artifact identity.
- `observations[1]` contains the jointly typed graph and complete witness when
  all scoped edge fields are present. Its availability is `"observed"`.
- If any scoped field is absent, the second observation has availability
  `"missing"` and null `value`, `valueHash` and `witness`. The envelope records
  `evaluation: "incomplete"` while retaining the untyped observation and every
  `{sourceEdgeId, field}` gap. Otherwise evaluation is `"measured"`.
- Evidence counts are `5 × scopedEdgeCount`, observed field count and the gap
  list. An isolate-only graph has complete, vacuous edge evidence.

The vocabulary binds the exact source model identity, full dictionary hash from
R2 and the existing vocabulary policy. Model Pack dictionaries are opaque JSON:
this evaluator does not assume universal table names, infer dictionary meanings
from labels or assert that every local code has a reviewed dictionary entry.
It observes declared code symbols in their source context. Domain code lookup
and scientific justification of a vocabulary mapping require separate evidence.

**A typed value hash is a fingerprint of the canonical graph with raw local
codes. It is not cross-source semantic equality.** The value hash binds regime,
spec and implementation but excludes source IDs/dictionaries to retain the
declared observation invariances. Dictionary/model identity stays in provenance
and the compatibility gate. Two equal hashes with incompatible vocabularies
cannot authorize a typed comparison.

<a id="typed-directed-observations-and-vocabulary-alignment--explicit-mapping-authority"></a>

### Explicit mapping authority

`createStructuralVocabularyMapping(leftPack, rightPack, declaration)` binds two
verified full-source vocabularies and this closed declaration:

```js
const declaration = {
  id: "reviewed-domain-mapping",
  version: "1",
  fields: {
    dependencyTypeId: [{ left: 0, right: 10 }],
    interactionModeIds: [{ left: 0, right: 3 }],
    ontologicalRole: [{ left: "arising", right: "arising" }],
    necessity: [{ left: "necessary", right: "necessary" }],
    causalDirectionIds: [{ left: 0, right: 0 }]
  },
  reviewEvidence: { reference: reviewReference, contentHash: reviewContentHash }
};
```

All five maps are explicit. A field's entries form a partial bijection: neither
left nor right values may repeat. Arrays map individual member codes. Entry
order is normalized; a map may include unused values. An identity mapping can
declare a reviewed shared vocabulary. Role/necessity correspondences are also
explicit and must stay within their frozen universes.

Creating or verifying this artifact does **not** approve it. The review-evidence
reference records provenance; the runtime does not fetch that document,
authenticate its author or establish scientific review from a self-asserted
hash. The calling application must freeze its accepted mapping hash through
its own review process before examining comparison outcomes. Verification with
`verifyStructuralVocabularyMapping(mapping, leftPack, rightPack, expectedDeclaration)`
checks exact endpoint/declaration replay against separately expected inputs.

```js
import { alignTypedRelations, verifyTypedRelationsAlignment }
  from "@onto2d/structural-geometry/typed";

// approvedMappingHash comes from trusted, previously frozen caller policy.
// Do not obtain approval automatically from the artifact being submitted.
const options = { mapping, approvedMappingHash };
const alignment = alignTypedRelations(leftPack, leftInput, rightPack, rightInput, options);
verifyTypedRelationsAlignment(alignment, leftPack, leftInput, rightPack, rightInput, options);
```

Without a mapping, only the same **exact** source model binding and dictionary
hash establish local vocabulary compatibility. Different releases, relabeled
sources or metadata revisions require explicit mapping even when dictionary
bytes match. This is a conservative compatibility rule; equal model names or
local numbers supply no implicit cross-source authority.

An approved mapping must cover every value used in every scoped field on both
sides. Right-hand values translate into the left vocabulary. The implementation
then reruns joint typed canonicalization with original right source IDs retained
in its witness. Replacing numbers in an already canonical result is insufficient:
the new field order can change the canonical node numbering.

The alignment artifact records both source observations, mapping and externally
expected approval hash. `compatibility.state` is `"compatible"` or `"unresolved"`.
Missing types, missing approval/mapping or uncovered values produce explicit
reasons and `aligned: null`. Malformed or wrong-source mappings throw even if
another evidence gap would already prevent alignment. Compatible results contain
both canonical values/witnesses in the left vocabulary and its domain hash.
They may still be different graphs: compatibility is not graph equality.

There is no final comparison status or numeric distance here. Pair-oriented
alignment is not a fixed global metric domain. A future complete-domain
pseudometric must freeze one common vocabulary/mapping policy across its domain.

<a id="typed-directed-observations-and-vocabulary-alignment--limits-and-contracts"></a>

### Limits and contracts

The existing regime allows 1–6 nodes, 30 edges, 100,000 search states per kernel
call, 100,000 canonical entries and 1 MiB per complete artifact. Each observation
uses at most two canonicalizer calls, including their skeleton phases. Each
alignment uses at most five calls: two observations and right-side rematching.
The separate alignment policy limits mapping entries to 1,024 across all fields.
No truncation, greedy identity or partial typed graph is substituted on failure.

Five additive closed schemas cover typed input/observation, mapping declaration,
source-bound mapping and alignment. Runtime verification recomputes full expected
results, including values, witnesses, evidence, approval and source provenance.
Schema validation checks shape and local consistency, not graph isomorphism,
injectivity across map rows, total entry counts or arithmetic reconciliation.
Readonly declarations and browser/Node replay use the same public API. Evaluator
errors use `STRUCTURAL_TYPED_`; inherited source/preparation/kernel errors remain.

Hash domains are `onto2d:structural-typed-{implementation,value,observation,
alignment-policy,vocabulary-mapping,vocabulary-domain,alignment}:v1`.
Value hashes exclude availability and witnesses; the complete artifact binds
all of them. No existing hash domain or accepted artifact is rewritten.

<a id="typed-directed-observations-and-vocabulary-alignment--independent-controls"></a>

### Independent controls

The [case suite](../../cases/structural-geometry/typed/README.md) freezes 26
observations (24 complete, two incomplete), five mappings and eight alignments
(four compatible, four unresolved). Python independently enumerates all node
permutations and checks graph orbits, complete original/remapped witnesses and
evidence accounting. The exhaustive census uses absent/A/B edges with two fixed
five-field tuples:

| Nodes | Labeled graphs | Typed isomorphism classes |
|---|---:|---:|
| 1 | 1 | 1 |
| 2 | 9 | 6 |
| 3 | 729 | 138 |

All 739 graphs agree without false merges/splits. All 720 relabelings of a
six-node control retain its typed value. Additional controls exercise each
field, joint correlations, sets, missing data, Unicode IDs, source/dictionary
changes, complete six-node graphs and explicit vocabulary approval. The unchanged
Causal Emergence release contributes its six-node/11-edge fragment with all
55 scoped fields present. No cross-domain mapping is inferred for that source.

```sh
npm run structural-geometry:typed:check
npm run structural-geometry:typed:report
```

For deliberate regeneration, review controls/mappings first, then run
`python3 -B cases/structural-geometry/typed/reference.py --write` and
`npm run structural-geometry:typed:build`. The builder rejects stale source
hashes and disagreements before writing. Check/report commands never regenerate.
Constructed fixture approval is test authorization, not external scientific
review. Independent algorithm agreement does not establish empirical usefulness.

<a id="strict-structural-comparison-and-mandatory-coverage"></a>

## Strict structural comparison and mandatory coverage

Comparison reports distinguishable, indistinguishable or indeterminate under
one declared regime. It retains mandatory coverage and measured differences.
Biological applicability and evaluation follow the [research plan](RESEARCH.md).

<a id="strict-structural-comparison-and-mandatory-coverage--comparison-contract"></a>

### Comparison contract

`@onto2d/structural-geometry/comparison` compares two verified Model Packs under
an explicitly selected existing regime. Both scopes default to the full source;
the existing graph, source-validation and evaluator limits still apply.
All earlier preparations, observations and vocabulary artifacts remain unchanged.

The new `strict-discrete-structural-comparison-v1` policy compares the ordered,
mandatory observable profile by exact value equality. Complete equal profiles
give `indistinguishable-under-regime` and distance `0`; complete different
profiles give `distinguishable-under-regime` and distance `1`. Any mandatory gap
gives `indeterminate` and distance `null`, even if another component differs.
An empty profile is also indeterminate. No tolerance, partial distance, averaging
or similarity percentage is introduced. This discrete mismatch is not the response profile’s
separately implemented response-signature pseudometric or a measure of how different graphs are.

Canonical structure has one component; topology has the seven frozen summary
components; typed relations have untyped and jointly typed graph components.
The typed component compares only the existing alignment's values in its common
vocabulary. Raw local-code hashes never establish cross-source compatibility.
The unchanged approved-mapping gate and source/orientation bindings apply.
Pair-specific approval does not establish a common domain for all pairs.

<a id="strict-structural-comparison-and-mandatory-coverage--evidence-and-coverage"></a>

### Evidence and coverage

Each component records its observable reference, family, mandatory status,
left/right measurement availability and comparison disposition, exact comparable
values or null, equal/different/indeterminate state and explicit reasons.
Missing typed fields remain visible in the embedded original observations.
Unresolved vocabulary compatibility is a gap in the typed component; the untyped
component can still contribute a verified difference diagnostic.

An optional `evidenceGaps` request records externally declared comparison-use
restrictions. Each entry selects one side and one current-regime observable,
has disposition `unavailable` or `rejected`, and requires a nonempty evidence
reference and its content hash. These declarations describe caller policy;
they neither establish external review nor claim an evaluator failed. They can
only remove comparison coverage. Observations and supplied mappings are still
fully verified, so declarations cannot hide corrupt sources, malformed fields,
invalid mappings or exhausted evaluator limits. Such errors throw, without a
partial success artifact. Missing/unresolved states are derived, never declared
as substitutes for source data. Both measurement and use restrictions are kept
when a component has multiple gaps.

The caller must independently supply the same expected request when verifying
an artifact. A declaration embedded in an untrusted artifact does not authorize
its use. There are no automatic catches converting arbitrary errors into
indeterminate results, and no network fetch of evidence references.

Coverage counts comparable mandatory components over the complete frozen
profile, with complete status and per-family counts. The component records
explain membership and every gap; zero-denominator coverage is incomplete.
Diagnostics list equal, different and incomplete observable IDs. A profile with
one difference and another gap remains indeterminate while retaining that
difference. Availability, source hashes and evidence references are metadata.

<a id="strict-structural-comparison-and-mandatory-coverage--source-bound-api-and-artifact"></a>

### Source-bound API and artifact

```js
import { compareStructuralModels, verifyStructuralComparison }
  from "@onto2d/structural-geometry/comparison";

const input = {
  regimeId: "topology-only-v1",
  leftScope: { kind: "induced", nodeIds: ["a", "b", "c"] },
  rightScope: { kind: "induced", nodeIds: ["x", "y", "z"] }
};
const comparison = compareStructuralModels(leftPack, rightPack, input);
verifyStructuralComparison(comparison, leftPack, rightPack, input);
```

Typed requests additionally accept `vocabulary: { mapping, approvedMappingHash }`
under the existing alignment options; approval remains optional and unresolved
when absent. Other regimes reject vocabulary options. `evidenceGaps` defaults
to an empty array and sorts by observable order, then left/right side; duplicate
side/component declarations are errors. IDs retain exact source spelling.

The immutable artifact binds its own policy and regime references, normalized
request, both original observations (or the existing typed alignment), ordered
components, coverage, diagnostics, status, distance and complete artifact hash.
The normalized request records mapping identity and independently expected
approval, while the mapping payload stays in the alignment. Verification
reconstructs the entire result from expected sources and input, including
mapping approval and caller evidence restrictions; rehashing cannot authorize
changed results. Hash domains are `onto2d:structural-comparison-policy:v1` and
`onto2d:structural-comparison-artifact:v1`.
The case suite additionally uses `onto2d:structural-comparison-reference:v1`
and `onto2d:structural-comparison-suite:v1` for its independent reference and
ordered result index. Those hashes identify computational controls, not approval.

The additive envelope permits at most seven components, fourteen evidence-use
declarations, 500,000 canonical entries and 4 MiB. Existing per-observation and
typed-alignment budgets remain in force. At most five graph canonicalizer calls
are made, inherited from typed alignment; aggregation performs no graph search.
No caller-selected component subset, weights, thresholds or policy overrides
are accepted. Runtime validation and replay supplement closed JSON schemas.

`createStructuralComparisonAnalysis(rightPack)` snapshots the expected right
source at registration and compares it with the authentic engine Model on the
left. It is explicitly opt-in and uses the same input and result contracts.
No existing engine API or default analysis changes.

<a id="strict-structural-comparison-and-mandatory-coverage--acceptance-controls"></a>

### Acceptance controls

The [separate comparison protocol](../../cases/structural-geometry/comparison/PROTOCOL.md)
was fixed before result generation using existing source controls. Its 43 runs
check exact relabeling, topology-summary collisions, joint-type
splits, approved renumbering, dictionary incompatibility, partial/unapproved
mapping, missing fields, preserved differences despite gaps, caller evidence
restrictions and exact source/scoping. Independent Python graph permutations
and matrix closure determine expected classes and component outcomes from
declared inputs. Preserve all earlier scientific fixtures and policy identities.

The combined split/merge controls, all 3,280 aggregation profiles, tri-state and
coverage checks, schema/type/browser/engine tests and complete source replay
provide [computational evidence](EVIDENCE.md). Biological evaluation and the
website follow the [research plan](RESEARCH.md).
