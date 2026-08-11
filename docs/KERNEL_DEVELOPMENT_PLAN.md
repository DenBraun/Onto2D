# Onto2D Kernel Development Plan

Status: active implementation plan for the target defined in
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
- local numeric execution for scalar constants, direct constant quantities,
  canonical node/edge counts, exact or compensated scalar structural-attribute
  sums plus SI-normalized Quantity-valued structural-attribute sums with
  explicit approximation state and conservative tolerance/provenance
  aggregation, compatible derived Quantity addition and dimensionless scalar
  scaling, element-exact Quantity invariant resolution plus strict identical-
  Quantity profile consensus from the reproduced source population, scalar and
  Quantity node/edge attribute balance, and
  dimensionless addition/multiplication with boundary-only rounding;
- content-addressed Oracle request binding and response validation for solver,
  parameter, quantity, tolerance, residual, convergence, and evidence
  contracts without solver execution;
- JSON Schemas, TypeScript declarations, catalogue audit, source locks, CI
  configuration, and compatibility fixtures.

Not implemented:

- derived-depth population binding and selected formation/profile
  materialization artifacts, derived decoration attributes, profile
  guards/capacities, and safe partial pruning;
- scalar and non-identical profile invariant semantics, functional/coefficient
  execution, general Quantity products, cycle-set selection, remaining value-expression
  execution, and substructure predicates;
- cohort construction, functional evaluation, ranking, and sensitivity;
- source classification, node resolution, and SCC condensation execution;
- profile extraction/collapse, level-boundary detection, and carrier promotion;
- level/ladder closure, null models, explanation indexes, and run artifacts.

Public operations for unavailable capabilities fail with
`KERNEL_NOT_IMPLEMENTED`.

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
Node.js 20.19.4 and 22.18.0. A completed cross-platform CI run and independent
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
`local-predicate-evaluator-v9` now executes the contract-complete subset of
graph predicates plus scalar/direct-quantity and exact dimensionless
constant/count comparisons plus exact-decimal or compensated-binary64 sums over
finite numeric or Quantity-valued structural attributes. Quantity sums require
matching declared SI units/semantics and conservatively aggregate effective
absolute tolerance plus evidence provenance. Compatible Quantity constants,
sums, and nested additions compose recursively with additive absolute bounds
and computed provenance. A sole Quantity factor may also be scaled by supported
dimensionless number expressions while preserving its unit/semantic and
scaling its absolute bound by the scalar magnitude. In `element-exact`, a
Quantity invariant may resolve one unique canonical node through an explicit
source-population context; the artifact binds the population, element, source
Quantity, and resolution witness. A `profile-quotient` invariant additionally
resolves when every member supplies one identical normalized Quantity; its
profile hash, complete member set, and consensus policy enter the witness.
Accumulation remains
unrounded until the operand boundary and exposes whether it is exact.
Complete node/edge `balance` reuses the same aggregation boundary and compares
the absolute rounded aggregate with its explicit Quantity threshold under the
bound maximum-declared-tolerance policy. Scalar and non-identical profile
invariant semantics, functional/coefficient execution, general Quantity products,
cycle-set selection, and substructure execution remain.

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

Current D2 progress: `decorated-candidate-enumerator-v1` now re-canonicalizes
and sorts a finite skeleton set, normalizes explicit node/edge variants,
assigns references, direction, roles, structural attributes, parallel-edge
multisets, and enabled self-loops, and admits complete candidates through the
fixed-policy CandidateStore. Raw, directed-connectivity-excluded,
canonicalization-indeterminate, attempted, canonical, and duplicate counts
remain separate. Edge, raw-candidate,
logical-state, unique-candidate, and canonicalization-search boundaries are
explicit; completed bounded fixtures reconcile with direct brute force.
`run-config-normalizer-v1` now materializes the documented run budgets and
normalizes the closed research configuration.
`primitive-depth-population-v1` now replays the loaded package, reproduces each
primitive identity basis and canonical form, emits complete depth-zero
`Element` records, and hashes the sorted population. `package-candidate-binding-v1`
binds that population plus the explicit target/source-depth selection, derives
element/profile node alphabets, profile representatives, the role alphabet,
and every connected skeleton through `maxNodes`, and freezes semantic plus
execution budgets before `package-candidate-generator-v1` invokes the low-level
decorator. The bridge
rejects unsupported disconnected, single-candidate, structural-attribute,
wall-time, and memory semantics before enumeration. Derived-depth population
selection, selector admission, selected formation/profile materialization,
profile guards/capacities, and derived attributes remain pending.
`graph-predicate-evaluator-v1` now verifies compiled plans and evaluates the
logical/graph subset on complete canonical candidates.
`package-candidate-filter-evaluator-v10` now reproduces the package and complete
generation binding, re-canonicalizes a candidate, proves domain/budget/
skeleton/variant and edge-group membership in that universe, discloses exact or
profile-representative constituent resolution, reproduces each plan's run
numeric binding, derives profile-invariant inputs from every member of the
complete selected class without using that representative as a value, and
evaluates every graph or supported local-numeric top-level plan. It emits local
eligibility only; selector admission, derived
profile extraction, and derived `Element` materialization remain pending. This
boundary is recorded in
[ADR-0019](adr/0019-package-candidate-local-filter.md).
`package-candidate-census-evaluator-v1` now composes complete package
enumeration with the prepared v10 filter session, retains every per-candidate
explanation in canonical ID order, reconciles candidate and predicate counts,
and emits Boolean selectivity plus threshold-bound interpretation. It refuses
budget-exhausted enumeration, precomputes immutable filter lookup indexes once
per session, verifies stored results by exact reproduction, and does not
perform selector admission. This boundary is recorded in
[ADR-0029](adr/0029-complete-local-filter-census.md).
`partial-graph-predicate-evaluator-v1` can detect selected statically persistent
failures on bounded partial graphs, but always returns
`pruningAuthorized: false`. A versioned monotonicity-audit/controller artifact,
generator integration, pruning census, pruning-disabled differential
conformance, and optional resumable state remain pending. This boundary is
recorded in [ADR-0017](adr/0017-graph-predicate-evaluation.md).

### Stage D3: source classification and condensation

Current milestone: the closed, content-addressed policy-freeze contracts are
implemented under [ADR-0012](adr/0012-source-policy-freeze-contracts.md), and
the complete independent-annotation/adjudication artifact contracts are
implemented under
[ADR-0013](adr/0013-source-classification-annotation-artifacts.md). They
validate authorship/exposure claims, complete relation/disposition rule sets,
forbidden inputs/criteria, complete annotation matrices, preserved
disagreement, ordered unblinding, risk thresholds, and reconciliation
invariants. No actual catalogue policy, annotation, classification, or node
resolution has been authored or executed.

The next adapter foundation is implemented under
[ADR-0014](adr/0014-classified-relations-and-scc-projections.md): it constructs
the frozen visible relation payload, verifies the complete annotation chain,
preserves every supplied relation exactly once, and computes the generative
and formation-support SCC partitions. It has not been applied to the current
catalogue, and isolated-node reconciliation, node dispositions, and
condensation remain pending.

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

Scope:

- extract normalized profiles from admitted elements;
- group deterministic profile classes and representatives;
- compare profile-quotient and element-exact outcomes;
- detect declared ontology-level boundaries without conflating depth;
- emit explicit carrier-promotion artifacts;
- implement level closure and ladder state machines;
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
| STATS-01 | Null models and distributions | CLOSE-01 | seeded control fixtures |
| CASE-01 | Level-0 oscillator case | ORACLE-01, CLOSE-01 | paper-traceable case artifacts |
| ART-01 | Manifests and explanation index | all emitting stages | byte-stable artifact set |

## 7. Test strategy

Unit tests cover:

- canonicalization, hashes, units, tolerances, and error contracts;
- graph refinement, individualization, connectivity, multiplicity, and budgets;
- SCC discovery, condensation, edge conservation, and depth inheritance;
- expression typing, predicate truth tables, and witnesses;
- cohort partitions, ranking, degeneracy, gaps, and sensitivity;
- null-model sampling, statistics, and interpretation status.

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
3. Extend the implemented local numeric filter with scalar and non-identical
   profile invariant semantics, functional/coefficient execution, general Quantity products,
   cycle-set and substructure verdicts, selector
   admission, and deterministic derived-profile formation;
   materialize verified derived closure-depth populations; then add the
   monotonicity-audit/controller artifact, pruning integration, and
   pruning-disabled differential checks.
4. Freeze source-classification and node-resolution policies before processing
   SCC-aware catalogue output.
