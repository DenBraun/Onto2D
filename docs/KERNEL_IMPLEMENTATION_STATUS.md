# Kernel Implementation Status

Status: deterministic package, normalized RunConfig and package/run candidate
binding, verified primitive depth-population materialization, graph identity,
finite decorated-candidate enumeration,
quantity/decimal arithmetic, typed value/Boolean analysis,
predicate-plan compilation, verified graph-only evaluation and partial
persistent-failure diagnostics, package-bound local numeric
candidate filtering, numeric-policy binding, scientific-Oracle protocol validation, and
source-policy plus classification-annotation artifact freeze contracts
implemented;
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
  representatives, binds the RunConfig role alphabet and complete connected
  skeleton set, hashes the package/run/execution basis, and executes the
  resulting finite universe;
- `package-candidate-filter.js` reproduces the loaded package and complete
  candidate binding, re-canonicalizes a candidate under the bound policy,
  proves its domain/budget/skeleton/node/edge/adjacency-group membership,
  resolves every canonical node to an exact element or disclosed profile
  representative, rejects unavailable node/edge predicate attributes against
  their respective structural alphabets before they can become empty
  selections, reproduces every plan's run numeric binding,
  evaluates every graph or supported local-numeric top-level predicate, and
  emits a content-addressed local verdict without claiming selector admission;
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
- `local-predicate-evaluator.js` composes the complete graph runtime with
  scalar/direct-quantity comparison, canonical node/edge counts, exact
  dimensionless addition/multiplication, boundary-only rounding, and verified
  predicate numeric bindings while rejecting unfrozen value sources and
  aggregate value/selection limit exhaustion before evaluation;
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
  compare predicate evaluation, package-bound local filtering and partial-failure diagnostics,
  predicate numeric-policy binding, Oracle request/response validation,
  source-policy and annotation/adjudication freezing, and a truthful capability
  manifest.

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

`graph-predicate-evaluator-v1` uses the same reproduced-plan boundary and
accepts only `all`, `any`, `not`, `degree`, `cycleExists`, `connected`,
`componentCount`, `pathExists`, and `countRole`. It binds a complete canonical
candidate, effective graph policy, three-valued result, and canonical-index
witnesses in a separate evaluation hash. `partial-graph-predicate-evaluator-v1`
accepts only bounded partial graph data and only runs a plan already marked
`static-proven`; even a detected persistent failure records
`pruningAuthorized: false` until the required audit/controller artifact exists.

`local-predicate-evaluator-v8` verifies both plan and numeric-policy binding,
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
binary64 multiplication. An `element-exact` Quantity invariant resolves only
from an explicit context covering the candidate's exact source elements; the
artifact binds its source-population hash and a normalized source-Quantity
resolution witness. Complete node/edge balance aggregates the declared
attribute through the same path, rounds once, and compares its absolute
magnitude with the explicit Quantity threshold under the bound tolerance
policy. Profile-domain/scalar invariants, functional coefficients, general
Quantity products, cycle-set counts, and substructure operators fail preflight
rather than acquiring hidden defaults.

`package-candidate-filter-evaluator-v9` composes these verified boundaries for
one complete package candidate. It reconstructs the complete binding from the
recorded normalized run and execution limits, rejects candidates outside the
bound decoration universe, and retains the canonical candidate plus exact or
profile-representative constituent resolution as a formation basis. It
preflights every top-level plan for local support, derives each numeric binding
from the reproduced run precision, rejects attributes absent from the bound
decoration alphabet, and evaluates all plans without top-level short-circuiting.
Failure takes precedence over
indeterminate; otherwise the result is locally `eligible`. This is not final
admission: selectors, derived profiles, and element materialization remain
absent.

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
semantic response and validation hashes. Sensitivity-report schemas and public
types remain aligned with normative contracts, but their evaluators are not
implemented. Normalized RunConfig is now executable for validation, budget
materialization, hashing, primitive `Element` population selection, and package
candidate binding; derived closure evaluation still does not consume it.

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
JavaScript runtime passes on macOS arm64 under Node.js 20.19.4 and 22.18.0.

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
[ADR-0027](adr/0027-local-balance-evaluation.md); the remaining runtime value
sources, general Quantity products, cycle sets, and substructures remain pending.
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
[ADR-0027](adr/0027-local-balance-evaluation.md).

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

- derived-depth source-population selection, selector admission and selected
  formation/profile materialization artifacts, profile guard/capacity and
  structural-attribute derivation, partial streaming/pruning authorization,
  pruning census, and resumable generator state;
- profile-domain/scalar invariant resolution, functional/coefficient execution,
  general Quantity products, cycle-set and remaining value-expression and
  substructure predicate execution,
  and level censuses;
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
The finite decorator preserves this existing behavior and accepts only
explicitly structural attributes. The asymmetry remains recorded for policy
review before derived profile attributes feed integrated closure generation.

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
equality, relabeling invariance, stale numeric bindings, and explicit rejection
of scalar/profile-domain invariants and multi-Quantity products. Invariant
fixtures additionally cover exact-element singleton/selector resolution,
population/context drift, missing values, unit/semantic mismatch, retained
provenance/tolerance, and package-derived contexts.
Balance fixtures cover closed scalar thresholds, threshold and aggregate
uncertainty, exact/compensated state, boundary-only rounding, mixed SI units,
semantic policy, empty selections, runtime data failures, and cycle rejection.
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
185-test suite, repository checks, schema-compilation/runtime-artifact
conformance, and build validation now pass on macOS arm64
under Node.js 20.19.4 and 22.18.0. Independent review and completed runs on
additional supported platforms remain open, so ADR-0003 through ADR-0005
retain proposed status.
