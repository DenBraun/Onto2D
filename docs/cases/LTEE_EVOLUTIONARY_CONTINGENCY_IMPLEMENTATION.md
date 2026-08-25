# LTEE Evolutionary Contingency — Implementation Report

Updated: 2026-08-25
Status: `ANALYSIS_READY`

## History Model Metadata

```text
History modes:
    Embodied
    Recorded
    Reconstructed

Primary effects:
    Future

Domain:
    Experimental evolution

Evidence profile:
    experimental-observation
    sample-identity
    direct-record
    published-interpretation
    reconstructed
    unknown

Historical Load:
    Candidate empirical extension; not evaluated in this release

History Equivalence:
    Possible; not evaluated in this release

Reachability:
    Primary; descriptive and protocol-conditioned

Reconstruction:
    Secondary; published interpretation remains attributed
```

## Result

The first exact release answers one bounded question:

> How does the recorded generation of an Ara-3 source background condition the observed accessibility of aerobic citrate use under each selected replay protocol?

The release contains:

- 16 published source-generation labels;
- 3 separately represented replay experiments;
- 38 non-missing generation-by-experiment observations;
- 3,212 replicate units, retained per protocol rather than pooled;
- 17 independent Cit+ mutants;
- 7 generation labels from which Cit+ was observed in at least one selected replay;
- 9 generation labels that remain unresolved rather than inaccessible;
- 3 published Monte Carlo summaries, retained without recomputing their P values.

The central result is history-conditioned propensity, not determinism. Under
the selected experiments, the paper reports that later Ara-3 backgrounds had a
greater propensity to yield Cit+. Many later-background replays nevertheless
did not yield Cit+, and the selected tables do not identify a unique
potentiating mutation.

The case is already quantitative: it preserves per-protocol mutant counts,
published mean-generation shifts, and source-attributed Monte Carlo P values.
Those quantities test whether historical background changes observed
accessibility. They are not Historical Load values and must not be relabelled
as such.

## Exact Source Boundary

The empirical projection uses one primary publication:

- Blount, Z. D., Borland, C. Z., and Lenski, R. E. (2008), “Historical
  contingency and the evolution of a key innovation in an experimental
  population of Escherichia coli,” PNAS;
- DOI `10.1073/pnas.0803151105`;
- PMID `18524956`;
- PMCID `PMC2430337`;
- publication date `2008-06-04`.

The pinned upstream input is the 225,210-byte NCBI printable HTML response with
SHA-256
`7e271d52f2fba0e4c40c3c7491b654a56482763639b255fb77930583a4cc10f9`.
Publisher HTML is not redistributed in the repository. Instead,
`prepare-source.py` accepts an explicitly supplied matching response and emits
the reviewed, bounded JSON projection.

The canonical build requires no live network.

## Projection and Arithmetic Checks

`prepare-source.py` checks exact article metadata, required method passages,
Table 1 headers, all generation rows, protocol totals, and Table 2 values. The
projection generator rejects any partial observation or invalid count.

The observed mean generations in Table 2 reproduce from the independent Cit+
counts in Table 1 using exact rational arithmetic with half-up rounding:

| Replay | Published expected | Published observed | Shift | Published P |
|---|---:|---:|---:|---:|
| 1 | 24,917 | 31,750 | +6,833 | 0.0085 |
| 2 | 28,382 | 32,100 | +3,718 | 0.0007 |
| 3 | 22,571 | 27,563 | +4,992 | 0.0823 |

The simple Table 1 replicate-weighted expected means are 24,917, 26,382, and
22,571. Therefore replay 2 does not match the published Table 2 expected mean
of 28,382 under that simple reconstruction. The release does not silently
replace either number:

- 28,382 remains the published Table 2 value;
- 26,382 remains the transparent Table 1 arithmetic diagnostic;
- the discrepancy status is `visible-not-resolved`;
- the published Monte Carlo algorithm and P values are not claimed as
  independently reproduced.

This is an evidence-quality feature: source evidence and derived diagnostics
remain distinct even when they disagree.

## Three Replay Protocols

The experiments are different evidence contexts:

1. Replay 1 contains 72 serial-transfer replay populations and 4 independent
   Cit+ mutants. The paper describes approximately 3,700 replay generations
   with checks every 250 generations.
2. Replay 2 contains 340 MC plates and 5 independent Cit+ mutants. It uses the
   same 68 source clones as replay 1, five plates per clone, approximately
   `3.9 × 10^8` cells per plate, and 59 days of incubation.
3. Replay 3 contains 2,800 cultures plated on MC agar and 8 independent Cit+
   mutants. It uses 20 clones from each evolved time point, 10 replicates per
   clone, 200 ancestral replicates, 45 days of incubation, and approximately
   `4 × 10^13` cells in total.

The different units, scales, and durations are why 72, 340, and 2,800 are not
added into a scientific outcome denominator in the analysis. The aggregate
3,212 count is inventory only.

## Reachability Semantics

The case uses a descriptive relation:

```text
ObservedAccessibility(Cit+ | Ara-3 source generation, exact replay protocol)
```

Each non-missing Table 1 cell has one of two statuses:

```text
observed
not-observed
```

A missing table cell is `not-run` in the Explorer and does not become a stored
zero-count observation. Across protocols, a generation has either:

```text
supported-in-at-least-one-bounded-replay
unresolved
```

There is no `impossible` state in the release.

## Identity and Historical Boundaries

The following objects remain distinct:

```text
Ara-3 population record
source-generation label
source clone
complete genotype
replay experiment
replay population or assay unit
original LTEE history
Cit+ phenotype observation
published statistical summary
published interpretation
Onto2D bounded analysis
```

The selected paper explicitly warns that generation samples may be polymorphic
and that generation alone cannot cleanly separate potentiated and
nonpotentiated clones. Therefore the implementation creates no complete
genotype, unique-clone, inheritance, or causal-mutation edge.

A replay starts from a historical sample under a new experiment. It is
evidence about future accessibility from that background, not a continuation
or reconstruction of the original LTEE trajectory.

## Historical Load Candidate and Current Boundary

At the portfolio level, LTEE is a `candidate` for a future empirical Historical
Load extension. That label describes research priority, not a completed
calculation. The current artifact therefore remains:

```json
{
  "status": "not-evaluated",
  "value": null
}
```

Onto2D's current finite-path definition is:

```text
dH(x | F) = aF - a0
```

where `a0` is the minimum declared cost in a bounded free path space and `aF`
is the minimum cost after an explicit historical/admissibility regime `F` is
applied. This is narrower than a generic effect of history on an outcome.

The selected evidence does not enumerate:

- a finite universe of possible mutation paths;
- an explicit free and history-conditioned admissibility relation over the same
  path universe;
- transition costs;
- a history-free counterfactual baseline.

Consequently there is no defensible empirical Historical Load number. `null`
is a result of model discipline, not missing UI work, and must never be shown
as zero.

In particular, the published `+6,833`, `+3,718`, and `+4,992` generation shifts
compare observed mutant-generation means with paper-specific null
expectations. They are not `aF - a0`: neither term is a minimum path cost in a
shared declared space. The Cit+ outcome's rarity, its occurrence in one LTEE
population, and replay evidence for potentiation establish contingency, but do
not by themselves define a scalar load.

A defensible follow-up would have to preregister and source-lock at least:

1. a finite state and mutation-transition space at a declared genotype or
   genotype-class resolution;
2. the Cit+ target and exact environment/replay protocol;
3. free and background-conditioned admissibility regimes over the same paths;
4. one or more biologically interpretable cost functions, with sensitivity
   analysis rather than a universal score;
5. the mapping from frozen clones and replay observations to those states,
   including polymorphism, missing paths, and uncertainty;
6. an external outcome against which the resulting value is tested.

Until those conditions are met, LTEE remains the flagship empirical
reachability result and a high-priority Historical Load candidate, not an
evaluated Historical Load case.

## Case Artifact

The exact case identity is:

```text
sha256:e0024fee2f319158b5fc1dc0e30da1a7d641f0763b4f29ad7cc548c46e13d691
```

Its source snapshot identity is:

```text
sha256:d4574e9bf6e34979b3a1a3cb6002a1a6f97da85180ef44da1d8e841dcf257a3d
```

The case schema closes the top-level artifact and critical nested records.
Runtime verification additionally recomputes all per-protocol totals,
observation statuses, positive-background inventory, observed means, object
identities, and the outer canonical identity.

Negative tests re-sign mutated artifacts and confirm that the approved release
still rejects:

- impossibility promotion;
- protocol pooling;
- causal-mutation promotion;
- numeric Historical Load promotion inside the current evidence boundary;
- source, generator, or projection byte changes.

## Model Pack

The exact Model Pack is:

```text
ltee-lineage-history@v1-e4ff96341b402b13
rootHash: sha256:686fb78ff13b9779864fac16693472385f2f968b9e0bc6aaa377ed92fca2b414
manifestHash: sha256:b9e86f88c29a63a5db9b9e895b36f1f22d22833d82996011f85e8bed353f443f
```

It contains 73 nodes and 150 edges across source, target, evidence-layer,
protocol, source-background, observation, published-statistic, published-
interpretation, source-discrepancy, and boundary layers.

Every generated edge is explicitly:

```text
genealogical: false
causal: false
```

The graph contains no `descends-from`, `inherits-genotype-from`, or `causes`
relation. Model Studio links select the exact registered version rather than
falling back to the user's default model.

## Explorer

`apps/evolutionary-contingency-lab/` is a light-theme public Explorer. It:

- verifies the artifact SHA-256 before rendering;
- rejects redirects, unexpected media types, oversized responses, invalid
  UTF-8, and invalid JSON;
- displays a generation-by-protocol replay matrix;
- distinguishes `observed`, `not-observed`, and `not-run`;
- provides a cell-level inspector and protocol context;
- shows published mean shifts and source-attributed P values;
- exposes the replay-2 expected-mean discrepancy;
- explains the scientific result in plain language;
- identifies LTEE as a candidate extension while presenting the current
  Historical Load result as `null`, never zero.

The browser model independently checks the approved case, source, and snapshot
identities and fails closed for unknown protocol or generation selectors.

## Repository Outputs

```text
cases/ltee-evolutionary-contingency/
apps/evolutionary-contingency-lab/
models/ltee-lineage-history/
docs/cases/LTEE_EVOLUTIONARY_CONTINGENCY_IMPLEMENTATION.md
```

The History Atlas entry, shared case menu, external case page, Model Studio
registry, public-site audit, documentation portfolio, and package scripts all
resolve to these exact outputs.

## Verification

Focused commands:

```sh
npm run case:ltee:verify
npm run model:ltee:verify
node --test cases/ltee-evolutionary-contingency/tests/ltee-evolutionary-contingency.test.mjs
node --test models/ltee-lineage-history/compiler.test.mjs
node --test apps/evolutionary-contingency-lab/evolutionary-contingency-model.test.mjs
```

Repository gates:

```sh
npm test
npm run check
npm run build
```

## Primary Source

- [Blount, Borland, and Lenski (2008), NCBI PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC2430337/)
- [DOI 10.1073/pnas.0803151105](https://doi.org/10.1073/pnas.0803151105)
