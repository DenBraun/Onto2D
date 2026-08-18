# Chemical Synthesis History — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Recorded

Primary effects:
    Identity

Domain:
    Chemistry

Evidence profile:
    direct-record
    derived
    inferred
    counterfactual
    unknown

Historical Load:
    Bounded candidate

History Equivalence:
    Primary

Reachability:
    Not primary

Reconstruction:
    Not primary
```

## Purpose

Create the first non-IT external Onto2D case using real structured chemical reaction records.

Primary distinction:

```text
molecular identity
    !=
synthesis-route identity
```

A target molecule may be reached through different sequences of reactions, reagents, intermediates, conditions, workups, and yields.

## Implemented Result

The first release is complete and source-locked to ORD data v0.1.0 at commit
`8b83754b865c8a9f30667fbea4dfdc892d4dad60` with the release workflow's
ord-schema v0.3.10 pin.

Two bounded cohorts serve different questions:

- all five exact product-SMILES groups in the 4,312-record Ahneman dataset,
  represented by deterministic minimum/maximum measured-yield records;
- the complete three-record islatravir cascade, whose later inputs contain
  native cross-references to earlier reaction records.

The resulting 13-record projection, case artifact, Model Pack, and light-theme
Explorer reproduce offline. Exact source-string equality is deliberately
stricter than canonical chemical equivalence and never creates physical-batch
continuity. The bounded islatravir analysis resolves Historical Load as +2
reaction records or +2 recorded intermediates relative to a declared direct
shortcut; that shortcut is not a chemical-feasibility claim.

## Primary External Source

Open Reaction Database (ORD).

Reference documentation:

```text
https://docs.open-reaction-database.org/en/stable/schema.html
https://docs.open-reaction-database.org/en/stable/overview.html
```

ORD reaction records expose structured fields for inputs, setup, conditions, observations, workups, outcomes, provenance, and reaction identity.

The implementation must pin a concrete ORD data snapshot before extraction.

## Outputs

```text
cases/chemical-synthesis-history/
apps/synthesis-route-explorer/
models/chemical-reaction-provenance/
docs/cases/CHEMICAL_SYNTHESIS_HISTORY_IMPLEMENTATION.md
```

## Non-goals

Do not initially:

- build a general retrosynthesis engine;
- predict unknown reactions;
- infer reaction mechanisms;
- assign synthetic feasibility from a language model;
- equate recorded reaction order with chemical necessity;
- treat missing ORD data as a failed reaction;
- claim a universal chemical Historical Load.

## Phase 0 — Select a Bounded Target Cohort

Select a small set of target compounds satisfying:

- at least two independently recorded synthesis routes or route fragments;
- machine-readable stable structural identifiers;
- sufficient reaction records to reconstruct multi-step paths;
- manageable chemistry for manual review.

Prefer 3–10 target compounds for the first release.

Record selection criteria before choosing final examples.

## Phase 1 — Pin ORD Evidence

Create:

```text
cases/chemical-synthesis-history/upstream.json
```

Record:

- ORD dataset/snapshot identity;
- exact dataset files;
- hashes;
- ord-schema version;
- extraction version;
- target selection;
- excluded records and reasons.

Do not follow the live ORD repository implicitly after the case is frozen.

## Phase 2 — Native Reaction Extraction

Preserve native records before graph construction.

Extract at minimum:

```text
reaction_id
identifiers
inputs
conditions
workups
outcomes
desired products
yield/purity where available
provenance
cross-referenced synthesized inputs
```

Preserve units and uncertainty/precision fields.

Do not normalize chemistry destructively.

## Phase 3 — Compound Identity

Define explicit target identity profiles.

Candidate profiles:

```text
exact canonical structure identity
stereochemistry-sensitive identity
stereochemistry-insensitive identity
record-identifier identity
```

The default first case should be strict enough that route convergence is not an artefact of over-aggressive normalization.

Every normalization rule must be versioned.

## Phase 4 — Reaction Graph

Construct a bounded graph:

```text
Compound / Material State
        |
     Reaction
        |
     Product
```

Separate:

```text
recorded product relation
cross-reaction reference
derived compound-identity match
inferred route connection
```

A matching compound identifier across records is not automatically proof that one physical batch flowed into the next reaction.

## Phase 5 — Route Identity

Represent each synthesis route as an ordered path of reaction records and intermediate compound identities.

Support:

```text
route identity
step count
unique intermediate count
condition profile
recorded yield profile
provenance coverage
```

Keep route identity distinct from molecular target identity.

## Phase 6 — Canonical Experiments

### Experiment A — Same Target, Different Routes

Show:

```text
Route A ----\
            > Target X
Route B ----/
```

with the same declared molecular identity but different path identity.

### Experiment B — Different Intermediates

Find routes differing in at least one intermediate.

### Experiment C — Different Conditions

Compare routes converging on the same target under different temperature, pressure, catalyst/reagent, or workup histories.

### Experiment D — Route Equivalence

Define a regime in which routes are considered equivalent only under explicit criteria.

Examples:

```text
same target only
same target + same reaction count
same target + same intermediate identities
same target + same recorded transformation sequence
```

No global route-equivalence rule.

## Phase 7 — Admissibility

Introduce a finite declared path space only after recorded routes work.

Candidate constraints:

```text
recorded-only
available-starting-material set
temperature bound
pressure bound
forbidden reagent class
minimum recorded yield
maximum step count
```

Every constraint must state whether it is:

```text
source-derived
experiment-defined
onto2d-defined
```

Avoid encoding laboratory safety policy without a reviewed external source.

## Phase 8 — Historical Load

This is a suitable first non-IT Historical Load case.

For target `x` and finite route space `H`:

```text
dH(x | F) = aF - a0
```

Possible cost functions:

```text
reaction-step-count
distinct-intermediate-count
recorded-workup-count
condition-transition-count
```

Do not use economic cost or hazard scores in the first release unless supported by explicit reviewed data.

No numeric result without:

- target identity;
- route-space identity;
- ORD snapshot;
- cost function;
- admissibility regime;
- analysis version.

## Phase 9 — Model Pack

Create:

```text
modelId: chemical-reaction-provenance
```

Possible entities:

```text
compound
reaction record
reaction input
reaction outcome
workup
condition profile
provenance record
route
```

Keep native ORD IDs.

## Phase 10 — Explorer

Main views:

1. Target Identity
2. Route Graph
3. Route A / Route B Comparison
4. Conditions and Workups
5. Provenance Coverage
6. Admissibility
7. Historical Load

A selected target should make it visually obvious that:

```text
same target molecule
does not imply
same synthesis history
```

## Phase 11 — Negative Tests

Required:

- structure normalization cannot silently merge stereochemically distinct targets;
- route order mutation changes route identity;
- same target does not imply same route;
- absent yield stays missing;
- missing provenance stays missing;
- compound-identity matching cannot be presented as physical batch continuity;
- counterfactual routes never enter upstream artifacts;
- Historical Load refuses an undeclared route space.

## Falsification Criterion

The case fails if Onto2D cannot represent one molecular identity with multiple distinct recorded construction histories without duplicating or corrupting the target identity.

## Definition of Done

A pinned ORD snapshot yields at least one reviewed target with multiple reproducible route representations, explicit source evidence, route comparison, and a bounded declared admissibility experiment.
