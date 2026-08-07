# Kernel Implementation Status

Status: deterministic package, graph identity, quantity/decimal arithmetic,
typed value/Boolean analysis, predicate-plan compilation, and predicate
numeric-policy binding, scientific-Oracle protocol validation, and source-
policy plus classification-annotation artifact freeze contracts implemented;
catalog-adapter classified-relation/SCC projection implemented for verified
caller-supplied data; independent conformance and local Node.js 20/22 execution
complete, cross-platform review and the closure pipeline pending.

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
- `kernel.js` exposes `createKernel().loadPackage()`,
  graph/skeleton canonicalization, connected-skeleton enumeration,
  CandidateStore creation, quantity/decimal operations, value/Boolean
  analysis, predicate-plan compilation, predicate numeric-policy binding,
  Oracle request/response validation, source-policy and annotation/adjudication
  freezing, and a truthful capability manifest.

`@onto2d/catalog-adapter` retains its non-mutating source audit and now also
constructs a policy-limited classification view. From a reproducible caller-
supplied policy/annotation/adjudication chain it emits every classified
relation exactly once and computes deterministic directed SCC partitions for
the `generative` and `generative + constitutive + intra-closure-support`
projections. It does not apply a policy to the current catalogue.

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
Run precision does not contaminate the reusable package plan identity.
`predicate-numeric-binding-v1` verifies that plan and its analysis, records
`decimal-rational-v1`, the normalized rounding/summation policy, canonical
selection order, `declared-max-tolerance-v1`, the semantic comparison policy,
and every consuming numeric operation under a separate binding hash. The
verification reproduces all analysis witnesses and pruning metadata rather
than trusting duplicated plan fields.

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
semantic response and validation hashes. Sensitivity-report and normalized
run-configuration schemas and public types remain aligned with normative
contracts, but their evaluators are not implemented.

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
PredicatePlan + RunConfig.invariantPrecision + semantic comparison policy
  -> verified plan/analysis identities
  -> numeric-operation inventory + explicit arithmetic/tolerance policies
  -> predicate numeric binding hash
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
JavaScript runtime passes on macOS arm64 under Node.js 20.19.4 and 22.18.0.

Quantity grammar, conversion, identity, and comparison semantics are recorded
in [ADR-0006](adr/0006-multiplicative-si-quantities.md). Decimal representation,
rounding, and accumulation are recorded in
[ADR-0007](adr/0007-deterministic-decimal-arithmetic.md). Affine/logarithmic
units remain outside the implemented boundary.
Typed value-expression analysis and its hashing rules are recorded in
[ADR-0008](adr/0008-typed-value-expression-analysis.md). Boolean-expression
analysis, persistence inference, and plan compilation are recorded in
[ADR-0009](adr/0009-predicate-analysis-and-plans.md). Expression and predicate
execution remain pending.
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

Source IDs, claims, and evidence do not enter ordinary primitive structural
identity by default. The provisional cluster identity branch binds the frozen
classification policy, node-resolution artifact, condensation artifact, and
disposition rather than review timestamps or annotator identity. It remains
unreachable until migration reconciliation is implemented. The exact
provisional decision is recorded in
[ADR-0003](adr/0003-canonical-identity-foundation.md).

The schemas now describe frozen source policies, annotation/adjudication,
classification views, typed-relation/SCC projections, downstream classified
relations, and condensed clusters. These pre-migration artifacts can be
constructed independently, but the foundation loader rejects `sourceMigration`
and condensed-cluster inputs with explicit
`SOURCE_*_FOUNDATION_UNAVAILABLE` issues. They cannot be loaded until complete
node/edge reconciliation, reviewed dispositions, and condensation validation
exist.

## Explicitly pending

- candidate decoration, partial streaming/pruning, and the integrated generator
  state machine;
- value-expression and predicate execution, including three-valued evaluation
  and witnesses;
- cohort construction and functional ranking;
- sensitivity, baselines, profiles derived from rules, closure, and ladder
  execution;
- actual source-policy authorship, access-controlled annotation collection,
  application to the current catalogue, isolated-node reconciliation, reviewed
  node resolution, and condensation execution;
- explanation and artifact indexes;

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
byte-identical fixture hashes. Its first JavaScript comparison exposed two
non-minimal canonical representatives at five nodes. Skeleton labeling was
therefore changed, before identity freeze, to evaluate the complete node
permutation orbit and select the global canonical edge serialization. The full
117-test suite, repository checks, and build validation now pass on macOS arm64
under Node.js 20.19.4 and 22.18.0. Independent review and completed runs on
additional supported platforms remain open, so ADR-0003 through ADR-0005
retain proposed status.
