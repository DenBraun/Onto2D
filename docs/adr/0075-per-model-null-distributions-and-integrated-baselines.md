# ADR-0075: Per-model null distributions and integrated baselines

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0071 through ADR-0074 produce deterministic null-model plans, proposal
occurrences, refiltered trial censuses, and complete occurrence-aware selector
results. Those artifacts still do not compare trial metrics with the observed
run. A research baseline needs a reproducible distribution contract, must not
pool incompatible null hypotheses, and must preserve empty, fragile, missing,
and constant samples without fabricating a standardized effect.

The ordinary primitive and generalized-depth coordinators previously rejected
configured null models even though all execution stages below the statistical
comparison were available. Leaving that rejection in place would keep a
completed baseline outside the actual closure result and allow callers to
accidentally compare artifacts from different carriers or run identities.

## Decision

`package-null-model-baseline-v1` exactly verifies the observed census and
admission plus the complete plan/proposal/trial-census/trial-selection chain.
It groups samples strictly by null-model ID; models, carrier populations, and
ontology gates are never pooled.

For each model it summarizes Boolean selectivity, selection retention, overall
retention, indeterminate ratio, and every declared selector's variational
selectivity. Trial IDs define the fixed sample order. Means and sample standard
deviations use compensated binary64 summation, with the standard deviation
denominator `n - 1`. The standardized effect is
`(observed - nullMean) / sampleSd`.

The following states are explicit:

- fewer than two complete samples retain the mean, set `sd` and `z` to
  `null`, and record that sample standard deviation requires two runs;
- zero sample variance sets `z` to `null` and records whether the observed
  value equals, differs from, or is unavailable against the constant null;
- an unavailable observed or trial metric makes that metric indeterminate;
  the implementation never reduces the denominator silently;
- fragile observed or trial sensitivity retains the raw distribution but
  marks the affected summary and model indeterminate;
- disabled null models remain the compact closure state
  `{ status: "not-run", reasons: ["null-models-disabled"] }`.

Each distribution has its own domain-separated identity, and the aggregate
baseline binds the exact trial-selection artifact that supplies its samples.
Primitive and generalized-depth constructors and verifiers use the same
contract.

`package-level-closure-v1` and `package-depth-level-closure-v1` now execute the
entire null chain when `RunConfig.nullModels` is non-empty. They embed plan,
proposals, trial censuses, and trial selections under `artifacts.nullModels`
and store the verified baseline on the level. A non-empty materialized level
with an indeterminate baseline has an explicit `baseline-indeterminate`
interpretation reason. An empty materialized level remains `empty`; its
unavailable baseline does not erase the more precise empty-domain terminal.

Bounded current-level fixpoint closure originally remained fail-closed because
its round-specific census carrier differs from the completed primitive or
prior-depth carrier. ADR-0080 subsequently closes that boundary with
independent round-local carriers and terminal-round projection.

## Consequences

- an enabled ordinary or generalized-depth closure is now a self-contained,
  replayable research baseline rather than a collection of caller-joined
  intermediate artifacts;
- replacement multiplicity and metric interpretation flow unchanged from the
  trial artifacts into per-model distributions;
- one-run and zero-variance cases are reportable without infinite or invented
  z-scores;
- disabled development runs retain their previous compact baseline bytes and
  do not acquire unused null artifacts;
- current-level fixpoint null execution is subsequently implemented by
  ADR-0080 without approximating, reusing, or pooling the wrong carrier.

## Verification

Conformance covers model separation, deterministic trial ordering, sample
standard deviation, zero variance, observed-constant relations, missing and
fragile metrics, disabled state, primitive and generalized-depth exact replay,
tampering, public kernel methods and types, compiled JSON Schema, configured
primitive/depth closure integration, closure schema conformance, and local
Node.js 22/24 CI execution.
