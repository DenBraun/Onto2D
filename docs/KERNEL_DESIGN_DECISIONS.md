# Onto2D Kernel Design Decisions

Status: companion to [KERNEL_ARCHITECTURE.md](./KERNEL_ARCHITECTURE.md) and
[FOUNDATIONAL_PAPER_ANALYSIS.md](./FOUNDATIONAL_PAPER_ANALYSIS.md).

This document records important normalizations, corrections, exclusions, and
open scientific inputs. It explains decisions that are easy to misread when
implementing the normative architecture. It is not a second specification; if
the documents conflict, the architecture is authoritative.

## 1. Closure source and coordinate axes

The default source for depth `d + 1` is the complete admitted closure below the
target, `Sigma_<=d`. A package may explicitly select `previous-only`, which uses
exactly `Sigma_d`. The choice is materialized in normalized run configuration
and participates in the run hash.

Kernel derivation depth, ontology level, ontology phase, catalogue level,
catalogue phase, and predicate execution phase are independent axes. No value
on one axis may be inferred from another without an explicit mapping artifact.
Every reported axis carries provenance.

## 2. Counting and selectivity

Raw decorations, canonical candidates, evaluated candidates, locally eligible
candidates, selector-retained candidates, and admitted structural elements are
different populations. Results retain all reconciliation counts.

The primary research output has two dimensions:

- Boolean selectivity measures hard admissibility over evaluated canonical
  candidates;
- variational selectivity measures optimum concentration inside complete
  competition cohorts.

An incomplete enumeration, an exhausted budget, or an indeterminate member
must not be silently removed from a denominator. Affected metrics become
non-interpretable and carry reasons. Singleton cohorts record zero observed
variational concentration; they are not described as maximally selective.

Counting domains are explicit:

- `profile-quotient` counts profile classes;
- `element-exact` counts concrete elements;
- `single-candidate` validates one supplied candidate.

Values from different domains are not directly comparable unless an explicit
multiplicity-preserving projection is available.

## 3. Canonical identity

Canonical identity is domain-separated and versioned. Equal payload bytes in
different domains do not produce equal identifiers.

Ordinary source IDs, citations, evidence state, timestamps, and execution
metadata are non-structural by default. Primitive and profile identity uses the
normalized structural content selected by the hashed identity policy.
Quantity value, unit, tolerance, and semantic meaning may be structural;
quantity evidence remains in package/run provenance without changing ordinary
primitive or profile identity.

Minimum derivation depth is not embedded in element structural identity. The
same structural element may later acquire an alternate derivation without
changing its ID. Depth remains bound to `depthBasis` and derivation artifacts.

## 4. Candidate and skeleton semantics

Candidate node indices and edge-array order are input-local. Exact decorated-
candidate canonicalization uses refinement and exhaustive individualization;
simple-skeleton canonicalization uses the complete node-permutation orbit.
Both consume a declared shared search budget.

Candidate identity retains:

- counting domain;
- node element/profile references;
- direction and role;
- enabled parallel multiplicity and self-loops;
- declared structural node and edge attributes;
- the derived skeleton ID.

The skeleton projection is an undirected unlabelled simple graph. It discards
direction, roles, parallel copies, and self-loops. Connected-unlabelled counts
therefore belong to skeleton generation, not decorated multigraph generation.

Non-structural annotations never affect candidate identity. Exhausting exact
canonical search emits no partial identifier.

Finite decoration uses canonicalized node and edge variant alphabets. Each
simple adjacency receives one directed variant unless parallel edges are
enabled, in which case it receives a bounded multiset; enabled self-loops are
optional bounded multisets per node. Input-local variant and edge order is
non-semantic. Raw decorations, graph-policy exclusions, store attempts,
canonical candidates, and duplicates are counted separately. This executable
boundary is recorded in ADR-0015; it deliberately does not infer package role
guards or authorize partial pruning.

The first package/run bridge is intentionally narrower than closure
generation. RunConfig materializes only documented budget defaults and hashes
canonical set order. A supplied loaded package is reproduced by the current
loader under an independently expected kernel version before its primitive
element IDs or profile hashes are accepted.
`element-exact` binds every primitive ID; `profile-quotient` binds one profile
hash per class and records the lexicographically smallest member ID as the
representative. Roles come from the declared run alphabet, not observation of
the package. Unsupported disconnected universes, single-candidate input,
selected structural attributes without compatible package definitions, and
unenforceable time/memory limits fail
before traversal. This boundary is recorded in ADR-0016. Derived closure-depth
population selection and complete profile guards/capacities are now separately
implemented; their combination with partial pruning remains a separate
decision.

Primitive population identity is now an explicit intermediate artifact rather
than an ID list embedded only in generation. The materializer replays the
loaded package, reconstructs every primitive identity basis and canonical form,
adds depth-zero and axis provenance without changing structural identity, and
hashes the complete population. The package bridge selects that population for
target depth one and preserves `all-below` versus `previous-only` even though
both select `[0]`. It does not accept fabricated derived elements. This
boundary is recorded in ADR-0018; multi-depth derived selection still requires
formation, admission, and profile artifacts.

Graph-predicate execution is a separate, verified boundary. The evaluator
reproduces a compiled plan before use and canonicalizes the candidate before
emitting outcomes or witnesses. Complete `degree` is universal over the
selection and counts one per incident edge record; empty selections are
indeterminate. Paths are directed and may be zero-length for equal endpoints.
Cycle projection keeps directed reciprocal dyads distinct from
undirected-simple triads. These choices and the partial diagnostic boundary are
recorded in ADR-0017.

The v1 package-bound local filter composes the verified population, run
binding, canonical candidate, and graph evaluator without claiming closure.
The filter reproduces the package and binding, proves that the candidate could
be emitted by the bound decorator (including non-parallel undirected edge-group
multiplicity), discloses exact or profile-representative constituent
resolution, and evaluates every graph-only top-level plan. Failure dominates
indeterminate, which dominates local eligibility. Local eligibility is not
selector admission and cannot materialize a derived element without a selected
formation record and deterministic derived profile. This boundary is recorded
in ADR-0019.

The v20 package filter adds only the local subset whose runtime meaning is
already closed. `local-predicate-evaluator-v19` reproduces a plan and its run
numeric binding, then combines graph operators with scalar constants, direct
constant quantities, canonical node/edge counts, and exact dimensionless
addition/multiplication. It also sums finite scalar or Quantity-valued
structural attributes in canonical selection order under exact-decimal or
compensated-binary64. Quantity sums validate declared unit/semantic metadata,
conservatively sum effective absolute tolerance bounds, and retain computed
evidence provenance. Compatible Quantity constants, sums, and nested additions
compose recursively with additive absolute bounds and computed provenance. A
sole Quantity factor can be scaled by dimensionless number expressions while
preserving its semantic and scaling its absolute bound by the scalar magnitude.
In `element-exact`, a Quantity or package-authored scalar invariant resolves only
from an explicit, source-population-bound context and must select one canonical
node; its typed source value and resolution enter the evaluation artifact. In
`profile-quotient`, the complete member class defaults to one identical
normalized Quantity under `identical-normalized-quantity-v1` or one exact
scalar under `identical-normalized-scalar-v1`. Numeric expressions may instead
bind `arithmetic-mean-conservative-v1`, complete membership, run precision,
and conservative Quantity uncertainty/evidence synthesis; nonnumeric scalars
remain consensus-only and representative substitution remains forbidden.
Missing, ambiguous, or incomplete candidate data is a
structured local `indeterminate`, whereas context, type, unit, and semantic
contract violations remain hard errors.
Node/edge `balance` reuses the typed attribute-sum path, rounds the signed
aggregate once, and compares its absolute magnitude to the explicit Quantity
threshold. Source-aggregate and threshold uncertainty combine only through the
bound maximum-declared-tolerance rule; compensated arithmetic remains a
separate approximation flag.
Single-node or single-edge `irreducibleRemoval` binds the run substructure
policy, evaluates every permitted canonical removal after a whole-candidate
pass, records excluded removals without treating them as failures, and retains
the normalized substructure identity plus nested witnesses. A zero evaluated
denominator is indeterminate.
Exhaustive `minimal` binds the same policy but evaluates every proper
parent-index subgraph selected by its node/edge mode. It preserves the raw
selection and effective retained parent indexes, records excluded empty or
disconnected selections, and rejects a family above the shared 10,000-
substructure ceiling before materialization. Unlike `irreducibleRemoval`, it
therefore detects witnesses that require multiple simultaneous removals.
Exact-domain `novel` uses the separate fixed
`canonical-single-node-no-edge-v1` projection. It compares the passing whole
with every exact constituent, records source/projection identities and parent
mappings, needs no removal policy of its own, and rejects profile-
representative substitution. A passing constituent defeats novelty; an empty
or indeterminate denominator remains indeterminate.
Exact `stableUnder` binds one of four typed finite single-edit definitions and
retains every canonical valid or skipped attempt. Its exact pass/valid lower
bound and (pass+indeterminate)/valid upper bound decide the three-valued
outcome without using rounded diagnostics; empty valid families are
indeterminate unless `vacuous-pass` is explicit. Seeded sampled execution uses
the same ordered frame with replacement, an unbiased RunConfig-hash-bound
SHA-256 rejection stream, and conservative joint 95% Chebyshev bounds for the
passing and non-failure probabilities. Numeric edits require a structural
attribute. Registry-only classes fail preflight, and all
structural/perturbation attempts share the 10,000 ceiling.
The `directed-cycle-edge-union-v1` selector returns every role-filtered
canonical edge participating in at least one directed cycle. Count, sum, and
balance consume that union once per edge and disclose the selection method in
their witnesses.
The unrounded value and its approximation state are explicit, and rounding
occurs once per comparison operand. General Quantity products require an
explicit `resultSemantic`, propagate the full conservative interval product,
and emit computed evidence provenance. Invariants below `minimal`,
`irreducibleRemoval`, `novel`, or `stableUnder` resolve from retained node
references in the same immutable source-population context; selectors are
reevaluated on each canonical subgraph and invariant values are not recomputed
from graph edits. This boundary is recorded in ADR-0089. ADR-0090 closes the
schema-v1 aggregation registry to strict consensus and
`arithmetic-mean-conservative-v1`; all other names remain invalid future
extensions.
ADR-0091 closes the kernel package/run boundary for complete reviewed
source-migration manifests and condensed clusters. ADR-0092 keeps full-chain
source explanation replay in the catalogue adapter and removes the unusable
ambient kernel facade; authored current-catalogue decisions remain external
inputs rather than pending kernel algorithms.
ADR-0093 normalizes every functional coefficient to a fixed/free/fitted role
and makes the non-fixed role set exactly equal the executable sensitivity
sweep.
Functional coefficient nodes remain deliberately
forbidden in predicate-only plans. The current hash domains are versioned for these
artifacts. The baseline, three attribute extensions, two derived-arithmetic
extensions, exact-domain invariant extension, balance extension, and strict
profile-consensus extension are recorded in ADR-0020 through ADR-0028;
irreducible removal is recorded in ADR-0030, directed cycle-edge selection in
ADR-0031, exhaustive minimality in ADR-0045, and scalar/candidate-local
invariant resolution in ADR-0046. Package-authored scalar storage, identity,
filtering, numeric-functional execution, and cohort atoms are recorded in
ADR-0047; exact constituent novelty is recorded in ADR-0048, and exhaustive
typed stability in ADR-0049. Seeded sampled stability is recorded in ADR-0050,
explicit numeric profile aggregation in ADR-0051, and explicit-semantic local
Quantity products in ADR-0052.

`package-functional-evaluator-v1` is a separate post-filter scoring boundary.
It exactly reproduces one eligible filter artifact, resolves normalized
coefficients and exact/profile-consensus or explicitly aggregated numeric
Quantity/scalar invariants, supports general
Quantity products because the functional result specification closes their
unit/semantic contract, and propagates conservative interval uncertainty. One
result-boundary rounding is bound to the reproduced run precision. Missing
candidate data or an unmet `toleranceTarget` yields a content-addressed
indeterminate result with no ranking score. This primitive cannot construct a
cohort, rank, admit, or prune. Its contract is recorded in ADR-0032.

`package-cohort-partitioner-v1` is the separate total-partition boundary before
ranking. It independently reproduces the complete census, admits only its
eligible population, preserves every exclusion, and implements all five
schema-v1 cohort rules without caller-selected subsets. Shared support is a
transitive incidence component, profile-role equality is ordered and exact,
and invariant windows use exact anchored floor bins with conservative interval
containment. Missing or boundary-ambiguous keys prevent every partial cohort.
Whole-artifact replay, exact coverage, and distinct cohort/resource/partition
hash domains prevent a stored partition from silently changing its competition
population. This boundary cannot score, rank, admit, reject, or prune. Its
contract is recorded in ADR-0033.

`package-selector-ranker-v1` is the complete finite ranking boundary. It
reproduces the census/partition and evaluates every member rather than
accepting scores. Closed score-uncertainty intervals form transitive connected
components for dense ranks, while the selector epsilon independently defines
the complete semantic extremum set under one maximum-bound comparison. An
unscoreable member nulls affected cohort and weighted variational metrics but
remains present beside provisional scored-member ranks. Canonical identity is
only an ordering/presentation tie-break. The artifact reports oriented gaps,
degeneracy, per-cohort and weighted variational selectivity, and requires exact
replay. Final multi-selector admission remains separate. The contract is
recorded in ADR-0034.

`package-selector-sensitivity-evaluator-v1` is the complete perturbation
boundary over one reproduced base ranking. It precomputes the full OAT or
Cartesian sweep, refuses partial execution when variant or functional budgets
are insufficient, scales coefficient values and absolute tolerances exactly,
and reuses the ranker's complete-cohort semantics for every variant. Stability
uses the unreduced variant-by-cohort denominator; any missing perturbed score
nulls ratios and prevents a robustness verdict. Empty/no-coefficient cases are
explicitly not applicable. Report and variant identities bind the full base
semantic chain and require exact replay. The schema-v1 inability to type every
coefficient as fixed/free/fitted remains an explicit authorship limitation.
The contract is recorded in ADR-0035.

`package-selector-admission-v1` is the complete candidate-domain combination
boundary. It verifies one full execution chain for every normalized selector
and intersects complete semantic-extremum sets over the unchanged eligible
census; selector order controls deterministic serialization, not sequential
reranking. Definite exclusion precedes missing information from another
selector, identity admission is explicit when no selectors exist, and all
local/final counts and retention ratios reconcile. Fragile sensitivity marks
variational interpretation without erasing the base selected set. The result
still contains candidate IDs rather than materialized derived elements. The
contract is recorded in ADR-0036.

`package-selected-formations-v1` is the provenance bridge after admission. It
reproduces census and admission, accepts only definite `selected` outcomes,
and preserves the canonical graph, target-depth basis, exact/profile
constituent resolution, passed predicates, selecting selectors, execution
witnesses, and claim evidence. One record remains one selected candidate, so
its counts do not masquerade as future unique-element counts. Because
the selected-formation boundary itself has no derived-profile rule and profile
identity is structural by default, it deliberately emits neither a profile nor
an element ID. Its contract is recorded in ADR-0037.

Schema-v1 offers the opt-in base-only `residual-slots-v1` policy. The additive
`residual-slots-v2` policy derives declared profile invariant coordinates by
reusing verified package functionals over each selected formation, embeds the
complete evaluation lineage, and fails the whole profile on any unresolved
coordinate. Canonical
directed endpoints consume exact-polarity or symmetric capacity, residual slots
combine with a frozen base profile. Typed partner guards execute over every
verified profile-class member; missing data, member disagreement, legacy hash
refs, or insufficient capacity are indeterminate rather than fabricated. A complete profile set materializes a
derived depth-1 population whose element identity excludes evidence and whose
alternate derivations remain in an external canonical index; any profile
indeterminacy emits no partial population. This boundary is recorded in
ADR-0038.

`package-candidate-census-evaluator-v1` composes the complete generator and the
v18 filter without adding predicate semantics. It embeds the full generated
canonical universe and every filter explanation, reconciles Boolean
selectivity and the indeterminate ratio, and attributes total versus exclusive
predicate failures. Inertness is zero observed failures; dominance uses the
explicit v1 threshold `0.90`. Budget-exhausted enumeration produces no census,
and this artifact stops before cohort construction or admission. Immutable
universe/source indexes are prepared once per filter session. Serialized
censuses can be verified only by whole-artifact deterministic reproduction;
schema validity and a self-declared hash are insufficient. The boundary is
recorded in ADR-0029.

## 5. Predicate monotonicity and explanations

Monotonicity belongs to a violation under declared extension operations, not to
a predicate name in isolation. Under additive graph extension:

- exceeding a maximum role count or maximum degree is monotone;
- being below a required minimum is repairable and therefore not monotone;
- containing a forbidden cycle is monotone under edge addition;
- lacking a required cycle is repairable and therefore not monotone.

Static inference is preferred for known expressions. Randomized audits are
falsification attempts, not proofs. Bounded differential tests compare pruning
with pruning disabled.

Compiled predicate plans therefore keep four facts separate: the package's
`monotoneViolation` declaration, static failure persistence, availability of a
partial failure witness, and the mandatory audit flag. An unproved declaration
is `blocked-unproven`; passing randomized samples cannot promote it to pruning
authority. Canonical-index degree checks are complete-candidate references and
are not assumed stable while a partial graph is still being canonicalized; the
same applies to canonical-index path endpoints. Lower-bound degree passes over
selectors whose membership can grow are not marked persistent.

Every complete canonical candidate receives a full verdict. Short-circuiting
may optimize execution but cannot erase outcomes, witnesses, or census data for
other required predicates. Pruned partial branches use a separate pruning
census and never enter completed-candidate denominators.

The partial graph evaluator deliberately emits `pruningAuthorized: false`,
including when it detects a statically persistent failure. Static proof,
runtime witness, audit evidence, and authorization to change the enumerated
universe are four distinct facts. A deterministic complete-universe,
complete-node canonical-edge-prefix falsification audit now records sampled
repairs and exact replay. Its separate controller authorizes only a passed
`static-proven` witnessed failure; a random pass never upgrades an unproved
claim. The depth-one pre-admission generator consumes that decision only with
a pruning census and pruning-disabled differential gate:
raw/unique/duplicate removals are
reconciled, every removal is confirmed by complete local filtering, and the
eligible plus indeterminate result hashes must match the disabled baseline.
The separately hashed raw-frontier audit/controller authorizes edge-group
subtree closure only after exact frontier reproduction. Recursive execution
preserves the canonical-prefix final guard and proves exact agreement with both
pre-admission-only and pruning-disabled references. Directed-strong closure is
gated on an already strongly connected frontier. A distinct depth-aware
contract binds the target depth, reproduced source-population selection, and
its complete prior-level chain while retaining separate hash domains and exact
replay. This explicit optimized path does not silently replace ordinary level
closure. These boundaries are recorded in ADR-0053 through ADR-0056.

Candidate explanation lookup is derived only from an exactly reproduced level,
never from ambient mutable run state. The v1 level index has one entry per
evaluated candidate and preserves the complete local filter, final admission
decision, optional selected formation and profile result, and every matching
derived-element derivation. The index and each query result are independently
content-addressed. This closes per-level candidate lineage while leaving
filesystem bundle persistence and source-migration traversal to later contracts;
the boundary is recorded in ADR-0057.

The integrated final level census is likewise derived only after exact replay
of an ordinary or depth-aware closure. It exposes reconciled final counts,
selectivity, predicate/selector censuses, admitted element IDs, and the source
interpretation records under its own hash without duplicating candidate
lineage or adding presentation semantics. This closes the final-census join
boundary while leaving null baselines and persisted bundles explicit; the
decision is recorded in ADR-0058.

The ambient run explanation boundary is closed by a caller-supplied verified
artifact-store snapshot, not by recomputing from package state. A run bundle
exactly replays its contiguous level chain, embeds normalized semantic inputs,
freezes the semantic manifest and per-level census/explanation indexes, and
publishes exact canonical bytes under `ArtifactRef` records. The kernel remains
free of filesystem policy; applications persist the returned bytes. Duplicate
run hashes are invalid, and an unbound `kernel.explain` fails explicitly. This
boundary is recorded in ADR-0059.

Filesystem publication remains an adapter concern. A local run directory is
accepted only after complete semantic replay and exact byte/inventory checks
under ADR-0060. Operational timestamps, engine/platform labels, resource use,
and terminal status are then appended as separately content-addressed records
under ADR-0062. Their IDs and bytes are bound to `runHash` but never feed the
semantic manifest or bundle hash; existing records cannot be overwritten.

## 6. Quantities, ranking, and sensitivity

Scientific values use typed quantities with units, tolerance, semantic meaning,
and provenance. Numeric equality is tolerance-aware; raw binary floating-point
equality is not a scientific comparison rule.

Compiled predicate plans remain package-owned and reusable. A separate hashed
numeric binding combines one verified plan with the run precision policy,
canonical selection order, and the versioned maximum-declared-tolerance rule.
It inventories numeric operations but does not resolve or evaluate values.

Predicates return `pass`, `fail`, or `indeterminate`. Functionals are separate
typed score expressions and cannot prune generation. Selectors execute only
after local eligibility filtering and retain the complete epsilon-equivalent
extremum set.

Canonical ID is a deterministic serialization tie-break and may identify a
presentation leader. It never removes a semantic tie.

Sensitivity sweeps perturb every declared free coefficient using frozen
positive amplitudes with `0 < amplitude < 1`. `one-at-a-time` is the default;
Cartesian sweeps require an explicit budget. Missing comparisons make the
report indeterminate instead of shrinking its denominator.

## 7. External scientific computation

The kernel does not solve PDEs, continuous variational equations, field
integrals, or stability problems. A versioned scientific adapter receives a
content-addressed Oracle request and returns typed values, convergence state,
residual, solver identity, parameters, and operational timing.

The kernel now validates that boundary without invoking the adapter: canonical
candidate bytes and normalized requests produce the provenance hash; solver,
parameter, unit, semantic, tolerance, residual, and evidence drift fail; and
operational wall time stays outside semantic response identity.

`failed` and disallowed `partial` results make dependent evaluations
`indeterminate`; they are never coerced to zero, `pass`, or `fail`. A permitted
partial result must satisfy the frozen residual guard and record its effective
tolerance.

## 8. Source relations and SCC condensation

Catalogue `ParentCode` is not generative by default, and one catalogue card is
not automatically one kernel element. Relation classification uses six
categories:

- `generative`;
- `constitutive`;
- `intra-closure-support`;
- `evidential`;
- `descriptive`;
- `regulatory-feedback`.

Rules, examples, exclusions, exposure status, and fitting-risk thresholds are
frozen before eligible classification sees SCC membership or acyclicity
consequences. Previously exposed work is labelled `historically-exposed`; it is
not represented as blind discovery.

Every nontrivial formation-support SCC receives one explicit disposition:

- `distributed-structure`;
- `constitutive-cluster`;
- `unresolved-generative-cluster`;
- `mixed-unresolved-cluster`.

Each surviving component becomes one stratification vertex with
`internalOrder = "undefined"`. Members inherit one depth and `depthBasis`.
Condensation yields a DAG by construction; raw source edges are not deleted.
Evidential, descriptive, regulatory, and absorbed internal relations remain in
typed explanation layers.

Node merging cannot use “this removes a cycle” as a criterion. SCC size and
structural resemblance are diagnostics only. Resolution reports quantify merge,
condensation, nonformation-layer separation, descriptive resolution, and
post-unblinding reclassification shares.

The generic ADR-0063 report now computes the raw SCC histogram,
descriptive/nonformation resolution shares, cluster/member counts, available
frozen risk signals, and exact conservation from a fully replayed caller-
supplied chain. ADR-0064 supplies the immutable post-unblinding change log and
threshold accounting. ADR-0065 applies non-empty logs through a separately
hashed effective projection, recomputes SCCs, and requires newly bound reviewed
resolution/condensation artifacts. Consequently this is useful conformance
evidence but not a license to label the current catalogue migrated or to claim
complete migration risk.
ADR-0066 completes the generic migration metric set from exactly one reviewed
raw-SCC disposition and one catalogue-level coordinate per source node. It
derives cross-level cluster counts and the risk-policy hash, but still does not
invent current-catalogue research inputs or a concentration result.
ADR-0067 freezes that complete lineage into a per-node, per-relation, and
per-raw-SCC explanation index. Query results bind the verified index identity;
presentation code cannot silently recompute against different migration
inputs.
ADR-0068 computes constitutive-cluster concentration only over a complete
source-vertex depth partition and a bottleneck definition frozen without
cluster-location exposure. Zero denominators remain indeterminate, and
depletion is retained as hypothesis-weakening evidence.
ADR-0069 derives declared residual-profile invariants only from reproduced
formation-functional evaluations and withholds the entire profile on any
indeterminate result. ADR-0070 executes bounded typed partner guards across
every verified profile-class member while legacy expression hashes remain
fail-closed. ADR-0071 freezes null-model carrier populations, ontology gates,
proposal preservation contracts, full-stage recomputation requirements, and
independent model/trial stream identities without presenting a plan as an
executed baseline.
ADR-0072 executes the three corresponding carrier-size proposal populations:
candidate-wise Fisher-Yates role shuffles, bounded role-wise directed target
swaps with complete mixing diagnostics, and exact uniform carrier draws with
replacement. Every proposal remains inside the verified carrier, and proposal
completion remains distinct from trial evaluation or a statistical baseline.
ADR-0073 then reruns the complete local predicate stage once per proposal
occurrence. It retains replacement multiplicity through separate occurrence
identities, produces per-trial Boolean/predicate censuses, and deliberately
stops before downstream selection. ADR-0074 gives cohorts a separate member
identity, uses occurrence IDs throughout null-trial membership and tie-breaking,
and recomputes functionals, selector extrema, admission, and the full declared
coefficient-sensitivity sweep for every trial. It preserves raw variational
results together with fragile/indeterminate metric interpretation. ADR-0075
keeps every null hypothesis separate, computes fixed-order metric distributions
and standardized effects without reduced denominators or fabricated zero-
variance z-scores, and embeds the verified sample chain plus baseline in
primitive and generalized-depth closures. Current-level fixpoint rounds remain
fail-closed at this historical boundary because their carrier needs a separate
null-execution contract. ADR-0080 subsequently supplies that contract with an
independent chain per round carrier and terminal-round projection.
ADR-0076 adds an explicit RunConfig choice between the compatibility
post-admission universe and complete-candidate profile-slot gating. The gate
mirrors residual-profile edge/endpoint/slot order, checks exact capacities and
typed partner guards over complete profile classes before CandidateStore
admission, and aborts rather than shrinking the denominator on indeterminacy.
Primitive, arbitrary-depth, and bounded current-level generation share the
contract. ADR-0083 later composes canonical-prefix pruning with this policy,
and ADR-0084 supplies the separate complete-extension audit for raw edge/node
frontiers.
ADR-0077 closes the previously disconnected `RunConfig.ontologyTarget`
boundary: the exact declared coordinate and ontology-axis provenance now flow
to ordinary, arbitrary-depth, and current-level results and derived elements.
It is never inferred from derivation depth, and the existing identity-policy
flag alone controls whether it changes a derived element ID.

ADR-0078 adds a closed package `candidateAttributes` registry for finite JSON
scalars. Constant definitions populate node or edge variants, while
element-invariant definitions populate exact node variants and require
canonical consensus across complete profile classes. The registry is included
in package rules identity and supplies the expression type environment.
Quantity provenance, role-dependent edge values, and formation-functional
attributes were left as separate fail-closed contracts at that boundary; the
subsequent ADR-0085, ADR-0086, and ADR-0088 close them.

ADR-0085 adds `constant-quantity-v1` and
`element-invariant-quantity-v1` to that registry. Values normalize through the
shared SI/tolerance/evidence contract, profile quotients require complete
canonical member consensus, and primitive, depth-aware, and current-level
bindings share one derivation path. Complete normalized provenance remains in
candidate identity, while derived-element identity continues to project
Quantity attributes to value, unit, tolerance, and semantic and retains the
evidence distinction in the derivation index. At this boundary, role-dependent
and formation-functional candidate sources remained fail-closed; ADR-0086 and
ADR-0088 subsequently close them.

ADR-0086 adds edge-only `edge-role-scalar-v1` and
`edge-role-quantity-v1` maps. Each map is homogeneous, canonicalized by role,
and must cover the complete normalized run role alphabet before enumeration.
Extra authored roles remain rules-hash-bearing but do not enter an unselected
run. The selected complete value participates in candidate identity; formation-
functional decoration remained fail-closed until ADR-0088.

ADR-0087 closes the previously inconsistent functional execution boundary for
typed structural `sum` expressions. Package functionals, evaluated cohort keys,
and formation-derived profile functionals now share canonical scalar/Quantity
selection and accumulation, including Quantity tolerance/evidence lineage.
This does not authorize same-candidate formation-functional decoration.

ADR-0088 freezes the acyclic alternative: the scored functional enters a
derived profile, materializes as a derived `Element` invariant, and only then
becomes an `element-invariant-quantity-v1` structural node attribute at a later
depth. Loader and binding validation preserve its unit/semantic runtime type;
direct functional feedback into the candidate being generated remains
forbidden.

ADR-0079 extends the residual-profile path with formation-derived type rules.
Each rule compares one already verified derived invariant to a compatible
same-semantic Quantity threshold, records the complete tolerance-aware
comparison, and adds its unique tag only on a pass. The resulting type set is
copied to the derived element and participates in identity exactly when the
existing `typeTagsStructural` policy enables it.

ADR-0080 closes null-model execution for bounded current-level fixpoints. The
carrier is the exact census of one round; plans, proposals, trial filtering,
trial selection, and per-model distributions are independently reproduced for
that carrier. Baseline indeterminacy is round indeterminacy, and the enclosing
level projects the terminal round's chain without cross-round pooling.

ADR-0081 separates exact incomplete-node frontier accounting from resumable
execution. Enumerator v5 records exact reachable raw subtrees and exposes an
internal node-pruning hook without authorizing package predicates. The public
resumable coordinator instead uses content-addressed prefix transcripts and
deterministic replay; operational pauses never reset semantic budgets, and a
terminal result is the ordinary v5 enumeration rather than a trusted merge of
partial stores.

ADR-0082 authorizes node-growth pruning only through an independent raw node-
prefix/complete-extension audit, exact prefix and descendant-count validation,
static persistent-failure proof, and exact differential agreement with the
pre-admission reference. The contract applies at depth one and arbitrary
verified target depths with separate hash domains. Directed-strong node
prefixes remain fail-closed because their later policy-exclusion census is not
yet fixed.

ADR-0083 composes the complete profile-slot gate with audited canonical-prefix
pre-admission pruning. Composition runs first, the monotonicity audit binds the
resulting compatible universe, and the returned generation must reproduce the
complete composition transcript and pruning-disabled eligible/indeterminate
sets. Raw edge-group and node-frontier pruning remain separately gated because
they can skip descendants before complete profile consumption is known.

ADR-0084 closes that separate gate with a content-addressed complete-extension
census. Each stable edge-group or node-assignment prefix binds exact profile-
compatible and profile-excluded descendant counts. A live authorized frontier
must reproduce the key and total before pruning, and both optimized generators
must reconcile skipped dispositions with the authoritative pre-admission
profile transcript and disabled-reference result sets. Directed-strong node
prefixes remain fail-closed under the pre-existing connectivity rule.

The kernel implements the neutral freeze boundary for these two policies. It
requires complete category/disposition rule sets, cross-checks exposure claims,
sorts set-valued fields, and derives separate domain hashes. This is contract
validation, not policy authorship: ADR-0001 and ADR-0002 still contain no
catalogue classifications or component resolutions.

The next neutral boundary freezes caller-supplied raw annotations and
adjudication. It requires complete independent human matrices or exactly the
precommitted deterministic classifier, derives rather than trusts disagreement,
prevents adjudication from overwriting unanimous labels, and records canonical
freeze/unblinding times. It does not provide the annotation UI, authenticate a
clock, or assign a category to any current catalogue edge.

The catalogue adapter then constructs the exact policy-visible relation view
and can project a verified caller-supplied decision chain into typed relations.
It computes both the generative and broader formation-support SCC partitions
over relation endpoints. Component identity includes complete internal typed
endpoint relations; input/traversal order is non-semantic. Isolated catalogue
cards, node dispositions, and condensation remain separate reconciliation
steps, so this projector cannot claim a completed migration.

The Level-0 component `{0.8, 0.21, 0.22}` is a registered candidate for one
distributed closure-bearing structure or a constitutive cluster. Its shape is
not proof that it is identical to the paper's resonant triad.

## 9. Reproducibility decisions

The first executable level coordinator is intentionally scoped to primitive
depth zero through derived depth one. The generalized coordinator reuses that
stage chain over a verified contiguous prior-level sequence, and the explicit
bounded ladder applies it in ascending order. Each level binds one normalized
run, preflights selector work across the whole transition, and executes the
complete configured null-model chain through per-model baseline interpretation.
Empty and indeterminate terminals are hashed results; neither is presented as
a completed population.
Profile collapse now compares independently closed exact/profile ladders only
after canonical projection into the profile domain. Frozen-interval boundary
diagnostics report candidate minima separately from detections and never
rewrite declared coordinates. Carrier promotion is a separately hashed replay
boundary: it consumes one verified level and collapse report, requires explicit
claim/evidence and cross-level coordinates, and emits a new primitive input
without modifying the source. Current-level bounded fixpoints are a separate
coordinator with explicit loader/run opt-ins, monotone rounds, withheld final
populations on non-convergence, and independent null chains over each round
carrier. Null execution plans, proposals, trial evaluations, and statistical
baselines are separately hashed and replayed without carrier pooling.

Semantic hashes exclude timestamps, wall-clock duration, machine paths, and UI
metadata. Operational manifests may contain them separately.

Null models are explicit configuration, not mandatory hidden defaults. Seeds,
trial counts, graph conventions, sampling measures, degenerate-statistic
behavior, and interpretation thresholds participate in the run identity.

When null variance is zero, the z-score is `null`. The report records whether
the observation equals or differs from the constant null value; it does not
emit infinity or `NaN`.

## 10. Deliberate exclusions

The kernel does not contain:

- a visual editor or UI state;
- product workflows or marketplaces;
- a temporal simulation engine;
- arbitrary executable code from rule packages;
- undocumented scientific datasets or inferred empirical validation;
- a continuous numerical solver;
- hidden environment-dependent defaults.

Names such as `energy`, `mass`, `field`, and `particle-like` retain the
structural meanings declared by their package until separate evidence supplies
an empirical interpretation.

## 11. Open scientific inputs

Software contracts cannot manufacture missing research definitions. Case
packages still need frozen choices for:

- unit systems and normalization maps;
- coefficient values and uncertainty;
- contested-resource cohort keys;
- selector epsilon and sensitivity thresholds;
- perturbation domains and stability thresholds;
- oracle methods, residual semantics, and certificates;
- external datasets, preprocessing, graph conventions, and null hypotheses;
- carrier-promotion rules between ontology levels.

Absent inputs produce incomplete packages or traceable indeterminate results,
not fabricated scientific conclusions.
