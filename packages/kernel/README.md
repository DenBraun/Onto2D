# `@onto2d/kernel`

This package is the dependency-free boundary of the Onto2D closure kernel. Its
implemented foundation provides:

## Install and first identity

The package is ESM-only and requires Node.js 22 or newer.

```sh
npm install @onto2d/kernel
```

```js
import { canonicalizeCandidate } from "@onto2d/kernel";

const ref = `sha256:${"a".repeat(64)}`;
const result = canonicalizeCandidate({
  domain: "element-exact",
  nodes: [{ ref }, { ref }],
  edges: [{ from: 0, to: 1, role: "supports" }]
});

console.log(result.candidateId);
```

`canonicalizeCandidate()` is the smallest useful entrypoint. Use
`createKernel()` for the complete configured facade. Invalid or incomplete
semantic inputs fail closed with the exported kernel error contracts.

## Implemented boundary

- guarded canonical JSON with deterministic limits;
- domain-separated SHA-256 content identities;
- versioned model and error contracts;
- deterministic package defaults and normalization;
- structural, reference, quantity, profile, stratification, cohort, selector,
  and ontology-axis validation;
- primitive element IDs, profile hashes, rules hash, identity-policy hash, and
  depth-basis hash;
- exact supplied-candidate and policy-independent simple-skeleton
  canonicalization;
- bounded connected-unlabeled skeleton enumeration through six nodes;
- deterministic finite decoration of skeletons with node references, edge
  directions/roles, parallel multiplicity, self-loops, and structural
  attributes under explicit raw/state/canonical budgets;
- closed RunConfig normalization with documented budget materialization;
- verified materialization of normalized primitives as complete depth-0
  `Element` records with reproduced canonical forms, axis provenance, and a
  domain-separated population hash;
- content-addressed package/run candidate binding that reproduces loaded
  package identity, binds the materialized primitive population and depth
  selection, derives element/profile alphabets and representatives, binds roles
  and connected skeletons, and executes the resulting finite universe under
  explicit semantic and execution budgets;
- package-driven finite scalar and Quantity candidate attributes, with constant
  node/edge values, element-invariant exact node values, SI normalization,
  complete candidate provenance, and complete profile-class consensus before
  quotient generation;
- role-dependent scalar/Quantity edge attributes with homogeneous closed maps
  and complete coverage of every selected run role;
- an opt-in, identity-bearing complete-candidate composition gate shared by
  primitive, arbitrary-depth, and bounded current-level generation, with exact
  role/polarity capacity consumption, complete-profile-class typed partner
  guards, separate exclusion counts, decision transcripts, and fail-closed
  indeterminacy;
- a fixed-domain CandidateStore with deterministic deduplication and explicit
  completion/budget state;
- a versioned multiplicative SI unit grammar, canonical quantity conversion,
  exact terminating-decimal SI scale application, and tolerance-aware quantity
  comparison;
- canonical exact decimals, declared rounding, rounded division, and exact or
  compensated accumulation with a separately inspectable unrounded artifact;
- recursive typed value-expression normalization, dimensional inference,
  dependency extraction, and content-addressed analysis;
- package-load checks that expression dimensions match functional and cohort
  quantity contracts;
- strict Boolean predicate analysis with typed comparisons, dimensional
  balances, graph/data/witness requirements, and conservative pruning facts;
- content-addressed predicate plans emitted by package loading;
- a deterministic complete-universe monotonicity audit, prepared fail-closed
  pruning controller, and pre-admission generator path with reconciled
  raw/unique/duplicate pruning counts and exact pruning-disabled post-filter
  conformance;
- an independently framed raw generator-frontier audit and prepared
  controller, with exact recursive subtree counts, retained pre-admission
  guards, three-mode differential conformance, and replay verification, plus
  a separate depth-aware contract that binds arbitrary target depth, exact
  source-population selection, and the complete contiguous prior-level chain;
- an independent raw node-prefix audit and prepared controller, with exact
  descendant-count validation and differential node-growth generation at depth
  one and arbitrary verified target depths; directed-strong node prefixes stay
  fail-closed because their final policy-exclusion census is not yet fixed;
- exact profile-slot-gate-before-pruner execution for canonical-prefix pre-
  admission pruning, with complete composition transcript replay and disabled-
  pruning result-set conformance at depth one and arbitrary target depths;
- exact profile-extension censuses for raw edge-group and node-assignment
  frontiers, with separately reconciled compatible/excluded descendants and
  profile-gated recursive/node-growth conformance at both depths;
- verified, content-addressed complete graph-predicate evaluation with
  canonical witnesses, plus conservative partial persistent-failure detection
  that always denies pruning authority;
- verified package-bound local filtering that reproduces the loaded package and
  run binding under an independently expected kernel version, proves candidate-
  universe membership, rejects unavailable predicate attributes, discloses
  exact/profile constituent resolution, and evaluates every graph or locally
  executable numeric top-level predicate under a reproduced numeric binding;
- verified complete local-filter census construction over the full canonical
  package candidate universe, with every filter artifact, reconciled Boolean
  selectivity and indeterminate ratios, exclusive rejection attribution, and
  inert/dominating predicate diagnostics; truncated enumeration is rejected,
  and stored artifacts can be verified by exact deterministic reproduction;
- verified null-model planning over primitive, depth-aware, or current-round complete census
  carriers, with explicit ontology gates, per-model preservation contracts,
  bounded independent trial streams, and a truthful `planned` state that is
  distinct from baseline execution;
- deterministic carrier-size role-shuffle, degree-rewire, and exact-uniform
  proposal generation with complete-carrier membership, retained duplicate
  occurrences, swap/mixing diagnostics, bounded work, and exact replay;
- occurrence-aware primitive/depth/current-round null-trial filtering with retained sample
  multiplicity, full filter artifacts, reconciled Boolean selectivity and
  per-predicate censuses, and exact aggregate replay;
- occurrence-aware primitive/depth/current-round null-trial cohort construction, functional
  scoring, selector extrema, coefficient sensitivity, and final admission,
  with replacement duplicates retained as distinct members and exact replay;
- verified per-model primitive/depth/current-round null distributions with fixed-order
  compensated statistics, explicit missing/fragile/one-run/zero-variance
  states, standardized effects where defined, and ordinary/depth closure
  integration of the complete reproducible sample chain;
- verified package-bound finite functional evaluation that reproduces the
  eligible filter and binding before execution, resolves canonical counts,
  scalar/Quantity structural-attribute sums, coefficients,
  exact/profile-consensus or explicitly aggregated numeric Quantity/scalar
  invariants, addition, and
  general Quantity products, propagates evidence plus conservative interval
  bounds, rounds once under the run precision, and emits a hashed scored or
  indeterminate result according to the declared tolerance target;
- verified complete package-cohort partitioning that exactly reproduces its
  census input, separates rejected and filter-indeterminate candidates,
  constructs total shared-support, profile-role, invariant-window, singleton,
  or global partitions, and verifies stored artifacts by deterministic replay;
- verified complete-cohort selector ranking that evaluates every member,
  closes score-uncertainty ties transitively, preserves complete epsilon
  extrema, reports degeneracy/gap/variational metrics, retains unscoreable
  members, and verifies stored rankings by deterministic replay;
- verified selector coefficient sensitivity that replays the base ranking,
  preflights complete OAT/Cartesian variant counts, scales coefficient values
  and absolute tolerances, reevaluates every member, and binds complete
  stability denominators and robust/fragile/indeterminate outcomes;
- deterministic all-selector admission that verifies every declared execution
  chain, intersects complete semantic-extremum sets, preserves definite
  exclusions and indeterminacy, and reconciles final candidate-domain counts;
- verified selected-formation materialization that reproduces admission,
  preserves canonical candidate and exact/profile constituent provenance,
  binds selection witnesses and claim evidence, and deliberately defers
  derived profile and `Element` identity;
- deterministic residual-slot profile extraction with directed endpoint
  capacity consumption, explicit base-profile composition, typed partner
  guards over complete profile classes, and fail-closed legacy/missing/
  member-dependent or capacity outcomes, plus opt-in formation-functional
  profile invariants with complete evaluation lineage and all-or-nothing
  failure, followed by tolerance-aware formation-derived type rules whose
  assigned tags retain their source-functional and comparison lineage;
- verified derived `Element` population materialization with structural
  identity separated from evidence, complete formation provenance, canonical
  alternate-derivation indexing, all-or-nothing profile completeness, and
  normalized run-target ontology coordinates whose identity effect remains
  controlled by the loaded policy;
- verified primitive-to-derived-depth-1 package closure with whole-level
  selector budget preflight, run/result hashes, embedded stage artifacts,
  explicit complete/empty/indeterminate terminals, and exact replay;
- verified arbitrary-target-depth source-population selection and depth-aware
  candidate binding/enumeration/filter/census/selection/materialization with
  executable `all-below` versus `previous-only` semantics and complete
  contiguous prior-level replay;
- verified generalized target-depth level closure and explicit bounded ladder
  closure with exact reproduction, minimum-depth/all-appearance indexing,
  per-depth selectivity and execution records, and deterministic requested-
  depth, fixpoint, or indeterminate termination;
- verified ordinary/depth-aware level explanation indexes that reproduce the
  complete level first, reconcile one entry per evaluated candidate, retain
  filter/admission/formation/profile/derived-element lineage, and emit hashed
  candidate explanation snapshots;
- verified integrated level-result censuses that reproduce ordinary or
  depth-aware closures, reconcile every final candidate/profile/element count,
  and expose complete predicate/selector selectivity views under a separate
  content hash;
- verified run artifact bundles that reproduce complete level chains, freeze
  semantic manifests and normalized inputs, materialize exact canonical bytes,
  and provide unique runHash-indexed stores for bound candidate explanations;
- a filesystem-free bundle contract consumed by the separate
  `@onto2d/run-store` adapter for atomic exact run-directory publication;
- verified bounded current-level fixpoint closure and ladder dispatch with
  explicit package/run opt-ins, selected below-depth plus previous-current
  sources, monotone canonical-element accumulation, complete per-round
  artifacts and baselines, independent round-carrier null execution, explicit
  convergence/exhaustion, terminal baseline projection, and exact replay;
- verified bounded exact-versus-profile collapse testing with canonical
  profile projection, complete admission/observable comparison, explicit
  symmetric-difference error, smallest counterexamples, and exact replay;
- verified level-boundary detection over frozen intervals, maximum collapse
  error and tie tolerance, with declared/detected comparison and no coordinate
  mutation;
- verified carrier-promotion materialization from an exactly replayed ladder
  and collapse report, with non-empty profiles, claim/evidence binding,
  explicit counterexample disposition, immutable source identity, loadable
  target-package primitive inputs, and exact artifact replay;
- verified mixed graph/compare evaluation for scalar constants, direct
  constant quantities, structural node/edge counts, exact or compensated
  scalar and Quantity-valued structural-attribute sums with disclosed
  approximation state and conservative quantity-tolerance/provenance
  aggregation, compatible derived Quantity addition, scalar scaling, and
  explicit-semantic general Quantity products with conservative interval
  propagation,
  element-exact, strict profile-wide, and explicit numeric profile-mean invariant resolution for normalized
  source Quantities plus package-authored scalar symbols, explicit candidate-local
  invariant uncertainty, scalar and Quantity
  node/edge attribute balance, role-filtered directed cycle-edge selection,
  deterministic single-node/single-edge irreducibility, exhaustive policy-
  bound proper-subgraph minimality, exact-domain constituent novelty,
  exhaustive typed single-edit stability with exact three-valued bounds,
  seeded sampled stability with conservative joint 95% bounds, and
  dimensionless addition/multiplication with rounding only at the result boundary;
- verified, content-addressed run precision/tolerance bindings for compiled
  predicate numeric operations;
- content-addressed Oracle requests and response validation for solver,
  parameter, quantity, tolerance, residual, convergence, and evidence binding
  without solver execution;
- closed, content-addressed source-classification and node-resolution policy
  freeze contracts that enforce exposure and reconciliation invariants without
  making catalogue decisions;
- complete independent-annotation matrices and blind-adjudication artifact
  freezing with policy/view/identity/exposure binding, preserved disagreement,
  ordered unblinding, and derived risk flags;
- immutable post-unblinding amendment snapshots with approval artifacts,
  per-relation state-hash chains, effective-kind indexes, and frozen risk-share
  accounting without rewriting adjudication;
- `createKernel().loadPackage()`, RunConfig/package binding, graph and
  decorated-enumeration operations,
  quantity/decimal
  operations, value/Boolean analysis, predicate-plan compilation, graph-only
  and local numeric predicate evaluation, package-bound local filtering,
  complete local-filter census construction/verification, package functional
  evaluation, complete cohort construction/verification, complete selector
  ranking/verification, complete sensitivity evaluation/verification,
  multi-selector admission/verification, selected-formation
  materialization/verification, derived-profile and derived-depth population
  materialization/verification, including opt-in formation-functional profile
  invariant derivation with complete evaluation lineage, primitive-to-depth-1 and generalized level
  closure/verification, arbitrary-depth source selection and complete depth-
  aware selection/materialization, explicit ladder closure, profile-collapse,
  level-boundary and carrier-promotion operations, and partial-failure
  diagnostics plus reproducible monotonicity audits and separate pruning-
  authorization decisions with verified pre-admission generator integration,
  integrated final level-result census construction/verification, numeric
  policy binding, Oracle protocol validation, and
  source-policy freezing plus closed source-migration/condensed-cluster package
  and run-artifact binding as the current public runtime boundary.

Formation-functional outputs carry forward as later-depth typed node
attributes under ADR-0088. Local verified storage lives in `@onto2d/run-store`;
remote-object-store writers remain application/adapter work. The schema-v1
profile aggregation registry is closed under ADR-0090;
unknown operators remain invalid scientific extensions. Nested invariant comparisons across removals, constituent
projections, and perturbations execute under ADR-0089. Semantic
run bundles and their verified external-store index are implemented in the
kernel; generic source-migration indexing and query execution live in the
catalogue adapter.
Source-policy authorship, actual annotation/adjudication/amendment data
collection, access-controlled view delivery, current-catalogue classification
application, and reviewed current-catalogue migration artifacts remain pending
external inputs. Generic SCC resolution, condensation, amendment-aware
effective reprojection, and reconciliation diagnostics live in the catalogue
adapter; ADR-0091 makes their complete artifact manifest loadable and
replayable through kernel run bundles.
The schema-v1 kernel capability registry has no pending operation under
ADR-0092. Unsupported configuration and indeterminate scientific branches
remain explicit and fail closed.

The normative behavior is defined in
[Kernel Architecture](../../docs/KERNEL_ARCHITECTURE.md). Implementation work
must preserve the dependency direction documented in
[Project Structure](../../docs/PROJECT_STRUCTURE.md).
