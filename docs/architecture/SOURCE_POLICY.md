# Source Policy

Current source-policy and migration contracts. The runtime verifies policy and
annotation artifacts; actual scientific classification/resolution rules and
reviewed current-catalogue annotations remain open work in the
[roadmap](../ROADMAP.md).

- [Source relation classification policy](#source-relation-classification-policy)
- [Source node resolution policy](#source-node-resolution-policy)
- [Source policy freeze contracts](#source-policy-freeze-contracts)
- [Source classification annotation artifacts](#source-classification-annotation-artifacts)
- [Classified relations and SCC projections](#classified-relations-and-scc-projections)
- [Reviewed source resolution and lossless condensation](#reviewed-source-resolution-and-lossless-condensation)
- [Source migration reconciliation diagnostics](#source-migration-reconciliation-diagnostics)
- [Post-unblinding classification amendments](#post-unblinding-classification-amendments)
- [Effective source-classification reprojection](#effective-source-classification-reprojection)
- [Complete source-migration metrics](#complete-source-migration-metrics)
- [Source-migration explanation indexing](#source-migration-explanation-index)
- [Source-cluster concentration](#source-cluster-concentration)
- [Closed source-migration package and run binding](#closed-source-migration-package-and-run-binding)
- [Adapter-owned source explanations and closed kernel registry](#adapter-owned-source-explanations-and-closed-kernel-registry)

<a id="source-relation-classification-policy"></a>

## Source relation classification policy

Before annotation begins, define for every relation kind:

- positive decision question;
- necessary and sufficient observable fields;
- inclusions, exclusions, and counterexamples;
- conflict/adjudication rule;
- annotator/tool exposure declaration;
- policy version and hash;
- warning thresholds for disagreement and post-unblinding changes.

The policy must not receive SCC membership, cycle visualizations, desired
acyclicity, or the effect of a label on the quotient graph.

<a id="source-node-resolution-policy"></a>

## Source node resolution policy

Define general merge and cluster criteria with positive and negative examples.
The following criterion is forbidden: “merge these cards because doing so
removes a cycle.” Component size and resemblance to the foundational paper are
diagnostics only.

Every surviving component must become one stratification vertex with
`internalOrder = "undefined"`; members inherit its depth and basis. Every raw
edge must remain reconciled as an inter-cluster, internal, or typed explanation
relation.

<a id="source-policy-freeze-contracts"></a>

## Source policy freeze contracts

The kernel exposes two closed, deterministic artifact constructors:

- `freezeSourceClassificationPolicy`, versioned as
  `source-classification-policy-v1` and hashed in
  `onto2d:source-classification-policy:v1`;
- `freezeSourceNodeResolutionPolicy`, versioned as
  `source-node-resolution-policy-v1` and hashed in
  `onto2d:source-node-resolution-policy:v1`.

The classification contract requires all six relation kinds. Each kind has a
decision question, necessary and sufficient observations, inclusions,
exclusions, and counterexamples. The artifact also contains the conflict rule,
classification-visible fields, a complete forbidden-input vocabulary, and the
three migration-risk thresholds from the architecture.

The authorship and exposure declarations are cross-checked:

- `human-independent` requires at least two classifiers;
- `prospective-blind` requires independent human authorship and a negative
  declaration of pre-freeze SCC-aware exposure;
- `deterministic-precommitted` requires a frozen classifier ID and version and
  a negative declaration of pre-freeze SCC-aware exposure;
- `historically-exposed` requires an explicit positive exposure declaration
  and cannot be represented as prospective blind.

The exact forbidden classification inputs are SCC membership, cycle
visualization, desired topology, and the effect on quotient acyclicity. None
may occur in the visible-field set. Visible fields use a closed, versioned
local-field vocabulary and must include `source` and `target`; undeclared
aliases such as `sccMembership` are rejected. Human policy minima are bounded
from two through the executable annotation ceiling of 100 classifiers, so a
successfully frozen policy is not impossible to instantiate.

The node-resolution contract binds the classification policy hash and requires
classified relations, source endpoints, and SCC membership as post-
classification inputs. It covers all four dispositions with general criteria
and positive/negative examples. Cycle-removal outcome, desired acyclicity,
component size alone, and resemblance to the foundational paper alone are
frozen as forbidden criteria.

Every resolution policy fixes three additional invariants:

- each raw relation is preserved and reconciled exactly once as inter-cluster,
  internal, or typed explanation;
- cluster internal order is `undefined`, and members inherit cluster depth;
- the condensation quotient is required to be a DAG.

Set-valued arrays are deduplicated and sorted before hashing. Authored text is
preserved but must already be normalized and non-empty. The policy hash covers
the schema version, freezer version, and every normalized semantic field; it
does not cover itself.

<a id="source-classification-annotation-artifacts"></a>

## Source classification annotation artifacts

The kernel exposes two closed artifact constructors:

- `freezeSourceClassificationAnnotations`, versioned as
  `source-classification-annotations-v1` and hashed in
  `onto2d:source-classification-annotations:v1`;
- `freezeSourceClassificationAdjudication`, versioned as
  `source-classification-adjudication-v1` and hashed in
  `onto2d:source-classification-adjudication:v1`.

Both constructors first reproduce the supplied frozen policy and reject any
content/hash mismatch.

<a id="source-classification-annotation-artifacts--raw-annotations"></a>

#### Raw annotations

The annotation artifact binds the policy hash, access-controlled view hash,
exact policy-visible field set, complete relation inventory, freeze time,
classifier identities, individual exposure declarations, observations,
rationales, and selected relation kinds.

For human-independent policy, the artifact requires at least the policy's
minimum classifier count and a complete Cartesian annotation matrix: every
declared classifier independently annotates every relation exactly once. For a
deterministic-precommitted policy, exactly one classifier is permitted and its
ID and version must equal the identity frozen in the policy.

Prospective-blind and deterministic-precommitted declarations require a
negative SCC-exposure statement. Under an overall historically exposed policy,
each human still declares their own truthful status, so a mixed group may
retain prospective-blind individuals while the artifact remains historically
exposed and risk-elevated. Classifier ordering, relation ordering, annotation
ordering, and observation-set ordering cannot change the artifact hash.

<a id="source-classification-annotation-artifacts--adjudication"></a>

#### Adjudication

The adjudication artifact binds both the policy and raw-annotation hashes. It
contains one final decision per relation, a policy-compatible adjudicator
identity and exposure declaration, adjudication freeze time, and explicit
unblinding time.

Raw kinds and agreement status are derived from the frozen annotations rather
than trusted from input. A unanimous classification cannot be changed during
adjudication. A disagreement remains visible even if the final decision uses a
third supported category. The artifact computes the exact disagreement count
and ratio, compares it with the frozen risk threshold, and raises fitting risk
for threshold excess or historical exposure.

Annotation freeze, adjudication freeze, and unblinding instants must be in that
order. Timestamps use canonical UTC milliseconds and are caller-supplied
provenance, not a trusted clock attestation.

<a id="classified-relations-and-scc-projections"></a>

## Classified relations and SCC projections

The catalogue adapter exposes two content-addressed constructors.

<a id="classified-relations-and-scc-projections--classification-view"></a>

#### Classification view

`createSourceClassificationView`, versioned as
`source-classification-view-v1`, creates the only relation payload eligible for
annotation. It reproduces the frozen classification policy and requires:

- a unique relation ID and normalized source/target endpoint for every entry;
- exactly the policy's visible local fields and no additional fields;
- membership of every field name in the kernel's closed visible-field
  vocabulary;
- explicit `source` and `target` visibility in the policy;
- equality between visible endpoint fields and the structural endpoints;
- canonical relation/field ordering before hashing in
  `onto2d:source-classification-view:v1`.

This makes endpoint substitution or hidden SCC/cycle fields change or fail the
view identity. The adapter constructs the payload; authenticating users and
delivering it through an access-controlled UI remain application concerns.

<a id="classified-relations-and-scc-projections--classified-relations-and-sccs"></a>

#### Classified relations and SCCs

`buildSourceClassifiedRelations`, versioned as
`source-classified-relations-v1`, accepts only a reproducible policy, view,
annotation artifact, and adjudication artifact. Every upstream hash and the
complete canonical content are rechecked.

The output contains every view relation exactly once with its source, target,
final kind, agreement/adjudication status, and preserved raw kinds. It computes
two directed partitions over every endpoint in the relation inventory:

- `generative`, containing only `generative` relations;
- `formation-support`, containing `generative`, `constitutive`, and
  `intra-closure-support` relations.

SCC traversal order, relation order, annotation order, and decision order do
not affect the result. Every component records sorted members, sorted internal
relation IDs, and whether it is cyclic. A singleton with a projected self-loop
is cyclic. Component identity is hashed in
`onto2d:source-scc-component:v1` over the projection name, members, and complete
internal typed endpoint relations, not merely over relation IDs. The complete
artifact is hashed in `onto2d:source-classified-relations:v1`.

<a id="reviewed-source-resolution-and-lossless-condensation"></a>

## Reviewed source resolution and lossless condensation

`@onto2d/catalog-adapter` implements two fully replayable artifacts:

- `source-node-resolution-v1`;
- `source-condensation-v1`.

Resolution first reproduces the complete classification policy, visible view,
annotations, adjudication, and classified-relation projection. It also
reproduces the frozen node-resolution policy. The caller must provide:

- a complete source-node inventory, including isolated records, with one
  normalized identity hash and source `ArtifactRef` per record;
- exactly one reviewed disposition and rationale artifact for every
  multi-member cyclic formation-support component;
- exactly one reviewed destination for every classified relation.

The adapter derives the partition; callers cannot submit arbitrary cluster
members. Every multi-member cyclic component becomes one content-addressed
cluster vertex. A projected singleton self-loop remains one source vertex but
has undefined internal order. Every other source record maps to one individual
vertex, including records absent from all relation endpoints.

Relation destinations are checked against typed endpoints:

- a formation-support relation whose endpoints resolve to one vertex is
  `internal`;
- an inter-vertex `generative` relation is `inter-cluster`;
- every other relation is `typed-explanation`.

This check prevents a reviewed destination from hiding a generative dependency
or converting a non-generative relation into stratification precedence. The
resolution records every relation exactly once and reconciles every source
node exactly once.

Condensation retains all six relation-kind layers, including internal and
nonformation relations. Its quotient contains only inter-vertex generative
edges and must admit a deterministic complete topological order. A cyclic
quotient fails closed. Vertex identities bind normalized member identities,
complete internal typed relations, disposition, and node-resolution policy;
artifact timestamps and reviewer identities remain provenance.

Both artifacts use separate hash domains and exact serialized replay. Input
ordering, SCC traversal order, decision order, and relation order cannot change
their identities. JSON Schemas and TypeScript declarations cover both results.

<a id="source-migration-reconciliation-diagnostics"></a>

## Source migration reconciliation diagnostics

`@onto2d/catalog-adapter` implements
`source-migration-reconciliation-v1`. It fully replays the policy, view,
annotations, adjudication, classified relations, node-resolution policy,
resolution, and condensation before deriving any diagnostic.

The report records:

- raw all-relation nontrivial SCC membership, relation references, complete
  size histogram, largest size, and reciprocal-dyad count;
- the six classified edge counts, blindness status, disagreement statistics,
  and generative/formation-support cyclic-component counts;
- resolved vertex/cluster counts, constitutive-cluster sizes, clustered source
  share, and exact relation-destination counts;
- the share of raw SCCs that no longer remain one strongly connected component
  in the formation-support projection, including the stricter share restored
  by adding only descriptive edges;
- available precommitted risk-threshold comparisons;
- explicit true node/edge/quotient reconciliation invariants.

A raw SCC counts as descriptively resolved only when its exact member set is
strongly connected in the raw graph and in the formation-plus-descriptive
projection, but not in formation support alone. Smaller surviving formation
SCCs do not cause the original raw component to be mislabeled as unchanged.
Singleton self-loops are preserved elsewhere but are not included in the raw
“nontrivial SCC” histogram, matching the repository catalogue audit.

The report uses a dedicated hash domain and exact serialized replay. A verified
amendment-log snapshot and its frozen post-unblinding threshold signal are
mandatory. A non-empty log requires a new effective
projection and is rejected rather than paired with stale resolution artifacts;
Effective source-classification reprojection provides that projection and amendment-aware downstream replay.
The report still cannot be presented as the complete migration result.

<a id="post-unblinding-classification-amendments"></a>

## Post-unblinding classification amendments

`@onto2d/kernel` implements `source-classification-amendments-v1`. The caller
supplies a complete snapshot frozen strictly after adjudication unblinding.
Every change names a frozen relation, a new supported kind, a canonical UTC
instant, a reason, an approver identity/role, and an approval `ArtifactRef`.

The freezer:

1. exactly replays policy, annotations, and adjudication;
2. rejects pre-unblinding, post-freeze, unknown-relation, no-op, and
   same-relation/same-instant ambiguous changes;
3. sorts changes chronologically and derives each `originalKind` from the
   frozen decision or preceding amendment;
4. binds every change to a `priorStateHash` and derives a content-addressed
   `changeId`;
5. emits one effective-decision record per frozen relation without modifying
   the adjudication artifact;
6. counts both change records and unique changed relations, compares the
   latter share with the precommitted risk threshold, and combines that signal
   with existing historical-exposure/disagreement reasons;
7. hashes the complete amendment snapshot under its own domain.

An empty log is meaningful: it attests that no post-unblinding changes were
recorded through its `frozenAt` instant. Source reconciliation diagnostics now
require such a verified log. A non-empty log cannot be paired with a
condensation made from the old kinds; it fails with
`SOURCE_MIGRATION_REPROJECTION_REQUIRED`. Effective source-classification reprojection supplies the separately
versioned effective projection; callers must still supply reviewed downstream
decisions for any changed SCC identities or destinations.

<a id="effective-source-classification-reprojection"></a>

## Effective source-classification reprojection

`@onto2d/catalog-adapter` implements
`source-effective-classified-relations-v1`. Its constructor exactly replays:

1. the frozen policy, visible classification view, annotations, and
   adjudication;
2. the original `source-classified-relations-v1` projection;
3. the immutable amendment log and every per-relation state chain.

For every source relation the effective artifact retains the frozen kind,
blind decision status, raw classifier kinds, final state hash, and ordered
change identities while exposing the effective kind used downstream. The
artifact binds the original projection and amendment-log hashes, recomputes
the generative and formation-support SCCs from effective kinds, records
effective counts, and receives a separate content identity under
`onto2d:source-effective-classified-relations:v1`.

The existing reviewed resolution and condensation algorithms may consume
either the frozen projection or the effective projection. An effective
projection requires its amendment log during exact replay. Conversely, a
non-empty log cannot accompany the frozen projection. Any changed SCC
identities, component membership, relation destinations, vertices, quotient,
or topological order therefore require new reviewed downstream inputs and
produce new hashes. Empty amendment logs remain compatible with the original
projection and may also be represented by an effective projection.

Migration reconciliation accepts effective projections, verifies the full
amendment-aware chain, and reports metrics over current effective kinds. If a
non-empty log is paired with the frozen projection, it still fails explicitly
with `SOURCE_MIGRATION_REPROJECTION_REQUIRED`.

<a id="complete-source-migration-metrics"></a>

## Complete source-migration metrics

`@onto2d/catalog-adapter` implements `source-migration-metrics-v1`. The
constructor exactly verifies the complete reconciliation report and all of its
upstream policy, annotation, amendment, projection, resolution, and
condensation inputs. The caller then supplies:

- exactly one primary-resolution record and rationale `ArtifactRef` for every
  raw nontrivial SCC in the verified report;
- exactly one non-negative source-catalogue level for every reconciled source
  node, including isolated records.

Raw-component members and edge identities are always derived from the report;
callers cannot replace them. If all members resolve into one reviewed cluster,
the primary resolution and `resultingCluster` must exactly match the cluster's
reviewed disposition. If members resolve to multiple vertices, the record must
state nonformation-layer separation, except when replay proves that a
post-unblinding change converted a formerly strongly connected formation
projection into a separated effective projection. In that case the primary
resolution must explicitly state post-unblinding reclassification.

The adapter derives the full architecture metric set, including raw counts and
histograms, all six effective edge counts, blindness/disagreement/change
signals, complete dispositions, resolution shares, cluster counts,
cross-catalogue-level clusters, clustered-source share, and fitting-risk
reasons. It hashes the frozen risk-policy subset separately and hashes the
complete artifact under `onto2d:source-migration-metrics:v1`.

<a id="source-migration-explanation-index"></a>

## Source-migration explanation indexing

`@onto2d/catalog-adapter` implements
`source-migration-explanation-index-v1`. Construction exactly replays the
complete source-migration metric chain and binds the policy, amendments, projection,
resolution, condensation, reconciliation, and metrics identities.

The index contains:

- one record per source node with normalized source identity/artifact, source
  catalogue level, resolved vertex and cluster disposition, all co-members,
  raw-SCC membership, and sorted incoming/outgoing source relations;
- one record per source relation with endpoints, frozen and effective kinds,
  blind decision status and raw kinds, amendment state/change identities,
  resolved endpoint vertices, typed destination, and raw-SCC membership;
- every complete raw-SCC disposition and rationale already verified by the
  migration metrics artifact.

All inventories and statistics are derived from verified upstream artifacts,
sorted canonically, and hashed under
`onto2d:source-migration-explanation-index:v1`.

Serialized indexes must be replayed before lookup. The adapter exposes a bound
in-memory session which performs that replay once and then accepts only exact
queries for `source-node`, `source-relation`, or `raw-component`. Every result
binds the index hash and query and is independently content-addressed under
`onto2d:source-migration-explanation:v1`. Missing or malformed queries fail
explicitly.

<a id="source-cluster-concentration"></a>

## Source-cluster concentration

`@onto2d/catalog-adapter` implements `source-cluster-concentration-v1`. It
first exactly replays the complete migration-metrics chain. The caller then
supplies:

- a versioned bottleneck definition, canonical freeze time, statement,
  exposure declaration, content-addressed definition artifact, and explicit
  concentrated/depleted enrichment thresholds that bracket one;
- an assertion that cluster locations were not inspected before the
  definition was frozen;
- one unique point per kernel depth with its `depthBasis`, total
  stratification-vertex count, bottleneck label, and the complete subset of
  reviewed source-resolution vertex IDs mapped to that depth.

Every reviewed source vertex must occur at exactly one point. The declared
stratification population must be at least as large as its source-vertex
subset. The adapter derives, per point, the constitutive-cluster count/density,
source-record count, constitutive-member count/share, and then pools member
shares over bottleneck versus non-bottleneck depths.

`enrichmentRatio` is bottleneck share divided by non-bottleneck share. A zero
or missing denominator produces `null` and `indeterminate`, never infinity.
Otherwise the independently frozen thresholds select `concentrated`,
`depleted`, or `uniform`. The result records `nullModel.status = "not-run"`;
it does not fabricate the optional seeded permutation baseline. The definition
and complete result receive separate content identities.

<a id="closed-source-migration-package-and-run-binding"></a>

## Closed source-migration package and run binding

Schema v1 defines `SourceMigrationBinding` as one closed manifest containing:

- the semantic classification `policyHash` and blindness status;
- classification/risk policies, classification view, annotations,
  adjudication, post-unblinding amendments, and effective classified
  relations;
- node resolutions, condensation, member projections, and exactly six typed
  relation-layer artifacts;
- reconciliation, metrics, explanation index, and optional concentration.

The package loader requires all mandatory roles, rejects unknown fields,
validates every `ArtifactRef`, requires a distinct content hash for every
migration role, and requires an exact matching reference in the root
`sourceArtifacts` inventory. Typed relation layers are normalized by hash.

Every condensed-cluster primitive requires this binding. Its classification
policy hash and classification, node-resolution, and condensation artifact
references must match the bound migration exactly. One source member cannot
occur in more than one condensed-cluster primitive. Normalized member and
internal-relation order remains identity-insensitive.

The normalized binding is hashed under
`onto2d:source-migration-binding:v1`. The loaded package semantic manifest
records `sourceMigrationHash`, and its depth basis records the bound
condensation artifact hash. Verified run bundles copy `sourceMigrationHash`
and add `normalized-input/source-migration.json` as a sixteenth input artifact;
packages without a migration retain the original fifteen-input manifest.

The loader does not claim that an `ArtifactRef` proves the scientific content
of unavailable bytes. The catalogue adapter remains responsible for exact
upstream replay and node/edge conservation before an application constructs
this package manifest. Authorship, access-controlled annotation, reviewed
dispositions, and application to the current catalogue remain external
research/application inputs rather than pending kernel algorithms.

<a id="adapter-owned-source-explanations-and-closed-kernel-registry"></a>

## Adapter-owned source explanations and closed kernel registry

Source-migration explanation construction, verification, and lookup remain
owned by `@onto2d/catalog-adapter`:

```js
const session = createSourceMigrationExplanationSession(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensation,
  reconciliation,
  metrics,
  explanationIndex
);

const explanation = session.explain({ kind: "source-node", id: sourceId });
```

The unusable `kernel.explainSource()` facade is removed. Candidate explanation
lookup remains on a kernel instance only because its complete semantic inputs
and explanation indexes are embedded in a verified kernel run-artifact store.
The generic `requireKernelCapability()`/`KernelNotImplementedError` placeholder
surface is removed with it; unsupported concrete inputs continue to use their
stage-specific fail-closed errors.

The kernel capability registry excludes adapter algorithms and authored
research/application inputs as pending kernel work. Its pending list is empty.
This means the published schema-v1 kernel API has no known placeholder
operation; it does not claim that current-catalogue research inputs, remote
stores, user interfaces, or deployment applications already exist.
