# Kernel Foundation Review Guide

Status: maintainer review notes as of 2026-08-12. Static review is followed by
local conformance execution on macOS arm64 with Node.js 20.20.2 and 22.23.2;
cross-platform and independent review gates remain.

## Review scope

The current foundation contains guarded canonical JSON, domain-separated
content hashes, deterministic schema-v1 package loading, primitive/profile
identity, verified depth-zero `Element` population materialization, exact
supplied-graph canonicalization, bounded connected-skeleton
enumeration, deterministic finite decoration, a CandidateStore, public
TypeScript contracts, normalized package/run candidate binding, and 130 JSON
Schemas. The graph-predicate layer adds verified complete evaluation and
partial persistent-failure diagnostics without direct pruning authority. The
monotonicity-audit layer reproduces the complete depth-one universe, records
deterministic falsification samples and counterexamples, and issues a separate
controller authorization only for statically proven witnessed failures; the
prepared pre-admission generator consumes them only with reconciled pruning
counts, complete-filter soundness confirmation, and exact equality against a
pruning-disabled eligible/indeterminate baseline. A second raw-frontier audit
and controller authorize exact edge-group subtree closure with three-mode
differential conformance. Directed-strong authorization additionally requires
an already strongly connected frontier. The depth-aware contract reproduces
an arbitrary target binding and its contiguous prior-level chain, binds the
selected source population, and keeps separate hash domains; exact node-
frontier counts and replay-resumable traversal are implemented under ADR-0081,
while ADR-0082 adds independent node-prefix audits, authorization, and exact
differential generation at depth one and arbitrary verified target depths. It
remains fail-closed for directed-strong node prefixes. The opt-in complete-candidate composition
gate consumes exact profile capacities and evaluates typed partner guards over
complete profile classes before store admission across primitive, depth-aware,
and bounded current-level generation. It records a separate transcript and
fails the complete generation on indeterminacy. ADR-0083 permits canonical-
prefix pre-admission pruning only after the gate passes and requires an exact
composition replay plus pruning-disabled differential result. ADR-0084
separately audits exact profile-compatible and profile-excluded complete-
extension counts for every edge/node raw frontier; both optimized generators
reconcile them against the same profile transcript and retained result sets.
ADR-0085 additionally connects normalized constant and element-invariant
Quantity structural attributes to primitive, depth-aware, and current-level
candidate alphabets with complete profile consensus and an explicit
candidate-versus-derived-element provenance policy.
Verified ordinary/depth-aware level
explanation indexes now reproduce their complete level basis and retain one
content-addressed filter-to-element lineage entry per evaluated candidate. The
integrated level-result census then reconciles final candidate/profile/element
counts, selectivity, predicate/selector censuses, and admitted element IDs
without changing their source interpretations. Verified run bundles bind the
complete chain and exact artifact bytes; external-store snapshots make each
run hash unique before enabling ambient candidate explanation lookup. The
package-filter layer proves bound-universe membership, records exact/profile
constituent resolution, reproduces numeric bindings, and combines graph plus
supported local-numeric top-level outcomes into a local verdict without
selector admission. The census layer requires a complete generated universe,
retains every filter explanation, reconciles Boolean selectivity and
indeterminate ratios, and reports total/exclusive failures plus
inert/dominating predicates without claiming a final `LevelResult`. The local
comparison layer executes scalar constants,
direct constant quantities, canonical counts, exact or compensated scalar and
Quantity structural-attribute sums with explicit approximation state,
compatible derived Quantity arithmetic, element-exact, strict profile-wide,
and explicit numeric profile-mean
invariant resolution for normalized Quantities plus package-authored scalar symbols,
candidate-local invariant uncertainty, node/edge attribute balance, and
dimensionless addition/multiplication with boundary-only rounding. The quantity layer adds versioned
multiplicative SI parsing,
normalization, comparison, exact decimals, declared rounding, and exact or
compensated accumulation. The typed value-expression layer adds recursive AST
validation, dimensional inference, dependency extraction, and content hashes
without executing expressions. The Boolean layer adds strict predicate AST
analysis, typed comparisons/balances, conservative monotonicity facts,
compiled predicate plans, and verified run-specific numeric-policy bindings.
The package functional layer independently reproduces one eligible filter and
its binding, then evaluates normalized coefficients, canonical counts,
scalar/Quantity structural-attribute sums, exact/profile-consensus or
explicitly aggregated numeric Quantity/scalar invariants, addition, and general Quantity
products with one-boundary rounding, evidence/uncertainty propagation, and an
explicit result-tolerance gate. It emits a candidate-local score or hashed
indeterminate artifact; it does not construct or rank a cohort.
The cohort layer independently replays the complete census, preserves all
exclusions and key diagnostics, and constructs a total shared-support,
profile-role, invariant-window, singleton, or global partition. It emits no
partial cohorts under source or key indeterminacy and still performs no
ranking or selector admission.
The selector-ranking layer evaluates every member of that reproduced
partition, retains every functional artifact, closes uncertainty-interval
dense ties transitively, and reports complete epsilon extrema, gap, degeneracy,
and variational selectivity. Any unscoreable member remains present and nulls
the affected metrics. The sensitivity layer replays that base ranking,
preflights the complete OAT/Cartesian sweep, reevaluates every member, and
keeps the full variant-by-cohort denominator in robust, fragile, or
indeterminate reports. The admission layer verifies every declared selector
chain, intersects full semantic-extremum sets, preserves exclusion versus
missing information, and reconciles the final candidate domain. The D5 bridge
then materializes selected formations, extracts opt-in residual-slot profiles,
and emits an all-or-nothing derived depth-1 `Element` population with a
separate derivation index. The package-level coordinator replays this entire
primitive-to-depth-1 chain, preflights aggregate selector work, emits one
run/result identity, and propagates complete, empty, or indeterminate status.
The generalized depth bridge exact-replays every contiguous prior closure,
selects `all-below` or `previous-only` populations, and executes the complete
candidate/filter/census/cohort/selector/admission/materialization chain for an
explicit target depth. The ladder coordinator applies that transition in
ascending order, indexes minimum depth and every appearance, and exposes
requested-depth, fixpoint, or indeterminate termination.
The opt-in current-level coordinator executes complete deterministic rounds
from selected lower populations plus the previous current set, accumulates new
element identities monotonically, publishes final elements only after
convergence, and exactly replays both direct levels and its ladder.
The profile-collapse layer independently closes exact and quotient ladders,
projects both into one profile domain, compares admission and selected
observables, and retains the smallest counterexample. The boundary layer
applies only frozen interval/error/tie policy and never changes declared axes.
The carrier-promotion layer requires the verified ladder/collapse basis,
non-empty profiles, cross-level coordinates, and package claim/evidence, then
emits immutable target primitive inputs under an explicit counterexample
disposition.
The Oracle layer adds request identity and response validation without solver
execution. The source-policy layer adds classification and node-resolution
artifact freezing, exposure/risk checks, and lossless reconciliation
invariants without applying a policy to the catalogue. The classification-
artifact layer adds complete independent matrices, precommitted tool binding,
blind adjudication, preserved disagreement, and ordered unblinding without
collecting or inventing actual labels.
The catalog-adapter projection layer constructs the exact frozen visible view,
preserves verified typed relations, and computes both required SCC partitions
without applying a policy to the repository catalogue. Its resolution layer
then accepts only complete reviewed node/rationale/edge inputs, preserves
isolated records, derives cluster membership from the verified partition, and
emits lossless relation layers plus a verified generative DAG.
Source explanations are verified and queried through an adapter-bound session;
the kernel exposes no facade that lacks the full migration chain.

The review boundary separates executable mechanisms from authored research
inputs. A reviewed current-catalogue migration artifact set and remote
persistence adapters are not present; its generic adapter pipeline and closed
kernel package/run binding are implemented. Formation-functional later-depth attributes and nested
substructure invariant resolution are implemented under ADR-0088 and ADR-0089;
ADR-0090 closes the schema-v1 profile aggregation registry rather than leaving
unnamed operators pending. ADR-0091 and ADR-0092 close the kernel migration
binding and keep source explanation replay in the catalogue adapter.
Audited pruning, candidate explanations, generic source
condensation/metrics/explanations, and local verified run persistence are
implemented.

## Recommended review order

1. Read [Kernel Implementation Status](KERNEL_IMPLEMENTATION_STATUS.md) to fix
   the implemented/pending boundary.
2. Review [Kernel Architecture](KERNEL_ARCHITECTURE.md), especially sections 4,
   8, 9, and 11, as the normative target.
3. Review [Kernel Design Decisions](KERNEL_DESIGN_DECISIONS.md) for the design
   rationale, exclusions, open inputs, and SCC policy.
4. Inspect [ADR-0003](adr/0003-canonical-identity-foundation.md),
   [ADR-0004](adr/0004-refinement-graph-canonicalization.md), and
   [ADR-0005](adr/0005-skeleton-enumeration-and-candidate-store.md), followed
   by [ADR-0006](adr/0006-multiplicative-si-quantities.md) and
   [ADR-0007](adr/0007-deterministic-decimal-arithmetic.md), then
   [ADR-0008](adr/0008-typed-value-expression-analysis.md),
   [ADR-0009](adr/0009-predicate-analysis-and-plans.md), and
   [ADR-0010](adr/0010-predicate-numeric-policy-binding.md), then
   [ADR-0011](adr/0011-scientific-oracle-validation.md), then
   [ADR-0012](adr/0012-source-policy-freeze-contracts.md), then
   [ADR-0013](adr/0013-source-classification-annotation-artifacts.md), then
   [ADR-0014](adr/0014-classified-relations-and-scc-projections.md), then
   [ADR-0015](adr/0015-decorated-candidate-enumeration.md), then
   [ADR-0016](adr/0016-package-run-candidate-binding.md), then
   [ADR-0017](adr/0017-graph-predicate-evaluation.md), then
   [ADR-0018](adr/0018-primitive-depth-population.md), then
   [ADR-0019](adr/0019-package-candidate-local-filter.md), then
   [ADR-0020](adr/0020-local-exact-compare-evaluation.md),
   [ADR-0021](adr/0021-exact-scalar-attribute-sums.md),
   [ADR-0022](adr/0022-unrounded-compensated-attribute-sums.md),
   [ADR-0023](adr/0023-quantity-attribute-sums.md),
   [ADR-0024](adr/0024-derived-quantity-addition.md),
   [ADR-0025](adr/0025-derived-quantity-scaling.md),
   [ADR-0026](adr/0026-element-exact-runtime-invariants.md),
   [ADR-0027](adr/0027-local-balance-evaluation.md),
   [ADR-0028](adr/0028-profile-invariant-consensus.md),
   [ADR-0029](adr/0029-complete-local-filter-census.md),
   [ADR-0030](adr/0030-irreducible-removal-evaluation.md),
   [ADR-0031](adr/0031-directed-cycle-edge-selection.md),
   [ADR-0032](adr/0032-package-functional-evaluation.md),
   [ADR-0033](adr/0033-complete-cohort-partitioning.md),
   [ADR-0034](adr/0034-complete-cohort-functional-ranking.md),
   [ADR-0035](adr/0035-coefficient-sensitivity-execution.md),
   [ADR-0036](adr/0036-multi-selector-admission.md),
   [ADR-0037](adr/0037-selected-formation-materialization.md),
   [ADR-0038](adr/0038-residual-slot-profiles-and-derived-depth.md), and
   [ADR-0039](adr/0039-package-level-closure.md), followed by
   [ADR-0040](adr/0040-depth-source-population-selection.md) and
   [ADR-0041](adr/0041-generalized-level-and-ladder-closure.md), followed by
   [ADR-0042](adr/0042-profile-collapse-and-level-boundaries.md) and
   [ADR-0043](adr/0043-explicit-carrier-promotion.md), then
   [ADR-0044](adr/0044-bounded-current-level-fixpoint.md) and
   [ADR-0045](adr/0045-exhaustive-minimal-subgraphs.md),
   [ADR-0046](adr/0046-scalar-and-indeterminate-invariants.md), and
   [ADR-0047](adr/0047-package-authored-scalar-invariants.md), followed by
   [ADR-0048](adr/0048-exact-constituent-novelty.md),
   [ADR-0049](adr/0049-exhaustive-typed-stability.md),
   [ADR-0050](adr/0050-seeded-sampled-stability.md),
   [ADR-0051](adr/0051-explicit-profile-invariant-aggregation.md),
   [ADR-0052](adr/0052-local-general-quantity-products.md), and
   [ADR-0053](adr/0053-monotonicity-audit-and-pruning-controller.md), and
   [ADR-0054](adr/0054-audited-pre-admission-pruning.md), and
   [ADR-0055](adr/0055-audited-recursive-frontier-pruning.md), and
   [ADR-0056](adr/0056-generalized-depth-audited-pruning.md), and
   [ADR-0057](adr/0057-verified-level-explanation-index.md), and
   [ADR-0058](adr/0058-integrated-level-result-census.md),
   [ADR-0059](adr/0059-verified-run-artifact-bundles.md), and
   [ADR-0060](adr/0060-verified-run-directory-persistence.md), and
   [ADR-0061](adr/0061-reviewed-source-resolution-and-condensation.md), and
   [ADR-0062](adr/0062-append-only-operational-execution-records.md), and
   [ADR-0063](adr/0063-source-migration-reconciliation-diagnostics.md), and
   [ADR-0064](adr/0064-post-unblinding-classification-amendments.md), and
   [ADR-0065](adr/0065-effective-source-classification-reprojection.md), and
   [ADR-0066](adr/0066-complete-source-migration-metrics.md), and
   [ADR-0067](adr/0067-source-migration-explanation-index.md),
   [ADR-0068](adr/0068-source-cluster-concentration.md),
   [ADR-0069](adr/0069-formation-functional-profile-invariants.md),
   [ADR-0070](adr/0070-typed-profile-partner-guards.md),
   [ADR-0071](adr/0071-null-model-execution-planning.md),
   [ADR-0072](adr/0072-null-model-proposal-generation.md),
   [ADR-0073](adr/0073-occurrence-aware-null-trial-censuses.md),
   [ADR-0074](adr/0074-occurrence-aware-null-trial-selection.md),
   [ADR-0075](adr/0075-per-model-null-distributions-and-integrated-baselines.md),
   [ADR-0076](adr/0076-profile-slot-composition-generation-gate.md),
   [ADR-0077](adr/0077-run-target-ontology-coordinate-materialization.md),
   [ADR-0078](adr/0078-package-driven-scalar-candidate-attributes.md),
   [ADR-0079](adr/0079-formation-derived-type-classification.md),
   [ADR-0080](adr/0080-current-level-round-null-model-execution.md),
   [ADR-0081](adr/0081-node-frontiers-and-replay-resumable-enumeration.md),
   [ADR-0082](adr/0082-audited-node-growth-pruning.md),
   [ADR-0083](adr/0083-profile-gated-pre-admission-pruning.md),
   [ADR-0084](adr/0084-profile-gated-raw-frontier-pruning.md),
   [ADR-0085](adr/0085-package-driven-quantity-candidate-attributes.md),
   [ADR-0086](adr/0086-role-dependent-edge-candidate-attributes.md),
   [ADR-0087](adr/0087-package-functional-structural-attribute-sums.md), and
   [ADR-0088](adr/0088-formation-functional-candidate-attribute-carry-forward.md).
5. Review `packages/kernel/src/canonical.js`, `hash.js`, and
   `quantity.js`, followed by `decimal.js`, `expression-analyzer.js`,
   `predicate-analyzer.js`, `predicate-plan-verifier.js`,
   `graph-predicate-evaluator.js`, `package-pruning-audit.js`,
   `package-pruned-candidate-generator.js`,
   `package-generator-frontier-audit.js`,
   `package-recursive-pruned-candidate-generator.js`,
   `package-node-frontier-audit.js`,
   `package-node-growth-pruned-candidate-generator.js`,
   `package-profile-pruning-extension.js`,
   `package-depth-pruning.js`, `package-level-explanation-index.js`,
   `package-level-result-census.js`, `package-run-artifact-bundle.js`,
   `numeric-binding.js`,
   `local-predicate-evaluator.js`, `profile-invariant-aggregation.js`, `oracle-validator.js`,
   `source-policy.js`, and `source-classification.js`, their tests, and the
   package-loader integration.
6. Review `graph-canonicalizer.js`, `skeleton-enumerator.js`,
   `candidate-enumerator.js`, `candidate-store.js`, `run-config.js`,
   `package-profile-composition.js`, and
   `loaded-package-verifier.js`, `primitive-depth-population.js`, and
   `package-candidate-generator.js`, followed by `package-candidate-filter.js`
   and `package-candidate-census.js`, then
   `package-functional-evaluator.js`, `package-cohort-partitioner.js`,
   `package-selector-ranker.js`, `package-selector-sensitivity.js`,
   `package-selector-admission.js`, `package-selected-formations.js`,
   `profile.js`, `package-derived-profiles.js`,
   `package-derived-depth-population.js`, and `package-level-closure.js`, then
   the `package-depth-*` source/binding/filter/census/selection/materialization
   wrappers, `package-depth-level-closure.js`, and
   `package-ladder-closure.js`, `package-profile-collapse.js`, and
   `package-carrier-promotion.js`, then `stratification.js` and
   `package-fixpoint-closure.js`, plus their tests.
7. Review `packages/catalog-adapter/src/source-projection.js`, its public types,
   then `source-condensation.js`, `source-migration-diagnostics.js`, and their
   order/tamper/reconciliation fixtures.
   Review `packages/kernel/src/source-classification-amendments.js` immediately
   before them for chronology, hash-chain, approval, and stale-projection
   enforcement.
8. Review `packages/run-store/src/index.js`, especially staging publication,
   path containment, symlink rejection, strict semantic/operational inventory,
   byte replay, run-bound execution IDs, and atomic no-overwrite record append.
9. Compare public TypeScript declarations with `packages/schemas/schemas/`.

## Decisions that deserve explicit approval

- Evidence provenance remains package-semantic but is excluded from ordinary
  primitive and profile structural identity. Quantity value, unit, tolerance,
  and semantic meaning remain identity-bearing when enabled by policy.
- Source IDs are non-structural by default. A package may opt into structural
  source IDs through the hashed identity policy.
- Candidate and skeleton hashes use separate domains. Skeleton projection is
  undirected, simple, and unlabelled; candidate identity retains direction,
  roles, enabled multiplicity/loops, references, domain, and declared
  structural attributes. Standalone skeleton canonicalization accepts
  disconnected simple graphs; the enumerator and candidate policy enforce
  connectedness where required.
- Simple-skeleton labeling uses every node permutation and selects the global
  minimum edge serialization. Decorated-candidate labeling uses exact
  refinement plus exhaustive individualization. Both share a deterministic
  search budget; exhaustion emits no partial identity.
- Partial enumeration/store results are explicitly non-interpretable.
- Package/run binding replays the loader, fixes the primitive source
  population as canonical depth-zero `Element` records, binds the source-depth
  selection, discloses profile quotient membership/representatives, and rejects
  semantics the connected finite generator cannot enforce. Callers cannot
  inject unverified derived records: selected formations, derived profiles,
  and later-depth elements instead enter only through their deterministic,
  replay-verified materialization paths.
- Package-bound profile invariants derive their value from every member of the
  complete selected class. Strict consensus remains the default; an explicit
  numeric arithmetic mean binds run precision and conservative Quantity
  uncertainty/evidence synthesis. The formation representative is never a
  value shortcut.
- Package-authored and direct local scalar invariant symbols require an exact
  runtime type. Nonnumeric profiles require scalar consensus; numeric profiles
  may explicitly bind the arithmetic-mean policy. Missing, ambiguous, or incomplete
  candidate data produces a structured `indeterminate` witness; malformed
  contexts and Quantity unit/semantic drift remain hard errors.
- Complete local-filter censuses refuse incomplete enumeration, keep every
  candidate explanation, distinguish total from exclusive predicate failures,
  and expose their dominance and indeterminate thresholds in the hashed
  artifact. Review that immutable universe/source indexes are session-scoped
  and that serialized artifacts fail verification unless exact package/run
  reproduction agrees field-for-field.
- Package functional evaluation accepts only exact reproduction of an
  `eligible` filter, retains canonical coefficient/invariant/set witnesses,
  keeps intermediate arithmetic unrounded, executes typed scalar/Quantity
  structural sums under the bound summation policy, propagates conservative
  interval bounds for Quantity sums and general products, and withholds the
  score when the result tolerance target fails. Review that this candidate-
  local artifact is never treated as cohort completion, ranking, selector
  admission, or pruning.
- Complete cohort construction replays the complete census rather than
  accepting a caller-selected population, keeps every exclusion, names
  shared-support resources by expression slot, preserves ordered profile-role
  tuples, and uses exact anchored window bins with conservative uncertainty.
  Review exact coverage/no-overlap reconciliation, fail-closed key outcomes,
  and whole-artifact verification before any future ranker accepts a partition.
- Complete selector ranking accepts only the selector's reproduced partition,
  evaluates every member, separates uncertainty dense ranks from epsilon
  extrema, retains all semantic ties, and uses canonical IDs only for stable
  presentation. Review transitive interval grouping, the single maximum-bound
  epsilon comparison, oriented gap arithmetic, null metrics under any missing
  score, weighted-summary denominators, execution ceilings, and exact replay.
- Complete coefficient sensitivity accepts only an exactly replayed base
  ranking, expands every required OAT/Cartesian variant before execution, and
  reevaluates all cohort members. Review exact factor/tolerance arithmetic,
  basis-bound variant IDs, unreduced comparison denominators, null ratios for
  missing variants, budget preflight, threshold verdicts, and exact replay.
- Multi-selector admission requires one verified execution chain per declared
  selector and intersects semantic-extremum sets over the unchanged eligible
  census. Review selector coverage/order invariance, definite-exclusion
  precedence, identity admission, sensitivity interpretation, per-selector and
  final count/ratio reconciliation, and exact replay.
- Selected-formation materialization accepts only reproduced definite
  selection, preserves candidate and exact/profile constituent provenance,
  and binds predicate/functional/selector claims without inventing a profile.
  Review candidate/formation count equality, claim/evidence union, both hash
  domains, profile-class disclosure, and exact replay.
- Residual-profile extraction consumes canonical directed endpoints under
  explicit polarity/capacity rules and stops on unsupported guards or missing
  capacity. Derived-depth materialization is all-or-nothing, excludes evidence
  from structural identity, and indexes every derivation separately. Review
  exact-versus-symmetric slot priority, capacity arithmetic, base composition,
  indeterminate propagation, identity bytes, primary derivation selection,
  counts, schemas, and exact replay.
- Package-level closure accepts no stage artifact on trust: it recreates the
  complete primitive-to-depth-1 chain and hashes both run and result. Review
  aggregate selector and configured null-model budget arithmetic, compact
  disabled-null state, embedded sample-chain identity, terminal propagation,
  metric/count reconciliation, strict schema, and exact replay.
- Null-model planning accepts only a reproduced complete census and binds its
  full carrier, ontology gate, model preservation contract, recomputation
  requirements, and independent model/trial stream identities. Review disabled
  versus planned status, authored model-order invariance, seed sensitivity,
  limits, schema conformance, and exact replay; do not treat a plan as a
  completed baseline.
- Null-model proposals retain carrier-size occurrences and execute Fisher-Yates
  role shuffles, role-wise degree-preserving target swaps, or exact uniform
  carrier draws with replacement. Review complete-carrier membership,
  role/degree preservation, invalid-swap accounting, mixing ratios, duplicate
  occurrences, hard work limits, schema conformance, and exact replay.
- Null-model trial censuses must refilter every occurrence rather than copy the
  observed census or deduplicate uniform replacement draws. Review occurrence
  identities, full filter artifacts, primitive/depth binding replay, Boolean and
  predicate reconciliation, threshold interpretation, schemas, and exact replay.
- Null-model trial selection must preserve occurrence IDs as member identities
  while evaluating keys and functionals on proposed canonical graphs. Review
  duplicate membership, complete cohort coverage, base and sensitivity work
  preflights, extrema/admission reconciliation, fragile metric retention,
  primitive/depth replay, schemas, and tamper rejection.
- Null-model baselines verify both the observed admission and complete sample
  chain, never pool model IDs, and never silently reduce a metric denominator.
  Review fixed trial ordering, compensated mean/sample-SD arithmetic,
  one-run and zero-variance notes, constant-value relations, null z-scores,
  missing/fragile propagation, closure embedding, schemas, and exact replay.
- Depth-source selection accepts only a complete replayed prior level and
  exposes source-policy semantics in its selected depths. Review contiguous
  coverage, complete-level termination, minimum-depth occurrence indexing,
  element/profile alphabets, depth-aware binding hashes, enumeration budgets,
  universe membership, local filter/census reconciliation, schemas, and exact
  selection/census replay.
- Quantity identity uses canonical SI bases; comparisons combine both declared
  tolerances and require matching semantics unless explicitly overridden.
- Decimal operations round only at the declared boundary; exact and
  compensated summation remain distinct result states.
- Value-expression analysis is type-only: it canonicalizes commutative nodes,
  ignores unreferenced environment symbols, and hashes referenced symbol types
  without coefficient or invariant values. Package/rules hashes still retain
  the normalized rule data and declared quantity values.
- Predicate plans separate a declared monotonicity claim from static proof and
  partial-data availability. Only `static-proven` plans may later reach a
  pruning path, and every declared claim still requires the falsification
  audit specified by the architecture.
- Complete graph evaluation re-canonicalizes the candidate and uses canonical
  witnesses. Partial persistent-failure detection always reports
  `pruningAuthorized: false`; the separate audit/controller must reproduce the
  package/run universe, pass every declared claim, retain any sampled repair,
  and authorize the specific diagnostic. Review that passing samples never
  upgrade a blocked plan and that the generator consumes decisions only
  through the prepared audited pre-admission and raw-frontier integration
  paths, each with exact differential conformance.
- Package filtering reproduces the complete package/run binding, rejects
  canonical candidates that the bound decorator cannot emit, and evaluates all
  graph, supported local-numeric, `minimal`, `irreducibleRemoval`, or exact-
  domain `novel` top-level
  plans under reproduced numeric bindings and the bound substructure policy.
  Review that exhaustive minimality covers all proper policy-selected parent
  subsets, refuses more than 10,000 before materialization, and remains
  distinguishable from single-removal irreducibility. Also review that
  excluded removals remain explicit, zero evaluated removals are
  indeterminate, and canonical-to-parent mappings accompany nested witnesses.
  Review `novel` separately from structural minimality: it must evaluate only
  canonical single-node, zero-edge exact constituents, retain source and
  projection identities, reject quotient representatives, and require no
  removal policy unless its nested predicate uses a policy-bound operator.
  Review cycle selections as the role-filtered directed edge union, not as a
  cycle count or an inferred undirected projection; each selected edge must
  occur once and disclose `directed-cycle-edge-union-v1`.
  Its `eligible` verdict remains local and cannot be presented as
  selector admission or a materialized derived element. Unfrozen runtime value
  sources and implicit scalar/Quantity addition fail
  preflight.
- Predicate numeric bindings keep reusable package plans separate from run
  precision, bind canonical selection order and declared-tolerance comparison
  explicitly, and reproduce every analysis witness and pruning fact before
  accepting a plan.
- Oracle validation reproduces candidate graph canonicality and binds solver
  identity, parameters, quantities, tolerance targets, residuals, and evidence
  to one request hash;
  failed or unapproved partial work stays indeterminate.
- Policy freezing validates complete authored rule sets and honest exposure
  declarations, uses a closed local visible-field vocabulary, and rejects
  classifier minima above the executable ceiling, but supplies no scientific
  category or SCC disposition. Policy-freeze operations alone must not be
  described as execution of the complete migration chain; the adapter executes
  that chain only from caller-supplied reviewed artifacts.
- Annotation/adjudication freezing validates supplied records and derives
  disagreement, but does not guarantee that a declared view was actually
  access-controlled or that a caller-supplied timestamp came from a trusted
  clock. Those enforcement claims remain outside the kernel boundary.
- Adapter SCC projection, caller-supplied isolated-node resolution,
  condensation, and reconciliation diagnostics are deterministic
  transformations of verified data, not scientific classification. Applying
  them to reviewed current-catalogue inputs remains a mandatory migration gate.
- The loader defaults to `profileDefinition.kind = "explicit-only"` and also
  accepts the explicit base-only `residual-slots-v1` D5 hypothesis and the
  `residual-slots-v2` formation-functional invariant extension, plus the
  `residual-slots-v3` Quantity-threshold derived-type extension. Typed partner
  guards execute over every verified profile-class member; legacy hashes and
  missing/member-dependent results remain fail-closed. It accepts source
  migration and condensed-cluster primitives only through the complete
  ADR-0091 binding, with exact artifact inventory, edge/member reconciliation,
  condensation provenance, and disjoint cluster membership validation.
- Catalogue cycles are resolved by frozen typed classification, node
  resolution, and SCC condensation. No source edge is deleted, no member order
  is invented, and no retroactive blind-classification claim is made.

## Static verification record

The static documentation pass checks all 153 JSON files for parseability, all
130 schema identifiers and relative references, schema export coverage and
Draft 2020-12 compilation,
relative source imports, Markdown links/fences, public implementation/type
names, source-lock hashes and sizes, and whitespace errors in the maintained
source/documentation surface outside the preserved catalogue.
`git diff --check` is also required to remain clean.

All 141 maintained JavaScript source and test files pass the repository source
check. The earlier syntax-only JavaScriptCore review did not evaluate modules;
the current Node.js passes now exercise the complete test suite.

This revision additionally compared direct runtime acceptance with the public
TypeScript and JSON Schema shapes. It closed empty-tolerance and predicate-range
type gaps, bounded schema selector strings and canonical indices, normalized
quantity semantic/provenance identifiers, discriminated exact from compensated
decimal accumulation, made public option objects closed, and made package
conversion overflow or non-zero underflow a structured validation failure.
Executable generation/evaluation artifacts are also validated against the
compiled schemas, including witnesses above 64 edges.

An independent Python standard-library generator now supplies canonical-byte,
domain-hash, canonical-skeleton, and labelled-multiplicity fixtures without
importing the kernel. Its exhaustive run covers all connected simple graphs
through six nodes and reconciles the known `1, 1, 2, 6, 21, 112` unlabeled and
`1, 1, 4, 38, 728, 26704` connected-labelled counts. Regeneration was replayed
with byte-identical outputs. The JavaScript-side comparison has now executed on
Node.js 20.20.2 and 22.23.2. It exposed non-minimal provisional
skeleton bytes for two five-node classes; exhaustive permutation-minimum
labeling corrected the discrepancy before identity freeze.
`npm run check:goldens` repeats the independent Python derivation in
non-mutating verification mode and compares both committed files byte-for-byte.

`scr/theory-of-causal-arisings.pdf` and `scr/topology-of-arising.pdf` are the
repository theory sources. Both PDF hashes and byte sizes match
`cases/level-0-oscillator/source-lock.json`.

## Execution record and remaining gates

The documented dynamic sequence has completed locally (using the exact Node.js
entry points behind the npm scripts):

```sh
npm ci
npm test
npm run check
npm run build
```

The current full 410-test suite, repository checks, and build validation pass
locally on macOS arm64 under Node.js 20.20.2 and 22.23.2. The repository CI
matrix targets Node.js 20 and 22 across Ubuntu, macOS, and Windows.
ADR-0003, ADR-0004, and ADR-0005 remain proposed until the
goldens receive independent review and additional supported platforms
reproduce them. RFC 8785 binary64 and Unicode edge cases are now explicitly
covered by the canonical conformance tests.

`npm run check:closure` verifies the frozen empty pending registry, capability
count, exact one-to-one coverage of all 195 capabilities by 372 primary kernel
tests, independent fixture hashes, required CI matrix, and mandatory
`POST-CLOSURE-VIS-01` flag. It deliberately does not convert a configured CI
matrix or a self-check into external execution/review evidence.

## Known review risks

- Exact graph search is intentionally bounded and optimized for at most six
  nodes; highly symmetric inputs can exhaust the budget.
- A binary64 input enters exact decimal arithmetic through its shortest
  round-trippable string; unavailable source-literal precision cannot be
  recovered.
- Compensated binary64 summation is deterministic only for a fixed declared
  term order and is explicitly not an exact result.
- Decimal-to-binary64 conversion rejects non-zero values that would underflow
  to zero; representable subnormal values still follow binary64 rounding.
- Affine and logarithmic units remain absent.
- Package-level scalar and Quantity `sum` expressions can use the normalized
  `candidateAttributes` type registry. Role-dependent edge sources are closed
  by ADR-0086, and ADR-0087 executes those sums in package functionals, cohort
  keys, and formation-derived profile functionals. ADR-0088 permits only the
  acyclic derived-profile/`Element`/later-depth carry-forward path; review that
  no functional can mutate the candidate being generated.
- ADR-0093 materializes a complete fixed/free/fitted coefficient-role map and
  requires every non-fixed coefficient in the sensitivity sweep. Legacy inputs
  declare listed names free and omitted names fixed during normalization.
- Perturbation entries have four closed executable single-edit forms; registry-
  only strings remain a compatibility declaration and cannot execute locally.
- A Quantity used as a structural candidate attribute contributes its complete
  normalized provenance to candidate identity, while primitive/profile and
  derived-element structural quantity identity exclude evidence provenance.
  ADR-0085 makes this boundary explicit: distinct candidate derivations may
  reconcile to one derived element, with their evidence retained in the
  derivation index.
- Static persistence is intentionally conservative. Combined lower/upper
  ranges, arbitrary comparisons, balances, substructure combinators, and
  canonical-index degree/path checks are not authorized for partial pruning;
  lower-bound degree passes over growing selections are not marked persistent.
- Complete local-filter census evaluation is synchronous and retains both the
  completed generation artifact and every candidate filter artifact in memory.
  `maxCandidates` bounds semantic cardinality, but streaming persistence and
  independent resource enforcement remain future production work.
- JSON Schema validates record shape but cannot replace executable reference,
  acyclicity, identity, endpoint, unit, and count reconciliation checks. The
  census reproduction verifier now supplies that executable boundary for its
  stored artifact; equivalent verifiers remain necessary for future consumers.
- Source-migration schemas and ADR-0091 define the closed package boundary. The
  loader requires the complete artifact inventory, exact references and
  cluster provenance; external artifact bytes must first be fully replayed by
  the catalogue adapter.
- The local Node.js 20/22 suite and binary64/Unicode audit pass; cross-platform
  reproduction and independent golden review remain open.
