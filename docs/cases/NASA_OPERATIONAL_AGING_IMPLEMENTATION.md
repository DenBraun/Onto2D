# NASA Operational Aging — Implementation Plan

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
    Mechanical prognostics / aerospace

Evidence profile:
    simulated operational trajectory
    sensor measurement
    operational setting
    run-to-failure outcome
    provided RUL ground truth

Historical Load:
    Not primary

History Equivalence:
    Possible later

Reachability:
    Primary

Reconstruction:
    Secondary
```

## Purpose

Use NASA C-MAPSS run-to-failure engine trajectories to test a clean form of
embodied historical state:

```text
operational history
    -> latent degradation
    -> current measurements
    -> remaining useful life
```

Primary distinction:

```text
similar current observation
    !=
same historical state
    !=
same future lifetime
```

## Primary External Source

NASA Open Data:

```text
https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data
```

The dataset contains multiple engine time series, operational settings, sensor
measurements, run-to-failure training trajectories, and Remaining Useful Life
targets for test trajectories.

Use the downloadable C-MAPSS dataset, not the currently unavailable C-MAPSS
simulator package.

Optional later source:

NASA Prognostics Center of Excellence fatigue/crack-growth datasets.

## Outputs

```text
cases/operational-aging/
apps/operational-aging-lab/
models/operational-aging/
docs/cases/NASA_OPERATIONAL_AGING_IMPLEMENTATION.md
```

## Initial Dataset

Start with:

```text
FD001
```

because it has one operating condition and one fault mode.

Only move to FD002–FD004 after the history semantics are verified.

## Phase 0 — Pin Dataset

Persist and hash:

```text
CMAPSSData.zip
train_FD001
test_FD001
RUL_FD001
dataset documentation
```

Record the NASA source URL and source metadata.

## Phase 1 — Native Trajectory Model

Represent:

```text
EngineUnit
OperationalCycle
OperationalSetting
SensorObservation
Trajectory
FailureEndpoint
ProvidedRUL
```

A cycle is an observation index, not automatically a causal event.

## Phase 2 — Observation Frame

Define an explicit current observation projection:

```text
selected operational settings
selected sensor vector
cycle index optionally hidden
```

This allows comparison of engines that appear similar under a limited frame.

## Phase 3 — Historical State

Do not pretend the true simulator health state is directly observed.

Represent:

```text
RecordedHistory:
    all prior cycles / settings / sensor observations

LatentHistoricalState:
    unknown unless explicitly available

DerivedDegradationFeatures:
    analysis artifacts only
```

## Phase 4 — Canonical Experiments

### Experiment A — Similar Snapshot, Different RUL

Search the pinned training/test cohort for pairs of observation frames close
under a declared distance profile but associated with different remaining
lifetime.

The distance metric and threshold must be explicit.

### Experiment B — Same Unit Over Time

Show how current measurements evolve along one run-to-failure history.

### Experiment C — History Window Ablation

Compare analysis using:

```text
current frame only
last N cycles
full observed trajectory
```

Measure how much additional historical context changes a bounded RUL estimator
or nearest-neighbor relation.

### Experiment D — Operating Context

Demonstrate that sensor similarity must not ignore declared operating settings.

## Phase 5 — History-Conditioned Reachability

Initial form:

```text
FutureFailureHorizon(
    current_observation,
    recorded_history,
    analysis_profile
)
```

This is a descriptive benchmark analysis.

Do not promote it to a universal physical relation.

## Phase 6 — Prediction Boundary

If a predictor is included:

- use a transparent baseline first;
- keep training/test separation exact;
- report error;
- version features and model;
- do not treat predicted RUL as ground truth;
- do not interpret feature importance as physical causation.

The case is still valid without a sophisticated ML model.

## Phase 7 — Model Pack

Potential:

```text
modelId: operational-aging
```

Entities:

```text
engine unit
cycle
operational setting
sensor frame
trajectory
failure endpoint
RUL observation
analysis artifact
```

Avoid putting all raw numeric arrays into generic node properties if a verified
external artifact reference is cleaner.

## Phase 8 — Explorer

Views:

1. Engine Trajectory
2. Current Sensor Frame
3. Similar Snapshot Search
4. Historical Context
5. Remaining Useful Life
6. History Window Comparison
7. Evidence / Ground Truth

Core visual:

```text
Engine A: similar current sensors -> RUL A
Engine B: similar current sensors -> RUL B

history(A) != history(B)
```

## Phase 9 — Negative Tests

Required:

- test RUL cannot leak into model inputs;
- future cycles cannot enter historical features;
- close sensor distance cannot become exact state identity;
- predicted RUL remains distinct from provided RUL;
- operating settings cannot be silently discarded;
- engine units cannot be merged across trajectories;
- cycle order mutation changes history identity.

## Falsification Criterion

The case fails if Onto2D cannot represent the difference between an observation
frame and a trajectory-conditioned state, or if it requires latent degradation
to be directly observed.

## Definition of Done

The pinned FD001 dataset can be replayed deterministically, engine histories
inspected, current-frame similarity compared with future lifetime, and all
ground-truth, derived, and predicted values kept epistemically separate.
