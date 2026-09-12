# Causal Emergence Model Pack

The active research source is now
[references/canonical](../../references/canonical/README.md), version
`2026.09.12.4`: 50 entities, 173 scoped claims, six proposed rules, and a
56-node / 60-connection Model Pack. The default facade and Studio open this
reconstruction. All 249 historical records and 971 parent assertions remain
accounted for. The Level-0 ledger reviews 84 assertions and the
[optical/retinal pilot](../../references/canonical/RETINAL_REVIEW.md) adds all
six selected cards, seventeen evidence entries and twenty-two assertions.
Internal decisions now cover 30 cards and 106 assertions; 219 cards and 865
assertions remain pending. The [conditional-routing extension](../../references/canonical/ROUTING_REVIEW.md)
adds eight experimental contexts and replayable publisher summary data; it
does not increase those historical review counts. Earlier releases retain
their exact identities.

The [dictionary extension](../../references/canonical/DICTIONARY_REVIEW.md)
adds 112 internal semantic decisions, 929 top-level field dispositions and ten
executable counterexamples. Its separate 971-entry quantitative census leaves
all original weights and thresholds withheld and all 164 carrier conflicts
open for mechanism review. This adds no historical card or edge review coverage.

Run `npm run check:canonical` for the active source and derivative contract;
run `npm run model:causal-emergence:legacy:verify` for historical replay.
The census and migration discussion below describe the preserved baseline.

The historical builder in this directory reproduces the preserved
`references/level-*.json` catalogue. The source files remain in `references/`;
the compiler does not rewrite or silently migrate them.

The historical release is explicitly a source-catalogue snapshot. `ParentCode` records
are exposed in the `source-parent` relation layer and are not reclassified as
generative relations. Known source-audit findings remain visible through the
bound audit hash and repository audit fixture.

Verify the historical release:

```sh
npm run model:causal-emergence:legacy:verify
```

The release directory contains a manifest, semantic JSON files, recomputable
indexes, and a convenience JSON bundle available through the root `onto2d` facade.

## Source review scope

The current review starts with **all data in `references/`**, then follows its
derivatives. It covers eight level files, nine dictionaries in
`descriptions.json`, `arising-schema.json`, both supplied PDFs and the subsequently
added `Архив.zip` containing ten text drafts. The execution
backlog and complete node batches live in the
[roadmap](../../docs/ROADMAP.md#active-sequence-references-and-derived-graph).
This guide owns the findings, review method and dependency boundaries.

The review also asks **why this graph should have this structure**. The
[construction rationale and reconstruction method](../../docs/architecture/SOURCE_POLICY.md#construction-rationale-and-testable-reconstruction)
connect recent project work to operational node definitions, typed dependency
claims, refutation tests and alternative graphs. The active structure may be
rebuilt, including its levels and node inventory. The existing counts are a
baseline for accounting, not constraints on the corrected result.
The author clarified on 2026-09-11 that the catalogue was an intuitive draft
without an explicit per-record selection procedure. Its cards and relations are candidates
for evidence-based reconstruction; the new method must not be described as
the procedure that originally produced them.

The [foundation and archive review](reconstruction/README.md) distinguishes that
missing procedure from the theoretical principles actually present in the
papers and drafts. It includes a full textual reading of the 36-page topology
paper and all ten archived texts, a targeted reading of the second paper,
mathematical counterexamples, and a concrete Level-0 representation proposal.
All 24 source cards are mapped and all 84 incoming edges inventoried. Their subsequent internal dispositions
and canonical migration are recorded in the active source; scientific
obligations remain open.

The 2026-09-11 baseline is a complete local structural/completeness census,
dependency inspection and limited bibliographic spot check. Scientific review
of every catalogue statement/relation and full review of the second PDF remain
**pending**. Counts refer
to evidence entries, not distinct publications or independently verified facts.

```sh
npm run audit:references
node scripts/audit-references.mjs --json > /tmp/onto2d-references-audit.json
```

The detailed report contains all 249 node IDs, all 971 incoming relation IDs,
all schema violations with file/array index/JSON pointer, evidence locations,
dictionary mismatches, review candidates, and SHA-256 identities of all twelve
source files. The command is read-only. Exit zero means the diagnostic ran;
it does not mean the findings are resolved. It is deliberately separate from
the preserved `audit:catalogue` fixture and the release-bound audit hash.
The later archive is accounted separately by
`python3 models/causal-emergence/reconstruction/verify.py`; it does not change
the twelve-file canonical source census or the frozen release inputs.

## Baseline findings

| Area | Observed baseline | Required disposition |
|---|---|---|
| Bibliographic locators | 591 evidence entries; zero populated DOI or Link fields; all 249 nodes affected | Identify the actual work and supported statement; retain explicit unresolved cases |
| JSON Schema | All 249 nodes fail the supplied schema: 1,248 violations | Reconcile source data and a revised schema before making it a strict gate |
| Locator types | 591 null DOI values and 591 null Link values conflict with string-only schema types | Define absence consistently; a book without a DOI is valid evidence when correctly identified |
| Short descriptions | 65 exceed the schema's 160-character limit | Edit for meaning and concision; avoid blind truncation |
| Unmodeled field | `7.20.CrossLevels = [6]` is rejected by the schema and omitted by the compiler | Define and preserve cross-level meaning, or replace it through an explicit migration |
| Carrier dictionary consistency | 164 edges disagree with `CarrierTypes.GroupId`, affecting 37 nodes | Review both type and group; choosing the group mechanically may preserve the wrong carrier type |
| Required dependencies | 123 uncovered `MustCover` categories across 107 nodes | Decide whether the requirement, relation inventory, or dependency label is wrong; do not add invented parents |
| Weights | Parent sums: `0.2 = 1.9`, `0.9 = 0.9`, `0.18 = 0.9` | Establish interpretation and provenance before renormalizing |
| Numerical thresholds | 971 numeric `N_min`, 967 numeric `N_crit`; all 971 `N_sat` are null | Check units, counted entities, applicable conditions and provenance; null saturation is not itself an error |
| Direction semantics | 279 edges point to a higher catalogue level, 2 to a lower level, 690 stay within a level; 38 cross-level label candidates | Reconcile the direction of the stored dependency with the scale of the phenomenon; candidates are not automatic reversals |
| Cycles | 3 nontrivial strongly connected components, containing 3, 7 and 28 nodes | Review every internal edge; cycles may encode feedback or constitution and are not automatically defects |
| Dictionary shape | `InteractionModes[Id=1]` uses `validation.predictions/falsifiable_if`; its peers use `Validation.Predictions/FalsifiableIf` | Establish one documented dictionary schema and migrate keys |
| Missing validation gates | The source schema contains no `required` declarations; `check:schemas` only compiles package schemas; the legacy audit skips bibliography and carrier consistency | Add meaningful source completeness and relationship checks |

The extended reference checks found no unknown Science, requirement or carrier
IDs, no carrier threshold-order violations and no overlapping requirement
sets. The legacy audit found no missing parents, self-parents, duplicate node
codes, duplicate parents or out-of-range weights. Valid identifiers and numeric
ranges do not establish that the chosen labels or values are scientifically
correct.

A separate Python census found one connected component, no isolated nodes,
no duplicate JSON object keys and no exact case-insensitive duplicate names.
Every node is reachable from the sole parentless node `0.15`. This checks
connectivity and exact duplication; semantic overlap between differently named
cards remains part of the scientific review. An independent range check also
confirmed that the roadmap's 25 batches cover all 249 source IDs exactly once.

| Source level | Nodes | Incoming edges | Evidence entries | Uncovered MustCover categories | Carrier group mismatches |
|---|---:|---:|---:|---:|---:|
| 0 — Proto Field | 24 | 84 | 24 | 10 | 16 |
| 1 — Quantum | 35 | 80 | 70 | 0 | 0 |
| 2 — Atomic | 23 | 55 | 46 | 1 | 4 |
| 3 — Biochemical | 50 | 200 | 100 | 39 | 1 |
| 4 — Cellular | 33 | 155 | 99 | 14 | 0 |
| 5 — Multicellular | 34 | 167 | 102 | 34 | 143 |
| 6 — Behavioral | 25 | 99 | 75 | 18 | 0 |
| 7 — Social | 25 | 131 | 75 | 7 | 0 |
| **Total** | **249** | **971** | **591** | **123** | **164** |

`ComplexityLevels` declares levels 0–13, but only 0–7 have source node files.
Levels 8–13 are currently dictionary-only scope; their absence does not justify
inventing additional nodes. Review their scope labels explicitly. Dictionary
equations, examples, `TypeRoles.Causality` pairs and quantitative guidelines
also need semantic review: they are not verified mathematical results merely
because they appear in a dictionary.

One dictionary review candidate is `InteractionModes[Id=0].Validation.FalsifiableIf`:
it describes a pattern disappearing after key cooperative edges are removed.
That appears to support dependence on those edges, rather than state what would
refute it. Specify the tested prediction and its contradictory outcome before
using this text as an executable falsification criterion.

## Scientific and bibliographic review method

The preserved legacy catalogue assigns 159 `established`, 57 `well-supported`,
7 `hypothesized`, 2 `speculative` and 24 `methodological-placeholder` statuses.
These are historical author assignments. A source supporting the existence of a phenomenon does not thereby
support its SOMA classification, its exact parent set, its weight, or its
claimed derivation from an earlier level.

For each node, review its identity, name, short/full descriptions, discipline,
level, phase, type role, scientific status, requirements and every evidence
entry. Split independently testable statements and record what each reference
supports, what it only motivates, and what it does not establish. Check
duplicates and excessively broad composite cards before deciding to merge or
split; retain an explicit mapping for changed IDs.

For each relation, review parent/child direction, the concrete mechanism,
dependency type, necessity, interaction modes, causal directions, lifecycle
role, weight and quantization. Assign the review to the **child's batch**, even
when the parent is in a different level. This accounts for all 971 edges once;
the subsequent cross-level pass checks joint consistency. The legacy node-level
citations cannot identify which exact relation or threshold they support.
The canonical contract supplies those bindings for the internal Level-0 review;
apply and test the contract in each remaining batch.

For every evidence entry, identify authors, exact title, year/edition, venue
and work type. Verify DOI and an accessible publisher/repository record against
the same work; check the relevant passage, figure or result when assessing the
claim. Separate primary experiments, theory, simulations, reviews, books and
project hypotheses. Check corrections/retractions and scope limits. Reuse a
publication identity when the same work supports several cards, but review each
claim binding separately. A working DOI is not a scientific approval signal.

The initial spot check already demonstrates why title matching alone is
insufficient:

- `7.6` labels Woolley et al. (2010) as `review`. The original abstract describes
  two empirical studies. The located DOI is `10.1126/science.1193147`.
  [Original article abstract and bibliographic record](https://pubmed.ncbi.nlm.nih.gov/20929725/).
- `4.14` labels Gray (2012), *Mitochondrial evolution*, as `empirical`, while its
  publication type is Review. The located DOI is `10.1101/cshperspect.a011403`.
  [Article record](https://pubmed.ncbi.nlm.nih.gov/22952398/).
- `7.16` cites Shapin (1995). This is not a confirmed year error: the book's
  front matter distinguishes the 1994 original and 1995 paperback. Resolve
  edition and ISBN before changing the year.
  [Publisher front matter, page 4](https://www.degruyterbrill.com/document/doi/10.7208/9780226148847-fm/pdf).

Publisher article pages for the first two returned HTTP 403 during this check;
the conclusions above concern metadata/abstracts, not a full-text review or
endorsement of all associated graph claims. No source records have yet been
changed on the strength of this spot check.

Priority semantic questions include the Level-0/Level-1 theoretical bridge
(`0.14`, `1.0`), the future anisotropy branch (`1.32–1.34`), biochemical claims
about selected electron-capture decays (`3.37`), organism-wide allocation and
hysteresis claims (`5.25`, `5.30–5.33`), conscious experience (`6.9`), and the
species/context limits of adult neurogenesis (`6.17`). These are review targets,
not preassigned false claims. In particular, generic statements about
"experimental observations" or "longitudinal studies" need identifiable
studies supporting the exact asserted mechanism.

Both PDF hashes match the existing
[Level-0 source lock](../../cases/level-0-oscillator/source-lock.json).
[Foundations](../../docs/architecture/FOUNDATIONS.md) already records a textual
review of *Topology of arising*, its theoretical status, phase differences and
unresolved parameters. The separate *Theory of causal arisings* source is still
marked `preserved-pending-separate-review` in that historical source lock. The
foundation review now records targeted passages; its full review and comparison
with the catalogue remain tasks. Do not confuse verifying their bytes with reading
or independently validating their arguments.

## Derivative dependency map

| Input or owner | Derivatives and action when the revised source is ready |
|---|---|
| `references/canonical/graph.json`, `migration.json`, `edge-reviews.json`, `relation-review-policy.json`, `schema.json` | Canonical source validation, scoped node/edge rationale, review and migration dictionaries, compiled nodes/relations/rules, indexes and versioned bundle |
| `references/level-*.json`, `descriptions.json` | Catalogue loader/audit; the reviewed audit fixture; adapter tests; node/edge compilation and dictionary projection |
| `references/arising-schema.json` | Source validation contract and hashed Model Pack source inventory; changing the schema alone changes provenance |
| Both `references/*.pdf` | Level-0 source lock, foundational interpretation and numerical case provenance; preserve original document bytes and version any changed theoretical input |
| Historical `compiler.mjs`, `build.mjs`; current `canonical/source.mjs`, `canonical/build.mjs` | Corresponding release manifests, nodes, edges, dictionaries, seven indexes and bundles; current compilation replays its strict source contract, while historical compilation preserves original fields |
| `models/registry.json` | Exact model/version/root/manifest entries; Model Studio `EXPECTED_REGISTRY_HASH`; release selection tests |
| Root `src/index.js` | Default bundled pack import; default-engine examples and tests |
| Model Studio and engine presentation | Source record, graph and Inspector; the new release supplies structured rationale, source links, scope and limitations alongside original JSON |
| Structural Geometry source lock and examples | Causal projection, weight experiments, providers, regimes, topology/canonical fragments, Ollivier/flow and controls, comparisons, invariance, responses, signatures, pseudometrics, geometric signatures and downstream synthetic comparisons |
| Public assets and documentation | Update model-dependent labels/counts/examples and public module revisions; regenerate worker/site artifacts only when their inputs change |

The historical compiler retains its fixed `2026.08.15` identity and rebuilds
from the preserved legacy files. Its writer now refuses to replace an existing
release with differing bytes. The separate `canonical/build.mjs` reads the
new versioned source contract and also refuses release replacement. Legacy
files stay available for exact historical replay.

Historical geometry artifacts explicitly pin `causal-emergence@2026.08.15`,
often including the bundle's raw-byte hash. Account for every such consumer:
either retain it as an explicitly historical result, or run a separately
identified study on the corrected graph. Do not silently regenerate its old
expected outcome. The DREAM4/C. elegans observations are independent source
datasets; changing catalogue bibliography alone does not require retraining
their studies. Shared implementation changes still require compatibility checks.

After each completed source batch, require valid source schema/dictionaries,
reviewed evidence/claim bindings, explicit unresolved items and a coherent
versioned derivative build. Final acceptance requires the complete node/edge
ledger, old-release replay, new-release verification, exact registry, focused
browser checks, full tests and build. A retained hypothesis or a documented
unknown can be an honest final disposition; unsupported certainty cannot.
