# DREAM4 and C. elegans research sources

The selected source downloads are acquired and byte-verified locally. The
[source lock](source-lock.json) contains 14 exact files: the DREAM4 distribution,
the Randi functional archive, eight Witvliet anatomical graphs and four author
metadata/parser/exporter files. They total 530,722,562 bytes. Native adapters,
source census, bounded chemical graph scopes and an availability profile are
implemented. The [D3 protocol](../protocol/PROTOCOL.md) defines the scientific
targets and supplies tested eligibility, metric and learner helpers. The separate
[DREAM4](../dream4/README.md) and [C. elegans](../celegans/README.md) studies apply
those contracts to measured response tables and report predictive comparisons;
this directory retains the source-only census.

The [research plan](../../../docs/structural-geometry/RESEARCH.md) owns scientific
questions, source roles, applicability, evaluation and the next delivery gates.

## Reproduce acquisition

```sh
npm run structural-geometry:datasets:fetch
npm run structural-geometry:datasets:verify
```

The first command downloads missing or invalid files into ignored `cache/`.
The second is offline: every byte count and SHA-256 must match the committed
lock. Downloads are bounded by locked length and verified before atomic
replacement. The tool neither extracts archives nor executes upstream code.
Normal repository tests/builds do not download this research corpus. On a fresh
checkout, run the explicit fetch command before its optional offline verifier.

Large/raw sources stay out of Git and public website payloads. The lock records
source terms separately from the project's code license. A later distributable
fixture needs an explicit permitted source subset and its provenance; no data
license is inferred from a paper or unrelated bundled software.

## DREAM4

Source: [Bioconductor DREAM4](https://bioconductor.org/packages/3.10/data/experiment/html/DREAM4.html),
package 1.22.0 from Bioconductor 3.10. The exact archive is 3,488,976 bytes.
Its internal `DREAM4/inst/extdata/lightlyProcessedDownloadedData.tar.gz` holds
consistently named challenge tables. This is a documented redistribution with
light processing, not an untouched original challenge ZIP.

The Size10 pilot uses all five `insilico_size10_1` through `insilico_size10_5`
directories. Each gold standard contains 90 explicit off-diagonal entries:
respectively **15, 16, 15, 13 and 12** positive directed edges. Each directory
also contains wild type, knockouts, knockdowns, multifactorial perturbations,
time series and a dual-knockout file containing five indexed gene pairs and
**no response outcomes**. The archive also contains Size100 material, outside
the initial pilot.

The [adapter](dream4.py) selects all five Size10 directories by name and preserves
every table and member hash. There are 450 explicit off-diagonal gold records,
71 arcs, 379 explicit zeros, 680 expression rows and 25 temporal series. Gene IDs
stay network-local. KO/KD row i targets header gene i, following the inspected
source loader's transpose-and-name convention. Each series has 21 time rows;
series boundaries remain explicit. Numeric underflow, NaN and malformed tables
are rejected; source decimals remain recoverable from hashed native members.

The native gold standard is headerless. The archived R loader asks for a header
and would drop its first genuine edge in every network. The adapter reads all
90 native rows, including that edge; it never executes the R loader.
The package declares `License: GPL` without a version; retain that exact term
and distribution provenance when reviewing a redistributable subset.

## C. elegans functional measurements

Source: Randi et al., [Neural signal propagation atlas](https://doi.org/10.1038/s41586-023-06683-4),
[OSF e2syt](https://osf.io/e2syt/), `exported_data.tar.gz`, version 1.
The local file has **523,093,816 bytes**; SHA-256 matches the OSF file metadata:
`d6e7b3d93175b40b7ae17bde2182835e9c2144388142c522ee9be3832f6ce836`.

The archive has 679 members: its directory and six text-file families for 113
recording indexes (0–112): labels, dataset names, time coordinates, GCaMP traces,
stimulation neuron indexes and stimulation volume indexes. Uncompressed member
content totals 1,242,576,695 bytes. This gives recording-level source material;
it is not an already compiled atlas target table or a proven animal-ID mapping.
The [streaming adapter](randi.py) validates all 113 recordings: 14,379 trace
columns, 394,084 time rows and 51,411,106 values. It records 48,882,229 finite
values, 2,528,877 native NaNs and 169,338 measured zeros separately. Traces stay
in the archive; `iter_trace_rows` replays a chosen recording with verified member
identity and explicit `None` for NaN. Consume the iterator completely to finish
member and archive verification, including the compressed stream after the selected
member. Publish derived rows only after successful exhaustion. The expanded-byte
bound includes data beyond the tar end marker. This native adapter derives no
functional response target.

These are processed exported fluorescence values. The publication's software
keeps the original acquisition missingness mask separately; the six-family TXT
archive omits it. Finite exported values may include upstream interpolation and
do not establish raw signal quality. The D3 [method evidence and limitations](../protocol/PROTOCOL.md#c-elegans-outcome-and-limits)
also identify missing target-hit/auto-response flags, label confidence and
per-column processing history. The adapted window contrast does not reproduce
the paper's quality filters, q-values or functional-edge classifier.

All 14,421 source label slots remain accounted for. Recordings 11, 20 and 23
contain 42 surplus trailing blank labels without trace columns; these have null
column indexes. There are 5,808 native stimulation rows, including 1,198 negative
neuron-index sentinels whose biological meanings are not inferred. Recording 33
has two stimulation rows at volume 39 and a final nonincreasing source-order row.
Both rows and their flags remain present. The adapter neither sorts nor merges
them into a presumed single trial. The D3 contract excludes both rows sharing a
stimulation time and events with another native stimulus in the complete
baseline/post window, including negative-target rows. Nonmonotonic source order
does not alter these timestamp-based checks.

The 113 distinct dataset names identify source recordings, not certified animal
IDs. Blank, marked, uncertain, class-level and duplicate labels remain explicit.
Cross-source mappings trim only outer whitespace and expose exact-label
**candidates** separately for each anatomical animal; they do not expand L/R
classes, repair apparent typos, pool animals or establish functional connections.

Select the final `exported_data.tar.gz`, not a `pre_review` archive or the
separate unc31 mutant cohort. Those alternatives are different populations.
The OSF node metadata reports no declared node license (`node_license: null`);
local acquisition does not assert permission to redistribute its contents in a
public fixture or app.

## C. elegans anatomy and development

Source: Witvliet et al., [Connectomes across development](https://doi.org/10.1038/s41586-021-03778-8),
[author repository](https://github.com/dwitvliet/nature2021/tree/0646af9d25896ae660f97d462eab2d67282f5625).
All files are pinned to commit `0646af9d25896ae660f97d462eab2d67282f5625`.
The eight `data/nemanode/witvliet_2020_N.json` files retain native connection
records. The filenames' 2020 date is part of the source identity; the paper is
from 2021. `dataset_info.py`, `neuron_info.py`, `data_manager.py` and
[export_json.py](https://github.com/dwitvliet/nature2021/blob/0646af9d25896ae660f97d462eab2d67282f5625/src/export/export_json.py)
are retained as readable specifications and never executed here. The exporter
certifies `typ=0` for chemical connections and `typ=2` for gap junctions.

The author's stage metadata assigns Dataset1–4 to L1, Dataset5 to L2, Dataset6
to L3 and Dataset7–8 to adults. These are eight different animals.
The native files contain respectively **939, 1,231, 1,198, 1,551, 2,092, 1,952,
2,781 and 2,802 connection records**, with 187–224 distinct endpoint labels.
The [adapter](witvliet.py) retains every raw record and contact identifier, while
its declared simple chemical projection contains respectively **161, 162, 162,
168, 174, 174, 180, 180 nodes** and **675, 865, 887, 1,011, 1,324, 1,314,
1,933, 1,933 arcs**. Individual neuronal endpoints from both channels define the
node population; chemical isolates within that population remain present.
Muscles, other nonneuronal cells, unresolved fragments/class labels and loops
are excluded from this projection with separate counts, not deleted from native
data. The export supplies endpoints only, so missing animal-level isolates remain
unknown. Tree-node identifiers are not spatial coordinates.

Gap contacts remain a separate undirected channel. Mirrored contact IDs and
endpoint tree-node IDs are checked before counting the pair once: 1,584 verified
mirrored pairs, 10 single-orientation pairs and 31 self-loop pairs. No reciprocal
chemical pair is converted into a gap. Geometry currently audits the declared
chemical projection; a gap or combined-channel geometry contrast needs its own
explicit projection policy.

No repository-root license was found in the pinned tree. Third-party software
licenses inside it and the separately licensed Zenodo 3D-model archive do not
establish terms for these graph files. Source terms and bounded redistribution
remain part of the fixture publication gate.

## Reproduce native preparation and applicability

```sh
npm run structural-geometry:datasets:prepare
npm run structural-geometry:datasets:replay
npm run structural-geometry:datasets:check
node --test cases/structural-geometry/datasets/*.test.mjs
```

`prepare` reads every locked source and regenerates [census.json](census.json).
Native tables, recording metadata, candidate mappings, explicit scope membership
and computational artifacts go to ignored `cache/prepared/`. The local artifact
contains transient Model Packs for the five DREAM4 graphs; no biological model
is registered or published. Raw traces are streamed, never copied into JSON.
All artifacts are replaced atomically after successful preparation. Source lock
and implementation changes during execution fail the run.

`replay` repeats the complete native scan and computations and compares the
committed scientific census and local artifact hashes exactly. The
[runtime compatibility receipts](../runtime-compatibility.json) retain the
original report bytes while pinning reviewed portability replacements; they
permit no scientific-content change. `check` needs no corpus: it checks the report's
payload digest, source-lock identity and case/runtime implementation hashes.
This static check does not independently rerun the sources or numerical work.
Normal tests/builds use synthetic adapter fixtures and the static check. Only
the explicit preparation/replay commands require the downloaded corpus.

The report's `reportSha256` hashes UTF-8 `JSON.stringify` of the object with that
field omitted. Native and local applicability SHA-256 fields hash actual emitted
file bytes including the final newline. Timings are not semantic identity fields.

The [scope policy](scopes.mjs) keeps every DREAM4 network whole. For each separate
anatomical chemical parent, it enumerates the full graph and every closed weak
one-hop neighborhood, then takes all induced directed arcs. It records selected,
omitted and boundary edge indexes against the normalized parent. Scope selection
never consults functional labels or outcomes. Identical memberships may reuse
preflight work but every root stays in the census; these neighborhoods are not
independent biological samples.

Aggregate preflight bounds also apply before allocation: at most 1,048,576
reachability entries, 8,388,608 census traversal units and 2,097,152 conservative
scope-ledger references. Oversized complete populations are rejected as a whole.
All selected native graphs and neighborhoods fit these case-local bounds.

All 1,361 anatomical neighborhood candidates are accounted for; **720** pass
common Ollivier/flow preparation at half idleness and four requested updates.
The other 641 candidates remain visible with reasons. This diagnostic requests
all edges in one Ollivier artifact, so its common scope allows at most **32
arcs**, despite the provider's 256-edge parent bound and flow's 64-edge bound.
Public preparers also enforce support, mass and transport-cell limits. Passing
preparation does not guarantee later rational, certificate or artifact budgets.
No anatomical flow is claimed to have run. Full-parent Forman is calculated
separately and is never combined with fragment Ollivier as a common signature.

All five DREAM4 full graphs have verified Forman, Ollivier and four-update flow
diagnostics. Each flow reaches its requested iteration limit with five observed
frames; this is not a convergence result. Existing graph-edit probes complete
on networks 4/5, have rejected reciprocal reversals on 1/2, and exhaust the
fixed response budget on 3. These remain computational diagnostics, separate
from the 900 available off-target KO/KD expression cells and 100 excluded direct
intervention cells. None of the 25 dual-KO pairs has a supplied response.

The [versioned availability profile](task-profile.mjs) keeps observed nonzero,
observed zero, not applicable, unobserved, rejected transformation and budget
failure distinct. Unavailable values are null with reasons; only measured values
in the same domain, quantity and unit can be compared. It defines availability
of native measurements, not a response distance, wild-type normalization or
predictive score; ResponseSignature-v0 is unchanged.

## Evaluation and delivery boundary

[D6.5 scope and low-degree coverage](../robustness/README.md#d65-scope-selection-and-low-degree-coverage)
adds an exhaustive, separately versioned census of weak/incoming/outgoing one-hop
and weak two-hop neighborhoods in both adult anatomies. It preserves all 1,440
selections and their boundaries, using parent degrees and distinct observation,
preparation and response-eligibility stages. Dataset7's five low-degree roots
prepare but supply no eligible primary pairs. Incoming scopes permit a matched
35-pair / 6-group secondary comparison; this does not expand the original native
response population or replace D2/D3 scope rules. D1–D6 are complete with disclosed
limitations; the [D7 laboratory](../../../apps/structural-geometry-lab/README.md)
presents the results and interactive instrument controls.

D2 infrastructure and the [D3 protocol/helpers](../protocol/PROTOCOL.md) are
implemented. The [machine contract](../protocol/protocol.json) fixes absolute
WT-relative DREAM4 ranks, complete five-network coverage, nested group splits,
baselines, geometry coordinates and reporting. Its [freeze manifest](../protocol/frozen.json)
binds the reviewed contracts and numerical controls.

The source-bound [D3 eligibility audit](../protocol/audit.json) retains all 450
off-target rows in each separate DREAM4 contrast. Its functional metadata census
accounts for all 5,808 stimuli: 198 windows pass timing and source-mapping rules
across 19 source groups. These are candidates before receiver-signal quality and
repeat-recording requirements. Replay it with
`npm run structural-geometry:protocol:audit`; normal
`npm run structural-geometry:protocol:check` verifies the committed bindings and
synthetic controls without requiring the raw corpus.

The functional contract selects Dataset7 chemical neighborhoods, exact-label
mapping, complete uncontaminated 30-second baseline/post windows, a positive
baseline and median aggregation within/across recordings. It holds out stimulated
neuron groups; it makes no animal-disjoint claim. Population helpers preserve
missing receivers and excluded roots with explicit reasons. The separate
[D5 study](../celegans/README.md) applies these rules to actual samples and
establishes 9 eligible source groups and 60 pairs. Native counts and metadata
candidates alone do not establish that response population.

The [D4 pilot](../dream4/README.md) now implements verified pair-geometry extraction
and the complete nested DREAM4 evaluation, including positive primary knockout
and negative secondary knockdown differences. Its report is separate from this
source-only census and the frozen D3 inspection state. D5 reports a negative
full-minus-baseline difference while preserving export quality and dependence limits.
The laboratory exposes these results with their coverage and limitations.
