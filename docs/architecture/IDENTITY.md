# Identity

Current contracts. Public APIs and schemas are checked by the repository verification suite.

- [Canonical identity foundation](#canonical-identity-foundation)
- [Refinement-based graph canonicalization](#refinement-based-graph-canonicalization)
- [Bounded skeleton enumeration and candidate-store state](#bounded-skeleton-enumeration-and-candidate-store-state)
- [Deterministic decorated-candidate enumeration](#deterministic-decorated-candidate-enumeration)
- [Verified primitive depth-population materialization](#verified-primitive-depth-population-materialization)
- [Selected formation materialization before derived profiles](#selected-formation-materialization-before-derived-profiles)
- [Profile-slot composition generation gate](#profile-slot-composition-generation-gate)
- [Run-target ontology-coordinate materialization](#run-target-ontology-coordinate-materialization)
- [Formation-derived type classification](#formation-derived-type-classification)
- [Node frontiers and replay-resumable enumeration](#node-frontiers-and-replay-resumable-enumeration)

<a id="canonical-identity-foundation"></a>

## Canonical identity foundation

Schema-v1 package inputs use a restricted JSON value domain. Canonical object
keys use deterministic UTF-16 code-unit order; arrays preserve declared order;
negative zero becomes zero; non-finite numbers, invalid Unicode, sparse arrays,
accessors, symbol keys, cycles, non-plain objects, and prototype-sensitive keys
are rejected. Parsing is bounded by versioned depth, entry-count, and string-byte
limits.

The provisional number policy is `rfc8785-compatible-binary64-v1`: finite
binary64 values use the ECMAScript/RFC-8785-compatible shortest JSON form.
Scientific decimal rounding and unit normalization do not delegate to this
policy; numeric evaluation uses the explicit decimal and unit contracts.

SHA-256 input is framed as a fixed Onto2D prefix, byte length, versioned domain,
separator, and canonical payload. Equal payloads in element, profile, package,
rules, depth-basis, and other domains therefore have different hashes.

The default identity policy is materialized and hashed. Ordinary source IDs,
claims, evidence, timestamps, and derivation records are non-structural.
Ontology coordinates, type tags, normalized invariants, profile hashes, and the
cluster-resolution policy are structural. Cluster identity binds content hashes
of node resolution and condensation instead of annotator/review metadata.
Quantity identity uses normalized value, unit, tolerance, and semantic meaning;
quantity evidence/provenance remains in the normalized package and package hash
but does not change primitive element IDs or profile hashes.

<a id="refinement-based-graph-canonicalization"></a>

## Refinement-based graph canonicalization

`canonicalizeCandidate` first validates and normalizes the candidate and a
fully materialized `GraphPolicy`. Initial node colors are canonical signatures
of the element/profile reference and selected structural node attributes.
One-dimensional Weisfeiler-Lehman refinement repeatedly adds sorted incoming
and outgoing edge signatures containing direction, neighbor color, role, and
selected structural edge attributes.

When refinement leaves a non-singleton color class, the implementation chooses
the smallest invariant cell, individualizes every member in turn, refines
again, and explores all resulting branches. A leaf orders nodes by the discrete
colors, rewrites and sorts edges, and serializes the complete structural graph.
The lexicographically smallest canonical JSON leaf is authoritative. Input
iteration order may choose among equal automorphic mappings, but it cannot
change canonical bytes or identifiers.

The candidate payload contains its counting domain, canonical structural nodes
and edges, and a derived `SkeletonId`. The skeleton is canonicalized separately
as an unlabeled undirected simple graph: edge direction, roles, parallel copies,
and self-loops are projected away. Because the supported range ends at six
nodes, skeleton labeling evaluates every node permutation and chooses the
globally lexicographically smallest sorted edge serialization. This separate,
reviewable path avoids making a refinement color order part of skeleton bytes.
Permutation generation is budgeted incrementally rather than materialized
before the search-state guard, and runtime options cannot raise the node limit
above six.
Skeleton and candidate forms use distinct `onto2d:skeleton:v1` and
`onto2d:candidate:v1` hash domains.

Connectivity, parallel-edge, and self-loop flags decide admissibility. They do
not by themselves change the identity of a graph that is valid under two
policies. Attribute declarations affect identity through the selected
structural data; non-structural annotations are omitted from canonical content.
The normalized policy is bound in run identity.

Connectivity is not an invariant of the standalone `canonicalizeSkeleton`
operation: it accepts any non-empty undirected simple graph, including a
disconnected one. Connectedness is enforced by `enumerateConnectedSkeletons`
and, for decorated candidates, by the materialized `GraphPolicy`. This keeps
canonical identity separate from generation admissibility.

The standalone canonicalizer defaults to six nodes, 64 decorated edges, and
100,000 total search states shared by skeleton and candidate labeling. The edge
limit is a safety ceiling, not the generator's stricter `n + 2` run budget.
Exhaustion throws `CANONICALIZATION_BUDGET_EXHAUSTED`; no partial ID is emitted.

<a id="bounded-skeleton-enumeration-and-candidate-store-state"></a>

## Bounded skeleton enumeration and candidate-store state

For the documented range `1 <= n <= 6`, the initial reference enumerator walks
the finite labelled simple-graph universe in ascending edge-bitmask order. Edge
positions are the lexicographically generated pairs `(0,1), (0,2), ...`.
Disconnected labelled graphs are rejected before canonicalization. Every
connected graph is canonicalized in the skeleton hash domain and deduplicated
by `SkeletonId`; a same-ID/different-bytes observation is a hard collision
error. Final skeleton records are sorted by ID and record how many labelled
graphs projected to each class.

The reference algorithm intentionally favors reviewability over asymptotic
optimization. Its conformance boundary is the published sequence `2, 6, 21,
112` for three through six nodes. A future orderly-generation optimization must
produce the same canonical IDs and counts before replacing it.

Enumeration has explicit `maxLabelledGraphs` and `maxSkeletons` budgets. The
first unprocessed mask or excluded skeleton ID is recorded. Any exhaustion
returns `status: "budget-exhausted"` and `interpretable: false`; partial output
cannot be reported as a complete skeleton universe.

Each CandidateStore fixes one counting domain, graph policy,
canonicalization-limit set, and unique-candidate budget. Its state is `open`
until explicit finalization, `complete` after successful finalization, or
`budget-exhausted` after the first unique candidate beyond the budget. It
retains canonical candidate content, counts later isomorphic inputs as
duplicates, and serializes snapshots in CandidateId order. Open and truncated
snapshots are non-interpretable.

<a id="deterministic-decorated-candidate-enumeration"></a>

## Deterministic decorated-candidate enumeration

`enumerateDecoratedCandidates` v3 accepts a finite set of simple skeletons, one
fixed counting domain, finite node and edge variant alphabets, and a graph
policy. A node variant is a reference plus its selected structural attributes.
An edge variant is a role plus its selected structural attributes. Scientific
meaning is caller-supplied; the enumerator performs no catalogue lookup or
scientific computation.

Before enumeration, the implementation:

- closes the input and option vocabularies;
- re-canonicalizes every skeleton and rejects duplicate skeleton identities;
- normalizes graph-policy defaults and canonicalization limits;
- normalizes Quantity-valued structural attributes through the graph
  canonicalizer;
- rejects non-structural attributes and variants that collapse to the same
  normalized structural value;
- sorts skeletons and variants by canonical content.

Simple-skeleton and one-edge alphabet preflight use the fixed supported
six-node/simple-edge safety ceiling. The configured decorated-edge limit still
governs every emitted candidate, so an edge bound below a skeleton's adjacency
count can define an empty completed universe without preventing that skeleton
from being identified first.

For each skeleton, node variants are assigned by deterministic Cartesian
product. Every simple adjacency receives at least one directed edge. With
parallel edges disabled it receives exactly one edge; with parallel edges
enabled it receives a canonical multiset of directed edge variants up to the
edge bound. Non-loop direction is represented by the two endpoint
orientations. When self-loops are enabled, every node receives an optional
loop multiset under the same bound. Multisets, not edge sequences, prevent
input-local edge ordering from inflating the raw universe.

The default edge bound is the architecture's `n + 2`. An explicit numeric
bound may instead define an empty but complete universe for a skeleton whose
simple adjacencies already exceed it. This is a universe definition, not
runtime exhaustion.

Each complete decoration is passed to the fixed-policy CandidateStore.
Directed-strong connectivity failures are counted as policy exclusions before
store admission. Other validation failures remain hard errors. The completed
result reconciles:

```text
generatedCandidates = policyExcludedCandidates
                    + canonicalizationIndeterminateCandidates
                    + preAdmissionPrunedCandidates
                    + attemptedCandidates
```

and separately reports canonical and duplicate candidates.

Three generator budgets are explicit:

- `maxDecorationStates` bounds logical recursive extensions;
- `maxRawCandidates` bounds complete decorations before the next candidate is
  materialized;
- `maxCandidates` retains the CandidateStore's unique-candidate semantics.

Complete-candidate canonicalization search exhaustion is converted into the
same non-interpretable generator result state and counted separately. Input
normalization must complete before a result artifact exists. State/raw
exhaustion retains an open CandidateStore snapshot; unique-candidate exhaustion retains its
`budget-exhausted` snapshot. Only successful traversal finalizes the store and
sets `interpretable: true`.

Decorated enumeration records its first unvisited logical boundary for diagnostics.
Replay-resumable node-frontier enumeration has a separate cursor contract below.

<a id="verified-primitive-depth-population-materialization"></a>

## Verified primitive depth-population materialization

`loaded-package-verifier-v1` becomes the shared internal boundary for consumers
of `LoadedRulePackage`. It closes the supplied artifact, removes only derived
primitive `elementId` fields from the normalized package, replays the current
loader with an independently expected kernel version, and requires the entire
reproduced artifact to match. The artifact's own version label is never used as
the verifier's authority. Package candidate binding and depth materialization
share the same trust logic.

`materializePrimitiveDepthPopulation`, versioned as
`primitive-depth-population-v1`, accepts only that verified loader artifact.
For each normalized primitive it reproduces the identity-bearing basis under
the loaded `IdentityPolicy`, creates an `onto2d:element:v1` canonical form, and
requires its hash to equal the loader's `elementId` before emitting an
`Element` with:

- `depth: 0` and the verified package `depthBasis`;
- `axisProvenance.derivationDepth = "computed"` plus any declared ontology or
  catalogue axis provenance;
- the normalized profile, invariants, type tags, claims, coordinate, and
  optional cluster record;
- `provenance: null`, because primitives and source-condensed clusters have no
  kernel formation derivation;
- empty `admittedBy` and `selectedBy`, because membership in the primitive
  basis is not a predicate or selector result.

Elements are sorted by `ElementId`. The complete artifact binds schema and
materializer versions, package ID, depth basis, depth, and all materialized
records in the new `onto2d:depth-population:v1` domain. Package provenance can
therefore change the population hash while a non-structural source rename
leaves the policy-controlled element ID unchanged.

`package-candidate-binding-v2` now consumes this materialized population rather
than reading primitive IDs directly. Its `sourcePopulation` records the full
population artifact and a closed selection descriptor containing the run's
`sourceDepths`, `targetDepth: 1`, `availableDepths: [0]`, and
`selectedDepths: [0]`. `all-below` and `previous-only` select the same elements
when depth zero is the only available depth, but the declared policy remains in
the run and binding identities. Element-exact and profile-quotient alphabets
are derived from the materialized records.

The primitive materializer accepts only its package-bound depth-zero population.
Local filtering binds a verified formation basis. Separate residual-profile,
derived-element and generalized-depth contracts materialize deeper populations
with structural identity and provenance.

<a id="selected-formation-materialization-before-derived-profiles"></a>

## Selected formation materialization before derived profiles

`package-selected-formations-v1` consumes a reproduced complete census and a
reproduced `package-selector-admission-v1` artifact.

- The materializer uses only decisions whose exact outcome is `selected`.
  Predicate-rejected, filter-indeterminate, selector-excluded, and selection-
  indeterminate candidates never become formation records.
- Every formation preserves the canonical candidate, target depth, depth
  basis, source-population hash, filter hash, and complete constituent
  resolution from the verified filter artifact. In `profile-quotient` mode the
  lexicographic representative and the complete profile-class membership both
  remain explicit.
- `admittedBy` is the canonical set of every passed top-level predicate.
  `selectedBy` is the canonical set of every selector that selected the
  candidate. Per-selector witnesses bind cohort, functional evaluation,
  ranking, and sensitivity hashes.
- Claim lineage is the canonical union of passed-predicate, selected-selector,
  and selector-functional claims. Evidence is the canonical union referenced
  by those claims. These fields are reproduced from the loaded package rather
  than accepted from the caller.
- Candidate order is canonical candidate-ID order. There is exactly one
  formation per definitely selected candidate, so `selectedFormations` must
  equal the admission's `selectedCandidates`. The complete admission counts
  remain embedded; this artifact does not replace the candidate-domain
  denominator with a later element count.
- Each formation is hashed in `onto2d:selected-formation:v1`; the full set,
  policy, prerequisite hashes, counts, and interpretation are hashed in
  `onto2d:package-selected-formations:v1`. Stored artifacts require exact
  deterministic replay.
- The artifact's materialization disposition explicitly defers profile and
  derived-element identity. It emits no `Profile`, `Element`, alternate-
  derivation index, or depth population.

<a id="profile-slot-composition-generation-gate"></a>

## Profile-slot composition generation gate

Normalized `RunConfig` now contains an identity-bearing
`profileCompositionPolicy`. Its compatibility default is `post-admission-v1`,
which retains the pre-Profile-slot composition generation gate generated universe. Callers opt into
`profile-slot-gate-v1` when candidate composition itself must respect the
bound source profiles.

The opt-in gate evaluates each complete canonical candidate before it reaches
`CandidateStore`. It uses the same deterministic allocation policy as residual
profile extraction:

- canonical edge order;
- source endpoint before target endpoint;
- exact endpoint polarity before `sym`, then ascending slot index;
- one capacity unit per directed edge endpoint;
- typed partner guards over every member of the complete partner profile
  class.

A missing compatible role/polarity/capacity or a definitely failed guard
excludes the complete candidate and increments a separate
`compositionExcludedCandidates` count. An indeterminate typed guard, a legacy
guard hash, incomplete class membership, or inconsistent binding aborts the
whole generation. It never turns unknown compatibility into a smaller
apparently complete denominator.

Every unique canonical decision retains its candidate identity, slot
consumptions, guard-evaluation hashes, outcome, and reason. The aggregate
`package-profile-composition-gate-v1` artifact reconciles compatible,
incompatible, indeterminate, and excluded-raw counts under dedicated hash
domains. The disabled policy still emits a compact content-addressed
`not-run` artifact, so the active policy and its absence are both explicit.

Primitive, arbitrary-depth, and bounded current-level-fixpoint generation use
the same gate. Pruning under the opt-in policy requires the separate audited controller.
Profile-gated audited pre-admission pruning composes the complete decision with canonical-prefix pruning;
Profile-gated audited raw-frontier pruning independently freezes the complete profile-state extension census
required before raw edge or node subtrees may be skipped.

The low-level decorator exposes the complete-candidate callback only as an
internal kernel boundary. The public generic enumerator remains independent of
package profiles and reports zero composition exclusions.

<a id="run-target-ontology-coordinate-materialization"></a>

## Run-target ontology-coordinate materialization

Primitive, generalized-depth, and bounded current-level materialization use one
`normalized-run-ontology-target-or-absent-v1` axis policy:

- absent `ontologyTarget` emits no `ontologyCoordinate` and records only
  computed derivation-depth provenance;
- a present normalized target is copied exactly to the level and every derived
  element;
- ontology-level provenance is `declared`; ontology-phase provenance is also
  `declared` when a phase is present; no provenance value is invented for an
  absent phase or for `segment`;
- target depth never supplies or rewrites an ontology level.

`package-derived-depth-population-v3` binds the exact normalized target, or
`null` when absent, into derived element identity only when
`identityPolicy.ontologyCoordinateStructural` is true. The coordinate remains
visible but non-structural when that flag is false. Formation, run, evidence,
and derivation hashes still do not enter the element identity basis.

Ordinary, arbitrary-depth, and bounded current-level closure artifacts now
carry the same `axisProvenance` and optional `ontologyCoordinate`; their
existing exact-replay verifiers cover those fields.

<a id="formation-derived-type-classification"></a>

## Formation-derived type classification

The opt-in `profileDefinition.kind = "residual-slots-v3"` extends v2 with a
canonical `derivedTypeRules` set. Each rule declares:

- one globally unique output `typeTag` that does not duplicate a static
  `derivedTypeTags` entry;
- one `invariant` semantic declared in the same definition's
  `derivedInvariants` set;
- one closed Quantity comparator; and
- one compatible normalized Quantity `threshold` whose semantic equals the
  referenced invariant.

The extractor first executes the complete v2 formation-functional invariant
stage. If any source functional is indeterminate, the existing all-or-nothing
profile failure applies and no type rule runs. Otherwise every type rule reads
the reproduced scored invariant and uses the kernel's tolerance-aware Quantity
comparison with equal-semantic enforcement. A passing comparison assigns the
tag; a non-passing comparison records `not-assigned`. Every rule retains its
source functional evaluation hash, full comparison transcript, and outcome.
The final type set is the sorted union of static and assigned tags.

`package-derived-profile-extractor-v3` publishes those evaluations and the
final type set beside each residual profile. `package-derived-depth-population-v3`
copies that verified set to the derived `Element`; it reads the verified set rather than only the
static package tags. When `identityPolicy.typeTagsStructural` is true, the
verified result set participates in element identity. When false, the visible
classification remains present but does not change the element ID.

Threshold evidence enters the derived-profile evidence union. Rule order is
non-semantic after normalization. This contract does not infer a type from
derivation depth, ontology coordinates, selectors, or representative members,
and it does not introduce an independent functional-evaluation path.

<a id="node-frontiers-and-replay-resumable-enumeration"></a>

## Node frontiers and replay-resumable enumeration

`decorated-candidate-enumerator-v5` exposes internal strict node-assignment
frontiers after at least one and before all skeleton nodes are assigned. Every
frontier binds the skeleton, assigned and total node counts, remaining node
assignments, the exact raw edge completions per full node assignment, and the
exact total reachable raw candidates. Counts use closed integer combinatorics
and fail before exceeding the JSON safe-integer artifact boundary.

The low-level traversal can observe those frontiers without changing ordinary
output. An internal pruning hook may close a node subtree and then records
separate node-frontier and skipped-raw counts; `logicalRawCandidates` remains
the exact sum of visited raw leaves, edge-frontier skips, and node-frontier
skips. This hook alone does not authorize package predicate pruning. Package
controllers must first receive a separate incomplete-node audit contract.

`resumable-decorated-candidate-enumerator-v1` adds a public, engine-independent
checkpoint protocol over the ordinary raw-leaf order. A bounded step hashes
each raw candidate into a chained prefix transcript. When its step ceiling is
reached it publishes:

- the exact next raw-candidate ordinal;
- input and enumeration-option hashes;
- the prefix transcript and prior-checkpoint link; and
- a domain-separated checkpoint hash.

Continuation deterministically replays the prefix, verifies the transcript,
and only then advances the next window. This is deliberately
`deterministic-prefix-replay-v1`, not an O(1) serialized VM stack. It trades
repeated navigation for portable, inspectable state and introduces no new
semantic ordering.

The per-step ceiling is an operational pause boundary only. It never resets or
bypasses `maxRawCandidates`, `maxCandidates`, `maxDecorationStates`, or
canonicalization limits. Exhausting one of those semantic budgets is terminal
`budget-exhausted`, not a resumable pause. When the raw universe ends, the
coordinator returns the ordinary complete v5 enumeration; no separately
merged candidate store is trusted. Stored step artifacts require exact
reproduction from the same input, options, checkpoint, and step ceiling.
