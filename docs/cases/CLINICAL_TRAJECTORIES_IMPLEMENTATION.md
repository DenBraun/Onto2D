# Clinical Trajectories — Implementation Plan

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
    Clinical medicine / longitudinal EHR

Evidence profile:
    deidentified patient record
    admission/transfer
    lab
    medication administration
    procedure
    ICU observation

Historical Load:
    Not primary

History Equivalence:
    Possible later

Reachability:
    Descriptive only in first release

Reconstruction:
    Secondary
```

## Purpose

Test the distinction between a current clinical snapshot and a longitudinal
patient trajectory.

Primary distinction:

```text
current observed vitals/labs
    !=
complete patient state
```

because prior interventions, admissions, medication exposure, organ injury,
procedures, and disease course may remain relevant to the present.

The first implementation must remain descriptive.

## Primary External Source

Open MIMIC-IV Clinical Database Demo v2.2:

```text
https://physionet.org/content/mimic-iv-demo/2.2/
DOI: 10.13026/dp1f-ex47
```

The demo contains a deidentified subset of 100 patients and shares the schema
shape of MIMIC-IV.

Optional event-stream representation:

```text
MIMIC-IV demo data in MEDS
https://physionet.org/content/mimic-iv-demo-meds/
```

Do not require credentialed full MIMIC-IV for the first reproducible case.

## Outputs

```text
cases/clinical-trajectories/
apps/clinical-trajectory-lab/
models/clinical-trajectories/
docs/cases/CLINICAL_TRAJECTORIES_IMPLEMENTATION.md
```

## Safety / Scientific Boundary

This case must not:

- provide diagnosis;
- recommend treatment;
- predict an individual patient's outcome for clinical use;
- infer treatment effect;
- infer causation from event order;
- re-identify patients;
- rank patients by "risk" without a validated external study;
- make claims beyond the deidentified dataset.

It is a data-model and history-representation experiment.

## Phase 0 — Pin Demo Dataset

Persist/hash the v2.2 demo files used.

Record:

```text
subject IDs selected
admission IDs
ICU stay IDs
tables used
data version
date-shifting limitations
extraction version
```

Use a small cohort, e.g. 5–20 patients, for the first Explorer.

## Phase 1 — Native Event Model

Represent exact records such as:

```text
Patient
Admission
Transfer
ICUStay
LabEvent
MedicationEvent
Procedure
DiagnosisCode
VitalObservation
```

Preserve table and row provenance.

A diagnosis code is a recorded code, not an Onto2D diagnosis assertion.

## Phase 2 — Clinical Timeline

Build a deterministic longitudinal sequence based on deidentified timestamps:

```text
admission
    |
transfer
    |
lab / medication / procedure
    |
ICU events
    |
discharge
```

Respect the dataset's deidentification and shifted-date semantics.

## Phase 3 — Snapshot Projection

Define a limited observation frame such as:

```text
selected latest labs
selected vitals
current location/unit
active recorded medication events
```

Every field and lookback window must be explicit.

The projection must be labelled:

```text
bounded observation frame
```

not `patient state`.

## Phase 4 — Historical Context Projection

Create explicit lookback summaries:

```text
prior admissions in demo
prior procedures
prior medication administrations
prior abnormal labs
prior ICU events
```

Do not interpret these as diagnoses or causal history.

## Phase 5 — Canonical Experiments

### Experiment A — Snapshot vs Trajectory

For one patient, show the current bounded frame next to the preceding event
history.

### Experiment B — Similar Frame, Different History

If the small cohort contains suitable examples, find patient-time frames similar
under a declared metric but with different preceding histories.

Do not attach a clinical conclusion.

### Experiment C — History Window

Compare:

```text
current frame
24h history
current admission history
available longitudinal demo history
```

### Experiment D — Event Provenance

Click any derived timeline event and return to the exact source table/row.

## Phase 6 — Future Analysis Boundary

The first release must not include patient-level outcome prediction.

A later research case may replay a published benchmark with proper train/test
splits, external validation caveats, and no clinical recommendation.

Until then:

```text
Reachability: descriptive only
```

## Phase 7 — Model Pack

Potential:

```text
modelId: clinical-trajectories
```

Entities:

```text
patient pseudonymous identity
encounter
event
observation
procedure
medication record
timeline state
source row
```

Raw large tables may remain external verified artifacts.

## Phase 8 — Explorer

Views:

1. Patient / Encounter
2. Longitudinal Timeline
3. Current Bounded Frame
4. History Window
5. Similar-Frame Comparison
6. Source Provenance
7. Missingness / Data Boundary

Never use UI labels such as:

```text
true patient state
risk
recommended treatment
```

in the initial case.

## Phase 9 — Negative Tests

Required:

- `subject_id` and `hadm_id` scopes cannot be mixed;
- future events cannot leak into current frame/history;
- missing lab cannot become normal lab;
- diagnosis code cannot become confirmed diagnosis automatically;
- medication order/administration semantics must not be conflated;
- shifted dates cannot be interpreted as real calendar dates;
- similar frames cannot become patient identity;
- no derived analysis writes into source records.

## Falsification Criterion

The case fails if Onto2D cannot represent a bounded clinical observation frame
and its longitudinal context separately, or if its generic history machinery
encourages unsupported causal/clinical inference.

## Definition of Done

A pinned open MIMIC-IV Demo cohort can be replayed deterministically, exact
events inspected through a longitudinal timeline, current bounded frames
compared with prior recorded history, and all clinical interpretation kept
outside the source model.
