# Seshat Epistemic Dependency and Provenance

Case ID: `seshat-epistemic-provenance`. [History case registry](../history-case-registry.json).

- [Seshat Epistemic Dependency and Provenance — use and reproduction](#seshat-epistemic-dependency-and-provenance--use-and-reproduction)
- [Seshat Epistemic Dependency and Provenance — source and interpretation](#seshat-epistemic-dependency-and-provenance--source-and-interpretation)
- [Evidence contract](#evidence-contract)
- [Planned full dependency experiment](#planned-full-dependency-experiment)

<a id="seshat-epistemic-dependency-and-provenance--use-and-reproduction"></a>

## Seshat Epistemic Dependency and Provenance — use and reproduction

This bounded case asks whether the same historical categorical value can retain
different epistemic identity when the public support dependency structure is
preserved.

The outcome-blind selection profile freezes one Polaris-2026 variable, `Road`,
for three polities:

- Egypt - Classic Old Kingdom (`eg_old_k_1`);
- Roman Empire - Principate (`it_roman_principate`);
- Cahokia - Emergent Mississippian II (`us_emergent_mississippian_2`).

All three workbook rows retain the exact native code `P`; all three selected API
records retain the mapped value `present`. The source narratives contain one,
zero, and four inline reference records respectively. The resulting canonical
labelled support DAGs have three different exact support hashes.

<a id="seshat-epistemic-dependency-and-provenance--use-and-reproduction--exact-release-boundary"></a>

### Exact release boundary

The source projection records:

- Polaris-2026 commit
  `55ca5fbc2b563ddbbc1a3413071d4bd243d0a5fa`;
- Polaris workbook SHA-256
  `cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41`;
- Seshat server-code commit
  `9e812bcdbdfe5bb3e87e7a2588d2bcb9a2dc78f0`;
- public serializer SHA-256
  `3571ba8fab32d62ca57bd2052d7da1e67431f90b36947b222dc421a4fab3251f`;
- Seshat Code Book version `4.20.2021`, SHA-256
  `31442ad457955c768a67a5eb4675f8e4cbf23616dcc1f1fc1cfabae05482601d`;
- captured current Public Data terms SHA-256
  `0e3c6581527917fc9a332193fc534e72e6b4402f2aac011b86c1f271da498321`;
- exact SHA-256 and byte count for the source projection, selection profile,
  data-availability probe, and authority projection.

Normal extraction is offline. `upstream.json` is the machine-readable lock.
The compact source projection retains upstream attribution and source links.
The Polaris build repository records an MIT license for its repository scope.
Seshat Public Data is separately licensed under CC BY-SA 4.0; the compact data
projection records its adaptation and remains within that license boundary.

<a id="seshat-epistemic-dependency-and-provenance--use-and-reproduction--epistemic-model"></a>

### Epistemic model

The case-local library keeps these axes independent:

```text
ArtifactKind
DerivationOperation
ResolutionState
EvidenceBasis
ReviewStatus
AgreementStatus
Precision
```

Evidence records cannot carry claim resolution or derivation operations.
Coding claims require both. The native Seshat code table round-trips `A`, `P`,
inferred, unknown, transitional, disputed, not-applicable, and blank forms
without replacing the source spelling. Separate contracts preserve exact
numeric range lexemes and integer/null time bounds. A direct-attestation
firewall prevents unknown, disputed, transitional, and inferred forms from
silently becoming direct categorical evidence.

Exact support identity is a domain-separated hash of the canonical labelled
support closure, including claim and mapping identity. Composition counts are
descriptive and never act as an equality key.

<a id="seshat-epistemic-dependency-and-provenance--use-and-reproduction--public-metadata-firewall"></a>

### Public metadata firewall

The public Road objects do not expose a per-datapoint research assistant,
expert, review event, or intervention timestamp. Those group cuts are `null`
with an explicit reason. A separate polity-level RA relation is not promoted to
a datapoint-level coder relation. The API `TRS` tag is retained as a confidence
qualifier and is not interpreted as a person.

Inline `§REF§` payloads are mapped by one explicit, versioned local table. The
mapping does not claim bibliographic completeness or source independence. In
particular, two Cahokia reference branches map to one Pauketat 2014 work group.

<a id="seshat-epistemic-dependency-and-provenance--use-and-reproduction--ablation-semantics"></a>

### Ablation semantics

Every declared support edge in this MVP is required. Removing a group removes
its member nodes and all transitive dependents in a new graph; it never mutates
the frozen source graph. The committed output retains the raw categorical
transition `Resolved -> Unknown`, removed node and edge IDs, and `null`
threshold/qualitative-label fields. No PCA or imputation is performed.
The first categorical flip is also committed explicitly as the minimum group
removal that changes `present` to the exact categorical response `unresolved`;
the separate raw resolution response remains `Resolved -> Unknown`, and
unavailable group types remain `null` with a reason.

<a id="seshat-epistemic-dependency-and-provenance--use-and-reproduction--reproduce-and-verify"></a>

### Reproduce and verify

```sh
npm run case:seshat-epistemic-provenance:verify
node --test cases/seshat-epistemic-provenance/tests/seshat-epistemic-provenance.test.mjs
node --test apps/seshat-evidence-dependency-lab/seshat-evidence-model.test.mjs
```

The approved case identity is
`sha256:40dea4e1ae5d51311c7b8f26b26e8e003e6d81cc328a160c9b9a997d118a0d2a`.

The broader frozen-cohort experiment and its remaining implementation work are
specified in
[`cases/seshat-epistemic-provenance/README.md`](#planned-full-dependency-experiment).

<a id="seshat-epistemic-dependency-and-provenance--source-and-interpretation"></a>

## Seshat Epistemic Dependency and Provenance — source and interpretation

Implementation status: **EXPLORER** (completed 2026-08-23)

<a id="seshat-epistemic-dependency-and-provenance--source-and-interpretation--implemented-result"></a>

### Implemented result

The repository contains an offline, byte-locked three-claim projection from
Polaris-2026 and the public Seshat Road API. The variable and polity cohort were
frozen before stress computation. Roman Principate, Classic Old Kingdom Egypt,
and Cahokia Emergent Mississippian II all retain the exact Polaris code `P` and
API value `present`.

The canonical case separates source records, public narratives, exact inline
reference records, locally mapped source works, coding claims, and one
deterministic comparison artifact. Its support graph contains 22 nodes, 25
required edges, and 18 groups. The three claim-local canonical support hashes
are distinct even though every pair has the same native and mapped value.

Four source-work ablations are committed as raw categorical responses. Each
uses a new derived graph, retains exact removed node/edge IDs, and records
`sourceGraphMutated: false`. The Roman claim has no source-work ablation because
its public narrative exports no inline source marker.

The release also validates exact numeric range lexemes, integer/null time
bounds, direct-versus-inferred categorical evidence, and an explicit first
categorical flip for every supported group type.

<a id="seshat-epistemic-dependency-and-provenance--source-and-interpretation--public-data-result"></a>

### Public-data result

The public probe found native code and narrative-to-code context, plus partial
inline source-work information. It did not find public per-datapoint RA,
expert, review-event, or intervention timestamp relations. These axes remain
`unknown` or unavailable; no substitute identifiers are manufactured.

The authority projection pins Codebook `4.20.2021` by SHA-256 and separates the
MIT license of the Polaris build repository from the CC BY-SA 4.0 license of
Seshat Public Data. The captured Public Data terms response is also byte-locked.

<a id="seshat-epistemic-dependency-and-provenance--source-and-interpretation--explorer"></a>

### Explorer

The Historical Evidence Dependency Lab verifies the case artifact SHA-256 in
the browser and provides:

- an exact native claim and narrative inspector;
- an interactive claim-local labelled support DAG;
- a shared source-work fan-out view;
- exact public group-cut results;
- raw group-ablation responses;
- pairwise value/support identity comparisons;
- public metadata and non-claim boundaries.

The interface visibly states that this is a mechanism demonstration, not a
ranking of polities, evidence regimes, source quality, or historical truth.

<a id="seshat-epistemic-dependency-and-provenance--source-and-interpretation--reproduction"></a>

### Reproduction

```sh
npm run case:seshat-epistemic-provenance:verify
node --test cases/seshat-epistemic-provenance/tests/seshat-epistemic-provenance.test.mjs
node --test apps/seshat-evidence-dependency-lab/seshat-evidence-model.test.mjs
```

The approved artifact identity is
`sha256:40dea4e1ae5d51311c7b8f26b26e8e003e6d81cc328a160c9b9a997d118a0d2a`.

See the [case README](#seshat-epistemic-dependency-and-provenance--use-and-reproduction) and
[Evidence contract](#evidence-contract) for exact
source locks, mapping semantics, identity rules, and epistemic limits.

The full population-level experiment and remaining engineering sequence are
specified in
[Case guide](#planned-full-dependency-experiment).

<a id="evidence-contract"></a>

## Evidence contract

The Seshat case pins Codebook `4.20.2021` by content hash and keeps artifact kind, derivation operation, resolution state,
evidence basis, review status, agreement status, and precision as independent
validated axes. Exact native codes round-trip through a closed case-local map;
the source spelling remains part of the claim. Numeric range lexemes and
integer/null time bounds have separate exact round-trip contracts. Unknown,
disputed, transitional, and inferred forms cannot satisfy the direct-attestation
firewall.

A coding claim's exact support identity is the domain-separated hash of its
canonical labelled support DAG closure. The closure includes the claim
identity, mapping identity, evidence-node identities, required typed edges, and
support-group membership. Aggregate composition is descriptive only and cannot
substitute for labelled-DAG equality.

Inline Seshat reference payloads use a versioned explicit local mapping to
source-work groups. This mapping remains distinguishable from a native Seshat
stable citation identifier and makes no independence claim.

Group ablation uses required, conjunctive dependency semantics for this MVP.
Removing a group creates a new graph and transitively removes its dependents.
It cannot mutate the source graph. Outputs preserve exact removed IDs and the
raw categorical resolution transition; no threshold or qualitative stability
label is added. `FirstCategoricalFlip` records the minimum supported group
removal that changes `present` to the categorical response `unresolved`; the
resolution response remains separately recorded as `Resolved -> Unknown`.
Unavailable group types return `null` with an exact reason.

The MIT license of the pinned Polaris build repository and the CC BY-SA 4.0
license of Seshat Public Data are separate scopes. The Public Data terms
response and the compact authority projection are content-addressed, and the
adapted source projection retains attribution and the ShareAlike boundary.

Unavailable per-datapoint RA, expert, reviewer, review-event, and timestamp
relations remain unavailable. The case does not synthesize their nodes or
cuts. Historical Load remains `null` because the case does not declare a path
space, cost, or history-free baseline.

<a id="planned-full-dependency-experiment"></a>

## Planned full dependency experiment

The existing three-polity Explorer is an illustrative mechanism test. The full
experiment is a separate, outcome-blind population study over a frozen cohort.
Its falsifiable hypothesis is:

> Support quantity and structural dependency robustness do not produce the same
> ordering of historical claims.

The hypothesis is allowed to fail. A result with identical orderings and no
discordant pairs is a valid negative result.

<a id="planned-full-dependency-experiment--1-freeze-the-study-before-computing-results"></a>

### 1. Freeze the study before computing results

Create a versioned preregistration manifest that fixes:

1. one variable or a tightly defined variable family;
2. one pinned public data release and the exact native Codebook boundary;
3. deterministic provenance-completeness and exclusion rules;
4. every eligible polity-time claim satisfying those rules;
5. native-code, range, time-bound, uncertainty, dispute, and derivation
   semantics;
6. source-record-to-source-work grouping rules;
7. group-ablation semantics and uncertainty procedures;
8. the planned tables, plots, and statistical summaries.

The cohort is frozen before any dependency metric or stress result is
calculated. No polity or claim may enter the cohort because its result looks
interesting.

<a id="planned-full-dependency-experiment--2-build-the-population-support-graph"></a>

### 2. Build the population support graph

For every eligible claim, preserve a typed, labelled dependency DAG containing
the public records that are actually available:

```text
evidence leaves -> narratives / source works -> coding claim -> derived result
```

When supported by public metadata, the graph may also contain source families,
coders, experts, reviewers, review episodes, and data-propagation episodes.
Unavailable metadata remains unavailable and its metric remains `null`; it is
never replaced with a guessed identity. Multiple citations are not described
as independent supports unless independence is explicitly modelled and
justified.

<a id="planned-full-dependency-experiment--3-compute-the-primary-quantities"></a>

### 3. Compute the primary quantities

For each claim compute and report the full distributions of:

```text
D_source = number of distinct source-work groups
D_leaf   = number of distinct evidence leaves
R_source = minimum source-work groups removed before the claim becomes unresolved
R_coder  = minimum coder groups removed before the claim becomes unresolved
```

`R_coder` is `null` where the necessary public coder linkage is absent. Do not
replace these quantities with one composite “robustness score”. Exact labelled
DAG identity and simple composition counts remain separate outputs.

<a id="planned-full-dependency-experiment--4-run-declared-stressors"></a>

### 4. Run declared stressors

Group stressors are primary:

- remove one source work;
- remove one source family;
- where represented, remove one coder, one expert, or one review episode.

Claim stressors are secondary:

- remove one coding claim;
- branch one disputed value;
- turn one inferred claim into an unresolved claim.

Later derivation stressors may change a declared imputation policy, remove
imputed inputs, branch disputed inputs, or widen a numeric range under a fixed
rule. Every stress operation creates a derived analysis artifact and cannot
mutate the frozen source graph. The primary output is the exact numeric delta
or categorical flip, with no hidden `STABLE` / `SENSITIVE` threshold.

<a id="planned-full-dependency-experiment--5-test-quantity-versus-dependency-robustness"></a>

### 5. Test quantity versus dependency robustness

For every comparable pair of claims `i` and `j`, mark source-support
discordance when:

```text
D_source(i) > D_source(j) and R_source(i) < R_source(j)
```

or when the reverse ordering holds. Report:

- number of comparable pairs;
- number of discordant pairs;
- discordance fraction;
- uncertainty interval.

Also report the Spearman rank correlation, its confidence interval, and a
scatter/rank plot where appropriate. Do not invent a post-hoc verbal boundary
such as “rho below 0.3 is weak”. The estimate and interval are the result.

A zero discordance fraction counts against the hypothesis for the frozen
cohort. A non-zero fraction shows that source count alone does not totally
order dependency robustness. Representative discordant pairs may be selected
for visualization only after the complete frozen analysis exists.

<a id="planned-full-dependency-experiment--6-remaining-implementation-sequence"></a>

### 6. Remaining implementation sequence

- [ ] Add a preregistration schema and committed frozen cohort manifest.
- [ ] Extend extraction from three fixtures to every eligible claim in the
  selected variable family.
- [ ] Version source-family and, where available, human-process group mappings.
- [ ] Add scalable exact or explicitly bounded minimum-group-cut computation.
- [ ] Compute `D_source`, `D_leaf`, `R_source`, and nullable `R_coder` for the
  complete cohort.
- [ ] Add pairwise discordance, uncertainty intervals, Spearman intervals, and
  deterministic plots.
- [ ] Publish all eligible claim results, including null and negative results.
- [ ] Update the Explorer with population distributions and post-analysis
  representative pairs while retaining the three-fixture mechanism view.
- [ ] Re-run the epistemic abstraction in a second repository case before
  promoting case-local code into generic packages.

<a id="planned-full-dependency-experiment--7-optional-work-after-the-population-result"></a>

### 7. Optional work after the population result

Only if it adds scientific value and remains reproducible:

- reproduce one published derivation pipeline;
- consider the social-complexity CC/PCA pipeline, a moralizing-gods replication
  pipeline, or a simpler published transformation;
- add imputation/statistical reproduction only after source fidelity and
  derivation provenance are explicit;
- create a Model Pack only if the broader study benefits from it.

<a id="planned-full-dependency-experiment--definition-of-done"></a>

### Definition of done

The full experiment is complete only when the cohort and group semantics were
frozen first, all eligible claims were analysed, full distributions and
pairwise discordance were reported, rank association has no arbitrary verbal
threshold, examples were chosen after the complete result, negative findings
remain publishable, and every output can be reproduced from pinned inputs.
