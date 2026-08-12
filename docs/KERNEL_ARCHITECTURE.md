# Onto2D Kernel Architecture

Status: normative target architecture. The current implementation boundary is
tracked separately in [KERNEL_IMPLEMENTATION_STATUS.md](./KERNEL_IMPLEMENTATION_STATUS.md).

Source basis:

- [*Topology of arising and the principle of minimal action in admissibility structures*](../scr/topology-of-arising.pdf), 36 pages, SHA-256 `3992ae25c5e499842a57b07dea0d2f9d206ee3483d634fb9053af39dc260a8f7`.

Supporting documentation:

- the paper-to-kernel analysis in [FOUNDATIONAL_PAPER_ANALYSIS.md](./FOUNDATIONAL_PAPER_ANALYSIS.md);
- the design rationale, SCC policy, exclusions, and unresolved research inputs in [KERNEL_DESIGN_DECISIONS.md](./KERNEL_DESIGN_DECISIONS.md).

## 1. Purpose

The Onto2D kernel is an admissibility-closure engine. It has one primary responsibility:

> Enumerate structurally possible compositions, evaluate every declared admissibility predicate, apply any declared cohort-level selection principle, measure transition selectivity, group admitted results by compositional profile, and explain every admission or rejection.

Validating one supplied configuration is a degenerate kernel run in which the candidate set has one member. The kernel is not a generic semantic engine and is not the editor, simulation runtime, product layer, or package marketplace.

The kernel exists because a selectivity profile cannot be derived reliably by manual inspection. Its principal research output is the selectivity ladder across closure depths.

## 2. Normative language and architectural status

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

This document defines the intended behavior and boundaries of the kernel. The
repository currently contains dependency-free runtime packages plus a pinned
development-only schema validator, guarded canonical JSON, domain-separated
hashes, a deterministic schema-v1 package loader,
normalized RunConfig materialization, verified primitive depth-zero `Element`
populations, multiplicative SI quantity normalization, deterministic decimal
arithmetic, typed value/Boolean expression analysis, predicate-plan
compilation, graph-only predicate evaluation and partial-failure diagnostics,
package-bound local numeric candidate filtering and complete local-filter
censuses, package-bound finite functional evaluation, complete package-cohort
partitioning, selector ranking/sensitivity, deterministic multi-selector
admission, selected-formation materialization, run-specific numeric-policy binding,
content-addressed scientific-Oracle
validation without solver execution, neutral content-addressed source-policy
and annotation/adjudication freeze contracts without catalogue classification,
adapter-side policy-limited classification views and deterministic typed-
relation/SCC projections for caller-supplied data, exact canonicalization for
supplied candidate graphs and their skeletons, a bounded reference enumerator
for connected unlabeled simple skeletons through six nodes, deterministic
finite decoration from explicit node/edge alphabets, verified content-addressed
package/run binding for the materialized primitive population, deterministic
opt-in complete-candidate profile-slot composition gates over exact capacity
and typed partner guards, a deterministic CandidateStore, initial contracts
and schemas, source locks, and a source-
catalogue audit. Source-policy authorship, access-controlled annotation
collection, application of the reviewed current catalogue, and remote artifact
stores remain external project inputs/adapters. Primitive, generalized-depth,
and round-specific current-level
null-model execution and baseline comparison are implemented. Generic reviewed
source resolution/condensation, explanation
indexes, local run persistence, and formation-functional profile invariant
derivation plus formation-derived type classification are implemented.
Generalized explicit depth
transitions, bounded ladder closure, profile-collapse conformance, and level-
boundary diagnostics plus explicit carrier-promotion target inputs and bounded
current-level fixpoint closure are implemented. Normalized run-target ontology
coordinates and their independent axis provenance materialize on ordinary,
arbitrary-depth, and current-level results and derived elements. The concrete
implementation boundary is
documented in
[KERNEL_IMPLEMENTATION_STATUS.md](./KERNEL_IMPLEMENTATION_STATUS.md), and the
repository layout in [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

## 3. Scope

### 3.1 In scope

The kernel MUST provide:

- deterministic package loading and validation;
- validation of edge-preserving source classification, cluster condensation, and typed explanation-layer artifacts;
- depth-stratified admissibility evaluation;
- connected candidate skeleton enumeration;
- directed, role-labelled multigraph decoration;
- safe pruning through monotone-violation predicates;
- graph canonicalization and isomorphism deduplication;
- a typed declarative predicate language;
- full predicate evaluation and rejection census;
- deterministic finite-cohort `argmin`/`argmax` selection;
- complete ranked-cohort, degeneracy, gap, and coefficient-sensitivity reporting;
- candidate-level explanations with witnesses;
- typed scientific quantities, tolerances, and evidence provenance;
- a content-addressed external-oracle protocol with explicit convergence handling;
- profile extraction and profile-equivalence classes;
- bounded profile-collapse measurement and level-boundary detection;
- explicit carrier-promotion artifacts between ontological domains;
- level closure and multi-level closure ladders;
- role-shuffle, degree-preserving rewire, and uniform null models;
- content-addressed run manifests and frozen predictions;
- conformance commands for canonicalization, monotonicity, and profile collapse;
- JSON-compatible inputs and outputs with a TypeScript API.

### 3.2 Explicitly out of scope

The following MUST NOT be implemented inside the kernel package:

- a visual editor or canvas;
- product catalogues or product-specific workflows;
- goal solving or completion planning;
- a temporal runtime or event engine;
- a continuous PDE, variational-calculus, or field-integration solver;
- epistemic contexts;
- a plugin host or package registry;
- UI state, visualization, or reporting presentation;
- application products.

These capabilities may be implemented as shell packages that depend on the kernel. The kernel MUST NOT depend on them.

## 4. Formal model

Let:

```text
Sigma_d          = admitted elements whose minimum derivation depth is d
Sigma_<=d        = union of Sigma_i for 0 <= i <= d
Gen(Sigma_d, B)  = canonical candidate classes generated under budget B
Phi              = a frozen ordered set of local admissibility predicates
kappa            = a frozen partition of eligible candidates into competition cohorts
F                = a frozen typed functional evaluated after local eligibility and consumed only for a complete cohort
~=               = candidate isomorphism under the declared graph semantics

Eligible_(d+1) = { c in Gen(Sigma_<=d, B) : Phi(c) = pass } / ~=
Cohorts_(d+1) = kappa(Eligible_(d+1))
Degenerate(q) = { c in q : F(c) is epsilon-equivalent to optimum(q) }
Sigma_(d+1)   = union of Degenerate(q) for every complete cohort q

booleanSelectivity_d       = eligibleCandidates_d / evaluatedCandidates_d
variationalSelectivity_q   = 1 - |Degenerate(q)| / |q|
selectionRetention_d       = selectedCandidates_d / eligibleCandidates_d
overallRetention_d         = selectedCandidates_d / evaluatedCandidates_d
```

The original shorthand `Gen(Sigma_d, B)` is interpreted as generation from the closure available at depth `d`, namely `Sigma_<=d`. A rule package MAY explicitly restrict generation to `Sigma_d` only; that choice MUST be present in the run configuration and hash.

### 4.1 Counting domain

Every selectivity value MUST identify its counting domain:

- `profile-quotient`: candidates refer to profile classes and are counted after profile equivalence and graph isomorphism;
- `element-exact`: candidates refer to concrete element IDs and are counted after graph isomorphism;
- `single-candidate`: one caller-supplied candidate is evaluated.

The default production mode is `profile-quotient`. Values from different counting domains MUST NOT be compared as if they had the same denominator. A profile-collapse conformance run compares the verdicts and admitted structures after projection into the same profile domain; raw selectivity values are comparable only when exact multiplicity weighting is available.

The scientifically primary selectivity profile is two-dimensional: Boolean selectivity measures hard admissibility, while variational selectivity measures concentration of the optimum within each competition cohort. `selectionRetention` and `overallRetention` remain useful reconciliation metrics, but they MUST NOT be substituted for variational selectivity. For one selector, the level-wide variational summary is `1 - sum(degeneracy_q) / sum(|q|)` over complete interpretable cohorts; it is `null` rather than computed from a silently reduced population if a required cohort is indeterminate. The summary MUST be accompanied by every per-cohort value.

### 4.2 Interpretable selectivity

Selectivity is interpretable only if:

- candidate generation completed without exhausting a hard budget;
- canonicalization, filtering, and cohort selection completed successfully;
- the evaluated candidate count is non-zero;
- the counting domain is declared;
- any sampling-based denominator is explicitly reported as an estimate;
- every required oracle result is converged or accepted under a frozen partial-result policy;
- the run manifest and random seed are available.

If any hard budget is exhausted, the result MUST set `interpretation.status` to `truncated`, and the selectivity MUST NOT be compared across depths or runs.

When `evaluatedCandidates = 0`, Boolean selectivity and overall retention are `null`. When `eligibleCandidates = 0`, selector retention is `null` and no selector optimum exists. Variational selectivity is `null` for an empty cohort. These are empty-domain results, not zero-valued measurements.

Each metric has its own interpretation status. A fragile coefficient-sensitivity verdict invalidates interpretation of the affected variational selectivity but does not erase the raw ranking or Boolean selectivity. An excessive indeterminate ratio invalidates every metric whose numerator or cohort membership it could change. The relevant thresholds and reasons are frozen run inputs.

### 4.3 Main outputs

One closed level produces:

- admitted canonical elements for the next depth;
- Boolean selectivity, per-cohort variational selectivity, reconciliation retention ratios, and their exact denominators;
- a census of all predicate outcomes;
- complete ranked cohorts, score-equivalent extrema, degeneracy, gaps, coefficient sensitivity, exclusions, and witnesses;
- detected inert and dominating predicates;
- profile-equivalence classes;
- null-model distributions and standardized effects;
- an explanation for every retained candidate record;
- a content-addressed semantic manifest;
- an execution record containing operational metadata.

A ladder run returns ordered pairs `[(booleanSelectivity_0, variationalProfile_0), ...]`, reconciliation ratios, and all level and cohort results. It MUST NOT flatten the cohort distribution into one unexplained scalar.

## 5. Foundational design decisions

### 5.1 Depth stratification

A predicate deriving admissibility at depth `d + 1` MAY reference only admitted elements from `Sigma_<=d`. A reference to the currently computed level is a package-load error unless bounded fixpoint mode is explicitly enabled.

This rule makes unstratified negation, oscillating fixed points, and multiple implicit models structurally unavailable in the default execution mode.

An element's `depth` is the minimum depth among all known derivations relative to the frozen primitive basis of that run. Every depth value carries a `depthBasis` hash. If a later derivation proves a smaller depth under the same basis, the index MUST be updated without changing the element's content-derived ID. Depths from different runs MUST NOT be compared unless their basis hashes are equal.

Kernel derivation depth is a metric relative to a basis. Ontology level is a declared or explicitly computed partition associated with carrier change. Ontology phase is a declared partial order of conditions, not a distance. These axes are independent. In particular, the foundational paper's ontology `Level 0`/`Level 1`, its phases A–D, the source catalogue's `Level`/`Phase`, and predicate execution phases MUST NOT be inferred from one another. A rule package MAY attach an `OntologyCoordinate` to elements and transitions, but the mapping to derivation depth and the provenance of every axis MUST be explicit and hashed.

The loader validates `phasePrecedence` as an acyclic relation; it does not invent distances between phases. Every aggregate and plotted series names its `AggregationAxis`. A series by derivation depth and a series by ontology level are different objects and MUST NOT be compared point-by-point merely because both use integer-looking labels.

Source `ParentCode` relations are not generative by default, and one catalogue card is not assumed to equal one kernel element. The current catalogue contains three nontrivial strongly connected components, including `{0.8, 0.21, 0.22}` at Level 0. The adapter resolves them by typed condensation, never by deleting inconvenient edges.

The source-relation categories are frozen before annotation:

| Kind | Decision rule | Stratification effect |
|---|---|---|
| `generative` | without source `A`, target `B` is not derivable because `A` is a constituent of `B`'s formation rule | inter-cluster dependency; MUST be acyclic after condensation |
| `constitutive` | the identities/definitions are mutually dependent and neither endpoint has justified precedence | participates in joint-constitution SCCs; no internal depth order |
| `intra-closure-support` | the endpoints are cards or aspects internal to one closure-bearing structure rather than distinct ladder units | candidate distributed-structure merge; remains an internal graph edge |
| `evidential` | `A` is a reason or evidence for accepting a claim about `B` | evidence/explanation layer only; never affects depth |
| `descriptive` | analogy, taxonomy, classification, navigation, or see-also relation | presentation/explanation layer only; never affects depth |
| `regulatory-feedback` | a domain process feeds back between already identified structures without constituting formation precedence | typed dynamic/explanation layer; never affects default depth |

For a research migration, the classification policy, examples, exclusions, and policy hash MUST be frozen before classifiers can see SCC membership, cycle visualizations, or the effect of an annotation on acyclicity. Classifiers may see source card contents and local relation fields. Human annotation requires at least two independent classifications; conflicts are adjudicated under the same blind view. Alternatively, a deterministic classifier is allowed only when its complete rule set and version were frozen before it receives SCC-aware input. The raw annotations, disagreements, adjudication, annotator/tool identities, prior-exposure declarations, and unblinding time are retained as immutable artifacts.

The current audit already publishes all three SCC memberships. A person who has read that audit cannot be represented as prospectively blind. Research-grade annotation must therefore use new classifiers who have not seen SCC-aware documents, or a deterministic precommitted classifier. If neither is possible, the migration remains executable but is labelled `historically-exposed`; reports MUST NOT claim blind discovery and MUST elevate fitting-risk interpretation.

After classification annotations and exposure status are frozen, the adapter computes SCCs on both the `generative` projection and the broader formation-support projection (`generative + constitutive + intra-closure-support`). Each nontrivial component receives a separately reviewed node-resolution disposition:

- `distributed-structure`: several catalogue cards encode one structure; materialize one cluster element and preserve the cards as member views;
- `constitutive-cluster`: several distinguishable structures arise jointly; preserve them as addressable members of one stratification unit;
- `unresolved-generative-cluster`: indispensable dependencies are cyclic and internal precedence cannot be justified;
- `mixed-unresolved-cluster`: the component contains incompatible formation readings and remains explicitly unresolved.

Every surviving SCC becomes one cluster-level stratification vertex with `internalOrder = "undefined"`. Its members inherit the cluster depth and MUST NOT be assigned relative depths. Condensation of the cluster graph is a DAG by construction; the default depth index is computed on that quotient. The acyclicity invariant therefore applies to inter-cluster `generative` edges, not to raw catalogue cards. A nontrivial raw generative SCC is not silently relabelled constitutive merely to obtain this result.

Evidential, descriptive, regulatory-feedback, and absorbed internal edges are not removed. They move to separately typed, content-addressed relation layers and remain traversable from the explanation graph. Bounded fixpoint mode remains relevant to actual runtime self-reference between kernel derivations; it is not required merely to preserve a source SCC that has been materialized as one cluster input.

The generic executable adapter contract is frozen by
[ADR-0061](adr/0061-reviewed-source-resolution-and-condensation.md). It replays
the full supplied classification chain, requires an inventory that includes
isolated records, derives cluster membership from the verified
formation-support partition, checks reviewed dispositions/rationales and every
relation destination, retains all six typed layers, and proves the inter-vertex
generative quotient is a DAG. It is intentionally not an authored migration of
the current repository catalogue.

Approved post-unblinding changes are applied by the separately hashed
effective projection defined in
[ADR-0065](adr/0065-effective-source-classification-reprojection.md). It keeps
the blind kind and raw votes beside the current kind, recomputes both SCC
partitions, and makes any stale component disposition or edge destination fail
before a new condensation can be emitted.

### 5.2 Profile factorization

A profile is a canonical multiset descriptor of the roles an element may occupy in the next composition. It contains role slots, polarities, capacities, optional partner guards, and a normalized invariant vector.

The production generator composes profile classes rather than expanding every concrete member. This is both a scaling mechanism and a falsifiable theoretical claim:

> Elements with equal profiles are interchangeable for every observable used by composition and admissibility.

The claim MUST be tested in `element-exact` mode on bounded fixtures. A mismatch MUST be reported with the smallest known counterexample; the implementation MUST NOT alter profiles or predicates automatically to hide it.

### 5.3 Safe pruning by monotone violations

A violation is extension-monotone when a partial candidate that violates a predicate cannot become valid through an allowed extension. Only predicates with this property and a defined partial-evaluation semantics may prune generator branches.

`monotoneViolation` is a rule-package assertion, not proof. Before generation, the kernel MUST:

1. statically check the assertion where the expression language supports inference;
2. reject assertions that contradict a known built-in rule;
3. run the configured randomized substructure/extension audit;
4. record the seed, sample count, and audit result.

Any discovered counterexample fails the run before selectivity is calculated. Passing a randomized audit falsifies sampled errors but does not constitute a mathematical proof; the manifest MUST preserve that distinction.

The current `package-predicate-monotonicity-auditor-v1` realizes this gate for
the complete depth-one universe and the frozen complete-node canonical-edge-
prefix extension model. It uses RunConfig-bound SHA-256 rejection sampling,
retains every partial/extension evaluation identity, fails on a witnessed
`partial fail -> extension pass`, and exactly replays stored artifacts. The
separate `package-partial-pruning-controller-v1` authorizes only a
`static-proven` plan with a passed whole-package audit and a reproduced
persistent-failure diagnostic. Passing samples never manufacture proof. See
[ADR-0053](adr/0053-monotonicity-audit-and-pruning-controller.md).

`package-pruned-candidate-generator-v1` now prepares that controller once,
applies its decisions to canonical prefixes before CandidateStore admission,
and records raw/unique/duplicate removals plus a rolling decision transcript.
It returns only after a pruning-disabled replay proves identical complete
eligible and indeterminate result-set hashes and full filtering confirms every
removed candidate fails its authorizing predicate. This correctness-first
boundary remains the final guard used by recursive execution. See
[ADR-0054](adr/0054-audited-pre-admission-pruning.md).

`package-generator-frontier-auditor-v1` separately binds the decorator's
actual complete-node raw edge-group traversal, exact reachable descendants,
and sampled reachable extensions. Its prepared controller authorizes only a
statically proven persistent failure under passed canonical and frontier
audits. `package-recursive-pruned-candidate-generator-v1` may then close that
subtree, but returns only after exact agreement with pre-admission-only and
pruning-disabled references. Under directed-strong connectivity, it may close
only a frontier that is already strongly connected, because edge addition then
cannot turn a policy exclusion into an admitted descendant. See
[ADR-0055](adr/0055-audited-recursive-frontier-pruning.md).

`package-depth-predicate-monotonicity-auditor-v1` and the corresponding
depth-aware canonical-prefix, raw-frontier, and recursive generation contracts
extend this boundary to any target depth whose complete contiguous prior-level
chain reproduces exactly. Every artifact additionally binds `targetDepth` and
the selected source-population hash, uses depth-specific hash domains, and is
accepted only after the same disabled/pre-admission/recursive differential
checks. The optimized path is explicit and does not alter ordinary level
closure unless a caller selects it. See
[ADR-0056](adr/0056-generalized-depth-audited-pruning.md).

`package-node-frontier-auditor-v1` adds a separate raw node-prefix extension
frame. Its controller validates the exact assigned-node state and descendant
count before a static persistent failure may authorize
`package-node-growth-pruned-candidate-generator-v1`. The generator retains the
complete-candidate pre-admission guard and returns only after exact differential
agreement. Depth-aware variants bind the prior chain, target depth, and source
population under separate domains. Directed-strong node prefixes are not
authorized because future direction choices can still change policy exclusion
counts. See [ADR-0082](adr/0082-audited-node-growth-pruning.md).

`package-profile-pruning-extension-census-v1` independently classifies every
graph-policy-admissible raw extension against the complete profile gate and
aggregates exact compatible/excluded counts onto each stable edge-group or
node-assignment prefix. An authorized live frontier must reproduce its hashed
census key and descendant sum. Recursive and node-growth generators then
reconcile skipped profile dispositions with the authoritative pre-admission
profile transcript and retained result sets at depth one or arbitrary verified
target depth. See
[ADR-0084](adr/0084-profile-gated-raw-frontier-pruning.md).

### 5.4 Complete census rather than short-circuit diagnostics

All top-level predicates MUST be evaluated for every complete candidate that reaches filtering, even after one predicate has rejected it. Boolean subexpressions MAY use internal short-circuiting only if witness completeness is preserved.

This full evaluation makes the census a diagnostic of the rule theory rather than an incidental log.

The current `package-candidate-census-evaluator-v1` realizes the complete
pre-selector portion of this requirement. It refuses exhausted enumeration,
retains every full package-filter artifact in canonical candidate order, and
hashes reconciled candidate totals, Boolean selectivity, indeterminate ratios,
and per-predicate total/exclusive failures plus inert/dominating diagnostics.
Stored results require exact package/run reproduction before acceptance. It is
not a final `LevelResult` and does not supply cohorts, selectors, materialized
elements, or null-model interpretation.

### 5.5 Mandatory null-model context

An observed selectivity without a comparison population is not an interpretable research result. A standard research run MUST execute all three built-in null models. Development and conformance runs MAY disable them, but the result MUST then be labelled `baseline.status = "not-run"`.

### 5.6 Frozen runs

The semantic identity of a run is a content hash over the primitive depth basis, any source-classification policy and annotations, cluster partition, condensation and typed relation layers, normalized predicates, functionals and their coefficients, cohort rules, selectors, sensitivity policy, source/evidence/oracle artifact hashes and method versions, generation parameters, numerical and indeterminate policies, seed policy, null-model configuration, and kernel semantic version.

A prediction can be meaningfully compared with a result only when it was bound to that semantic run hash before execution. Editing any hashed input creates a different run identity.

### 5.7 Cohort-level variational selection

The foundational paper defines admissibility selection through a finite analogue of `arg min F[psi]`. A global minimum cannot be determined by evaluating candidates independently. The kernel therefore separates:

1. local eligibility, decided by predicates; and
2. cohort selection, decided after the complete eligible canonical cohort is known.

A selector references a `Functional`, declares an objective, a competition-cohort rule, a unit-compatible degeneracy tolerance, and a sensitivity policy. The kernel returns every ranked cohort, not an unexplained singular winner. Every score-equivalent optimum is retained semantically. Canonical ID breaks ordering ties only; it MUST NOT remove equivalent extrema or replace their full admitted set with one presentation representative.

The cohort rule models the contested support or compositional resource. It is theory-bearing package data, not an engine default, and is hashed with the run. Core forms are shared-support, profile-role, deterministic invariant-window, and singleton. A global eligible-level cohort is permitted only when the package explicitly claims that all eligible candidates compete for one resource. Different cohort rules over the same candidate population are different ontology-generating experiments.

For each cohort the selector reports the complete ordered membership, optimum, epsilon window, semantic degeneracy set, degeneracy ratio, oriented score gap, and variational selectivity. A fully degenerate cohort has variational selectivity `0` and no unique semantic winner. A singleton cohort also has variational selectivity `0`; it expresses absence of measured competition rather than decisive selection.

Functionals are type-distinct from predicates and are unavailable to skeleton enumeration and decoration. No score or ranking result may prune candidate generation. Functionals with free coefficients MUST run the frozen sensitivity sweep. If the ranking is fragile under the declared perturbations, raw results remain reproducible but their variational selectivity is marked non-interpretable.

Cohort selectors MUST NOT prune partial generation branches: an optimum is undefined until the eligible cohort is complete. Any mathematically proven score bound used for branch-and-bound would be a future, separately audited optimization and cannot masquerade as predicate monotonicity.

The kernel selects among supplied finite scores. It does not calculate functional derivatives, solve field equations, prove boundedness, or discover continuous extrema. Those values require normalized external evidence.

### 5.8 Scientific claims and external evidence

The paper treats its mathematical expressions as admissibility formalisms and structural proxies, not established microphysical laws. The kernel MUST preserve that status.

Every paper-derived predicate, selector, invariant, or carrier promotion SHOULD reference a versioned claim record. Derived numerical values MUST identify their method, units, tolerances, source inputs, and evidence artifact hash. An executable rule is not automatically an empirically supported rule.

External solvers and analytical tooling live behind an adapter boundary. The kernel accepts only normalized data and content-addressed evidence; it MUST NOT execute package-provided scientific code.

## 6. System context and dependency rule

```text
source catalogue JSON ----> catalogue adapter -------+
                                                     |
scientific solver output --> evidence adapter --------+
                                                     |
rule packages ------------> package loader ----------+--> kernel --> artifact bundle
primitives ---------------->                           |
run configuration --------->                           +--> optional CLI / UI / research tools
```

The dependency rule is strict:

```text
kernel <- adapters <- applications
```

The kernel may depend on general-purpose libraries selected by the implementation, but it MUST NOT import from any other Onto2D product package. Source-catalogue concepts are translated at an adapter boundary and MUST NOT leak into the core model unless they become explicit, general kernel contracts.

## 7. Logical components

| Component | Responsibility | Must not do |
|---|---|---|
| Source-relation classifier | Apply a frozen access-controlled policy and retain exposure/annotation provenance | Reveal SCC consequences before eligible classification is frozen |
| Source-node resolver | Decide distributed-structure versus joint-constitution cluster under reviewed criteria | Merge records merely to reduce cycle count |
| Condensation builder | Emit cluster vertices, quotient DAG, member projections, and typed retained layers | Delete or silently retype a source edge |
| Package loader | Parse, normalize, type-check, stratify, and hash inputs | Generate candidates |
| Predicate analyzer | Type and monotonicity analysis | Evaluate untrusted executable code |
| Monotonicity auditor | Sample substructure-extension pairs and test assertions | Mark a failed assertion as a warning |
| Skeleton enumerator | Yield canonical connected undirected skeletons | Assign domain roles |
| Decorator | Assign multiplicities, directions, roles, and attributes under budgets | Decide final admissibility |
| Canonicalizer | Produce deterministic isomorphism-invariant bytes | Use insertion order or runtime object identity |
| Candidate store | Deduplicate and provide stable candidate IDs | Mutate canonical candidate content |
| Predicate evaluator | Evaluate typed expressions and witnesses | Stop after the first top-level failure |
| Census collector | Aggregate overlapping and exclusive rejections | Replace candidate explanations |
| Functional evaluator | Calculate typed finite scores after filtering | Expose scores to candidate generation |
| Cohort partitioner | Construct complete contested-resource partitions | Rank or reject a cohort member |
| Ranker | Emit complete finite `argmin`/`argmax` rankings and degeneracy | Solve continuous variational equations |
| Sensitivity evaluator | Perturb frozen coefficients and classify robustness | Tune coefficients from observed outcomes |
| Evidence verifier | Validate hashes, schemas, units, methods, and claim references | Treat an external assertion as proven merely because it parses |
| Profile extractor | Derive canonical profiles and classes | Depend on UI categories |
| Carrier promoter | Emit explicit cross-domain carrier mappings | Mutate a lower-level element into a higher-level primitive |
| Closure coordinator | Execute a level or ladder as a state machine | Hide truncation or fixpoint limits |
| Null-model runner | Create controls and distributions using seeded randomness | Reuse unrecorded ambient randomness |
| Artifact writer | Emit canonical semantic data and operational records | Mix timestamps into semantic hashes |
| Explanation index | Resolve candidates, source members, typed relations, verdicts, and witnesses | Recompute against a different rules or migration hash |

## 8. Core data contracts

The contracts below are logical TypeScript. The implementation MAY split them across modules, but serialized field semantics MUST remain stable within a major schema version.

### 8.1 Identifiers and canonical values

```ts
type ElementId = `sha256:${string}`;
type CandidateId = `sha256:${string}`;
type ProfileHash = `sha256:${string}`;
type SkeletonId = `sha256:${string}`;
type BasisHash = `sha256:${string}`;
type MigrationPolicyHash = `sha256:${string}`;
type PredicateId = string;
type FunctionalId = string;
type SelectorId = string;
type CohortRuleId = string;
type ClaimId = string;
type EvidenceId = string;
type OracleRunRef = `sha256:${string}`;
type SourceRecordId = string;
type SourceRelationId = string;
type NullModelId = "role-shuffle" | "degree-rewire" | "uniform";
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface CanonicalForm {
  schemaVersion: string;
  bytesBase64: string;
  hash: `sha256:${string}`;
}

interface ArtifactRef {
  path: string;
  mediaType: string;
  schemaVersion: string;
  bytes: number;
  hash: `sha256:${string}`;
}

type EvidenceState =
  | "paper-assumption"
  | "paper-derivation"
  | "package-operationalization"
  | "computationally-verified"
  | "externally-supported"
  | "falsified"
  | "unresolved";

interface EvidenceRef {
  id: EvidenceId;
  state: EvidenceState;
  source: ArtifactRef;
  locator?: { page?: number; equation?: number; fragment?: string };
  method?: { id: string; version: string; inputHash: string };
}

type UnitExpr = string;              // normalized under the versioned unit grammar; use "1" for dimensionless

type Tolerance =
  | { absolute: number; relative?: number }  // absolute uses the normalized unit
  | { absolute?: number; relative: number }; // relative is a non-negative ratio

interface ToleranceUse {
  unit: UnitExpr;
  tolerance: Tolerance;
  semantic: string;
}

type QuantityProvenance =
  | { kind: "declared"; evidence: EvidenceId[] }
  | { kind: "computed"; method: string; evidence: EvidenceId[] }
  | { kind: "oracle"; source: OracleRunRef; method: string; evidence: EvidenceId[] };

interface Quantity {
  value: number;
  unit: UnitExpr;
  tolerance: Tolerance;
  semantic: string;
  provenance: QuantityProvenance;
}

type InvariantValue = Quantity | JsonPrimitive;

interface QuantitySpec {
  id: string;
  unit: UnitExpr;
  semantic: string;
  toleranceTarget: Tolerance;
}

type OntologyPhase = "A" | "B" | "C" | "D" | `custom:${string}`;
type AggregationAxis =
  | "derivation-depth"
  | "ontology-level"
  | "ontology-phase"
  | "catalogue-level"
  | "catalogue-phase"
  | "predicate-phase";

interface OntologyCoordinate {
  level: number;
  phase?: OntologyPhase;
  segment?: string;
}

interface AxisProvenance {
  derivationDepth: "computed";
  ontologyLevel?: "declared" | "computed";
  ontologyPhase?: "declared";
  catalogueLevel?: "declared";
  cataloguePhase?: "declared";
}

type SourceRelationKind =
  | "generative"
  | "constitutive"
  | "intra-closure-support"
  | "evidential"
  | "descriptive"
  | "regulatory-feedback";

type MigrationBlindnessStatus =
  | "prospective-blind"
  | "deterministic-precommitted"
  | "historically-exposed";

interface ClassifiedSourceRelation {
  id: SourceRelationId;
  source: SourceRecordId;
  target: SourceRecordId;
  kind: SourceRelationKind;
  scope: "inter-cluster" | "intra-cluster";
  policyHash: MigrationPolicyHash;
  classificationArtifact: ArtifactRef;
  postUnblindingChange?: {
    previousKind: SourceRelationKind;
    reason: string;
    approvalArtifact: ArtifactRef;
  };
}

type ClusterDisposition =
  | "distributed-structure"
  | "constitutive-cluster"
  | "unresolved-generative-cluster"
  | "mixed-unresolved-cluster";

interface ClusterProvenance {
  disposition: ClusterDisposition;
  members: SourceRecordId[];
  internalRelations: SourceRelationId[];
  internalOrder: "undefined";
  classificationPolicyHash: MigrationPolicyHash;
  classificationArtifact: ArtifactRef;
  nodeResolutionArtifact: ArtifactRef;
  condensationArtifact: ArtifactRef;
}

interface ClusterMemberProjection {
  member: SourceRecordId;
  clusterElement: ElementId;
  inheritedDepth: number;
  depthBasis: BasisHash;
}

interface TypedRelationLayer {
  kind: SourceRelationKind;
  relations: ClassifiedSourceRelation[];
  hash: `sha256:${string}`;
}

interface OntologyAxisDefinition {
  phasePrecedence: { before: OntologyPhase; after: OntologyPhase }[];
  levelPolicy: "declared" | "profile-collapse-computed" | "mixed-with-comparison";
}

interface Claim {
  id: ClaimId;
  statement: string;
  state: EvidenceState;
  evidence: EvidenceId[];
}

type ParameterSet = Record<string, JsonValue | Quantity>;

interface OracleRequest {
  candidate: CanonicalForm;
  quantities: QuantitySpec[];
  parameters: ParameterSet;
  toleranceTarget: Tolerance;
  solver: { id: string; version: string; method: string };
}

interface OracleResponse {
  requestHash: OracleRunRef;
  values: Record<string, Quantity>;
  convergence: "converged" | "partial" | "failed";
  residual?: Quantity;
  solver: {
    id: string;
    version: string;
    method: string;
    parameters: ParameterSet;
  };
  wallTimeMs: number;
}

type PartialOraclePolicy =
  | { mode: "indeterminate" }
  | {
      mode: "accept-expanded-tolerance";
      toleranceMultiplier: number;
      maximumResidual?: Quantity;
    };
```

A tolerance object MUST contain at least one finite non-negative bound. Scientific inexact values MUST use a positive effective bound; exact structural integers and IDs remain ordinary scalars. Quantity arithmetic is dimension-checked, and normalization converts compatible units before evaluation. Incompatible units are a package-load error for statically known expressions and an evidence-validation error for externally returned values. Numeric `eq`/`ne` never means raw binary floating-point equality: it is evaluated through the declared tolerance. Exact equality remains valid for canonical IDs, enums, booleans, strings, and structural integer counts.

IDs MUST be derived from domain-separated canonical bytes. For example, element hashing MUST distinguish `onto2d:element:v1` from `onto2d:candidate:v1` even if their payload bytes happen to match.

A normalized rule package binds scientific claims and evidence to executable data:

```ts
interface PrimitiveDefinition {
  sourceId: string;
  kind: "primitive" | "condensed-cluster";
  cluster?: ClusterProvenance;
  ontologyCoordinate?: OntologyCoordinate;
  axisProvenance?: Omit<AxisProvenance, "derivationDepth">;
  typeTags: string[];
  invariants: Record<string, InvariantValue>;
  profile?: Profile;
  claimRefs: ClaimId[];
}

interface RulePackage {
  schemaVersion: string;
  id: string;
  version: string;
  sourceArtifacts: ArtifactRef[];
  sourceMigration?: {
    policyHash: MigrationPolicyHash;
    blindnessStatus: MigrationBlindnessStatus;
    classificationPolicy: ArtifactRef;
    riskPolicy: ArtifactRef;
    classificationView: ArtifactRef;
    classificationAnnotations: ArtifactRef;
    classificationAdjudication: ArtifactRef;
    classificationAmendments: ArtifactRef;
    classifiedRelations: ArtifactRef;
    nodeResolutions: ArtifactRef;
    condensation: ArtifactRef;
    memberProjections: ArtifactRef;
    typedRelationLayers: ArtifactRef[];
    reconciliation: ArtifactRef;
    metrics: ArtifactRef;
    explanationIndex: ArtifactRef;
    concentration?: ArtifactRef;
  };
  evidence: EvidenceRef[];
  claims: Claim[];
  primitives: PrimitiveDefinition[];
  predicates: Predicate[];
  functionals: Functional[];
  cohortRules: CohortRule[];
  selectors: CohortSelector[];
  partialOraclePolicy: PartialOraclePolicy;
  ontologyAxes: OntologyAxisDefinition;
  perturbations: (string | PerturbationDefinition)[];
  profileDefinition: JsonValue;
}
```

Every referenced source or solver artifact MUST be content-addressed. Missing evidence may be permitted only when the run's evidence policy allows a declared theoretical assumption; it must never be upgraded silently to computational or external support.

A `PrimitiveDefinition` with `kind: "condensed-cluster"` MUST carry valid
cluster provenance; an ordinary primitive MUST NOT. The catalogue adapter
verifies from artifact bytes that every raw source node and relation is
conserved through resolution and exactly one condensation destination. The
kernel loader binds the resulting complete artifact references, requires six
typed layers, matches cluster provenance to that binding, and rejects a source
member assigned to multiple condensed-cluster primitives. It does not infer
the contents of external bytes from their `ArtifactRef` labels.

A primitive source profile may be omitted only when `profileDefinition` deterministically derives it during package normalization. Every loaded primitive `Element` has a complete profile before candidate generation; failure to derive one is a package error.

Primitive invariant values MUST be a normalized Quantity or one finite JSON
scalar. All declarations of one invariant name MUST agree on runtime kind;
Quantity declarations MUST additionally agree on dimensions and semantic.
Numeric negative zero normalizes to zero, scalar strings are bounded by the
typed-expression ceiling, and composite JSON values are forbidden. These
values participate in primitive identity and package runtime symbol binding.
`Profile.invariantVector` remains Quantity-valued and is not an implicit source
of scalar aggregation; see
[ADR-0047](adr/0047-package-authored-scalar-invariants.md).

### 8.2 Element

```ts
interface Element {
  id: ElementId;
  kind: "primitive" | "derived" | "condensed-cluster";
  depth: number;
  depthBasis: BasisHash;
  axisProvenance: AxisProvenance;
  canonicalForm: CanonicalForm;
  profile: Profile;
  provenance: Provenance | null;
  ontologyCoordinate?: OntologyCoordinate;
  typeTags: string[];
  invariants: Record<string, InvariantValue>;
  admittedBy: PredicateId[];
  selectedBy: SelectorId[];
  claimRefs: ClaimId[];
  cluster?: ClusterProvenance;
}

interface Provenance {
  constituents: ElementId[];
  constituentProfiles: ProfileHash[];
  skeleton: SkeletonId;
  roleAssignment: RoleAssignment;
  sourceCandidate: CandidateId;
  derivationDepth: number;
  depthBasis: BasisHash;
  evidence: EvidenceId[];
}

interface RoleAssignment {
  edges: {
    canonicalEdge: number;
    role: string;
    direction: "forward" | "reverse" | "symmetric";
  }[];
}

interface CarrierPromotion {
  sourceElement: ElementId;
  sourceCoordinate: OntologyCoordinate;
  targetCoordinate: OntologyCoordinate;
  promotedProfile: ProfileHash;
  rulesHash: string;
  claimRefs: ClaimId[];
  evidence: EvidenceId[];
}
```

Primitive and source-condensed cluster inputs have `provenance: null`; kernel-derived elements have formation provenance. `cluster` is present if and only if `kind === "condensed-cluster"`. `admittedBy` and `selectedBy` are canonically sorted. `admittedBy` means that every named top-level predicate returned `pass`; it does not imply those predicates were sufficient in isolation. `selectedBy` records the cohort selectors under which the locally eligible element survived.

A cluster's member cards remain addressable through `ClusterMemberProjection` and the explanation graph but are not independent vertices in the depth index. Cluster structural identity is derived from its normalized identity-bearing member content and internal closure graph under the frozen node-resolution policy. Source card IDs, annotator names, and review timestamps are provenance unless the policy explicitly declares a source identifier structural.

Cluster canonical bytes sort normalized member identities and internal typed relations, then bind the cluster disposition and node-resolution policy version under a dedicated hash domain. SCC traversal order and classifier ordering cannot affect the resulting element ID. Annotation/evidence artifact hashes remain in provenance and the semantic manifest even when they do not alter structural identity.

Inherited kernel depth does not overwrite member catalogue levels, phases, or other declared coordinates. A cluster may expose coordinate disagreement or span several source levels; that is a migration diagnostic, not permission to manufacture one source label.

`depthBasis` is the domain-separated hash of the normalized primitive structural identities and the generative basis policy used by the run. Changing the primitive basis, even while leaving a derived element structurally unchanged, changes the depth basis. Reports MUST group or compare depth only after displaying and checking this hash. Axis provenance is mandatory for every axis that is present.

Element structural identity includes its canonical graph/content, normalized quantity values and units, and any coordinate/type tag declared identity-bearing by the package. Minimum depth, derivation path, citations, evidence state, and execution metadata do not alter structural identity; they are bound through the run and derivation artifacts instead. The identity-bearing-field policy is explicit and hashed.

When profile-quotient generation uses deterministic representative members, the provenance MUST disclose that fact. Alternate derivations MAY be stored in a separate derivation index so that the immutable element record remains content-addressed.

The current `primitive-depth-population-v1` materializer realizes the depth-zero
subset of this contract. It MUST reproduce the complete loaded package and the
identity-policy-selected canonical bytes of every primitive before emitting an
`Element`. Primitive and source-condensed records have `depth: 0`, the package
`depthBasis`, computed derivation-depth provenance, `provenance: null`, and
empty admission/selection lists. The population is sorted by element ID and
hashed in `onto2d:depth-population:v1`. Arbitrary caller-supplied or derived
elements are not accepted at this boundary.

The current `package-candidate-filter-evaluator-v20` adds a later formation
basis without constructing an element. It binds a complete canonical candidate
to the reproduced package/run universe, target depth, source population, and
exact/profile constituent resolution, reproduces each plan's numeric binding,
and derives invariant inputs from the complete reproduced source population
and every selected profile class before evaluating every graph or supported
local-numeric top-level predicate. Its `eligible` verdict is local filtering
only; it does not populate `selectedBy`, derive a profile, or authorize a derived
element ID.

`package-candidate-census-evaluator-v1` composes that boundary over every
candidate in a completed `package-candidate-generator-v5` artifact. The census
hash binds the full generation, every complete filter explanation, all
reconciled candidate and predicate counts, and raw Boolean selectivity. A
budget-exhausted generation produces no census artifact; a serialized artifact
is accepted only when exact deterministic reproduction matches it completely.

Carrier promotion creates a new primitive definition or package input for the target ontology coordinate. It MUST NOT mutate the source element or confuse ontology level with derivation depth. For the foundational paper, promotion from a Level-0 ensemble-quantum to a Level-1 carrier is valid only after collective admissibility and effective profile extraction have both succeeded.

### 8.3 Profile

```ts
type ProfileSlotGuard =
  | ContentHash
  | { op: "all" | "any"; args: ProfileSlotGuard[] }
  | { op: "not"; arg: ProfileSlotGuard }
  | { op: "partnerTypeTag"; typeTag: string }
  | { op: "partnerInvariant"; name: string; comparator: Comparator; value: InvariantValue };

interface Slot {
  role: string;
  polarity: "in" | "out" | "sym";
  capacity: { min: number; max: number | null };
  guard?: ProfileSlotGuard;
}

interface Profile {
  slots: Slot[];
  invariantVector: ProfileInvariant[];
  precisionPolicy: string;
  hash: ProfileHash;
}

interface ProfileInvariant {
  semantic: string;
  normalized: Quantity;
  quantization: Quantity;
}

interface ProfileClass {
  hash: ProfileHash;
  members: ElementId[];
  representative: ElementId;
}
```

Slots MUST be normalized and sorted by role, polarity, normalized capacity, and guard hash. Member lists MUST be sorted by element ID. The representative is the lexicographically smallest member ID.

The precision policy for invariants is part of the profile hash and run hash. Every coordinate declares a quantization step in the normalized unit; abstract “decimal places” alone are insufficient for dimensional values. Rounding MUST use a named deterministic decimal policy; host-language floating-point formatting MUST NOT define canonical bytes implicitly.

Every profile invariant declares its source quantity, unit normalization, and semantic order. Numerically equal values with incompatible units or different declared meanings MUST NOT collapse into one profile coordinate.

### 8.4 Candidate

```ts
interface CandidateNode {
  ref: ElementId | ProfileHash;
  attrs?: Record<string, Scalar | Quantity>;
}

interface CandidateEdge {
  from: number;
  to: number;
  role: string;
  attrs?: Record<string, Scalar | Quantity>;
}

interface Candidate {
  id: CandidateId;
  domain: "profile-quotient" | "element-exact" | "single-candidate";
  nodes: CandidateNode[];
  edges: CandidateEdge[];
  skeleton: SkeletonId;
  canonicalForm: CanonicalForm;
}

type Scalar = string | number | boolean | null;
```

Node indices are local to the non-canonical input and MUST NOT be treated as stable identities. Explanations refer to canonical node labels plus a reversible input-to-canonical mapping.

Default graph semantics are:

- finite;
- connected at the undirected skeleton level;
- directed and role-labelled after decoration;
- parallel edges allowed when enabled by configuration;
- self-loops disabled unless a package explicitly enables them;
- edge and node attributes participate in isomorphism only when declared `structural` by the package.

### 8.5 Predicate and expression IR

```ts
interface Predicate {
  id: PredicateId;
  phase: "formation" | "maintenance" | "termination";
  monotoneViolation: boolean;
  referencesDepth: "below" | "self";
  expr: Expr;
  explain: ExplanationTemplate;
  claimRefs: ClaimId[];
}

type Expr =
  | { op: "all"; args: Expr[] }
  | { op: "any"; args: Expr[] }
  | { op: "not"; arg: Expr }
  | ({ op: "degree"; node: NodeSelector; role?: string } & PredicateRange)
  | { op: "cycleExists"; roles?: string[]; projection: GraphProjection; minLength?: number; maxLength?: number }
  | { op: "connected" }
  | { op: "componentCount"; count: number }
  | { op: "pathExists"; from: NodeSelector; to: NodeSelector; roles?: string[] }
  | ({ op: "countRole"; role: string } & PredicateRange)
  | { op: "balance"; attribute: string; over: SetSelector; tolerance: Quantity }
  | { op: "compare"; left: ValueExpr; comparator: Comparator; right: ValueExpr }
  | { op: "minimal"; predicate: Expr; policy?: SubstructurePolicyRef }
  | { op: "novel"; predicate: Expr }
  | { op: "stableUnder"; perturbation: string; predicate: Expr; threshold: number }
  | { op: "irreducibleRemoval"; predicate: Expr; removal: "node" | "edge" };

type ExprRef = `sha256:${string}`;
type Comparator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
type GraphProjection = "directed" | "undirected-simple" | "undirected-multigraph";
type PredicateRange =
  | { min: number; max?: number }
  | { min?: number; max: number };

type NodeSelector =
  | { kind: "canonical-index"; index: number }
  | { kind: "all" }
  | { kind: "where"; attribute: string; equals: Scalar };

type SetSelector =
  | { kind: "nodes"; selector: NodeSelector }
  | { kind: "edges"; roles?: string[] }
  | { kind: "cycle"; roles?: string[] };

type ValueExpr =
  | { kind: "constant"; value: Scalar | Quantity }
  | { kind: "invariant"; name: string; node?: NodeSelector }
  | { kind: "count"; set: SetSelector }
  | { kind: "sum"; attribute: string; set: SetSelector }
  | { kind: "add"; terms: ValueExpr[] }
  | { kind: "multiply"; factors: ValueExpr[] }
  | { kind: "coefficient"; name: string };

type SubstructurePolicyRef = string;

interface Functional {
  id: FunctionalId;
  expr: ValueExpr;
  coefficients: Record<string, Quantity>;
  coefficientRoles?: Record<string, "fixed" | "free" | "fitted">;
  sensitivityCoefficients: string[];
  result: QuantitySpec;
  explain: string;
  claimRefs: ClaimId[];
}

type CohortRule =
  | {
      id: CohortRuleId;
      kind: "shared-support";
      resourceKey: ValueExpr[];
    }
  | {
      id: CohortRuleId;
      kind: "profile-role";
      roleKey: ValueExpr[];
    }
  | {
      id: CohortRuleId;
      kind: "invariant-window";
      value: ValueExpr;
      origin: Quantity;
      width: Quantity;
      bins: "lower-closed-upper-open";
    }
  | { id: CohortRuleId; kind: "singleton" }
  | { id: CohortRuleId; kind: "global" };

interface SensitivityPolicy {
  amplitudes: number[];              // mandatory defaults: [0.10, 0.25]
  sweep: "one-at-a-time" | "cartesian";
  topK: number;
  robustLeaderSetThreshold: number;
  robustTopKThreshold: number;
}

interface CohortSelector {
  id: SelectorId;
  objective: "min" | "max";
  functional: FunctionalId;
  cohortRule: CohortRuleId;
  epsilon: Quantity;
  tiePolicy: "retain-all";
  sensitivity: SensitivityPolicy;
  explain: ExplanationTemplate;
  claimRefs: ClaimId[];
}

interface ExplanationTemplate {
  pass: string;
  fail: string;
  indeterminate: string;
}

interface Witness {
  kind: "node" | "edge" | "path" | "cycle" | "substructure" | "perturbation" | "quantity" | "cohort" | "evidence" | "source-relation" | "cluster";
  canonicalNodes?: number[];
  canonicalEdges?: number[];
  evidence?: EvidenceId[];
  details: JsonValue;
}
```

Quantity semantic strings, provenance method identifiers, and evidence IDs
MUST be normalized non-empty strings without leading or trailing whitespace.
Canonical normalization MUST reject, rather than silently trim, a
non-normalized form.

Expressions are declarative data. The core loader MUST NOT execute JavaScript, shell commands, templates, or package-provided native code while evaluating rules.

Value-expression analysis is a distinct pre-execution capability. It MUST:

- validate every AST node and selector recursively, reject unknown fields and
  undeclared symbol references, and enforce explicit depth, node, operand,
  role, string, and dimensional-exponent limits;
- normalize quantity constants to canonical SI-base units, normalize negative
  zero, sort unique selector roles, and canonicalize `add` terms and `multiply`
  factors because those operations are commutative under the declared exact
  decimal execution model;
- distinguish `number`, dimensioned or dimensionless `quantity`, `string`,
  `boolean`, and `null`; addition requires equal dimensions and multiplication
  adds dimension exponents;
- collect sorted dependencies on invariants, coefficients, attributes, and
  roles; an untyped attribute used by `sum` is an analysis error;
- hash the normalized AST separately from the typed analysis. The analysis hash
  binds the analyzer version, inferred result, sorted requirements, and types
  of referenced symbols, but does not bind unused environment symbols or their
  runtime values;
- reject a functional whose declared result unit differs from the inferred
  dimension, and reject an `invariant-window` whose value is non-numeric or
  incompatible with its origin/width dimension.

A `where` selector may infer an otherwise undeclared scalar attribute type from
its equality literal. Repeated uses MUST agree. Quantity-valued aggregation
cannot infer a unit from an attribute name and therefore requires explicit
attribute type metadata. Expression analysis does not fetch candidate data,
perform arithmetic, evaluate a predicate, or call a scientific Oracle.

The string ceiling applies to selector literals and to semantic, method, and
evidence strings nested in quantity constants or quantity-backed symbol
metadata. Canonical node indices and predicate bounds are non-negative safe
integers. A `degree` or `countRole` expression MUST declare at least one of its
lower or upper bounds.

Boolean-expression analysis is also a pre-execution capability. It MUST close
and recursively validate all built-in/combinator objects, normalize unordered
role lists and `all`/`any` arguments, type-check embedded `ValueExpr` operands,
and emit sorted requirements for invariants, attributes, roles, graph
projections, perturbations, substructure policies, value-expression hashes,
operators, and witness kinds. `compare` requires compatible numeric dimensions
or equal scalar types; non-numeric scalars support only `eq` and `ne`.
`balance` infers an undeclared attribute dimension from its explicit
non-negative tolerance and rejects a conflicting declared type.

Static pruning analysis MUST distinguish:

- persistence of an observed `pass` under permitted additive extension;
- persistence of an observed `fail`;
- whether either outcome is detectable from the available partial candidate;
- the package's `monotoneViolation` declaration;
- the mandatory falsification audit for every declared monotone violation.

An upper-only `countRole` failure and the failure of
`not(cycleExists(...))` are statically persistent and partially detectable. A
lower-only `countRole` bound proves persistence of a pass, not a failure. A
combined range, balance, arbitrary comparison, component count, or
substructure combinator is not assigned unconditional failure persistence. A
degree selector based on a canonical index is not assumed stable before
complete canonicalization, and a
lower-bound degree pass over a selector whose membership can grow is not
persistent. A path witness whose endpoint uses a canonical index is likewise
not persistent until canonical labels are fixed.

The compiled plan MUST use `static-proven` only when both failure persistence
and partial detection are established. An unproved declaration is
`blocked-unproven`; randomized audit samples may falsify a claim but MUST NOT
manufacture proof. Plan hashes bind compiler version, predicate identity,
phase, depth-reference policy, declaration, expression-analysis hash, and
pruning state. Analysis and compilation do not evaluate three-valued truth,
generate a witness, inspect a candidate, or prune a branch.

The current `predicate-plan-verifier-v1` MUST reproduce the normalized
expression, analysis witnesses, pruning metadata, and hashes before any
runtime consumes a compiled plan. `graph-predicate-evaluator-v1` is the first
executable subset: it accepts only logical and graph-structural operators,
re-canonicalizes the candidate, and emits a content-addressed complete
evaluation. Numeric and substructure operators remain outside that boundary.

`Predicate` and `Functional` are different schema types, registries, evaluator capabilities, and execution contexts. The generator receives only pruning-eligible predicate plans; it cannot resolve a functional ID or coefficient. This capability boundary is a conformance property, not a naming convention.

Every coefficient carries quantity provenance and therefore a declared
theoretical, computed, or oracle source. Every free or fitted coefficient,
including each paper `alpha_i`, MUST appear in `sensitivityCoefficients`.
When `coefficientRoles` is supplied it MUST cover every coefficient and its
non-fixed set MUST equal `sensitivityCoefficients`. For legacy schema-v1
inputs without that record, membership in `sensitivityCoefficients` declares
`free` and omission declares `fixed`; normalization always materializes the
complete role map. Omitting an explicitly free or fitted coefficient from the
sweep is a package error, not an optimization.

`shared-support` cohorts are the connected components of the candidate/resource incidence relation, making the result an actual partition even when support overlaps transitively. `profile-role` groups identical normalized role keys. `invariant-window` uses unit-compatible half-open bins anchored at the declared origin; pairwise “within epsilon” chaining is forbidden because it is not generally transitive. `singleton` encodes no competition. `global` is explicit and MUST NOT be injected as a default.

Predicate phases have these meanings:

- `formation`: structural well-formedness and conditions meaningful during partial generation;
- `maintenance`: invariants evaluated on a complete candidate and relevant substructures;
- `termination`: closure or completeness conditions that decide final admission.

Phase is an analysis and reporting dimension, not permission to skip predicates. Only a predicate with safe partial semantics may prune.

This predicate phase is an engine execution classification. It is unrelated to ontology phases A–D in the foundational paper unless a rule package provides an explicit mapping.

### 8.6 Evaluation result and witnesses

The current graph-only executable artifact is narrower than the target
cross-domain result below:

```ts
interface PredicateGraphEvaluation {
  schemaVersion: "1";
  evaluator: "graph-predicate-evaluator-v1";
  predicatePlanHash: ContentHash;
  candidateId: CandidateId;
  graphPolicy: GraphPolicy;
  outcome: "pass" | "fail" | "indeterminate";
  witnesses: GraphPredicateWitness[];
  evaluationHash: ContentHash;
}
```

Its witnesses use canonical node and edge indices and bind their expression
path, atomic operator, local outcome, and relevant count, range, role,
projection, component, path, or cycle data. The evaluation hash covers the
verified plan, canonical candidate, effective graph policy, final outcome, and
ordered witnesses.

The separate `local-predicate-evaluator-v19` composes that graph runtime with
the fully bound comparison subset. It accepts scalar constants, direct
constant quantities, counts over canonical nodes or role-filtered edges, and
dimensionless `add`/`multiply`, plus exact-decimal or compensated-binary64 sums
over scalar or Quantity-valued structural node or edge attributes. Compatible
Quantity constants, sums, and nested additions compose recursively with exact
decimal addition, additive effective absolute bounds, computed provenance, and
a canonical evidence union. Exactly one Quantity-valued factor may be scaled
by supported dimensionless number expressions; the result preserves its unit
and semantic and scales its absolute bound by the scalar magnitude. Quantity
sums require the declared SI unit and semantic and aggregate input uncertainty under
`sum-effective-absolute-bounds-v1`. Accumulation remains unrounded until the
bound result boundary and records whether its value is exact. Other
dimensionless arithmetic preserves that approximation state; direct,
aggregated, and derived quantities normalize to SI bases,
apply terminating rational unit scales in exact decimal arithmetic, round once,
and use declared maximum tolerance plus the bound semantic policy.
An `element-exact` Quantity or package-authored scalar invariant additionally resolves
from an explicit source-population context and exactly one canonical node. Its
normalized source value, type-specific witness, element ID, node, and expression
path are retained, and the population hash is bound at artifact level. A
`profile-quotient` invariant defaults to resolution from an explicit complete
profile class whose members have one identical fully normalized Quantity
record or exact scalar value. A numeric invariant expression may instead bind
`arithmetic-mean-conservative-v1`. That policy covers every member, uses exact-
decimal summation and bound run precision for division, requires one declared
type/unit/semantic, and for Quantities outwardly averages effective absolute
bounds, covers division rounding, and forms a canonical evidence union with
computed provenance. String, Boolean, and null invariants remain strict-
consensus only. The profile hash, complete ordered member IDs, consensus or
aggregation diagnostic, value, node, and expression path are retained as
witnesses. Representative lookup and implicit aggregation are forbidden.
Missing, ambiguous, or incomplete candidate data yields a
structured indeterminate comparison witness; invalid contexts and
type/unit/semantic mismatches remain hard errors. Any artifact that binds an
invariant context also records the sorted non-empty `invariantNames`, including
when a stability family yields no evaluated nested witness.
Complete node/edge `balance` forms the same typed attribute aggregate, rounds
once at the result boundary, and compares its absolute magnitude with the
explicit non-negative Quantity threshold using `lte` and the bound
`declared-max-tolerance-v1` policy. Scalar aggregates are lifted only for this
dimensionless comparison; Quantity aggregates retain their conservative source
uncertainty and provenance. The `cycle` set selects the role-filtered union of
canonical edges participating in directed cycles; counts and aggregates use
each selected edge exactly once.
`irreducibleRemoval` evaluates its nested predicate on the whole canonical
candidate and every permitted canonical single-node or single-edge removal
under the explicit run substructure policy. Empty/disconnected exclusions are
recorded rather than counted as inner failures; no evaluated removal yields
`indeterminate`; and every evaluated substructure retains its normalized
identity, parent-index mapping, outcome, and nested witnesses. Runtime
invariants inside removed substructures resolve only through retained node
references in the immutable source-population context.
`minimal` uses the same explicit policy but enumerates every permitted proper
parent-index subgraph rather than only single removals. Node-only mode uses
induced edges, edge-only mode retains the parent node set before isolated-node
policy, and combined mode enumerates every endpoint-valid node/edge subset.
Raw selected indexes, effective retained indexes, normalized identity, parent
mappings, outcomes, and skipped empty/disconnected cases remain in the
witness. The exact selection count is preflighted against the shared 10,000-
substructure ceiling before an exponential family is materialized.
`novel` is restricted to `element-exact` candidates and evaluates the nested
predicate on the whole candidate and on every canonical single-node,
zero-edge constituent projection under
`canonical-single-node-no-edge-v1`. It does not bind a substructure policy of
its own. The witness retains every exact source element ID, projection ID,
canonical-to-parent node mapping, outcome, and nested evidence. A whole
failure or indeterminate result short-circuits; after a whole pass, any passing
constituent yields failure, otherwise any indeterminate constituent or an
empty denominator yields indeterminate, and only all constituents failing
yields pass. `profile-quotient` novelty is a hard error rather than permission
to substitute representative elements. Nested invariant selectors are
reevaluated on each constituent projection and resolve its retained source
element directly.
`stableUnder` binds one typed package perturbation definition and either
exhaustively enumerates or deterministically samples its canonical single
edits. Schema v1 executes edge deletion, node
deletion with incident-edge removal, edge-role replacement, and finite numeric
displacement of a structural node/edge attribute. Every valid result is
canonicalized under the original graph policy and retains its candidate ID,
parent mappings, nested outcome, and witnesses; graph-policy-invalid,
missing/non-numeric, non-finite, and ineffective numeric attempts remain
auditable skipped records outside the denominator. The exact lower bound is
`pass / valid` and the exact upper bound is
`(pass + indeterminate) / valid`: the operator passes when the lower bound
meets the exact decimal threshold, fails when the upper bound is below it, and
is otherwise indeterminate. Rounded bounds are diagnostic only. An empty valid
family is indeterminate unless the definition explicitly binds
`vacuous-pass`. Perturbation and nested substructure attempts share the
preflighted 10,000-operation ceiling. Registry-only perturbation strings are
not executable. Sampled enumeration draws with replacement from the same
canonical attempt frame using a RunConfig-hash-bound, unbiased SHA-256
rejection stream. It binds every frame index and uses conservative outward
six-decimal Chebyshev intervals with at least 95% joint coverage for passing
and non-failure probabilities. A sampled pass/fail follows only when the
corresponding confidence bound clears the exact threshold; otherwise it is
`indeterminate`. The exact and sampled contracts are recorded in
[ADR-0049](adr/0049-exhaustive-typed-stability.md) and
[ADR-0050](adr/0050-seeded-sampled-stability.md).
Explicit numeric profile aggregation is recorded in
[ADR-0051](adr/0051-explicit-profile-invariant-aggregation.md).
Explicit-semantic local Quantity products are recorded in
[ADR-0052](adr/0052-local-general-quantity-products.md).
Nested substructure invariant resolution is recorded in
[ADR-0089](adr/0089-nested-substructure-invariant-resolution.md).
The artifact binds `predicatePlanHash`, `numericBindingHash`, canonical
candidate and policy, unrounded/rounded values, exactness state, and canonical
selection/invariant/balance/substructure witnesses under
`onto2d:predicate-local-evaluation:v19`. The schema-v1 aggregation registry is
closed to strict consensus and `arithmetic-mean-conservative-v1`; every other
name is an invalid future extension under ADR-0090.
Functional coefficient nodes remain deliberately forbidden by the predicate-
only expression environment.

```ts
interface PredicateEvaluation {
  predicateId: PredicateId;
  outcome: "pass" | "fail" | "indeterminate";
  witnesses: Witness[];
  metrics: Record<string, Scalar | Quantity>;
}

interface CandidateExplanation {
  candidateId: CandidateId;
  rulesHash: string;
  verdict: "admitted" | "predicate-rejected" | "selector-excluded" | "indeterminate";
  evaluations: PredicateEvaluation[];
  selectorEvaluations: SelectorEvaluation[];
}

interface SelectorEvaluation {
  selectorId: SelectorId;
  cohortId: string;
  outcome: "selected" | "excluded" | "indeterminate";
  score: Quantity | null;
  optimum: Quantity | null;
  rank: number | null;
  semanticExtrema: CandidateId[];
  claimRefs: ClaimId[];
}

interface RankedCandidate {
  candidateId: CandidateId;
  outcome: "ranked" | "indeterminate";
  score: Quantity | null;
  rank: number | null;
  semanticExtremum: boolean;
}

interface CohortResult {
  selectorId: SelectorId;
  cohortId: string;
  rule: CohortRuleId;
  members: RankedCandidate[];
  status: "ranked" | "indeterminate";
  optimum: Quantity | null;
  epsilon: Quantity;
  degeneracy: number | null;
  degeneracyRatio: number | null;
  variationalSelectivity: number | null;
  gap: Quantity | null;
}

interface SensitivityPoint {
  perturbation: number;
  evaluatedVariants: number;
  leaderSetStability: number;
  presentationLeaderStability: number;
  topKStability: number;
}

interface SensitivityReport {
  selectorId: SelectorId;
  policy: SensitivityPolicy;
  status: "complete" | "indeterminate";
  points: SensitivityPoint[];
  verdict: "robust" | "fragile" | null;
  reasons: string[];
}
```

Witnesses MUST identify concrete canonical nodes, edges, paths, cycles, substructures, perturbations, numerical evidence, or cohort comparisons. A rejected candidate explanation that contains only a predicate or selector ID is non-conformant.

`indeterminate` is reserved for exhausted sampling, numerical-policy failure, missing referenced data, or a bounded fixpoint that did not converge. It MUST NOT be silently coerced to pass or fail.

Rank is dense by tolerance-equivalent score groups, starting at `1`. Members are serialized by objective-oriented score and then canonical candidate ID. The ID tie-break determines only deterministic order and the optional presentation leader. `semanticExtrema` always contains the complete epsilon-equivalent extremum set.

Every cohort member remains in `members`, including an indeterminate score with `rank: null`. If any required member is unscoreable, the cohort status and variational selectivity are indeterminate because the missing value could change the optimum; a provisional ordering of scoreable members may be retained only as a diagnostic. Sensitivity is likewise indeterminate if the base ranking or a required perturbation variant cannot be evaluated.

### 8.7 Census

```ts
interface PredicateCensus {
  evaluated: number;
  passed: number;
  failed: number;
  indeterminate: number;
  exclusivelyRejected: number;
  inert: boolean;
  dominating: boolean;
}
```

An inert predicate has `failed === 0` in the applicable evaluated population. A dominating predicate fails at least the configured fraction of evaluated candidates; the default threshold is `0.90`. Because failures overlap, the census MUST report both total failures and exclusive rejections.

The current complete local-filter census freezes `0.90` as an explicit
artifact field, defines exclusive rejection as the sole definite failed
top-level predicate for one candidate, and uses the RunConfig
`indeterminateThreshold` only to classify interpretation. Raw reconciled
counts and ratios remain inspectable when that threshold is exceeded. Its
portable artifact serializes the conceptual predicate-keyed census as a
predicate-ID-sorted entry array, avoiding promotion of package IDs to JSON
object keys. A serialized local census is trusted only after exact
whole-artifact reproduction from independently supplied package/run inputs;
shape validation and a self-declared content hash are not sufficient.

### 8.7.1 Package functional evaluation

The current `package-functional-evaluator-v1` is a candidate-local scoring
primitive for the post-filter stage. It MUST independently reproduce the
loaded package, package/run binding, and complete supplied filter artifact, and
MUST reject every verdict except `eligible`. It reanalyzes the normalized
functional and evaluates numeric/Quantity constants, canonical
node/edge/directed-cycle counts, normalized coefficients, element-exact or
identical-profile-consensus Quantity or numeric scalar invariants, addition,
scalar/Quantity structural-attribute sums, and multiplication. Structural sums
reuse the package candidate-attribute type environment and canonical set
selection. Quantity sums require analyzed unit/semantic agreement, add
effective absolute tolerance bounds exactly, and retain canonical evidence
unions; scalar and Quantity accumulation follow the bound run summation policy.
The same runtime evaluates structural cohort keys and formation-derived profile
functionals. See
[ADR-0087](adr/0087-package-functional-structural-attribute-sums.md).

All expression values remain unrounded until one result boundary under the
bound run precision. General Quantity products compose canonical units and
propagate effective absolute interval bounds conservatively as
`abs(a) * db + abs(b) * da + da * db`. The normalized functional result
specification fixes the output semantic and canonical unit. Its declared
`toleranceTarget` is a score-admissibility gate: an excessive bound produces a
hashed `indeterminate` artifact and `score: null`. Missing or ambiguous exact
invariants and missing/disagreeing profile-member values are also explicit
indeterminate outcomes. Invalid package, binding, filter, expression, or unit
state is a contract error. The artifact and its complete set/invariant/
coefficient witnesses are hashed in
`onto2d:package-functional-evaluation:v1`; see
[ADR-0032](adr/0032-package-functional-evaluation.md).

This primitive does not rank or admit a candidate. A selector may consume its
scores only after constructing the complete cohort and retaining every
indeterminate member, so invoking candidate-local calculation cannot prune
generation or shrink a ranking denominator.

### 8.7.2 Complete package-cohort partitioning

`package-cohort-partitioner-v1` is the total pre-ranking boundary. It MUST
reproduce the supplied complete census from independent package/run inputs,
MUST select only the census's `eligible` candidates, and MUST preserve rejected
and filter-indeterminate candidate IDs as explicit exclusions. An
indeterminate census interpretation yields no cohorts, and an empty eligible
population yields an explicit empty partition.

Every cohort-key expression is reanalyzed and executed through the same
verified package value runtime as finite functionals. `shared-support` uses
connected components of a candidate/resource incidence graph with expression-
slot namespaces; `profile-role` uses exact ordered normalized tuples;
`invariant-window` uses arbitrary-precision floor bins anchored by the declared
origin and positive width; `singleton` and explicit `global` have no hidden
key expression. Quantity keys retain effective absolute tolerance. A value
interval must lie wholly inside one invariant window, while uncertain origins,
uncertain widths, missing values, or ambiguous values make the complete
partition indeterminate.

No rule may emit a partial cohort set. Complete partitions reconcile exact
coverage and non-overlap, hash every cohort in `onto2d:cohort:v1`, and hash the
full source census, rule, exclusions, evaluations, membership, and counts in
`onto2d:package-cohort-partition:v1`. Serialized partitions are trusted only
after exact deterministic replay; see
[ADR-0033](adr/0033-complete-cohort-partitioning.md). This stage does not score,
rank, admit, reject, or prune a candidate.

### 8.7.3 Complete-cohort selector ranking

`package-selector-ranker-v1` is the current finite ranking boundary. It MUST
reproduce the complete census and partition, require the selector's declared
cohort rule, and evaluate the referenced functional for every member through a
reusable verified session. Every scored or indeterminate functional artifact
remains embedded in the ranking; a caller cannot submit scores or omit a
member.

Scoreable members are serialized by objective-oriented rounded value and then
candidate ID. Dense tolerance ranks are connected components of their closed
effective-uncertainty intervals, avoiding order-dependent pairwise tolerance
chaining. The semantic extremum set is separately defined by one closed
comparison against the optimum plus the normalized epsilon value, using the
maximum candidate, optimum, and epsilon effective bound. Canonical IDs only
stabilize order and the presentation leader; they never reduce that set.

Ranked cohorts report optimum, complete semantic extrema, degeneracy and its
ratio, variational selectivity, and the objective-oriented first-to-second
member gap. Singleton and fully degenerate cohorts therefore report zero
variational concentration. If any member is unscoreable, provisional ranks of
scoreable members remain diagnostics, but all cohort selection metrics become
`null` and no member receives a semantic-extremum label. The level-wide summary
is population-weighted across the complete partition and is also `null` when
any required cohort is indeterminate.

The artifact is protected by a preflight functional-evaluation ceiling and is
hashed in `onto2d:package-selector-ranking:v1`; serialized rankings require
exact replay under
[ADR-0034](adr/0034-complete-cohort-functional-ranking.md). Multi-selector
admission, derived-element materialization, and pruning remain separate
boundaries.

### 8.7.4 Complete coefficient-sensitivity execution

`package-selector-sensitivity-evaluator-v1` MUST reproduce the complete base
ranking and its package/run/census/partition basis before accepting any stored
leader or score. For each normalized amplitude, `one-at-a-time` expands the
negative and positive factor of each listed sensitivity coefficient;
`cartesian` expands the complete lexicographic sign product. Factors are exact
`1 - amplitude` or `1 + amplitude`. They scale coefficient value and absolute
tolerance while retaining relative tolerance and provenance.

Variant count, member evaluations, and cohort comparisons are calculated
before execution. The run `perturbationSamples` budget limits variants, and a
separate hard ceiling limits functional evaluations. Any insufficient budget
emits a fully hashed indeterminate report without a partial sweep; counts above
the JSON safe-integer range are preserved as exact decimal strings.

Every executable variant reevaluates every member of every reproduced cohort
and applies the ranking semantics in section 8.7.3. Each amplitude compares
the complete semantic-extremum set, deterministic presentation leader, and
canonical set of the first `min(topK, cohortSize)` ranked members over exactly
`requiredVariants * cohortCount` comparisons. A missing perturbed score makes
the report indeterminate and leaves stability ratios `null`; the denominator
is never reduced. Empty rankings and functionals with no declared sensitivity
coefficients are `not-applicable`, never robust.

A complete report is `robust` only when every amplitude meets both declared
leader-set and top-K thresholds; otherwise it is `fragile`. Full variants,
cohort rankings, comparison witnesses, execution reconciliation, and the base
hash chain are bound in `onto2d:package-selector-sensitivity:v1`. Variant IDs
also bind that semantic basis in
`onto2d:package-selector-sensitivity-variant:v1`. Serialized reports require
exact replay under
[ADR-0035](adr/0035-coefficient-sensitivity-execution.md). Schema-v1 still
cannot prove that authors listed every coefficient that scientifically ought
to be varied because coefficient disposition is not typed.

### 8.7.5 Deterministic multi-selector admission

`package-selector-admission-v1` MUST independently reproduce the complete
local-filter census and exactly one partition/ranking/sensitivity chain for
every normalized package selector. Missing, duplicate, or undeclared selector
executions fail before an artifact is emitted. Normalized selector-ID order is
the schema-v1 deterministic order bound by the rules hash; caller array order
is non-semantic.

Each selector continues to rank its own declared total partition of the same
complete locally eligible population. Combination is not sequential reranking:
an eligible candidate is selected only when it belongs to every applicable
semantic-extremum set. A definite non-extremum under any selector yields
`selector-excluded` even if another selector is indeterminate. Otherwise any
unavailable semantic-extremum decision yields `selection-indeterminate`.
With no declared selectors, identity admission retains every locally eligible
candidate without inventing a ranking or variational metric.

The artifact retains predicate-rejected and filter-indeterminate candidates,
every selector evaluation, the selectors selecting/excluding/indetermining
each eligible candidate, per-selector censuses, final reconciliation counts,
selection and overall retention, and the exact final indeterminate ratio. That
ratio is interpreted against the frozen run threshold. Sensitivity fragility
does not mutate the reproducible base selected set, but marks the affected
variational interpretation fragile; sensitivity or ranking indeterminacy
remains explicit.

The complete chain is bound in `onto2d:package-selector-admission:v1` and
stored artifacts require exact replay under
[ADR-0036](adr/0036-multi-selector-admission.md). This boundary selects
candidate IDs only. Derived `Element` formation provenance, profile extraction,
alternate-derivation reconciliation, and depth materialization remain separate.

### 8.7.6 Selected formation materialization

`package-selected-formations-v1` MUST reproduce both the complete local census
and the complete admission artifact before emitting any record. It emits
exactly one formation for each decision whose final outcome is `selected` and
none for predicate-rejected, filter-indeterminate, selector-excluded, or
selection-indeterminate candidates.

Each formation preserves the canonical candidate, target depth, depth basis,
source-population hash, filter hash, and complete exact/profile constituent
resolution already proved at the filtering boundary. It binds every passed
top-level predicate in `admittedBy`, every selecting selector in `selectedBy`,
the cohort/functional/ranking/sensitivity witness chain for each selector, and
the canonical predicate/functional/selector claim and claim-evidence union. A
profile-quotient record retains both the deterministic representative and the
complete profile class; the representative is not silently promoted to a
structural value.

Candidate ordering is canonical ID order, and the selected-formation count
MUST equal the admission's selected-candidate count. The full candidate-domain
admission counts remain part of the artifact because a future unique element
count may be smaller after alternate derivations are reconciled. Individual
records are bound in `onto2d:selected-formation:v1`; the complete set is bound
in `onto2d:package-selected-formations:v1` and requires exact replay under
[ADR-0037](adr/0037-selected-formation-materialization.md).

This is intentionally a formation-only boundary. Schema-v1 has no executable
derived-profile rule at this boundary, while profile identity is structural by
default. The materializer therefore MUST NOT invent an empty or caller-
supplied profile, derived element ID, alternate-derivation collapse, or depth
population. ADR-0038 supplies the later separate D5 boundary below.

### 8.7.7 Residual profiles and derived depth materialization

The optional `profileDefinition.kind = "residual-slots-v1"` remains the base-
only executable derived-profile hypothesis. `residual-slots-v2` retains those
rules and adds a canonical set of formation-functional profile invariant
definitions. Each definition binds one package functional, a unique semantic,
and a compatible positive Quantity quantization. The normalized base profile,
derived type tags, invariant definitions, and claim references are hashed
package rules. The safe default remains `explicit-only`, which cannot produce
a derived profile.

`residual-slots-v3` further adds canonical formation-derived type rules. Each
rule binds a unique output tag to one v2-derived invariant, a closed comparator,
and a compatible same-semantic Quantity threshold. Rules run only after the
complete invariant stage succeeds. They retain the source functional hash and
full tolerance-aware comparison, then expose the sorted union of static and
assigned type tags. See
[ADR-0079](adr/0079-formation-derived-type-classification.md).

`package-derived-profile-extractor-v3` MUST replay every prerequisite through
the selected-formation set. It processes internal edges in canonical order,
consuming one `out` capacity at the source and one `in` capacity at the target;
`sym` may satisfy either endpoint. Exact polarity precedes `sym`, followed by
normalized slot index. Used capacity is subtracted from both finite minimum and
maximum (with minimum floored at zero); unbounded maximum stays unbounded and a
zero-maximum slot disappears. The normalized result combines every residual
constituent slot with the frozen base profile slots and uses the declared
invariant vector and precision policy.

Typed partner guards execute over every verified member of the partner profile
class with three-valued logic; a legacy content-hash guard remains explicitly
unsupported. Missing/incompatible data or class-member disagreement is
indeterminate, while a unanimous false guard is unsatisfied. Exact polarity,
then symmetric polarity, then normalized slot index defines preference, so an
unresolved higher-preference guard cannot be skipped. Missing capacity is also indeterminate, and `explicit-only` is an unavailable
derived-profile policy. Under `residual-slots-v2`, every declared functional is
evaluated against the formation's verified eligible filter and exact binding.
All evaluations remain embedded in the result; one indeterminate result makes
the whole profile indeterminate before capacity consumption. Scored results
are composed with the base invariant vector before profile hashing, and v3 type
rules then classify that verified vector without reevaluating a functional. None of
these failure cases emits an empty stand-in profile.
Every result is bound in `onto2d:derived-profile-extraction:v1`, and the full
set in `onto2d:package-derived-profiles:v1`. Any selected indeterminate profile
makes the set indeterminate without reducing its denominator.

`package-derived-depth-population-v3` emits a derived depth only from a complete
profile set. Any profile indeterminacy yields no partial elements; no selected
formations yields an explicit empty depth. Derived element identity binds the
canonical candidate graph/content and the fields enabled by the loaded
identity policy. Quantity structural attributes bind normalized value, unit,
tolerance, and semantic meaning without evidence provenance. Derivation,
evidence, claims, minimum depth, and selection witnesses remain non-structural.
An explicit normalized `RunConfig.ontologyTarget` is copied to the derived
element and level with declared ontology-axis provenance. It participates in
element identity only when `ontologyCoordinateStructural` is enabled and is
never inferred from derivation depth. See
[ADR-0077](adr/0077-run-target-ontology-coordinate-materialization.md).

Equal structural element IDs are reconciled after materialization. The
lexicographically smallest formation hash supplies the primary immutable
element record, while every formation remains in a separately hashed canonical
derivation index. The population binds its full prerequisite chain, identity
policy, elements, derivations, counts, depth basis, and interpretation in
`onto2d:depth-population:v1`; exact replay is required under
[ADR-0038](adr/0038-residual-slot-profiles-and-derived-depth.md).
Formation-functional coordinates are frozen in
[ADR-0069](adr/0069-formation-functional-profile-invariants.md).
Typed guard execution is frozen in
[ADR-0070](adr/0070-typed-profile-partner-guards.md).

### 8.8 Run configuration and budgets

```ts
interface RunBudget {
  maxNodes: number;              // default 4
  maxEdges: number | "n+2";     // default n + 2
  maxCandidates: number;         // default 1_000_000
  perturbationSamples: number;   // default 200
  nullModelRuns: number;         // default 500
  maxWallTimeMs?: number;
  maxResidentBytes?: number;
}

interface RunConfig {
  countingDomain: "profile-quotient" | "element-exact" | "single-candidate";
  sourceDepths: "all-below" | "previous-only";
  reportAxes: AggregationAxis[];
  roleAlphabet: string[];        // recommended maximum: 6 in normal runs
  budget: RunBudget;
  seed: string;
  invariantPrecision: PrecisionPolicy;
  graphPolicy: GraphPolicy;
  substructurePolicy: SubstructurePolicy;
  nullModels: NullModelId[];
  ontologyTarget?: OntologyCoordinate;
  evidencePolicy: "require-all" | "allow-declared";
  indeterminateThreshold: number;
  levelBoundaryPolicy?: LevelBoundaryPolicy;
  boundedFixpoint?: { enabled: boolean; maxIterations: number };
}

interface LevelBoundaryPolicy {
  enabled: boolean;
  searchIntervals?: { fromDepth: number; toDepth: number }[];
  maximumCollapseError: number;
  tieTolerance: number;
}

interface PrecisionPolicy {
  id: string;
  decimalPlaces: number;
  rounding: "half-even" | "half-up" | "toward-zero";
  summation: "exact-decimal" | "compensated-binary64";
}

interface GraphPolicy {
  connected: boolean;
  allowParallelEdges: boolean;
  allowSelfLoops: boolean;
  connectivityProjection: "undirected" | "directed-strong" | "directed-weak";
  structuralNodeAttributes: string[];
  structuralEdgeAttributes: string[];
}

interface SubstructurePolicy {
  id: string;
  remove: "nodes" | "edges" | "nodes-and-edges";
  includeDisconnected: boolean;
  includeEmpty: boolean;
  retainIsolatedNodes: boolean;
}
```

Every default expanded by the loader MUST be materialized in the normalized configuration before hashing. Environment-dependent defaults are forbidden.

`indeterminateThreshold` and every robustness threshold are finite ratios in `[0, 1]`. They are mandatory declared values for research runs; the loader does not choose them from observed results.

### 8.9 Level result

```ts
interface LevelResult {
  schemaVersion: string;
  depth: number;
  depthBasis: BasisHash;
  ontologyCoordinate?: OntologyCoordinate;
  axisProvenance: AxisProvenance;
  countingDomain: RunConfig["countingDomain"];
  counts: {
    generatedBeforeCanonicalization: number;
    canonicalCandidates: number;
    evaluatedCandidates: number;
    predicateRejected: number;
    filterIndeterminate: number;
    eligibleCandidates: number;
    selectorExcluded: number;
    selectionIndeterminate: number;
    selectedCandidates: number;
    finalIndeterminate: number;
    admittedElements: number;
  };
  admitted: Element[];
  booleanSelectivity: number | null;
  variationalSelectivity: Record<SelectorId, number | null>;
  selectionRetention: number | null;
  overallRetention: number | null;
  indeterminateRatio: number | null;
  toleranceProfile: Record<string, ToleranceUse[]>;
  interpretation: {
    status: "valid" | "truncated" | "empty" | "indeterminate";
    reasons: string[];
    metrics: {
      booleanSelectivity: MetricInterpretation;
      variationalSelectivity: Record<SelectorId, MetricInterpretation>;
      overallRetention: MetricInterpretation;
    };
  };
  census: Record<PredicateId, PredicateCensus>;
  selectorCensus: Record<SelectorId, SelectorCensus>;
  cohorts: CohortResult[];
  sensitivity: Record<SelectorId, SensitivityReport>;
  profileClasses: ProfileClass[];
  carrierPromotions: CarrierPromotion[];
  boundaryDetection?: LevelBoundaryReport;
  baseline: NullModelBaseline | NullModelDisabled;
  budgets: BudgetUsage;
  fixpoint?: FixpointResult;
  semanticManifest: SemanticRunManifest;
  executionRecord: ExecutionRecord;
}

interface MetricInterpretation {
  status: "valid" | "truncated" | "empty" | "indeterminate" | "fragile" | "not-applicable";
  reasons: string[];
}

interface BudgetUsage {
  generatedCandidates: number;
  perturbations: number;
  nullTrials: number;
  wallTimeMs: number;
  peakResidentBytes?: number;
  exhausted: (keyof RunBudget) | null;
}

interface FixpointResult {
  enabled: boolean;
  iterations: number;
  maxIterations: number;
  converged: boolean;
}

interface SelectorCensus {
  eligible: number;
  selected: number;
  excluded: number;
  indeterminate: number;
  cohorts: number;
  totalDegeneracy: number;
  weightedVariationalSelectivity: number | null;
}
```

The counts MUST reconcile as follows:

```text
evaluatedCandidates = predicateRejected + filterIndeterminate + eligibleCandidates
eligibleCandidates  = selectorExcluded + selectionIndeterminate + selectedCandidates
finalIndeterminate  = filterIndeterminate + selectionIndeterminate
```

The compatibility projection MAY expose `generated`, `budgetExhausted`, `eligibility = booleanSelectivity`, and the former one-dimensional `selectivity = overallRetention`. The canonical result uses the two primary selectivity dimensions and explicit reconciliation counts. `selectionRetention` isolates how many eligible candidates lie in semantic extremum sets; `overallRetention` measures the composition of hard filtering and finite-cohort retention. `selectedCandidates` counts all epsilon-equivalent extrema, never presentation leaders alone. `admittedElements` is the number of unique materialized elements after structural identity and alternate derivations are reconciled; it may be smaller and MUST NOT replace a candidate-domain numerator.

## 9. Canonicalization and content addressing

### 9.1 Canonical graph labeling

Decorated-candidate canonicalization MUST use refinement-based labeling:

1. assign initial colors from structural node attributes and element/profile references;
2. refine colors with directed, role-labelled incident-edge signatures using 1-WL;
3. if a color class still contains multiple nodes, individualize deterministically;
4. explore the remaining permutations or branches until the lexicographically smallest serialization is found;
5. serialize nodes and edges in canonical order;
6. hash the versioned bytes.

Parallel edges, direction, role, structural attributes, and self-loop policy MUST participate in refinement and final comparison. Non-structural annotations MUST NOT affect identity.

For the intended `n <= 6`, correctness and determinism take precedence over asymptotic optimization.

Simple-skeleton canonicalization MUST independently evaluate the complete node
permutation orbit and choose the lexicographically smallest sorted edge
serialization. The exhaustive skeleton path is the identity baseline against
which the refinement-based decorated-candidate projection is checked. Each
visited permutation consumes one declared canonicalization search state before
it may be cached or evaluated. The executable exhaustive range is hard-capped
at six nodes; a caller cannot raise `maxNodes` beyond that reviewed range.

### 9.2 Canonical serialization

Canonical serialization MUST define:

- UTF-8 encoding;
- lexicographically sorted object keys;
- stable array ordering where order is semantic;
- explicit sorting where input order is not semantic;
- normalized numbers, including rejection of `NaN` and infinities;
- no insignificant whitespace;
- an explicit schema/domain prefix.

Insertion order, locale, timezone, platform line endings, and JavaScript engine formatting MUST NOT affect semantic bytes.

### 9.3 Determinism under concurrency

Enumeration, predicate evaluation, and null-model trials MAY execute concurrently. Artifact order MUST be recovered by sorting on stable keys before canonical serialization. Worker completion order MUST never be observable in semantic artifacts.

## 10. Candidate generation

### 10.1 Skeleton enumeration

The generator first enumerates canonical connected, unlabeled, undirected simple skeletons. Reference counts for conformance are:

The lower-level standalone skeleton canonicalizer also accepts disconnected
simple graphs so that identity is not coupled to one generation policy.
`enumerateConnectedSkeletons` is the boundary that enforces connectedness for
the generator.

| Nodes | Connected unlabeled simple graphs |
|---:|---:|
| 3 | 2 |
| 4 | 6 |
| 5 | 21 |
| 6 | 112 |

These counts validate only the skeleton stage. They do not include directions, roles, parallel edges, attributes, or node references.

### 10.2 Decoration

For each skeleton, decoration assigns:

- a permitted multiplicity to each adjacency when multiedges are enabled;
- direction to each edge instance;
- a role from the configured alphabet;
- structural edge attributes declared by the package;
- element or profile references to nodes according to counting domain.

The decorator processes one skeleton at a time and yields a deterministic logical order. It MUST check hard budgets before materializing the next candidate.

The current low-level `decorated-candidate-enumerator-v5` realizes this finite
boundary from explicit caller-supplied node and edge variant alphabets. It
canonicalizes and sorts those alphabets, treats decorations on one adjacency
as a multiset rather than an edge sequence, applies the declared edge bound,
and sends only complete graph-policy-admissible decorations to the fixed-domain
CandidateStore. Its internal complete-candidate gate records composition
exclusions separately before store admission; the public generic enumerator
does not infer any package profile semantics.

The current `run-config-normalizer-v2`, `primitive-depth-population-v1`, and
`package-candidate-binding-v2` bridge first materializes the reproduced loaded
package as complete depth-zero `Element` records. The binding records the full
population artifact and a selection with `targetDepth: 1`,
`availableDepths: [0]`, and `selectedDepths: [0]`. Both source-depth policies
select depth zero, but the declared policy remains identity-bearing. The bridge
uses element IDs in `element-exact`, one profile hash per disclosed class in
`profile-quotient`, the normalized `roleAlphabet` as edge variants, and all
connected skeletons from one through `budget.maxNodes`. The lexicographically
smallest element ID is recorded as each profile class representative. The
normalized run, population and depth identities, semantic generation budgets,
and raw/state/search execution limits enter the binding hash.
`package-candidate-generator-v5` executes that frozen input through the
low-level decorator.

The package's normalized `candidateAttributes` registry supplies the finite
scalar or Quantity node/edge decorations selected by the RunConfig graph policy. A
`constant-scalar-v1` definition contributes the same finite JSON scalar to
every selected node or edge variant, while `constant-quantity-v1` contributes
one SI-normalized Quantity. `element-invariant-scalar-v1` and
`element-invariant-quantity-v1` copy the correspondingly typed package-authored
invariant to exact node variants.
Profile-quotient generation requires canonical consensus across every class
member and never substitutes the disclosed representative. Missing or
member-dependent values fail before enumeration. The same typed registry is
used to compile predicates, functionals, and cohorts. A structural Quantity's
complete normalized provenance participates in candidate identity; the derived
element projection still excludes evidence provenance and retains it through
the derivation index. `edge-role-scalar-v1` and `edge-role-quantity-v1` select
one homogeneous map value per normalized run role and require complete role-
alphabet coverage before enumeration. A scored formation functional can enter
candidate structure only through the acyclic derived-profile → derived-
`Element` invariant → later-depth `element-invariant-quantity-v1` path; direct
same-candidate feedback remains forbidden. Loader and binding checks preserve
the Quantity type across that boundary. See
[ADR-0078](adr/0078-package-driven-scalar-candidate-attributes.md) and
[ADR-0085](adr/0085-package-driven-quantity-candidate-attributes.md), and
[ADR-0086](adr/0086-role-dependent-edge-candidate-attributes.md), plus
[ADR-0088](adr/0088-formation-functional-candidate-attribute-carry-forward.md).

The normalized identity-bearing `profileCompositionPolicy` preserves the
historical `post-admission-v1` universe by default. With the explicit
`profile-slot-gate-v1` policy, `package-profile-composition-gate-v1` evaluates
each complete canonical candidate before CandidateStore admission. Canonical
edge order, source-then-target endpoint order, exact-polarity-before-symmetric
slot preference, and one-unit endpoint consumption mirror residual-profile
materialization. Typed partner guards inspect every member of the complete
partner profile class. Definite capacity or guard failures are separate
composition exclusions; any indeterminate or legacy guard aborts the entire
generation instead of reducing its denominator. Every decision and aggregate
transcript is content-addressed under dedicated domains. The disabled policy
still produces an explicit `not-run` artifact. See
[ADR-0076](adr/0076-profile-slot-composition-generation-gate.md).

`package-candidate-filter-evaluator-v20` separately reproduces the loaded
package under an independently expected kernel version and reproduces the
complete binding, re-canonicalizes a candidate under the bound
policy, and proves domain, node/edge budget, skeleton, node variant, edge
variant, and non-parallel adjacency-group membership. It discloses direct
element or profile-class resolution for every canonical node, derives exact
and complete class-member invariant contexts from the reproduced population,
reproduces each plan's run-specific numeric binding, and evaluates all graph
or supported local-numeric/top-level minimality, irreducible-removal, exact
constituent-novelty, and exhaustive typed-stability plans
without stopping after a failure. Each substructure plan is preflighted against
the bound run substructure policy. A
profile representative is never used as an invariant value shortcut. The
hashed result distinguishes `eligible`, `predicate-rejected`, and
`filter-indeterminate`; candidate-local invariant resolution failures enter
the latter with structured evidence rather than aborting the complete census.
It deliberately stops before selector-based final
admission and derived-element materialization. A plan requiring an attribute
absent from the corresponding bound structural node/edge decoration alphabet
is rejected before evaluation; missing data never becomes a trusted empty
selection.

`package-candidate-census-evaluator-v1` prepares this verified filter boundary
once, including immutable universe-membership and source/profile indexes,
applies it to every canonical record of one complete package enumeration, and
emits full per-candidate explanations together with total and exclusive
predicate rejection counts. The v1 artifact is hashed under
`onto2d:package-candidate-census:v1`, has an exact reproduction verifier for
stored artifacts, and remains pre-selector.

The original generation bridge remains primitive-only.
`package-depth-source-selector-v2` adds a separately hashed, exact-replay
bridge for explicit target depths up to 64. It requires every complete prior
level closure in contiguous order, records all available populations, executes
`all-below` or `previous-only`, reconciles repeated element IDs at their
minimum selected depth, and derives the selected profile classes.
`package-depth-candidate-binding-v2` then substitutes that verified alphabet
into the same finite skeleton/role/policy/budget surface, and
`package-depth-candidate-generator-v3` enumerates it. The separate depth-aware
filter exact-replays that binding, resolves constituents from the selected
depths, and executes the same local predicate plans. Its complete census binds
every canonical evaluation and reconciles Boolean selectivity. The depth-aware
cohort, ranking, sensitivity, admission, formation, profile, and population
boundaries reuse the verified primitive selection algorithms without changing
their mathematical policies. `package-depth-level-closure-v1` embeds that
entire target transition and hashes it under the level-result domain.

Primitive, generalized-depth, and bounded current-level-fixpoint generation
all use the same complete-candidate composition gate and package-driven scalar
and Quantity attribute derivation, including later-depth formation-functional
carry-forward. All ordinary generation bridges reject
`single-candidate`, disconnected generation, selected structural attributes
without a compatible package definition, and unenforceable wall-time/resident-memory limits instead of
silently weakening them. The decorator itself does not apply predicates.
Profile slot guards and capacities are evaluated only on complete candidates;
raw subtree authority is derived from the separate complete extension census
frozen by ADR-0084, never from a partial profile guess.

### 10.3 Partial evaluation and pruning

After every extension, the generator evaluates all pruning-eligible predicates whose required data is available. A monotone violation closes that branch. Pruned partial candidates are tracked separately from complete generated candidates and MUST NOT enter the selectivity denominator.

The run report SHOULD include pruning counts by predicate because an incorrect or unexpectedly dominant pruning rule materially changes the explored universe.

The current `partial-graph-predicate-evaluator-v1` can record a persistent
failure only for a verified `static-proven` graph plan, and every diagnostic
still declares `pruningAuthorized: false`. The v1 audit/controller now binds a
narrow complete-node edge-prefix extension model and emits a separate hashed
authorization decision. A prepared session now supplies those decisions to the
depth-one pre-admission generator. The resulting artifact records a pruning
census and proves pruning-disabled post-filter equivalence before it is
interpretable. A second audit/controller binds the actual raw edge-group
frontier frame and exact descendant counts; the recursive generator consumes
it and proves exact agreement with both reference modes. Directed-strong
frontiers are additionally required to be already strongly connected. The
depth-aware variant reproduces the complete prior-level chain, target binding,
and source selection before applying the same controller and conformance
  rules. ADR-0082 separately freezes a raw node-prefix/complete-extension audit
  frame, exact descendant-count validation, prepared authorization, and
  differential-conformance generators at depth one and arbitrary target
  depths. It permits only `static-proven` persistent failures and remains
  fail-closed for `directed-strong` node
  prefixes whose later policy exclusions are not yet fixed. ADR-0081 supplies
  the underlying exact node-frontier counts and portable replay-resumable raw
  traversal without bypassing semantic budgets. ADR-0083 separately composes
  the complete-candidate profile gate with canonical-prefix pre-admission
  pruning: the gate runs first, the audit binds exactly its compatible
  universe, and exact profile transcripts plus pruning-disabled post-filter
  conformance are required at depth one and arbitrary target depths. This
  narrower integration grants no raw edge-group or node-frontier authority.
  ADR-0084 adds that authority through an independent census over every
  complete graph-policy-admissible raw extension, binds compatible/excluded
  counts to exact frontier keys, and requires both generators to reconcile the
  skipped dispositions with the complete profile transcript and reference
  result sets.

### 10.4 Deduplication

Every complete decorated candidate is canonicalized. The candidate store admits only the first canonical ID and records duplicate counts. Selection of the retained representative is deterministic.

### 10.5 Budget behavior

Budget exhaustion is a result state, not a normal completion. On exhaustion the kernel MUST:

- stop at a deterministic boundary;
- retain partial diagnostic artifacts;
- record the first exhausted budget and usage;
- mark selectivity non-interpretable;
- skip claims based on cross-level comparison;
- never present the partial ratio as an exact level selectivity.

## 11. Predicate language semantics

### 11.1 Built-ins

| Predicate | Complete-candidate meaning | Violation monotonicity under additive extension |
|---|---|---|
| `degree(node, role, min, max)` | Role-filtered incident degree is within bounds | Exceeding `max` is monotone; being below `min` is not |
| `cycleExists(roles?, projection, minLength?, maxLength?)` | At least one matching cycle exists in the declared projection and length range | Absence is not monotone; violation of `not(cycleExists)` is monotone when extensions only add edges |
| `connected()` | The declared graph projection is connected | Disconnection is not monotone when connecting extensions are allowed |
| `componentCount(n)` | Projection has exactly `n` components | Depends on the allowed extension operation |
| `pathExists(a,b,roles?)` | A matching directed path exists | Absence is not monotone |
| `countRole(role,min,max)` | Matching edge count is within bounds | Exceeding `max` is monotone; being below `min` is not |
| `balance(attr,over)` | Selected numeric values sum within tolerance of zero | Not monotone in general |
| `compare(left,op,right)` | Typed scalar comparison succeeds | Derived from operands and extension semantics |

The analyzer MUST reason about individual lower- and upper-bound clauses rather than attach one unconditional monotonicity fact to a combined range predicate.

In the current complete graph evaluator, a `degree` range applies to every
selected node; each incident edge record, including a self-loop, contributes
one. An empty selector is `indeterminate`. `pathExists` is directed and admits
a zero-edge path when selected endpoints coincide. A missing endpoint selector
is `indeterminate`. `connected` and `componentCount` use the effective graph
policy's weak/undirected or directed-strong projection.

Cycle projections are operationally distinct. `directed` preserves loops and
reciprocal two-cycles, `undirected-multigraph` preserves loops and parallel
two-cycles, and `undirected-simple` removes loops and collapses parallel and
directional copies before searching for cycles of length at least three.

`balance` directly expresses cases such as `k1 + k2 + k3 = 0` and `omega1 + omega2 + omega3 = 0`. Its operands MUST have compatible units. Its tolerance and numeric accumulation policy MUST be explicit and hashed.

The current complete-candidate balance runtime supports node and edge sets. It
accumulates in canonical selection order, rounds the signed aggregate once at
the result boundary, and applies `abs(aggregate) <= tolerance.value` as a
closed `lte` Quantity comparison. Declared uncertainty on the aggregate and
threshold combines through `declared-max-tolerance-v1`; compensated arithmetic
only changes the disclosed exactness flag. A dimensionless scalar aggregate is
lifted solely for that comparison. A Quantity aggregate retains its canonical
unit, semantic, evidence, and conservative absolute bound.

`SetSelector { kind: "cycle" }` uses the frozen
`directed-cycle-edge-union-v1` method. After its optional role filter, it
selects every canonical edge `u -> v` for which `v` can reach `u` in the same
directed filtered graph. Loops and reciprocal pairs are therefore retained,
parallel qualifying edges remain distinct, overlapping cycles do not
double-count an edge, and an empty union is an exact empty set. The selector
does not infer an undirected projection from graph connectivity policy. Its
witness records the method, role filter, and sorted edge indexes. See
[ADR-0031](adr/0031-directed-cycle-edge-selection.md).

For the foundational paper's coherent resonant triad, the rule package MUST use an `undirected-simple` projection with `minLength: 3`; reciprocal directed edges in a two-node dyad are not the paper's nontrivial loop.

### 11.2 Boolean combinators

`all`, `any`, and `not` use three-valued internal evaluation (`pass`, `fail`, `indeterminate`). The truth tables MUST be documented in the API reference and covered by conformance tests. `not(indeterminate)` remains `indeterminate`.

| Expression | `pass` condition | `fail` condition | Otherwise |
|---|---|---|---|
| `all(args)` | every argument passes | at least one argument fails | `indeterminate` |
| `any(args)` | at least one argument passes | every argument fails | `indeterminate` |
| `not(arg)` | argument fails | argument passes | `indeterminate` |

An indeterminate required predicate is never counted as eligible. At final candidate level, a definite failure dominates an indeterminate sibling under `all`; if no required predicate fails and at least one is indeterminate, the candidate enters the filter-indeterminate bucket. The report prints its ratio beside Boolean and variational selectivity. Exceeding the frozen `indeterminateThreshold` marks affected metrics non-interpretable.

### 11.3 `minimal(P)`

`minimal(P)` passes exactly when:

1. `P` passes for the whole candidate; and
2. `P` fails for every proper substructure selected by the run's `SubstructurePolicy`.

The policy MUST state whether substructures may remove nodes, edges, or both; whether empty and disconnected substructures are excluded; and how isolated nodes are treated. The default is every non-empty proper node-and-edge subgraph, including disconnected subgraphs.

The implemented `exhaustive-proper-subgraphs-v1` order treats canonical parent
index zero as the least-significant subset bit. `nodes` enumerates every proper
node subset with its induced edges; `edges` enumerates every proper edge subset
over the parent node set; and `nodes-and-edges` enumerates every node subset and
every edge subset whose endpoints it retains, excluding only the complete
parent graph. `retainIsolatedNodes` is applied before empty/connectivity
filters. Excluded selections remain explicit skipped evidence and do not enter
the evaluated denominator. A whole failure or indeterminate result terminates
without enumeration; after a whole pass, a passing proper subgraph yields
`fail`, otherwise an indeterminate subgraph or zero evaluated denominator
yields `indeterminate`, and only all evaluated proper subgraphs failing yields
`pass`. The selection family is preflighted against the shared hard limit of
10,000 and is recorded in
[ADR-0045](adr/0045-exhaustive-minimal-subgraphs.md), and direct scalar plus
candidate-local invariant uncertainty in
[ADR-0046](adr/0046-scalar-and-indeterminate-invariants.md), and package-
authored scalar invariant integration in
[ADR-0047](adr/0047-package-authored-scalar-invariants.md), and exact
constituent novelty in
[ADR-0048](adr/0048-exact-constituent-novelty.md).

### 11.4 `novel(P)`

`novel(P)` passes when `P` passes for the whole candidate and fails for every proper constituent element referenced by that composition. It differs from `minimal(P)`: novelty compares the whole with its derivational constituents, whereas minimality searches structural subgraphs.

The implemented `canonical-single-node-no-edge-v1` projection is available
only in the `element-exact` domain. Canonical parent nodes are visited in index
order. Each projection preserves that node and its structural attributes,
removes all inter-element edges, canonicalizes with connectedness disabled,
and records the source element, projection identity, parent mapping, outcome,
and nested witnesses. `novel` has no run-selected projection policy. It shares
the 10,000-attempt substructure ceiling, while nested policy-dependent
operators still bind the explicit run `SubstructurePolicy`. A passing whole
with no constituents is indeterminate, and quotient representatives are never
treated as exact constituent evidence. This contract is recorded in
[ADR-0048](adr/0048-exact-constituent-novelty.md).

### 11.5 `irreducibleRemoval(P)`

`irreducibleRemoval(P, removal)` passes when `P` passes for the whole candidate and fails after every permitted single node or edge removal. Removal uses the same normalization rules as candidate evaluation. Invalid perturbations, such as an empty candidate excluded by policy, are reported and omitted from the denominator rather than treated as automatic failures.

The irreducible-removal layer introduced in v10 enumerates removals in canonical parent-index
order and binds the run `SubstructurePolicy`. Node removal also removes incident
edges; `retainIsolatedNodes: false` then removes every remaining node without an
incident edge. Included empty graphs receive a separate content-addressed
substructure identity, while non-empty graphs use normal candidate
canonicalization with disconnected normalization enabled. A whole failure or
indeterminate result determines the combinator without enumerating removals.
After a whole pass, any passing removal produces `fail`, otherwise any
indeterminate removal or an empty evaluated denominator produces
`indeterminate`, and only all evaluated removals failing produces `pass`.
Attempted removals are bounded at 10,000 and all evaluated/skipped records are
retained. This contract is recorded in
[ADR-0030](adr/0030-irreducible-removal-evaluation.md).

### 11.6 `stableUnder(delta, P, threshold)`

The perturbation class `delta` is declared in the rule package. The executable
schema-v1 classes are `edge-deletion`, `node-deletion`,
`edge-role-replacement`, and `numeric-attribute-displacement`. Numeric
displacement targets a structural node or edge attribute, uses a positive
finite epsilon, and explicitly declares decrease and/or increase directions.
Each class defaults to `exhaustive-valid-single-edits-v1` and may explicitly
select `sampled-valid-single-edits-v1`; a registry-only string is not an
executable definition.

Let `V` be valid generated perturbations and `S` those for which `P` passes:

```text
stability = |S| / |V|
```

One applicable edit at one canonical parent index is one attempt even if two
attempts canonicalize to the same graph. A valid result satisfies the original
graph policy and enters `V`; graph-policy-invalid results and unavailable,
non-finite, or ineffective numeric edits are omitted from `V` but retained as
skipped witnesses. Other canonicalization failures propagate. All valid
results retain candidate identity and canonical-to-parent mappings.

Because `P` is three-valued, the exact runtime decision uses
`lower = |S| / |V|` and
`upper = (|S| + |indeterminate|) / |V|`. It passes when
`lower >= threshold`, fails when `upper < threshold`, and is otherwise
`indeterminate`. The threshold and fraction comparison are exact decimals;
run-precision-rounded bounds are presentation evidence only. A threshold of
`1` therefore requires every valid perturbation to pass. `|V| = 0` produces
`indeterminate` unless the definition declares `emptyPolicy: "vacuous-pass"`.
The exact family is preflighted against the shared 10,000
substructure/perturbation-attempt ceiling.

`sampled-valid-single-edits-v1` samples the same ordered attempt frame with
replacement. The stream is derived independently for the run, plan, current
canonical candidate, perturbation, sample ordinal, and rejection counter using
domain-separated SHA-256 and unbiased modulo rejection. The requested sample
count is the bound RunConfig `perturbationSamples` budget. Each accepted frame
index is auditable, and skipped graph-invalid observations remain outside the
valid sampled denominator.

For `n` valid sampled draws, the runtime builds conservative outward
six-decimal intervals around both `S/n` and `(S+I)/n`. The fixed
`chebyshev-union-95-v1` radius is an upward-rounded `sqrt(10/n)`, so the two
intervals have at least 95% joint coverage by Chebyshev's inequality and the
union bound. Sampled stability passes only when the passing-probability lower
bound meets the exact threshold, fails only when the non-failure-probability
upper bound is below it, and otherwise remains `indeterminate`. Exact and
sampled execution are recorded in
[ADR-0049](adr/0049-exhaustive-typed-stability.md) and
[ADR-0050](adr/0050-seeded-sampled-stability.md).

### 11.7 Cohort selectors

Selectors execute only after every canonical candidate has a local predicate verdict. Candidates with any failed required predicate are not in the selector cohort. If a required predicate is indeterminate, the candidate is not silently scored as eligible.

For each selector partition, the kernel MUST:

1. construct the complete cohort under the declared `CohortRule`;
2. evaluate the referenced unit-compatible functional for every eligible candidate;
3. place non-finite, missing, failed-oracle, or disallowed-partial scores in the selection-indeterminate bucket;
4. sort all scoreable members by objective-oriented score and canonical ID;
5. find the minimum or maximum under the declared precision policy;
6. retain all candidates within the declared unit-bearing epsilon window;
7. emit the complete ranking, semantic extremum set, degeneracy, degeneracy ratio, gap, exclusions, claims, and evidence;
8. perturb the declared coefficients by every positive and negative amplitude in the frozen sensitivity policy and emit `SensitivityReport`.

For minimization, `gap` is the second ordered score minus the optimum; for maximization, it is the optimum minus the second ordered score. It is therefore non-negative and has the functional's unit. It is `null` for a cohort with fewer than two scoreable members. A tied second member yields a zero gap. Epsilon MUST have the functional's unit and its own provenance.

The semantic extremum window is `score <= optimum + epsilon.value` for minimization and `score >= optimum - epsilon.value` for maximization, evaluated under the frozen numeric accumulation/comparison policy. Epsilon must be finite and non-negative. Its value defines degeneracy; its own quantity tolerance controls reproducible comparison at that boundary and does not widen the window recursively.

Sensitivity sweeps perturb coefficient magnitudes multiplicatively by `1 ± amplitude`; every amplitude must satisfy `0 < amplitude < 1`. `one-at-a-time` evaluates every named coefficient independently and is the mandatory default; `cartesian` evaluates the complete declared cross-product and must be budgeted explicitly. The report compares the complete semantic leader set as well as the canonical presentation leader and top-k membership. Robustness thresholds are fixed before execution. Changing coefficients, the coefficient subset, amplitudes, sweep mode, `k`, or thresholds changes the run hash.

For one amplitude, the denominator of each stability ratio is the number of required `(cohort, perturbationVariant)` comparisons. `leaderSetStability` counts exact equality with the unperturbed semantic extremum set, `presentationLeaderStability` counts equality of the first canonical presentation member, and `topKStability` counts exact equality of the canonical top-k candidate set. `topK` is capped by cohort size without duplicating members. A missing required comparison makes the sensitivity report indeterminate rather than silently shrinking its denominator.

The verdict is `robust` only when every amplitude point meets both the frozen leader-set and top-k thresholds; otherwise it is `fragile`. Presentation-leader stability remains diagnostic because changing one arbitrary representative inside an unchanged degenerate leader set is not a semantic instability.

With no declared selector, identity admission retains every locally eligible candidate, emits no synthetic ranking, and marks variational selectivity `not-applicable`. This differs from an explicit singleton cohort rule, which is a recorded experiment with zero measured variational concentration. Multiple selectors MAY be applied only in a declared deterministic order, which is part of the rules hash.

For paper-derived variational selection, values such as action or `F[psi]` MUST arrive as typed quantities with evidence. The selector does not infer a continuous functional minimum from a finite generated cohort.

### 11.8 External scientific oracle

The graph kernel contains no PDE, variational, field-integration, or continuous-stability solver. A separately versioned scientific adapter resolves `OracleRequest` and returns normalized `OracleResponse` data. The kernel validates the response schema, request binding, units, tolerances, residual, solver identity, convergence state, and evidence hash.

The domain-separated request hash includes candidate canonical bytes, requested quantity specifications, parameters, target tolerance, and solver ID/version/method. It is the memoization key. A solver version or method change necessarily produces a different request and run hash, so a stale cache entry cannot be reused silently.

Convergence handling is fixed:

- `converged`: values may be consumed after unit, tolerance, residual, and evidence validation;
- `failed`: every dependent predicate or functional is `indeterminate`, never `fail` and never a default value;
- `partial`: apply the package's frozen `PartialOraclePolicy`; the default-safe policy is `indeterminate`;
- `accept-expanded-tolerance`: accept only when its maximum-residual guard passes, multiply the declared tolerance exactly as configured, and record both original and effective tolerances in the witness.

Changing the partial policy is semantic and changes the run hash. `wallTimeMs` is retained as operational metadata but excluded from the semantic oracle-response hash. Oracle execution errors do not crash an otherwise reportable run; they produce traceable indeterminate dependents unless the response itself is malformed or bound to the wrong request, which is an evidence-integrity failure.

### 11.9 Computational cost

`minimal` may require an exponential number of evaluations in candidate size.
Implemented `minimal` refuses a family above 10,000 selected proper subgraphs
before materialization. One direct `novel` layer is linear in canonical parent
nodes, and one `irreducibleRemoval` layer is linear in the selected parent
nodes or edges, while nested removal combinators can again grow
combinatorially. This is accepted for the target range, normally `n <= 5` for
exhaustive substructure combinators. Cache keys MUST include canonical
substructure ID, expression hash, rules hash, and numerical policy.

## 12. Profile extraction and equivalence

Profile extraction occurs only after admission. It MUST be deterministic and configured by the frozen rule package.

For each admitted element:

1. derive every compositional slot;
2. normalize role, polarity, capacity, and guard;
3. calculate the declared invariant vector;
4. apply the run's precision policy;
5. sort the slot multiset canonically;
6. hash the normalized profile;
7. insert the element into the corresponding profile class.

Profile equality means equality of normalized profile bytes, not approximate runtime equality.

### 12.1 Profile-collapse conformance test

For a bounded fixture, the command MUST:

1. close a level in `profile-quotient` mode;
2. close it again in `element-exact` mode;
3. project exact candidates and verdicts to profile references;
4. compare the admitted projected canonical sets;
5. verify that every exact member of one projected candidate has the same verdict and relevant observables;
6. calculate `collapseError = |Sigma_full symmetric_difference Sigma_profile| / |Sigma_full|` in the common projected canonical domain;
7. report the smallest counterexample and differing predicate witnesses on mismatch.

`collapseError` is `null` when the exact/full set is empty. The specified ratio may exceed `1` if profile abstraction introduces more spurious candidates than the size of the full set; reports MUST NOT clamp it. The test is intended for small conformance configurations, not every production run.

`package-profile-collapse-evaluator-v1` implements this bounded comparison by
closing the requested depth independently in `element-exact` and `profile-
quotient` modes. Every candidate is projected by replacing its verified
constituents with their profile hashes and re-canonicalizing in the profile
domain. The report groups all exact multiplicities under that projected ID,
compares local predicate outcomes, final admission, selector outcomes, scores,
ranks, and sensitivity status, then compares the final admitted projected sets.
It retains the complete grouped observations, unclamped error, and
lexicographically smallest set or observable counterexample. A target skipped
because either ladder reached an earlier terminal is `truncated`; stored
reports are accepted only by exact replay under ADR-0042.

### 12.2 Level-boundary detection

The profile-collapse test also operationalizes the paper's effective-redescription boundary. `detectLevelBoundaries` runs the bounded exact-versus-profile comparison for every requested derivation transition under one `depthBasis` and emits:

```ts
interface CollapsePoint {
  fromDepth: number;
  toDepth: number;
  depthBasis: BasisHash;
  collapseError: number | null;
  declaredLevelBefore?: number;
  declaredLevelAfter?: number;
  declaredBoundary: boolean;
  detectedBoundary: boolean;
  matchesDeclaration: boolean | null;
}

interface LevelBoundaryReport {
  depthBasis: BasisHash;
  points: CollapsePoint[];
  detectedDepths: number[];
  declaredDepths: number[];
  status: "complete" | "truncated" | "indeterminate";
  notes: string[];
}
```

Within each frozen search interval, detected boundaries are every minimum within the declared tie tolerance whose `collapseError` does not exceed the declared maximum. Without explicit intervals, the command emits the full error profile and candidate minima but MUST NOT rewrite level labels automatically. The comparison table contains transition, error, declared level change, detection decision, and match/mismatch. A match is internal support for the profile-redescription hypothesis; a mismatch is a preserved falsifying result. Computed boundaries carry `axisProvenance.ontologyLevel = "computed"` only in a new derived mapping artifact and never mutate author-declared coordinates.

`package-level-boundary-detector-v1` executes one paired bounded ladder and
derives every requested transition point from it. Search-interval membership
uses the target depth inclusively. Candidate minima must satisfy both the
interval minimum plus tie tolerance and the maximum collapse error. Without
intervals they are reported but not promoted to detected boundaries. Declared
levels come only from a uniform element coordinate or the explicit run
`ontologyTarget`; missing or mixed declarations produce a `null` match rather
than an invented label. The report, comparison ladder hashes, points, minima,
detections, declaration comparison, and terminal status are content-addressed
and exactly replayed.

### 12.3 Effective redescription and carrier promotion

The foundational paper requires a completed Level-0 ensemble to support effective redescription as a new carrier domain. Onto2D operationalizes this through a profile and an explicit `CarrierPromotion` artifact.

Promotion requires:

- a selected admitted source element;
- a declared source and target `OntologyCoordinate`;
- a non-empty deterministic profile representing the target compositional interface;
- claim and evidence references for the redescription;
- a rules hash that fixes the profile definition;
- a bounded profile-collapse result or an explicitly recorded unresolved counterexample.

This mapping is a falsifiable implementation hypothesis, not a theorem supplied by the paper. Promotion creates target-package input; it does not rewrite the identity, depth, or ontology coordinate of the source element.

`package-carrier-promotion-materializer-v1` implements this boundary over one
exactly replayed ladder level and one verified bounded collapse report. Its
closed policy supplies source/target coordinates, target type tags,
claim/evidence references, and an explicit counterexample disposition.
Promotions are all-or-nothing for indeterminate inputs or empty profiles. A
completed counterexample is either blocked or retained verbatim and explicitly
accepted; it is never silently treated as equivalence. Each emitted mapping is
domain-hashed and includes a complete loadable target `PrimitiveDefinition`.
The set hash binds the source level/population, ladder, rules, collapse,
policy, decisions, and terminal interpretation, and verification requires
exact replay.

## 13. Closure execution pipeline

One level executes the following state machine:

```text
LOAD -> AUDIT -> SKELETONS -> DECORATE -> CANON -> FILTER
     -> COHORTS -> RANK -> SENSITIVITY -> ADMIT -> FORMATIONS -> PROFILE
     -> BASELINE -> REPORT -> COMPLETE
```

### 13.1 Load

- parse primitives, predicates, functionals, cohort rules, selectors, oracle policy, perturbations, claims, evidence, profiles, and run configuration;
- when present, validate the source-migration policy, exposure-declared classification annotations, node resolutions, classified relation layers, SCC partition, member projections, and metrics;
- materialize defaults;
- validate identifiers and references;
- verify source/evidence artifact hashes, units, tolerance completeness, and method metadata;
- type-check expressions;
- validate depth stratification;
- recompute the condensation quotient, require a DAG, and reconcile every raw source node and edge exactly once;
- analyze monotonicity;
- construct the primitive `depthBasis` hash including the approved cluster partition and inter-cluster generative quotient;
- calculate semantic input hashes.

### 13.2 Audit

- produce seeded substructure-extension samples;
- test every asserted monotone violation;
- stop the run on any counterexample;
- emit audit evidence.

### 13.3 Skeletons

- enumerate connected skeletons up to `maxNodes`;
- validate small-order counts;
- stream skeletons to avoid holding the decorated universe in memory.

### 13.4 Decorate

- assign node references, multiplicity, direction, role, and structural attributes;
- prune on safe monotone violations;
- enforce `maxEdges` and generation budgets.

### 13.5 Canon

- canonicalize complete candidates;
- deduplicate isomorphs;
- assign stable candidate IDs.

### 13.6 Filter

- evaluate every top-level predicate for every canonical candidate;
- collect witnesses and metrics;
- decide local eligibility only when all required predicates pass;
- build candidate explanations and the census.

The current package-bound filter implements the per-candidate state when every
top-level plan is logical/graph-structural or uses the frozen local-numeric
subset. The complete local-filter census aggregates that verified state over a
finished canonical package universe, retains every explanation, and reports
Boolean selectivity plus predicate diagnostics. Its verifier reproduces all
embedded generation/filter state rather than trusting shape or hash labels.
Integrated selector/final `LevelResult` census fields are now emitted by the
verified `package-level-result-census-v1` projection described below.
The schema-v1 profile aggregation registry is closed. All schema-v1
substructure combinators and predicate-environment value-expression sources
have executable local paths. Balance
is executable when its bound node/edge attribute exists; unavailable package-
derived attributes fail preflight.

`package-level-explanation-indexer-v1` now supplies the per-level artifact
lookup boundary for ordinary and depth-aware closures. It first reproduces the
complete level and any required prior-level chain, then emits exactly one entry
per evaluated candidate with the full filter, admission decision, optional
formation/profile, and every derived-element derivation link. A separate
content-addressed query snapshot can be produced by candidate ID. Full run-
bundle persistence and source-migration explanation traversal remain separate
because they require independently verified artifact chains. Run persistence
is covered by ADR-0059/0060; generic source-node/relation/raw-SCC traversal is
implemented later by
[ADR-0067](adr/0067-source-migration-explanation-index.md). See
[ADR-0057](adr/0057-verified-level-explanation-index.md).

`package-level-result-census-v1` exactly reproduces the same ordinary or
depth-aware level boundary, reconciles all final candidate, formation, profile,
and element counts, and emits Boolean/variational selectivity plus the complete
predicate and selector censuses. It preserves the source stages' level, local,
admission, and per-selector interpretations instead of inventing a report-time
verdict. Its admitted element IDs and five embedded artifact hashes make the
compact census a stable input for later bundles without duplicating candidate
lineage. See [ADR-0058](adr/0058-integrated-level-result-census.md).

`package-run-artifact-bundle-v1` exactly reproduces a complete contiguous
level chain and combines the normalized loaded package, RunConfig, semantic
manifest, every level result, final census, and explanation index. Its sorted
artifact table fixes logical path, media type, schema version, byte length,
semantic identity, and the hash of exact canonical JSON bytes. The separate
materializer returns those bytes without performing filesystem I/O.
`package-run-artifact-store-v1` verifies serialized bundles and constructs a
unique index for every per-level run hash. A kernel configured with that store
can execute `explain({runHash,candidateId})`; an unbound kernel fails instead of
using ambient inputs. Source explanations remain separate. See
[ADR-0059](adr/0059-verified-run-artifact-bundles.md).

### 13.7 Cohorts

- partition all locally eligible candidates under the declared competition-resource rule;
- preserve every candidate; cohort construction cannot reject or rank;
- assign deterministic cohort IDs and emit membership witnesses;
- fail on overlapping or uncovered membership unless the rule's normalization defines a total partition.

### 13.8 Rank

- collect and type-check candidate-local functional scores for ranking only
  after all cohort members are known;
- preserve missing/non-finite/oracle-failed scores as selection-indeterminate records;
- emit complete deterministic rankings;
- calculate optima, epsilon-equivalent extremum sets, degeneracy, degeneracy ratio, gap, and variational selectivity;
- mark extrema as admitted and other scoreable eligible candidates as selector-excluded.

### 13.9 Sensitivity

- run every frozen positive and negative coefficient perturbation;
- compare semantic leader sets, canonical presentation leaders, and top-k membership;
- classify each selector as robust or fragile under predeclared thresholds;
- mark affected variational metrics non-interpretable when fragile without deleting raw rankings.

### 13.9.1 Admission and formations

- verify one complete partition/ranking/sensitivity chain for every selector;
- combine semantic extrema under the declared all-selector admission policy;
- preserve definite exclusion separately from selection indeterminacy;
- materialize one provenance-complete formation per definitely selected
  candidate before deriving profiles or element identity.

### 13.10 Profile

- materialize selected formation records without inventing element identity;
- extract profiles under the package's declared derivation policy;
- materialize elements only from a complete profile set;
- enforce minimum derivation depth and preserve alternate derivations;
- form profile classes.

### 13.11 Baseline

- execute configured null models;
- apply the same filter, cohort construction, ranking, sensitivity policy, evidence policy, and counting domain within every trial;
- calculate distributions for both selectivity dimensions, degeneracy, gaps where comparable, and standardized effects.

### 13.12 Report

- finalize semantic artifacts in stable order;
- hash the semantic manifest;
- write the non-semantic execution record;
- mark the run complete only after artifact integrity checks pass.

Every state transition and terminal failure MUST have a structured error code. A failed state MUST NOT be reported as a completed level.

### 13.13 Current executable level boundary

`package-level-closure-v1` implements the complete state chain currently
available from the primitive depth-0 population through the derived depth-1
population. It reproduces the package and normalized RunConfig, executes every
declared selector chain, admission, selected formations, residual profiles,
and element materialization, and emits a single content-addressed level
artifact. Before selector work it totals ranking evaluations, required
perturbation variants, and sensitivity evaluations across every selector and
rejects an over-budget level without reporting a partial result.

The primitive v1 coordinator has a deliberately narrower source scope than the
complete state machine above. Source selection is the verified primitive
population and target depth is one. Configured null models execute the complete
plan, proposal, occurrence-census, occurrence-selection, and per-model
distribution chain; disabled models retain `baseline.status = "not-run"` with
the reason `null-models-disabled`. Complete, empty, and indeterminate terminals
are distinct; profile indeterminacy cannot produce a partial element population.
Run identity binds the normalized RunConfig and exact candidate binding, and a
stored level is accepted only after exact replay. The generalized depth-level
coordinator applies the same terminal, budget, and null-baseline contract to a
verified contiguous prior-level chain. Audit/pruning coordination and
persistence remain separate state-machine boundaries. Bounded current-level
closure is the separate coordinator defined below; its round carrier still
rejects configured null models and does not change this primitive contract.

## 14. Multi-level closure and bounded fixpoint

`package-ladder-closure-v1` implements the default non-self-referential form of
`closeLadder`. It repeatedly closes consecutive levels, adds admitted elements
to a canonical cross-depth index, and uses the configured `all-below` or
`previous-only` populations for the next transition. Re-derived elements are
not duplicated in the identity count: their minimum derivation depth remains
authoritative and every population appearance is retained. Each level is
preflighted independently against the run and caller ceilings; the ladder also
records aggregate work without redefining those per-level limits. Execution
terminates at the requested depth, the first level introducing no new element,
or the first indeterminate level. The complete ladder, primitive population,
levels, index, selectivity records, terminal status, and aggregate execution
are domain-hashed and accepted only by exact replay.

Default evaluation forbids current-level references. The package loader accepts
`referencesDepth: "self"` only with the explicit
`allowCurrentDepthReferences` option, and ordinary level/candidate APIs still
refuse to execute that package without the fixpoint coordinator. The
coordinator additionally requires `boundedFixpoint.enabled: true`; its
`maxIterations` is a positive integer capped at 10,000 so emitted round arrays
remain inside the published resource contract.

`package-current-level-fixpoint-closure-v2` executes this protocol:

1. start the current level with an empty admitted set;
2. select the configured `all-below` or `previous-only` lower populations and
   union them with the previous round's current set;
3. reproduce the complete candidate census, selector, admission, formation,
   profile, population, and configured null-model chain for that source;
4. add newly admitted canonical elements monotonically, excluding identities
   already present in the selected lower source;
5. stop when a round adds no elements or `maxIterations` is reached;
6. report iteration count and convergence status.

Each round binds its source selection, before/after current-set hashes,
complete embedded artifacts, its own baseline, added identities, work totals,
interpretation, and round hash. Null trials never pool across round carriers;
an indeterminate baseline makes that round indeterminate. The level exposes the
terminal round's baseline and null artifacts. A converged level publishes the monotone union with each unique
derivation attributed to its first observed round. If a round becomes
indeterminate or the iteration limit is reached after additions, the level is
`indeterminate`: tentative elements and derivations remain auditable, the final
population is empty, and selectivity is not interpreted. Bounded fixpoint
mode, iteration limit, lower-population references, and round policy are part
of run/result identity. Every supplied lower fixpoint level is deterministically
replayed before a deeper direct closure is accepted.

`package-fixpoint-ladder-closure-v1` applies those level coordinators in
ascending depth order, indexes minimum depth and every final appearance, and
stops at the requested depth, an indeterminate level, or a level introducing
no globally new identity. The generic ladder and configured-kernel adapters
dispatch to this contract whenever bounded mode is enabled. Stored current-
level and ladder artifacts are accepted only by exact reproduction. The
round-local null boundary is frozen by
[ADR-0080](adr/0080-current-level-round-null-model-execution.md).

Profile-collapse and level-boundary APIs currently reject bounded-fixpoint
runs explicitly. Comparing only a terminal round would discard cumulative
cross-round observations; a future version must define that projection before
those diagnostics can truthfully consume fixpoint ladders.

## 15. Null models and statistical output

Every null model MUST declare the ontology gate and carrier population it randomizes. A mode-level null population, CRT-node population, and ensemble population are different universes and MUST NOT be pooled.

Node-internal scientific quantities remain fixed unless changing them is the stated null hypothesis. Derived scores or evidence invalidated by randomization MUST be recomputed through the declared external method or marked indeterminate; they MUST NOT be copied blindly. Every null trial reruns both local predicates and cohort selectors on its own cohort.

### 15.1 Role shuffle

Preserve the candidate's skeleton, edge directions, declared structural attributes, and multiset of edge roles; uniformly permute roles across eligible edge instances using the seeded random source.

### 15.2 Degree-preserving rewire

Randomize endpoints while preserving the configured directed, role-wise degree sequence. Reject invalid swaps that violate graph policy. Report attempted, accepted, and rejected swaps and a mixing diagnostic.

### 15.3 Uniform candidate model

Sample uniformly from the explicitly declared finite canonical candidate universe. If exact uniform sampling is not available, the model MUST be named and reported as approximate, disclose the proposal and rejection scheme, and provide effective sample information. It MUST NOT be labelled `uniform` without this guarantee.

### 15.4 Statistics

For any comparable scalar metric `x` from null trials and its observed value `x_obs`:

```text
mean_null = mean(x_i)
sd_null   = sampleStandardDeviation(x_i)
z         = (x_obs - mean_null) / sd_null
```

```ts
interface BaselineResult {
  status: "complete" | "not-run" | "indeterminate";
  runs: number;
  metrics: {
    booleanSelectivity: DistributionSummary;
    variationalSelectivity: Record<SelectorId, DistributionSummary>;
    selectionRetention: DistributionSummary;
    overallRetention: DistributionSummary;
    indeterminateRatio: DistributionSummary;
  };
  samplesArtifact: string | null;
  notes: string[];
}

interface DistributionSummary {
  expectedSamples: number;
  availableSamples: number;
  mean: number | null;
  sd: number | null;
  z: number | null;
  constantRelation: "equal" | "different" | "observed-unavailable" | null;
  status: "complete" | "fragile" | "indeterminate";
  notes: string[];
  sampleTrialIds: string[];
  distributionHash: string;
}

interface NullModelBaseline {
  status: "complete" | "indeterminate";
  models: Record<NullModelId, BaselineResult>;
  observed: object;
  trialSelectionsHash: string;
  baselineHash: string;
}

interface NullModelDisabled {
  status: "not-run";
  reasons: ["null-models-disabled"];
}
```

For each metric, when `sd_null === 0`, `z` is `null` and the result explains whether the observed value equals the constant null value. The sign of `z` MUST be interpreted literally: with the defined formula, a lower observed ratio produces a negative z-score.

Null-model random streams MUST be derived independently from the run seed and model/trial identifiers so that adding workers or reordering models does not change results.

The executable `package-null-model-plan-v1` boundary freezes this context
before sampling. It consumes a reproduced complete primitive or depth-aware
candidate census, records its full canonical carrier, binds either the run's
ontology coordinate or the target derivation depth, freezes the three proposal
contracts and all-stage recomputation requirements, and derives one domain-
separated stream and trial identity per normalized model/index pair. An enabled
plan reports `planned`, never `complete`; the plan alone claims no execution.
Proposal transformation, trial evaluation, and baseline interpretation remain
separate downstream artifacts, so possession of a plan is never evidence that
those stages ran.

`package-null-model-proposals-v1` executes the transformation half of that
contract. Each trial has carrier-size occurrence semantics. Role shuffles use
candidate-wise Fisher-Yates; rewiring uses ten same-role directed target-swap
attempts per edge with every invalid or outside-carrier proposal rejected and
reported; uniform trials draw carrier indices independently with replacement.
All draws use domain-separated SHA-256 counter rejection sampling, every output
is canonicalized under the bound graph policy, duplicate occurrences are
retained, and exact primitive/depth-aware replay is required. Proposal
completion still does not satisfy the baseline gate until every occurrence is
refiltered and trial-local cohorts, functionals, selectors, evidence,
distributions, and interpretation have been rebuilt.

`package-null-model-trial-censuses-v1` implements the next stage without
collapsing proposal multiplicity. Every occurrence is assigned an identity over
its trial, ordinal, source, and proposal and is passed through the reproduced
primitive or depth-aware package filter session. Per-trial Boolean selectivity,
indeterminate ratios, complete predicate censuses, and filter artifacts are
hashed and exactly replayed. This completes local predicate reruns only;
occurrence-aware cohort keys, functional values, selector extrema, external
evidence invalidation, distributions, and baseline interpretation remain
mandatory downstream stages.

`package-null-model-trial-selections-v1` then changes the selection-domain
identity from unique canonical candidate IDs to unique occurrence IDs while
still evaluating every key and functional on the proposed canonical graph.
It reconstructs every declared cohort, reruns every selector functional,
recomputes dense ranks and epsilon extrema, repeats the full coefficient-
sensitivity sweep, and readmits the occurrence population independently in
each primitive or depth-aware trial. Replacement duplicates therefore remain
separate cohort members and denominator contributions. Node-internal values
stay fixed unless randomized by the model; graph-derived values are recomputed
or remain indeterminate. The artifact retains raw rankings together with
metric-specific fragile/indeterminate interpretation and aggregate execution
ceilings. Trial selection completion itself does not claim metric distributions,
standardized effects, or an integrated research baseline.

`package-null-model-baseline-v1` implements that final statistical boundary.
It exactly verifies the observed census/admission and the entire trial chain,
keeps models separate, orders samples by trial identity, and computes fixed-
order compensated means, sample standard deviations, and standardized effects
for Boolean selectivity, every selector's variational selectivity, selection
retention, overall retention, and indeterminate ratio. Missing samples never
shrink a denominator. Fragile metrics retain their raw summaries but make the
affected model indeterminate. Fewer than two samples and zero variance retain
explicit notes and `z: null`; zero variance additionally records whether the
observed value equals the null constant.

Primitive and generalized-depth level coordinators execute and embed the
complete plan/proposal/census/selection chain plus this baseline whenever null
models are configured. Disabled runs retain the compact `not-run` state.
Current-level fixpoint closure still rejects configured null models because its
round carrier requires a separately frozen null hypothesis.

## 16. Diagnostics and explanations

### 16.1 Candidate verdict

A candidate is locally eligible only when all required top-level predicates pass. A definite failure produces `predicate-rejected`; if none fail but a required predicate is indeterminate, the candidate produces `filterIndeterminate` unless the predicate is explicitly advisory. An eligible candidate is finally admitted only when it belongs to every applicable semantic extremum set. A scoreable non-extremum is `selector-excluded`; an invalid score or unresolved oracle dependency is `selectionIndeterminate`.

### 16.2 Inert predicates

Every report MUST list predicates that reject no evaluated candidate. Inertness is evidence about a predicate in the declared candidate population; it is not proof that the predicate is universally redundant.

### 16.3 Dominating predicates

Every report MUST list predicates whose failure rate meets the configured dominance threshold, default `90%`. It SHOULD also report exclusive rejection share so a highly correlated predicate is not mistaken for the sole source of selectivity.

### 16.4 Degenerate transitions

The rule package MAY define information thresholds for transitions. A high Boolean selectivity means the hard filter excludes little. A low variational selectivity means the functional minimum is highly degenerate. These are independent observations and neither is inferred from `overallRetention` alone. The kernel MUST report the configured thresholds, cohort distribution, fragility status, and reason; it MUST NOT hard-code one universal scientific cutoff.

### 16.5 Source-migration and condensation diagnostics

Every catalogue migration emits one immutable disposition for every raw nontrivial SCC and reconciles all source nodes and edges:

```ts
interface SccDispositionRecord {
  rawComponentId: string;
  members: SourceRecordId[];
  edgeIds: SourceRelationId[];
  primaryResolution:
    | "distributed-structure-merge"
    | "constitutive-condensation"
    | "generative-condensation"
    | "mixed-condensation"
    | "nonformation-layer-separation"
    | "post-unblinding-reclassification";
  resultingCluster?: ElementId;
  rationaleArtifact: ArtifactRef;
}

interface MigrationRiskPolicy {
  maximumClassificationDisagreementRatio: number;
  maximumDescriptiveResolutionShare: number;
  maximumPostUnblindingReclassificationShare: number;
  acceptedBlindness: MigrationBlindnessStatus[];
}

interface MigrationMetrics {
  rawNodes: number;
  rawEdges: number;
  rawNontrivialSccs: number;
  rawSccSizeHistogram: Record<string, number>;
  largestRawScc: number;
  twoNodeSccs: number;
  classifiedEdges: Record<SourceRelationKind, number>;
  blindnessStatus: MigrationBlindnessStatus;
  classificationDisagreementRatio: number;
  postUnblindingChanges: number;
  dispositions: SccDispositionRecord[];
  nonformationLayerResolutionShare: number;
  descriptiveResolutionShare: number;
  postUnblindingReclassificationShare: number;
  condensedClusters: number;
  constitutiveClusters: number;
  constitutiveClusterSizeHistogram: Record<string, number>;
  crossCatalogueLevelClusters: number;
  clusteredSourceRecordRatio: number;
  riskPolicyHash: `sha256:${string}`;
  fittingRisk: "not-flagged" | "elevated";
  fittingRiskReasons: string[];
}
```

`descriptiveResolutionShare` is the fraction of raw nontrivial SCCs whose cyclicity disappears from the formation-support projection specifically because one or more cycle-closing edges were classified `descriptive` under the frozen policy. The corresponding broader nonformation share also includes evidential and regulatory-feedback separation. Post-unblinding changes are never folded into the frozen annotation result: their original type, new type, reason, approver, and changed hashes remain visible. Thresholds that flag excessive descriptive resolution, disagreement, or post-unblinding change MUST be frozen before annotation. A `historically-exposed` run always carries a fitting-risk warning regardless of these numeric thresholds.

Two-node SCC count and the complete size histogram are diagnostics, not automatic rules. A reciprocal dyad may be mechanical duplicate entry, but it may also be substantive; a large component may encode joint constitution, but size alone cannot prove that interpretation.

The executable generic reconciliation subset is recorded in
[ADR-0063](adr/0063-source-migration-reconciliation-diagnostics.md). It derives
the raw SCC histogram, all six classified edge counts, available frozen risk
signals, cluster/member shares, relation-destination counts, and exact
node/edge/DAG conservation only after full replay of the ADR-0061 chain. It
requires the immutable ADR-0064 amendment snapshot and reports its frozen
post-unblinding risk signal. ADR-0065 applies a non-empty log through a separate
effective projection, recomputes SCCs, and requires newly bound reviewed
resolution and condensation artifacts. ADR-0066 then constructs the complete
`MigrationMetrics` artifact only from an exactly replayed reconciliation,
exactly one reviewed disposition per raw SCC, and a total source-catalogue
level mapping. It cannot substitute for missing current-catalogue review or
the separately frozen concentration analysis.

The generic concentration calculation is implemented under
[ADR-0068](adr/0068-source-cluster-concentration.md). It requires a definition
frozen without cluster-location exposure plus a complete one-depth-per-source-
vertex partition, derives every cluster/member count, and returns
`indeterminate` for a zero or missing enrichment denominator.

The migration report also tests whether joint-constitution clusters concentrate at independently defined bottlenecks:

```ts
interface ClusterConcentrationPoint {
  depth: number;
  depthBasis: BasisHash;
  stratificationVertices: number;
  constitutiveClusters: number;
  constitutiveClusterDensity: number | null;
  constitutiveMemberShare: number | null;
  bottleneck: boolean;
}

interface ClusterConcentrationResult {
  points: ClusterConcentrationPoint[];
  bottleneckDefinitionHash: `sha256:${string}`;
  enrichmentRatio: number | null;
  nullModel?: DistributionSummary;
  interpretation: "concentrated" | "uniform" | "depleted" | "indeterminate";
  notes: string[];
}
```

The bottleneck definition uses frozen Boolean/variational selectivity criteria and MUST be fixed without access to cluster locations. `constitutiveClusterDensity` is the number of constitutive clusters divided by all stratification vertices at that depth. `constitutiveMemberShare` is the number of source records inside constitutive clusters divided by all source records mapped to that depth. `enrichmentRatio` compares the pooled member share at bottleneck depths with the pooled share elsewhere; zero denominators produce `null`. A seeded permutation baseline MAY randomize cluster labels across depth-compatible vertices. Concentration supports the joint-arising-at-bottlenecks hypothesis; uniformity or depletion weakens it. None of these outcomes retroactively changes edge types or cluster dispositions.

## 17. Reproducibility, manifests, and frozen predictions

### 17.1 Semantic manifest

The semantic manifest contains only deterministic values:

```ts
interface SemanticRunManifest {
  schemaVersion: string;
  kernelVersion: string;
  runHash: string;
  depthBasisHash: BasisHash;
  sourceMigrationHash?: `sha256:${string}`;
  primitivesHash: string;
  rulesHash: string;
  functionalsHash: string;
  cohortRulesHash: string;
  selectorsHash: string;
  sensitivityPolicyHash: string;
  claimsHash: string;
  evidenceHash: string;
  oraclePolicyHash: string;
  configHash: string;
  numericalPolicyHash: string;
  seed: string;
  inputArtifacts: ArtifactRef[];
}
```

### 17.2 Execution record

Operational metadata is separate so semantic outputs can be byte-reproducible:

```ts
interface ExecutionRecord {
  schemaVersion: "1";
  recorder: "package-run-execution-record-v1";
  executionId: `sha256:${string}`;
  runHash: string;
  startedAt: string;
  completedAt: string | null;
  engineBuild: string;
  platform?: string;
  resourceUsage: BudgetUsage;
  terminalStatus: "complete" | "failed" | "cancelled";
}
```

Timestamps MUST NOT contribute to the semantic run hash. Two identical runs MUST produce byte-identical semantic artifacts; their execution records may differ.
`executionId` is an operational raw-SHA-256 content address over the canonical
record basis without the derived ID; it also does not contribute to semantic
identity. A `complete` record requires `completedAt`. Failed or cancelled
records may retain `null` when a terminal instant was not available.

### 17.3 Frozen prediction

```ts
interface FrozenPrediction {
  predictionId: string;
  runHash: string;
  createdAt: string;
  hypothesis: string;
  expected: JsonValue;
  author: string;
  signature?: string;
}
```

The prediction store MUST be append-only at the logical level. A post-run edit creates a new prediction record. Reports compare results only to records whose `runHash` matches exactly and whose creation precedes the execution start.

## 18. Artifact bundle

The recommended layout is:

```text
runs/<run-hash>/
  artifact-bundle.json
  semantic-manifest.json
  normalized-input/
    source-migration.json
    primitives.json
    predicates.json
    functionals.json
    cohort-rules.json
    selectors.json
    claims.json
    evidence.json
    oracle-policy.json
    run-config.json
  source-migration/
    classification-policy.json
    migration-risk-policy.json
    classification-annotations.ndjson
    classification-adjudication.ndjson
    classified-relations.ndjson
    node-resolutions.json
    condensation.json
    member-projections.ndjson
    typed-relation-layers.json
    migration-metrics.json
    cluster-concentration.json
  levels/
    000/result.json
    000/admitted.ndjson
    000/explanations.ndjson
    000/cohorts.json
    000/rankings.json
    000/sensitivity.json
    000/profile-classes.json
    000/carrier-promotions.json
    000/census.json
    000/baselines/
  audits/
    monotonicity.json
    profile-collapse.json
    level-boundaries.json
  oracle/
    requests.ndjson
    responses.ndjson
  execution/<execution-id>.json
```

Large candidate and explanation collections SHOULD use deterministic NDJSON
ordering by canonical ID. Each artifact reference contains media type, schema
version, byte length, and SHA-256 hash. The executable v1 kernel bundle uses
canonical JSON for complete indexed artifacts; an application MAY project a
large verified index to deterministic NDJSON in a later storage profile, but
must retain a separately verified byte reference rather than relabeling the
JSON artifact.

The local filesystem profile uses the portable directory spelling
`sha256-<digest>` for the semantic `sha256:<digest>` run hash. The complete
canonical `artifact-bundle.json` envelope and every referenced byte are
published atomically and reconstructed by `@onto2d/run-store` under
[ADR-0060](adr/0060-verified-run-directory-persistence.md); the writer receipt
is operational metadata and never enters semantic identity.
Versioned execution records are appended separately under `execution/` with
atomic no-overwrite publication and complete run binding under
[ADR-0062](adr/0062-append-only-operational-execution-records.md). Their
timestamps, platform labels, resource use, identities, and receipts never
change the semantic envelope or bundle hash.

## 19. Public API

The API keeps state and artifacts explicit. The executable level adapter takes
a complete RunConfig and integrates its supported null-model plans.
Candidate-level
explanation indexing/querying is available through explicit verified indexes,
and ambient run lookup is available only when `createKernel` receives a
verified artifact-store snapshot. Source-migration explanation lookup remains
on a catalogue-adapter session that replays the complete migration chain; the
kernel does not import the adapter or infer external bytes from references:

```ts
const authoringKernel = createKernel({ version: "0.1.0" });

const loaded = await authoringKernel.loadPackage({
  sourceArtifacts,
  sourceMigration,
  claims,
  evidence,
  primitives,
  predicates,
  functionals,
  cohortRules,
  selectors,
  partialOraclePolicy,
  ontologyAxes,
  perturbations,
  profileDefinition,
});

const level = authoringKernel.closeLevel({
  package: loaded,
  config: runConfig,
});

const bundle = authoringKernel.createPackageRunArtifactBundle(
  loaded,
  runConfig,
  [level]
);
const artifactStore = authoringKernel.createPackageRunArtifactStore([bundle]);
const kernel = createKernel({ version: "0.1.0", artifactStore });

const why = await kernel.explain({
  runHash: level.run.runHash,
  candidateId,
});

const sourceSession = createSourceMigrationExplanationSession(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensation,
  reconciliation,
  metrics,
  explanationIndex,
);

const sourceWhy = sourceSession.explain({
  kind: "source-relation",
  id: sourceRelationId,
});

const componentWhy = sourceSession.explain({
  kind: "raw-component",
  id: rawComponentId,
});

const ladder = await kernel.closeLadder({
  package: loaded,
  from: primitives,
  depths: 3,
  config,
});

const collapse = await kernel.testProfileCollapse({
  package: loaded,
  from: primitives,
  config: smallConformanceConfig,
});

const boundaries = await kernel.detectLevelBoundaries({
  package: loaded,
  from: primitives,
  depths: 6,
  config: smallConformanceConfig,
});
```

For compatibility, separate `loadPrimitives` and `loadPredicates` facades MAY delegate to `loadPackage`. Package loading, not `closeLevel`, is where stratification and static predicate checks occur.

No UI is part of this API. The portable boundary is JSON-compatible input and output; streaming APIs MAY additionally use async iterables.

## 20. Error model

Every error has `code`, `stage`, `message`, and structured `details`. Required error families include:

- `PACKAGE_*`: parse, schema, reference, duplicate ID, or normalization errors;
- `SOURCE_CLASSIFICATION_*`: missing frozen policy, blindness violation, disagreement, or incomplete edge annotation;
- `SOURCE_RESOLUTION_*`: invalid merge/cluster adjudication or unreconciled source member;
- `CONDENSATION_*`: invalid SCC partition, non-DAG quotient, duplicate/lost relation, or depth inheritance failure;
- `MIGRATION_METRIC_*`: invalid denominator, disposition mismatch, or post-unblinding change without approval;
- `STRATIFICATION_*`: forbidden current-level references;
- `DEPTH_BASIS_*`: absent, invalid, or cross-basis depth comparison;
- `PREDICATE_TYPE_*`: invalid expression operands or selectors;
- `EXPRESSION_*`: invalid value AST, selector, symbol, resource bound, or
  dimensional inference;
- `FUNCTIONAL_*`: invalid coefficients, dimensions, result contract, or forbidden generator access;
- `COHORT_*`: invalid, overlapping, uncovered, or non-deterministic partition;
- `SELECTOR_*`: invalid objective, functional/cohort reference, epsilon, ranking, or tie handling;
- `SENSITIVITY_*`: invalid perturbation policy, budget, threshold, or report;
- `QUANTITY_*`: malformed unit, tolerance, provenance, or incompatible arithmetic;
- `DECIMAL_*`: invalid decimal grammar, policy, limit, arithmetic, or binary64 conversion;
- `ORACLE_*`: request mismatch, solver-version mismatch, invalid response, convergence, or partial-policy failure;
- `EVIDENCE_*`: missing, malformed, unhashed, or method-incompatible evidence;
- `ONTOLOGY_COORDINATE_*`: implicit or invalid level/phase/depth mapping;
- `PROMOTION_*`: invalid cross-domain carrier promotion;
- `MONOTONICITY_*`: static contradiction or audit counterexample;
- `CANONICALIZATION_*`: unsupported value or invariant failure;
- `GENERATION_BUDGET_*`: hard budget exhaustion;
- `NUMERIC_*`: invalid numbers, tolerance, or precision policy;
- `FIXPOINT_*`: disabled self-reference or iteration exhaustion;
- `BASELINE_*`: invalid randomization, non-mixing, or undefined statistic;
- `ARTIFACT_*`: write, hash, or integrity failure.

The API MUST distinguish a failed operation from a completed but scientifically non-interpretable result.

## 21. Security and resource isolation

Although the initial project is local, rule packages are data and must be treated as untrusted:

- no executable expressions;
- explicit size and nesting limits during parsing;
- bounded recursion and substructure enumeration;
- cancellation checks between generator and evaluator units;
- no filesystem or network access from predicates;
- no execution of code embedded in evidence or solver artifacts;
- deterministic random source supplied by the coordinator;
- bounded artifact paths controlled by the caller;
- rejection of prototype-sensitive keys if plain JavaScript objects are used.

## 22. Performance envelope

Default research budgets are:

| Parameter | Default | Rationale |
|---|---:|---|
| `maxNodes` | 4 | Normal exhaustive operating point |
| `maxEdges` | `n + 2` | Prevents unbounded decoration |
| role alphabet | at most 6 | Principal combinatorial multiplier |
| `maxCandidates` | 1,000,000 | Hard truncation boundary |
| `perturbationSamples` | 200 | Default sampled stability evidence |
| `nullModelRuns` | 500 | Default baseline distribution size |

Five nodes are reasonable only with a narrow role alphabet and effective pruning. Six nodes are a research limit for selected cases. Budgets are semantic run inputs and MUST be reported even when not exhausted.

Two performance targets are retained for `n = 4`: 60 seconds is the required acceptance ceiling and 10 seconds is an optimization target. The benchmark environment MUST be recorded by the implementation plan.

## 23. Conformance and acceptance

### 23.1 Deterministic foundation

- at least 30 independently permuted isomorphic graph pairs yield byte-identical canonical forms;
- known non-isomorphic fixtures do not collide;
- duplicate candidates do not pass canonical deduplication;
- two identical runs produce byte-identical semantic artifacts;
- changing any hashed semantic input changes the appropriate content hash;
- depth comparison across unequal `depthBasis` hashes is rejected.

### 23.2 Generator

- connected skeleton counts match the reference table;
- unique candidate counts match hand-enumerated small fixtures;
- a deliberately monotone rejection prunes expected branches without changing final results;
- hard budget exhaustion produces a non-interpretable result.

### 23.3 Predicates

- every built-in and combinator has at least three fixed conformance cases;
- witnesses identify actual nodes, edges, paths, cycles, removals, or perturbations;
- a deliberately false monotonicity assertion fails the audit;
- every three-valued truth-table row is fixed by tests;
- incompatible statically known quantity units fail package loading;
- oracle failure produces indeterminate rather than rejection.

### 23.4 Cohorts, selectors, sensitivity, and evidence

- all four core cohort rules plus explicit global competition partition independently of candidate order;
- finite `argmin` and `argmax` fixtures produce the same complete ranking independently of candidate order;
- all values within declared epsilon are retained as semantic extrema;
- canonical ID resolves serialization order but never reduces the semantic extremum set;
- an all-equal cohort returns every member, `degeneracyRatio = 1`, `variationalSelectivity = 0`, and no unique semantic winner;
- a singleton cohort reports absence of measured competition rather than maximal decisiveness;
- gap is zero for a tied second score and `null` when no second score exists;
- no functional is callable from generator or pruning code paths;
- frozen `±10%` and `±25%` coefficient sweeps reproduce robust and fragile fixtures;
- missing or unit-incompatible scores become indeterminate rather than receiving an implicit default;
- failed and disallowed-partial oracle responses become indeterminate, while approved widened tolerance is fully witnessed;
- changing a source PDF, solver input, method version, result artifact, or score changes the appropriate evidence/run hash;
- a paper assumption is never reported as computationally or externally verified without a new evidence record.

### 23.5 Profiles and ladders

- slots and invariant vectors normalize deterministically;
- the Level 0 bounded fixture passes profile collapse or emits a concrete counterexample;
- `detectLevelBoundaries` emits transition/error/declared-level/match rows without mutating declared labels;
- a three-transition ladder terminates and reproduces exact semantic outputs;
- multiple derivations retain minimum depth under one basis.

### 23.6 Null models

- complete carrier disclosure, ontology gates, normalized model-order
  invariance, independent trial stream identities, seed sensitivity, hard
  limits, and exact plan replay pass for primitive and depth-aware censuses;
- carrier-size role-shuffle, degree-rewire, and exact-uniform proposal
  populations preserve their declared invariants, remain inside the complete
  carrier, reconcile mixing/draw counts, and reproduce byte-for-byte;
- every proposal occurrence, including repeated canonical uniform draws, is
  independently refiltered and retained in exact per-trial Boolean and
  predicate censuses for primitive and depth-aware carriers;
- an intentionally non-selective rule set produces a null comparison consistent with no effect;
- zero-variance null distributions are handled without infinity or `NaN`;
- seeded trials reproduce independently of worker count.

### 23.7 Source migration and condensation

- every raw source node and relation is reconciled exactly once; no relation disappears from semantic or explanation artifacts;
- classifiers cannot access SCC membership or acyclicity consequences before the annotation artifact is frozen;
- every human classifier declares prior SCC exposure; exposed work is labelled honestly and cannot pass the prospective-blind acceptance claim;
- a fixture with the same frozen classification annotations produces the same typed projections and SCC partition independently of input order;
- permuting member and internal-edge input order leaves cluster canonical IDs unchanged;
- every nontrivial formation SCC becomes exactly one cluster vertex with `internalOrder = "undefined"`;
- the condensation quotient is a DAG, and every member projection inherits exactly the cluster's depth and basis hash;
- evidential, descriptive, regulatory-feedback, and absorbed internal relations remain queryable in explanations;
- deliberately merging unrelated cards fails node-resolution criteria even if it would remove a cycle;
- a post-unblinding type change remains visible and changes migration, depth-basis, and run hashes;
- all three audited catalogue SCCs receive one explicit primary disposition and size-preserving provenance;
- migration metrics reconcile counts and report descriptive/nonformation resolution shares;
- a historically exposed fixture and every threshold-exceeding fixture receive `fittingRisk = "elevated"`;
- cluster-concentration output is invariant to source input order and cannot alter the frozen migration.

## 24. Required research cases

### 24.1 Case 1: Level 0 oscillator closure

Case 1 is the computational decomposition of [the foundational paper](../scr/topology-of-arising.pdf). Its source artifact hash is part of every case package.

The paper's `Level 0` and phases A–D are domain coordinates. They span several kernel derivation depths.

#### Gate A: oscillatory eligibility and variational selection

Mode candidates carry typed `A`, `k`, `omega`, and `m2` quantities plus evidence for the chosen metric/operator package, dispersion residual, stationarity, and bounded parameter domain. The finite eligible population is partitioned by a frozen contested-resource rule and ranked using the frozen action/admissibility functional. The result is the complete ranked cohort with degeneracy and coefficient sensitivity, never an unexplained single mode.

The frozen Level-0 conformance variant includes a deliberately degenerate cohort. It MUST return every epsilon-equivalent extremum with explicit `degeneracy`/`degeneracyRatio`, not manufacture one winner.

The core kernel does not solve the Klein–Gordon-type equation or calculate `deltaS`. Until a deterministic analytical or numerical adapter supplies these artifacts, Gate A remains structurally specified but scientifically incomplete.

#### Gate B: coherent resonant triad

The intended condition is refined to:

```text
count(modes) = 3
AND balance(k, modes)
AND balance(omega, modes)
AND cycleExists(projection = undirected-simple, minLength = 3)
AND compare(relationalConstraintRank, gte, requiredRank)
AND irreducibleRemoval(triadicClosure, removal = node)
```

With `maxNodes = 4`, the declared prediction is that the engine admits the intended triad and rejects a balanced dyad. A reciprocal directed dyad MUST NOT satisfy the simple length-three loop condition.

If the dyad's census rejection needs one attribution, the case SHOULD expose a named composite predicate such as `irreducible-triadic-closure` containing whole-closure, loop, rank, and removal checks. A bare removal combinator cannot by itself distinguish every balanced dyad.

#### Gate C: CRT-node objecthood

A coherent triad becomes an object-like CRT-node only if all of the following pass:

- bounded support;
- nontrivial configurational density `Gamma` under a declared support/measure and threshold;
- perturbative persistence under a frozen perturbation and identity policy;
- any claimed Phase C nonlinear coherence has content-addressed solver or analytical evidence.

The result MUST distinguish a structurally closed triad from an object-qualified node.

The source catalogue labels Configurational Density (`0.7`) and CRT-Node (`0.8`) as Phase C, while the paper completes their derivation within Phase B. Until an ADR resolves this, the case MUST retain both `cataloguePhase: C` and the paper-derived coordinate with an explicit mismatch record.

#### Level-0 catalogue SCC hypothesis

The catalogue component `{0.8 CRT-Node, 0.21 Closure-Preserving Deformation, 0.22 Directional Admissibility Gradient}` is a pre-registered candidate for either one distributed closure-bearing structure or a constitutive cluster. Its three-way mutual support is structurally suggestive of the paper's irreducible-loop argument, but it is not automatically the same triad: the paper's loop is formed by resonant modes, whereas these catalogue cards name a node and properties of its persistence/directionality.

The migration MUST apply the prospective-blind, deterministic-precommitted, or honestly exposed relation policy and general node-resolution criteria before testing this analogy. The report accepts distributed merge, constitutive condensation, unresolved generative condensation, mixed unresolved status, or dissolution into nonformation layers as legitimate outcomes. It MUST NOT select the outcome that most closely resembles the paper after SCC membership is known.

#### Gate D: collective Level-0 completion

CRT-nodes are composed into candidate ensembles. A completed Level-0 ensemble-quantum requires:

- carrier closure: constituents are admitted CRT-nodes;
- bounded, essential inter-node coupling;
- collective stability or another declared novel property not reducible to isolated node persistence;
- non-additivity evidence for the coupled action or an explicit structural surrogate;
- deterministic cohort selection under the declared Phase D admissibility functional;
- an effective compositional profile suitable for explicit promotion to the Level-1 carrier domain.

An uncoupled set of valid nodes is a negative fixture and MUST be rejected as mere multiplicity.

If the result cannot be reproduced, the outcome is not to be patched away: it indicates either an incomplete theoretical argument, an incorrect encoding, or a kernel defect, to be distinguished through conformance evidence.

Exact scientific inputs still missing from the supplied paper—including contested-resource cohort rule `kappa`, support measure, tolerances and epsilon, perturbation scale, partial-oracle policy, solver protocol, `V_ab`, the `chi_i` metrics, and the source/policy for `alpha_i` coefficients—MUST be supplied by separately reviewed and frozen case data. They MUST NOT be hidden kernel defaults.

### 24.2 Case 2: thirteen directed three-node motifs

Encode the thirteen connected directed three-node motif classes and compare the kernel's ranking with a frozen, cited external dataset selected before the run. The fixture MUST preserve the external study's graph conventions, network domains, preprocessing, null model, and ranking measure.

Agreement is external support; disagreement is an equally valid falsifying result. The kernel architecture does not preselect or silently aggregate incompatible published datasets.

## 25. Success criteria

The kernel succeeds only when all three dimensions are satisfied:

1. **Engineering:** an `n = 4`, four-role level run is byte-reproducible, completes within 60 seconds on the declared reference environment, and passes source-condensation, predicate, selector, evidence, and canonicalization conformance.
2. **Research:** a two-dimensional Boolean/variational selectivity profile across at least three explicitly labelled paper gates is obtained, together with per-cohort degeneracy, gaps, indeterminate ratios, robust/fragile sensitivity verdicts, and constitutive-cluster density by transition. Uniform selectivity or uniformly distributed clusters are reported as evidence that weakens the corresponding hypothesis rather than treated as success by definition.
3. **External:** the thirteen-motif case is compared against a frozen published reference and the agreement or disagreement is recorded without post-hoc rule changes under the same run hash.

## 26. Architectural invariants summary

An implementation is conformant only if all of the following remain true:

- isomorphic candidates have byte-identical canonical forms;
- semantic results do not depend on insertion order, worker order, locale, or wall clock;
- current-level references are impossible unless bounded fixpoint mode is explicit;
- only audited, pruning-eligible monotone violations prune branches;
- all top-level predicates are evaluated for every complete filtered candidate;
- predicates and functionals are type- and capability-separated;
- no functional or rank result prunes generation;
- local predicate eligibility, cohort construction, ranking, and sensitivity remain distinct and explainable;
- truncation is visible and invalidates exact selectivity interpretation;
- derivation depth always carries its basis hash;
- source-edge classification rules are frozen before SCC consequences are revealed;
- no source node or relation is deleted to manufacture acyclicity;
- every source SCC has an explicit disposition and complete provenance;
- each condensed cluster is one depth vertex whose members share depth and have no asserted internal precedence;
- the inter-cluster generative quotient is a DAG;
- non-generative and internal source relations remain available to the explanation graph;
- derivation depth, ontology level, ontology phase, source-catalogue coordinates, and predicate phase are never conflated;
- profiles are content-addressed under an explicit precision policy;
- profile interchangeability remains independently testable;
- scientific quantities have units, tolerances, semantic definitions, and evidence provenance;
- indeterminate candidates are counted separately and never admitted silently;
- every score-equivalent extremum remains in semantic output with full degeneracy reporting;
- coefficient fragility invalidates interpretation rather than being hidden;
- failed oracle work is indeterminate, and partial work follows a frozen policy;
- external scientific code is never executed inside the kernel;
- carrier promotion is explicit and never mutates its source element;
- null models use recorded deterministic random streams;
- every null trial reruns its own predicates and cohort selectors;
- explanations are bound to candidate, rules, and source-migration hashes;
- timestamps do not contaminate semantic identity;
- the kernel remains independent of the Onto2D shell and source-catalogue model.
