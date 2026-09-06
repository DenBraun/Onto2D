# Analysis of the revised Structural Geometry program

Date: 2026-09-06. Scope: documentation, migration planning and baseline capture.

## Decision and source authority

The user's request is to analyze the supplied plan, update documentation and
prepare subsequent development. It does not request implementation of the new
comparison API or the website in this revision.

The [supplied document](proposals/ONTO2D_STRUCTURAL_GEOMETRY_SITE_IMPLEMENTATION.md)
is preserved byte for byte, including its provisional examples and bibliography.
SHA-256: `ea61e9b89e668a2292a33b397e590b7bb446ab7f976949e6c966f94b1fa4cea1`.
Its 51 sections were reviewed against the repository. Instructions inside that
document are proposed requirements to assess, not independent authorization to
change code, publish a page, or reinterpret existing scientific results.

The [revised roadmap](REVISED_ROADMAP.md), [design decisions](DISTINGUISHABILITY_DESIGN.md)
and [ADR 0130](../adr/0130-distinguishability-research-program.md) record the adopted
continuation. They supersede the old *remaining implementation order*, while
the existing versioned projection, metric, curvature and flow contracts remain
valid. Both original proposals remain archival inputs. No previous website-only
file with the new attachment's name existed in this checkout; its supersession
statement is therefore not evidence of an earlier implemented page.

## Main architectural change

The implemented path measures geometry inside one graph. The new path compares
structures through explicitly allowed observations and controlled responses.
These are separate mathematical objects:

```text
within a graph:    projection -> lengths -> curvature -> flow
between objects:  regime -> observations/probes -> signature -> comparison
```

The revised order keeps the completed work and inserts metric providers,
distinguishability, probes and a response-only comparison baseline before
persistence and cross-domain work. Geometry must then be evaluated for added
value over that response baseline. Failure to add useful information is a valid
research outcome; it does not invalidate correctly computed curvature.

## Implementation audit

| Existing work | Evidence | Revision disposition |
|---|---|---|
| Full source-parent projection and unit Forman | 16 synthetic controls, independent incidence reference, 249-node/971-edge source artifact | Preserve policy IDs, source bindings, values and hashes |
| Typed/local-weight experiments | 72 runs, full-source weight audit, exact rational lengths and outward radical bounds | Wrap existing operations; retain selection/context and numeric semantics |
| Directed Ollivier | 40 runs / 242 edge calculations, external NetworkX, exact certificates | Preserve bounded unit API and cache identity |
| Normalized flow | 11 runs / 68 states / 1089 edge calculations, published `G(3,2)` recurrence | Existing bounded runner is complete; preserve every stored state and stopping reason |
| Flow failure behavior | Closed input, process, numeric and resource errors; no partial success; separate fixed/cycle/tolerance/cap/degeneracy records | Document existing error API instead of replacing it with a boolean |
| New flow control list | Path, cycle, clique, diamond, asymmetric graphs and three-group published example exist | Add dedicated inward/outward-star and two-cluster single-bridge flow controls before declaring the expanded R1 gate complete |
| Provider/regime/probe/signature/comparison APIs | No such public implementation exists | Planned work, not implied by current schemas or browser verification |
| Public Structural Geometry Lab | No result-bearing page implemented | Preserve as a gated future task |

The source-specific flow examples each stop after six transformations. They are
not full-model runs or evidence of convergence. The exact rational reference's
64-node/64-edge/24-step and digit/history bounds remain in force.

## Corrections needed before implementation

1. **Pseudometric domain.** A mean over the components available for each pair
   need not obey the triangle inequality. R6 will use a fixed component set,
   fixed weights and fixed normalization on a common complete domain. Partial
   comparisons are exploratory diagnostics, not certified pseudometric values.
2. **Status versus proximity.** The supplied comparison example combines
   distance `0.17` with `indistinguishable-under-regime`. For the exact v0
   signature policy, zero is indistinguishability, positive is distinguishability,
   and missing mandatory observations give `indeterminate`. A later closeness
   threshold is a separate calibrated claim and does not define equivalence.
3. **Canonical identity versus observation equivalence.** Current source and
   artifact hashes intentionally change when source IDs or annotations change.
   Invariant descriptors must be separated from provenance. Model Pack canonical
   serialization is not general unlabeled graph isomorphism; the existing kernel
   candidate canonicalizer also has its own representation contract.
4. **Metric provider output.** A necessity filtration or multiplex view is not
   an edge-length assignment by itself. Provider capabilities must distinguish
   metric values, filtrations and channels. Preserve the actual
   `inverse-target-share-v1` name and full-source normalization; the draft's
   `declared-weight-v1` is a proposed family label, not a silent policy rename.
5. **Numeric compatibility.** The draft `Float64Array` flow is conceptual. The
   existing rational lengths/certificates and interval Forman values remain
   authoritative. A future approximate backend requires its own numeric policy.
6. **Source semantics.** Retain `source-parent-directed-v1`, not the draft
   `causal-directed-v1` or the phrase “reviewed source-parent relations”.
   Integrity verification does not confer reviewed causal status.
7. **Schema/API compatibility.** Draft numeric `schemaVersion: 2`, renamed
   fields and `structural-geometry-analysis` directory are sketches. Keep the
   actual `@onto2d/structural-geometry` package and all existing closed v1
   artifacts. Add separate versioned envelopes/artifacts for new capabilities.
8. **Probe semantics.** Deleting an edge measures a graph response. It does not
   automatically establish physical intervention, kernel inadmissibility or
   changed Canonical Identity. Such outcomes require an explicit compatible
   analysis and evidence binding; otherwise they are unavailable.
9. **Invariance scope.** Chain subdivision, transparent-node collapse and small
   metric perturbation are not universal invariances. Source-ID ordering must
   not choose an arbitrary edge from a symmetric class. Use reviewed abstraction
   rules and invariant target groups; keep sensitivity tests separate from exact
   invariance tests.
10. **No circular metric.** `response-derived-v1` is later research. Graph-only
    responses must be frozen independently before deriving local lengths.
    Inter-object zero distances do not automatically define positive graph edge
    lengths; zero handling needs a separate mathematical policy.
11. **Website gates.** Section 38 allows an earlier method-under-test page, while
    R12 follows the blinded benchmark. The adopted plan distinguishes those
    scopes: full result-bearing comparison follows R11; a separately scoped
    method page may show actual R0–R7 results, including negative results, with
    no invented similarity or cross-domain success claim.
12. **Baseline completeness.** Existing flow is not unfinished merely because
    the draft says it is. R0 now identifies the current working tree and frozen
    outputs. R1 retains completed computation and explicitly tracks the added
    star/single-bridge control coverage rather than claiming it already exists.

## Coverage of all supplied sections

| Supplied sections | Adopted location and treatment |
|---|---|
| 1–2 | Two geometry layers and revised order in the roadmap/design |
| 3–4 | Distinguishability as an analytical proposal; vision as analogy, with source caveat below |
| 5 | Corrected and bounded research anchors below |
| 6–7 | Immutable/kernel boundaries, baseline inventory and provider migration |
| 8–10 | Regime, tri-state/missingness rules and separate probe families in the design |
| 11–13 | Layered signatures, fixed-domain pseudometric and partial-data correction |
| 14 | Reuse Identity, Motifs and History contracts; no automatic semantics transfer |
| 15–18 | Preserve current computation; supplement R1 controls; R2–R6 become next work |
| 19–21 | Geometry-added-value gate; persistence/higher-order move to R8/R9 |
| 22–27 | Four independently sourced candidate domains in R10 and website plan; diagrams are illustrative |
| 28–30 | Revised controls, strong baselines and H0–H8 in the benchmark protocol |
| 31–35 | Additive artifacts, same package, opt-in engine integration and external numerics |
| 36–37 | R0–R12 and every SG2/SGWEB2 task in the operative task ledger |
| 38–46 | Explicit website readiness, foundation strip, regime selector, interaction and claim rules |
| 47–49 | Shared artifact dependencies without a circular metric or premature topology task |
| 50–51 | Bibliography corrections, archival source hashes and supersession recorded here |

## Research anchors checked

These sources motivate methods; none validates Onto2D's catalogue or proves that
the proposed comparisons capture a common mechanism. Summaries here describe
the relevant precedent, not a replication of its scientific findings.

| Anchor | Check and usable role |
|---|---|
| Behavioural pseudometric, TCS 331(1), 2005, 115–142 | The authors are **Franck van Breugel and James Worrell**, not Desharnais et al.; see [Worrell's publication record](https://www.cs.ox.ac.uk/james.worrell/publications.html) and [author manuscript](https://www.cse.yorku.ca/~franck/research/drafts/pseudometric.pdf). The attachment associates DOI `10.1016/j.tcs.2004.09.035` with this title. Its probabilistic-transition semantics are a precedent, not the deterministic Onto2D response model. |
| Amari, Information Geometry, 2021 | [Author institution record](https://pure.teikyo.jp/ja/publications/information-geometry/) confirms the article and DOI `10.1111/insr.12464`; its setting is a family of probability distributions. Fisher–Rao is not selected as the current deterministic graph metric. |
| Nielsen, An Elementary Introduction to Information Geometry, 2020 | [Publisher article](https://www.mdpi.com/1099-4300/22/10/1100), DOI `10.3390/e22101100`, provides the statistical-manifold context. Use only when a future analysis actually supplies a probability model. |
| Ni et al., network Ricci flow, 2019 | [Publisher article](https://www.nature.com/articles/s41598-019-46380-9) and existing exact `G(3,2)` reproduction support the bounded intra-graph computational gate; no general directed convergence is inferred. |
| Jeong et al., GeOKG, 2025 | [Publisher article](https://academic.oup.com/bioinformatics/article/41/4/btaf160/8111648) includes a Forman analysis of Gene Ontology and mixed-space embeddings. It does not validate Onto2D's flow, response pseudometric or source semantics. |
| Bailey, 2026 | [arXiv manuscript](https://arxiv.org/pdf/2603.25760) is a representation/topology review used as context. It is not an independent review of Onto2D. |

The source catalogue does describe `0.0` as Field Distinguishability and `0.1` /
`0.2` as temporal/spatial distinctions. It also contains the proto-field `0.15`
as an explicit predecessor; “begins with 0.0” is an explanatory excerpt, not the
complete Level-0 dependency graph. See the [preserved catalogue](../../references/level-0.json)
and [foundational analysis](../FOUNDATIONAL_PAPER_ANALYSIS.md). Those records call
the construction methodological; no empirical physical law follows.

“How Vision Becomes Spatial” has no author, edition, URL or source artifact in
the attachment or current repository. The future site may retain a clearly
labeled explanatory analogy, but attribution or evidence-dependent copy must
wait for an identifiable source. No guessed article is adopted.

## Preparation result

The [baseline record](BASELINE.md) pins current scientific outputs, policies,
implementation files and the existing test census before a provider retrofit.
At the time of this documentation revision, the next task was the added R1
control coverage. That [supplement is now complete](FLOW_CONTROLS_REVIEW.md);
SG2-005 [provider wrappers are also implemented](METRIC_PROVIDER_REVIEW.md).
SG2-010 [regime contracts and preparation](REGIME_CONTRACT_REVIEW.md) are now
implemented. SG2-011 [exact observations](CANONICAL_OBSERVATION_REVIEW.md) are
also complete. SG2-012 [topology observations](TOPOLOGY_OBSERVATION_REVIEW.md)
are implemented with independent closure checks and explicit collisions. SG2-013
[typed observations and alignment](TYPED_OBSERVATION_REVIEW.md) are complete;
strict comparison and coverage are next. Directed persistence is
no longer the immediate task. The original revision changed documentation and planning only;
subsequent implementation evidence is recorded in the operative ledger and
milestone reviews. Website features remain unimplemented.

## Revision verification

- All 37 task IDs from the supplied document occur exactly once in the operative
  ledger, across 13 R stages; H0–H8 are all represented in the benchmark protocol.
- Both proposals match their recorded original bytes/hashes. A before/after
  inventory confirms all 1523 previously captured implementation, asset, source,
  test and configuration files are unchanged by this revision.
- The extended baseline inventory verifies all 1534 pinned files, including
  158 existing test files; compatibility mode verifies 117 legacy scientific
  input/schema/golden files. Neither mode writes output.
- Fresh combined geometry verification passes **107 tests**, the full Forman
  result, 72 typed experiments, 40 Ollivier runs and 11 flow trajectories.
- The partial-component triangle counterexample in the design was checked with
  exact rational arithmetic. It gives distances `0`, `1/2`, `1` as documented.
- Documentation link/fence validation passes for **313 Markdown files**;
  repository source/JSON validation and `git diff --check` pass.

The earlier 1303-test full-suite/build result remains prior flow-acceptance
evidence on this unchanged runtime, not a falsely claimed rerun for a planning
change. The only new executable helper is the read-only baseline verifier under
this documentation directory. No new scientific API, kernel behavior, dataset
interpretation or website component was implemented here.
