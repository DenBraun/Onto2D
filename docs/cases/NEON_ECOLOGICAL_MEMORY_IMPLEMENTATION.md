# NEON Ecological Memory — Implementation Plan

Updated: 2026-08-18

## History Model Metadata

```text
History modes:
    Embodied
    Recorded

Primary effects:
    Present State
    Future

Domain:
    Ecology / long-term observation

Evidence profile:
    disturbance record
    management record
    vegetation measurement
    soil/ecosystem measurement
    repeated site observation

Historical Load:
    Not primary

History Equivalence:
    Possible later

Reachability:
    Primary research direction

Reconstruction:
    Secondary where historical records are incomplete
```

## Purpose

Use NEON long-term ecological measurements and disturbance/management records
to test ecological memory:

```text
disturbance history
    -> ecological legacy
    -> present ecosystem state
    -> future response
```

Primary distinction:

```text
similar present vegetation snapshot
    !=
same disturbance history
```

and potentially:

```text
same present snapshot
    !=
same future response
```

The second claim requires longitudinal evidence and must not be assumed.

## Primary External Sources

NEON Site management and event reporting:

```text
DP1.10111.001
https://data.neonscience.org/data-products/DP1.10111.001
```

This product records land management activities, disturbances, and other
ecologically relevant events across NEON sites.

Candidate state products:

```text
Vegetation structure
DP1.10098.001
https://data.neonscience.org/data-products/DP1.10098.001

Plant presence and percent cover
DP1.10058.001
https://data.neonscience.org/data-products/DP1.10058.001

Soil physical and chemical properties, periodic
DP1.10086.001
https://data.neonscience.org/data-products/DP1.10086.001
```

The first case must pin matching release versions.

## Outputs

```text
cases/ecological-memory/
apps/ecological-memory-lab/
models/ecological-memory/
docs/cases/NEON_ECOLOGICAL_MEMORY_IMPLEMENTATION.md
```

## Non-goals

Do not initially:

- infer ecosystem causation from observational association;
- compare every NEON site;
- infer unrecorded disturbances;
- predict resilience clinically/operationally;
- define one scalar ecological-memory score;
- call two ecosystems identical because a few measurements match.

## Phase 0 — Select One Disturbance Cohort

Choose a bounded site/plot cohort where:

- a fire, flood, drought, grazing, harvesting, or other reported event exists;
- repeated vegetation measurements bracket or follow the event;
- spatial mapping is sufficiently precise;
- data availability is stable across a pinned release.

Prefer one event type for the first release.

## Phase 1 — Pin Releases

Record exact NEON release IDs and DOI where available for every product.

Persist:

```text
event records
plot/location metadata
selected vegetation tables
selected soil tables if used
quality flags
```

Do not combine different release years silently.

## Phase 2 — Native Event Model

Represent:

```text
Site
Plot
Location
DisturbanceEvent
ManagementEvent
EventType
EventTime
ReportedIntensity/Extent when available
EventSource
```

Preserve whether the event came from direct observation or secondary reporting
when the source product exposes that distinction.

## Phase 3 — Ecosystem Observation Model

Represent separately:

```text
VegetationObservation
SpeciesPresence
PercentCover
WoodyIndividual
StructureMeasurement
SoilObservation
ObservationTime
SamplingProtocol
```

Do not collapse observations into one ecosystem-state vector before retaining
the native records.

## Phase 4 — State Projection

Define a bounded, versioned plot-state projection such as:

```text
species richness
selected cover fractions
selected structural measurements
selected soil variables
```

Every variable and normalization rule must be declared.

The projection is not "the full ecosystem state".

## Phase 5 — Canonical Experiments

### Experiment A — Before / After Disturbance

Compare the same plot across a recorded event.

### Experiment B — Similar Snapshot, Different Histories

Search for plot/time observations similar under a declared projection but with
different preceding disturbance/management histories.

### Experiment C — Recovery Trajectory

For one event, display post-disturbance observations over time.

### Experiment D — History Window

Compare:

```text
current observation only
last disturbance
full recorded disturbance window
```

### Experiment E — Future Response

Only if another later disturbance or sufficiently long follow-up exists.

Test whether earlier history improves a bounded descriptive analysis of later
state change.

Do not interpret this as causal proof.

## Phase 6 — Ecological Memory Analysis

Initial case-level concept:

```text
RecordedDisturbanceContext(
    plot,
    observation_time,
    lookback_window
)
```

and:

```text
StateChange(
    observation_A,
    observation_B,
    state_projection
)
```

A later analysis may connect the two statistically.

Keep that connection explicitly model-dependent.

## Phase 7 — Model Pack

Potential:

```text
modelId: ecological-memory
```

Entities:

```text
site
plot
disturbance
management event
observation
species/state measurement
state projection
analysis artifact
```

## Phase 8 — Explorer

Views:

1. Site / Plot
2. Disturbance Timeline
3. Present State Projection
4. Before / After
5. Similar-State Search
6. Recovery Trajectory
7. Evidence / Protocol Inspector

Core visual:

```text
Plot A history ----> State X
Plot B history ----> State ~X

then compare subsequent change
```

## Phase 9 — Negative Tests

Required:

- event absence cannot become "no disturbance";
- secondary report cannot become direct observation;
- sampling gaps remain gaps;
- different protocols/releases cannot be mixed without mapping;
- similar projected state cannot become ecosystem identity;
- disturbance-before-change cannot become causal necessity;
- future observations cannot leak into current-state construction.

## Falsification Criterion

The case fails if Onto2D cannot distinguish recorded ecological history,
embodied present state, and observational evidence without treating
correlation as causation.

## Definition of Done

A pinned NEON site/plot cohort can be replayed with exact event and observation
records, one disturbance/recovery history visualized, and at least one
history-aware state comparison performed under a declared projection.
