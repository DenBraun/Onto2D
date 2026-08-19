# Clinical Trajectories — Implementation

Updated: 2026-08-19

Status: `ANALYSIS_READY`

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

## Implemented Release

The release uses a deterministic five-subject projection from the open
MIMIC-IV Demo v2.2. Selection takes the first five ascending deidentified
`subject_id` values that have at least two admissions, one ICU stay, one
procedure record, one prescription record, and all four declared numeric labs
in the 24 hours ending at the latest ICU `outtime`.

```text
patients:                     5
selected native records:     1,766
cutoff-safe timeline events: 1,981
bounded frames:               5
future events admitted:       0
clinical predictions:         0
```

The selected aliases and exact focus scopes are:

| Alias | `subject_id` | `hadm_id` | `stay_id` |
|---|---:|---:|---:|
| P01 | 10001217 | 27703517 | 34592300 |
| P02 | 10002428 | 23473524 | 35479615 |
| P03 | 10004235 | 24181354 | 34100191 |
| P04 | 10004457 | 23251352 | 31494479 |
| P05 | 10005348 | 25239799 | 34629895 |

The committed source projection is 638,323 bytes with SHA-256
`a8b4e28a9657f595f02620266cf9c5e1278188439e3564c93b07a7c92a8d076b`.
The resulting case identity is
`sha256:3ee8025e6790966cf8a3e66ba3ec54cb6a8032d18e2679c99e6cfaf23fa47760`.

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

Eight compressed upstream files are locked to the SHA-256 values published by
PhysioNet. The source projection and all derived releases rebuild offline.

## Canonical Result

Each alias has two deliberately separate views at the same shifted cutoff:

- a 24-hour bounded frame containing the latest numeric creatinine, potassium,
  sodium, and hemoglobin record;
- the selected admission, transfer, ICU, lab, prescription, and procedure-code
  records available before that cutoff.

P04 and P05 are the nearest complete pair in this five-frame cohort under the
declared metric. Their distance is `0.09`, calculated as the mean normalized
absolute difference across the four labs with fixed scales `1`, `1`, `10`, and
`5`, respectively. This value only says that these four observations are close
under that one projection. It does not establish patient identity, clinical
equivalence, diagnosis, causation, treatment effect, or a future outcome. Their
record-count histories differ, which is the precise representation result the
case exposes.

Historical Load remains `null` / not evaluated. The case declares no finite
clinically meaningful path space, cost function, or history-free baseline, so
displaying zero would be a false result.

## Reproducibility

```sh
python3 cases/clinical-trajectories/prepare-source.py \
  /path/to/mimic-iv-clinical-database-demo-2.2 \
  cases/clinical-trajectories/source/mimic-iv-demo-cohort.json
npm run case:clinical-trajectories:verify
npm run model:clinical-trajectories:verify
```

The exact Model Pack release is `clinical-trajectories@v1-2360048548115b14`:

```text
nodes:         55
edges:         74
root hash:     sha256:0d89eb1db1fa2196b2bd76aff00993d3f4bc2a276b059fbe2381e66fc842450f
manifest hash: sha256:dbb0c48d344df97e5a5ccb172c0aae5799c437b5c43664fd0c52a7c3908c98fd
```

The [Clinical Trajectory Lab](../../apps/clinical-trajectory-lab/) verifies the
case artifact before rendering cohort, frame, history-window, source-row,
similarity, and interpretation-boundary views. Its Model Studio link selects
this exact release rather than the default workspace model.

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

## Implementation Contract

The completed phases below remain the release contract and regression-test
scope.

### Phase 0 — Pin Demo Dataset

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

### Phase 1 — Native Event Model

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

### Phase 2 — Clinical Timeline

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

### Phase 3 — Snapshot Projection

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

### Phase 4 — Historical Context Projection

Create explicit lookback summaries:

```text
prior admissions in demo
prior procedures
prior medication administrations
prior abnormal labs
prior ICU events
```

Do not interpret these as diagnoses or causal history.

### Phase 5 — Canonical Experiments

#### Experiment A — Snapshot vs Trajectory

For one patient, show the current bounded frame next to the preceding event
history.

#### Experiment B — Similar Frame, Different History

If the small cohort contains suitable examples, find patient-time frames similar
under a declared metric but with different preceding histories.

Do not attach a clinical conclusion.

#### Experiment C — History Window

Compare:

```text
current frame
24h history
current admission history
available longitudinal demo history
```

#### Experiment D — Event Provenance

Click any derived timeline event and return to the exact source table/row.

### Phase 6 — Future Analysis Boundary

The first release must not include patient-level outcome prediction.

A later research case may replay a published benchmark with proper train/test
splits, external validation caveats, and no clinical recommendation.

Until then:

```text
Reachability: descriptive only
```

### Phase 7 — Model Pack

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

### Phase 8 — Explorer

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

### Phase 9 — Negative Tests

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
