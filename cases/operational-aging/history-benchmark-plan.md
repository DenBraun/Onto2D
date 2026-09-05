# Operational Aging — History Matters evaluation plan

Status: EVALUATION_READY for the full-cohort protocol, with independent review
pending and held-out performance not-evaluated. The old selected-pair example
remains ILLUSTRATIVE. The [implemented preparation](history-benchmark/README.md)
freezes observations, training labels, four prediction views and 16 null trials.

The current source-locked demonstration selects units 25/72 using RUL separation
within nearby present observations. Keep it as illustration; it cannot estimate
held-out utility. The source projection retains endpoint data for the cohort
but complete histories only for the selected pair. A full-cohort benchmark
therefore uses the new source preparation path from the exact archive members in
`upstream.json` to cover every engine.

Implemented first profile:

- Population: all eligible FD001 test endpoints, one endpoint per engine, with
  eligibility defined from observations alone. Report all exclusions.
- P0: the last available operating settings and sensor vector; explicitly
  compare a richer present baseline that includes observed age.
- P1: the same frame plus a declared prior-cycle summary/window. Freeze window,
  short-prefix handling and channel selection before evaluating targets.
- Y: supplied test remaining useful life, stored separately and loaded only by
  evaluation. Training targets come from training trajectories with independently
  declared cutoffs; training and test engines cannot share a unit identity.
- Evaluator: deterministic nearest-neighbor regression with scaling fitted only
  on training units, fixed distance/weights, deterministic tie handling and
  no test-driven feature or hyperparameter selection.
- Primary metric: held-out MAE; retain RMSE as declared secondary. Freeze
  resolution/uncertainty, permutation strata, seeds and missing-data policy.
- Null: reassign histories within justified operating-condition strata, preserving
  P and target; do not conflate extra features with correct historical association.

Before joining held-out outcomes, inspect the implemented isolated source/view/target
stages, empirical contract and duplicate/unit separation, and record an
independent leakage review. Publish the full result regardless of direction.
The exact NASA archive has now been verified and a deterministic reference
regressor has prepared predictions for all test endpoints without reading their
RUL table. No predictive advantage or Historical Load follows from preparation.
