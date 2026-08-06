# Onto2D Kernel Refactor Plan

Status: bootstrap implementation in progress for the target defined in [KERNEL_ARCHITECTURE.md](./KERNEL_ARCHITECTURE.md). The current implemented layout is recorded in [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

This plan prepares the repository for a controlled refactor. It does not claim that the closure kernel already exists and does not authorize deleting the legacy runtime or catalogue data before compatibility fixtures are in place.

## 1. Refactor objective

Transform Onto2D from a single-file catalogue-backed world validator into a package-oriented system whose foundational package is a deterministic admissibility-closure kernel.

The finished dependency direction will be:

```text
@onto2d/kernel
      ^                 ^
      |                 |
@onto2d/catalog-adapter @onto2d/scientific-adapter
      ^                 ^
      +--------+--------+
               |
@onto2d/legacy-runtime and future applications
```

The kernel owns composition, canonicalization, hard predicates, cohort construction, finite ranking, degeneracy and sensitivity diagnostics, quantity/evidence validation, profiles, carrier promotion, closure, baselines, and artifacts. Continuous field/PDE calculations belong to a scientific adapter behind a content-addressed oracle contract. The legacy runtime remains a shell-level consumer responsible for ontology catalogue navigation and validation of a supplied world.

## 2. Current repository baseline

### 2.1 Repository assets

| Path | Current role | Refactor treatment |
|---|---|---|
| `onto2d.js` | UMD/CommonJS single-file `OntologyGraph`, `OntoWorld`, and `Onto2DEngine` | Freeze behavior, test it, then move behind `@onto2d/legacy-runtime` compatibility exports |
| `scr/level-0.json` ... `scr/level-7.json` | Hidden emergence catalogue levels | Preserve as source data; validate and expose through a catalogue adapter |
| `scr/descriptions.json` | Dictionaries for modes, directions, dependencies, roles, levels, carriers, and ontology terms | Preserve; map only explicit kernel-relevant concepts |
| `scr/arising-schema.json` | Draft-07 JSON Schema for catalogue entries | Preserve as legacy schema; do not reuse as the kernel rule-package schema |
| `scr/theory-of-causal-arisings.pdf` | Additional source/reference artifact, SHA-256 `11945d9890881c3a4c0d791bf8c1842c29d593eeccd24e0720004779b333340a` | Preserve unchanged; outside kernel runtime dependencies until separately reviewed |
| `scr/topology-of-arising.pdf` | Foundational 36-page Level-0 paper, SHA-256 `3992ae25c5e499842a57b07dea0d2f9d206ee3483d634fb9053af39dc260a8f7` | Preserve byte-for-byte as a content-addressed theory source and case evidence artifact |
| `packages/*` | Bootstrap package boundaries for kernel contracts, schemas, adapters, and legacy compatibility | Extend in the staged order without reversing dependencies |
| `cases/level-0-oscillator/source-lock.json` | Machine-readable identities and review status for supplied theory sources | Verify repository artifacts in tests; keep external paths out of runtime contracts |
| `scripts/` and `test/` | Dependency-free checks, characterization tests, source verification, and catalogue audit golden | Grow coverage before behavior migration |
| `README.md` | Accurate shipped/target status, commands, and architecture links | Keep synchronized with executable commands and release status |

### 2.2 Current runtime behavior

`onto2d.js` currently provides:

- catalogue node indexing by `Level.Id`;
- parent/child navigation;
- dictionary-reference checks;
- approximate parent-weight sum checks;
- mandatory dependency coverage checks;
- creation of concrete world bodies bound to catalogue categories;
- validation of user-world relations against catalogue templates;
- a one-step validation report.

This behavior is useful shell functionality. It is not candidate generation, closure, graph canonicalization, profile factorization, a declarative predicate evaluator, a selectivity census, or a null-model runner.

### 2.3 Bootstrap status and remaining implementation gaps

The repository now tracks a private npm workspace and lockfile, supported-runtime declaration, validation build, test runner, CI workflow, five package boundaries, initial kernel schemas/types, source locks, ADR templates, and a golden catalogue audit. The root README describes only commands that exist. The bootstrap is deliberately dependency-free and packages export checked source directly, so no compiled `dist/` artifact is produced.

The guarded canonical serializer, versioned hash domains, first package loader, exact supplied-graph canonicalizer, bounded reference skeleton enumerator through six nodes, and deterministic CandidateStore now exist. Candidate decoration/closure execution, independent canonical byte and generator goldens, full expression typing, unit algebra, schema/type parity automation, migration classifier and condenser, complete artifact formats, scientific implementations, benchmark harness, UI, browser test matrix, and release packaging are still absent. Schemas and unexecuted fixtures do not by themselves prove scientific validity.

The available execution environment used during this preparation did not contain a `node` executable. The Node-based commands are therefore defined and CI-configured but require execution in Node.js 20 or newer before R0 can be marked complete. Static JSON, source identity, catalogue, link, and layout checks were performed with the host tools available here.

The reviewed Russian draft and priority addendum still reside outside the repository at their user-supplied locations. Their names, sizes, line counts, review status, and SHA-256 digests are now recorded in `cases/level-0-oscillator/source-lock.json`; no absolute local path is part of a runtime contract. A future source archive may vendor immutable snapshots under an explicit licensing/provenance decision.

### 2.4 Static catalogue audit

A read-only JSON audit of all eight level files found:

| Check | Result |
|---|---:|
| JSON documents parse | all pass |
| Total catalogue nodes | 249 |
| Duplicate `Level.Id` codes | 0 |
| Missing `ParentCode` targets | 0 |
| Self-parent relations | 0 |
| Duplicate parent relations within a node | 0 |
| Unknown dependency/mode/direction dictionary references | 0 |
| Unknown type-role IDs or invalid phase IDs | 0 |
| Individual weights outside `[0,1]` | 0 |
| Parent-weight sums outside the runtime's `0.05` tolerance | 3 nodes |
| Nodes missing at least one `Requirements.MustCover` dependency under current validator semantics | 107 |
| Total uncovered requirement pairs | 123 |
| Nontrivial strongly connected parent components | 3 components / 38 nodes |

The three weight cases are:

- `0.2` Spatial Distinction: `1.0 + 0.9 = 1.9`;
- `0.9` Nonlinear CRT Variational Functional: `0.5 + 0.4 = 0.9`;
- `0.18` Configurational Mass as Integrability Condition: `0.30 + 0.30 + 0.15 + 0.15 = 0.9`.

The `0.2` value is especially suspicious because the parallel Temporal Distinction record `0.1` uses `0.1 + 0.9 = 1.0`, but the refactor MUST NOT change it by analogy without a source decision. The `0.9` totals may represent omitted influence, deliberate unallocated weight, or data errors.

The 107 `MustCover` results are not automatically 107 scientific data errors. They show that the current validator interprets `MustCover` as dependency types that must occur directly among a node's parents, while the catalogue may use the field differently. Stage R0 characterization now freezes this audit and core validator behavior. The adapter ADR must still decide whether to repair data, change semantics in a new schema version, or preserve explicit warnings.

The parent graph is not acyclic. Its nontrivial strongly connected components are:

- Level 0: `{0.8, 0.21, 0.22}`;
- Level 3: `{3.1, 3.2, 3.5, 3.12, 3.13, 3.14, 3.21}`;
- Levels 4–5: one 28-node cross-level component.

This is compatible with feedback, co-constitution, or one structure distributed across several catalogue cards, but incompatible with interpreting every `ParentCode` as a lower-depth generative dependency. No raw edge will be deleted to obtain acyclicity.

### 2.5 SCC blocker disposition

Status: **architecturally resolved; migration evidence pending**.

Because this document already publishes the three SCC memberships, its readers are not prospectively blind. The production migration must use fresh annotators who have not seen SCC-aware material, or a deterministic classifier frozen before it receives topology-aware input. Otherwise the output is explicitly `historically-exposed`: still usable, but not presented as blind discovery and always carrying a fitting-risk warning.

The controlled migration is:

1. freeze and hash decision rules for `generative`, `constitutive`, `intra-closure-support`, `evidential`, `descriptive`, and `regulatory-feedback`;
2. classify edges independently without exposing SCC membership, cycle diagrams, or the effect on a DAG;
3. freeze annotations and blind conflict adjudication before unblinding;
4. compute SCCs on generative and formation-support projections;
5. adjudicate whether each component is one distributed structure, a constitutive cluster, an unresolved generative cluster, or a mixed unresolved cluster under criteria not tailored to those components;
6. materialize every surviving component as one cluster element with undefined internal order;
7. compute depth on the condensation quotient, whose inter-cluster graph is a DAG by construction;
8. retain every evidential, descriptive, regulatory, and internal relation in typed explanation layers;
9. report how every raw SCC was resolved and how much of resolution came from merge, condensation, nonformation-layer separation, or post-unblinding reclassification.

All member cards of a cluster inherit one depth and basis hash. They remain source-addressable but are not separate depth vertices. Runtime bounded fixpoint remains a different feature: source condensation does not authorize current-level recursive derivation inside the kernel.

The Level-0 component `{0.8, 0.21, 0.22}` is now a pre-registered candidate for distributed closure or joint constitution. Its shape is suggestive of the paper's mutual-support argument, but the named cards are not the paper's three resonant modes. A prospective-blind or deterministic-precommitted protocol should decide the migration before that analogy is evaluated; otherwise the limitation remains explicit.

## 3. Gap analysis

| Capability | Current state | Target state | Migration action |
|---|---|---|---|
| Graph model | Catalogue DAG plus world relations | Canonical directed role-labelled multigraph candidates | Add new kernel model; adapt legacy relations explicitly |
| Validation | One supplied world configuration | Generated candidate populations plus single-candidate mode | Preserve validator; add adapter to kernel single-candidate API later |
| Depth | Catalogue `Level` metadata | Minimum derivation depth plus primitive-basis hash | Add `depthBasis`; reject comparisons across unequal bases |
| Ontology coordinate | Catalogue `Level`/`Phase` and paper Level 0/1, A–D | Explicit level partition and phase partial order independent of depth | Add coordinate and axis provenance; require versioned mapping tables |
| Predicate phase | None | Formation/maintenance/termination execution classification | Never infer it from paper or catalogue phase |
| Roles | Interaction and ontological metadata | Edge role alphabet and compositional profile slots | Map only through versioned rule packages |
| Requirements | `MustCover` dependency IDs | Typed predicate AST | Compile selected requirements; retain unsupported source metadata |
| Candidate generation | None | Skeleton enumeration and decoration | New kernel module |
| Isomorphism | None | Canonical 1-WL refinement plus individualization | New kernel module and conformance fixtures |
| Predicate language | Hard-coded JavaScript checks | Declarative typed expression IR | New schema, analyzer, evaluator |
| Source cycles | Three raw SCCs / 38 cards | Edge-preserving cluster condensation with undefined internal order | Blind relation typing, node resolution, quotient DAG, migration metrics |
| Variational selection | None | Typed functionals, contested-resource cohorts, complete rankings, degeneracy, and coefficient sensitivity | Add separate `COHORTS`, `RANK`, and `SENSITIVITY` stages |
| Selectivity | One implicit ratio in the draft | Boolean and variational dimensions plus reconciliation ratios | Add per-cohort and level result contracts |
| Scientific values | Untyped JSON numbers/weights | Unit-compatible quantities with mandatory tolerances and provenance | Add unit algebra, quantity/evidence schemas, and three-valued comparison |
| Continuous analysis | None | Content-addressed oracle request/response with convergence policy | Add scientific adapter; keep executable solver code outside kernel |
| Diagnostics | Issue list | Complete predicate census and witnesses | New evaluator/census model; adapter may translate legacy issues |
| Profiles | None | Canonical slots plus invariants | New profile package contract |
| Carrier transition | Catalogue relationships only | Explicit promotion from admitted source element to target carrier domain | Add profile-backed `CarrierPromotion` artifact |
| Closure ladder | None | `closeLevel` and `closeLadder` | New coordinator |
| Baselines | None | Three seeded null models | New statistical module |
| Reproducibility | None | Semantic hashes, execution records, frozen predictions | Introduce during the foundation stage, not at the end |
| UI | Not present in repository | Still outside kernel | No kernel work |

## 4. Refactor principles

1. Preserve existing catalogue data byte-for-byte until a reviewed data migration is independently approved.
2. Place new behavior beside the legacy runtime before switching exports.
3. Protect current public behavior with characterization tests before moving code.
4. Keep paper ontology level/phase, catalogue level/phase, predicate phase, and kernel derivation depth as independent coordinates.
5. Keep the kernel dependency-free from all Onto2D application packages.
6. Treat schemas and semantic artifact versions as public API.
7. Introduce semantic hashing before research results are generated.
8. Make partial or sampled results visibly different from complete exact results.
9. Require a fixture and acceptance assertion for every scientific rule package.
10. Prefer a temporary compatibility facade to a flag day rewrite.
11. Preserve theory sources and solver results by content hash and evidence state.
12. Never imply that executing a paper-derived formalism empirically validates it.
13. Treat functional ranking as a complete-cohort operation that cannot prune generation.
14. Report indeterminate and coefficient-fragile results as separate scientific states.
15. Compare derivation depth only under an identical primitive-basis hash.
16. Never delete or hide a source relation to manufacture an acyclic migration.
17. Freeze relation rules and prospective-blind/deterministic annotations before exposing SCC consequences; label prior exposure honestly.
18. Treat cluster number, size, and transition concentration as results, not migration noise.

## 5. Target repository layout

```text
Onto2D/
  package.json
  package-lock.json
  tsconfig.base.json
  README.md
  docs/
    KERNEL_ARCHITECTURE.md
    KERNEL_REFACTOR_PLAN.md
    KERNEL_DRAFT_OMISSIONS.md
    FOUNDATIONAL_PAPER_ANALYSIS.md
    adr/
  packages/
    kernel/
      package.json
      src/
        index.ts
        model/
        package/
        canonical/
        generation/
        predicates/
        selection/
        evidence/
        profiles/
        promotion/
        closure/
        baselines/
        artifacts/
        errors/
      test/
        unit/
        conformance/
        property/
    schemas/
      package.json
      kernel-package.schema.json
      primitive.schema.json
      predicate.schema.json
      functional.schema.json
      cohort-rule.schema.json
      selector.schema.json
      quantity.schema.json
      evidence.schema.json
      oracle-request.schema.json
      oracle-response.schema.json
      sensitivity-report.schema.json
      level-boundary-report.schema.json
      source-relation.schema.json
      cluster-provenance.schema.json
      source-migration.schema.json
      migration-metrics.schema.json
      carrier-promotion.schema.json
      run-config.schema.json
      level-result.schema.json
      manifest.schema.json
    catalog-adapter/
      package.json
      src/
      test/
      fixtures/
        classification-policy.json
        migration-risk-policy.json
        classification-annotations.ndjson
        node-resolutions.json
        condensation.json
    scientific-adapter/
      package.json
      src/
      test/
    legacy-runtime/
      package.json
      src/
      test/
  cases/
    level-0-oscillator/
      package.json
      source-lock.json
      phase-a-context/
      phase-b-oscillatory/
      phase-b-triad/
      phase-c-node/
      phase-d-ensemble/
      level-1-promotion/
    three-node-motifs/
      package.json
      prediction.json
      sources.md
      expected/
  legacy/
    catalogue/
      arising-schema.json
      descriptions.json
      level-0.json
      ...
    references/
      theory-of-causal-arisings.pdf
      topology-of-arising.pdf
      Onto2D_Kernel_Spec.ru.md
      Onto2D_Kernel_Addendum_Selection_and_Quantities.ru.md
  benchmarks/
    n4-four-roles/
  scripts/
  runs/                  # ignored except explicitly frozen fixtures
```

This is the end-state layout. Files should move only after compatibility imports and tests exist. During early stages, `onto2d.js` and `scr/` remain in place.

## 6. Package boundaries

### 6.1 `@onto2d/kernel`

Owns all normative contracts in the architecture document. It accepts normalized kernel packages and emits artifact objects or streams. It knows nothing about catalogue fields such as `ScientificStatus`, `CarrierGroupId`, or UI concepts.

### 6.2 `@onto2d/schemas`

Publishes versioned JSON Schemas for external inputs and outputs. The bootstrap includes hand-reviewed kernel declarations and schema contracts; a later R1 task must generate TypeScript types from, or automatically check them against, these schemas so runtime and compile-time contracts cannot drift.

### 6.3 `@onto2d/catalog-adapter`

Reads the current `scr` catalogue format, validates it, and exposes explicit translations:

- catalogue graph to a single kernel candidate;
- selected dependency requirements to predicate AST;
- selected interaction modes to role IDs;
- selected numeric fields to invariant definitions;
- frozen source-relation categories to typed inter-cluster and explanation layers;
- raw SCCs to edge-preserving cluster elements and member projections;
- unmapped fields to a loss report.

The adapter does not claim that every catalogue record is a primitive or every parent relation is a generative edge. It exposes migration metrics, preserves every source relation, and cannot inspect desired acyclicity while producing prospective-blind or deterministic-precommitted annotations. Historically exposed annotations remain supported only with their explicit status.

### 6.4 `@onto2d/legacy-runtime`

Contains the current `OntologyGraph`, `OntoWorld`, and `Onto2DEngine` behavior after characterization. It may later use the kernel's `single-candidate` mode, but its public compatibility API remains separate.

### 6.5 `@onto2d/scientific-adapter`

Defines the import boundary for deterministic analytical or numerical results used by the foundational-paper case. It may integrate external tooling for action/stationarity residuals, boundedness, configurational density, nonlinear stability, or coupling measures, but the kernel receives only normalized quantities and content-addressed evidence.

The adapter MUST record a canonical request hash, solver/method version, normalized inputs, units, tolerances, convergence status, residual, and output hash. `failed` becomes dependent `indeterminate`. `partial` follows the frozen case policy and may be accepted only with a witnessed residual guard and tolerance widening. The adapter MUST NOT upgrade non-converged or missing work to a passing predicate value.

### 6.6 Research cases

Cases are versioned data packages, not hard-coded branches. Each case contains:

- primitives;
- ontology coordinates, axis provenance, phase order, and explicit depth-basis mapping;
- role and graph policy;
- predicates;
- functionals and coefficient sources;
- contested-resource cohort rules and selectors;
- sensitivity and indeterminate policies;
- oracle convergence/partial policy;
- scientific quantities and evidence records;
- profile definition;
- carrier-promotion policy where applicable;
- perturbations;
- complete run configuration;
- frozen prediction bound to a run hash;
- provenance for external data;
- expected conformance outcomes where appropriate.

## 7. Data migration and compatibility mapping

### 7.1 Fields that can be preserved directly

The following legacy data can be retained as metadata without changing meaning:

- `Id`, `Name`, `ShortDescription`, and `Description`;
- `Evidence` and `ScientificStatus`;
- dictionary codes and human-readable definitions;
- relation weights as annotated numeric values;
- catalogue source `Level` and `Phase` under names such as `catalogueLevel` and `cataloguePhase`.

`ScientificStatus: "methodological-placeholder"` MUST remain a non-empirical source status. The adapter may map it to `paper-assumption`, `package-operationalization`, or `unresolved` only through an explicit claim record; it MUST NOT map it to `computationally-verified` or `externally-supported` by default.

### 7.2 Fields requiring explicit semantic mapping

| Legacy field | Possible kernel target | Required decision |
|---|---|---|
| `Parents[].ParentCode` | typed source relation | Which frozen rule identifies it as generative, constitutive, intra-closure support, evidential, descriptive, or regulatory feedback? |
| `InteractionModes[]` | edge roles | Which modes participate in isomorphism and generation? |
| `CausalDirections[]` | edge direction/attributes | Does one relation create one directed edge, multiple edges, or metadata only? |
| `DependencyType` | role or predicate parameter | Is the dependency a label or an admissibility condition? |
| `OntologicalRole` | role namespace/profile slot | What polarity and capacity follow from it? |
| `Necessity` | required/advisory predicate | How do `necessary`, `enabling`, and other values affect verdicts? |
| `Weight` | invariant or comparison input | What tolerance and normalization policy applies? |
| `Requirements.MustCover` | coverage predicate | Is coverage evaluated on incoming structural edges, constituents, or profiles? |
| `Quantization` | invariant/profile capacity | Which carrier fields affect identity or only annotations? |
| `Level` | source metadata only by default | Never infer minimum derivation depth automatically |
| `Phase` | source metadata only by default | Never infer predicate phase automatically |

### 7.3 Foundational-paper mapping

| Paper concept | Kernel representation | External dependency |
|---|---|---|
| proto-field `Omega` | rule-package context/source claim | none until a computable field representation is declared |
| `partial_t`, `partial_x` | typed structural axes or primitive roles | analytical interpretation remains package-defined |
| oscillatory `psi` | primitive/element with typed `A`, `k`, `omega`, `m2` quantities | stationarity/boundedness evidence |
| pseudo-Euclidean `(1,1)` class | package geometry policy and claim | the kernel does not re-prove uniqueness |
| minimal action / `F` | candidate quantity plus cohort selector | external functional evaluation when not algebraic |
| coherent resonant triad | length-three simple cycle plus balance/rank/removal predicates | tolerances and rank definition |
| `Gamma` | derived quantity with support/measure metadata | integration/certificate method |
| CRT objecthood | boundedness, invariant concentration, and `stableUnder` conjunction | perturbation and identity policy |
| inter-node `V_ab` | role-labelled coupling edges and derived interaction quantities | potential/coupling family |
| ensemble-quantum | admitted collective element | non-additivity and collective-stability evidence |
| Level-1 carrier | explicit profile-backed promotion | effective-redescription claim and collapse evidence |
| joint arising in catalogue SCCs | condensed cluster element with undefined member order | exposure-declared edge classification and node-resolution evidence |

The complete rationale and missing inputs are in [FOUNDATIONAL_PAPER_ANALYSIS.md](./FOUNDATIONAL_PAPER_ANALYSIS.md).

The current Level-0 catalogue is substantially aligned with the paper, but conversion MUST preserve one known disagreement: catalogue records `0.7` (Configurational Density) and `0.8` (CRT-Node) are Phase C, while the paper derives `Gamma`, objecthood, and completion of Phase B before introducing Phase C. The adapter must emit both coordinates and a mapping warning until an ADR resolves the intended ontology. It must not rewrite the source `Phase` values.

Catalogue records `0.20` (Configurational Anisotropy), `0.22` (Directional Admissibility Gradient), and `0.23` (Localized Transport Bias) do not have sufficiently direct computational definitions in the supplied paper. They remain methodological catalogue claims until separate rules and evidence are supplied. Record `0.21` (Closure-Preserving Deformation) may inform perturbative persistence, but the perturbation class and tolerance are still missing.

### 7.4 Blind classification, node resolution, and condensation

The migration tooling has three access-separated passes:

1. **Policy pass:** reviewers freeze category decision questions, positive/negative examples, node-merge criteria, warning thresholds, and hashes. They may inspect the schema and representative records but not computed SCC membership.
2. **Blind annotation pass:** classifiers see endpoint cards and local relation fields, never cycle membership or the effect on topological order. Independent outputs and disagreements are frozen before adjudication.
3. **Unblinded resolution pass:** tooling computes typed SCCs; reviewers apply the already frozen distributed-structure/cluster criteria and record one disposition per component.

Node resolution MUST NOT use “does this merge make the graph acyclic?” as a criterion. SCC size and resemblance to the foundational paper are diagnostics only. Any post-unblinding relation-type change creates a new reviewed record linked to the original annotation; it is never overwritten.

The condensation artifact contains:

- raw-card to cluster mapping;
- complete internal member graph;
- inter-cluster generative edges;
- typed non-generative and absorbed-internal layers;
- `internalOrder: "undefined"` for every nontrivial cluster;
- cluster depth/member projections under one `depthBasis`;
- a proof-by-recomputation that the quotient is a DAG;
- count reconciliation showing that every source card and edge occurs exactly once.

Migration metrics include SCC counts and size histograms, classifier disagreement/exposure, each primary resolution, descriptive/nonformation resolution shares, post-unblinding changes, cluster count, member coverage, legacy-level spans, and constitutive-cluster density by transition. Warning thresholds identify possible fitting but do not automatically relabel data.

### 7.5 Loss report

Every adapter conversion MUST produce a machine-readable report:

```ts
interface AdapterLossReport {
  sourceHash: string;
  targetHash: string;
  mapped: { sourcePath: string; targetPath: string; rule: string }[];
  preservedAsMetadata: string[];
  omitted: { sourcePath: string; reason: string }[];
  warnings: { code: string; message: string; sourcePath?: string }[];
}
```

No source field may disappear silently. This report is separate from the document-level draft omissions report.

### 7.6 Compatibility facade

The root package should initially continue to support:

```js
const Onto2D = require("./onto2d.js");
const engine = new Onto2D.Onto2DEngine();
```

After packages are built, the root facade delegates these names to `@onto2d/legacy-runtime`. New closure APIs are exported from `@onto2d/kernel` and are not added to the old `Onto2DEngine` class unless a dedicated compatibility method is specified.

## 8. Delivery sequence

The sequence below preserves the draft milestones M0-M8 but moves a minimum reproducibility slice earlier because every later fixture depends on stable hashes. Within the kernel model it follows the addendum's dependency order: quantities/oracle semantics first, basis-aware axes second, and cohort ranking/sensitivity only after both foundations exist.

### Stage R0: repository bootstrap

Implementation status: the dependency-free workspace, lockfile, package boundaries, Node test/check/build commands, CI workflow, supported runtime declaration, ignore rules, README corrections, source locks, initial schemas, catalogue golden, and initial compatibility tests are present. Type-check/lint/format tooling, browser-path coverage, and successful execution in a Node-enabled environment remain before the gate is complete.

Deliverables:

- root package/workspace manifest and lockfile;
- TypeScript base configuration and build scripts;
- test, lint, type-check, and format commands;
- CI running the same commands from a clean checkout;
- supported-runtime declaration;
- corrected README commands;
- generated-output and run-artifact ignore rules.

Gate R0:

- a clean checkout installs and runs all declared commands;
- a trivial package import works in supported ESM and CommonJS paths;
- no legacy file has changed behavior.

### Stage R1 / M0: deterministic model and package loader

Implementation status: the first foundation now includes guarded canonical JSON, versioned hash domains, package defaults, schema-v1 structural/reference validation, explicit-profile normalization, primitive/profile identities, package/rules/depth-basis/identity-policy hashes, exact refinement/individualization canonicalization, bounded connected-skeleton enumeration, and canonical candidate deduplication. It has not been executed in this change. Candidate decoration, independent canonical/generator goldens, full expression typing, unit algebra/conversion, source-migration reconciliation, remaining schemas/results, and cross-platform execution are still required for the gates below.

Deliverables:

- core IDs and model types;
- JSON Schemas for primitives, condensed clusters, typed source relations, source migration, quantities, evidence, claims, predicates, functionals, cohort rules, selectors, oracle exchange, sensitivity, profiles, carrier promotion, run config, and results;
- distinct derivation-depth, basis-hash, ontology-coordinate, phase-order, and axis-provenance types;
- canonical scalar/JSON serializer;
- graph canonicalizer using refinement and individualization;
- domain-separated SHA-256 content addressing;
- package normalization, type checks, and stratification checks;
- unit algebra, mandatory-tolerance validation, quantity provenance, and identity-bearing-field policy;
- 30 or more isomorphic-pair conformance fixtures.

Gate R1:

- byte-identical canonical forms for every isomorphic pair;
- known negative pairs remain distinct;
- forbidden `referencesDepth: "self"` fails at load time;
- no paper/catalogue level or phase is inferred as derivation depth or predicate phase;
- phase precedence cycles and cross-basis depth comparisons fail validation;
- cluster members cannot carry independent depths, and an unreconciled source relation fails loading;
- repeated normalized input produces identical semantic hashes.

### Stage R2 / early M8: semantic manifest and artifact harness

Deliverables:

- semantic manifest separated from execution record;
- artifact hashing and integrity verification;
- source draft/addendum/PDF, classification policy/annotations, cluster partition, condensation, relation-layer, claim, evidence, method, depth-basis, functional, cohort-rule, selector, oracle-policy, and sensitivity hashes;
- deterministic fixture bundle writer;
- frozen prediction schema and append-only store interface.

Gate R2:

- timestamp changes do not change semantic artifacts;
- changing a predicate changes `rulesHash` and `runHash`;
- changing either Russian source, the foundational PDF, solver method/input/output, coefficient, cohort rule, epsilon, partial policy, or sensitivity policy changes the appropriate semantic hash;
- changing any source edge type, SCC disposition, cluster membership, or post-unblinding approval changes migration, depth-basis, and run hashes;
- a prediction for another run hash cannot be presented as matched.

### Stage R3 / M1: candidate generator

Implementation status: `GEN-01` now has a deliberately simple finite reference
enumerator for `n <= 6`, and the canonical store portion of `GEN-03` is present.
The count fixtures are authored but unexecuted. Multigraph decoration,
direction/role assignment, partial-candidate streaming, pruning, integrated run
budgets, functional isolation checks, and the benchmark remain pending, so R3
is not complete.

Deliverables:

- connected skeleton enumeration through six nodes;
- multigraph decoration policy;
- direction and role assignment;
- partial candidate representation;
- budget accounting and deterministic truncation;
- canonical deduplication.
- a generator dependency/capability check that makes functionals unreachable.

Gate R3:

- skeleton counts are `2, 6, 21, 112` for three through six nodes;
- hand-enumerated small candidate counts match;
- `maxCandidates` truncation visibly invalidates selectivity;
- attempted functional access from generator code fails conformance;
- benchmark fixture exists for four nodes and four roles.

### Stage R4 / M2: predicate analyzer and evaluator

Deliverables:

- typed expression IR;
- built-in structural predicates;
- projected cycle predicates with minimum/maximum length;
- unit-compatible arithmetic, balance, and comparison;
- complete three-valued truth tables and candidate-bucket aggregation;
- `minimal`, `novel`, `irreducibleRemoval`, and `stableUnder`;
- witness data types;
- static monotonicity rules;
- randomized monotonicity audit;
- expression/substructure evaluation cache.

Gate R4:

- at least three fixed cases per predicate/combinator;
- invalid operand types fail package loading;
- an indeterminate required predicate is never counted as eligible;
- intentionally false monotonicity metadata stops the run;
- pruning and non-pruning runs have identical final admitted sets on fixtures.

### Stage R5 / M3: filtering, census, and explanations

Deliverables:

- complete top-level evaluation without first-failure short circuit;
- local-eligibility verdict aggregation;
- four core cohort forms plus explicit global competition;
- finite-cohort `argmin`/`argmax`, complete ranking, unit-bearing epsilon, and retain-all extrema;
- degeneracy, degeneracy ratio, oriented gap, and two-dimensional selectivity;
- coefficient sensitivity sweeps and robust/fragile interpretation;
- separate filter/selection indeterminate buckets and thresholds;
- evidence and claim-state validation;
- overlapping and exclusive rejection census;
- inert and dominating predicate detection;
- explanation index spanning candidate witnesses, cluster members, and retained source-relation layers, with deterministic NDJSON output.

Gate R5:

- every rejected fixture names canonical graph witnesses;
- census totals reconcile with evaluated candidate counts;
- overlapping failures do not inflate exclusive-rejection totals;
- selector results are independent of candidate and worker order;
- all score-equivalent optima are retained;
- all-equal and singleton cohort semantics match the architecture;
- canonical tie ordering never removes a semantic extremum;
- `±10%` and `±25%` sweeps detect known robust and fragile fixtures;
- missing, non-converged, or unit-incompatible scientific evidence is indeterminate;
- explanations cannot be queried under a different rules or source-migration hash.

### Stage R6 / M4: profiles

Deliverables:

- profile definition schema;
- slot extraction, sorting, capacity normalization, and guard hashing;
- deterministic numerical precision policies;
- profile classes and representatives;
- `profile-quotient` generation input;
- profile-collapse command.
- collapse-error profile and `detectLevelBoundaries` command;
- explicit carrier-promotion artifacts.

Gate R6:

- equivalent normalized profiles hash equally;
- precision changes alter profile and run hashes;
- bounded exact and quotient fixtures agree after projection or emit a minimal counterexample.
- boundary reports compare computed minima with declared levels without mutating source labels.
- promotion preserves source identity and records source/target ontology coordinates.

### Stage R7 / M5: closure coordinator and ladders

Deliverables:

- full `closeLevel` state machine;
- `closeLadder` for multiple depths;
- explicit ontology-coordinate labels for every paper-derived transition;
- minimum-depth index and alternate derivation store;
- primitive depth-basis hashing and cross-run comparison guards;
- condensed-cluster vertices, inherited member depths, and undefined internal-order enforcement;
- opt-in bounded fixpoint with deterministic rounds;
- cancellation and terminal-state reporting.

Gate R7:

- a three-transition ladder terminates and reproduces semantic bytes;
- a shallower alternate derivation updates depth correctly;
- a changed primitive basis prevents pointwise depth comparison;
- every cluster member projects to exactly the cluster's depth and basis hash;
- fixpoint-disabled self-reference is rejected;
- fixpoint iteration exhaustion produces an indeterminate result.

### Stage R8 / M6: null models

Deliverables:

- role shuffle;
- role-aware directed degree-preserving rewiring;
- exact or honestly labelled approximate uniform sampling;
- independent deterministic random streams;
- distributions for Boolean and variational selectivity, z-scores, zero-variance handling, and reports;
- cohort/ranking/sensitivity reruns and evidence invalidation/recomputation policy per null trial;
- optional seeded cluster-label permutation for the pre-registered bottleneck-concentration statistic.

Gate R8:

- worker count does not change samples or statistics;
- a non-selective fixture is consistent with its null distribution;
- `sd = 0` never creates an infinite or `NaN` JSON value;
- invalid rewiring mixing is reported as indeterminate.
- null populations from different paper gates are not pooled.
- cluster-label permutation preserves frozen cluster sizes and never changes source-relation types.

### Stage R9 / M7: required cases

Deliverables:

- content lock for the foundational PDF;
- Phase A context/assumption package;
- Phase B oscillatory eligibility and finite variational-selection package;
- Phase B balanced-dyad versus coherent-triad package;
- Phase B/C CRT objecthood package;
- Phase C/D coupled-ensemble package;
- Level-1 carrier-promotion fixture;
- frozen exposure-declared classification, SCC disposition, condensation, and migration-metric bundle for all 249 catalogue records;
- Level-0 `{0.8,0.21,0.22}` joint-arising hypothesis report;
- thirteen directed three-node motifs package;
- frozen external dataset and methodology citation for motif ranking;
- case reports containing both selectivity dimensions, complete rankings, degeneracy, gaps, sensitivity, indeterminate ratios, census, baselines, and discrepancies.

Gate R9:

- predictions exist before result execution records;
- a balanced dyad is rejected by the declared composite triadic-closure condition;
- a closed triad is distinguishable from an object-qualified CRT-node;
- an uncoupled set of nodes is rejected as mere multiplicity;
- paper claims without required numerical definitions remain explicitly incomplete rather than receiving invented defaults;
- Level-0 variational cases return full cohorts with explicit degeneracy rather than one unexplained winner;
- every raw SCC and edge is preserved in one migration disposition/layer and the quotient DAG reproduces;
- constitutive-cluster density and bottleneck enrichment are reported without changing migration labels;
- motif graph conventions match the chosen publication;
- agreement and disagreement are both publishable terminal outcomes.

### Stage R10 / remaining M8: freeze workflow and release

Deliverables:

- user-facing command to freeze normalized rules and prediction;
- run command requiring or creating a semantic manifest;
- mismatch report between prediction and outcome;
- schema-versioning and release notes;
- compatibility package release for the legacy runtime.

Gate R10:

- any semantic rule edit invalidates the old run identity;
- a full case can be reproduced from its artifact bundle;
- root legacy imports still pass characterization tests;
- kernel package has no internal dependency on adapters or applications.

## 9. Work breakdown ready for issue creation

Each row is independently reviewable once its dependencies are complete.

| ID | Work item | Depends on | Primary evidence |
|---|---|---|---|
| BOOT-01 | Add workspace manifest, lockfile, build and test commands | None | clean-checkout CI |
| BOOT-02 | Add package export compatibility matrix | BOOT-01 | ESM/CJS import tests |
| LEG-01 | Characterize `OntologyGraph` public behavior | BOOT-01 | fixtures from current catalogue |
| LEG-02 | Characterize `OntoWorld` validation behavior | BOOT-01 | world relation fixtures |
| SOURCE-01 | Lock and verify foundational PDF identity | BOOT-01 | page count and SHA-256 fixture |
| SOURCE-02 | Preserve and lock the reviewed Russian kernel draft | BOOT-01 | 403-line source and SHA-256 fixture |
| SOURCE-03 | Preserve and lock the priority Russian selection/quantity addendum | BOOT-01 | 345-line source and SHA-256 fixture |
| DATA-01 | Reproduce catalogue structural audit in tests | BOOT-01, LEG-01 | 249-node audit golden |
| DATA-02 | Resolve weight and `MustCover` semantics without silent rewrites | DATA-01, ADAPT-01 | reviewed ADR and migration report |
| DATA-03 | Freeze relation rules and run independent eligible classification with exposure declarations | DATA-01, ADAPT-01, MODEL-04 | policy hash, annotations, exposure/disagreement/adjudication report |
| DATA-04 | Adjudicate distributed structures and condense every typed formation SCC | DATA-03, MODEL-04, HASH-01 | cluster/member mapping, quotient DAG, edge reconciliation |
| DATA-05 | Emit migration fitting-risk and SCC disposition metrics | DATA-04 | resolution shares, size histograms, threshold warnings |
| MODEL-01 | Define kernel types and JSON Schemas | BOOT-01 | schema/type parity test |
| MODEL-02 | Add quantities, claims, evidence, ontology coordinates, and promotions | MODEL-01, SOURCE-01, SOURCE-03 | invalid unit/state/coordinate cases |
| MODEL-03 | Add basis hashes, phase partial orders, and axis provenance | MODEL-01, SOURCE-03 | unequal-basis and phase-cycle fixtures |
| MODEL-04 | Add typed source relations, cluster provenance, and member projections | MODEL-01, MODEL-03 | cluster schema and invalid-depth fixtures |
| QUANT-01 | Implement unit parsing/algebra, mandatory tolerances, and tolerant comparisons | MODEL-02 | incompatible-unit and boundary fixtures |
| CANON-01 | Implement canonical scalar serialization | MODEL-01 | golden byte fixtures |
| CANON-02 | Implement graph refinement and individualization | CANON-01 | isomorphic-pair suite |
| HASH-01 | Add domain-separated content hashes | CANON-01 | hash golden fixtures |
| LOAD-01 | Normalize packages and materialize defaults | MODEL-01, HASH-01 | normalized package snapshots |
| LOAD-02 | Add expression type and stratification analysis | LOAD-01 | invalid-package cases |
| EVID-01 | Validate source/method/input/output evidence chains | MODEL-02, HASH-01 | tampered and missing evidence fixtures |
| ORACLE-01 | Implement canonical oracle requests/responses, cache keys, and partial policy | QUANT-01, EVID-01, HASH-01 | converged/partial/failed mock fixtures |
| ART-01 | Separate semantic manifest and execution record | HASH-01, LOAD-01 | reproducibility fixture |
| GEN-01 | Enumerate connected skeletons | CANON-02 | reference counts |
| GEN-02 | Decorate directions, roles, multiplicity and node refs | GEN-01 | hand counts |
| GEN-03 | Add budgets, streaming and deduplication | GEN-02 | truncation cases |
| PRED-01 | Implement built-in structural predicates | LOAD-02 | conformance matrix |
| PRED-01A | Add projected cycle length and unit-compatible numeric semantics | PRED-01, QUANT-01 | dyad/triad and unit fixtures |
| PRED-02 | Implement boolean and structural combinators | PRED-01 | substructure cases |
| PRED-03 | Implement perturbation registry and stability | PRED-01 | seeded perturbation cases |
| MONO-01 | Add static monotonicity derivation | PRED-01 | positive/negative inference cases |
| MONO-02 | Add randomized audit and pruning gate | MONO-01, GEN-03 | corrupted assertion case |
| FILTER-01 | Evaluate all predicates and aggregate verdict | PRED-02 | full evaluation trace |
| FUNC-01 | Implement typed functional registry isolated from generator capabilities | LOAD-02, QUANT-01 | forbidden-generator-access fixture |
| COHORT-01 | Implement shared-support, profile-role, invariant-window, singleton, and global partitions | FILTER-01, FUNC-01 | partition and transitivity goldens |
| SELECT-01 | Implement complete finite-cohort `argmin`/`argmax` rankings | COHORT-01, ORACLE-01 | ordered/shuffled cohort goldens |
| SELECT-02 | Implement epsilon extrema, degeneracy, gap, and selector explanations | SELECT-01, EVID-01 | equal/near-equal/singleton/missing score cases |
| SELECT-03 | Implement coefficient sensitivity and robust/fragile verdicts | SELECT-02 | ±10%/±25% stability fixtures |
| REPORT-01 | Implement Boolean/variational selectivity and indeterminate reconciliation | FILTER-01, SELECT-03 | denominator and bucket goldens |
| CENSUS-01 | Add total/exclusive census and flags | FILTER-01 | reconciliation cases |
| EXPLAIN-01 | Add canonical witnesses plus candidate/cluster/source-layer explanation index | FILTER-01, MODEL-04 | witness and retained-edge snapshots |
| PROFILE-01 | Normalize and hash profiles | MODEL-01, HASH-01 | profile golden fixtures |
| PROFILE-02 | Form classes and quotient candidates | PROFILE-01, GEN-03 | class fixtures |
| PROFILE-03 | Implement collapse comparison | PROFILE-02, FILTER-01 | counterexample report fixture |
| BOUNDARY-01 | Implement collapse-error profiles and level-boundary comparison | PROFILE-03, MODEL-03 | declared/computed mismatch table |
| PROMOTE-01 | Add profile-backed carrier promotion | PROFILE-03, MODEL-02 | Level-0-to-Level-1 promotion fixture |
| CLOSE-01 | Implement `closeLevel` coordinator | GEN-03, SELECT-03, REPORT-01, PROFILE-02, ART-01 | state transition tests |
| CLOSE-02 | Implement minimum-depth ladder | CLOSE-01 | three-depth fixture |
| FIX-01 | Implement bounded fixpoint | CLOSE-02 | convergence/limit cases |
| NULL-01 | Implement deterministic random stream derivation | HASH-01 | stable stream vectors |
| NULL-02 | Implement role shuffle | NULL-01, CLOSE-01 | invariant cases |
| NULL-03 | Implement degree-preserving rewire | NULL-01, CLOSE-01 | degree invariants/mixing report |
| NULL-04 | Implement uniform candidate sampling | NULL-01, GEN-03 | distribution tests |
| STATS-01 | Add baseline statistics | NULL-02, NULL-03, NULL-04 | zero-variance and known vectors |
| STATS-02 | Add constitutive-cluster density, bottleneck enrichment, and permutation baseline | DATA-05, REPORT-01, STATS-01 | concentrated/uniform/depleted fixtures |
| SCI-01 | Define scientific-adapter evidence protocol | ORACLE-01 | converged/partial/failed mock solver fixtures |
| CASE-01A | Encode Phase A context and oscillatory gate | CLOSE-02, SCI-01 | frozen incomplete/complete case states |
| CASE-01B | Encode balanced dyad versus coherent triad | PRED-01A, CLOSE-02, EXPLAIN-01 | frozen triadic-closure report |
| CASE-01C | Encode CRT objecthood gate | PRED-03, SCI-01, CLOSE-02 | boundedness/Gamma/persistence report |
| CASE-01D | Test the Level-0 catalogue SCC joint-arising hypothesis without outcome-driven relabelling | DATA-04, STATS-02, SOURCE-01 | `{0.8,0.21,0.22}` disposition and concentration report |
| CASE-02 | Encode Phase C-to-D ensemble | SELECT-02, SCI-01, CLOSE-02 | coupled/uncoupled ensemble report |
| CASE-02A | Encode Level-1 carrier promotion | CASE-02, PROMOTE-01 | promotion and collapse report |
| CASE-03 | Select and encode motif reference | STATS-01 | source/protocol review |
| FREEZE-01 | Freeze package and prediction command | ART-01 | append-only workflow test |
| ADAPT-01 | Map legacy catalogue to candidate/predicate package | LEG-01, MODEL-01 | adapter loss report |
| ADAPT-02 | Reconcile paper coordinates with all 24 Level-0 catalogue records | ADAPT-01, SOURCE-01, MODEL-02 | complete crosswalk and Phase B/C mismatch fixture |
| LEG-03 | Move legacy runtime behind package facade | LEG-01, LEG-02, BOOT-02 | unchanged compatibility tests |
| BENCH-01 | Establish reference performance environment | GEN-03, CLOSE-01 | n4 benchmark artifact |

## 10. Testing strategy

### 10.1 Unit tests

Use unit tests for relation-category rules, blind-view enforcement, SCC discovery/condensation, node-resolution validation, migration metrics, cluster depth inheritance, unit parsing/algebra, quantity normalization, tolerance comparisons, phase partial orders, basis guards, evidence states, oracle convergence policies, serializers, complete expression truth tables, individual predicates, cohort partitions, rankings, degeneracy/gap formulas, sensitivity verdicts, budget counters, statistical functions, and error codes.

### 10.2 Golden conformance tests

Version classification policy/annotations, SCC dispositions, condensation and edge-reconciliation artifacts, canonical bytes, hashes, normalized packages, witnesses, and semantic result artifacts as reviewed goldens. Execution timestamps and platform data are excluded from goldens.

### 10.3 Property tests

Generate bounded graphs and assert:

- arbitrary node permutations retain canonical bytes;
- source input order does not change classified-layer serialization, SCC membership, or condensation IDs;
- member/internal-edge permutations do not change cluster element IDs;
- every source edge appears exactly once after migration;
- every condensation quotient is acyclic;
- every cluster member inherits the cluster depth and basis;
- a canonical form is idempotent;
- canonical deduplication is independent of input order;
- admitted sets match with pruning enabled and disabled;
- generator outputs are identical regardless of functional definitions because functionals are inaccessible until ranking;
- cohort partitions are total, disjoint, and independent of input order;
- selector results and tie sets do not depend on candidate order;
- coefficient sweeps reproduce independently of worker scheduling;
- profile member order does not change profile classes;
- seeded randomized outputs do not change with worker scheduling.

### 10.4 Differential tests

For small universes, compare optimized components with deliberately simple reference implementations:

- skeleton enumeration versus brute-force labelled enumeration projected through canonicalization;
- pruned decoration versus exhaustive decoration;
- profile quotient versus exact element enumeration;
- cached predicate evaluation versus uncached evaluation.
- optimized cohort selection versus a sorted reference implementation;
- optimized sensitivity reports versus an explicit perturb-and-rerank reference;
- optimized SCC/condensation output versus a simple reference implementation;
- migration metric summaries versus direct count reconciliation;

### 10.5 Characterization tests

Before moving `onto2d.js`, capture its public outputs for:

- a valid catalogue;
- missing parents and unknown dictionary IDs;
- weight-sum warnings;
- required dependency coverage;
- allowed and disallowed world relations;
- body requirement warnings;
- serialization and destructive body operations.

### 10.6 Benchmarks

The reference benchmark records:

- hardware and runtime build;
- normalized rules and run hash;
- raw, canonical, pruned, and evaluated counts;
- time per pipeline stage;
- peak resident memory;
- cache hit rates;
- worker count.

The mandatory ceiling is 60 seconds for the declared four-node, four-role case. Ten seconds remains the generator optimization target from M1.

### 10.7 Foundational-paper traceability tests

The paper/addendum case additionally asserts:

- source artifact hash and page count are unchanged;
- both Russian source hashes and line counts are unchanged;
- every Level-0 catalogue record has a mapped, metadata-only, or unresolved disposition;
- catalogue `0.7`/`0.8` preserve Phase C while their paper mapping records the Phase B discrepancy;
- relation policy, classifier exposure declarations, and prospective-blind/deterministic annotations are frozen before SCC membership is exposed;
- the `{0.8,0.21,0.22}` component receives a reviewed cluster/layer disposition without being forced to match the paper triad;
- all three nontrivial SCCs preserve every member and edge through merge, condensation, or typed nonformation layers;
- cluster members share depth while retaining undefined internal precedence;
- descriptive and post-unblinding resolution shares remain explicit fitting-risk metrics;
- ontology level/phase labels do not alter derivation-depth calculations;
- depth comparisons require equal basis hashes, and every report names its aggregation axis;
- level-boundary detection reports mismatch rather than rewriting declared labels;
- a reciprocal two-node directed relation is not a simple length-three loop;
- balance alone does not qualify a dyad as a CRT;
- a closed triad without boundedness, `Gamma`, or persistence evidence is not promoted to an object-like node;
- an uncoupled node set is not an ensemble-quantum;
- carrier promotion never mutates its source element;
- an all-equal cohort retains all members with zero variational selectivity;
- canonical tie order does not collapse semantic degeneracy;
- fragile coefficient fixtures invalidate variational interpretation but preserve raw ranking;
- failed oracle work is indeterminate, and partial work follows the frozen policy;
- a changed solver method/input/output, coefficient, cohort rule, epsilon, or partial policy invalidates the old run hash.

## 11. Continuous integration gates

Every change to the kernel should run:

1. schema/type consistency;
2. formatting and static checks;
3. unit tests;
4. canonical, predicate, selector, quantity, and evidence conformance tests;
5. legacy characterization tests;
6. deterministic artifact reproduction using at least two worker counts;
7. small differential/property suites;
8. dependency-direction check ensuring the kernel imports no Onto2D adapter/application package.
9. foundational-paper plus Russian draft/addendum source locks and traceability matrix checks.
10. source-classification blindness, edge conservation, condensation, and migration-metric conformance.

Long motif baselines and the full benchmark may run on a scheduled or release workflow, but their frozen configurations remain versioned.

## 12. Versioning policy

Version independently:

- kernel package API;
- each serialized schema;
- canonicalization algorithm;
- expression language;
- selector language and tie semantics;
- quantity/unit and evidence schemas;
- external scientific method protocols;
- ontology-coordinate and carrier-promotion schemas;
- source-relation, cluster-provenance, condensation, and migration-metric schemas;
- rule packages;
- foundational source artifacts;
- research datasets.

A change that can alter candidate identity, admissibility, profile equality, selectivity denominator, random population, or numeric output MUST change the semantic version/hash inputs. A reader-only migration may preserve old artifacts, but rewritten artifacts receive new hashes.

## 13. Main risks and controls

| Risk | Consequence | Control |
|---|---|---|
| Incorrect monotonicity assertion | Silent loss of valid candidates | static inference, randomized audit, exhaustive differential fixtures, pruning-off mode |
| Incomplete canonicalizer | duplicates or false collisions | permutation properties, negative pairs, reference brute force for `n <= 6` |
| Profile abstraction too coarse | false interchangeability | exact collapse tests and counterexample preservation |
| Quotient/exact denominator confusion | invalid selectivity comparisons | mandatory counting-domain field and projection semantics |
| Timestamp or host data in semantic bytes | irreproducible runs | split manifests and golden artifacts |
| Null model is not actually uniform or mixed | misleading z-score | algorithm disclosure, invariants, mixing/effective-sample diagnostics |
| Legacy field conflation | distorted scientific meaning | explicit mapping rules and loss reports |
| Existing weight/coverage warnings normalized automatically | altered source theory without review | golden audit, source-preserving adapter, explicit ADR |
| Raw catalogue cycles treated as ordered derivation | circular precedence claim | blind typing, cluster condensation, one shared depth, undefined internal order |
| Cycle-closing edges relabelled after SCC inspection | acyclicity is fitted rather than discovered | frozen rules, access-separated blind annotation, immutable post-unblinding changes |
| Cards merged only because a merge removes a cycle | distinct concepts erased | predeclared node-resolution criteria and negative merge fixtures |
| Source edges dropped during condensation | explanation and scientific provenance lost | exact edge reconciliation and typed retained layers |
| Level-0 SCC forced to imitate the paper triad | category error and confirmation bias | preregister analogy as hypothesis; blind general protocol decides disposition |
| Cluster bottlenecks defined after cluster locations are known | circular enrichment result | freeze bottleneck definition from selectivity before unblinding cluster distribution |
| Paper/catalogue Phase B–C mismatch hidden | apparently consistent but false provenance | dual coordinates, mapping warning, ADR, unchanged source data |
| Ontology phase conflated with derivation depth | invalid selectivity ladder | separate types, explicit mapping, traceability tests |
| Depth compared across different primitive bases | false cross-run ladder conclusions | mandatory basis hash and comparison guard |
| Boolean filtering used in place of variational selection | paper's central selection principle is absent | explicit cohort/rank stages and ordered/tie fixtures |
| Functional leaks into generation | silent loss of candidates before cohort completion | capability-separated evaluator, dependency check, pruning differential test |
| Global competition used implicitly | ontology collapses to one line | explicit hashed contested-resource rule; no global default |
| Non-transitive window cohorting | overlapping/order-dependent cohorts | anchored half-open bins and partition conformance |
| Canonical tie-break treated as scientific winner | hidden loss of degeneracy | retain-all extrema; ID only orders presentation |
| Free coefficients tuned post hoc | unfalsifiable ranking | frozen coefficients, mandatory sensitivity, fragile verdict |
| One-dimensional ratio hides broad minima | false interpretation of Phase D variability | Boolean/variational profile plus degeneracy and gaps |
| Graph engine presented as a PDE solver | unsupported physical claims | external scientific adapter and evidence states |
| Untyped `k`, `omega`, mass, or action values | invalid arithmetic and silent unit mismatch | quantities with units, tolerances, and semantic definitions |
| Solver failure treated as scientific rejection | numerical failure changes ontology silently | separate indeterminate bucket and oracle convergence policy |
| Partial convergence accepted implicitly | unbounded tolerance drift | hashed residual guard and tolerance multiplier |
| Directed dyad accepted as a triadic loop | false CRT admission | simple projection plus minimum cycle length three |
| Triad closure equated with objecthood | premature carrier promotion | separate boundedness, `Gamma`, and persistence gate |
| Uncoupled nodes accepted as collective regime | mere multiplicity reported as emergence | novelty/non-additivity/coupling negative fixtures |
| Source paper or solver result changes silently | irreproducible theory case | source/evidence hashes in semantic manifest |
| Exponential substructure combinators | runaway time/memory | hard budgets, caching, bounded candidate size, cancellation |
| README/build drift reintroduced later | onboarding failure | executable documentation checks and command updates in the same change |
| External motif comparison under-specified | invalid external validation | freeze one dataset, graph conventions, preprocessing, metric, and prediction |
| Floating-point instability | profile/hash drift | named decimal precision and summation policies |
| Large artifacts | memory/storage pressure | streaming deterministic NDJSON and artifact references |

## 14. Decisions that must be frozen in Stage R0-R1

The architecture supplies defaults, but the following implementation choices require short ADRs before their first release:

- exact canonical number encoding and precision library/policy;
- canonicalizer algorithm version and negative fixture set;
- supported runtime/module formats and reference benchmark platform;
- JSON Schema draft used for new kernel schemas;
- exact graph extension operations used by monotonicity analysis;
- paper/catalogue ontology-coordinate mapping and identity-bearing fields;
- unit system, tolerance composition, quantity provenance, and evidence-state transition rules;
- exact depth-basis contents, phase partial order, and axis-reporting rules;
- source-relation category questions/examples and which local fields classifiers may see;
- classifier eligibility/exposure declarations, blind annotation, disagreement adjudication, access logging, and unblinding protocol;
- distributed-structure/constitutive/unresolved cluster criteria and negative merge fixtures;
- post-unblinding change approval plus descriptive/disagreement/fitting-risk thresholds;
- constitutive-cluster density, bottleneck definition, enrichment statistic, and permutation baseline;
- contested-resource cohort rule for each gate, including support-incidence and invariant-bin semantics;
- functional definitions, theoretical source of coefficients, unit-bearing epsilon, and retain-all semantics;
- sensitivity coefficient subset, one-at-a-time/Cartesian mode, top-k, budgets, and robustness thresholds;
- external oracle/certificate protocol, convergence status, partial policy, residual guard, and tolerance widening;
- level-boundary search intervals, collapse-error threshold, and tie policy;
- simple-cycle projection used by the CRT case;
- support measure, `Gamma`, perturbation, and identity policies for objecthood;
- bounded coupling, non-additivity, and effective-redescription policies for ensembles;
- default substructure policy;
- uniform sampler guarantee and fallback naming;
- artifact storage interface and maximum retained candidate explanation volume;
- frozen prediction authorship/signature policy;
- legacy package export and deprecation schedule.

No scientific case should be frozen until these decisions affect its run hash correctly.

## 15. Definition of ready for implementation

The refactor is ready to begin when:

- the architecture, foundational-paper analysis, and omissions/deviations documents are reviewed;
- the counting-domain and graph policies are accepted;
- current catalogue files are backed by hashes and remain unchanged;
- the foundational PDF hash and evidence status are accepted;
- both reviewed Russian source hashes are accepted and their absolute Downloads paths are not project dependencies;
- the 249-node catalogue audit is frozen as a golden, including weight, coverage, and SCC findings;
- source-relation and node-resolution ADRs are frozen before any migration annotator receives SCC-aware output;
- the supported runtime can be installed in the execution environment;
- issue IDs from the work breakdown are created or adopted;
- R0 has an owner and a clean-checkout acceptance command.

## 16. Definition of kernel completion

The kernel refactor is complete only when:

- stages R0 through R10 pass their gates;
- both mandatory research cases have frozen pre-run predictions;
- at least three explicitly paper-labelled closure transitions have valid, non-truncated selectivity values;
- cohort construction, complete ranking, degeneracy, and sensitivity are implemented and rerun inside null trials;
- Boolean and variational selectivity plus indeterminate ratios reconcile exactly;
- every depth result carries a basis hash and boundary detection preserves declared labels;
- all 249 catalogue cards and every parent relation reconcile through frozen exposure-declared classification, cluster condensation, or typed retained layers;
- every nontrivial source SCC has an explicit disposition, the quotient is a DAG, and cluster members share depth without internal precedence;
- migration fitting-risk metrics and constitutive-cluster concentration are reported without post-hoc label changes;
- missing continuous scientific inputs remain visible until a reviewed adapter supplies evidence;
- balanced dyad, closure-only triad, object-qualified CRT-node, uncoupled node set, and coupled ensemble are distinct fixtures;
- Level-1 carrier promotion is explicit and profile-backed;
- profile collapse has either passed on the bounded case or published a precise counterexample;
- the four-node/four-role reference run is byte-reproducible and within 60 seconds;
- the motif result is compared with the frozen external reference without changing the associated rules hash;
- legacy compatibility tests pass or a separately approved breaking release documents every removed behavior;
- the README distinguishes current shipped behavior from target/research behavior accurately.

## 17. Bootstrap slice disposition and immediate next implementation slice

The scoped bootstrap slice has now been laid out: workspace files, public kernel contracts, source locks, initial quantity/evidence/oracle/basis/source-relation/cluster/functional/cohort/selector/sensitivity schemas, policy ADR templates, legacy characterization tests, catalogue audit golden, clean-checkout CI configuration, and README commands are present. Catalogue data was not moved, scientific predicates were not fabricated, and the legacy public API remains the compatibility source.

The first R1 package/graph identity foundations and the bounded R3 skeleton/store slice have now been authored under an explicit no-execution instruction. Before adding decoration, predicate, selection, or closure semantics, run every declared command in a Node.js 20+ environment and correct any platform, lockfile, schema/type, or conformance issue found. Then complete the remaining R0/R1 evidence:

1. add browser-path characterization for the UMD facade;
2. add schema/type parity, lint, and formatting automation under an explicit tooling decision;
3. expand legacy negative and catalogue fixtures without changing source data;
4. execute and independently review the proposed canonical-number,
   identity-field, and graph-labeling ADR fixtures;
5. define result schemas and additional invalid cross-record fixtures;
6. mark R0 complete only after clean-checkout CI and local supported-runtime execution pass.

Relation annotation, SCC resolution, scientific predicates, and candidate closure begin only after their prerequisite policies and fixtures are frozen.
