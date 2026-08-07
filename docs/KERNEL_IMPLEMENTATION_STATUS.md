# Kernel Implementation Status

Status: deterministic package, graph identity, quantity/decimal arithmetic,
typed value/Boolean analysis, and predicate-plan compilation implemented;
execution not performed for this change; closure pipeline pending.

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
  primitive identities, and emits package/rules/depth-basis/identity-policy
  hashes;
- `graph-canonicalizer.js` validates supplied candidates and graph policy,
  applies exact 1-WL refinement plus deterministic individualization search,
  derives canonical unlabeled simple skeletons, emits domain-separated
  candidate/skeleton identities, preserves reversible node/edge mappings, and
  keeps standalone skeleton identity independent of connectedness;
- `skeleton-enumerator.js` exhaustively visits the bounded labelled simple-graph
  universe, rejects disconnected inputs, deduplicates canonical skeletons, and
  emits explicit completion or budget-exhaustion state;
- `candidate-store.js` fixes one counting domain and canonicalization policy,
  admits one canonical representative, counts duplicates, sorts snapshots by
  candidate ID, and requires explicit successful finalization for
  interpretability;
- `quantity.js` implements the versioned `si-multiplicative-v1` grammar,
  dimensional compatibility, canonical SI-base conversion, absolute-tolerance
  conversion, and tolerance-aware comparisons;
- `decimal.js` implements canonical coefficient/scale decimals, exact
  addition/subtraction/multiplication, bounded rounded division, all declared
  rounding modes, and exact or compensated accumulation;
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
- `kernel.js` exposes `createKernel().loadPackage()`,
  graph/skeleton canonicalization, connected-skeleton enumeration,
  CandidateStore creation, quantity/decimal operations, value/Boolean
  analysis, predicate-plan compilation, and a truthful capability manifest.

The loader requires at least one primitive and currently requires every
primitive profile to be explicit. Declarative `profileDefinition` derivation is
not silently simulated. Quantities in packages and structural candidate
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

Quantity evidence is preserved in the normalized package and therefore changes
the package identity, while ordinary primitive and profile structural identity
uses value, unit, tolerance, and semantic meaning without evidence provenance.
The Oracle, sensitivity-report, and normalized run-configuration schemas and
public types are aligned with the normative contracts, but their evaluators are
not implemented.

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
[ADR-0005](adr/0005-skeleton-enumeration-and-candidate-store.md). Their
reference fixtures have not yet been executed or compared with an independent
generator.

Quantity grammar, conversion, identity, and comparison semantics are recorded
in [ADR-0006](adr/0006-multiplicative-si-quantities.md). Decimal representation,
rounding, and accumulation are recorded in
[ADR-0007](adr/0007-deterministic-decimal-arithmetic.md). Affine/logarithmic
units and Oracle result validation remain outside the implemented boundary.
Typed value-expression analysis and its hashing rules are recorded in
[ADR-0008](adr/0008-typed-value-expression-analysis.md). Boolean-expression
analysis, persistence inference, and plan compilation are recorded in
[ADR-0009](adr/0009-predicate-analysis-and-plans.md). Expression and predicate
execution remain pending.

Source IDs, claims, and evidence do not enter ordinary primitive structural
identity by default. The provisional cluster identity branch binds the frozen
classification policy, node-resolution artifact, condensation artifact, and
disposition rather than review timestamps or annotator identity. It remains
unreachable until migration reconciliation is implemented. The exact
provisional decision is recorded in
[ADR-0003](adr/0003-canonical-identity-foundation.md).

The schemas already describe classified relations and condensed clusters, but
the foundation loader rejects `sourceMigration` and condensed-cluster inputs
with explicit `SOURCE_*_FOUNDATION_UNAVAILABLE` issues. They cannot be loaded
until exact member/edge reconciliation and condensation validation exist.

## Explicitly pending

- candidate decoration, partial streaming/pruning, and the integrated generator
  state machine;
- value-expression and predicate execution, including three-valued evaluation
  and witnesses;
- cohort construction and functional ranking;
- sensitivity, baselines, profiles derived from rules, closure, and ladder
  execution;
- source-classification/condensation execution;
- explanation and artifact indexes;
- external scientific-oracle validation.

The target requirement that every free or fitted coefficient appear in
`sensitivityCoefficients` cannot yet be checked because schema-v1 does not mark
coefficients as fixed, free, or fitted. The loader verifies that every listed
sensitivity coefficient exists, but it cannot infer which unlisted
coefficients require a sweep. Perturbation entries are likewise still generic
JSON values; only string entries and object `id` fields form the identifier
registry used by predicate analysis.

For a candidate attribute explicitly selected as structural, the current graph
canonicalizer hashes the complete normalized Quantity record, including its
provenance. Primitive/profile quantity identity excludes evidence provenance.
This asymmetry is recorded for explicit policy review before decorated
candidate generation is implemented.

Calls to public pending operations throw `KERNEL_NOT_IMPLEMENTED`. They never
return an empty or fabricated scientific result.

## Verification status

Canonical JSON, loader, and graph tests were added for determinism, domain
separation, unsafe values, stable package/depth identities, 30 independently
permuted graph pairs, non-isomorphic negatives, structural attributes,
reversible mappings, connected-skeleton reference counts, candidate-store
deduplication/order, policy failures, generator/canonicalization budgets,
current-depth rejection, phase-cycle rejection, missing references, and
unavailable closure.
Quantity fixtures cover derived and compound units, prefixes, conversion of
absolute tolerance, dimensional compatibility, semantic guards, comparison
windows, empty effective tolerances, invalid comparison policies, normalized
provenance identifiers, conversion overflow, non-zero conversion underflow,
canonical-unit round trips, and package/candidate identity equivalence.
Decimal fixtures cover exact arithmetic, all rounding modes, rounded division,
exact and compensated accumulation, canonical serialization, resource limits,
non-zero binary64 underflow, and explicit arithmetic failures.
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
Per the instruction for this change, the project, test runner, and JavaScript
modules were not executed. These tests remain awaiting the next authorized
Node.js verification pass and independent canonical-byte review.
