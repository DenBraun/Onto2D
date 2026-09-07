# Execution

Current contracts. Public APIs and schemas are checked by the repository verification suite.

- [Normalized package/run candidate binding](#normalized-packagerun-candidate-binding)
- [Verified graph-predicate evaluation and partial-failure detection](#verified-graph-predicate-evaluation-and-partial-failure-detection)
- [Package-bound graph-only local candidate filtering](#package-bound-graph-only-local-candidate-filtering)
- [Complete package-bound local-filter census](#complete-package-bound-local-filter-census)
- [Deterministic irreducible-removal evaluation](#deterministic-irreducible-removal-evaluation)
- [Directed cycle-edge set selection](#directed-cycle-edge-set-selection)
- [Complete package cohort partitioning](#complete-package-cohort-partitioning)
- [Complete-cohort functional ranking](#complete-cohort-functional-ranking)
- [Deterministic multi-selector admission](#deterministic-multi-selector-admission)
- [Residual-slot profiles and derived-depth materialization](#residual-slot-profiles-and-derived-depth-materialization)
- [Deterministic package-level closure](#deterministic-package-level-closure)
- [Verified depth-source population selection and binding](#verified-depth-source-population-selection-and-binding)
- [Generalized level and explicit ladder closure](#generalized-level-and-explicit-ladder-closure)
- [Bounded profile collapse and level-boundary diagnostics](#bounded-profile-collapse-and-level-boundary-diagnostics)
- [Explicit carrier promotion from verified closure artifacts](#explicit-carrier-promotion-from-verified-closure-artifacts)
- [Bounded current-level fixpoint closure](#bounded-current-level-fixpoint-closure)
- [Exhaustive policy-bound minimal subgraphs](#exhaustive-policy-bound-minimal-subgraphs)
- [Exact constituent novelty evaluation](#exact-constituent-novelty-evaluation)
- [Exhaustive typed `stableUnder`](#exhaustive-typed-stableunder)
- [Seeded sampled `stableUnder`](#seeded-sampled-stableunder)
- [Deterministic monotonicity audit and pruning controller](#deterministic-monotonicity-audit-and-pruning-controller)
- [Audited pre-admission candidate pruning](#audited-pre-admission-candidate-pruning)
- [Audited recursive generator-frontier pruning](#audited-recursive-generator-frontier-pruning)
- [Generalized depth-aware audited pruning](#generalized-depth-aware-audited-pruning)
- [Typed profile partner guards](#typed-profile-partner-guards)
- [Audited node-growth pruning](#audited-node-growth-pruning)
- [Profile-gated audited pre-admission pruning](#profile-gated-audited-pre-admission-pruning)
- [Profile-gated audited raw-frontier pruning](#profile-gated-audited-raw-frontier-pruning)
- [Schema-v1 profile-aggregation registry closure](#schema-v1-profile-aggregation-registry-closure)

<a id="normalized-packagerun-candidate-binding"></a>

## Normalized package/run candidate binding

`normalizeRunConfig`, versioned as `run-config-normalizer-v2`, validates a
closed schema-v1 configuration and returns an immutable normalized value.
Research choices without normative defaults remain required. Only the five
documented `RunBudget` defaults are materialized:

- `maxNodes = 4`;
- `maxEdges = "n+2"`;
- `maxCandidates = 1_000_000`;
- `perturbationSamples = 200`;
- `nullModelRuns = 500`.

Set-valued axes, roles, null models, and graph structural-attribute names are
canonicalized independently of input order. Precision, graph, substructure,
ontology, threshold, boundary, and bounded-fixpoint fields use their executable
closed contracts. A normalized configuration is hashed in
`onto2d:run-config:v1` when bound to generation.

`createPackageCandidateBinding`, versioned as
`package-candidate-binding-v2`, does not trust the label on a supplied loaded
package. It removes only derived primitive element IDs, reloads the normalized
package with an independently expected kernel version, and requires the entire
reproduced loader artifact to match before deriving a universe. Direct calls
default that expectation to the package's current kernel version and may supply
an explicit expected version; `createKernel({ version })` injects its own fixed
version into every downstream package-verification boundary.

The binding freezes:

- the package ID and primitive depth basis;
- the normalized RunConfig and its domain-separated hash;
- the exact sorted primitive element-ID population;
- profile classes, sorted members, and the lexicographically smallest element
  ID as the disclosed deterministic representative;
- element-ID node variants for `element-exact`, or one profile-hash variant per
  class for `profile-quotient`;
- one edge variant per normalized `roleAlphabet` entry;
- every complete connected simple skeleton from one through `maxNodes`;
- the run's edge/unique-candidate limits and separately declared raw,
  decoration-state, and canonical-search execution limits.

The complete basis is hashed in `onto2d:package-candidate-binding:v1`.
`enumeratePackageCandidates`, versioned as
`package-candidate-generator-v5`, executes Deterministic decorated-candidate enumeration directly from that frozen
basis and returns the binding beside the low-level enumeration result.

The primitive binding records its exact source population. Generalized-depth
and fixpoint coordinators use separate verified population bindings. Primitive
binding rejects unsupported requests before enumeration:

- `single-candidate`, which requires a caller-supplied candidate;
- `graphPolicy.connected = false`, because only the connected skeleton
  universe is implemented;
- structural node or edge attributes without a corresponding verified
  package-to-decoration derivation rule;
- wall-time or resident-memory budgets, because the synchronous enumerator
  cannot enforce them deterministically;
- a canonical search budget too small to revalidate every bound skeleton and
  the edge-variant preflight;
- packages with no primitives.

Ordinary exhaustive enumeration does not prune by predicate plans. The explicit
profile-composition gate and audited pruning controllers below are separate
opt-in policies. The role alphabet remains an explicit RunConfig input;
it is not inferred from observed profiles.

<a id="verified-graph-predicate-evaluation-and-partial-failure-detection"></a>

## Verified graph-predicate evaluation and partial-failure detection

`predicate-plan-verifier-v1` is the shared internal verification boundary. It
closes a supplied compiled plan, reproduces expression and analysis hashes,
re-runs the supported analyzer from the plan's declared symbol environment,
compares every analysis witness and pruning field, and reproduces the plan
hash. Numeric binding and graph evaluation consume only that verified result.

`evaluateGraphPredicatePlan`, versioned as
`graph-predicate-evaluator-v1`, accepts only:

- `all`, `any`, and `not`;
- `degree`, `cycleExists`, `connected`, `componentCount`, `pathExists`, and
  `countRole`.

Numeric and substructure evaluation use the complete local evaluator. This
graph-predicate operation
re-canonicalizes the supplied candidate under the declared graph policy, uses
canonical node and edge indices for evaluation and witnesses, evaluates every
logical child so that evidence is not erased by short-circuiting, and returns
a domain-separated `predicate-graph-evaluation` hash binding the verified plan,
candidate identity, effective graph policy, outcome, and ordered witnesses.

Complete graph semantics are fixed as follows:

- `degree` applies its range universally to every selected node. Each incident
  edge record contributes one, including a self-loop; this is incidence-record
  degree, not half-edge degree. An empty selector is `indeterminate`.
- `countRole` counts matching canonical edge records exactly.
- directed cycles preserve direction and admit a loop of length one and a
  reciprocal dyad of length two when their declared bounds allow them;
  `undirected-simple` removes loops and collapses parallel/directional copies,
  so its minimum possible cycle length is three;
  `undirected-multigraph` preserves loops and parallel two-cycles.
- `pathExists` is directed and role-filtered. Equal selected endpoints admit a
  zero-edge path. A missing endpoint selection is `indeterminate`; a populated
  but unreachable selection is `fail` on a complete graph.
- `connected` and `componentCount` use the candidate policy's weak/undirected
  or directed-strong connectivity projection.
- logical composition uses the documented three-valued truth tables.

`detectPartialGraphPredicateFailure`, versioned as
`partial-graph-predicate-evaluator-v1`, accepts a closed partial graph with an
explicit `nodesComplete` flag. It canonicalizes the graph with parallel edges,
self-loops, and disconnected state permitted, under the existing six-node and
64-edge safety ceilings. It evaluates partial truth only when the verified
plan already has `pruning.eligibility = "static-proven"`. Currently detectable
facts include exceeding an upper role/degree bound and finding a declared
cycle or directed path; absence and repairable connectivity remain
`indeterminate`. A statically blocked plan stays blocked even when runtime data
looks persuasive.

The partial result is diagnostic evidence, not pruning authority. Every result
has `pruningAuthorized: false`, retains the plan's mandatory `auditRequired`
flag, and receives separate partial-graph and evaluation hashes. Candidate
enumeration does not consume this result until a versioned monotonicity-audit
artifact and pruning controller can verify the exact allowed extension model.

<a id="package-bound-graph-only-local-candidate-filtering"></a>

## Package-bound graph-only local candidate filtering

`package-candidate-filter-evaluator-v20` accepts a `LoadedRulePackage`, its
`PackageCandidateBinding`, and one complete candidate. It first reproduces the
loaded package and then reconstructs the complete binding from its recorded
RunConfig and raw/state/search execution limits. The supplied binding must be
canonically identical to that reproduction.

The candidate is re-canonicalized under the binding's graph policy and
canonicalization limits. Before predicate evaluation, the evaluator proves
membership in the bound finite universe by checking:

- the counting domain and semantic node/edge budgets;
- the canonical skeleton against the bound connected-skeleton set;
- every canonical node against the bound element/profile alphabet;
- every canonical edge against the bound role/attribute alphabet;
- non-parallel multiplicity per undirected adjacency group, including the
  reciprocal-direction case that directed graph validation alone permits but
  the decorator does not generate.

For `element-exact`, each canonical node resolves directly to its source
element and profile class. For `profile-quotient`, it resolves to the disclosed
lexicographically smallest representative and retains the complete sorted
profile-class membership. This resolution, the full canonical candidate,
target depth, depth basis, and source-population hash form the artifact's
formation basis. Derived Element materialization creates the separate
`Element.provenance` record.

All top-level predicate plans are checked for graph-only support before an
artifact is emitted. Every supported plan is evaluated even after another plan
fails. The result retains predicate ID, phase, claim references, the complete
graph-evaluation artifact, reconciled pass/fail/indeterminate counts, and the
three corresponding sorted predicate-ID sets. Verdict precedence is:

1. any failure produces `predicate-rejected`;
2. otherwise any indeterminate result produces `filter-indeterminate`;
3. otherwise the candidate is locally `eligible`.

An empty predicate set is vacuously locally eligible and does not create a
synthetic predicate or selector admission. The complete basis is hashed in
`onto2d:package-candidate-filter:v20`.

<a id="complete-package-bound-local-filter-census"></a>

## Complete package-bound local-filter census

`package-candidate-census-evaluator-v1` composes the existing package generator
and package filter into a content-addressed `complete-local-filter-census-v1`
artifact.

- The evaluator accepts a verified loaded package, a RunConfig input, and the
  existing package-candidate execution limits. It reproduces the complete
  package binding and candidate enumeration before filtering.
- A budget-exhausted enumeration fails with
  `PACKAGE_CANDIDATE_CENSUS_ENUMERATION_INCOMPLETE`. No partial census or
  selectivity value is returned.
- Package and binding verification plus local-plan preflight occur once per
  census session. Every canonical candidate is still re-canonicalized, checked
  for bound-universe membership, and evaluated through the same v10 filter
  path. Immutable universe-membership and source/profile lookup indexes are
  prepared once with the session rather than rebuilt per candidate. No
  predicate is skipped after a sibling failure.
- The artifact embeds the complete package enumeration and every full filter
  artifact in canonical candidate-ID order. Their counts must reconcile
  exactly with the enumerator's canonical-candidate count.
- Candidate totals distinguish evaluated, predicate-rejected,
  filter-indeterminate, and locally eligible candidates. Boolean selectivity is
  `eligibleCandidates / evaluatedCandidates`, or `null` only for an empty
  evaluated population. The indeterminate ratio uses the same denominator.
- Each predicate census records evaluated, passed, failed, indeterminate, and
  exclusively rejected candidates. A rejection is exclusive when that
  predicate is the candidate's only definite failed top-level predicate;
  indeterminate siblings do not create an additional rejection. Entries are
  serialized as a predicate-ID-sorted array so arbitrary valid IDs never
  become canonical JSON object keys.
- `inert` means `failed === 0`. `dominating` means a non-empty evaluated
  population with `failed / evaluated >= 0.90`. The v1 dominance threshold is
  explicit in the artifact and hash rather than inferred from results.
- Local interpretation is `empty` for no evaluated candidates,
  `indeterminate` when the observed indeterminate ratio strictly exceeds the
  RunConfig threshold, and otherwise `valid`. The raw reconciled counts and
  ratios remain present when interpretation is indeterminate.

The artifact hash domain is `onto2d:package-candidate-census:v1`.

`verifyPackageCandidateCensus` accepts a serialized census only after exact
deterministic reproduction from an independently supplied loaded package,
RunConfig, execution limits, and expected kernel version. Whole-artifact
canonical equality verifies the census hash, complete generation, embedded
filter explanations, predicate-ID ordering/uniqueness, all count and ratio
reconciliation, thresholds, and interpretation. JSON Schema remains the
shape-validation boundary rather than a substitute for reproduction.

This remains a local-filter artifact. It performs no cohort construction,
functional scoring, selector admission, derived profile extraction, element
materialization, null-model execution, or closure, and it does not claim to be
a complete `LevelResult`.

<a id="deterministic-irreducible-removal-evaluation"></a>

## Deterministic irreducible-removal evaluation

`local-predicate-evaluator-v19` executes `irreducibleRemoval` for complete
canonical candidates under the run's explicit substructure policy.

- The requested `node` or `edge` removal must be permitted by the policy's
  `remove` field. Policy mismatch fails before any removal is evaluated.
- The evaluator first evaluates the nested predicate on the whole candidate.
  A whole-candidate failure makes the combinator fail; an indeterminate whole
  result makes it indeterminate. Removals are enumerated only after a whole
  pass because they cannot change either result.
- Every canonical parent node or edge is removed exactly once in ascending
  parent-index order. Node removal also removes incident edges. When
  `retainIsolatedNodes` is false, all nodes with no remaining incident edge are
  removed before normalization.
- Empty removals are evaluated only when `includeEmpty` is true. Their identity
  uses `onto2d:substructure:v1` because an empty graph is not a valid standalone
  candidate. Non-empty removals use the existing candidate canonicalizer with
  the parent graph policy except that disconnected input is admitted for
  normalization; predicate connectivity still uses the original projection.
- A disconnected removal is evaluated only when `includeDisconnected` is
  true. Excluded empty or disconnected removals are recorded as skipped and do
  not enter the evaluated denominator.
- For a whole pass, any passing removal makes the combinator fail; otherwise
  any indeterminate removal makes it indeterminate; otherwise all evaluated
  removals failing makes it pass. Zero evaluated removals is indeterminate,
  rather than a silent vacuous pass.
- Successful and unsuccessful witnesses retain the whole nested result, every
  attempted parent removal, retained parent node/edge indexes, canonical-to-
  parent mappings, normalized substructure identity, nested outcome, and nested
  witnesses. This keeps removal evidence auditable across canonical relabelling.
- Nested substructure evaluation shares a hard limit of 10,000 attempted
  removals per top-level evaluation. Nested invariant resolution uses the retained-node and profile-subset
  rules in the numeric contract; a missing required node is not replaced by
  a representative.

The local artifact binds the normalized substructure policy and uses hash
domain `onto2d:predicate-local-evaluation:v19`. Package filtering embeds these
artifacts and binds `package-candidate-filter-evaluator-v20` and
`onto2d:package-candidate-filter:v20`.

Exhaustive minimality, constituent novelty and typed stability are separate
combinators described below. Single-removal irreducibility alone establishes
none of those stronger properties.

<a id="directed-cycle-edge-set-selection"></a>

## Directed cycle-edge set selection

`local-predicate-evaluator-v19` gives the existing selector one explicit
finite meaning named `directed-cycle-edge-union-v1`.

- The selector returns every canonical edge that participates in at least one
  directed cycle of the complete candidate after its optional role filter is
  applied. Equivalently, an eligible edge `u -> v` is selected when `v` can
  reach `u` in the same role-filtered directed graph. A self-loop therefore
  participates in a length-one cycle.
- Edge direction and multiplicity are preserved. Every qualifying canonical
  edge appears exactly once, including parallel copies. Reciprocal edges form
  a directed length-two cycle. No undirected projection is inferred from the
  graph connectivity policy.
- `count({ kind: "cycle" })` counts the selected edge union, not the number of
  distinct cycles. `sum` and `balance` likewise consume every selected edge
  attribute exactly once in ascending canonical edge-index order.
- When no edge qualifies, the selector produces an exact empty set. Count is
  zero, and the existing empty-sum and empty-balance identities remain zero;
  missing attributes on unselected edges are not consulted.
- Every selection witness records `setKind: "cycle"`, the sorted canonical
  edge indexes, the optional normalized role filter, and
  `cycleSelection: "directed-cycle-edge-union-v1"`. This distinguishes the
  contract from ordinary edge selection and from graph predicates whose cycle
  projection is supplied explicitly.
- Directed membership is computed by bounded reachability over the already
  canonical candidate. The existing candidate edge and local selected-value
  ceilings bound execution and artifact size; no simple-cycle enumeration is
  performed.

The local artifact moves to hash domain
`onto2d:predicate-local-evaluation:v19`. Package filtering embeds the changed
selection witness and binds
`package-candidate-filter-evaluator-v20` and
`onto2d:package-candidate-filter:v20`.

This decision does not change `cycleExists`, which continues to require an
explicit `directed`, `undirected-simple`, or `undirected-multigraph`
projection. A future undirected set selector must add an explicit language
contract instead of overloading this method.

<a id="complete-package-cohort-partitioning"></a>

## Complete package cohort partitioning

`package-cohort-partitioner-v1` consumes an independently reproduced complete
`package-candidate-census-evaluator-v1` artifact and one normalized cohort-rule
ID from the same loaded package.

- The partitioner reproduces the loaded package, RunConfig, execution limits,
  complete enumeration, and every embedded filter artifact through the census
  verifier. It never accepts a caller-provided candidate list or eligible
  label.
- Only `eligible` candidates enter cohort membership. Predicate-rejected and
  filter-indeterminate candidate IDs remain in separate sorted exclusion lists.
  A census whose threshold interpretation is already `indeterminate` produces
  an indeterminate partition and no cohorts. No eligible candidates produces
  an explicit empty partition.
- Cohort key expressions are reanalyzed under the package invariant
  declarations and executed by the same verified package value runtime used by
  functional scoring. Constants, canonical counts, exact/profile-consensus
  Quantity invariants, addition, and multiplication therefore have one
  execution meaning. Schema-v1 supplies neither coefficient nor structural-
  attribute environments for cohort keys, so those references remain loader
  errors.
- A normalized key atom records scalar identity directly, numbers as canonical
  unrounded decimals, and Quantities as canonical unrounded decimals, unit,
  inferred semantic when present, and effective absolute tolerance. Evidence
  and complete selection/invariant witnesses remain in the expression
  evaluation record but do not split otherwise identical resource or role
  keys.
- `shared-support` gives every key-expression slot its own resource namespace.
  A resource token hashes the slot index and normalized atom in
  `onto2d:cohort-resource:v1`. Cohorts are connected components of the
  candidate/resource incidence graph, so overlapping support joins candidates
  transitively while every candidate remains in exactly one component.
- `profile-role` groups candidates by exact canonical equality of the ordered
  normalized atom tuple. Key position is semantic and is not sorted.
- `invariant-window` computes the exact mathematical floor of
  `(value - origin) / width` and stores the arbitrary-precision signed bin
  index as a canonical integer string. The normalized origin and strictly
  positive width anchor lower-closed, upper-open bins. Non-zero origin or width
  uncertainty makes the partition indeterminate because it moves every bin.
  Candidate-value uncertainty is accepted only when its closed interval lies
  wholly inside one bin; touching or crossing another bin is indeterminate.
- `singleton` emits one cohort per eligible candidate. `global` emits one
  cohort containing the complete eligible population and is never synthesized
  when no rule is declared.
- If any required key evaluation is missing, ambiguous, or window-uncertain,
  the artifact retains every candidate key evaluation but emits no partial
  cohort list. This preserves a total-partition invariant and prevents ranking
  a silently reduced population.
- Each non-empty cohort hashes its rule, normalized key, and complete sorted
  member set in `onto2d:cohort:v1`. The complete partition binds package,
  rules, binding, census, counting domain, source population, rule, exclusions,
  all key evaluations, cohorts, and reconciled counts in
  `onto2d:package-cohort-partition:v1`.

<a id="complete-cohort-functional-ranking"></a>

## Complete-cohort functional ranking

`package-selector-ranker-v1` consumes an independently reproduced complete
`package-cohort-partitioner-v1` artifact and one normalized selector ID from
the same loaded package.

- The ranker reproduces the loaded package, complete census, and complete
  cohort partition. The partition rule must be the selector's declared rule;
  no caller-supplied member list or score is accepted.
- The referenced functional is evaluated for every cohort member through one
  prepared verified functional session. Every stored filter is reproduced,
  and every full scored or indeterminate functional artifact is retained.
- Scoreable members are serialized by objective-oriented exact rounded value
  and then candidate ID. Candidate ID is only a deterministic ordering and
  presentation-leader tie-break.
- Dense ranks start at `1`. Tolerance-equivalent rank groups are the connected
  components of the closed score intervals
  `[rounded - effectiveAbsoluteTolerance, rounded +
  effectiveAbsoluteTolerance]`. This transitive closure is deterministic and
  independent of input order; distinct components are strictly ordered.
- The mathematical optimum is the first objective-oriented rounded score.
  Semantic extrema contain every score whose oriented difference from that
  optimum is at most the normalized epsilon value under one closed boundary
  comparison. That comparison uses the maximum of the candidate score bound,
  optimum score bound, and epsilon's own effective absolute tolerance. It does
  not feed the comparison result back into another widening step.
- Degeneracy is the complete semantic-extremum count. Its ratio uses the full
  cohort size, and variational selectivity is
  `1 - degeneracy / cohortSize`. A singleton therefore reports zero observed
  variational concentration.
- Gap is the non-negative objective-oriented difference between the first and
  second serialized scoreable members. A tied second member gives zero; fewer
  than two scoreable members gives `null`. Its uncertainty is the sum of both
  score bounds.
- If any member is functionally indeterminate, every member and provisional
  dense rank remains inspectable, but the cohort optimum, semantic extrema,
  degeneracy, gap, and variational selectivity are `null`. The whole selector
  ranking is indeterminate rather than silently shrinking the denominator.
- An empty source partition produces an explicit empty ranking. An
  indeterminate source partition produces no cohort rankings. A ranked
  level-wide variational summary is the population-weighted value
  `1 - sum(degeneracy) / sum(cohortSize)`; it is `null` if any required cohort
  is indeterminate.
- A deterministic functional-evaluation ceiling is checked before evaluation.
  The complete artifact binds package, rules, run binding, census, partition,
  selector, policy identifiers, all functional evaluations, rankings, metrics,
  exclusions, execution counts, and reconciliation counts in
  `onto2d:package-selector-ranking:v1`.

<a id="deterministic-multi-selector-admission"></a>

## Deterministic multi-selector admission

`package-selector-admission-v1` consumes an independently reproduced complete
local-filter census and exactly one partition/ranking/sensitivity chain for
every normalized package selector.

- Selector inputs are complete: duplicates, omissions, undeclared IDs, rule
  drift, and any partition/ranking/sensitivity replay mismatch fail before an
  admission artifact is emitted. Serialization uses normalized selector-ID
  order; caller array order is non-semantic.
- Every selector is evaluated over its own declared partition of the same
  complete locally eligible census. Multi-selector combination is the
  intersection of all applicable semantic-extremum sets, not sequential
  reranking. With no declared selector, identity admission selects every
  locally eligible candidate and emits no synthetic selector execution.
- For an eligible candidate, a definite non-extremum under any selector yields
  `selector-excluded`. This definite exclusion takes precedence over an
  indeterminate result from another selector. Otherwise any unavailable
  semantic-extremum decision yields `selection-indeterminate`; only membership
  in every selector's semantic-extremum set yields `selected`.
- Predicate-rejected and filter-indeterminate candidates retain their local
  outcomes and receive no selector evaluation. Every evaluated census
  candidate appears exactly once in the admission decision list.
- Per-selector census counts reconcile selected, excluded, and indeterminate
  eligible members. Final counts reconcile the eligible population into
  selector-excluded, selection-indeterminate, and selected buckets. Selection
  and overall retention use the exact candidate domain; empty denominators are
  `null`.
- Final indeterminacy is `filterIndeterminate + selectionIndeterminate`. The
  admission interpretation is indeterminate only when its exact ratio exceeds
  the frozen run threshold. Empty evaluated populations remain explicit.
- A fragile sensitivity report does not erase the reproducible base selection,
  but marks that selector's variational interpretation `fragile`. Missing
  sensitivity or base-ranking information marks the metric indeterminate.
  Sensitivity that is not applicable solely because no coefficient was listed
  leaves a complete base ranking valid, while retaining the authorship caveat
  from Complete coefficient-sensitivity execution.
- The artifact embeds every verified selector execution, candidate decision,
  selector census, reconciliation count, retention ratio, interpretation, and
  prerequisite hash under `onto2d:package-selector-admission:v1`. Stored
  artifacts require exact replay.
- This boundary composes already complete per-selector executions. Aggregate
  whole-level perturbation accounting and execution scheduling remain the
  future `LevelResult` controller's responsibility; the admission artifact
  does not claim that a per-selector budget is a global run-usage ledger.

<a id="residual-slot-profiles-and-derived-depth-materialization"></a>

## Residual-slot profiles and derived-depth materialization

Schema-v1 adds the optional `profileDefinition.kind = "residual-slots-v1"`
policy. The existing default remains `explicit-only`.

- A residual-slot definition carries a normalized `baseProfile`, canonical
  derived type tags, and claim references. The base profile supplies frozen
  package-authored external slots and invariant coordinates; it is hashed in
  the package/rules identity.
- For every selected formation, internal candidate edges are processed in
  canonical edge order. The source endpoint consumes one matching `out` slot
  and the target consumes one matching `in` slot. A `sym` slot may satisfy
  either polarity. Exact polarity precedes `sym`, then normalized source slot
  index breaks allocation ties.
- One edge endpoint consumes one capacity unit. Residual minimum capacity is
  `max(0, min - used)`; finite maximum is `max - used`; unbounded maximum
  remains `null`. Slots with zero finite maximum disappear. The output profile
  is the canonical multiset union of base slots and every constituent residual
  slot, with the base invariant vector and precision policy.
- A matching guarded slot requires an executable typed partner guard.
  Unsupported guard forms yield `profile-slot-guard-unsupported`. Missing
  compatible capacity yields `profile-slot-capacity-unavailable`. An
  `explicit-only` package yields `derived-profile-policy-unavailable`.
  These are hashed indeterminate results, never empty profiles.
- `package-derived-profile-extractor-v3` reproduces package, census,
  admission, and selected formations. Each result is hashed in
  `onto2d:derived-profile-extraction:v1`; the complete result is hashed in
  `onto2d:package-derived-profiles:v1`. Any indeterminate selected profile
  makes the set indeterminate without dropping its formation.

`package-derived-depth-population-v3` then reproduces that whole chain and,
under Run-target ontology-coordinate materialization, materializes any normalized run-target ontology coordinate.

- It emits no elements when the profile set is indeterminate, preventing a
  partial closure depth. An empty selected set remains an explicit empty depth.
- A derived element's structural identity contains canonical candidate graph
  content, identity-policy-selected type tags/invariants/profile, and no
  derivation or evidence provenance. Quantity-valued structural attributes use
  normalized value, unit, tolerance, and semantic meaning while excluding
  evidence provenance consistently in candidate and element identity.
- Formation provenance records canonical constituents and constituent
  profiles, skeleton, directed role assignment, source candidate, depth,
  depth basis, and evidence. `admittedBy`, `selectedBy`, and claim references
  are non-structural element fields.
- Equal element IDs are reconciled deterministically. The lexicographically
  smallest formation hash supplies the primary immutable element record; every
  derivation remains in a canonical external derivation index with its own
  admission/selection/claim provenance.
- The complete population, prerequisite hashes, identity policy, elements,
  derivation index, counts, and interpretation are hashed in the shared
  `onto2d:depth-population:v1` domain. Stored results require exact replay.

<a id="deterministic-package-level-closure"></a>

## Deterministic package-level closure

`package-level-closure-v1` is the deterministic coordinator for the currently
supported `primitive-to-derived-depth-1-v1` scope.

- It verifies the loaded package and normalizes the RunConfig, then executes
  the complete candidate census, every declared selector's cohort partition,
  ranking and sensitivity report, all-selector admission, selected formations,
  residual profiles, and derived depth-1 population in that order.
- Before selector execution, it computes ranking evaluations, required
  perturbation variants, and sensitivity functional evaluations across all
  selectors. A level is rejected before partial selector work when any global
  ceiling or the RunConfig perturbation budget is exceeded.
- Configured null models or positive null-model runs are rejected with
  `PACKAGE_LEVEL_CLOSURE_NULL_MODELS_UNAVAILABLE`. A successful current-scope
  artifact records the baseline as `not-run` because null models were
  explicitly disabled; it does not fabricate a control distribution.
- The run identity binds kernel version, package/rules/depth-basis hashes, the
  normalized RunConfig hash, and the exact candidate binding hash in
  `onto2d:run:v1`.
- The level artifact embeds every prerequisite artifact, Boolean selectivity,
  selector censuses, retention metrics, reconciled candidate/formation/profile/
  element counts, global execution consumption, and the terminal
  `complete`, `empty`, or `indeterminate` interpretation. It is hashed in
  `onto2d:package-level-result:v1`.
- `empty` means no derived elements were materialized from an otherwise
  determinate chain. Admission or profile/population indeterminacy propagates
  to the level, and an indeterminate profile set still emits no partial
  derived population.
- Stored closure results are accepted only through exact deterministic replay
  from the independently supplied package, RunConfig, and execution options.
  `createKernel().closeLevel({ package, config, options })` is the public
  adapter for this scope. Generalized level and explicit ladder closure provides generalized depth and
  explicit ladder coordinators without changing this primitive contract.

<a id="verified-depth-source-population-selection-and-binding"></a>

## Verified depth-source population selection and binding

`package-depth-source-selector-v2` builds a content-addressed source selection
for target depths one through 64.

- It independently verifies the loaded package, RunConfig, and every supplied
  prior closure by exact replay: depth one uses `package-level-closure-v1` and
  later depths use `package-depth-level-closure-v1` against their own complete
  prerequisite chain.
- Available depths must be contiguous from zero through `targetDepth - 1`.
  Depth zero is reproduced directly from the package. A target `d` selection
  therefore requires exactly one complete, nonempty closure for every depth
  from one through `d - 1`.
- `all-below` selects every available depth; `previous-only` selects exactly
  `targetDepth - 1`. At target depth one both policies necessarily select the
  primitive population.
- The artifact embeds the primitive/derived population records and their
  population, level, and run hashes. It records every element occurrence and
  its minimum available depth. Equal element IDs in selected depths resolve to
  the earliest selected record; IDs and profile classes are canonical.
- Empty or indeterminate prior levels are ladder terminals and cannot feed a
  later candidate universe. Missing/duplicate depths, targets above the hard
  explicit-chain limit, invalid options, and exact-replay drift fail
  explicitly.
- The entire selection is hashed in
  `onto2d:package-depth-source-selection:v1` and stored artifacts require exact
  deterministic reproduction.
- `package-depth-candidate-binding-v2` consumes that exact selection. It uses
  every selected element ID in `element-exact` or exactly one hash per selected
  profile class in `profile-quotient`, while reproducing the reviewed skeleton,
  role, graph-policy, and execution-budget surface of the primitive binder.
  Its target depth, complete source selection, normalized run, enumeration
  input, and limits are hashed in
  `onto2d:package-depth-candidate-binding:v1`.
- `package-depth-candidate-generator-v3` executes that binding through the same
  finite decorated enumerator and exposes complete/budget-exhausted status
  without silently reducing the universe.
- `package-depth-candidate-filter-evaluator-v1` exact-replays the depth binding,
  proves candidate-universe membership, resolves selected-depth element or
  profile constituents, and evaluates the same frozen local predicate plans.
  Its formation basis carries target depth and source-selection hash and is
  bound in `onto2d:package-depth-candidate-filter:v1`.
- `package-depth-candidate-census-evaluator-v1` filters every canonical record
  only after complete enumeration, reconciles Boolean selectivity and
  predicate diagnostics, and hashes the complete denominator in
  `onto2d:package-depth-candidate-census:v1`. Stored censuses require exact
  package/run/prior-level reproduction.

<a id="generalized-level-and-explicit-ladder-closure"></a>

## Generalized level and explicit ladder closure

`package-depth-level-closure-v1` executes one target transition from a complete
contiguous prior-level chain.

- It reproduces the loaded package, normalized RunConfig, source selection,
  finite enumeration, complete local census, and every declared cohort,
  ranking, sensitivity, and admission input.
- It reuses the verified primitive selection algorithms through prepared
  depth-aware filter and functional sessions; no alternate ranking or
  admission policy exists for later depths.
- Ranking work, perturbation variants, and sensitivity evaluations are
  preflighted before selector execution. Null models remain unavailable and
  cause an explicit preflight failure.
- Selected formations, residual profiles, and derived elements carry the
  target depth. The result embeds prior level/population/run hashes and the
  exact source-selection hash.
- Complete, empty, and indeterminate terminals have the same meaning as the
  primitive transition. The full artifact is hashed in the existing
  `onto2d:package-level-result:v1` domain and stored artifacts require exact
  deterministic replay.

`package-ladder-closure-v1` executes consecutive target depths from one through
an explicitly requested bound of at most 64.

- Depth one uses `package-level-closure-v1`; later depths use the generalized
  coordinator over every already closed level.
- The RunConfig `sourceDepths` policy is preserved at each transition.
- A canonical element index includes the primitive population and every
  derived appearance. Structural identity is counted once, minimum derivation
  depth remains authoritative, and re-derivations remain visible.
- Execution stops after the requested depth, after the first level introduces
  no new element, or after an indeterminate level. These yield `complete`,
  `fixpoint`, or `indeterminate` respectively.
- Work ceilings are enforced independently for each level. Aggregate execution
  totals are reported for audit but do not redefine a per-level ceiling.
- The ladder embeds all level artifacts, introduction counts, selectivity
  records, execution totals, and terminal interpretation. It is hashed in
  `onto2d:package-ladder-result:v1` and verified only by exact replay.
- `boundedFixpoint.enabled: true` selects the separate current-level fixpoint
  coordinator through the generic dispatcher. Its round semantics and evidence
  are distinct from the ordinary ladder.

<a id="bounded-profile-collapse-and-level-boundary-diagnostics"></a>

## Bounded profile collapse and level-boundary diagnostics

`package-profile-collapse-evaluator-v1` compares one requested target depth.

- It reproduces the loaded package and RunConfig, overrides only the counting
  domain, and closes independent element-exact and profile-quotient ladders to
  the same requested bound.
- Every candidate is projected into `profile-quotient` by replacing each
  verified constituent with its normalized profile hash and re-running graph
  canonicalization under the exact bound graph policy and search ceiling.
- Exact multiplicities are grouped under their projected candidate ID. Each
  observation records local verdict, per-predicate outcomes, final admission,
  and selector outcome/score/rank/sensitivity status. Internal and cross-domain
  observable consistency are explicit.
- The compared sets contain finally selected projected candidates. The report
  stores exact-only, quotient-only, intersection, and symmetric-difference
  IDs. `collapseError` is the symmetric-difference size divided by the exact
  projected admitted-set size, is `null` for an empty exact set, and is never
  clamped.
- A completed mismatch is a `counterexample`, not an execution error. The
  lexicographically smallest set difference or observable mismatch retains the
  projected candidate and both observation groups.
- If either ladder terminates before the target transition, the report is
  `truncated`. The full comparison is hashed in
  `onto2d:package-profile-collapse:v1` and accepted only by exact replay.

`package-level-boundary-detector-v1` evaluates every transition through one
requested bound.

- It closes one exact/profile ladder pair and derives each collapse point from
  that shared run, preserving one `depthBasis`.
- Search-interval membership uses the transition target depth inclusively.
  Within each interval, candidate minima must be within `tieTolerance` of the
  minimum and no greater than `maximumCollapseError`.
- Without intervals, global candidate minima are reported but
  `detectedBoundary` remains false.
- A declared comparison uses only a uniform element ontology coordinate or the
  explicit RunConfig `ontologyTarget`. Missing or mixed declarations produce a
  `null` match rather than an inferred label.
- Detected and declared depths, every comparison row, the paired ladder hashes,
  terminal interpretation, and the non-mutation policy are hashed in
  `onto2d:package-level-boundary-report:v1` and exactly replayed.

<a id="explicit-carrier-promotion-from-verified-closure-artifacts"></a>

## Explicit carrier promotion from verified closure artifacts

`package-carrier-promotion-materializer-v1` consumes an independently verified
loaded package, RunConfig, closure ladder, bounded profile-collapse report, and
closed promotion policy.

- The policy declares one source depth, source and strictly higher target
  ontology coordinates, target type tags, package claim/evidence references,
  and an explicit `block` or `record-and-promote` disposition for a collapse
  counterexample.
- Every claim and evidence reference must exist in the verified package. The
  policy evidence must include every evidence reference of its claims.
- Source carriers come only from the selected, admitted derived population of
  the exactly replayed ladder level. A promotion requires a normalized profile
  with at least one slot or invariant. The operation is all-or-nothing when a
  source profile is empty or the source level/collapse is indeterminate.
- If an element already declares an ontology coordinate, it must equal the
  policy source coordinate. Otherwise the artifact records that the source
  coordinate was declared by the promotion policy; it does not write it into
  the source element.
- An equivalent completed collapse permits promotion. A completed
  counterexample is either blocked or preserved in `collapseBasis` and
  explicitly accepted according to policy. Truncation or indeterminacy never
  produces a target carrier.
- Each promotion contains an immutable mapping, profile/rules/collapse basis,
  claim and evidence lineage, a domain hash, and a complete `PrimitiveDefinition`
  suitable as target-package input. It does not reuse or mutate the source
  element identity.
- The policy, every decision and promotion, terminal interpretation, and
  source artifact hashes are covered by
  `onto2d:package-carrier-promotions:v1`. Stored sets are accepted only after
  exact deterministic replay.

<a id="bounded-current-level-fixpoint-closure"></a>

## Bounded current-level fixpoint closure

`package-current-level-fixpoint-closure-v2` is the only coordinator that may
execute `referencesDepth: "self"`.

- Package loading requires `allowCurrentDepthReferences: true`; execution also
  requires `boundedFixpoint.enabled: true`. Ordinary bindings continue to
  reject the self-reference and direct callers are routed to the coordinator.
- `maxIterations` is required and limited to 1 through 10,000. It is part of
  the normalized RunConfig and therefore part of run and result identity.
- Current-level sources, current sets, and the cross-depth index are limited to
  1,000,000 unique element identities, matching the published artifact
  capacity; overflow fails explicitly before an invalid artifact is emitted.
- A level starts with an empty current set. Each round selects the configured
  `all-below` or `previous-only` lower populations and unions them with the
  complete previous current set.
- Each round independently enumerates and filters the complete bound candidate
  universe, runs every selector chain, admits formations, derives profiles,
  materializes elements, and executes configured null models over that exact
  round carrier under the existing verified policies and work ceilings.
- Canonical element IDs not already present in the current set or selected
  lower source are added monotonically. A round with no addition is the first
  convergence witness; evaluation order cannot retract an element.
- The round artifact binds source and before/after current-set hashes, all
  embedded stage artifacts, added IDs, execution totals, status, and a domain-
  separated round hash. Current-set state and final population use distinct
  hash domains.
- A converged level publishes the monotone current set. Alternate derivations
  are deduplicated by formation hash and record the first round in which each
  derivation appeared.
- If a round is indeterminate, or the iteration bound is consumed by rounds
  that still add elements, the level is `indeterminate`. Tentative elements
  and derivations remain in a separate audit population, while the final
  population and interpreted selectivity are withheld.
- A direct level above depth one accepts lower levels only after reproducing
  every one in ascending order from the independent package and RunConfig.
  Stored levels require exact replay.

`package-fixpoint-ladder-closure-v1` applies the same coordinator at consecutive
depths. It keeps the ordinary minimum-depth/all-appearances index and stops at
the requested bound, an indeterminate level, or a level that introduces no
globally new canonical element. The generic ladder and configured-kernel
adapters dispatch to it whenever bounded mode is enabled. The complete ladder
has its own domain hash and exact replay contract.

Profile-collapse and level-boundary diagnostics reject bounded-fixpoint runs
for now. Their existing comparison observes a terminal ordinary level, whereas
a truthful fixpoint comparison must define cumulative cross-round predicate,
selector, and admission observations. They must not silently compare only the
last round.

<a id="exhaustive-policy-bound-minimal-subgraphs"></a>

## Exhaustive policy-bound minimal subgraphs

`local-predicate-evaluator-v19` executes `minimal(P)` for complete canonical
candidates under `exhaustive-proper-subgraphs-v1`.

- The evaluator first evaluates `P` on the whole candidate. A whole failure or
  indeterminate result is final and no subgraph is enumerated.
- An omitted expression policy binds the run's `SubstructurePolicy`. An
  explicit `minimal.policy` must equal the bound run policy ID. All nested
  minimal and irreducible-removal requirements must be satisfiable by that one
  policy before evaluation begins.
- Canonical parent index zero is the least-significant subset bit. Subsets are
  visited in ascending binary order without recursive call-stack growth.
- `remove: nodes` enumerates every proper node subset and retains every parent
  edge whose endpoints are selected.
- `remove: edges` retains the complete parent node selection and enumerates
  every proper edge subset.
- `remove: nodes-and-edges` enumerates every node subset and every subset of
  the parent edges whose endpoints it retains. Only the complete parent node
  and edge selection is excluded.
- `retainIsolatedNodes: false` removes every selected node without an incident
  selected edge before normalization. The witness retains both the raw
  `selectedNodeIndexes`/`selectedEdgeIndexes` and effective
  `parentNodeIndexes`/`parentEdgeIndexes`. Distinct raw selections remain
  distinct audit entries even when isolated-node removal produces the same
  effective graph.
- Empty and disconnected selections excluded by policy are recorded as
  `skipped` and do not count as inner failures. Included empty graphs use the
  existing domain-separated substructure identity. Non-empty graphs use the
  normal candidate canonicalizer with disconnected normalization enabled and
  retain canonical-to-parent node and edge mappings.
- After a whole pass, any evaluated passing proper subgraph makes `minimal`
  fail. Otherwise any evaluated indeterminate subgraph makes it indeterminate;
  if no subgraph was evaluated, the result is also indeterminate. Only a
  non-empty evaluated denominator in which every `P` result fails proves
  minimality.
- Before materialization, a capped exact counter calculates the selected
  proper-subgraph family size. A family that would exceed the remaining shared
  limit of 10,000 substructure attempts fails with
  `PREDICATE_LOCAL_SUBSTRUCTURE_LIMIT`. Nested minimal/removal evaluation shares
  the same counter.
- Runtime invariant expressions below a substructure combinator require
  retained-node resolution under the nested invariant contract, while
  Exact constituent novelty evaluation through Seeded sampled `stableUnder` separately close `novel` and exact/sampled
  `stableUnder`.

The local artifact records the policy, enumeration method, whole result,
attempted/evaluated/skipped counts, every selection and nested outcome. Its
evaluator and hash domain move to `local-predicate-evaluator-v19` and
`onto2d:predicate-local-evaluation:v19`. Package filtering preflights and binds
minimal plans to the reproduced run policy, moving to
`package-candidate-filter-evaluator-v20` and
`onto2d:package-candidate-filter:v20`.

<a id="exact-constituent-novelty-evaluation"></a>

## Exact constituent novelty evaluation

`local-predicate-evaluator-v19` executes `novel(P)` only for complete
`element-exact` candidates under
`canonical-single-node-no-edge-v1`.

- `P` is evaluated first on the whole canonical candidate. A whole `fail` or
  `indeterminate` result is final and no constituent projection is evaluated.
- After a whole pass, every canonical parent node produces one projection
  containing that exact node, including its structural attributes, and no
  edges. The projection is canonicalized with connectedness disabled and
  retains its content identity, exact source element ID, parent node index,
  and canonical-to-parent mapping.
- Any passing constituent makes novelty fail. Otherwise any indeterminate
  constituent makes the result indeterminate. Only a non-empty constituent
  set in which every evaluation fails proves novelty. A zero-constituent
  denominator is indeterminate rather than a vacuous pass.
- A singleton candidate is therefore not novel when `P` passes for its sole
  element projection.
- Constituent projections share the existing hard limit of 10,000 attempted
  substructure evaluations with nested `minimal`, `irreducibleRemoval`, and
  `novel` calls. The direct constituent count is checked against the remaining
  budget before projections are materialized.
- `novel` itself does not require `SubstructurePolicy`, because its projection
  is fixed by this decision. If `P` contains `minimal` or
  `irreducibleRemoval`, the plan still binds the one explicit run policy. The
  novelty witness records that policy ID when such a binding is present.
- Runtime invariant expressions below `novel` remain rejected under the same
  substructure rule as removal and minimality. Constituent-local missing-node
  and profile-subset invariant semantics are not inferred.
- `profile-quotient` candidates fail with
  `PREDICATE_LOCAL_NOVEL_DOMAIN_UNSUPPORTED`. The runtime does not use the
  disclosed representative element as a constituent substitute.

The witness records the projection method, whole result, attempted and
evaluated constituent counts, and every source element/projection identity,
mapping, outcome, and nested witness. Local evaluation uses
`local-predicate-evaluator-v19` and
`onto2d:predicate-local-evaluation:v19`. The depth-one package filter exposes
the new executable plan through `package-candidate-filter-evaluator-v20` and
`onto2d:package-candidate-filter:v20`.

Depth and fixpoint coordinators bind their complete nested evaluator artifacts
and identities.

Stability requires an explicit perturbation family and exhaustive or sampled
execution policy, as defined below.

<a id="exhaustive-typed-stableunder"></a>

## Exhaustive typed `stableUnder`

Schema v1 admits registry-only string identifiers for compatibility and four
executable finite definition kinds:

- `edge-deletion`, optionally restricted to declared roles;
- `node-deletion`, which also removes incident edges;
- `edge-role-replacement`, with a non-empty list of distinct `from`/`to`
  mappings;
- `numeric-attribute-displacement`, targeting one structural node or edge
  attribute by a positive finite epsilon in one or both declared directions.

Executable definitions normalize the enumeration to
`exhaustive-valid-single-edits-v1` and the empty policy to `indeterminate`
unless `vacuous-pass` is explicit. Registry-only strings remain analyzable but
fail package-filter preflight when a plan tries to execute them. Sampled
enumeration is not accepted by this contract.

One canonical parent item and one applicable edit specification form one
attempt. Attempts are ordered by canonical parent index and normalized
definition order. Semantically distinct attempts remain distinct denominator
members even when they canonicalize to the same perturbed candidate. Every
valid perturbation is canonicalized under the original graph policy and keeps
its candidate ID, canonical-to-parent node/edge mappings, nested outcome, and
witnesses. Missing/non-numeric attributes, non-finite or ineffective numeric
displacements, and graph-policy-invalid results are retained as skipped audit
records and omitted from the valid denominator. Canonicalization budget errors
and other non-validation errors propagate instead of being relabeled invalid.

Let `V` be the number of valid perturbed candidates, `S` the passing count, and
`I` the indeterminate count. The evaluator compares the exact rational bounds

```text
lower = S / V
upper = (S + I) / V
```

against the exact decimal spelling of `threshold`. It passes when
`lower >= threshold`, fails when `upper < threshold`, and is otherwise
indeterminate. Rounded decimal bounds are diagnostics only and use the bound
run precision. `V = 0` is indeterminate unless the definition explicitly uses
`vacuous-pass`.

The local artifact binds a domain-separated perturbation-context hash, exact
threshold, decision rule, all reconciled counts, bounds, and attempts. Nested
substructure policies are discovered through `stableUnder` and their ID is
retained when needed. Perturbations and substructures share the existing
10,000-attempt ceiling, with the exact edit-family size preflighted before
materialization. Runtime invariants inside perturbed candidates use the explicit nested
subset/missing-node resolution contract.

The evaluation uses `local-predicate-evaluator-v19`,
`onto2d:predicate-local-evaluation:v19`,
`package-candidate-filter-evaluator-v20`, and
`onto2d:package-candidate-filter:v20`. Package filtering supplies only the
typed definitions required by each plan, and complete census execution retains
every resulting pass/fail/indeterminate artifact.

<a id="seeded-sampled-stableunder"></a>

## Seeded sampled `stableUnder`

The four typed perturbation kinds from Exhaustive typed `stableUnder` may explicitly select
`sampled-valid-single-edits-v1`. Omitting `enumeration` still selects the exact
`exhaustive-valid-single-edits-v1` default. Registry-only strings remain
non-executable.

The sampled frame is `applicable-single-edit-attempts-v1`: the same canonical,
definition-ordered attempt frame used by exact execution before graph-policy
validation. Sampling uses `with-replacement`; duplicate frame indexes are
independent denominator observations and remain visible in the witness. The
run's `budget.perturbationSamples` is the requested sample count. A non-empty
frame with a zero sample budget is `indeterminate`, while a structurally empty
frame still follows the definition's explicit `emptyPolicy`.

The stream algorithm is `sha256-rejection-counter-v1`. Package execution uses
the content-addressed RunConfig hash as its stream key. For each sample ordinal
and rejection counter, the evaluator hashes this tuple in
`onto2d:perturbation-sample-draw:v1`:

```text
stream algorithm
stream key
perturbation-context hash
predicate-plan hash
current canonical candidate ID
perturbation ID
sample ordinal
rejection counter
```

The SHA-256 digest is interpreted as an unsigned 256-bit integer. For frame
size `F`, values at or above `2^256 - (2^256 mod F)` are rejected; an accepted
value selects `digest mod F`. Thus every frame index has equal probability
without modulo bias. At most 1,024 counter draws are permitted for one sample,
and the witness records the selected frame index and number of stream draws.
Canonical relabelling cannot change the candidate ID or stream.

Each sampled attempt is then processed exactly as in Exhaustive typed `stableUnder`. Invalid edits
remain skipped evidence and do not enter the valid sample denominator. Given
`n` valid sampled draws, `S` passing draws, and `I` indeterminate draws, the
runtime estimates the passing probability and the non-failure probability
`(S + I) / n` separately.

The uncertainty policy is `chebyshev-union-95-v1`. For either Bernoulli mean,
Chebyshev's inequality with variance at most `1/4` and radius
`sqrt(10 / n)` has error probability at most `1/40`. Applying the union bound
to the passing and non-failure means therefore retains at least 95% joint
coverage. The runtime uses only integer arithmetic and a conservative six-
decimal outward bound:

```text
q = 10^6
radius = ceil(sqrt(10 * q^2 / n)) / q
```

Observed proportions are floored for lower bounds and ceiled for upper bounds,
then expanded by `radius` and clamped to `[0, 1]`. The sampled operator passes
when the passing-probability lower bound is at least the exact decimal
threshold, fails when the non-failure-probability upper bound is below it, and
is otherwise `indeterminate`. Zero valid sampled draws are always
`indeterminate` unless the attempt frame itself is known to be empty and
`vacuous-pass` was explicitly selected.

The witness binds the stream contract and key, requested sample count, frame
size, sampling status, 95/100 confidence level, fixed bound precision, radius,
both confidence intervals, empirical exact fractions, every draw, and the
decision rule
`chebyshev-union-95-three-valued-bounds-v1`. Sampling and nested substructure
evaluation share the 10,000-operation ceiling; sampled frame materialization is
also capped at 10,000 entries.

The evaluation uses `local-predicate-evaluator-v19`,
`onto2d:predicate-local-evaluation:v19`,
`onto2d:perturbation-context:v2`,
`package-candidate-filter-evaluator-v20`, and
`onto2d:package-candidate-filter:v20`.

<a id="deterministic-monotonicity-audit-and-pruning-controller"></a>

## Deterministic monotonicity audit and pruning controller

`package-predicate-monotonicity-auditor-v1` reproduces the complete depth-one
package candidate universe and binds its package, rules, run configuration,
candidate binding, seed, canonical candidate IDs, and extension-frame hash.
Its v1 extension model is
`complete-node-canonical-edge-prefix-v1`: all candidate nodes are fixed, and a
strict canonical edge prefix is paired with the corresponding complete
candidate. This narrow model matches the next generator-integration boundary
without claiming node-growth or arbitrary attribute derivation.

For every predicate declaring `monotoneViolation: true`, the auditor samples
uniformly from the finite set of strict edge-prefix/complete-extension pairs,
with replacement. Draws use domain-separated SHA-256 rejection sampling keyed
by the run hash, universe hash, predicate-plan hash, sample ordinal, and
rejection counter. There is no ambient randomness and no modulo bias. The
default is 200 samples per declared predicate, the artifact records the exact
requested count and every accepted frame index, and the hard per-predicate
ceiling is 10,000.

Each supported graph plan is evaluated on both the partial prefix and complete
extension. A `partial fail -> extension pass` pair is a counterexample to the
declared violation monotonicity and gives the plan and whole audit `failed`
status. Unsupported runtime operators, a zero sample budget, or an empty strict
extension frame are explicit indeterminate states. Audit samples retain the
partial graph, complete candidate, complete/partial evaluation, and diagnostic
hashes plus their outcomes, edge counts, and stream-draw count. Stored audits
are accepted only through exact deterministic reproduction.

Passing samples mean only that the bounded audit found no counterexample. A
plan is marked pruning-eligible only when it also has analyzer status
`static-proven`. Passing samples never upgrade `blocked-unproven`,
`blocked-partial-data`, or runtime-unsupported plans.

`package-partial-pruning-controller-v1` is a separate decision boundary. It
reproduces the complete audit, rejects partial graphs outside the bound
package/run vocabulary, and accepts only complete-node states under the frozen
extension model. It authorizes pruning exactly when:

1. the whole package audit passed;
2. the named plan's audit passed;
3. the analyzer marked that plan `static-proven`;
4. the reproduced partial diagnostic contains a persistent failure.

The embedded `partial-graph-predicate-evaluator-v1` artifact continues to say
`pruningAuthorized: false`; authority exists only in the separately hashed
controller decision. Audit artifacts use
`onto2d:package-pruning-audit:v1`, sample draws use
`onto2d:package-pruning-audit-sample:v1`, the candidate frame uses
`onto2d:package-pruning-audit-universe:v1`, and decisions use
`onto2d:package-pruning-decision:v1`.

<a id="audited-pre-admission-candidate-pruning"></a>

## Audited pre-admission candidate pruning

`createPackagePartialPruningControllerSession` reproduces and verifies one
package/run/audit tuple once. The immutable session exposes the audited
binding, kernel version, sorted statically proven and audit-passed predicate
IDs, and a repeated `evaluate` method. Every method result is byte-for-byte the
same `package-partial-pruning-controller-v1` decision produced by the one-shot
API; preparation changes batching cost, not authority.

`decorated-candidate-enumerator-v5` retains the separately reconciled
`preAdmissionPrunedCandidates` raw count and an internal-only pre-admission
decision hook. The public two-argument enumerator never accepts an arbitrary
hook and always reports zero for that count. Package integration first
canonicalizes each complete raw decoration under the actual graph policy, so
connectivity failures remain `policyExcludedCandidates`. Only a valid
canonical candidate reaches the prepared controller.

`package-pruned-candidate-generator-v1` scans the canonical edge prefixes of
each complete raw decoration, including the complete edge sequence, in
increasing edge-count order. At each prefix it evaluates authorized predicate
IDs in lexical order and stops at the first separately authorized persistent
failure. The removed raw decoration never enters CandidateStore. Canonical
duplicates must produce the same first decision; otherwise execution fails.

The artifact binds the package, rules, run configuration, candidate binding,
audit, strategy, sorted authorized predicate set, every unique pruned
candidate's first full decision, raw multiplicity, and a rolling transcript
hash covering every controller decision. Counts distinguish evaluated raw
candidates, prefix states, controller decisions, authorized decisions, unique
and duplicate pruned candidates, and retained canonical candidates.

A result is emitted only after exact pruning-disabled differential
conformance. The implementation reruns the same bound enumeration with no
pruner and requires:

```text
baseline attempted = retained attempted + pruned raw
baseline canonical = retained canonical + unique pruned
baseline duplicate = retained duplicate + duplicate pruned
```

It then performs complete package-local filtering on the baseline and retained
populations. Every pruned canonical candidate must be `predicate-rejected` by
the predicate named in its authorization decision. The pruning-enabled and
disabled `eligible` sets must have identical sorted content hashes, as must the
two `filter-indeterminate` sets. Any disagreement is a hard unsoundness or
differential-conformance error, never a partial artifact. Stored generation
artifacts are accepted only through exact deterministic replay.

The new identities use
`onto2d:package-pruned-candidate-generation:v1`,
`onto2d:package-pruning-transcript:v1`, and
`onto2d:package-pruning-result-set:v1`.

<a id="audited-recursive-generator-frontier-pruning"></a>

## Audited recursive generator-frontier pruning

`decorated-candidate-enumerator-v5` exposes internal-only hooks for observing
complete raw extensions and evaluating strict edge-group frontiers after all
nodes have been assigned. A frontier is the exact raw traversal state before
at least one group remains. Its closed metadata binds the skeleton, number of
completed and total groups, selected multiplicity in every completed group,
and the exact number of reachable raw completions. Mandatory skeleton-edge
groups precede optional self-loop groups. Parallel selections are canonical
multisets, and the remaining count is reproduced with exact integer
combinatorics before it is admitted to the safe-integer artifact contract.

`package-generator-frontier-auditor-v1` first verifies the Deterministic monotonicity audit and pruning controller canonical
audit and the same package/run binding. It observes the actual raw traversal,
hashes every raw extension and its complete group-count vector into a rolling
frame, and samples strict frontiers uniformly with SHA-256 rejection sampling.
Each selected frontier is paired with a reachable complete raw extension. A
`frontier fail -> extension pass` pair falsifies the claim. Passing samples are
still falsification evidence only: pruning eligibility additionally requires
the plan's static proof and the passed canonical audit.

For `connectivityProjection: "directed-strong"`, a controller may authorize
closure only after the current complete-node frontier is already strongly
connected in both directions. Edge addition cannot destroy that property, so
every raw descendant then survives the connectivity policy. Earlier
disconnected frontiers remain visible to the audit but receive
`connectivity-frontier-not-satisfied` and cannot be closed, even when their
predicate diagnostic is persistently failing.

`package-generator-frontier-controller-v1` exactly reproduces both audits once
and validates every submitted frontier against the bound skeleton, domain,
node alphabet, edge-group alphabets and order, multiplicities, edge limit, and
exact descendant count. It emits a separate hashed decision and authorizes a
branch only when the frontier audit passed, the plan remains statically proven,
and the partial evaluator reproduces a persistent failure.

`package-recursive-pruned-candidate-generator-v1` applies those decisions at
strict group boundaries and retains the Audited pre-admission candidate pruning canonical-prefix check as a
final pre-admission guard. It records every authorized frontier, its partial
graph and decision, the exact raw subtree size, visited/reference/skipped
decoration-state counts, and a rolling decision transcript. `generatedCandidates`
counts complete raw candidates actually visited;
`branchPrunedRawCandidates` counts exact skipped descendants; and
`logicalRawCandidates` is their reconciled sum.

An artifact is interpretable only after exact three-layer conformance:

1. the recursive CandidateStore and policy/canonicalization counts equal the
   complete pre-admission-only reference;
2. visited raw candidates plus skipped descendants equal that reference's raw
   universe, and pre-admission removals plus skipped descendants equal its
   removal census;
3. the pre-admission artifact has already proved eligible and indeterminate
   set equality against pruning-disabled full filtering.

The reference executions must complete under the declared semantic and
execution budgets, so subtree skipping cannot turn a baseline-exhausted run
into an interpretable result. Stored audits, decisions, and recursive
generation artifacts require exact deterministic replay; schema validation or
a self-declared hash is insufficient.

<a id="generalized-depth-aware-audited-pruning"></a>

## Generalized depth-aware audited pruning

The depth-aware pruning APIs accept a loaded package, RunConfig, complete
contiguous `PackageClosedLevel` chain, and explicit `targetDepth`. They first
reproduce `package-depth-candidate-binding-v2`, including the exact
`all-below` or `previous-only` source selection. Every emitted artifact binds:

- `targetDepth`;
- `sourcePopulationHash`, equal to the reproduced depth-source selection hash;
- the package, rules, run, and depth binding hashes;
- a depth-specific artifact version and domain-separated hash.

`package-depth-predicate-monotonicity-auditor-v1` applies the Deterministic monotonicity audit and pruning controller
canonical-prefix falsification model to the complete target-depth canonical
universe. Its controller authorizes only the same statically proven, audited,
reproduced persistent failure as the depth-one controller.

`package-depth-pruned-candidate-generator-v1` applies the prepared controller
before CandidateStore admission and proves exact eligible and indeterminate
set equality against a pruning-disabled depth-aware filter session.

`package-depth-generator-frontier-auditor-v1` observes the actual raw
edge-group traversal and samples reachable complete extensions under the
reproduced target binding. Its controller retains all Audited recursive generator-frontier pruning frontier
validation and directed-strong connectivity gates.
`package-depth-recursive-pruned-candidate-generator-v1` records exact skipped
subtree and traversal counts, retains canonical-prefix pre-admission checks,
and proves agreement with both the depth-aware pre-admission-only artifact and
the pruning-disabled target-depth universe.

All verification APIs reproduce the full artifact from the supplied package,
RunConfig, prior-level chain, target depth, audit limits, and execution limits.
Schema validity and self-declared hashes are never sufficient. The depth-one
public artifacts retain their original versions and hash domains.

The optimized path is explicit. Ordinary level and ladder closure continue to
use their existing exhaustive generator until a separately reviewed policy
chooses the optimized path; optimization must preserve closure results
or budget interpretation.

<a id="typed-profile-partner-guards"></a>

## Typed profile partner guards

`ProfileSlot.guard` is closed to either a legacy content hash or a typed
`profile-slot-partner-guard-v1` expression. The executable expression language
has bounded depth, node count, and logical arity and contains:

- order-independent `all` and `any` plus three-valued `not`;
- `partnerTypeTag` over the partner element's complete type-tag set;
- `partnerInvariant` with `eq`/`ne` for every scalar invariant and the full
  comparator set for exact numbers and normalized Quantities.

Unknown fields, missing fields, duplicate logical arguments, invalid values,
and nonnumeric ordering comparisons fail package load. Logical arguments are
canonicalized independently of authored order. Quantity comparisons reuse the
kernel's dimensional, semantic, and maximum-declared-tolerance policy.

Residual extraction evaluates a guarded endpoint against every element in the
partner's verified profile class, not only its disclosed representative.
Every member retains a complete path/check transcript. The aggregate result is:

- `pass` only when every member passes;
- `fail` only when every member fails;
- `indeterminate` on missing/incompatible data or mixed class-member outcomes.

Slot preference remains exact polarity, then symmetric polarity, then
normalized slot index. A higher-preference indeterminate guard blocks choosing
a lower-preference slot because its eventual resolution could change the
allocation. A failed guard may be skipped in favor of the next compatible
slot. If every compatible guard fails, extraction emits
`profile-slot-guard-unsatisfied`; unresolved typed guards emit
`profile-slot-guard-indeterminate`. Legacy hash refs remain accepted but emit
`profile-slot-guard-unsupported`.

Each decision is content-addressed in
`onto2d:profile-slot-guard-evaluation:v1`, retained in the derived-profile
result, and referenced by the endpoint consumption witness. Guard failure or
indeterminacy emits no profile or partial derived population.

<a id="audited-node-growth-pruning"></a>

## Audited node-growth pruning

`package-node-frontier-auditor-v1` constructs a deterministic frame from every
policy-relevant complete raw extension paired with each of its strict non-empty
node prefixes. For every package predicate declared monotone, seeded
with-replacement samples record the `nodesComplete: false` persistent-failure
diagnostic and the complete extension outcome. A persistent node-prefix failure
followed by a passing extension is a counterexample. As in Deterministic monotonicity audit and pruning controller through
Generalized depth-aware audited pruning, absence of sampled counterexamples is falsification evidence only;
authorization still requires a `static-proven` plan and a passed canonical
audit.

The frame and audit are content-addressed independently of edge-frontier
artifacts. The prepared controller validates every supplied node prefix against
the bound domain, skeleton, node alphabet, assigned/remaining counts, exact
edge-completion count per assignment, and exact total raw descendants. It then
reproduces the partial diagnostic. Only a passed node audit, an authorized
static plan, and a detected persistent failure can close the subtree.

For `connected: true` with the `undirected` or `directed-weak` projection, each
raw descendant of a connected skeleton is policy-admissible because every
skeleton edge is mandatory. With `connected: false`, connectivity creates no
exclusions. `directed-strong` may still exclude descendants according to their
later edge directions, so v1 reports `blocked-connectivity` and grants no node
authority. This conservative restriction preserves the exact raw and policy
censuses, not merely the final candidate set.

`package-node-growth-pruned-candidate-generator-v1` consumes only the verified
controller. It retains canonical complete-candidate pre-admission pruning as a
final guard, records every node decision in a chained transcript, and
reconciles visited plus skipped raw candidates. Before returning an
interpretable artifact it requires exact candidate-store and count agreement
with the verified pre-admission-only reference, whose own eligible and
indeterminate sets already match pruning-disabled execution.

The depth-aware audit, decision, and generator reproduce the same contract with
separate hash domains and bind `targetDepth`, the verified contiguous prior
chain, and `sourcePopulationHash`. Profile-composition-gated node-frontier
enumeration remains rejected because that gate changes the audited extension
universe. Profile-gated audited pre-admission pruning permits only the narrower complete-candidate
pre-admission controller after the profile gate has passed.

<a id="profile-gated-audited-pre-admission-pruning"></a>

## Profile-gated audited pre-admission pruning

The combined depth-one and generalized-depth execution order is fixed as:

1. build a complete raw candidate;
2. canonicalize it under the bound graph policy;
3. execute `package-profile-composition-gate-v1`;
4. record and exclude a definite incompatible composition;
5. fail the whole generation on an indeterminate composition decision;
6. evaluate the audited canonical-prefix pruning controller only after a pass;
7. admit an unpruned compatible candidate to CandidateStore.

`auditPackagePredicateMonotonicity` and its depth-aware counterpart reproduce
ordinary package generation first. Consequently, when
`profileCompositionPolicy` is `profile-slot-gate-v1`, their canonical universe
contains exactly the compatible candidates and their binding hash already
commits to the gate policy, source population, role alphabet, graph policy, and
run configuration. The audit remains falsification-only and cannot authorize a
plan without the existing `static-proven` predicate proof.

The internal decorator has a dedicated combined gate/pruner boundary. It does
not expose either authority to generic callers, and it cannot reverse their
order. The pre-admission generation artifact now carries the complete
`profileComposition` transcript. Before the result is interpretable, execution
replays the same binding with pruning disabled and requires:

- byte-equivalent profile-composition transcripts;
- equal raw, graph-policy, composition-exclusion, and canonicalization counts;
- exact CandidateStore reconciliation after accounting for pruned canonical
  representatives and duplicate raw occurrences;
- identical eligible and filter-indeterminate candidate sets after full local
  filtering.

The generalized-depth path uses the same executor but additionally binds its
verified prior-level chain, `targetDepth`, and `sourcePopulationHash`.

Raw edge-group recursive pruning and incomplete-node growth pruning remain
fail-closed under the profile gate. They can skip candidates before complete
profile consumption is known and therefore require a separate audit that
reconciles capacity/guard state and the overlap between predicate-pruned and
composition-excluded descendants.

[Profile-gated audited raw-frontier pruning](#profile-gated-audited-raw-frontier-pruning) provides that
separate complete-extension census without broadening this canonical-prefix
decision.

<a id="profile-gated-audited-raw-frontier-pruning"></a>

## Profile-gated audited raw-frontier pruning

Every raw-frontier audit now constructs a separate, content-addressed profile
extension census from the complete graph-policy-admissible reference
traversal. For every strict edge-group or node-assignment prefix it records:

- a domain-separated key over the exact binding, frontier kind, partial
  candidate, and stable prefix coordinates;
- the number of reachable raw extensions that pass the complete profile gate;
- the number of reachable raw extensions that the profile gate excludes.

The census also binds the complete compatible canonical candidate set, the
raw compatible/excluded totals, the profile policy, and its own universe hash.
The predicate frontier audit still samples the full graph-policy-admissible raw
extension frame, so the profile census narrows neither falsification evidence
nor static-proof requirements. Its compatible canonical set must exactly equal
the canonical-prefix audit universe before either audit is accepted.

At execution, an authorized raw frontier must have an exact census entry whose
compatible plus excluded descendants equal the enumerator's independently
computed `remainingRawCandidates`. The generator records that entry with the
pruning decision. A complete-candidate profile session still evaluates every
visited leaf before canonical-prefix pruning; the authoritative complete
profile transcript is reproduced by the pre-admission reference.

Before returning an interpretable result, the recursive edge and node-growth
generators require all of the following:

- skipped compatible plus skipped excluded descendants equal all skipped raw
  descendants;
- visited generated plus skipped raw descendants equal reference generation;
- visited composition exclusions plus skipped profile exclusions equal the
  reference composition transcript;
- visited pre-admission removals plus skipped compatible descendants equal the
  pre-admission reference removals;
- retained CandidateStore, eligible set, and filter-indeterminate set exactly
  match the verified pre-admission and pruning-disabled references.

The same executor and census rules apply at depth one and arbitrary verified
target depths. Depth-aware artifacts additionally bind the reproduced prior
chain, target depth, and selected source population. Incomplete node prefixes
remain fail-closed for `directed-strong` connectivity because later edge
directions can still change graph-policy admission; already strongly connected
edge frontiers retain the existing monotone connectivity rule.

<a id="schema-v1-profile-aggregation-registry-closure"></a>

## Schema-v1 profile-aggregation registry closure

The schema-v1 profile-invariant aggregation registry is complete with exactly
two modes:

1. omitted `profileAggregation`: strict identical normalized consensus across
   the complete profile class;
2. `arithmetic-mean-conservative-v1`: the explicit numeric scalar/Quantity
   policy frozen by Explicit profile-invariant aggregation.

All other names remain invalid at JSON Schema and expression-analysis
boundaries. They are future scientific extensions, not pending implementations
of the current kernel. Adding one requires an updated contract, an explicit schema and
artifact version, complete member/type/unit/semantic rules, uncertainty and
provenance combination, and conformance across local predicates, package
functionals, and cohort keys.

No runtime artifact or hash-domain version changes because this decision
closes the existing registry rather than changing either executable policy.
