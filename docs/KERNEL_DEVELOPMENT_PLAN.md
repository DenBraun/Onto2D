# Onto2D Kernel Development Plan

Status: schema-v1 implementation closure reached locally; release acceptance
and post-closure visualization remain active for the target defined in
[KERNEL_ARCHITECTURE.md](./KERNEL_ARCHITECTURE.md). The exact current boundary
is recorded in
[KERNEL_IMPLEMENTATION_STATUS.md](./KERNEL_IMPLEMENTATION_STATUS.md).

## 1. Objective

Build a deterministic admissibility-closure kernel that:

- enumerates connected structural candidates;
- canonicalizes and deduplicates them exactly;
- evaluates typed admissibility predicates with witnesses;
- partitions eligible candidates into declared competition cohorts;
- ranks complete cohorts with typed functionals;
- measures Boolean and variational selectivity;
- reports sensitivity and null-model controls;
- extracts profiles and closes successive derivation depths;
- preserves evidence, source relations, and reproducibility artifacts.

The existing catalogue-backed API remains a compatibility surface. Catalogue
loading, source classification, and scientific computation stay in adapters;
they do not define core kernel semantics.

## 2. Current implementation boundary

Implemented:

- dependency-free package boundaries and versioned public exports;
- guarded canonical JSON and domain-separated SHA-256 hashing;
- deterministic schema-v1 package defaults, validation, normalization, and
  semantic manifests;
- primitive element IDs, profile hashes, rules hashes, identity-policy hashes,
  and depth-basis hashes;
- exact refinement/individualization canonicalization for supplied candidates
  and exhaustive permutation-minimum canonicalization for simple skeletons;
- exhaustive connected simple-skeleton enumeration through six nodes;
- finite deterministic candidate decoration for explicit skeleton/node/edge
  alphabets, including direction, roles, structural attributes, parallel-edge
  multisets, enabled loops, count reconciliation, and explicit budgets;
- closed RunConfig normalization and content-addressed binding/execution for
  a verified materialized primitive depth population, element/profile
  alphabets, explicit depth selection, roles, connected skeletons,
  representatives, and semantic/execution budgets;
- fixed-domain CandidateStore deduplication and explicit completion/truncation
  state;
- multiplicative SI unit parsing, compatible conversion, tolerance-aware
  comparison, and deterministic decimal arithmetic/accumulation;
- recursive typed `ValueExpression` analysis, dependency extraction,
  dimensional inference, normalized expression hashing, and loader checks for
  functional/cohort result dimensions;
- recursive typed Boolean-expression analysis, graph/value requirement
  extraction, conservative truth-persistence and partial-detectability
  inference, content-addressed predicate plans, loader integration, and
  run-specific numeric-policy binding;
- verified complete evaluation for logical and graph-structural predicate
  plans, with canonical witnesses and conservative partial persistent-failure
  diagnostics that explicitly do not authorize pruning;
- package-bound local candidate filtering that reproduces the loaded package
  and generation binding, proves finite-universe membership, resolves exact or
  profile-representative constituents, and evaluates every graph or supported
  local-numeric top-level predicate under a reproduced numeric binding;
- complete package-bound local-filter census construction over a fully
  enumerated canonical population, including every filter artifact,
  reconciled Boolean selectivity and indeterminate ratios, exclusive rejection
  attribution, and inert/dominating predicate diagnostics;
- package-bound finite functional evaluation after exact eligible-filter
  reproduction, including normalized coefficients, exact/profile-consensus or
  explicitly aggregated numeric
  Quantity invariants, canonical counts, addition, general Quantity products,
  single-boundary rounding, conservative uncertainty/evidence propagation,
  and hashed score-withholding outcomes for unmet result tolerance targets;
- complete package-cohort partition construction and exact reproduction
  verification over the full eligible census, including transitive shared
  support, ordered profile-role tuples, uncertainty-aware invariant windows,
  singleton/global rules, explicit exclusions, and fail-closed key outcomes;
- deterministic complete-cohort selector ranking and exact replay, including
  objective ordering, transitive uncertainty-interval dense ranks, complete
  epsilon extrema, degeneracy, gaps, per-cohort and population-weighted
  variational selectivity, and retained member indeterminacy;
- complete coefficient-sensitivity execution and exact replay, including OAT
  and Cartesian expansion, exact factor/tolerance scaling, full cohort-member
  reevaluation, fail-closed preflight budgets, unreduced stability
  denominators, and robust/fragile/not-applicable/indeterminate outcomes;
- deterministic multi-selector admission and exact replay, including complete
  selector coverage, semantic-extremum intersection, definite-exclusion
  precedence, identity admission, per-selector censuses, and final candidate-
  domain count/ratio reconciliation;
- deterministic selected-formation materialization and exact replay, including
  canonical selected-candidate order, preserved exact/profile constituent
  resolution, complete predicate/functional/selector claim lineage, selection
  witnesses, and unreduced admission-domain count reconciliation;
- deterministic residual-slot profile extraction and derived depth-1
  population replay, including directed capacity consumption, base/residual
  composition, opt-in formation-functional profile invariants with complete
  evaluation lineage, fail-closed guard/capacity/invariant outcomes,
  structural element identity, full provenance, and a separate alternate-
  derivation index;
- local numeric execution for scalar constants, direct constant quantities,
  canonical node/edge counts, exact or compensated scalar structural-attribute
  sums plus SI-normalized Quantity-valued structural-attribute sums with
  explicit approximation state and conservative tolerance/provenance
  aggregation, compatible derived Quantity addition and dimensionless scalar
  scaling, element-exact, strict profile-wide, and explicit numeric profile-
  mean invariant resolution for
  normalized Quantities plus package-authored scalar symbols, candidate-local
  invariant uncertainty from the reproduced source population, scalar and
  Quantity node/edge attribute balance, and
  dimensionless addition/multiplication with boundary-only rounding;
- deterministic single-node or single-edge `irreducibleRemoval` execution
  under the frozen run substructure policy, including canonical nested
  witnesses and explicit empty/disconnected-removal handling;
- deterministic `element-exact` `novel` execution over canonical single-node,
  zero-edge constituent projections with exact source/projection witnesses and
  no profile-representative substitution;
- deterministic role-filtered directed cycle-edge union selection for local
  counts, structural-attribute sums, and balance;
- content-addressed Oracle request binding and response validation for solver,
  parameter, quantity, tolerance, residual, convergence, and evidence
  contracts without solver execution;
- JSON Schemas, TypeScript declarations, catalogue audit, source locks, CI
  configuration, and compatibility fixtures.

External inputs and non-kernel adapters not present:

- source-policy authorship, independent annotation/review for the current
  catalogue, and the resulting reviewed migration artifact set; generic
  reviewed node resolution, SCC condensation, reconciliation diagnostics, and
  the closed package/run binding are implemented;
- remote artifact-store adapters; complete primitive/generalized-depth and
  round-specific current-level null planning, proposal generation,
  occurrence-aware filtering/selection, distributions, and baseline closure
  integration are implemented under ADR-0071 through ADR-0075 and ADR-0080. Generic source-migration
  explanation indexes and bound queries are implemented in the catalogue
  adapter, while the reviewed current-catalogue chain remains an input gate.
  Verified per-level candidate explanation indexes are
  implemented under ADR-0057, integrated final level-result censuses under
  ADR-0058, and semantic run bundles plus externally bound candidate lookup
  under ADR-0059. Atomic local writing and reconstruction are implemented under
  ADR-0060, and separate append-only operational execution records under
  ADR-0062; remote stores remain adapter work, while generic source-migration
  traversal is implemented under ADR-0067.

The schema-v1 kernel capability registry has no pending public operation.
Unsupported configurations and scientific indeterminacy remain explicit
fail-closed result/error branches.

## 3. Dependency direction

```text
applications / CLI / research tooling
                |
                v
catalog adapter / scientific adapter
                |
                v
          @onto2d/kernel
                |
                v
          @onto2d/schemas
```

`@onto2d/kernel` may use supported Node.js built-ins and reviewed general-purpose
libraries. It must not import the catalogue adapter, scientific implementations,
or UI packages.

## 4. Development rules

1. Normalize every semantic default before hashing.
2. Keep generation, hard predicates, and functionals as separate stages.
3. Treat budgets and indeterminate outcomes as first-class states.
4. Preserve complete semantic ties; canonical IDs only stabilize order.
5. Keep derivation depth independent from ontology/catalogue coordinates.
6. Preserve every source relation through the generative quotient or a typed
   explanation layer.
7. Keep scientific computation outside the graph kernel.
8. Add schemas, public types, positive/negative fixtures, and deterministic
   artifact rules with each new contract.
9. Never report an unexecuted or schema-only capability as scientifically
   validated.
10. Do not change reviewed catalogue observations to satisfy desired topology
    or metrics.

## 5. Implementation stages

### Stage D0: foundation conformance

Scope:

- execute canonical JSON, package loader, graph canonicalization, skeleton
  enumeration, CandidateStore, adapter, catalogue, and compatibility tests;
- produce independent canonical-byte fixtures;
- compare skeleton IDs/counts with an independent generator;
- verify Node.js 20 and 22 behavior on supported platforms;
- review binary64 edge cases, Unicode ordering, and explicit resource limits;
- freeze ADR-0003, ADR-0004, and ADR-0005 after conformance evidence exists.

Gate: canonical identities and complete skeleton counts reproduce across
supported environments and independent references.

Current D0 progress: the independent Python canonical-byte/hash and exhaustive
skeleton fixtures reproduce deterministically. Their comparison initially
found non-minimal skeleton representatives at five nodes; the provisional
skeleton identity algorithm was corrected to exhaustive permutation-minimum
labeling. The supported CI matrix now covers Ubuntu, macOS, and Windows on
Node.js 20 and 22. The RFC 8785 binary64 vectors, non-finite rejection,
UTF-16 key ordering, Unicode preservation, and invalid-surrogate cases are
covered explicitly. Local tests, checks, and build pass on macOS arm64 with
Node.js 20.20.2 and 22.23.2. A completed cross-platform CI run and independent
review remain before the D0 gate is accepted.

### Stage D1: quantities and expression IR

Scope:

- implement a versioned unit grammar and dimensional algebra;
- normalize compatible quantities before comparison;
- implement deterministic decimal rounding and accumulation policies;
- define typed value and Boolean expression ASTs;
- infer expression result types, units, and required data;
- implement tolerance-aware comparison;
- validate Oracle request/response binding, convergence, residual, and evidence;
- implement partial-Oracle policies.

Gate: incompatible units fail before execution, all numeric comparisons use
declared tolerance, and Oracle failures propagate as traceable indeterminate
results.

Current D1 progress: `si-multiplicative-v1` parsing, dimensional compatibility,
SI-base normalization, tolerance conversion/comparison, schema integration,
identity-path integration, and `decimal-rational-v1` arithmetic/accumulation are
implemented. `typed-value-expression-v1` now validates and normalizes the value
AST, infers scalar/quantity types and dimensions, records required symbols and
roles, produces expression/analysis hashes, and verifies functional and cohort
dimensions during package loading. `typed-predicate-expression-v1` now
validates and normalizes all declared Boolean operators, type-checks embedded
value comparisons and balances, records witness/data requirements, and derives
only conservative pass/fail persistence. `predicate-plan-v1` binds that
analysis to predicate metadata and blocks pruning when proof or partial data is
absent. `predicate-numeric-binding-v1` verifies a compiled plan, attaches one
normalized run precision policy, explicit canonical summation order, and the
versioned declared-tolerance comparison policy to every numeric operation, then
emits a separate binding hash.
`oracle-protocol-v1` now verifies candidate canonical bytes, normalizes and
hashes scientific requests, validates response request/solver/parameter and
quantity/evidence bindings, keeps failed or disallowed partial work
indeterminate, and applies approved residual-guarded tolerance expansion.
`local-predicate-evaluator-v19` now executes the contract-complete subset of
graph predicates plus scalar/direct-quantity and exact dimensionless
constant/count comparisons plus exact-decimal or compensated-binary64 sums over
finite numeric or Quantity-valued structural attributes. Quantity sums require
matching declared SI units/semantics and conservatively aggregate effective
absolute tolerance plus evidence provenance. Compatible Quantity constants,
sums, and nested additions compose recursively with additive absolute bounds
and computed provenance. A sole Quantity factor may also be scaled by supported
dimensionless number expressions while preserving its unit/semantic and
scaling its absolute bound by the scalar magnitude. In `element-exact`, a
Quantity or package-authored scalar invariant may resolve one unique canonical node
through an explicit source-population context; the artifact binds the
population, element, normalized value, and resolution witness. A
`profile-quotient` invariant additionally defaults to one identical normalized
Quantity or exact scalar across every member. Numeric expressions may opt into
`arithmetic-mean-conservative-v1`, which binds complete membership, run
precision, exact-decimal summation, type/unit/semantic compatibility, and for
Quantities a conservative averaged bound plus rounding coverage and evidence
union. Missing, ambiguous, or incomplete candidate data produces a structured
`indeterminate` witness while malformed contexts and type/unit/semantic drift
remain hard errors.
The same immutable invariant context resolves retained node references inside
`minimal`, `irreducibleRemoval`, `novel`, and `stableUnder`; selectors are
reevaluated after every subgraph canonicalization and values are never
recomputed from a modified graph under ADR-0089.
Accumulation remains
unrounded until the operand boundary and exposes whether it is exact.
Complete node/edge `balance` reuses the same aggregation boundary and compares
the absolute rounded aggregate with its explicit Quantity threshold under the
bound maximum-declared-tolerance policy. Role-filtered cycle sets select every
canonical edge participating in a directed cycle exactly once for count, sum,
or balance under
[ADR-0031](adr/0031-directed-cycle-edge-selection.md). It also executes canonical single-node
or single-edge `irreducibleRemoval`, binds the run substructure policy, and
retains every evaluated or skipped removal with nested witnesses. It also
executes `minimal` by exhaustively enumerating every policy-selected proper
parent-index subgraph, preflighting the exact family size against the shared
10,000-substructure ceiling and retaining selected/effective parent mappings.
It now also executes `novel` for `element-exact` candidates by evaluating the
whole and every canonical single-node, zero-edge constituent projection. The
fixed projection does not require a run substructure policy, preserves exact
source/projection identities and parent mappings, rejects quotient-
representative substitution, and shares the nested 10,000-attempt ceiling.
It also executes exact and seeded sampled `stableUnder` for four typed finite
single-edit classes, retains valid/skipped attempts and parent mappings, and
decides with exact exhaustive fractions or conservative joint 95% sampled
bounds under a hashed perturbation context. Registry-only definitions remain
non-executable. Explicit numeric profile means, explicitly semanticized
general Quantity products, and nested substructure invariants are executable;
the schema-v1 aggregation registry is intentionally closed rather than
awaiting speculative operators. Package-authored scalar invariants now traverse
the loader, primitive/Element model, filter, numeric-functional, and cohort-key
paths under [ADR-0047](adr/0047-package-authored-scalar-invariants.md). These
remaining boundaries are
recorded in [ADR-0030](adr/0030-irreducible-removal-evaluation.md) and
[ADR-0045](adr/0045-exhaustive-minimal-subgraphs.md).
Exact constituent novelty is recorded in
[ADR-0048](adr/0048-exact-constituent-novelty.md).
Exact typed stability is recorded in
[ADR-0049](adr/0049-exhaustive-typed-stability.md).
Seeded sampled stability is recorded in
[ADR-0050](adr/0050-seeded-sampled-stability.md).
Explicit numeric profile aggregation is recorded in
[ADR-0051](adr/0051-explicit-profile-invariant-aggregation.md).
Explicit-semantic local Quantity products are recorded in
[ADR-0052](adr/0052-local-general-quantity-products.md).
Nested substructure invariant resolution is recorded in
[ADR-0089](adr/0089-nested-substructure-invariant-resolution.md).
The closed schema-v1 profile aggregation registry is recorded in
[ADR-0090](adr/0090-schema-v1-profile-aggregation-registry-closure.md).
Closed source-migration package/run binding and the adapter-owned explanation
boundary are recorded in
[ADR-0091](adr/0091-source-migration-package-binding.md) and
[ADR-0092](adr/0092-adapter-owned-source-explanations.md).
Functional coefficient-role and sensitivity coverage closes under
[ADR-0093](adr/0093-functional-coefficient-role-closure.md).

### Stage D2: decorated candidate generation

Scope:

- generate connected simple skeletons under run budget;
- assign node references under the declared counting domain;
- decorate direction, role, multiplicity, loops, and structural attributes;
- canonicalize before insertion into CandidateStore;
- implement safe monotone-violation pruning;
- retain separate raw, pruned, canonical, duplicate, and excluded counts;
- serialize resumable generator state if interruption support is enabled.

Gate: bounded exhaustive fixtures reconcile exactly with brute-force reference
generation; disabling pruning produces the same complete canonical set.

Current D2 progress: `decorated-candidate-enumerator-v5` now re-canonicalizes
and sorts a finite skeleton set, normalizes explicit node/edge variants,
assigns references, direction, roles, structural attributes, parallel-edge
multisets, and enabled self-loops, and admits complete candidates through the
fixed-policy CandidateStore. Raw, directed-connectivity-excluded,
canonicalization-indeterminate, attempted, canonical, and duplicate counts
remain separate. Edge, raw-candidate,
logical-state, unique-candidate, and canonicalization-search boundaries are
explicit; completed bounded fixtures reconcile with direct brute force.
`run-config-normalizer-v2` now materializes the documented run budgets and
normalizes the closed research configuration.
`primitive-depth-population-v1` now replays the loaded package, reproduces each
primitive identity basis and canonical form, emits complete depth-zero
`Element` records, and hashes the sorted population. `package-candidate-binding-v2`
binds that population plus the explicit target/source-depth selection, derives
element/profile node alphabets, profile representatives, the role alphabet,
and every connected skeleton through `maxNodes`, and freezes semantic plus
execution budgets before `package-candidate-generator-v5` invokes the low-level
decorator. The bridge
rejects unsupported disconnected and single-candidate semantics, structural
attributes without compatible package definitions,
wall-time, and memory semantics before enumeration. Generalized derived-depth
population selection is implemented. The opt-in
`package-profile-composition-gate-v1` now enforces complete-candidate role/
polarity capacities and typed partner guards before store admission across
primitive, generalized-depth, and bounded current-level generation, while
indeterminacy aborts the entire generation. Its combination with audited
canonical-prefix and raw-frontier pruning is implemented under ADR-0083 and
ADR-0084. Formation-functional Quantities carry forward through verified
derived `Element` invariants into later-depth candidate attributes under
ADR-0088; direct same-candidate feedback is forbidden.
Package-authored constant and element-invariant scalar/Quantity candidate
attributes are generated and typed under ADR-0078 and ADR-0085;
role-dependent scalar/Quantity edge attributes execute under ADR-0086;
package functionals, evaluated cohort keys, and formation-derived profile
functionals execute typed structural sums under ADR-0087;
selected formation, residual profiles, formation-functional invariant
derivation, formation-derived type classification, typed post-admission partner
guards, and verified depth materialization execute under
ADR-0037/ADR-0038/ADR-0069/ADR-0070/ADR-0079.
`graph-predicate-evaluator-v1` now verifies compiled plans and evaluates the
logical/graph subset on complete canonical candidates.
`package-candidate-filter-evaluator-v20` now reproduces the package and complete
generation binding, re-canonicalizes a candidate, proves domain/budget/
skeleton/variant and edge-group membership in that universe, discloses exact or
profile-representative constituent resolution, reproduces each plan's run
numeric binding, derives profile-invariant inputs from every member of the
complete selected class without using that representative as a value, and
evaluates every graph or supported local-numeric top-level plan, including
exact constituent novelty and exhaustive or seeded sampled typed stability. It emits local
eligibility only; the later admission boundary performs selection, while
derived profile extraction and derived `Element` materialization remain
separate later boundaries now implemented for depth 1 under ADR-0038. This
boundary is recorded in
[ADR-0019](adr/0019-package-candidate-local-filter.md) and extended for
candidate-local invariant uncertainty by
[ADR-0046](adr/0046-scalar-and-indeterminate-invariants.md), with package-
authored scalar values added by
[ADR-0047](adr/0047-package-authored-scalar-invariants.md).
`package-candidate-census-evaluator-v1` now composes complete package
enumeration with the prepared v18 filter session, retains every per-candidate
explanation in canonical ID order, reconciles candidate and predicate counts,
and emits Boolean selectivity plus threshold-bound interpretation. It refuses
budget-exhausted enumeration, precomputes immutable filter lookup indexes once
per session, verifies stored results by exact reproduction, and does not
perform selector admission. This boundary is recorded in
[ADR-0029](adr/0029-complete-local-filter-census.md).
`package-functional-evaluator-v1` now independently reproduces an eligible v18
filter and its binding, then evaluates one normalized finite functional with
canonical counts, coefficients, exact/profile-consensus or explicitly
aggregated numeric Quantity/scalar invariants,
addition, and general Quantity products. It retains unrounded diagnostics,
propagates evidence and conservative interval bounds, rounds once under the
bound run precision, and withholds a score when the declared result tolerance
target is not met. It does not construct cohorts or rank selectors. This
boundary is recorded in
[ADR-0032](adr/0032-package-functional-evaluation.md).
`package-cohort-partitioner-v1` now independently reproduces one complete
census and constructs a total partition under any normalized schema-v1 cohort
rule. It preserves exclusions, uses transitive incidence for shared support,
ordered exact tuples for profile roles, and exact anchored floor bins with
interval containment for invariant windows. Any source or key indeterminacy
emits no partial cohort list. Stored partitions are accepted only through exact
reproduction. This boundary is recorded in
[ADR-0033](adr/0033-complete-cohort-partitioning.md).
`package-selector-ranker-v1` now consumes that exact partition, evaluates every
member through a prepared verified functional session, emits deterministic
dense interval ranks and complete epsilon extrema, and reports degeneracy,
oriented gaps, and variational selectivity. Missing member scores remain in the
artifact and null affected metrics rather than shrinking the denominator. The
stored ranking requires exact reproduction. This boundary is recorded in
[ADR-0034](adr/0034-complete-cohort-functional-ranking.md).
`package-selector-sensitivity-evaluator-v1` now consumes that reproduced base
ranking, expands the full normalized OAT or Cartesian sweep before evaluation,
perturbs coefficient values and absolute tolerances exactly, and reranks every
member of every cohort. Insufficient budgets perform no partial sweep, and any
variant indeterminacy leaves stability ratios null without shrinking the
denominator. Stored reports require exact reproduction. This boundary is
recorded in
[ADR-0035](adr/0035-coefficient-sensitivity-execution.md).
`package-selector-admission-v1` now verifies one complete execution chain for
every normalized selector, intersects semantic-extremum membership over the
unchanged eligible census, preserves definite exclusion and missing
information separately, and reconciles candidate-domain counts and retention.
No-selector packages use explicit identity admission. Stored artifacts require
exact reproduction. This boundary is recorded in
[ADR-0036](adr/0036-multi-selector-admission.md).
`partial-graph-predicate-evaluator-v1` can detect selected statically persistent
failures on bounded partial graphs, but always returns
`pruningAuthorized: false`. `package-predicate-monotonicity-auditor-v1` now
reproduces the complete depth-one universe, samples the frozen complete-node
edge-prefix extension frame, records counterexamples, and exactly verifies the
artifact. `package-partial-pruning-controller-v1` separately authorizes only a
passed statically proven persistent failure. A prepared controller session and
`package-pruned-candidate-generator-v1` now apply those decisions before
CandidateStore admission, reconcile raw/unique/duplicate removals, confirm
every removal against complete local filtering, and require identical
pruning-enabled/disabled eligible and indeterminate result hashes. Recursive
raw edge-group branch closure now uses a separate actual-frontier
audit/controller, exact skipped-subtree census, and three-mode differential
gate. Directed-strong traversal is authorized only at already strongly
connected frontiers. The generalized depth-aware contract additionally binds
and exactly replays the target depth, source-population selection, and complete
prior-level chain. The low-level traversal now exposes exact strict
incomplete-node frontiers and descendant counts, plus portable verified
replay-resumable steps. ADR-0082 adds an independently framed node-prefix
audit/controller and exact differential-conformance generation at depth one
and arbitrary verified target depths, while keeping directed-strong prefixes
fail-closed.
These boundaries are recorded in
[ADR-0017](adr/0017-graph-predicate-evaluation.md) and
[ADR-0053](adr/0053-monotonicity-audit-and-pruning-controller.md), followed by
[ADR-0054](adr/0054-audited-pre-admission-pruning.md), followed by
[ADR-0055](adr/0055-audited-recursive-frontier-pruning.md), followed by
[ADR-0056](adr/0056-generalized-depth-audited-pruning.md),
[ADR-0081](adr/0081-node-frontiers-and-replay-resumable-enumeration.md), and
[ADR-0082](adr/0082-audited-node-growth-pruning.md).

### Stage D3: source classification and condensation

Current milestone: the closed, content-addressed policy-freeze contracts are
implemented under [ADR-0012](adr/0012-source-policy-freeze-contracts.md), and
the complete independent-annotation/adjudication artifact contracts are
implemented under
[ADR-0013](adr/0013-source-classification-annotation-artifacts.md). They
validate authorship/exposure claims, complete relation/disposition rule sets,
forbidden inputs/criteria, complete annotation matrices, preserved
disagreement, ordered unblinding, risk thresholds, and reconciliation
invariants. No actual current-catalogue policy, annotation, classification, or
reviewed resolution has been authored.

The adapter foundation is implemented under
[ADR-0014](adr/0014-classified-relations-and-scc-projections.md): it constructs
the frozen visible relation payload, verifies the complete annotation chain,
preserves every supplied relation exactly once, and computes the generative
and formation-support SCC partitions. ADR-0061 through ADR-0068 add complete
isolated-node reconciliation, reviewed dispositions, lossless condensation,
reconciliation, metrics, explanations, and concentration. ADR-0091 now binds
that complete chain and condensed-cluster primitives into kernel packages and
verified run artifacts. These mechanisms have not been applied to the current
catalogue because their reviewed scientific inputs do not yet exist.

Scope:

- author reviewed frozen relation-policy content and exposure declarations
  using the implemented artifact contract;
- collect actual independent classifications and blind adjudication records
  using the implemented artifact contracts;
- apply the implemented classified-relation/SCC projector to actual reviewed
  catalogue annotations;
- apply general node-resolution criteria;
- materialize cluster elements, member projections, and typed relation layers;
- recompute the condensation quotient and require a DAG;
- reconcile every source node and edge exactly once;
- emit fitting-risk and cluster-distribution metrics.

Gate: all 249 catalogue cards and every parent relation reconcile without edge
loss, fabricated precedence, or post-hoc hidden relabelling.

### Stage D4: predicates, cohorts, ranking, and sensitivity

Current D4 progress: complete local predicate evaluation/census, the
post-filter finite functional evaluator, total cohort partitioning, and
complete dense functional ranking and coefficient sensitivity are implemented.
Deterministic multi-selector admission now completes the finite selection
chain. Selected-formation materialization now preserves the exact provenance
input without collapsing candidate-domain counts. Residual-slot profiles and
all-or-nothing derived depth-1 materialization now complete the first D5
materialization slice. The primitive-to-depth-1 coordinator and generalized
target-depth coordinator now integrate that chain with whole-level budget
preflight and exact replay. Arbitrary-depth source selection, candidate
enumeration, local filtering/census, cohort/ranking/sensitivity/admission, and
formation/profile/population materialization are implemented over a contiguous
verified level chain. An explicit bounded ladder now executes those transitions
until its requested depth, an element fixpoint, or indeterminacy. Bounded
exact-versus-profile collapse conformance and frozen-interval level-boundary
detection execute over those ladders with exact replay. Explicit carrier
promotion now emits evidence-bound target-package primitive inputs without
mutating source elements. Bounded current-level closure now executes explicit
monotone rounds and ladder dispatch with exact replay, withheld final
populations on exhaustion, and hard iteration bounds. Generalized depth-aware
audited pre-admission and raw-frontier recursive pruning now execute against
any verified contiguous target-depth chain. Integrated final level-result
censuses now reconcile every ordinary/depth-aware closure under ADR-0058.
Formation-functional structural data carries across the acyclic derived-
element boundary under ADR-0088. Profile-gated raw-frontier subtree pruning is
closed under ADR-0084.
Exact node-growth accounting and replay-resumable traversal are implemented
under ADR-0081, audited node-growth pruning under ADR-0082, and round-carrier
null execution for current-level fixpoints under ADR-0080.
The complete carrier/gate/stream execution plan, all three proposal populations,
occurrence-local filtering, full occurrence-aware selection, per-model
distributions, and integrated primitive/generalized-depth baselines are
implemented under ADR-0071 through ADR-0075.
Formation-functional profile invariant
derivation is implemented under ADR-0069, and tolerance-aware formation-derived
type classification is implemented under ADR-0079.

Scope:

- implement predicate phases and complete three-valued evaluation;
- emit canonical witnesses and per-predicate census data;
- implement shared-support, profile-role, invariant-window, singleton, and
  explicit global cohorts;
- evaluate typed finite functionals only after local filtering;
- emit dense rankings, complete epsilon extrema, degeneracy, gaps, and reasons;
- implement deterministic one-at-a-time and budgeted Cartesian sensitivity;
- propagate missing or failed values without silently reducing cohorts.

Gate: every evaluated candidate has a complete explanation, rankings preserve
all semantic ties, and sensitivity denominators reconcile with required
perturbation variants.

### Stage D5: profiles and closure

Current D5 progress: `package-selected-formations-v1` reproduces census and
admission and emits one hash-bound provenance basis per definitely selected
candidate. `package-derived-profile-extractor-v3` executes the opt-in residual-
slot hypothesis, formation-functional invariant extension, and v3 type rules;
`package-derived-depth-population-v3` emits complete
derived depth-1 elements plus a separate derivation index or no partial
population under profile indeterminacy. `package-level-closure-v1` now executes
and hashes the complete primitive-to-depth-1 chain, aggregates work budgets
across all selectors, preserves complete/empty/indeterminate terminals, and
executes the complete configured null-model chain through per-model baselines.
`package-depth-source-selector-v2` verifies every contiguous prior level and
executes `all-below`/`previous-only` source selection for explicit target depths
up to 64. The depth-aware binder, generator, filter, census, cohort, ranking,
sensitivity, admission, formation, profile, and population boundaries reuse
the same verified selection semantics at every target. `package-depth-level-
closure-v1` integrates one such transition, while `package-ladder-closure-v1`
executes and exactly replays the bounded sequence and cross-depth index.
`package-current-level-fixpoint-closure-v2` and `package-fixpoint-ladder-
closure-v1` execute the separately opted-in current-level round protocol. Each
round executes configured null models over its own exact census carrier and
publishes a replayable baseline under ADR-0080.
`package-profile-collapse-evaluator-v1` projects exact/profile candidate
universes into one canonical profile domain, compares final admission and
observable verdicts, and preserves the smallest mismatch. `package-level-
boundary-detector-v1` applies frozen search intervals, maximum error, and tie
tolerance without mutating declared ontology coordinates. `package-carrier-
promotion-materializer-v1` replays the ladder and collapse basis, enforces
non-empty profiles plus claim/evidence and cross-level coordinate policy, and
emits immutable target-package primitive inputs with explicit counterexample
disposition.

Scope:

- extract normalized profiles from admitted elements;
- group deterministic profile classes and representatives;
- compare profile-quotient and element-exact outcomes;
- detect declared ontology-level boundaries without conflating depth;
- emit explicit carrier-promotion artifacts;
- generalize level closure beyond the primitive depth-0 source and implement
  ladder state machines;
- support bounded fixpoint mode only under explicit configuration;
- persist alternate derivations outside structural element identity.

Gate: every closed depth has a stable `depthBasis`, complete interpretation
status, reproducible counts, and no current-depth self-reference outside the
bounded fixpoint contract.

### Stage D6: controls, artifacts, and research cases

Scope:

- implement seeded role-shuffle, degree-rewire, and uniform controls;
- report mixing/acceptance diagnostics and degenerate null variance;
- emit semantic manifests, normalized packages/configs, level results,
  explanations, indexes, and operational logs;
- bind predictions to run hashes before execution;
- implement the Level-0 oscillator case from the foundational paper;
- add independently sourced motif comparison only when dataset and graph
  conventions are frozen.

Gate: repeated identical semantic inputs produce byte-identical semantic
artifacts; operational metadata does not contaminate semantic hashes.

### Stage D7: integration and release

Scope:

- provide stable package exports and versioned schema publication;
- add CLI/application consumers without reversing dependencies;
- expand browser and platform compatibility coverage where required;
- document versioning and migration rules for canonical identities;
- define performance reference environments and benchmark reports;
- publish only capabilities backed by executed conformance evidence.

Gate: package APIs, schemas, artifacts, tests, and documentation describe the
same implemented behavior on every supported environment.

## 6. Work packages

| ID | Work | Depends on | Primary evidence |
|---|---|---|---|
| HASH-01 | Independent canonical bytes and domain hashes | D0 | cross-implementation fixtures |
| GRAPH-01 | Candidate/skeleton canonicalization conformance | HASH-01 | permutation and negative pairs |
| GEN-01 | Decorated candidate generator | GRAPH-01 | exhaustive bounded reconciliation |
| UNIT-01 | Unit grammar and conversion | HASH-01 | dimensional positive/negative fixtures |
| EXPR-01 | Typed expression analyzer | UNIT-01 | type/unit truth tables |
| ORACLE-01 | Oracle protocol verifier | UNIT-01 | convergence/residual fixtures |
| DATA-01 | Frozen relation classifier | HASH-01 | blinded/deterministic annotation artifact |
| DATA-02 | Node resolution and SCC condensation | DATA-01 | edge/member reconciliation |
| PRED-01 | Three-valued predicate evaluator | EXPR-01, GEN-01 | witnesses and full census |
| SELECT-01 | Cohorts and ranking | PRED-01, UNIT-01 | complete ranked cohorts |
| SENS-01 | Coefficient sensitivity | SELECT-01 | robust/fragile/indeterminate fixtures |
| PROFILE-01 | Profile extraction and collapse | SELECT-01 | quotient/exact comparison |
| CLOSE-01 | Level and ladder closure | PROFILE-01 | deterministic level artifacts |
| STATS-01 | Primitive/generalized-depth null execution and baselines implemented; current-level round carrier pending | CLOSE-01 | seeded control fixtures |
| CASE-01 | Level-0 oscillator case | ORACLE-01, CLOSE-01 | paper-traceable case artifacts |
| ART-01 | Manifests and explanation index | all emitting stages | byte-stable artifact set |

## 7. Test strategy

Unit tests cover:

- canonicalization, hashes, units, tolerances, and error contracts;
- graph refinement, individualization, connectivity, multiplicity, and budgets;
- SCC discovery, condensation, edge conservation, and depth inheritance;
- expression typing, predicate truth tables, and witnesses;
- cohort partitions, ranking, degeneracy, gaps, and sensitivity;
- null-model carrier/gate/stream planning, sampling, statistics, and
  interpretation status.

Property tests cover:

- invariance to input ordering and graph permutations;
- alternate-derivation identity stability;
- edge/member conservation under condensation;
- pruning equivalence against pruning disabled;
- deterministic seeded randomness;
- serialization round trips.

Differential tests compare:

- canonical labels with an independent implementation;
- skeleton enumeration with an independent graph generator;
- optimized SCCs with a simple reference algorithm;
- pruned generation with brute-force bounded generation;
- unit conversion with reviewed dimensional fixtures.

Integration tests cover complete package loading, one closed level, multi-depth
closure, Oracle failure propagation, source condensation, and artifact
reconstruction from manifests.

Local run-directory reconstruction from canonical verified bundle envelopes
and exact referenced bytes is implemented under
[ADR-0060](adr/0060-verified-run-directory-persistence.md). Source-condensation
package and run integration is implemented under ADR-0091; only the reviewed
current-catalogue inputs remain gated as described below.

Generic isolated-node reconciliation and lossless typed condensation now replay
the entire supplied classification chain and reviewed decisions under
[ADR-0061](adr/0061-reviewed-source-resolution-and-condensation.md). Applying
that mechanism to the current catalogue remains a research-data gate, not a
kernel default.

Operational execution metadata is now stored independently of semantic bundle
identity under
[ADR-0062](adr/0062-append-only-operational-execution-records.md). The local
adapter verifies the complete run first, binds every record to its `runHash`,
publishes canonical bytes without overwrite, and accepts no other directory
overlay.

Generic raw-SCC, typed-edge, descriptive/nonformation resolution, cluster-share,
available risk-signal, and node/edge/DAG reconciliation diagnostics are
implemented under
[ADR-0063](adr/0063-source-migration-reconciliation-diagnostics.md). Immutable
post-unblinding log freezing and threshold accounting are implemented under
ADR-0064. Separate effective projection, SCC recomputation, and amendment-aware
resolution/condensation replay are implemented under
[ADR-0065](adr/0065-effective-source-classification-reprojection.md). Full
disposition- and source-level-aware migration metrics are implemented under
[ADR-0066](adr/0066-complete-source-migration-metrics.md). Concentration still
requires caller-supplied independently frozen bottleneck/depth inputs, but its
generic computation and fail-closed exposure checks are implemented under
[ADR-0068](adr/0068-source-cluster-concentration.md). Actual execution still
requires the current-catalogue research inputs.
Verified per-node, per-relation, and per-raw-SCC lineage plus bound query
snapshots are implemented under
[ADR-0067](adr/0067-source-migration-explanation-index.md).

## 8. Acceptance gates

Engineering acceptance requires:

- byte-stable semantic artifacts across supported environments;
- exact canonical candidate/skeleton agreement with independent references;
- complete budget/count reconciliation;
- no silent `indeterminate` coercion;
- no source node or edge loss;
- no dependency reversal into the kernel;
- schema/type/runtime agreement;
- executed tests for every published capability.

Research-case acceptance additionally requires:

- content-addressed evidence and method identities;
- frozen quantities, cohorts, selectors, thresholds, seeds, and null models;
- complete per-candidate and per-cohort explanations;
- explicit distinction between computational reproduction and empirical support;
- publication of outcomes that weaken a hypothesis as faithfully as outcomes
  that support it.

## 9. Immediate next implementation slice

The independent canonical-byte/hash and exhaustive skeleton fixtures are now
frozen, with regeneration isolated from the JavaScript kernel. Their Python
generation, deterministic replay, and local Node.js 20/22 comparisons have
completed. The comparison caught and drove correction of provisional skeleton
bytes before the identity baseline was accepted.

The binary64/Unicode audit, predicate numeric-policy binding, and Oracle
protocol validation are implemented locally. Finite decorated-candidate
enumeration now also passes bounded differential tests. The remaining immediate
work is:

1. Obtain cross-platform CI and independent-review evidence for the frozen
   canonical and skeleton fixtures.
2. Accept ADR-0003 through ADR-0005 after that evidence is reviewed.
3. Author and freeze the actual source-classification/node-resolution policies,
   then collect independent annotations and reviewed dispositions before
   processing SCC-aware current-catalogue output through the implemented
   reconciliation engine.

The external inputs and follow-up work are enumerated in
[KERNEL_IMPLEMENTATION_STATUS.md](KERNEL_IMPLEMENTATION_STATUS.md#external-inputs-and-follow-up-project-work).

## 10. Post-completion visualization gate

`POST-CLOSURE-VIS-01` is a required follow-up gate, not an optional project
idea. As soon as the complete kernel closure gate and all required execution
dependencies meet the acceptance criteria in this plan, the project MUST
freeze at least one complete reproducible case and publish a clear visual
presentation of the kernel's computed result. The presentation MUST be
generated from verified run
artifacts rather than manually copied values, expose the run/rules/result
hashes and scope limitations, and show concrete candidates, verdict witnesses,
selectivity, and the admitted closure. GitHub Pages is the preferred static
publication target. Work on this gate starts after the closure implementation
is complete so it does not displace the remaining kernel work.

The machine-readable contract in
`test/fixtures/kernel-closure-gate-v1.json` and `npm run check:closure` prevent
the empty pending registry, frozen independent fixtures, required CI matrix,
independent-review requirement, or this visualization gate from drifting
silently. This contract records required evidence; it does not claim that
external CI or independent review has already completed.
`test/fixtures/kernel-capability-evidence-v1.json` additionally maps every one
of the 195 published capabilities to a primary behavioral suite. The closure
check requires exact registry coverage without duplicates and verifies the
current 372 mapped kernel test declarations before CI executes them.
