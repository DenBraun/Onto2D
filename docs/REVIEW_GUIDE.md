# Kernel Foundation Review Guide

Status: maintainer review notes as of 2026-08-11. Static review is followed by
local conformance execution on macOS arm64 with Node.js 20.19.4 and 22.18.0;
cross-platform and independent review gates remain.

## Review scope

The current foundation contains guarded canonical JSON, domain-separated
content hashes, deterministic schema-v1 package loading, primitive/profile
identity, verified depth-zero `Element` population materialization, exact
supplied-graph canonicalization, bounded connected-skeleton
enumeration, deterministic finite decoration, a CandidateStore, public
TypeScript contracts, normalized package/run candidate binding, and 54 JSON
Schemas. The graph-predicate layer adds verified complete evaluation and
partial persistent-failure diagnostics without pruning authority. The
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
compatible derived Quantity arithmetic, element-exact and strict profile-wide
identical-Quantity invariant resolution, node/edge attribute balance, and
dimensionless addition/multiplication with boundary-only rounding. The quantity layer adds versioned
multiplicative SI parsing,
normalization, comparison, exact decimals, declared rounding, and exact or
compensated accumulation. The typed value-expression layer adds recursive AST
validation, dimensional inference, dependency extraction, and content hashes
without executing expressions. The Boolean layer adds strict predicate AST
analysis, typed comparisons/balances, conservative monotonicity facts,
compiled predicate plans, and verified run-specific numeric-policy bindings.
The Oracle layer adds request identity and response validation without solver
execution. The source-policy layer adds classification and node-resolution
artifact freezing, exposure/risk checks, and lossless reconciliation
invariants without applying a policy to the catalogue. The classification-
artifact layer adds complete independent matrices, precommitted tool binding,
blind adjudication, preserved disagreement, and ordered unblinding without
collecting or inventing actual labels.
The catalog-adapter projection layer constructs the exact frozen visible view,
preserves verified typed relations, and computes both required SCC partitions
without applying a policy to the repository catalogue.
Pending execution and closure capabilities fail explicitly; they do not return
placeholder results.

The review boundary is intentionally smaller than the target architecture.
Derived-depth population binding and selected formation/profile
materialization artifacts, derived decoration attributes, profile
guards/capacities, partial predicate pruning authorization,
scalar and non-identical-profile invariant semantics, functional/coefficient execution, general
Quantity products, cycle-set/substructure
predicate evaluation, integrated complete verdicts,
cohort ranking/selector admission, sensitivity execution, source migration/
condensation, explanations, and closure are not implemented.

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
   [ADR-0028](adr/0028-profile-invariant-consensus.md), and
   [ADR-0029](adr/0029-complete-local-filter-census.md).
5. Review `packages/kernel/src/canonical.js`, `hash.js`, and
   `quantity.js`, followed by `decimal.js`, `expression-analyzer.js`,
   `predicate-analyzer.js`, `predicate-plan-verifier.js`,
   `graph-predicate-evaluator.js`, `numeric-binding.js`,
   `local-predicate-evaluator.js`, `oracle-validator.js`,
   `source-policy.js`, and `source-classification.js`, their tests, and the
   package-loader integration.
6. Review `graph-canonicalizer.js`, `skeleton-enumerator.js`,
   `candidate-enumerator.js`, `candidate-store.js`, `run-config.js`, and
   `loaded-package-verifier.js`, `primitive-depth-population.js`, and
   `package-candidate-generator.js`, followed by `package-candidate-filter.js`
   and `package-candidate-census.js`, then their tests.
7. Review `packages/catalog-adapter/src/source-projection.js`, its public types,
   and its order/tamper fixtures.
8. Compare public TypeScript declarations with `packages/schemas/schemas/`.

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
  semantics the connected finite generator cannot enforce. Derived records
  remain forbidden until selector admission and selected formation/profile
  provenance are reproducible.
- Package-bound profile invariants derive their value from every member of the
  complete selected class and pass only when the fully normalized Quantity
  records are identical; the formation representative is never a value
  shortcut.
- Complete local-filter censuses refuse incomplete enumeration, keep every
  candidate explanation, distinguish total from exclusive predicate failures,
  and expose their dominance and indeterminate thresholds in the hashed
  artifact. Review that immutable universe/source indexes are session-scoped
  and that serialized artifacts fail verification unless exact package/run
  reproduction agrees field-for-field.
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
  `pruningAuthorized: false`; it is evidence for a future audited controller,
  not permission to change the generated universe.
- Package filtering reproduces the complete package/run binding, rejects
  canonical candidates that the bound decorator cannot emit, and evaluates all
  graph or supported local-numeric top-level plans under reproduced numeric
  bindings. Its `eligible` verdict remains local and cannot be presented as
  selector admission or a materialized derived element. Unfrozen runtime value
  sources, implicit scalar/Quantity addition, and multi-Quantity products fail
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
  category or SCC disposition. The
  two implemented capabilities must not be described as migration execution.
- Annotation/adjudication freezing validates supplied records and derives
  disagreement, but does not guarantee that a declared view was actually
  access-controlled or that a caller-supplied timestamp came from a trusted
  clock. Those enforcement claims remain outside the kernel boundary.
- Adapter SCC projection is a deterministic transformation of verified data,
  not scientific classification. It covers relation endpoints but not isolated
  catalogue cards; completed node reconciliation and condensation remain
  mandatory migration gates.
- The current loader accepts only `profileDefinition.kind = "explicit-only"`.
  It rejects source migration and condensed clusters until edge/member
  reconciliation and condensation validation exist.
- Catalogue cycles are resolved by frozen typed classification, node
  resolution, and SCC condensation. No source edge is deleted, no member order
  is invented, and no retroactive blind-classification claim is made.

## Static verification record

The static documentation pass checks all 74 JSON files for parseability, all
54 schema identifiers and relative references, schema export coverage and
Draft 2020-12 compilation,
relative source imports, Markdown links/fences, public implementation/type
names, source-lock hashes and sizes, and whitespace errors in the maintained
source/documentation surface outside the preserved catalogue.
`git diff --check` is also required to remain clean.

All 67 maintained JavaScript source and test files pass the repository source
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
Node.js 20.19.4 and 22.18.0. It exposed non-minimal provisional
skeleton bytes for two five-node classes; exhaustive permutation-minimum
labeling corrected the discrepancy before identity freeze.

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

The full 189-test suite, repository checks, and build validation pass on both
local Node.js versions. ADR-0003, ADR-0004, and ADR-0005 remain proposed until the
goldens receive independent review and additional supported platforms
reproduce them. RFC 8785 binary64 and Unicode edge cases are now explicitly
covered by the canonical conformance tests.

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
- Package-level `sum` expressions require attribute type metadata, but the
  schema-v1 package has no attribute-type registry yet; such expressions fail
  explicitly until that registry is introduced.
- Schema-v1 coefficient records do not distinguish fixed, free, and fitted
  values. The loader checks listed sensitivity references but cannot yet prove
  that every required coefficient is included in the sweep.
- Perturbation entries remain generic JSON values. Predicate analysis can bind
  only string entries or object entries carrying a normalized `id`.
- A Quantity used as a declared structural candidate attribute currently
  contributes its complete normalized provenance to candidate identity, while
  ordinary primitive/profile quantity identity excludes evidence provenance.
  This policy asymmetry needs an explicit decision before derived attributes
  feed integrated closure generation.
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
- Source-migration schemas describe the target contract, while the current
  loader deliberately rejects those inputs until the migration engine exists.
- The local Node.js 20/22 suite and binary64/Unicode audit pass; cross-platform
  reproduction and independent golden review remain open.
