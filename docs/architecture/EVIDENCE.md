# Evidence

Current contracts. Public APIs and schemas are checked by the repository verification suite.

- [Verified level explanation index](#verified-level-explanation-index)
- [Integrated verified level-result census](#integrated-verified-level-result-census)
- [Verified run artifact bundles and bound explanation lookup](#verified-run-artifact-bundles-and-bound-explanation-lookup)
- [Verified run-directory persistence](#verified-run-directory-persistence)
- [Append-only operational execution records](#append-only-operational-execution-records)
- [Null-model execution planning and independent streams](#null-model-execution-planning-and-independent-streams)
- [Deterministic null-model proposal generation](#deterministic-null-model-proposal-generation)
- [Occurrence-aware null-trial local-filter censuses](#occurrence-aware-null-trial-local-filter-censuses)
- [Occurrence-aware null-trial selection replay](#occurrence-aware-null-trial-selection-replay)
- [Per-model null distributions and integrated baselines](#per-model-null-distributions-and-integrated-baselines)
- [Current-level round null-model execution](#current-level-round-null-model-execution)

<a id="verified-level-explanation-index"></a>

## Verified level explanation index

`package-level-explanation-indexer-v1` accepts a loaded package, RunConfig, one
ordinary or depth-aware closed level, any required prior-level chain, and the
same execution limits used by closure. It first performs exact level replay.
An ordinary depth-one level rejects unexpected prior levels; a depth-aware
level reproduces its complete contiguous chain and target depth.

The index binds the package, rules, depth basis, run, level, counting domain,
source population, and the five embedded artifact hashes. It emits exactly one
entry for each candidate in the complete census. Every entry contains:

- the complete local filter and predicate witnesses;
- the final admission decision and selector witnesses;
- the selected formation or `null`;
- the derived-profile result or `null`;
- every derived-element and derivation record caused by that candidate.

Admission, formation, and profile coverage is reconciled before hashing. A
selected candidate must have one formation and one profile result; an
unselected candidate has neither. Derivation links must resolve to materialized
elements and to candidates in the indexed census. Duplicate keys fail.

The complete snapshot is hashed in
`onto2d:package-level-explanation-index:v1`. A candidate query validates the
snapshot's content hash, requires a canonical candidate ID, and returns the
exact stored entry plus its package/rules/run/level/index identity under
`onto2d:package-level-candidate-explanation:v1`. Consumers handling serialized
or untrusted indexes must first use exact reproduction verification; the hash-
only query is a lookup operation, not proof that upstream science was valid.

This contract is independent of presentation. It supplies data that a later
report or visualization may consume, but does not create a UI and does not
activate the post-completion visualization gate.

<a id="integrated-verified-level-result-census"></a>

## Integrated verified level-result census

`package-level-result-census-v1` accepts a loaded package, RunConfig, one
ordinary or depth-aware closed level, any required prior-level chain, and the
same execution limits used by closure. It first reproduces the complete level.
An ordinary depth-one level rejects prior levels; a depth-aware level requires
the exact contiguous chain used to produce its source population.

Before emitting an artifact, the integrator reconciles:

- generated, canonical, evaluated, rejected, indeterminate, eligible,
  excluded, selected, and final-indeterminate candidate counts;
- selected candidates with formations, profile results, and materialized
  elements;
- the level metrics with their local-census and selector-admission sources;
- selector census coverage with the recorded execution count;
- target depth, admitted element IDs, and every embedded artifact hash.

The result preserves Boolean, variational, selection, overall, and
indeterminate ratios; complete predicate and selector censuses; admitted
element IDs; the explicit disabled-baseline record; and the already recorded
level/local/admission/selector interpretations. It does not reinterpret those
values. The complete artifact is hashed in
`onto2d:package-level-result-census:v1`.

This closes the `integrated-level-result-census` capability. It is a semantic
kernel artifact suitable as an input to later run bundles and reports, but it
does not implement persistence.

<a id="verified-run-artifact-bundles-and-bound-explanation-lookup"></a>

## Verified run artifact bundles and bound explanation lookup

`package-run-artifact-bundle-v1` accepts one loaded package, normalized
RunConfig, a non-empty contiguous ordinary/depth-aware level chain, and the
execution ceilings used to create it. It exactly reproduces every level, then
derives the Verified level explanation index explanation index and Integrated verified level-result census final census for every
depth. The bundle embeds the normalized package/run inputs and records:

- one deterministic semantic manifest for the target run;
- every level, final census, and explanation index;
- normalized input projections for package, sources, primitives, predicates,
  functionals, cohorts, selectors, claims, evidence, Oracle policy, ontology
  axes, perturbations, profile definition, identity policy, and RunConfig;
  when present, the normalized source-migration binding is an additional input
  whose semantic hash is copied into the manifest;
- sorted logical artifact paths, media types, schema versions, canonical byte
  lengths, semantic hashes, and byte hashes;
- per-level run, level, census, and explanation-index identities.

Artifact references use the raw SHA-256 of their exact bytes, so external
writers can verify them with standard tooling. Semantic manifest, bundle,
store, materialization, and run-level explanation identities each use separate
framed Onto2D domains.
`materializePackageRunArtifact` returns the exact canonical JSON bytes in
base64 for one verified reference. It does not write a file.

`package-run-artifact-store-v1` verifies every serialized bundle and constructs
a total unique `runHash -> bundle/level/census/explanationIndex` index. A
duplicate run hash is rejected even if it occurs in a different bundle.
`createKernel({ artifactStore })` verifies the store against the configured
kernel version before exposing it. `kernel.explain({runHash,candidateId})`
looks up only inside that bound snapshot and returns a separately hashed
run-level explanation. An unbound kernel fails explicitly.

Freshly created or fully verified results are deeply frozen and may be reused
within the same process without repeating replay. This optimization uses
object identity only; parsed, cloned, or otherwise external objects always
undergo complete reproduction before entering the trusted set.

Run bundles bind candidate explanation lookup to a verified run. Source-migration
explanations require a complete verified migration chain and its separate index.

<a id="verified-run-directory-persistence"></a>

## Verified run-directory persistence

Filesystem persistence belongs to the separate `@onto2d/run-store` adapter.
It publishes a verified bundle below a caller-supplied runs directory using
the portable directory name `sha256-<digest>` for semantic
`sha256:<digest>` run hashes.

Each directory contains `artifact-bundle.json` as the canonical JSON bytes of
the complete self-verifying bundle, plus every path named by the bundle's
artifact references. Writing follows these rules:

1. fully replay the supplied bundle before filesystem work;
2. materialize every referenced artifact through the kernel;
3. write new regular files under a fresh same-filesystem staging directory;
4. verify the staged envelope, inventory, byte lengths, raw SHA-256 hashes,
   and exact reconstructed bytes;
5. publish with one directory rename;
6. never overwrite an existing run directory.

An already-present complete byte-identical bundle is an idempotent success.
An invalid or different existing directory fails closed. Concurrent identical
writers converge on the same result.

Reading performs full serialized-bundle replay, requires canonical envelope
bytes, rejects symbolic links and non-regular files, and requires the exact
set of referenced files and parent directories. Missing and additional entries
are both errors. Bundle-envelope reads have an explicit configurable byte
limit.

Append-only operational execution records reserves one strictly verified `execution/` operational
subtree. Entries outside the exact semantic inventory and that versioned
subtree remain errors.

The returned `package-run-artifact-directory-v1` receipt is operational. Its
absolute directory and write status do not contribute to the semantic bundle
or run hashes. The receipt has its own JSON Schema and TypeScript contract.

<a id="append-only-operational-execution-records"></a>

## Append-only operational execution records

`@onto2d/run-store` implements `package-run-execution-record-v1` outside the
kernel. A record binds one verified semantic `runHash` and contains canonical
UTC millisecond timestamps, engine build, optional platform, bounded resource
usage, and `complete`, `failed`, or `cancelled` terminal status. A complete
record requires `completedAt`; a failed or cancelled record may use `null` when
the terminal instant was unavailable.

`executionId` is the raw SHA-256 of the canonical normalized record basis,
including its schema/recorder version but excluding the derived ID itself. It
is an operational content address, not a semantic hash. The portable file path
is `execution/sha256-<digest>.json`; the full stored bytes receive a separate
raw-SHA-256 `ArtifactRef` in the writer receipt.

Appending follows these rules:

1. fully reconstruct the semantic run directory and all existing execution
   records;
2. verify that the new record's `runHash` matches the directory bundle;
3. write and sync canonical bytes in a same-filesystem staging directory;
4. publish with an atomic no-overwrite hard link;
5. accept an identical existing ID as `already-present`, but reject malformed,
   non-canonical, misnamed, differently bound, symlinked, or unexpected entries.

Readers continue to require the exact semantic file inventory. The only
permitted additional subtree is an optional flat `execution/` directory whose
files all match the versioned execution-record filename and runtime contract.
Execution-record byte and count limits are explicit reader/writer bounds.

<a id="null-model-execution-planning-and-independent-streams"></a>

## Null-model execution planning and independent streams

`package-null-model-plan-v1` is an immutable, exactly replayable execution-plan
artifact. Its constructor accepts a verified complete primitive or depth-aware
candidate census and binds:

- the package, rules, depth basis, normalized run, generation binding, and
  census identities;
- either the run's explicit ontology coordinate or an explicit derivation-
  depth gate;
- the complete canonically ordered candidate-ID carrier and its counting
  domain, source population, and carrier hash;
- one typed proposal/preservation contract for each configured model;
- one trial record per model and configured trial index;
- the mandatory per-trial recomputation and no-cross-universe-pooling rules.

Model order is normalized by `RunConfig`. Each stream is derived in the
`PACKAGE_NULL_MODEL_STREAM` hash domain from the run seed, normalized run
identity, carrier, model, and trial index. Trial IDs use a separate domain.
Adding a worker or reordering authored model identifiers therefore cannot
change stream identity. The declared draw-expansion contract is SHA-256
counter expansion with rejection sampling; model executors must implement
that exact stream before they may claim conformance.

The plan accepts only complete census carriers. Configured models and
`nullModelRuns` must be enabled or disabled together. Total planned trials and
carrier size have hard limits before arrays are materialized.

A disabled plan has `status: "not-run"` and reason
`null-models-disabled`. An enabled plan has `status: "planned"` and reason
`trial-execution-and-metric-distributions-pending`. In particular, `planned`
is not a completed scientific baseline and cannot replace the current closure
`baseline.status: "not-run"` result.

<a id="deterministic-null-model-proposal-generation"></a>

## Deterministic null-model proposal generation

`package-null-model-proposals-v1` exactly replays a verified primitive or
depth-aware plan and complete census. Every planned trial emits exactly one
proposal occurrence for each canonically ordered carrier candidate. An
occurrence retains its source ordinal and source candidate ID even when the
proposed canonical candidate duplicates another occurrence.

All random integer choices use SHA-256 counter expansion in a separate draw
domain with exact rejection sampling. A draw is addressed by the already
independent trial stream plus an operation-specific coordinate, so execution
order and worker scheduling do not affect the result.

The model contracts are:

- `role-shuffle`: candidate-wise Fisher-Yates permutation of the edge-role
  multiset. Nodes, skeleton, direction, edge attributes, and carrier membership
  are retained.
- `degree-rewire`: select uniformly from same-role edge-index pairs and swap
  their directed targets. This preserves each indexed node's role-wise in/out
  degree. Each candidate receives ten attempts per edge when any pair exists.
  Self-loop, parallel-edge, connectivity, canonicalization, or complete-
  carrier membership violations reject that attempt and retain the prior
  candidate. Attempted, accepted, and rejected swaps, acceptance ratio, and
  `mixed`/`unmixed`/`not-applicable` status are retained.
- `uniform`: make one independent exact uniform carrier-index draw with
  replacement for each source occurrence. The trial population therefore has
  carrier size without pretending duplicate draws are distinct canonical
  candidates.

Every emitted candidate is canonicalized under the bound RunConfig graph
policy and limits and must belong to the verified complete carrier. This
membership rule is necessary because subsequent package filtering proves
candidate-universe membership before evaluating predicates.

Proposal occurrence count and random-selection work are preflighted with
caller-lowerable hard limits of one million. Individual rejection sampling has
a fixed 1,024-digest bound. A disabled plan produces an immutable `not-run`
artifact. An enabled artifact reports proposal completion and explicitly states
that trial evaluation and distributions remain pending; it is not a completed
baseline.

<a id="occurrence-aware-null-trial-local-filter-censuses"></a>

## Occurrence-aware null-trial local-filter censuses

`package-null-model-trial-censuses-v1` exactly replays a proposal artifact and
reruns the complete package local-filter session for every occurrence. It has
primitive and depth-aware entry points and uses the corresponding reproduced
binding and source population.

An occurrence receives a domain-separated identity over trial ID, occurrence
index, source candidate ID, and proposed candidate ID. It embeds the full
recomputed filter artifact. Repeated canonical candidate IDs remain separate
occurrences with separate occurrence IDs and both contribute to counts.

Each trial reports:

- evaluated, predicate-rejected, filter-indeterminate, and eligible occurrence
  counts;
- Boolean selectivity and indeterminate ratio over occurrence multiplicity;
- the complete per-predicate occurrence census, including exclusive rejection,
  inertness, and the frozen 90% dominance threshold;
- valid, empty, or threshold-bound indeterminate interpretation;
- a separate trial-census hash.

The aggregate artifact reconciles every trial and occurrence and retains the
run's indeterminate threshold. A disabled proposal yields `not-run`. An enabled
artifact reports `local-census-complete` together with the explicit reason
`cohorts-functionals-selectors-and-distributions-pending`; local completion is
not a completed null baseline.

<a id="occurrence-aware-null-trial-selection-replay"></a>

## Occurrence-aware null-trial selection replay

`package-null-model-trial-selections-v1` exactly verifies the local trial
censuses and executes the complete downstream selection pipeline independently
inside every trial. It has primitive and generalized-depth entry points.

The shared cohort boundary now distinguishes population-member identity from
canonical graph identity. Ordinary execution continues to use
`memberId = candidate.id`; null execution uses the occurrence ID. Cohort keys
are evaluated on the proposed candidate graph, while singleton keys and all
membership, ranking tie-breaks, extrema, and admissions use occurrence IDs.
Repeated canonical candidates therefore remain separate members.

For every selector and trial the runtime:

- reconstructs a total occurrence cohort partition or preserves its empty or
  indeterminate state;
- re-evaluates the declared functional for every eligible occurrence;
- produces dense rankings and complete epsilon-extremum sets;
- repeats the complete declared coefficient-sensitivity sweep over occurrence
  membership;
- intersects every selector and emits final occurrence-domain retention and
  indeterminate ratios;
- retains per-metric interpretation, including fragile sensitivity without
  erasing the raw base ranking.

Node-internal quantities remain fixed unless the null hypothesis randomizes
them. Graph-derived functional values and their evidence are recomputed; an
unavailable derived value remains indeterminate rather than being copied. Base
and sensitivity functional work have separate aggregate hard preflights.

The aggregate artifact binds the carrier, source census, trial censuses,
counting domain, selection policy, selector order, all executions, and exact
work counts. Disabled models remain `not-run`. Enabled selection replay reports
`trial-selection-complete` and explicitly leaves metric distributions and
baseline interpretation pending.

<a id="per-model-null-distributions-and-integrated-baselines"></a>

## Per-model null distributions and integrated baselines

`package-null-model-baseline-v1` exactly verifies the observed census and
admission plus the complete plan/proposal/trial-census/trial-selection chain.
It groups samples strictly by null-model ID; models, carrier populations, and
ontology gates are never pooled.

For each model it summarizes Boolean selectivity, selection retention, overall
retention, indeterminate ratio, and every declared selector's variational
selectivity. Trial IDs define the fixed sample order. Means and sample standard
deviations use compensated binary64 summation, with the standard deviation
denominator `n - 1`. The standardized effect is
`(observed - nullMean) / sampleSd`.

The following states are explicit:

- fewer than two complete samples retain the mean, set `sd` and `z` to
  `null`, and record that sample standard deviation requires two runs;
- zero sample variance sets `z` to `null` and records whether the observed
  value equals, differs from, or is unavailable against the constant null;
- an unavailable observed or trial metric makes that metric indeterminate;
  the implementation never reduces the denominator silently;
- fragile observed or trial sensitivity retains the raw distribution but
  marks the affected summary and model indeterminate;
- disabled null models remain the compact closure state
  `{ status: "not-run", reasons: ["null-models-disabled"] }`.

Each distribution has its own domain-separated identity, and the aggregate
baseline binds the exact trial-selection artifact that supplies its samples.
Primitive and generalized-depth constructors and verifiers use the same
contract.

`package-level-closure-v1` and `package-depth-level-closure-v1` now execute the
entire null chain when `RunConfig.nullModels` is non-empty. They embed plan,
proposals, trial censuses, and trial selections under `artifacts.nullModels`
and store the verified baseline on the level. A non-empty materialized level
with an indeterminate baseline has an explicit `baseline-indeterminate`
interpretation reason. An empty materialized level remains `empty`; its
unavailable baseline does not erase the more precise empty-domain terminal.

Current-level fixpoint null-model execution uses independent round-local
carriers and terminal-round projection; its census carrier differs from the
primitive or prior-depth carrier.

<a id="current-level-round-null-model-execution"></a>

## Current-level round null-model execution

`package-current-level-fixpoint-closure-v2` executes the complete existing
null-model chain independently inside every round:

1. the round's verified current-level census defines the carrier;
2. the plan derives model/trial streams from that census, its current-level
   binding, the normalized run seed, and the round-specific carrier hash;
3. proposal generation preserves the existing role-shuffle, degree-rewire,
   and exact-uniform contracts;
4. every proposed occurrence is filtered with the current-level prepared
   filter session, then repartitioned, rescored, sensitivity-tested, and
   readmitted through the shared verified selector path;
5. the round's observed census and admission are compared with its own trial
   selections to produce per-model distributions and one integrated baseline.

The chain is executed after observed admission and before round interpretation.
An indeterminate baseline makes that round indeterminate under the same
fail-closed interpretation used by ordinary levels. No null sample, metric, or
distribution is pooled across rounds, depths, carrier hashes, or ontology
gates.

`package-current-level-fixpoint-round-v2` embeds its baseline and, when null
models are enabled, the full plan/proposal/trial-census/trial-selection chain.
The enclosing level exposes the terminal round's baseline and null artifacts
beside the separately materialized monotone population. Disabled null models
remain explicit `not-run` results and do not add null artifacts. Exact replay
recomputes every round and therefore verifies the full chain.

The null-model artifact formats remain v1 because their carrier identity was
already generic. Their trial-census schema now admits the current-level filter
evaluation variant in addition to primitive and generalized-depth variants.
