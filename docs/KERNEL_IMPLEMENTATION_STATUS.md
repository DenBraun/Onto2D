# Kernel Implementation Status

Status: schema-v1 kernel implementation is locally closed. The public pending
capability registry is empty; package/run execution, multi-depth and fixpoint
closure, predicates/functionals/selectors, sensitivity and null models,
profile/type/invariant materialization, audited pruning, explanations,
source-migration binding, and reproducible artifacts all have executable
verification paths. The generic reviewed source-migration pipeline remains in
the catalogue adapter and is loadable through the closed kernel manifest.

The current 437-test regression, repository checks, schema/runtime conformance,
independent golden verification, and build pass locally on macOS arm64 under
Node.js 24.19.0. Fresh Linux/macOS/Windows x Node.js 22/24 CI and independent
review of the frozen canonical fixtures remain the release-
acceptance gate. Actual reviewed current-catalogue policy/annotation/decision
artifacts and remote deployment adapters are external project inputs, not
pending kernel algorithms.

## Implemented boundary

`@onto2d/kernel` now has its first executable layer:

- `canonical.js` converts plain JSON-compatible values to guarded canonical
  bytes, normalizes negative zero, rejects non-finite numbers, cycles,
  accessors, sparse arrays, invalid Unicode, prototype-sensitive keys, and
  configured resource-limit violations;
- `hash.js` frames versioned Onto2D domains before SHA-256 hashing and produces
  `sha256:<hex>` content identifiers and canonical forms;
- `errors.js` defines stable `code`, `stage`, `message`, and structured
  `details` contracts;
- `package-loader.js` materializes deterministic defaults, validates and
  normalizes a schema-v1 `RulePackage`, resolves claim/evidence and
  selector/functional/cohort references, rejects current-depth predicate
  references and ontology-phase cycles, computes explicit profile and ordinary
  primitive identities, accepts normalized Quantity or JSON-scalar primitive
  invariant values with cross-declaration type checks, normalizes a closed
  constant/element-invariant/role-dependent scalar/Quantity candidate-attribute registry and supplies
  its types to expression analysis, verifies formation-functional Quantity
  carry-forward compatibility, normalizes four finite
  typed perturbation classes while retaining registry-only compatibility, and emits package/rules/depth-basis/identity-policy
  hashes;
- `graph-canonicalizer.js` validates supplied candidates and graph policy,
  applies exhaustive permutation-minimum labeling to simple skeletons and exact
  1-WL refinement plus deterministic individualization to decorated candidates,
  emits domain-separated candidate/skeleton identities, preserves reversible
  node/edge mappings, and keeps standalone skeleton identity independent of
  connectedness;
- `skeleton-enumerator.js` exhaustively visits the bounded labelled simple-graph
  universe, rejects disconnected inputs, deduplicates canonical skeletons, and
  emits explicit completion or budget-exhaustion state;
- `candidate-store.js` fixes one counting domain and canonicalization policy,
  admits one canonical representative, counts duplicates, sorts snapshots by
  candidate ID, and requires explicit successful finalization for
  interpretability;
- `candidate-enumerator.js` closes and normalizes finite skeleton/node/edge
  alphabets, deterministically assigns references, direction, roles, parallel
  multiplicity, enabled loops, and structural attributes, sends complete
  decorations through CandidateStore, separates directed-connectivity
  exclusions and canonicalization-indeterminate candidates from deduplication,
  and returns explicit raw/state/unique/search budget exhaustion;
- `run-config.js` validates the closed schema-v1 research configuration,
  materializes only the five documented run-budget defaults, canonicalizes
  set-valued fields, and returns an immutable normalized value;
- `loaded-package-verifier.js` provides one shared replay boundary that
  reconstructs the current loader artifact under an independently expected
  kernel version before downstream runtimes trust its primitive identities,
  plans, or semantic manifest;
- `primitive-depth-population.js` reproduces each primitive identity basis and
  canonical form, materializes complete depth-zero `Element` records, and
  content-addresses the sorted population without accepting derived IDs;
- `package-candidate-generator.js` reproduces the complete loaded-package
  artifact through the shared verifier, binds its materialized primitive
  population and explicit target/source-depth selection, derives element-exact
  or profile-quotient node alphabets, discloses deterministic profile
  representatives, copies selected finite scalar/Quantity definitions with SI
  normalization and exact profile-class consensus, derives homogeneous role-
  dependent edge values with complete RunConfig role-alphabet coverage, and binds the complete connected
  skeleton set, hashes the package/run/execution basis, and executes the
  resulting finite universe;
- `package-profile-composition.js` applies the opt-in identity-bearing
  `profile-slot-gate-v1` policy to complete canonical candidates before
  CandidateStore admission, consumes role/polarity capacities in deterministic
  edge/endpoint/slot order, evaluates typed partner guards across complete
  profile classes, records content-addressed decision transcripts and separate
  exclusions, and aborts the whole generation on indeterminacy; primitive,
  arbitrary-depth, and bounded current-level paths share this gate, while the
  unchanged compatibility default emits an explicit `not-run` artifact;
- `package-candidate-filter.js` reproduces the loaded package and complete
  candidate binding, re-canonicalizes a candidate under the bound policy,
  proves its domain/budget/skeleton/node/edge/adjacency-group membership,
  resolves every canonical node to an exact element or disclosed profile
  representative, rejects unavailable node/edge predicate attributes against
  their respective structural alphabets before they can become empty
  selections, reproduces every plan's run numeric binding,
  evaluates every graph, supported local-numeric, supported irreducible-
  removal, exact-domain novelty, or exact/sampled typed `stableUnder` top-level
  predicate under the applicable bound policy and perturbation context, and
  emits a content-addressed local verdict without claiming selector admission;
- `package-candidate-census.js` requires complete package enumeration, prepares
  one verified reusable filter session with immutable universe/source indexes,
  retains every canonical candidate's full filter artifact, reconciles
  candidate and per-predicate counts, derives Boolean selectivity plus
  threshold-bound indeterminate interpretation, refuses to construct a census
  from an exhausted budget, and verifies stored artifacts by exact reproduction;
- `package-null-model-plan.js` accepts only a reproduced complete primitive or
  depth-aware census, binds its full canonical carrier and ontology gate,
  freezes all three model preservation/proposal contracts and mandatory
  per-trial recomputation policy, derives independent model/trial streams from
  the run seed, enforces hard carrier/trial limits, and exactly replays both
  explicit disabled and enabled-but-not-yet-executed plans;
- `package-null-model-proposals.js` executes carrier-size, domain-separated
  deterministic role-shuffle, degree-preserving-rewire, and exact-uniform
  proposal populations, retains duplicate occurrences and complete swap/mixing
  diagnostics, rejects invalid or outside-carrier rewires, enforces hard work
  limits, and exactly replays primitive and depth-aware results;
- `package-null-model-trial-census.js` refilters every proposal occurrence under
  the reproduced primitive or depth-aware binding, retains replacement
  multiplicity through unique occurrence identities, reconciles per-trial
  Boolean and complete predicate censuses, and exactly replays the aggregate
  without claiming downstream selection or a statistical baseline;
- `package-null-model-trial-selection.js` preserves occurrence identity through
  reconstructed cohort keys, repeated functional scoring, dense epsilon
  extrema, the full declared coefficient-sensitivity sweep, and multi-selector
  admission for every primitive or depth-aware trial, with separate aggregate
  work ceilings and exact replay;
- `package-null-model-baseline.js` verifies the complete observed and trial
  chain, keeps model populations separate, computes fixed-order compensated
  means, sample standard deviations and standardized effects for every
  supported metric, preserves missing/fragile/one-run/zero-variance states,
  and exactly replays primitive and arbitrary-depth baselines; ordinary and
  generalized-depth level closures embed the full sample chain whenever null
  models are configured, while disabled runs retain the compact `not-run`
  state;
- `package-functional-evaluator.js` accepts only an exactly reproduced eligible
  package filter, reuses the verified binding precision and source population,
  reanalyzes the normalized functional, executes canonical counts,
  coefficients, exact/profile-consensus or explicitly aggregated numeric
  Quantity/scalar invariants, addition, and
  general Quantity products, propagates evidence plus conservative interval
  bounds, rounds once, and emits a content-addressed scored or indeterminate
  artifact according to the declared result tolerance target;
- `package-cohort-partitioner.js` independently reproduces a complete package
  census, preserves rejected and filter-indeterminate exclusions, executes
  cohort keys through the verified package value runtime, constructs total
  shared-support, profile-role, invariant-window, singleton, or global
  partitions, refuses partial membership under indeterminacy, and verifies
  stored partitions by exact deterministic reproduction;
- `package-selector-ranker.js` independently reproduces the complete
  census/partition, evaluates every member through one verified functional
  session, emits deterministic dense uncertainty-interval ranks, complete
  epsilon extrema, oriented gaps, degeneracy and variational metrics, retains
  unscoreable members with null affected metrics, and verifies stored rankings
  by exact deterministic reproduction;
- `package-selector-sensitivity.js` independently replays the base ranking,
  preflights complete OAT/Cartesian sweeps and hard budgets, perturbs values
  and absolute tolerances exactly, reevaluates all cohort members, preserves
  the complete comparison denominator, and verifies hashed reports by replay;
- `package-selector-admission.js` verifies exactly one complete execution chain
  for every declared selector, intersects semantic-extremum membership,
  preserves exclusion/indeterminacy precedence, reconciles final counts and
  retention ratios, and verifies stored admission by exact replay;
- `package-selected-formations.js` reproduces census and admission, emits one
  provenance-complete record per definitely selected candidate, preserves
  exact/profile constituent resolution and claim evidence, reconciles counts,
  and verifies stored formation sets by exact replay without creating profiles
  or elements;
- `profile.js` provides the shared canonical profile normalization/hash path
  used by both package loading and derived extraction;
- `package-derived-profiles.js` executes the optional residual-slot policy over
  every selected formation, records endpoint consumption, base/residual
  composition and closed indeterminate outcomes, and verifies the full set by
  exact replay;
- `package-derived-depth-population.js` materializes a complete depth-1
  `Element` population only from complete profiles, separates structural
  identity from derivation/evidence, reconciles duplicate identities through a
  canonical derivation index, and verifies stored populations by exact replay;
- `quantity.js` implements the versioned `si-multiplicative-v1` grammar,
  exact rational unit-scale composition, dimensional compatibility, canonical
  SI-base conversion, exact terminating-decimal value/absolute-tolerance
  conversion, and tolerance-aware comparisons;
- `decimal.js` implements canonical coefficient/scale decimals, exact
  addition/subtraction/multiplication, bounded rounded division, all declared
  rounding modes, and exact or compensated rounded/unrounded accumulation;
- `expression-analyzer.js` validates and normalizes the recursive
  `ValueExpression` AST, infers scalar/quantity results and SI dimensions,
  records invariant/coefficient/attribute/role dependencies, enforces fixed
  resource ceilings, and emits domain-separated expression and analysis
  hashes without evaluating the expression;
- `predicate-analyzer.js` validates all Boolean predicate operators, reuses
  typed value analysis for comparisons and balances, extracts graph/data/
  witness requirements, conservatively derives pass/fail persistence and
  partial detectability, and emits content-addressed predicate plans without
  evaluating a candidate;
- `predicate-plan-verifier.js` closes and reproduces compiled expression,
  analysis, pruning, and plan identities before an execution boundary may
  consume them;
- `graph-predicate-evaluator.js` re-canonicalizes complete candidate graphs,
  evaluates logical plus graph-structural plans with canonical witnesses, and
  detects selected statically persistent failures on bounded partial graphs
  without authorizing generator pruning;
- `package-pruning-audit.js` reproduces the complete depth-one candidate
  universe, samples the canonical strict edge-prefix extension frame without
  modulo bias, records partial-fail/extension-pass counterexamples, exactly
  verifies stored audits, and emits a separate authorization decision only for
  a passed statically proven persistent failure;
- `package-pruned-candidate-generator.js` prepares that verified controller
  once, applies canonical-prefix decisions before CandidateStore admission,
  reconciles raw/unique/duplicate removals, confirms every removal against a
  complete local filter, and proves eligible/indeterminate equality against a
  pruning-disabled replay;
- `package-generator-frontier-audit.js` binds the actual raw edge-group
  traversal and exact descendant counts to a second falsification audit,
  records an independent complete-extension profile census for every stable
  frontier,
  verifies both audits in a prepared controller, validates every frontier
  against its bound skeleton/alphabet, and requires directed-strong frontiers
  to be already strongly connected before recursive authority exists;
- `package-recursive-pruned-candidate-generator.js` closes authorized
  depth-one edge-group subtrees, retains canonical-prefix pre-admission as a
  final guard, reconciles skipped profile-compatible/excluded descendants,
  records exact skipped raw/state censuses, and proves exact
  agreement with pre-admission-only and pruning-disabled references;
- `package-node-frontier-audit.js` binds raw complete extensions to every
  strict non-empty node prefix, samples persistent-failure counterexamples,
  records an independent complete-extension profile census,
  validates exact prefix/alphabet/descendant metadata, and prepares authority
  only outside the unresolved directed-strong exclusion universe;
- `package-node-growth-pruned-candidate-generator.js` closes authorized node-
  assignment subtrees, retains pre-admission as a final guard, reconciles
  skipped profile-compatible/excluded descendants, and proves exact
  raw-count, store, eligible, and indeterminate agreement at depth one and,
  through the generalized depth bridge, arbitrary verified target depths;
- `local-predicate-evaluator.js` composes the complete graph runtime with
  scalar/direct-quantity comparison, canonical node/edge counts, exact
  dimensionless addition/multiplication, role-filtered directed cycle-edge
  union selection, boundary-only rounding, verified
  predicate numeric bindings, and deterministic single-node/single-edge
  irreducible-removal plus exact-constituent novelty evaluation while rejecting unfrozen value sources and
  aggregate value/selection/removal limit exhaustion before evaluation;
- `numeric-binding.js` verifies compiled predicate identities, normalizes the
  run precision and quantity semantic policies, inventories numeric operations,
  and emits a separate content-addressed policy binding without evaluating
  values;
- `oracle-validator.js` verifies candidate canonical bytes, normalizes and
  hashes scientific requests, validates response solver/parameter/quantity/
  residual/evidence bindings, and applies explicit partial-result policy
  without invoking a solver;
- `source-policy.js` validates complete classification/disposition rule
  vocabularies, cross-checks authorship and exposure declarations, freezes
  forbidden SCC/topology inputs and migration-risk thresholds, binds
  classification identity into node resolution, and content-addresses both
  policy artifacts without classifying catalogue data;
- `source-classification.js` reproduces frozen policies, requires complete
  independent human annotation matrices or the exact precommitted deterministic
  classifier, binds annotation-view and exposure declarations, preserves raw
  disagreement, freezes blind adjudication and unblinding time, and derives
  disagreement-risk state without supplying any catalogue annotation;
- `kernel.js` exposes `createKernel().loadPackage()`, RunConfig normalization
  and package candidate binding/execution,
  graph/skeleton canonicalization, connected-skeleton and finite decorated-
  candidate enumeration, primitive depth-population materialization,
  CandidateStore creation, quantity/decimal operations,
  value/Boolean analysis, predicate-plan compilation, graph and local exact-
  compare predicate evaluation, package-bound local filtering, complete local-
  filter censuses, package functional evaluation including typed
  scalar/Quantity structural sums, complete cohort partitioning,
  selector ranking, coefficient sensitivity, and multi-selector admission with
  reproduction verification, selected-formation materialization/verification,
  residual-profile extraction/verification, derived depth-1 population
  materialization/verification, package-level primitive-to-depth-1 closure and
  exact verification, target-depth-1/2 source selection and depth-aware
  candidate binding/enumeration/filter census, and partial-failure
  diagnostics,
  predicate numeric-policy binding, Oracle request/response validation,
  source-policy and annotation/adjudication freezing, and a truthful capability
  manifest.

`@onto2d/catalog-adapter` retains its non-mutating source audit and now also
constructs a policy-limited classification view. From a reproducible caller-
supplied policy/annotation/adjudication chain it emits every classified
relation exactly once and computes deterministic directed SCC partitions for
the `generative` and `generative + constitutive + intra-closure-support`
projections. Given a complete source-node inventory and explicit reviewed
component/rationale/edge decisions, it also reconciles isolated records,
derives the exact vertex partition, retains all six typed relation layers, and
verifies a generative DAG condensation. It does not apply a policy or invent
decisions for the current catalogue.

The loader requires at least one primitive and requires every primitive profile
to be explicit. Derived profiles remain unavailable by default, but packages
may now opt into the hashed `residual-slots-v1` definition with a normalized
base profile, derived type tags, and claims. `residual-slots-v2` additionally
binds formation-functional profile invariants, their compatible quantization,
  and all-or-nothing evaluation lineage. `residual-slots-v3` adds tolerance-
  aware derived-invariant threshold rules and complete type-assignment
  transcripts. Other declarative derivation is not
silently simulated. Quantities in packages and structural candidate
attributes are parsed and converted to canonical multiplicative SI-base units
before hashing. Compatible unit representations share structural identity;
malformed, unsupported, or dimensionally incompatible units fail explicitly.
Functionals are now checked against their inferred expression dimension during
package loading. Cohort window expressions must be numeric and dimensionally
compatible with their declared origin. The loader also rejects incompatible
types for an invariant name shared by multiple primitives and hashes the
normalized expression form.
Every loaded predicate now has a normalized Boolean AST and a sorted compiled
plan. A declared monotone violation is marked `static-proven` only when failure
persistence and partial failure detection are both established. Unproved
claims remain `blocked-unproven`; a monotonicity audit is still required for
every declared claim and cannot convert an absent proof into pruning authority.
Run precision does not contaminate the reusable package plan identity.
`predicate-numeric-binding-v1` verifies that plan and its analysis, records
`decimal-rational-v1`, the normalized rounding/summation policy, canonical
selection order, `declared-max-tolerance-v1`, the semantic comparison policy,
and every consuming numeric operation under a separate binding hash. The
verification reproduces all analysis witnesses and pruning metadata rather
than trusting duplicated plan fields.

`graph-predicate-evaluator-v1` uses the same reproduced-plan boundary and
accepts only `all`, `any`, `not`, `degree`, `cycleExists`, `connected`,
`componentCount`, `pathExists`, and `countRole`. It binds a complete canonical
candidate, effective graph policy, three-valued result, and canonical-index
witnesses in a separate evaluation hash. `partial-graph-predicate-evaluator-v1`
accepts only bounded partial graph data and only runs a plan already marked
`static-proven`; even a detected persistent failure records
`pruningAuthorized: false`. `package-predicate-monotonicity-auditor-v1` now
binds the complete depth-one package/run universe, seed, strict edge-prefix
frame, every sampled partial/extension outcome and any counterexample.
`package-partial-pruning-controller-v1` exactly reproduces that audit and emits
a separate authorization only when the whole audit passed, the plan is
`static-proven`, and the diagnostic actually found a persistent failure.
`package-pruned-candidate-generator-v1` consumes the same decisions through a
prepared session before CandidateStore admission. Its returned pruning census
contains unique decisions plus raw multiplicities and a rolling transcript;
exact baseline count reconciliation, complete-filter confirmation, and equal
eligible/indeterminate result hashes are mandatory.
`package-generator-frontier-auditor-v1` separately binds the actual raw
edge-group traversal and exact descendant counts. Its prepared controller and
`package-recursive-pruned-candidate-generator-v1` now close audited depth-one
subtrees for undirected or directed-weak connectivity, retain pre-admission as
a final guard, and require exact agreement with both reference modes.
`package-node-frontier-auditor-v1` separately binds strict node prefixes to
complete raw extensions. Its prepared controller reproduces exact subtree
counts before `package-node-growth-pruned-candidate-generator-v1` closes a
branch. Depth-aware variants bind target/source identity in separate hash
domains. Directed-strong node prefixes remain fail-closed because their later
policy exclusions are not yet fixed; this restriction preserves the complete
census rather than merely the retained store.

`local-predicate-evaluator-v19` verifies both plan and numeric-policy binding,
then executes mixed graph and `compare` plans for scalar constants, direct
constant quantities, canonical node/edge counts, and exact dimensionless
addition/multiplication. It also executes exact-decimal or compensated-binary64
sums over finite scalar or Quantity-valued structural node or edge attributes
in canonical selection order. Quantity sums require matching declared SI
units/semantics, conservatively sum each input's effective absolute tolerance,
and emit computed provenance with canonical evidence union. Compatible
Quantity constants, sums, and nested additions compose recursively with exact
decimal value addition, additive effective absolute bounds, computed
provenance, and propagated exactness. Exactly one Quantity factor may be
scaled by supported dimensionless number expressions; its unit and semantic
are preserved and its effective absolute bound is multiplied by the scalar
magnitude. Accumulation remains unrounded until the operand boundary; nested
dimensionless arithmetic propagates approximation state. Each operand rounds once at the declared result boundary, and
terminating SI unit conversions enter that boundary without intermediate
binary64 multiplication. An `element-exact` Quantity or package-authored scalar
invariant resolves only from an explicit context covering the candidate's
exact source elements; the artifact binds its source-population hash and a
typed normalized resolution witness. A `profile-quotient` invariant defaults
to complete identical normalized Quantity or exact-scalar consensus. An
explicit numeric expression may bind `arithmetic-mean-conservative-v1`; the
runtime then covers the full member class, exact-sums decimal point values,
divides under run precision, and for Quantities conservatively averages member
bounds, covers rounding, and unions evidence under computed provenance. Its
profile, full membership, consensus or aggregation policy, diagnostic, and
value are retained without consulting the formation representative. Missing,
ambiguous, or incomplete candidate
data becomes a structured local `indeterminate`; malformed contexts and
type/unit/semantic mismatches remain hard errors. The local artifact binds the
sorted non-empty `invariantNames` beside its source-population hash, even if a
stability family contains no evaluated attempt. Complete node/edge balance aggregates the declared
attribute through the same path, rounds once, and compares its absolute
magnitude with the explicit Quantity threshold under the bound tolerance
policy. `irreducibleRemoval` binds the run substructure policy, evaluates every
permitted canonical single-node or single-edge removal after a whole pass, and
retains skipped/evaluated removals, canonical parent mappings, outcomes, and
nested witnesses. `minimal` binds that policy and exhaustively evaluates every
proper parent-index subgraph admitted by its node/edge mode, retaining raw and
effective selections, normalized mappings, skipped cases, and nested outcomes.
Its exact family size is preflighted against the shared 10,000-substructure
ceiling. `novel` evaluates a passing `element-exact` whole against every
canonical single-node, zero-edge constituent projection, retains exact source
and projection identities plus parent mappings, and shares the attempt limit.
It requires no removal policy of its own and rejects profile-representative
substitution. `stableUnder` exhaustively executes or deterministically samples
typed edge/node deletion, edge-role replacement, and structural numeric-
attribute displacement. It binds a perturbation-context hash, preserves every
valid or skipped attempt and canonical parent mapping, and decides from exact
three-valued fractions or conservative joint 95% sampled confidence bounds;
an empty exact family is indeterminate unless `vacuous-pass` is explicit.
Sampled execution binds an unbiased RunConfig-hash-derived SHA-256 rejection
stream, with-replacement frame indexes, and the requested sample budget.
Registry-only definitions fail closed, and perturbations share the preflighted
10,000 structural-attempt ceiling. Retained-node invariants resolve inside all
four substructure combinators from the immutable source-population context;
selectors are reevaluated after canonicalization and graph edits never
recompute invariant values. Additional profile aggregation operators still
fail preflight as invalid future schema extensions rather than acquiring hidden
defaults; the schema-v1 registry is closed under ADR-0090. Coefficients remain
deliberately forbidden by the predicate-only expression environment.

`package-functional-evaluator-v1` is the separate post-filter functional
boundary. It independently reproduces the loaded package, binding, and full
eligible filter artifact before resolving one functional. It supports numeric
and Quantity constants, canonical node/edge/directed-cycle counts, normalized
coefficients, element-exact or identical-profile-consensus Quantity or numeric
scalar invariants, dimension-compatible addition, and general Quantity
multiplication. Values stay unrounded through the expression; multiplication
uses conservative point-interval propagation, and the result specification
supplies the final canonical unit and synthesized semantic. A result that
exceeds `toleranceTarget`, or candidate-specific missing/ambiguous invariant
data, produces a hashed `indeterminate` artifact and no ranking score. This
candidate-local evaluator does not itself construct cohorts, rank selectors,
or execute sensitivity.

`package-cohort-partitioner-v1` is the total pre-ranking boundary. It
independently reproduces the complete local-filter census and its package/run
basis, carries all rejected and filter-indeterminate IDs as exclusions, and
partitions only the complete eligible population. Shared support uses
transitive candidate/resource incidence components, profile-role keys preserve
ordered exact atoms, and invariant windows use exact signed floor bins with
conservative interval containment. Singleton and global rules remain explicit.
A source-census threshold or any missing, ambiguous, or boundary-crossing key
produces no partial cohorts. Complete artifacts reconcile coverage and overlap,
use distinct cohort/resource/partition hash domains, and are accepted only by
exact replay. The partitioner does not score, rank, admit, reject, or prune.

`package-selector-ranker-v1` is the complete finite ranking boundary. It
requires the selector's exact reproduced partition, evaluates its functional
for every member, orders scoreable candidates by objective-rounded score and
canonical ID, and forms dense ranks from transitive closed uncertainty-
interval components. Epsilon extrema use a separate single closed maximum-
bound comparison against the mathematical optimum. Ranked cohorts expose the
complete extremum set, presentation leader, degeneracy, ratio, variational
selectivity, and non-negative first-to-second member gap. Any unscoreable
member remains embedded, leaves provisional ranks inspectable, and nulls the
cohort and weighted selection metrics. Empty/source-indeterminate partitions
remain explicit. The artifact has a deterministic evaluation ceiling, a
separate hash domain, and whole-artifact replay. It does not materialize
selected candidates or authorize pruning.

`package-selector-sensitivity-evaluator-v1` is the complete perturbation
boundary over that reproduced ranking. It expands every required OAT or
Cartesian variant before work, applies exact multiplicative factors to values
and absolute tolerances, preserves relative tolerance/provenance, and
reevaluates every cohort member through the verified functional session. Run
and hard ceilings prevent partial sweeps. Stability uses the full variant-by-
cohort denominator; missing variants null all ratios and cannot yield a
robustness verdict. Empty and no-coefficient cases are explicit
`not-applicable` artifacts. Basis-bound variant/report hashes and exact replay
protect stored output. Multi-selector combination remains a separate artifact.

`package-selector-admission-v1` verifies every normalized selector's complete
partition/ranking/sensitivity chain over the same reproduced eligible census.
It intersects full semantic-extremum sets rather than presentation leaders or
sequentially reranked subsets. Definite exclusion precedes another selector's
missing information; otherwise all selectors must select the candidate.
Packages with no selector receive explicit identity admission. Per-candidate
decisions, per-selector censuses, final counts, retention ratios, and the
thresholded indeterminate interpretation are hash-bound and exactly replayed.
Sensitivity fragility remains a metric interpretation and does not erase the
base selected set. This boundary emits selected candidate IDs, not derived
elements or profiles.

`package-selected-formations-v1` reproduces that admission plus the complete
local census and emits exactly one formation record per definitely selected
candidate. Each record retains the canonical candidate, target depth, depth
basis, source population, exact or profile-representative constituent
resolution, every passed predicate, every selecting selector, selector
execution witnesses, and the predicate/functional/selector claim and evidence
union. Per-formation and whole-set hashes plus exact replay reject stale or
caller-fabricated provenance. The artifact preserves the full admission counts
and explicitly does not emit a derived profile, element ID, alternate-
derivation reconciliation, or depth population.

`package-derived-profile-extractor-v3` implements the separate residual-slot
boundary. Canonical directed edges consume one source `out` and target `in`
capacity, with exact polarity preferred over `sym`; finite capacities are
subtracted and combined with the frozen base profile. Typed partner guards
execute over every verified partner profile-class member with complete hashed
check transcripts; legacy hashes, missing data, member disagreement, missing
capacity, and the default `explicit-only` policy remain distinct content-
addressed outcomes. The opt-in `residual-slots-v2` policy additionally
derives typed profile invariants by executing declared package functionals over
each verified formation, retains every functional artifact, and blocks the
whole profile on any unresolved coordinate. V3 then derives type tags from
those scored invariant quantities with complete comparison lineage. The extractor retains every
selected formation and requires exact replay.

`package-derived-depth-population-v3` emits complete derived elements
only when every selected profile materialized. It derives structural identity
from canonical graph content and identity-policy fields while excluding
derivation/evidence provenance, stores complete `Element.provenance`, and
retains all paths in a canonical alternate-derivation index. Any profile
indeterminacy yields no partial population. Empty selection yields an explicit
empty depth, and stored populations require exact replay. An explicit
normalized run ontology target is materialized with independent declared-axis
provenance at primitive, arbitrary-depth, and bounded current-level boundaries;
the loaded identity-policy flag alone controls whether it affects the element
ID.

`package-level-closure-v1` is the first integrated level coordinator. It
replays the package and RunConfig, constructs the complete census, executes
every declared cohort/ranking/sensitivity chain, performs admission and both
materialization boundaries, and embeds the resulting depth-1 population in one
level artifact. Ranking work, perturbation variants, and sensitivity
evaluations are preflighted across all selectors. Run and result identities are
domain separated, complete/empty/indeterminate terminals are explicit, and
stored results require exact replay. Configured null models execute their full
sample and baseline chain inside this coordinator; it remains limited to
primitive depth zero as its source population, while later depths use the
generalized coordinator below.

`package-depth-source-selector-v2` is the generalized post-closure bridge. It
exact-replays every prior level, requires contiguous complete depths, executes
`all-below` versus `previous-only`, records every element occurrence and
minimum depth, and emits canonical element/profile alphabets for explicit
target depths up to 64. `package-depth-candidate-binding-v2` binds those alphabets to the same
finite skeleton/decoration policies and budgets, and
`package-depth-candidate-generator-v3` enumerates the resulting target-depth
candidate universe. The depth-aware filter exact-replays that binding, resolves
selected-depth constituents, and evaluates the local predicate set;
`package-depth-candidate-census-evaluator-v1` covers the complete canonical
universe and reconciles Boolean selectivity plus predicate diagnostics.
Depth-aware cohort/ranking/sensitivity/admission wrappers reproduce those
artifacts and reuse the same verified primitive selection policies. Depth-aware
formation, profile, and population materializers then preserve the target depth
without creating a second identity policy.

`package-depth-level-closure-v1` integrates that complete chain for one target
over a verified contiguous prior-level sequence. It embeds the prior level,
population, and run hashes plus its exact source selection, applies the shared
whole-level preflight, executes configured null models over the exact target-
depth carrier, and emits the same complete/empty/indeterminate terminal and
baseline contract as depth one. `package-ladder-closure-v1` executes consecutive depths,
retains a canonical minimum-depth/all-appearances element index, reports
introductions, re-derivations, per-depth selectivity, and aggregate execution,
and terminates at the request, a no-new-element fixpoint, or indeterminacy. Both
stored levels and ladders require exact deterministic replay.

`package-current-level-fixpoint-closure-v2` is the opt-in coordinator for a
self-referential target level. The loader accepts `referencesDepth: "self"`
only with an explicit loader option, and execution also requires an enabled
bounded-fixpoint RunConfig with one through 10,000 rounds. Every round binds the
configured below-depth source plus the prior current set, reproduces the full
census/selector/admission/materialization chain, and accumulates only new
canonical element identities. Convergence is the first round adding nothing.
Configured null models execute independently against each round's exact census
carrier, and the terminal round baseline is projected to the level.
Exhaustion or a round-level indeterminate result retains a tentative audit
population but publishes no final elements or selectivity. Lower direct-call
levels, stored levels, and the `package-fixpoint-ladder-closure-v1` result are
accepted only by exact replay. The generic ladder and configured-kernel level
adapters dispatch to this coordinator when bounded mode is enabled.

`package-profile-collapse-evaluator-v1` independently closes the requested
bounded depth under `element-exact` and `profile-quotient`, projects verified
constituents into one canonical profile candidate domain, groups exact
multiplicity, and compares predicate/final-selection plus selector score/rank
observables. It reports the unclamped symmetric-difference error over the
projected exact admitted set, preserves the smallest set or observable
counterexample, distinguishes an earlier ladder terminal as truncation, and
requires exact replay. `package-level-boundary-detector-v1` reuses one paired
ladder across all requested transitions, applies frozen inclusive target-depth
intervals, maximum collapse error, and tie tolerance, reports candidate minima
without detection when intervals are absent, compares only explicit uniform or
run-target declarations, and never mutates coordinates. Its complete report is
also domain-hashed and exactly replayed.

`package-carrier-promotion-materializer-v1` verifies one ladder and bounded
collapse report before reading the selected derived source population. Its
closed policy requires strictly increasing ontology coordinates, non-empty
target tags, and existing package claim/evidence references. Empty profiles or
indeterminate source/collapse inputs produce no partial promotion. A completed
counterexample is either blocked or explicitly recorded and accepted. Every
mapping retains source identity, rules/profile/collapse provenance, and emits a
complete loadable target `PrimitiveDefinition`; the set is domain-hashed and
accepted only by exact replay.

The local selector method `directed-cycle-edge-union-v1` chooses every
role-filtered canonical edge that participates in a directed cycle, once per
edge. It feeds count, scalar/Quantity sum, and balance, preserves loops,
reciprocal pairs, and parallel edge identity, and records its method plus exact
edge indexes in every selection witness.

`package-candidate-filter-evaluator-v20` composes these verified boundaries for
one complete package candidate. It reconstructs the complete binding from the
recorded normalized run and execution limits, rejects candidates outside the
bound decoration universe, and retains the canonical candidate plus exact or
profile-representative constituent resolution as a formation basis. It
preflights every top-level plan for local support, derives each numeric binding
from the reproduced run precision, derives invariant inputs from the complete
selected source class without representative substitution, rejects attributes
absent from the bound decoration alphabet, supplies each plan's exact typed
perturbation definitions, rejects numeric perturbations of non-structural
attributes, derives sampled stream keys and counts only from the reproduced
RunConfig, and evaluates all plans without top-level short-circuiting.
Candidate-local invariant resolution failures are
retained as `filter-indeterminate` evidence and no longer abort a complete
census.
Failure takes precedence over
indeterminate; otherwise the result is locally `eligible`. This is not final
admission: the later selector, admission, formation, profile, and element
boundaries consume this artifact explicitly, and the level coordinator embeds
their complete reproduced chain.

`package-candidate-census-evaluator-v1` composes one complete generated
canonical population with the prepared v18 filter path. Its hash covers the
generation artifact, every full filter explanation in candidate-ID order,
reconciled rejected/indeterminate/eligible totals, raw Boolean selectivity and
indeterminate ratio, and per-predicate total/exclusive rejection, inertness,
and `0.90` dominance diagnostics. Enumeration exhaustion produces an explicit
error instead of a partial denominator. This remains a pre-selector local
artifact rather than a complete `LevelResult`. Its public verifier reproduces
the whole artifact from independently supplied package/run inputs and rejects
any hash, ordering, embedded evaluation, aggregate, or interpretation drift.

`source-classification-policy-v1` requires an authored rule for each of the six
relation kinds, coherent human/deterministic authorship and exposure claims,
the complete forbidden SCC-aware input set, a closed local visible-field
vocabulary, realizable classifier counts, and bounded disagreement/fitting-risk
policy. `source-node-resolution-policy-v1` binds that policy hash, covers
all four component dispositions, forbids topology-driven criteria, and fixes
lossless edge reconciliation, undefined internal order, depth inheritance, and
DAG condensation. These constructors freeze contracts only: no current edge or
component receives a scientific decision.

`source-classification-annotations-v1` binds one verified policy and annotation
view to a complete relation-by-classifier matrix. Human work must meet the
frozen minimum independent count; deterministic work must use exactly the
precommitted ID/version. `source-classification-adjudication-v1` binds the raw
artifact, derives raw kinds/agreement, protects unanimous results, orders the
annotation/adjudication/unblinding instants, and applies the frozen disagreement
threshold. The runtime validates supplied records but neither serves the
access-controlled view nor creates the labels.

Quantity evidence is preserved in the normalized package and therefore changes
the package identity, while ordinary primitive and profile structural identity
uses value, unit, tolerance, and semantic meaning without evidence provenance.
Oracle requests now receive a domain-separated identity only after their
candidate bytes, specifications, parameters, tolerances, and solver metadata
are normalized and verified. Candidate graph canonicalization is reproduced,
so self-consistently rehashed alternate node numberings are rejected. Response
validation distinguishes malformed or
misbound artifacts from scientifically indeterminate failed/partial results,
checks value and residual provenance, and excludes operational wall time from
semantic response and validation hashes. Sensitivity-report schemas, public
types, evaluator, and verifier are aligned with the executable contract.
Normalized RunConfig is now executable for validation, budget
materialization, hashing, primitive `Element` population selection, and package
candidate binding; the package-level coordinator consumes that same normalized
configuration and exact binding for its run identity and global preflight.

The 2026-08-07 static revision tightened the executable boundary in six places:

- a tolerance must contain at least one defined bound;
- a comparison semantic policy defaults only when omitted, while invalid
  supplied values fail;
- quantity semantics, evidence IDs, and method identifiers must be normalized;
- package quantity conversion overflow and non-zero underflow are rebased into
  structured package validation before hashing;
- analyzer string ceilings now include `where` literals and nested quantity
  metadata;
- kernel and package-loader option objects are closed, while TypeScript and
  JSON Schema range, decimal-accumulation, normalized quantity-semantic, and
  safe graph-index contracts match the executable boundary; the normalized
  package type no longer advertises rejected source-migration input.

## Identity flow

```text
RulePackage
  -> guarded canonical clone
  -> deterministic defaults
  -> structural/reference validation
  -> typed ValueExpression analysis and dimensional checks
  -> typed predicate analysis -> compiled predicate plans
  -> normalized profiles -> profile hashes
  -> primitive structural payloads -> element IDs
  -> primitive ID set + identity policy -> depth-basis hash
  -> rules/configuration -> rules hash
  -> normalized package -> package ID
```

```text
Verified LoadedRulePackage + primitive identity policy
  -> reproduced element canonical forms
  -> complete depth-0 Element records
  -> primitive depth-population hash
  -> explicit target-depth/source-depth selection in package candidate binding
```

```text
PredicatePlan + RunConfig.invariantPrecision + semantic comparison policy
  -> verified plan/analysis identities
  -> numeric-operation inventory + explicit arithmetic/tolerance policies
  -> predicate numeric binding hash
```

```text
Verified graph-only PredicatePlan + canonicalized Candidate
  -> complete three-valued graph evaluation + canonical witnesses
  -> graph-predicate evaluation hash

Verified static-proven plan + bounded partial graph
  -> persistent-failure diagnostic
  -> pruningAuthorized = false + partial evaluation hash

Complete package/run universe + every declared monotone plan + sample budget
  -> deterministic strict edge-prefix/complete-extension samples
  -> falsification result + exact audit hash

Verified passed audit + static proof + persistent-failure diagnostic
  -> separate pruning-controller decision hash
  -> prepared canonical-prefix pre-admission pruning
  -> raw/unique/duplicate census + disabled-baseline result-set equivalence
```

```text
Verified PredicatePlan + reproduced numeric binding + canonicalized Candidate
  -> graph operators + supported scalar/direct-quantity/count/attribute-sum compare
  -> unrounded and rounded operand values + exactness + canonical selection witnesses
  -> local-predicate evaluation hash
```

```text
Verified LoadedRulePackage + reproduced PackageCandidateBinding
  + complete canonical package candidate
  -> bound-universe membership proof
  -> exact/profile-representative constituent resolution
  -> every graph or supported local-numeric top-level predicate evaluation
  -> local eligible/rejected/indeterminate verdict
  -> package-candidate filter hash
```

```text
Candidate canonical form + quantity specs + parameters + solver identity
  -> normalized Oracle request -> request hash
  -> external response (never executed by the kernel)
  -> request/solver/unit/tolerance/residual/evidence validation
  -> accepted values or traceable indeterminate result -> validation hash
```

```text
Authored classification policy
  -> closed vocabulary/exposure/risk validation
  -> canonical set ordering -> classification policy hash
  -> bound node-resolution policy
  -> forbidden-criterion/reconciliation/cluster validation
  -> node-resolution policy hash
```

```text
Frozen classification policy + declared annotation view
  -> complete independent annotations -> annotation hash
  -> blind final decision per relation with preserved raw kinds
  -> disagreement/risk derivation + ordered unblinding -> adjudication hash
```

```text
Verified policy + view + annotations + adjudication
  -> one typed record per source relation
  -> generative SCC partition
  -> formation-support SCC partition
  -> classified-relation projection hash
```

```text
CandidateInput + GraphPolicy
  -> guarded canonical clone
  -> contract, resource, and connectivity validation
  -> structural attribute projection
  -> unlabeled simple skeleton canonicalization -> SkeletonId
  -> directed role-labelled refinement/individualization
  -> canonical Candidate + reversible input mappings -> CandidateId
```

Only declared structural attributes enter candidate identity. Direction, role,
parallel multiplicity, enabled self-loops, node references, counting domain,
and the derived skeleton remain structural. Policy flags that only decide
admissibility do not change the identity of a graph accepted under multiple
policies. The exact decision and resource limits are recorded in
[ADR-0004](adr/0004-refinement-graph-canonicalization.md).

The enumerator and store state/budget semantics are recorded in
[ADR-0005](adr/0005-skeleton-enumeration-and-candidate-store.md). A separate
Python standard-library generator now freezes canonical skeleton bytes, IDs,
labelled multiplicities, and counts for all 143 connected unlabeled simple
graphs through six nodes. Its generation is complete; comparison with the
JavaScript runtime passes on macOS arm64 under Node.js 20.20.2 and 22.23.2.

Quantity grammar, conversion, identity, and comparison semantics are recorded
in [ADR-0006](adr/0006-multiplicative-si-quantities.md). Decimal representation,
rounding, and accumulation are recorded in
[ADR-0007](adr/0007-deterministic-decimal-arithmetic.md). Affine/logarithmic
units remain outside the implemented boundary.
Typed value-expression analysis and its hashing rules are recorded in
[ADR-0008](adr/0008-typed-value-expression-analysis.md). Boolean-expression
analysis, persistence inference, and plan compilation are recorded in
[ADR-0009](adr/0009-predicate-analysis-and-plans.md). The bounded executable
comparison subset is recorded in
[ADR-0020](adr/0020-local-exact-compare-evaluation.md), and exact scalar
structural-attribute aggregation is recorded in
[ADR-0021](adr/0021-exact-scalar-attribute-sums.md). Unrounded compensated
accumulation and approximation propagation are recorded in
[ADR-0022](adr/0022-unrounded-compensated-attribute-sums.md). Quantity-valued
attribute sums and their tolerance/provenance aggregation are recorded in
[ADR-0023](adr/0023-quantity-attribute-sums.md). Compatible derived Quantity
addition and its tolerance/provenance propagation are recorded in
[ADR-0024](adr/0024-derived-quantity-addition.md). Dimensionless scalar scaling
and its point-interval contract are recorded in
[ADR-0025](adr/0025-derived-quantity-scaling.md). Element-exact Quantity
invariant resolution and its source-population witnesses are recorded in
[ADR-0026](adr/0026-element-exact-runtime-invariants.md). Node/edge attribute
balance is recorded in
[ADR-0027](adr/0027-local-balance-evaluation.md). Strict identical-Quantity
profile consensus is recorded in
[ADR-0028](adr/0028-profile-invariant-consensus.md). Direct scalar invariant
resolution and candidate-local indeterminate failures are recorded in
[ADR-0046](adr/0046-scalar-and-indeterminate-invariants.md). Package-authored
scalar invariant storage and runtime integration are recorded in
[ADR-0047](adr/0047-package-authored-scalar-invariants.md). Complete package-bound
local-filter census construction is recorded in
[ADR-0029](adr/0029-complete-local-filter-census.md). Explicit numeric profile
aggregation is recorded in
[ADR-0051](adr/0051-explicit-profile-invariant-aggregation.md). ADR-0090 closes
the schema-v1 registry to strict consensus and that explicit policy. Nested invariant resolution across
canonical substructures is recorded in
[ADR-0089](adr/0089-nested-substructure-invariant-resolution.md).
Explicit-semantic local Quantity products are recorded in
[ADR-0052](adr/0052-local-general-quantity-products.md). Deterministic single-removal evaluation is
recorded in [ADR-0030](adr/0030-irreducible-removal-evaluation.md). Directed
cycle-edge selection is recorded in
[ADR-0031](adr/0031-directed-cycle-edge-selection.md). Package-bound finite
functional evaluation is recorded in
[ADR-0032](adr/0032-package-functional-evaluation.md). Complete package-cohort
partitioning is recorded in
[ADR-0033](adr/0033-complete-cohort-partitioning.md). Complete-cohort functional
ranking is recorded in
[ADR-0034](adr/0034-complete-cohort-functional-ranking.md). Complete
coefficient-sensitivity execution is recorded in
[ADR-0035](adr/0035-coefficient-sensitivity-execution.md). Deterministic
multi-selector admission is recorded in
[ADR-0036](adr/0036-multi-selector-admission.md). Selected-formation
materialization is recorded in
[ADR-0037](adr/0037-selected-formation-materialization.md). Residual-profile
extraction and derived depth-1 population materialization are recorded in
[ADR-0038](adr/0038-residual-slot-profiles-and-derived-depth.md).
Predicate numeric binding is recorded in
[ADR-0010](adr/0010-predicate-numeric-policy-binding.md), and scientific request
and response validation without solver execution is recorded in
[ADR-0011](adr/0011-scientific-oracle-validation.md). Source policy artifact
freezing without catalogue decisions is recorded in
[ADR-0012](adr/0012-source-policy-freeze-contracts.md). Caller-supplied
annotation and blind-adjudication artifact freezing is recorded in
[ADR-0013](adr/0013-source-classification-annotation-artifacts.md). Policy-
limited views and verified typed-relation/SCC projection are recorded in
[ADR-0014](adr/0014-classified-relations-and-scc-projections.md).
Finite decorated-candidate enumeration and its budget/counting semantics are
recorded in
[ADR-0015](adr/0015-decorated-candidate-enumeration.md).
Normalized RunConfig and package/run candidate binding are recorded in
[ADR-0016](adr/0016-package-run-candidate-binding.md).
Verified graph-only evaluation and partial persistent-failure diagnostics are
recorded in [ADR-0017](adr/0017-graph-predicate-evaluation.md). Verified
primitive `Element` and depth-population materialization are recorded in
[ADR-0018](adr/0018-primitive-depth-population.md). The package-bound graph-only
v1 filtering and formation-resolution boundary are recorded in
[ADR-0019](adr/0019-package-candidate-local-filter.md). Its numeric-bound
exact-compare extension is recorded in
[ADR-0020](adr/0020-local-exact-compare-evaluation.md), and the exact scalar
attribute-sum extension in
[ADR-0021](adr/0021-exact-scalar-attribute-sums.md), followed by the unrounded
compensated extension in
[ADR-0022](adr/0022-unrounded-compensated-attribute-sums.md), followed by the
Quantity-valued extension in
[ADR-0023](adr/0023-quantity-attribute-sums.md), followed by compatible derived
Quantity addition in
[ADR-0024](adr/0024-derived-quantity-addition.md), followed by derived Quantity
scaling in
[ADR-0025](adr/0025-derived-quantity-scaling.md), followed by element-exact
Quantity invariant resolution in
[ADR-0026](adr/0026-element-exact-runtime-invariants.md), followed by local
balance evaluation in
[ADR-0027](adr/0027-local-balance-evaluation.md), followed by strict profile-
wide invariant consensus in
[ADR-0028](adr/0028-profile-invariant-consensus.md), followed by complete
package-bound local-filter census construction in
[ADR-0029](adr/0029-complete-local-filter-census.md), followed by deterministic
single-removal irreducibility in
[ADR-0030](adr/0030-irreducible-removal-evaluation.md), followed by directed
cycle-edge selection in
[ADR-0031](adr/0031-directed-cycle-edge-selection.md), followed by package-
bound finite functional evaluation in
[ADR-0032](adr/0032-package-functional-evaluation.md), followed by complete
package-cohort partitioning in
[ADR-0033](adr/0033-complete-cohort-partitioning.md), followed by complete-
cohort functional ranking in
[ADR-0034](adr/0034-complete-cohort-functional-ranking.md), followed by
complete coefficient-sensitivity execution in
[ADR-0035](adr/0035-coefficient-sensitivity-execution.md), followed by
deterministic multi-selector admission in
[ADR-0036](adr/0036-multi-selector-admission.md), followed by selected-
formation materialization in
[ADR-0037](adr/0037-selected-formation-materialization.md), followed by
residual-profile extraction and derived depth-1 materialization in
[ADR-0038](adr/0038-residual-slot-profiles-and-derived-depth.md), followed by
primitive-to-depth-1 package closure in
[ADR-0039](adr/0039-package-level-closure.md).
Depth-aware source selection and candidate binding follow in
[ADR-0040](adr/0040-depth-source-population-selection.md), with generalized
target-depth selection/materialization and explicit ladder closure in
[ADR-0041](adr/0041-generalized-level-and-ladder-closure.md), followed by
bounded profile-collapse and level-boundary diagnostics in
[ADR-0042](adr/0042-profile-collapse-and-level-boundaries.md), followed by
explicit carrier promotion in
[ADR-0043](adr/0043-explicit-carrier-promotion.md), followed by bounded current-
level fixpoint closure in
[ADR-0044](adr/0044-bounded-current-level-fixpoint.md) and exhaustive proper-
subgraph minimality in
[ADR-0045](adr/0045-exhaustive-minimal-subgraphs.md), with scalar and
candidate-local invariant resolution in
[ADR-0046](adr/0046-scalar-and-indeterminate-invariants.md), followed by
package-authored scalar invariant integration in
[ADR-0047](adr/0047-package-authored-scalar-invariants.md), followed by exact
constituent novelty in
[ADR-0048](adr/0048-exact-constituent-novelty.md), followed by exact typed
stability in
[ADR-0049](adr/0049-exhaustive-typed-stability.md), followed by seeded sampled
stability in
[ADR-0050](adr/0050-seeded-sampled-stability.md), followed by explicit numeric
profile aggregation in
[ADR-0051](adr/0051-explicit-profile-invariant-aggregation.md), followed by
explicit-semantic local Quantity products in
[ADR-0052](adr/0052-local-general-quantity-products.md), followed by the
monotonicity audit and separate pruning controller in
[ADR-0053](adr/0053-monotonicity-audit-and-pruning-controller.md), followed by
audited pre-admission generator integration in
[ADR-0054](adr/0054-audited-pre-admission-pruning.md), followed by audited
recursive edge-group closure in
[ADR-0055](adr/0055-audited-recursive-frontier-pruning.md), followed by
generalized depth-aware audited pruning in
[ADR-0056](adr/0056-generalized-depth-audited-pruning.md), followed by verified
per-level candidate explanation indexing in
[ADR-0057](adr/0057-verified-level-explanation-index.md).
The integrated ordinary/depth-aware final census is implemented in
[ADR-0058](adr/0058-integrated-level-result-census.md): it exactly replays the
level, reconciles all final counts and selectivity sources, preserves complete
predicate/selector censuses and interpretation states, and binds admitted
element IDs under a separate result-census hash.
[ADR-0059](adr/0059-verified-run-artifact-bundles.md) adds complete verified
semantic run bundles, exact canonical artifact materialization, unique
runHash-indexed external-store snapshots, and bound `kernel.explain` candidate
lookup. Serialized bundles/stores undergo full replay; only deeply frozen
creator/verifier outputs use the process-local verified-object cache.
[ADR-0060](adr/0060-verified-run-directory-persistence.md) adds the separate
`@onto2d/run-store` filesystem adapter. It atomically publishes only a fully
verified bundle, then reconstructs the canonical envelope, exact inventory,
byte lengths, raw hashes, and every materialized artifact without adding file
I/O to the kernel.
[ADR-0061](adr/0061-reviewed-source-resolution-and-condensation.md) adds generic
catalogue-adapter execution for a fully verified classification chain and
caller-supplied reviewed inputs. It preserves isolated nodes, derives rather
than accepts cluster membership, reconciles every relation exactly once,
retains all typed layers, and proves the generative quotient is a DAG.
[ADR-0062](adr/0062-append-only-operational-execution-records.md) adds separate
content-addressed operational records to `@onto2d/run-store`. Each record is
bound to a fully reconstructed semantic run, published atomically without
overwrite, and verified under a reserved flat `execution/` inventory; its
timestamps, platform/build labels, resource usage, ID, and receipt do not alter
semantic bundle bytes or hashes.
[ADR-0063](adr/0063-source-migration-reconciliation-diagnostics.md) adds a
fully replayed generic source report with raw nontrivial-SCC histograms, all
six typed edge counts, descriptive/nonformation resolution shares,
cluster/member counts, available frozen risk signals, and explicit
node/edge/DAG conservation. ADR-0064 adds a verified immutable amendment-log
snapshot and post-unblinding threshold accounting. ADR-0065 adds separately
hashed effective classified relations, recomputed SCCs, and amendment-aware
resolution/condensation replay. ADR-0066 then adds the complete generic
migration metrics contract without claiming current-catalogue research inputs.
[ADR-0064](adr/0064-post-unblinding-classification-amendments.md) defines that
amendment snapshot as an exact policy/annotation/adjudication replay plus an
ordered hash chain of approval-bound kind changes. It retains frozen and
effective kinds separately, derives unique-relation risk share, and never
rewrites the blind artifacts.
[ADR-0065](adr/0065-effective-source-classification-reprojection.md) applies
that state chain to a separate typed-relation artifact, recomputes both SCC
partitions, and makes stale downstream decisions fail closed.
[ADR-0066](adr/0066-complete-source-migration-metrics.md) binds exactly one
reviewed disposition to every raw SCC plus one source level to every reconciled
node and derives the complete documented migration metric set, including
cross-level cluster counts and a separate risk-policy hash.
[ADR-0067](adr/0067-source-migration-explanation-index.md) freezes complete
source-node/relation/raw-SCC lineage and exposes only index-bound,
content-addressed query results.
[ADR-0068](adr/0068-source-cluster-concentration.md) binds an independently
frozen bottleneck definition and a complete source-vertex depth partition,
then derives per-depth/pooled constitutive shares and an honest four-state
concentration interpretation.
[ADR-0091](adr/0091-source-migration-package-binding.md) closes the kernel
package/run manifest for that complete chain and enables condensed-cluster
primitive loading. [ADR-0092](adr/0092-adapter-owned-source-explanations.md)
keeps full-chain source queries in the catalogue adapter and closes the kernel
capability registry without a placeholder facade.

Source IDs, claims, and evidence do not enter ordinary primitive structural
identity by default. The executable cluster identity branch binds the frozen
classification policy, node-resolution artifact, condensation artifact, and
disposition rather than review timestamps or annotator identity. Under
[ADR-0091](adr/0091-source-migration-package-binding.md), the loader accepts it
only beside a complete closed source-migration manifest.

The schemas now describe frozen source policies, annotation/adjudication,
classification views, typed-relation/SCC projections, downstream classified
relations, condensed clusters, and the closed migration binding. The loader
requires every mandatory migration role, exact root-artifact references, six
typed relation layers, matching cluster provenance, and disjoint cluster
membership. It hashes the normalized binding, incorporates the condensation
artifact into the depth basis, and preserves both through verified run
bundles. The catalogue adapter remains responsible for replaying the external
artifact bytes before the application constructs this manifest.

## External inputs and follow-up project work

The published schema-v1 kernel capability registry has no pending operation
after ADR-0091 and ADR-0092. The following work remains deliberately outside
that registry:

- author and review actual source-classification/node-resolution policy
  content, collect access-controlled independent annotations and decisions,
  freeze bottleneck/depth inputs, and apply the implemented adapter chain to
  the current catalogue;
- provide remote artifact-store adapters and deployment applications; verified
  semantic bundles, local atomic persistence, append-only execution records,
  candidate explanations, and adapter-bound source explanations are already
  executable;
- execute `POST-CLOSURE-VIS-01` from a fully verified reproducible case after
  the final closure audit passes.

Unsupported configuration, `not-run`, and `indeterminate` remain legitimate
scientific result states where their schemas prescribe them; they are not
placeholder APIs. Additional profile aggregation names are future versioned
scientific extensions because ADR-0090 deliberately closes the schema-v1
registry.

[ADR-0093](adr/0093-functional-coefficient-role-closure.md) closes
coefficient-role authorship: explicit `fixed`, `free`, and
`fitted` maps must cover every coefficient and exactly match the sensitivity
sweep, while legacy inputs normalize listed coefficients to `free` and all
others to `fixed`. Perturbation entries now have four executable
typed single-edit forms with exact or seeded sampled enumeration plus
registry-only string compatibility. Sampled execution binds the stream, frame,
replacement, budget, uncertainty, and decision contract frozen by ADR-0050.

For a candidate attribute explicitly selected as structural, the graph
canonicalizer hashes the complete normalized Quantity record, including its
provenance, so candidate identity can retain an execution/evidence distinction.
Primitive/profile and now derived-element structural quantity identity excludes
evidence provenance. The derived-depth materializer explicitly projects
candidate quantities to value, unit, tolerance, and semantic meaning before
element hashing; the differing candidate and element domains/policies remain
visible instead of becoming an accidental identity shortcut.

The public kernel capability registry is empty of pending operations. Explicit
unsupported configuration and indeterminate scientific branches remain
fail-closed and never return a fabricated result.

## Verification status

Canonical JSON, loader, and graph tests were added for determinism, domain
separation, unsafe values, stable package/depth identities, 30 independently
permuted graph pairs, non-isomorphic negatives, structural attributes,
reversible mappings, connected-skeleton reference counts, candidate-store
deduplication/order, policy failures, generator/canonicalization budgets,
current-depth opt-in/rejection, phase-cycle rejection, missing references,
explicit closure-input validation, generalized target-depth closure, and exact
three-depth ladder replay. Fixpoint fixtures cover empty and non-empty
convergence, iteration exhaustion, withheld final populations, tentative
derivations, current-level self references, direct/lower-level/ladder replay,
tamper rejection, outer ladder termination, and configured-kernel dispatch.
Profile-collapse fixtures cover exact multiplicity projection, zero-error
equivalence, a selector/invariant counterexample, grouped observable
inconsistency, hash replay, and tamper rejection. Boundary fixtures cover
interval minima, maximum/tie policy, declared/detected matching, no-interval
candidate-only behavior, schema branches, and exact replay.
Carrier-promotion fixtures cover a verified source ladder/collapse basis,
non-empty profiles, source/target coordinates, claim/evidence enforcement,
domain hashes, exact replay, tamper rejection, invalid policy failures, strict
schema validation, configured-kernel adapters, and successful loading of the
emitted target primitive.
Decorated-generator fixtures differentially reconcile a bounded universe with
direct brute force and cover input-order invariance, direction, roles,
parallel-edge multisets, optional loops, directed-strong exclusions, empty
edge-bounded universes, SI-normalized variant collapse, and independent raw,
logical-state, unique-candidate, and canonicalization-search exhaustion.
Run/package binding fixtures cover documented budget materialization, closed
RunConfig validation, canonical set order, package reloading and tamper
rejection, element/profile alphabets, representative provenance, role and
skeleton binding, complete high-level execution, explicit raw exhaustion, and
rejection of unsupported disconnected, single-candidate, structural-attribute,
wall-time, and memory semantics.
Primitive-depth fixtures cover complete immutable `Element` records,
canonical-form rehashing, depth and axis provenance, order invariance,
policy-controlled source identity, package/population provenance separation,
stale package and element-ID rejection, explicit source-depth selection, and
binding/profile derivation from the materialized population.
Quantity fixtures cover derived and compound units, prefixes, conversion of
absolute tolerance, dimensional compatibility, semantic guards, comparison
windows, empty effective tolerances, invalid comparison policies, normalized
provenance identifiers, conversion overflow, non-zero conversion underflow,
canonical-unit round trips, exact terminating prefix-scale conversion, and
package/candidate identity equivalence.
Decimal fixtures cover exact arithmetic, all rounding modes, rounded division,
rounded and unrounded exact/compensated accumulation, algorithm/exactness
coupling, canonical serialization, resource limits, non-zero binary64
underflow, and explicit arithmetic failures.
Value-expression fixtures cover recursive shape validation, additive and
multiplicative dimensional inference, dependency extraction, selector
normalization, stable analysis hashes, undeclared symbols, conflicting
invariant declarations, selector and nested-quantity string ceilings, and
functional result-unit checks.
Predicate fixtures cover every analysis layer: Boolean normalization, typed
comparisons, dimensional balance, role/projection/perturbation requirements,
substructure and embedded-value limits, canonical-selector stability,
conservative persistence, pruning-state compilation, stable plan hashes,
forbidden coefficient access, diagnostic paths, and loader-emitted plan order.
Graph-evaluation fixtures cover complete aggregate/atomic witnesses, role
counts and universal degree, directed versus undirected-simple cycles,
attribute and empty selectors, zero-length and directed paths, weak/strong
components, relabeling invariance, unsupported operators, partial upper-bound
and forbidden-cycle failures, repairable absence, blocked plans, immutable
diagnostics, compiled-plan tampering, and witnesses above the default 64-edge
canonicalization limit.
Package-filter fixtures cover complete top-level evaluation with simultaneous
pass/fail/indeterminate outcomes, failure precedence, hash reproduction,
exact/profile constituent resolution, relabeling invariance, stale bindings,
foreign node/edge variants, non-generable reciprocal decorations, exact count
comparison, unavailable balance/selector attribute rejection, unsupported
substructures, and empty-predicate local eligibility.
Package-census fixtures cover complete generation/filter reconciliation,
canonical candidate ordering, hash reproduction, Boolean selectivity,
overlapping and exclusive rejection counts, inert and dominating predicates,
the exact `0.90` dominance boundary, indeterminate thresholds, raw/canonical
candidate budget exhaustion, schema branch rejection, and stored-artifact
reproduction/mismatch handling.
Local-evaluation fixtures cover mixed graph/compare plans, canonical node and
edge selections, exact and compensated scalar and Quantity-valued structural-
attribute sums, canonical aggregation order, explicit approximation
propagation, mixed SI input units, conservative absolute/relative tolerance
aggregation, computed evidence provenance, typed empty sums, runtime
type/unit/semantic failures, missing/type-drift/selection-limit failures, exact
arithmetic, boundary-only rounding, compatible derived Quantity addition with
additive tolerance/evidence propagation, signed and zero Quantity scaling,
precision-dependent verdicts, SI-normalized
direct quantities and tolerance, SI-equivalent exact decimal operands, scalar
equality, relabeling invariance, stale numeric bindings, package-authored
scalar values, and explicit rejection of non-consensus invariants and multi-
Quantity products. Invariant
fixtures additionally cover exact-element singleton/selector resolution,
population/context drift, missing values, unit/semantic mismatch, retained
provenance/tolerance, SI-equivalent profile-member consensus, full membership,
consensus disagreement, and package-derived contexts.
Balance fixtures cover closed scalar thresholds, threshold and aggregate
uncertainty, exact/compensated state, boundary-only rounding, mixed SI units,
semantic policy, empty selections, runtime data failures, and cycle rejection.
Irreducible-removal fixtures cover node/edge minimality, reducible and whole-
failure cases, empty/disconnected exclusions, isolate pruning, zero evaluated
denominators, policy mismatch, nested-invariant refusal, relabelling
invariance, package-bound execution, and complete-census propagation.
Minimality fixtures cover all three policy modes, exact exhaustive family
sizes, the strict distinction from single removal, empty/disconnected and
explicit-policy handling, hard preflight exhaustion, relabelling invariance,
package-bound execution, schema acceptance, and corrupted witness rejection.
Cycle-edge fixtures cover role filters, overlapping unions, scalar and Quantity
aggregation, empty sets, loops, reciprocal pairs, acyclic orientations,
canonical relabelling, package binding, schema enforcement, and all 512
directed three-node edge subsets against an independent closure reference.
Functional fixtures cover exact eligible-filter and binding reproduction,
coefficient/invariant addition, numeric scalar invariants, single-boundary rounding, canonical evidence
union, conservative multi-Quantity interval products, node/edge/directed-cycle
counts, element and profile resolution, relabelling invariance, missing and
ambiguous values, result-tolerance withholding, prerequisite tampering,
ineligible candidates, public kernel exposure, content hashing, and all scored
and indeterminate JSON Schema branches.
Cohort-partition fixtures cover all five rule kinds, transitive shared-support
components, ordered Quantity/scalar profile-role tuples, signed exact window floors and
half-open boundaries, within-bin and boundary-crossing uncertainty, missing
keys, empty and source-indeterminate populations, exclusion preservation,
package/run/census drift, ordering invariance, public kernel exposure, exact
replay, and complete/empty/indeterminate JSON Schema branches.
Selector-ranking fixtures cover minimization/maximization, exact dense ties,
transitive uncertainty-interval components, epsilon boundaries and epsilon
tolerance, all-equal/singleton behavior, positive/zero/null gaps, multiple
cohorts and weighted summaries, retained indeterminate members, empty/source-
indeterminate partitions, rule and prerequisite drift, evaluation ceilings,
ordering invariance, public kernel exposure, exact replay, and every JSON
Schema status branch.
Numeric-binding fixtures cover arithmetic/summation discovery, dimensionless
and quantity comparisons, balance, stability thresholds, explicit policy
defaults/overrides, binding identity, non-numeric plans, and altered-plan
rejection, including duplicated analysis-witness and pruning drift. Canonical
fixtures additionally cover every finite RFC 8785
Appendix B binary64 vector, non-finite rejection, UTF-16 key ordering, Unicode
preservation without normalization, and invalid surrogates.
Oracle fixtures cover compatible-unit request identity, candidate byte/hash
and graph-canonicality integrity, solver and parameter binding, converged
value/evidence/tolerance
validation, failed and partial indeterminate states, expanded tolerances,
residual guards, stale responses, and wall-time-independent semantic hashes.
Source-policy fixtures cover complete relation/disposition rule vocabularies,
canonical set ordering, domain hashes, immutability, honest exposure status,
risk bounds, closed visible fields, realizable classifier minima, required
post-classification inputs, forbidden topology criteria, and fixed edge/cluster
invariants.
Classification-artifact fixtures cover complete independent matrices,
deterministic tool identity, view/exposure drift, preserved disagreement,
unanimous-result protection, timestamp ordering, upstream hash verification,
and derived disagreement risk.
Catalog-adapter projection fixtures cover exact visible fields, endpoint
binding, lossless typed edges, generative and formation-support SCCs, projected
self-loops, complete upstream verification, and invariance to relation,
annotation, adjudication, and traversal order.
The independent Python conformance generator was executed repeatedly with
byte-identical fixture hashes. The current frozen SHA-256 values are
`8f0073cbc67a168200030e9ab621a3db1c74ff150f5624722981a5141b8df620`
for the canonical fixture and
`0dea27031344afe7786a10b5d8e413fbc0235cb2785178c16733049adf8ad89a`
for the skeleton fixture. Its first JavaScript comparison exposed two
non-minimal canonical representatives at five nodes. Skeleton labeling was
therefore changed, before identity freeze, to evaluate the complete node
permutation orbit and select the global canonical edge serialization. The
original 410-test closure suite passed locally on macOS arm64 under Node.js
20.20.2 and 22.23.2 before Node.js 20 reached end of life. The current 437-test
workspace, repository checks, schema-compilation/runtime-artifact conformance,
independent golden verification, and build pass under Node.js 24.19.0. The machine-readable
closure contract additionally freezes the empty pending registry, the
complete 195-capability-to-372-test evidence map, the independent fixture
hashes, the required CI matrix, and `POST-CLOSURE-VIS-01`.
The repository's Linux/macOS/Windows x Node.js 22/24 CI matrix and independent
review still require external evidence. ADR-0003 through ADR-0005 therefore
retain proposed status.
