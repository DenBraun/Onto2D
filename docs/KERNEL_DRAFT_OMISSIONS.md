# Kernel Draft Omissions, Corrections, and Additions

Status: companion to [KERNEL_ARCHITECTURE.md](./KERNEL_ARCHITECTURE.md) and [FOUNDATIONAL_PAPER_ANALYSIS.md](./FOUNDATIONAL_PAPER_ANALYSIS.md).

Purpose: account explicitly for information from the 403-line Russian `Onto2D_Kernel_Spec.md` draft, SHA-256 `ec442fb48c1fa7e24f122aa8a73c5c5a64c60b53ef911e18e364b4697cfd8fd1`, and its 345-line addendum `Onto2D_Kernel_Addendum_Selection_and_Quantities.md`, SHA-256 `c563a560ddfce2352f211b289e8dd90463ef9ef8c736f65624dfe0563f0df4a1`, that was not placed verbatim into the normative architecture, and document every material normalization that could otherwise look like a silent change.

This is not a list of forgotten requirements. All implementable core requirements from the draft are represented either in the architecture or in [KERNEL_REFACTOR_PLAN.md](./KERNEL_REFACTOR_PLAN.md). Items below were separated because they are project-management material, rhetorical commentary, an external claim needing its own source protocol, an ambiguity, or a technical contradiction.

## 1. Disposition labels

| Label | Meaning |
|---|---|
| Retained | Translated into English and preserved normatively in the architecture |
| Relocated | Preserved in the refactor plan rather than the architecture |
| Clarified | Source intent preserved, with missing semantics made explicit |
| Corrected | Source statement would cause an incorrect or internally inconsistent implementation |
| Deferred | Requires a research package, external source, or product-layer decision |
| Excluded | Deliberately not part of the normative architecture |
| Added | New implementation detail introduced to make the architecture complete |

## 2. Material corrections and reconciliations

### 2.1 Source closure set: `Sigma_d` versus `Sigma_<=d`

**Draft:** the formula names `Gen(Sigma_d, B)`, while the stratification rule allows predicates at `d + 1` to reference `Sigma_<=d`.

**Disposition:** Clarified.

**Architecture:** the default generation source is the closure available below the target depth, `Sigma_<=d`. A package can select `previous-only` to generate from exactly `Sigma_d`. The selected policy is hashed.

**Reason:** without this decision, two conforming implementations could generate different universes from the same ladder.

### 2.2 Selectivity denominator and canonicalization

**Draft:** `selectivity = |Sigma_(d+1)| / |Gen(Sigma_d, B)|`, but the pipeline later canonicalizes and deduplicates generated candidates. `LevelResult.generated` does not say whether it counts raw decorations, canonical candidates, or evaluated candidates.

**Disposition:** Clarified.

**Architecture:** the addendum supersedes the one-ratio reading. Boolean selectivity uses locally eligible canonical candidates divided by evaluated canonical candidates. Variational selectivity is computed per complete cohort from degeneracy. Cohort-selected candidates divided by evaluated candidates remains the reconciliation metric `overallRetention`; raw and pre-canonical counts remain separate.

**Reason:** comparing a deduplicated numerator with a raw labelled denominator would make the ratio depend on labelling multiplicities rather than admissibility.

### 2.3 Profile-quotient versus exact-element counting

**Draft:** composition is said to occur over profile classes rather than structures, but `Candidate.nodes.ref` accepts either `ElementId` or `ProfileHash`, and the profile-collapse test asks for a second run over the full element set.

**Disposition:** Clarified.

**Architecture:** every result declares `profile-quotient`, `element-exact`, or `single-candidate` counting. The collapse test compares projected verdicts and admitted sets. Raw ratios are not assumed equal unless multiplicity weighting is defined.

**Reason:** unequal profile-class sizes can make quotient and concrete populations have different probability measures even when profiles are behaviorally sufficient.

### 2.4 Monotonicity of `countRole(role, min, max)`

**Draft:** the predicate table marks the violation as monotone “for `min`.”

**Disposition:** Corrected.

**Architecture:** under additive graph extension, being below a minimum can be repaired by adding matching edges and is therefore not a monotone violation. Exceeding a maximum cannot be repaired by addition and is monotone. The same split applies to `degree(..., min, max)`.

**Reason:** pruning a branch merely because it has not yet reached a minimum would silently remove valid extensions.

### 2.5 Predicate-level monotonicity is context-sensitive

**Draft:** `cycleExists`, `connected`, and other built-ins receive a simple yes/no monotonicity classification.

**Disposition:** Clarified.

**Architecture:** monotonicity belongs to the violation of a specific expression under declared extension operations. Absence of a required cycle is not monotone, while the presence of a forbidden cycle, expressed as violation of `not(cycleExists)`, is monotone under edge addition.

**Reason:** the property, its negation, and the permitted extensions determine safe pruning together.

### 2.6 Random audit versus proof of monotonicity

**Draft:** a mandatory randomized audit is the safeguard against an incorrectly declared flag.

**Disposition:** Clarified.

**Architecture:** the audit remains mandatory, but passing it is explicitly a falsification attempt rather than proof. Static inference is added for known expressions, and pruning-off differential tests are required for bounded fixtures.

**Reason:** a finite random sample cannot prove a universal monotonicity claim.

### 2.7 Full census versus generation pruning

**Draft:** all predicates are evaluated for every candidate, but monotone predicates prune partial branches before complete candidates exist.

**Disposition:** Clarified.

**Architecture:** all top-level predicates are evaluated for every complete canonical candidate that reaches filtering. Pruned partial branches have a separate pruning census and witnesses and do not enter the selectivity denominator.

**Reason:** a pruned partial structure is not a member of the complete candidate population and often lacks enough data for non-monotone predicates.

### 2.8 Explanation for “every candidate”

**Draft:** every candidate must have an admission or rejection explanation.

**Disposition:** Clarified.

**Architecture:** every retained complete canonical candidate has a full explanation. Every pruned branch has a pruning reason, but not a fabricated complete-candidate verdict.

**Reason:** materializing every pruned extension solely to explain it would negate pruning and change the candidate definition.

### 2.9 `stableUnder` universal versus threshold semantics

**Draft:** the combinator table says `P` is preserved under all perturbations, while the following section says the result is a fraction and the predicate supplies a threshold.

**Disposition:** Clarified.

**Architecture:** stability is the preserved fraction and passes at a configured threshold; `threshold = 1` expresses preservation under all valid perturbations.

**Reason:** this retains both source meanings in one unambiguous contract.

### 2.10 Timestamp versus byte-identical output

**Draft:** the run manifest contains a timestamp, while M0 and the success criteria require byte-identical artifacts for repeated identical runs.

**Disposition:** Corrected.

**Architecture:** deterministic semantic manifests and results are separated from non-semantic execution records. Timestamps exist only in execution records and do not affect semantic hashes.

**Reason:** two real executions cannot generally have the same timestamp.

### 2.11 Null-model z-score direction

**Draft:** defines `z = (observed - mean_null) / sd_null` and later expects Case 1 to produce a “significantly positive” z-score.

**Disposition:** Corrected as an unconditional acceptance claim.

**Architecture:** preserves the formula and interprets its sign literally. If “more selective” means a smaller admission fraction, greater-than-null filtering produces a negative z-score. Case 1 must freeze the expected direction only after the null statistic and scientific hypothesis are specified.

**Reason:** the sign cannot be prescribed independently of the measured statistic and expected relationship.

### 2.12 Zero null variance

**Draft:** does not define z-score behavior when `sd_null = 0`.

**Disposition:** Added.

**Architecture:** `z` is `null`; the result states whether the observation equals the constant null value.

**Reason:** JSON cannot represent `Infinity` or `NaN` portably, and either value would be statistically misleading.

### 2.13 “Degenerate transition” threshold wording

**Draft:** says a degenerate transition has selectivity “above the threshold below which the claim is meaningless,” which contains conflicting directions.

**Disposition:** Clarified without inventing one scientific cutoff.

**Architecture:** rule packages may define labelled thresholds separately for Boolean selectivity, per-cohort variational selectivity, indeterminate ratio, and overall closure viability. The threshold, direction, cohort distribution, fragility status, and reason are reported.

**Reason:** whether low or high admission is scientifically degenerate is theory-dependent.

### 2.14 `minimal`, `novel`, and `irreducibleRemoval` domains

**Draft:** uses “proper substructure,” “proper constituent,” and “removal of any element” without defining whether nodes, edges, disconnected subgraphs, or empty results participate.

**Disposition:** Clarified.

**Architecture:** `minimal` uses an explicit `SubstructurePolicy`; `novel` compares derivational constituents; `irreducibleRemoval` declares node or edge removal. Invalid/empty perturbations have a stated policy.

**Reason:** these choices can reverse a verdict and therefore belong to the run hash.

### 2.15 Predicate phases

**Draft:** declares `formation`, `maintenance`, and `termination` but does not define their execution semantics.

**Disposition:** Clarified.

**Architecture:** formation concerns partial structural formation, maintenance concerns complete-candidate invariants, and termination concerns final closure. Phase remains a reporting/analysis dimension; it does not override full final evaluation or safe-pruning rules.

### 2.16 Skeletons and multigraphs

**Draft:** candidates are multigraphs, while the quoted skeleton counts are counts of connected unlabeled simple graphs. Decoration describes directions and roles but not how parallel edges appear.

**Disposition:** Clarified.

**Architecture:** the enumerator produces simple undirected skeletons; decoration may assign a permitted multiplicity to each skeleton adjacency before direction and role assignment. Self-loop policy is explicit.

### 2.17 Uniform null model

**Draft:** requires uniform sampling from the candidate space without defining the candidate measure or an exact sampler.

**Disposition:** Clarified.

**Architecture:** uniform means uniform over a declared finite canonical universe. An approximate proposal/rejection sampler must be labelled approximate and cannot silently use the `uniform` name.

### 2.18 Degree-preserving rewiring

**Draft:** does not say whether total, directed, or role-specific degrees are preserved or whether graph connectivity must remain.

**Disposition:** Clarified.

**Architecture:** rewiring preserves the configured directed, role-wise degree sequence and reports mixing/invalid swap diagnostics. Connectivity follows the declared graph policy.

### 2.19 Minimum element depth and identity

**Draft:** element ID is derived from canonical form, while minimum derivation depth may change after an alternate derivation is found.

**Disposition:** Clarified.

**Architecture:** derivation depth and alternate provenance are indexing/derivation facts and must not create a new structural identity. The minimum-depth index can update while the content-addressed element identity stays stable.

### 2.20 Inert and dominating predicates

**Draft:** inert means zero rejections and dominating means at least 90%, without defining the denominator or overlapping failures.

**Disposition:** Clarified.

**Architecture:** the denominator is the applicable evaluated complete-candidate population. Both total failures and exclusive rejections are reported; dominance defaults to a 90% total failure share.

### 2.21 Budget exhaustion

**Draft:** exposes `budgetExhausted` and says selectivity is not interpretable, but still types `selectivity` as a required number.

**Disposition:** Corrected.

**Architecture:** top-level and per-metric interpretation statuses and reasons are mandatory. Boolean/overall ratios may be `null`, per-selector variational values may be `null`, and an empty selector map means not applicable. A compatibility projection may still expose the draft `budgetExhausted` and old one-ratio field.

### 2.22 Mandatory null models in all runs

**Draft:** says the kernel always calculates all three null models.

**Disposition:** Narrowly clarified.

**Architecture:** all three are mandatory for a standard research result. Unit, development, and conformance runs may omit them but must report `not-run` and cannot claim a baseline result.

**Reason:** forcing 500 baseline trials into every canonicalization unit test would not strengthen the scientific output.

### 2.23 Two runtime targets

**Draft:** M1 expects the `n = 4`, four-role, six-edge generator to finish in 10 seconds; overall kernel success allows 60 seconds.

**Disposition:** Clarified.

**Architecture/refactor plan:** 60 seconds is the required end-to-end acceptance ceiling; 10 seconds is the generator optimization target. A reference environment is required.

### 2.24 Case 1 failure diagnosis

**Draft:** if the triad-versus-dyad result cannot be reproduced, either the article's argument is incomplete or the kernel is wrong.

**Disposition:** Clarified from a false dichotomy.

**Architecture:** also recognizes an incorrect or incomplete rule-package encoding as a distinct cause. Conformance evidence must distinguish theory, encoding, and engine defects.

**Reason:** a correct argument and correct engine can still disagree when primitives, tolerance, `closure`, or removal semantics are encoded incorrectly.

## 3. Source statements intentionally not made normative

### 3.1 “This is the only project task for which a computational tool is necessary”

**Disposition:** Excluded as a comparative project judgment.

The architecture retains the useful claim that manual calculation is insufficient for the selectivity ladder. It does not make an untestable exclusivity claim about every other possible project task.

### 3.2 “This is the only thing that makes recursion computable”

**Disposition:** Excluded as absolute rhetoric.

The architecture retains profile factorization as the central scaling strategy and falsifiable hypothesis. Other bounded, symbolic, approximate, or hardware-assisted strategies are not ruled out by architecture wording.

### 3.3 Approximate `10^11` graph count

**Disposition:** Excluded from normative requirements.

The estimate depends on exact assumptions about labels, parallel edges, directions, roles, self-loops, and edge limits. It remains useful motivation, but the architecture uses reproducible reference counts only for connected unlabeled simple skeletons and requires measured candidate counts in benchmarks.

### 3.4 Comparative claim about SHACL, description logics, and configurators

**Draft:** says the five combinators are absent from SHACL, description logics, and configurators.

**Disposition:** Excluded as an uncited, broadly scoped literature/product comparison.

The architecture preserves the combinators and the computable-emergence purpose of `novel(P)`. A separate research-positioning document may make comparative claims after defining product/language versions and citing sources.

### 3.5 “All the power is here”

**Disposition:** Excluded as rhetorical emphasis.

The combinators' exact semantics and computational cost are preserved.

### 3.6 Publication-oriented wording

The following draft ideas were not made architectural requirements:

- a profile-collapse mismatch is “a result worth publishing”;
- Case 1 selectivity is “the project's first real number”;
- motif disagreement is “the first real no from the world”;
- the external channel is “free” and “requires no other person”;
- the third success criterion is “the only one worth everything else.”

**Disposition:** Excluded from normative architecture, retained in neutral form.

The architecture requires preservation of negative results and prohibits automatic post-hoc adjustment. Publication, cost, staffing, and personal research value are project decisions.

### 3.7 Colloquial “columns” for profile classes

**Disposition:** Excluded from the data contract.

The public API uses the precise term `profileClasses` and does not assign a visualization metaphor.

### 3.8 “No UI” as a slogan

**Disposition:** Retained as a formal dependency/scope rule, not as rhetoric.

The kernel is JSON-compatible and UI-independent. Visualization remains an external consumer.

### 3.9 Strong interpretations of census labels

**Draft:** calls an inert predicate “dead code in the theory” and says a dominating predicate makes the remaining construction decorative.

**Disposition:** Retained as a diagnostic hypothesis, not a universal conclusion.

The architecture reports inertness only with respect to the evaluated population and separates total from exclusive rejections. A predicate may be scientifically meaningful outside one bounded run, and correlated predicates can fail together without one making all others decorative.

### 3.10 Network-motif methodology rationale

**Draft:** explicitly says the mandatory baseline methodology is consciously borrowed from network-motif analysis because it supplies an external benchmark.

**Disposition:** The three null models and motif benchmark are retained, while the historical/comparative attribution is not normative architecture.

A research-methodology document should cite the exact motif literature and explain which definitions transfer to Onto2D. The architecture cannot establish that attribution without a selected source corpus.

### 3.11 Small-`n` cost estimates

**Draft:** says exponential substructure combinators produce only dozens of checks at `n <= 5`.

**Disposition:** Excluded as a universal performance statement.

The actual count depends on the substructure policy, edge count, removal unit, and nested predicates. The architecture retains the exponential-cost warning and the intended bounded operating range; the benchmark suite will record measured counts.

## 4. Project-management material relocated from architecture

The draft's M0-M8 checklists are not repeated verbatim inside the architecture because architecture describes stable boundaries and behavior, while milestone order can change.

**Disposition:** Relocated to `KERNEL_REFACTOR_PLAN.md`.

Mapping:

| Draft milestone | Refactor stages | Notes |
|---|---|---|
| M0 deterministic core | R1 | Types, canonicalization, hashing, loading, stratification |
| M1 generator | R3 | Skeletons, decoration, pruning integration, deduplication, budgets |
| M2 predicates | R4 | Typed IR, built-ins, combinators, perturbations, audit |
| M3 filter/census/explanations | R5 | Complete evaluation, diagnostics, witnesses, JSON/NDJSON |
| M4 profiles | R6 | Extraction, canonical profile, classes, collapse test |
| M5 ladder/closure | R7 | `closeLevel`, `closeLadder`, minimum depth, bounded fixpoint |
| M6 null models | R8 | Three models, distributions, z-score report |
| M7 cases | R9 | Level 0, Phase C-to-D, motifs, case reports |
| M8 freeze protocol | R2 and R10 | Minimal hashing/artifacts move earlier; full workflow closes delivery |

The draft statement that nothing may be built above M0 before it is correct is preserved as dependency gates rather than prose.

## 5. Research inputs deferred from the architecture

### 5.1 Oscillator `closure` predicate

The draft names:

```text
balance(k) AND balance(omega) AND irreducibleRemoval(closure)
```

but does not define the `closure` expression itself, oscillator primitive values, tolerance, graph projection, or removal unit.

**Disposition:** Deferred to the Level 0 rule package.

The architecture preserves the intended triad-versus-dyad acceptance criterion but does not invent scientific inputs.

### 5.2 Phase C-to-D ensemble

The implementation checklist names an ensemble case but provides no primitives, predicates, graph conventions, or expected outcome.

**Disposition:** Deferred to a separate research fixture and frozen prediction.

### 5.3 Thirteen-motif published comparison

The draft notes published frequencies in gene-regulation networks, neural networks, electronic circuits, and food chains, but does not identify one publication, dataset version, network, motif convention, preprocessing pipeline, null model, or ranking statistic. Published motif frequencies differ across domains and methods.

**Disposition:** Deferred to case preparation.

The refactor plan requires `cases/three-node-motifs/sources.md`, a frozen dataset, graph conventions, and a pre-run prediction. The architecture preserves external comparison as mandatory but does not select evidence silently.

### 5.4 Expected z-score for Case 1

The sign and magnitude cannot be frozen until the null population and scientific statistic are fixed.

**Disposition:** Deferred to the case prediction; the unconditional “significantly positive” milestone wording is not retained.

### 5.5 Non-uniform ladder as success

The draft requires at least three transitions and a non-uniform selectivity profile.

**Disposition:** Retained as a research success criterion, with one qualification: a uniform profile is still a valid result and must be reported as evidence that the current filter does not distinguish transitions. The software run does not become invalid merely because the hypothesis fails.

## 6. Shell features excluded from the kernel but not from the project

The draft explicitly excludes these from M0-M8:

- editor;
- canvas;
- product catalogue;
- goal solving;
- completion plans;
- temporal runtime;
- events;
- epistemic contexts;
- plugins;
- package registry;
- products.

**Disposition:** Retained as kernel non-goals.

They are not rejected as future Onto2D features. They belong to shell/application packages that depend on the kernel. The broader functional plan may continue to define them, but none may introduce a reverse dependency from the kernel.

## 7. Architecture content added beyond the draft

The following material was added because a “complete and detailed” architecture needs implementation contracts that the source draft did not define.

### 7.1 Counting and result precision

Added:

- explicit counting domains;
- raw/canonical/evaluated/admitted counts;
- nullable selectivity and interpretation status;
- separate pruning counts;
- exact-versus-estimated result labelling.

### 7.2 Canonical bytes

Added:

- UTF-8 and stable key/order rules;
- number normalization requirements;
- domain-separated hashes;
- concurrency-independent artifact ordering;
- structural versus non-structural attributes.

### 7.3 Predicate completeness

Added:

- typed expression AST shape;
- three-valued evaluation;
- explicit selector/policy dependencies;
- witness result contract;
- static monotonicity analysis;
- cache-key semantics;
- prohibition of executable rule code.

### 7.4 Operational reliability

Added:

- structured error families;
- state-machine failure semantics;
- cancellation and memory/time budgets;
- semantic artifact integrity;
- security/resource-isolation rules;
- schema and algorithm versioning.

### 7.5 Null-model rigor

Added:

- role-shuffle invariants;
- directed role-wise degree preservation;
- mixing diagnostics;
- exact-uniform naming requirements;
- independent random stream derivation;
- zero-variance behavior.

### 7.6 Repository migration

Added in the refactor plan:

- current-code inventory;
- legacy compatibility strategy;
- target package tree;
- adapter loss reports;
- issue-ready work breakdown;
- CI gates, property tests, differential tests, and risks.

These are not translations of source claims. They are design additions made visible here so they can be accepted, modified, or rejected independently.

## 8. Section-by-section traceability

| Draft section | Architecture location | Refactor/omissions notes |
|---|---|---|
| Introduction: what the kernel is/is not | Architecture §§1, 3 | Rhetorical exclusivity removed in §3.1 of this document |
| §1 formula and outputs | Architecture §§4, 8.9 | Denominator/counting domains clarified |
| §2.1 depth stratification | Architecture §§5.1, 14 | Bounded fixpoint semantics completed |
| §2.2 profile factor | Architecture §§5.2, 12 | Exact/quotient projection clarified |
| §2.3 monotonicity | Architecture §§5.3, 10.3, 11 | `min` correction and audit limits documented |
| §2.4 rejection census | Architecture §§5.4, 8.7, 16 | Overlap and pruning populations clarified |
| §2.5 null models | Architecture §15 | Model invariants and statistical edge cases added |
| §2.6 frozen run | Architecture §17 | Timestamp split resolves reproducibility conflict |
| §3 data structures | Architecture §8 | Types expanded without dropping source fields |
| §4 predicate language | Architecture §11 | Substructure, novelty, removal, and stability policies defined |
| §5 run pipeline/budgets | Architecture §§13, 22 | State/failure semantics added |
| §6 two cases | Architecture §24 | Missing scientific inputs deferred in §5 above |
| §7 public API | Architecture §19 | `loadPackage` unifies loading; compatibility facade allowed |
| §8 M0-M8 | Refactor plan §§8-9 | Fully translated and converted to gated work |
| §9 intentional exclusions | Architecture §3.2 and §6 | Preserved as dependency boundary |
| §10 success criteria | Architecture §25 | Failed research hypothesis remains a reportable result |

## 9. Changes required by the foundational paper

The first architecture pass was based on the kernel draft alone. The later-supplied [*Topology of arising and the principle of minimal action in admissibility structures*](../scr/topology-of-arising.pdf) materially refined the target. The source reviewed here is 36 pages with SHA-256 `3992ae25c5e499842a57b07dea0d2f9d206ee3483d634fb9053af39dc260a8f7`.

### 9.1 Boolean filtering was incomplete

**Paper:** stable configurations are selected through minimal action and later through `Psi_selected = arg min F[psi]` over a configuration class.

**Earlier architecture:** every candidate was decided independently by Boolean predicates.

**Correction:** deterministic `COHORTS`, `RANK`, and `SENSITIVITY` stages now follow local filtering. They support finite `argmin`/`argmax`, contested-resource partitions, unit-bearing epsilon, complete rankings, retain-all extrema, degeneracy, coefficient robustness, evidence, and explanations.

The kernel still does not solve the continuous variational problem. It selects over normalized finite scores supplied by a package or scientific adapter.

### 9.2 One “level/phase” axis was insufficient

**Paper:** Level 0 contains phases A–D and multiple closure moments.

**Draft/current catalogue:** also use depth, `Level`, and `Phase` for different purposes.

**Correction:** the architecture now separates kernel derivation depth, paper ontology level/phase, legacy catalogue level/phase, and predicate execution phase. Every mapping is explicit and hashed.

### 9.3 Plain numerical invariants were insufficient

**Paper:** uses `A`, `k`, `omega`, `m`, `M`, `hbar`, `lambda`, `kappa`, action values, `Gamma`, and coupling terms with different structural meanings.

**Earlier architecture:** used `Record<string, number>`.

**Correction:** invariants are typed quantities with units, tolerances, semantic definitions, and evidence references. Unit-incompatible arithmetic is invalid.

### 9.4 The generic cycle predicate could admit the wrong dyad

**Paper:** the dyad is a segment, not the first nontrivial loop; the triad is the minimal loop with relational overdetermination.

**Earlier architecture:** `cycleExists(roles?)` meant a directed cycle without a length/projection contract. Two reciprocal directed edges could therefore appear cyclic.

**Correction:** cycles declare directed/simple/multigraph projection and length bounds. The CRT case uses an undirected-simple cycle of at least three nodes.

### 9.5 `irreducibleRemoval` alone did not encode the paper's triad argument

**Draft milestone:** expects the dyad to be rejected specifically by `irreducibleRemoval`.

**Paper:** the dyad fails closed relational support, relational overdetermination, and minimal loop structure; removal behavior is part of the triad's irreducibility argument.

**Correction:** the case uses a named composite `irreducible-triadic-closure` predicate containing whole-closure, balance, loop, rank/surrogate, and removal conditions. The census may attribute the composite predicate, but a bare removal check is no longer presented as sufficient.

### 9.6 Triadic closure was not yet objecthood

**Paper:** a CRT becomes object-like only through the conjunction of bounded support, invariant concentration `Gamma`, and perturbative persistence.

**Earlier architecture:** the Level-0 case stopped at triad admission.

**Correction:** the research case has separate gates for coherent triad and CRT-node objecthood. Exact resonance without robust bounded identity is not enough.

### 9.7 The Phase C-to-D placeholder was under-specified

**Paper:** a new collective regime requires essential bounded inter-node coupling and non-reducibility to independent node persistence. Completion of Level 0 additionally requires effective higher-level redescription.

**Earlier documents:** mentioned a Phase C-to-D ensemble without a formal gate.

**Correction:** the case now distinguishes an uncoupled collection from a coupled ensemble-quantum using coupling, novelty/non-additivity, stability, cohort selection, and a profile-backed redescription test.

### 9.8 Profile extraction gained a theoretical role

**Paper:** a completed ensemble must be effectively re-describable as a new carrier domain.

**Disposition:** Added operationalization.

The architecture uses the compositional profile as the effective carrier interface and emits an explicit `CarrierPromotion` artifact. Profile collapse is the falsifiable sufficiency test. This algorithm is an Onto2D hypothesis; it is not specified by the paper itself.

### 9.9 Continuous mathematical claims remain outside the graph kernel

The paper discusses a hyperbolic operator, action stationarity, bounded solutions, nonlinear CRT equations, meta-Lagrangians, and collective functionals.

**Disposition:** Architecture boundary clarified.

The kernel verifies normalized quantities, residuals, claims, and content-addressed evidence. PDE solution, variational differentiation, field integration, and stability analysis belong to a separately versioned scientific adapter. Executable solver code is not loaded from rule packages.

### 9.10 Paper propositions are not software facts

The paper argues for uniqueness or necessity of the `(1,1)` signature, d'Alembertian class, scalar mass term, `|Psi|^2` density, triadic closure, and three completion conditions.

**Disposition:** Preserved as claim records, not automatically marked empirical truth.

The kernel can verify consequences within an encoded model class and search for bounded counterexamples. It cannot infer universal impossibility merely because alternatives were absent from a package.

### 9.11 Inputs still absent from the paper

The architecture and refactor plan do not invent:

- a computable compensation function `C`;
- support representation and integration measure;
- boundary/initial conditions;
- units, parameter ranges, and tolerances;
- a bounded-solution and stability algorithm;
- perturbation epsilon and identity metric;
- relational constraint-rank definition;
- explicit `V_ab` coupling families and boundedness domains;
- definitions of `chi_stab`, `chi_phase`, `chi_energy`, and `chi_closure`;
- `alpha_i` coefficient values/policy;
- the deferred Lorentz-covariant derivation;
- an algorithm for effective redescription independent of the profile hypothesis;
- empirical validation data or bibliography.

These remain declared missing scientific inputs. A case depending on them is `incomplete` or `indeterminate`, not silently passed or failed.

### 9.12 Material added to the documentation set

The new paper analysis provides:

- page/equation-level conceptual mapping;
- the four-phase Level-0 progression;
- a proposed five-depth computational ladder plus Level-1 promotion;
- gate-specific acceptance matrices;
- the external computation boundary;
- paper-aware null-model constraints;
- a complete list of currently non-computable inputs.

### 9.13 Existing catalogue versus paper

The repository's 24-record `level-0.json` catalogue was also cross-checked against the paper.

**Retained:** its proto-field, distinguishability, geometry, wave, variational, triad, node, ensemble, quantum-seed, and Level-1 bridge records provide a strong source-data alignment. Their uniform `methodological-placeholder` status matches the paper's stated scope.

**Not normalized silently:** catalogue entries `0.7` (Configurational Density) and `0.8` (CRT-Node) use Phase C, whereas the paper derives `Gamma` and CRT objecthood within Phase B before Phase C begins. Both source coordinates remain visible until an ADR selects the intended ontology.

**Still deferred:** `0.20` (Configurational Anisotropy), `0.22` (Directional Admissibility Gradient), and `0.23` (Localized Transport Bias) lack direct computational definitions in the supplied paper. `0.21` (Closure-Preserving Deformation) is related to perturbative persistence but still lacks a perturbation/tolerance contract.

**Not imported as card-level derivation:** the catalogue parent graph contains a Level-0 strongly connected component `{0.8, 0.21, 0.22}` and two further components at higher levels. The adapter preserves every edge, classifies semantics under a frozen exposure-declared protocol, adjudicates whether cards are one distributed structure or a joint cluster, and computes depth on the SCC condensation quotient. No internal member order is asserted, and non-generative/internal relations remain in typed explanation layers.

## 10. Addendum A: selection and quantities disposition

The later addendum has priority over the original kernel draft where they conflict. Its substantive requirements have been incorporated into the English architecture rather than left as commentary.

### 10.1 Three indexing axes

**Retained:** derivation depth is a computed metric of the pair `(structure, primitive basis)`, not an intrinsic property of the structure. Every element and level result now carries a `depthBasis` hash, and the semantic manifest binds the basis. Cross-run depth comparison with unequal basis hashes is invalid.

**Retained:** ontology level is a declared or computed carrier partition, while ontology phase is a declared partial order. Axis provenance is explicit. Reports name their aggregation axis, and integer-looking level labels cannot be compared pointwise with derivation depth.

**Clarified:** the addendum's three fields are represented by `depth`/`depthBasis`, `OntologyCoordinate`, and `AxisProvenance` rather than duplicating `levelLabel` and `phaseTag` beside the existing coordinate object. This is a schema normalization, not an omission.

### 10.2 Profile collapse as a level-boundary detector

**Retained:** `collapseError` is now a reported metric, and `detectLevelBoundaries` emits the requested transition/error/declared-level/match table. The error uses projected canonical sets in one counting domain.

**Clarified:** the source ratio has an undefined zero denominator and may exceed one when quotient composition creates spurious results. The architecture returns `null` for an empty full set and does not clamp the value.

**Clarified:** a single unrestricted global `argmin` cannot identify several boundaries in a long ladder. Detection therefore uses frozen search intervals, tie tolerance, and maximum error; without intervals it reports candidate minima only. A detected boundary creates a derived mapping artifact and never silently rewrites author-declared levels.

### 10.3 Typed hard filters and cohort functionals

**Retained:** `Predicate` and `Functional` are separate schema types, registries, evaluator capabilities, and pipeline states. Functionals are unavailable to generator/decorator code. Ranking can never prune generation.

**Retained:** the pipeline is now explicitly `FILTER -> COHORTS -> RANK -> SENSITIVITY`, followed by profile materialization. Every eligible candidate is assigned to a complete competition cohort before any score is interpreted.

**Clarified:** the four addendum forms are implemented as shared-support, profile-role, deterministic invariant-window, and singleton rules. Explicit global competition is also representable but is never a default.

**Corrected:** pairwise “within window” is not generally an equivalence relation because it can fail transitivity. Invariant windows therefore use frozen, unit-bearing, half-open bins with an origin and width. Overlapping shared support is converted to connected components of the candidate/resource incidence relation so cohort membership remains a partition.

### 10.4 Ranking, degeneracy, and tie behavior

**Retained:** the semantic output is the complete ranked cohort, optimum, epsilon, full extremum set, degeneracy, degeneracy ratio, oriented gap, and variational selectivity. An all-equal cohort retains every member and reports `degeneracyRatio = 1` and `variationalSelectivity = 0`; it has no unique semantic winner.

**Clarified:** the addendum requests deterministic tie-breaking by canonical ID while also saying the kernel does not choose one winner. Canonical ID therefore fixes serialization order and an optional presentation leader only. It never removes an epsilon-equivalent optimum.

**Clarified:** `gap` is objective-oriented so it is non-negative for both `argmin` and `argmax`. It is zero for a tied second score and `null` for fewer than two scoreable members.

### 10.5 Two-dimensional selectivity

**Retained:** the primary scientific output is Boolean selectivity `eligible/evaluated` plus per-cohort variational selectivity `1 - degeneracy/cohortSize`.

**Clarified:** the former `selected/evaluated` value remains as `overallRetention`, and `selected/eligible` remains `selectionRetention`, solely for accounting and compatibility. Neither replaces variational selectivity. A weighted level summary must retain all per-cohort values.

**Clarified:** singleton cohorts have variational selectivity zero because no concentration relative to competitors was observed. They are not reported as maximally decisive.

### 10.6 Coefficient sensitivity

**Retained:** all declared free coefficients, including paper `alpha_i`, enter semantic hashes and run mandatory positive/negative `10%` and `25%` sensitivity sweeps. Reports include semantic leader-set stability, canonical presentation-leader stability, top-k stability, and a pre-thresholded robust/fragile verdict. Fragility invalidates interpretation of variational selectivity but does not erase raw rankings.

**Clarified:** the addendum does not say whether all coefficients are perturbed jointly or individually. The architecture freezes this choice and uses deterministic one-at-a-time perturbation as the mandatory default; a budgeted Cartesian sweep is optional. This choice is part of the run hash.

### 10.7 Quantities, tolerances, and three-valued outcomes

**Retained:** every scientific quantity has a normalized unit, non-empty tolerance, semantic definition, declared/computed/oracle provenance, evidence references, and method/source data. Profile quantization is stated in the quantity's unit rather than only as abstract decimal places.

**Clarified:** the source examples use both prose `dimensionless` and unit expressions. Canonical quantity data uses unit `"1"` for dimensionless values under the frozen unit grammar.

**Clarified:** strict equality is forbidden for numeric quantities, not for canonical IDs, enums, booleans, strings, or exact structural counts. Unit errors known statically fail package loading; incompatible values returned later by an oracle fail evidence validation because they cannot be known at initial load time.

**Retained:** `pass`, `fail`, and `indeterminate` have explicit truth tables and disjoint result buckets. Indeterminate candidates are never admitted or added to the hard-filter numerator. Their ratio is printed beside both selectivity dimensions and can invalidate interpretation at a frozen threshold.

### 10.8 Oracle boundary

**Retained:** PDE, variational, integration, and continuous-stability work stays outside the kernel. The content-addressed oracle request binds canonical candidate, requested quantities, parameters, target tolerance, and solver ID/version/method. Solver version changes invalidate cache and run identity.

**Retained:** `failed` always yields dependent `indeterminate`. `partial` follows a frozen package policy: remain indeterminate or accept only under an explicit maximum-residual guard and recorded tolerance multiplier. Wall time is operational metadata and does not contaminate semantic response hashes.

### 10.9 Decisions still not supplied by the addendum

The following remain theory or case-package inputs rather than kernel defaults:

1. the contested-resource cohort rule `kappa` for each scientific gate;
2. the theoretical or pre-registered source of every `alpha_i`;
3. the unit-bearing degeneracy epsilon and its justification;
4. the partial-oracle policy and any residual/tolerance widening limits;
5. whether a case needs one-at-a-time or Cartesian sensitivity beyond the mandatory baseline;
6. level-boundary search intervals and acceptable collapse-error threshold.

The first four are the addendum's own explicit unresolved decisions. The final two are implementation choices exposed by making its procedures deterministic. All six are hashed, reported, and forbidden as hidden environment defaults.

## 11. SCC blocker review disposition

A subsequent review note proposed condensation, blind edge typing, cluster elements, and migration metrics for the three catalogue SCCs. The useful content is now normative in the architecture and actionable in the refactor plan.

### 11.1 Condensation instead of edge deletion

**Retained:** source acyclicity is recovered through SCC condensation. Every surviving component becomes one stratification vertex; its members inherit one depth and `depthBasis`, while `internalOrder` is explicitly undefined. Every raw edge remains in the inter-cluster graph, internal graph, or a typed explanation layer.

**Clarified:** “generative must be acyclic” applies to inter-cluster stratification after source-card resolution. A nontrivial raw generative SCC is not discarded or silently relabelled. It becomes an `unresolved-generative-cluster`; only the quotient makes the ordering claim. Runtime bounded fixpoint is still required for actual recursive kernel derivation and is not replaced by source condensation.

### 11.2 Intra-closure support as a distinct relation

**Retained:** `intra-closure-support` is distinct from inter-structure derivation and from general co-constitution. It represents source cards or aspects internal to one closure-bearing structure and triggers a distributed-structure merge review.

**Clarified:** the earlier `regulatory-feedback` category is not removed. The complete core source vocabulary therefore has six categories: generative, constitutive, intra-closure support, evidential, descriptive, and regulatory feedback. Only the first three participate in the formation-support projection; only inter-cluster generative edges determine default depth.

### 11.3 Blind classification and anti-fitting controls

**Retained:** category rules, examples, exclusions, visible fields, and warning thresholds are frozen before classifiers see SCC membership or acyclicity consequences. Independent annotations and blind adjudication are immutable artifacts. Post-unblinding changes remain linked to their original labels and change migration/run hashes.

**Added:** a research migration requires at least two independent classifications unless a completely frozen deterministic rule engine is used. This strengthens the proposed blind procedure and makes disagreement measurable.

**Clarified:** the SCC memberships are already printed in the documentation, so an author or reviewer who has read them is not prospectively blind. Such work must use fresh unexposed classifiers, use a deterministic-precommitted classifier, or carry `historically-exposed` status and a mandatory fitting-risk warning. The architecture does not make an impossible blindness claim retroactively.

### 11.4 Merge versus cluster decision

**Retained:** every typed SCC is reviewed to determine whether it is one structure distributed across cards, several jointly constituted structures, an unresolved generative unit, or a mixed unresolved unit.

**Corrected:** SCC membership alone does not justify merging nodes. Merge criteria must be general, frozen before component inspection, and tested with negative examples. “The merge removes a cycle” is explicitly forbidden as a criterion.

**Clarified:** the suggestion to check for a distributed structure “before classification” would reveal the SCC to the same reviewer and weaken blindness. The criteria are frozen before classification, but applied only after eligible annotations and exposure declarations are sealed and components are computed.

### 11.5 Level-0 analogy to the paper triad

**Retained as hypothesis:** `{0.8 CRT-Node, 0.21 Closure-Preserving Deformation, 0.22 Directional Admissibility Gradient}` may encode one mutually supporting closure or constitutive cluster.

**Not promoted to fact:** the paper's irreducible triad consists of resonant modes. The catalogue cards describe a node and two properties. Structural similarity is sufficient to pre-register a test, not to force a mapping or treat the SCC as paper-predicted evidence.

### 11.6 Migration and research metrics

**Retained:** every raw SCC receives one primary resolution; reports include SCC size histograms, classification disagreement and blindness status, merge/condensation/nonformation/reclassification shares, descriptive resolution, post-unblinding changes, cluster member coverage, and constitutive-cluster density by transition.

**Clarified:** two-node SCCs are reported as a possible mechanical-symmetry diagnostic, not automatically collapsed. Large SCCs are evidence of a stronger source assertion, not automatic proof of joint arising.

**Retained as falsifiable research output:** cluster concentration is compared with a bottleneck definition frozen from the independent Boolean/variational selectivity profile. Concentration supports the joint-arising-at-bottlenecks hypothesis; uniformity or depletion weakens it. The result can never be used to revise the migration labels that generated it.

## 12. Completeness conclusion

No substantive kernel capability from the draft, addendum, or computable requirement from the foundational paper was silently omitted. Information absent from the normative architecture falls into one of five explicit groups:

1. delivery sequencing, retained in the refactor plan;
2. rhetorical or comparative claims, listed here;
3. ambiguous or contradictory statements, reconciled here and in the architecture;
4. missing research inputs, deferred to frozen case packages rather than invented;
5. continuous analytical/numerical work, delegated to content-addressed scientific adapters.

This document should be updated whenever review chooses a different disposition. A change from `Corrected` or `Deferred` to `Retained` is an architectural decision and may change future semantic run hashes.
