# Kernel Foundation Review Guide

Status: maintainer review notes as of 2026-08-07. The reviewed files were
checked statically under an explicit instruction not to run the project. No
Node.js module, npm script, test, build, or application runtime was executed.

## Review scope

The current foundation contains guarded canonical JSON, domain-separated
content hashes, deterministic schema-v1 package loading, primitive/profile
identity, exact supplied-graph canonicalization, bounded connected-skeleton
enumeration, a deterministic CandidateStore, public TypeScript contracts, and
32 JSON Schemas. The quantity layer adds versioned multiplicative SI parsing,
normalization, comparison, exact decimals, declared rounding, and exact or
compensated accumulation. The typed value-expression layer adds recursive AST
validation, dimensional inference, dependency extraction, and content hashes
without executing expressions. The Boolean layer adds strict predicate AST
analysis, typed comparisons/balances, conservative monotonicity facts, and
compiled predicate plans. Pending execution and closure capabilities fail
explicitly; they do not return placeholder results.

The review boundary is intentionally smaller than the target architecture.
Candidate decoration, value-expression and predicate evaluation, cohort ranking,
sensitivity execution, source migration/condensation, scientific-oracle
validation, explanations, and closure are not implemented.

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
   [ADR-0008](adr/0008-typed-value-expression-analysis.md) and
   [ADR-0009](adr/0009-predicate-analysis-and-plans.md).
5. Review `packages/kernel/src/canonical.js`, `hash.js`, and
   `quantity.js`, followed by `decimal.js`, `expression-analyzer.js`,
   `predicate-analyzer.js`, their tests, and the package-loader integration.
6. Review `graph-canonicalizer.js`, `skeleton-enumerator.js`, and
   `candidate-store.js`, then their tests.
7. Compare `packages/kernel/src/index.d.ts` with `packages/schemas/schemas/`.
8. Review the legacy `onto2d.js` change and its characterization fixtures
   separately from the new kernel.

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
- Graph labeling uses exact refinement plus exhaustive individualization within
  a deterministic search budget. Exhaustion emits no partial identity.
- Partial enumeration/store results are explicitly non-interpretable.
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
- The current loader accepts only `profileDefinition.kind = "explicit-only"`.
  It rejects source migration and condensed clusters until edge/member
  reconciliation and condensation validation exist.
- Catalogue cycles are resolved by frozen typed classification, node
  resolution, and SCC condensation. No source edge is deleted, no member order
  is invented, and no retroactive blind-classification claim is made.

## Static verification record

The static documentation pass checks all 51 JSON files for parseability, all
32 schema identifiers and relative references, schema export coverage,
relative source imports, Markdown links/fences, public implementation/type
names, source-lock hashes and sizes, and whitespace errors in the maintained
source/documentation surface outside the preserved catalogue.
`git diff --check` is also required to remain clean.

All 39 maintained JavaScript source and test files were also passed through a
syntax-only JavaScriptCore parse of isolated copies with module linkage
removed. No repository module was evaluated by that check.

This revision additionally compared direct runtime acceptance with the public
TypeScript and JSON Schema shapes. It closed empty-tolerance and predicate-range
type gaps, bounded schema selector strings and canonical indices, normalized
quantity semantic/provenance identifiers, discriminated exact from compensated
decimal accumulation, made public option objects closed, and made package
conversion overflow or non-zero underflow a structured validation failure.

`scr/theory-of-causal-arisings.pdf` and `scr/topology-of-arising.pdf` are the
repository theory sources. Both PDF hashes and byte sizes match
`cases/level-0-oscillator/source-lock.json`.

## Deferred execution gates

The following commands are the maintainer's first authorized dynamic review
step, in this order:

```sh
npm ci
npm test
npm run check
npm run build
```

Passing them is required before changing ADR-0003, ADR-0004, or ADR-0005 from
“proposed implementation baseline” to accepted. Acceptance also requires an
independent canonical-byte implementation, an independent skeleton-generator
comparison, supported-platform Node.js execution, and review of binary64 and
Unicode edge cases.

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
  This policy asymmetry needs an explicit decision before candidate decoration.
- Static persistence is intentionally conservative. Combined lower/upper
  ranges, arbitrary comparisons, balances, substructure combinators, and
  canonical-index degree/path checks are not authorized for partial pruning;
  lower-bound degree passes over growing selections are not marked persistent.
- JSON Schema validates record shape but cannot replace executable reference,
  acyclicity, identity, endpoint, unit, and count reconciliation checks.
- Source-migration schemas describe the target contract, while the current
  loader deliberately rejects those inputs until the migration engine exists.
- The tests are present but remain unexecuted under the current no-execution
  constraint.
