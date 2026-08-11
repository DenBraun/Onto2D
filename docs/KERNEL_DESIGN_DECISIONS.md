# Onto2D Kernel Design Decisions

Status: companion to [KERNEL_ARCHITECTURE.md](./KERNEL_ARCHITECTURE.md) and
[FOUNDATIONAL_PAPER_ANALYSIS.md](./FOUNDATIONAL_PAPER_ANALYSIS.md).

This document records important normalizations, corrections, exclusions, and
open scientific inputs. It explains decisions that are easy to misread when
implementing the normative architecture. It is not a second specification; if
the documents conflict, the architecture is authoritative.

## 1. Closure source and coordinate axes

The default source for depth `d + 1` is the complete admitted closure below the
target, `Sigma_<=d`. A package may explicitly select `previous-only`, which uses
exactly `Sigma_d`. The choice is materialized in normalized run configuration
and participates in the run hash.

Kernel derivation depth, ontology level, ontology phase, catalogue level,
catalogue phase, and predicate execution phase are independent axes. No value
on one axis may be inferred from another without an explicit mapping artifact.
Every reported axis carries provenance.

## 2. Counting and selectivity

Raw decorations, canonical candidates, evaluated candidates, locally eligible
candidates, selector-retained candidates, and admitted structural elements are
different populations. Results retain all reconciliation counts.

The primary research output has two dimensions:

- Boolean selectivity measures hard admissibility over evaluated canonical
  candidates;
- variational selectivity measures optimum concentration inside complete
  competition cohorts.

An incomplete enumeration, an exhausted budget, or an indeterminate member
must not be silently removed from a denominator. Affected metrics become
non-interpretable and carry reasons. Singleton cohorts record zero observed
variational concentration; they are not described as maximally selective.

Counting domains are explicit:

- `profile-quotient` counts profile classes;
- `element-exact` counts concrete elements;
- `single-candidate` validates one supplied candidate.

Values from different domains are not directly comparable unless an explicit
multiplicity-preserving projection is available.

## 3. Canonical identity

Canonical identity is domain-separated and versioned. Equal payload bytes in
different domains do not produce equal identifiers.

Ordinary source IDs, citations, evidence state, timestamps, and execution
metadata are non-structural by default. Primitive and profile identity uses the
normalized structural content selected by the hashed identity policy.
Quantity value, unit, tolerance, and semantic meaning may be structural;
quantity evidence remains in package/run provenance without changing ordinary
primitive or profile identity.

Minimum derivation depth is not embedded in element structural identity. The
same structural element may later acquire an alternate derivation without
changing its ID. Depth remains bound to `depthBasis` and derivation artifacts.

## 4. Candidate and skeleton semantics

Candidate node indices and edge-array order are input-local. Exact decorated-
candidate canonicalization uses refinement and exhaustive individualization;
simple-skeleton canonicalization uses the complete node-permutation orbit.
Both consume a declared shared search budget.

Candidate identity retains:

- counting domain;
- node element/profile references;
- direction and role;
- enabled parallel multiplicity and self-loops;
- declared structural node and edge attributes;
- the derived skeleton ID.

The skeleton projection is an undirected unlabelled simple graph. It discards
direction, roles, parallel copies, and self-loops. Connected-unlabelled counts
therefore belong to skeleton generation, not decorated multigraph generation.

Non-structural annotations never affect candidate identity. Exhausting exact
canonical search emits no partial identifier.

Finite decoration uses canonicalized node and edge variant alphabets. Each
simple adjacency receives one directed variant unless parallel edges are
enabled, in which case it receives a bounded multiset; enabled self-loops are
optional bounded multisets per node. Input-local variant and edge order is
non-semantic. Raw decorations, graph-policy exclusions, store attempts,
canonical candidates, and duplicates are counted separately. This executable
boundary is recorded in ADR-0015; it deliberately does not infer package role
guards or authorize partial pruning.

The first package/run bridge is intentionally narrower than closure
generation. RunConfig materializes only documented budget defaults and hashes
canonical set order. A supplied loaded package is reproduced by the current
loader under an independently expected kernel version before its primitive
element IDs or profile hashes are accepted.
`element-exact` binds every primitive ID; `profile-quotient` binds one profile
hash per class and records the lexicographically smallest member ID as the
representative. Roles come from the declared run alphabet, not observation of
the package. Unsupported disconnected universes, single-candidate input,
derived structural attributes, and unenforceable time/memory limits fail
before traversal. This boundary is recorded in ADR-0016. Derived closure-depth
population selection, profile guards/capacities, and partial pruning remain
separate decisions.

Primitive population identity is now an explicit intermediate artifact rather
than an ID list embedded only in generation. The materializer replays the
loaded package, reconstructs every primitive identity basis and canonical form,
adds depth-zero and axis provenance without changing structural identity, and
hashes the complete population. The package bridge selects that population for
target depth one and preserves `all-below` versus `previous-only` even though
both select `[0]`. It does not accept fabricated derived elements. This
boundary is recorded in ADR-0018; multi-depth derived selection still requires
formation, admission, and profile artifacts.

Graph-predicate execution is a separate, verified boundary. The evaluator
reproduces a compiled plan before use and canonicalizes the candidate before
emitting outcomes or witnesses. Complete `degree` is universal over the
selection and counts one per incident edge record; empty selections are
indeterminate. Paths are directed and may be zero-length for equal endpoints.
Cycle projection keeps directed reciprocal dyads distinct from
undirected-simple triads. These choices and the partial diagnostic boundary are
recorded in ADR-0017.

The v1 package-bound local filter composes the verified population, run
binding, canonical candidate, and graph evaluator without claiming closure.
The filter reproduces the package and binding, proves that the candidate could
be emitted by the bound decorator (including non-parallel undirected edge-group
multiplicity), discloses exact or profile-representative constituent
resolution, and evaluates every graph-only top-level plan. Failure dominates
indeterminate, which dominates local eligibility. Local eligibility is not
selector admission and cannot materialize a derived element without a selected
formation record and deterministic derived profile. This boundary is recorded
in ADR-0019.

The v9 package filter adds only the numeric subset whose runtime meaning is
already closed. `local-predicate-evaluator-v8` reproduces a plan and its run
numeric binding, then combines graph operators with scalar constants, direct
constant quantities, canonical node/edge counts, and exact dimensionless
addition/multiplication. It also sums finite scalar or Quantity-valued
structural attributes in canonical selection order under exact-decimal or
compensated-binary64. Quantity sums validate declared unit/semantic metadata,
conservatively sum effective absolute tolerance bounds, and retain computed
evidence provenance. Compatible Quantity constants, sums, and nested additions
compose recursively with additive absolute bounds and computed provenance. A
sole Quantity factor can be scaled by dimensionless number expressions while
preserving its semantic and scaling its absolute bound by the scalar magnitude.
In `element-exact`, a Quantity invariant resolves only from an explicit,
source-population-bound context and must select one canonical node; its source
Quantity and resolution enter the evaluation artifact. `profile-quotient`
invariants remain rejected until class-wide consensus semantics are frozen.
Node/edge `balance` reuses the typed attribute-sum path, rounds the signed
aggregate once, and compares its absolute magnitude to the explicit Quantity
threshold. Source-aggregate and threshold uncertainty combine only through the
bound maximum-declared-tolerance rule; compensated arithmetic remains a
separate approximation flag.
The unrounded value and its approximation state are explicit, and rounding
occurs once per comparison operand. Scalar invariants, functional coefficients,
cycle sets, general Quantity products,
and substructures fail preflight because their missing binding or tolerance
semantics are not defaults. The current hash domains are versioned for these
artifacts. The baseline, three attribute extensions, two derived-arithmetic
extensions, exact-domain invariant extension, and balance extension are
recorded in ADR-0020 through ADR-0027.

## 5. Predicate monotonicity and explanations

Monotonicity belongs to a violation under declared extension operations, not to
a predicate name in isolation. Under additive graph extension:

- exceeding a maximum role count or maximum degree is monotone;
- being below a required minimum is repairable and therefore not monotone;
- containing a forbidden cycle is monotone under edge addition;
- lacking a required cycle is repairable and therefore not monotone.

Static inference is preferred for known expressions. Randomized audits are
falsification attempts, not proofs. Bounded differential tests compare pruning
with pruning disabled.

Compiled predicate plans therefore keep four facts separate: the package's
`monotoneViolation` declaration, static failure persistence, availability of a
partial failure witness, and the mandatory audit flag. An unproved declaration
is `blocked-unproven`; passing randomized samples cannot promote it to pruning
authority. Canonical-index degree checks are complete-candidate references and
are not assumed stable while a partial graph is still being canonicalized; the
same applies to canonical-index path endpoints. Lower-bound degree passes over
selectors whose membership can grow are not marked persistent.

Every complete canonical candidate receives a full verdict. Short-circuiting
may optimize execution but cannot erase outcomes, witnesses, or census data for
other required predicates. Pruned partial branches use a separate pruning
census and never enter completed-candidate denominators.

The current partial graph evaluator deliberately emits
`pruningAuthorized: false`, including when it detects a statically persistent
failure. Static proof, runtime witness, audit evidence, and authorization to
change the enumerated universe are four distinct facts. No generator consumes
that diagnostic until the audit/controller contract and pruning-disabled
differential gate exist.

## 6. Quantities, ranking, and sensitivity

Scientific values use typed quantities with units, tolerance, semantic meaning,
and provenance. Numeric equality is tolerance-aware; raw binary floating-point
equality is not a scientific comparison rule.

Compiled predicate plans remain package-owned and reusable. A separate hashed
numeric binding combines one verified plan with the run precision policy,
canonical selection order, and the versioned maximum-declared-tolerance rule.
It inventories numeric operations but does not resolve or evaluate values.

Predicates return `pass`, `fail`, or `indeterminate`. Functionals are separate
typed score expressions and cannot prune generation. Selectors execute only
after local eligibility filtering and retain the complete epsilon-equivalent
extremum set.

Canonical ID is a deterministic serialization tie-break and may identify a
presentation leader. It never removes a semantic tie.

Sensitivity sweeps perturb every declared free coefficient using frozen
positive amplitudes with `0 < amplitude < 1`. `one-at-a-time` is the default;
Cartesian sweeps require an explicit budget. Missing comparisons make the
report indeterminate instead of shrinking its denominator.

## 7. External scientific computation

The kernel does not solve PDEs, continuous variational equations, field
integrals, or stability problems. A versioned scientific adapter receives a
content-addressed Oracle request and returns typed values, convergence state,
residual, solver identity, parameters, and operational timing.

The kernel now validates that boundary without invoking the adapter: canonical
candidate bytes and normalized requests produce the provenance hash; solver,
parameter, unit, semantic, tolerance, residual, and evidence drift fail; and
operational wall time stays outside semantic response identity.

`failed` and disallowed `partial` results make dependent evaluations
`indeterminate`; they are never coerced to zero, `pass`, or `fail`. A permitted
partial result must satisfy the frozen residual guard and record its effective
tolerance.

## 8. Source relations and SCC condensation

Catalogue `ParentCode` is not generative by default, and one catalogue card is
not automatically one kernel element. Relation classification uses six
categories:

- `generative`;
- `constitutive`;
- `intra-closure-support`;
- `evidential`;
- `descriptive`;
- `regulatory-feedback`.

Rules, examples, exclusions, exposure status, and fitting-risk thresholds are
frozen before eligible classification sees SCC membership or acyclicity
consequences. Previously exposed work is labelled `historically-exposed`; it is
not represented as blind discovery.

Every nontrivial formation-support SCC receives one explicit disposition:

- `distributed-structure`;
- `constitutive-cluster`;
- `unresolved-generative-cluster`;
- `mixed-unresolved-cluster`.

Each surviving component becomes one stratification vertex with
`internalOrder = "undefined"`. Members inherit one depth and `depthBasis`.
Condensation yields a DAG by construction; raw source edges are not deleted.
Evidential, descriptive, regulatory, and absorbed internal relations remain in
typed explanation layers.

Node merging cannot use “this removes a cycle” as a criterion. SCC size and
structural resemblance are diagnostics only. Resolution reports quantify merge,
condensation, nonformation-layer separation, descriptive resolution, and
post-unblinding reclassification shares.

The kernel implements the neutral freeze boundary for these two policies. It
requires complete category/disposition rule sets, cross-checks exposure claims,
sorts set-valued fields, and derives separate domain hashes. This is contract
validation, not policy authorship: ADR-0001 and ADR-0002 still contain no
catalogue classifications or component resolutions.

The next neutral boundary freezes caller-supplied raw annotations and
adjudication. It requires complete independent human matrices or exactly the
precommitted deterministic classifier, derives rather than trusts disagreement,
prevents adjudication from overwriting unanimous labels, and records canonical
freeze/unblinding times. It does not provide the annotation UI, authenticate a
clock, or assign a category to any current catalogue edge.

The catalogue adapter then constructs the exact policy-visible relation view
and can project a verified caller-supplied decision chain into typed relations.
It computes both the generative and broader formation-support SCC partitions
over relation endpoints. Component identity includes complete internal typed
endpoint relations; input/traversal order is non-semantic. Isolated catalogue
cards, node dispositions, and condensation remain separate reconciliation
steps, so this projector cannot claim a completed migration.

The Level-0 component `{0.8, 0.21, 0.22}` is a registered candidate for one
distributed closure-bearing structure or a constitutive cluster. Its shape is
not proof that it is identical to the paper's resonant triad.

## 9. Reproducibility decisions

Semantic hashes exclude timestamps, wall-clock duration, machine paths, and UI
metadata. Operational manifests may contain them separately.

Null models are explicit configuration, not mandatory hidden defaults. Seeds,
trial counts, graph conventions, sampling measures, degenerate-statistic
behavior, and interpretation thresholds participate in the run identity.

When null variance is zero, the z-score is `null`. The report records whether
the observation equals or differs from the constant null value; it does not
emit infinity or `NaN`.

## 10. Deliberate exclusions

The kernel does not contain:

- a visual editor or UI state;
- product workflows or marketplaces;
- a temporal simulation engine;
- arbitrary executable code from rule packages;
- undocumented scientific datasets or inferred empirical validation;
- a continuous numerical solver;
- hidden environment-dependent defaults.

Names such as `energy`, `mass`, `field`, and `particle-like` retain the
structural meanings declared by their package until separate evidence supplies
an empirical interpretation.

## 11. Open scientific inputs

Software contracts cannot manufacture missing research definitions. Case
packages still need frozen choices for:

- unit systems and normalization maps;
- coefficient values and uncertainty;
- contested-resource cohort keys;
- selector epsilon and sensitivity thresholds;
- perturbation domains and stability thresholds;
- oracle methods, residual semantics, and certificates;
- external datasets, preprocessing, graph conventions, and null hypotheses;
- carrier-promotion rules between ontology levels.

Absent inputs produce incomplete packages or traceable indeterminate results,
not fabricated scientific conclusions.
