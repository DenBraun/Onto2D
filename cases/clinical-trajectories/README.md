# Clinical Trajectories

This source-locked case projects a deterministic five-subject cohort from the
open MIMIC-IV Clinical Database Demo v2.2. It tests whether Onto2D can keep a
24-hour bounded observation frame separate from the longer record sequence
available before the same shifted timestamp.

The committed source projection preserves exact table, CSV-row, and native
record identifiers for selected admission, transfer, ICU, laboratory,
prescription, and procedure-code records. The upstream lock pins all eight
input files, the projection, and the exact projection-generator bytes. The
canonical build requires no network access.

Dates are consistently shifted source values, patient identifiers remain
deidentified, prescriptions are not administrations, procedure codes are only
recorded codes, and temporal order is not interpreted as causation. The case is
not a diagnosis, prognosis, treatment recommendation, treatment-effect study,
or patient-level clinical tool.

Rebuild the bounded projection from the official v2.2 download:

```sh
python3 cases/clinical-trajectories/prepare-source.py \
  /path/to/mimic-iv-clinical-database-demo-2.2 \
  cases/clinical-trajectories/source/mimic-iv-demo-cohort.json
```

Build or verify the committed case artifact:

```sh
npm run case:clinical-trajectories
npm run case:clinical-trajectories:verify
```
