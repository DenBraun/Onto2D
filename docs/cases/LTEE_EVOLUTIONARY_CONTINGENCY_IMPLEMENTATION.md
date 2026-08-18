# LTEE Evolutionary Contingency — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Embodied
    Recorded
    Reconstructed

Primary effects:
    Future
    Present State
    Identity

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
    Not primary

History Equivalence:
    Possible

Reachability:
    Primary

Reconstruction:
    Secondary
```

## Purpose

Use the E. coli Long-Term Evolution Experiment (LTEE) to test a stronger form of historical dependence:

```text
prior history
    changes
future accessibility
```

This case is not primarily a Historical Load experiment. It is a history-conditioned reachability experiment.

## Primary External Sources

LTEE project site:

```text
https://lenski.mmg.msu.edu/ecoli/
https://lenski.mmg.msu.edu/ecoli/overview.html
```

Key citrate innovation study:

```text
https://www.nature.com/articles/nature11514
```

Additional genomic/replay datasets and publications must be pinned before use.

## Outputs

```text
cases/ltee-evolutionary-contingency/
apps/evolutionary-contingency-lab/
models/ltee-lineage-history/
docs/cases/LTEE_EVOLUTIONARY_CONTINGENCY_IMPLEMENTATION.md
```

## Core Scientific Distinctions

Represent separately:

```text
common ancestor
population lineage
sample generation
genotype
phenotype
fitness measurement
historical background
observed innovation
replay result
causal interpretation
```

Do not convert phylogenetic sequence into necessity automatically.

## Phase 0 — Bounded Scientific Question

The first release should focus on a single reviewed question:

> How does historical genetic background relate to the accessibility of aerobic citrate utilization in the Ara-3 lineage and replay experiments?

Do not model all 12 populations and all LTEE findings initially.

## Phase 1 — Pin Evidence

Freeze a finite evidence package containing:

- ancestral strain/sample identifiers;
- selected Ara-3 samples;
- generation numbers;
- selected genome/genotype records;
- citrate phenotype state;
- replay-experiment results;
- publication references;
- extraction/manual mapping version.

Where raw data are unavailable or too large, store stable source identifiers and a reviewed bounded derived fixture with complete provenance.

## Phase 2 — Native Historical Timeline

Represent:

```text
Population
Sample
Generation
Parent/ancestry relation
Genotype observation
Phenotype observation
Fitness observation
```

Frozen samples are historical observations, not counterfactual states.

## Phase 3 — Citrate Innovation Epochs

Represent the published conceptual distinction:

```text
potentiation
actualization
refinement
```

but retain evidence status for each relation.

Do not imply that every potentiating event is known or necessary.

Allow:

```text
known
supported
candidate
unknown
```

## Phase 4 — Replay Evidence

Represent evolutionary replay as a separate experimental object:

```text
ReplayExperiment
StartingHistoricalSample
Conditions
Replicates
ObservedOutcome
OutcomeFrequency
```

This is critical. A replay result is evidence about accessibility from a historical background, not the historical event itself.

## Phase 5 — History-Conditioned Reachability

Introduce a case-level analysis:

```text
Reachable(outcome | historical_state, experiment_profile)
```

The first implementation should remain descriptive.

Possible outputs:

```text
observed in replay
not observed in bounded replay
frequency estimate
unknown
```

Do not translate `not observed` into `impossible`.

## Phase 6 — Canonical Experiments

### Experiment A — Shared Ancestral Experiment

Show the parallel LTEE populations originating from closely related initial backgrounds and diverging over time.

### Experiment B — Citrate Lineage

Show the historical branch leading to the citrate innovation.

### Experiment C — Replay Comparison

Compare replay experiments started from different historical generations.

### Experiment D — Accessibility Boundary

Visualize historical backgrounds from which the innovation was more or less accessible under the published replay protocol.

### Experiment E — Current State vs Historical Potential

Where data permit, compare phenotypically similar pre-Cit+ states with different replay accessibility.

## Phase 7 — New Onto2D Analysis Boundary

Do not immediately create a kernel concept named `Historical Accessibility`.

Implement an external analysis package first, for example:

```text
@onto2d/history-conditioned-reachability
```

only if the case requires reusable code.

The analysis artifact must declare:

- target outcome;
- starting historical state;
- experiment profile;
- observed replay evidence;
- uncertainty;
- source set.

## Phase 8 — Historical Load Policy

Do not compute general Historical Load over evolution. The biological possible-path space is not enumerated.

A Historical Load value is permitted only for a deliberately bounded toy or experimental mutation graph clearly separated from the LTEE empirical record.

## Phase 9 — Model Pack

Potential model:

```text
modelId: ltee-lineage-history
```

Entities:

```text
population
historical sample
generation
genotype observation
phenotype observation
replay experiment
replay outcome
published interpretation
```

## Phase 10 — Explorer

Views:

1. LTEE Timeline
2. Population Branches
3. Frozen Historical Samples
4. Citrate Innovation
5. Replay Experiments
6. History-Conditioned Reachability
7. Evidence Inspector

A central visual should show:

```text
earlier state ---- replay ----> outcome distribution
later state  ---- replay ----> outcome distribution
```

## Phase 11 — Negative Tests

Required:

- absence in replay cannot become impossibility;
- temporal precedence cannot become genetic necessity;
- potentiation label must retain publication evidence;
- replay history cannot be confused with original LTEE history;
- phenotype identity cannot silently imply genotype identity;
- current fitness cannot replace historical accessibility;
- uncertain causal relations remain uncertain.

## Falsification Criterion

The case fails if Onto2D cannot represent historical state as conditioning future experimental reachability without claiming that the current state alone contains a complete causal explanation.

## Definition of Done

A bounded LTEE citrate case can reproduce the selected historical timeline, link frozen samples and replay experiments, and expose how replay outcomes depend on starting historical background while preserving uncertainty and published evidence.
