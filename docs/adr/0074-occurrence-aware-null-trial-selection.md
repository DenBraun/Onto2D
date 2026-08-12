# ADR-0074: Occurrence-aware null-trial selection replay

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0073 preserves proposal multiplicity through unique occurrence IDs and
reruns local predicates. The ordinary cohort, ranking, sensitivity, and
admission pipeline uses canonical candidate IDs as population-member IDs.
Applying it directly to uniform samples with replacement would collapse two
draws of the same canonical graph, corrupt cohort denominators, and undercount
functional and sensitivity evaluations.

The null-model contract also requires each trial to rebuild cohort keys,
functionals, selector extrema, coefficient sensitivity, and final admission.
Copying the observed ranking or applying it to a transformed candidate is not
a valid null comparison.

## Decision

`package-null-model-trial-selections-v1` exactly verifies the local trial
censuses and executes the complete downstream selection pipeline independently
inside every trial. It has primitive and generalized-depth entry points.

The shared cohort boundary now distinguishes population-member identity from
canonical graph identity. Ordinary execution continues to use
`memberId = candidate.id`; null execution uses the occurrence ID. Cohort keys
are evaluated on the proposed candidate graph, while singleton keys and all
membership, ranking tie-breaks, extrema, and admissions use occurrence IDs.
Repeated canonical candidates therefore remain separate members.

For every selector and trial the runtime:

- reconstructs a total occurrence cohort partition or preserves its empty or
  indeterminate state;
- re-evaluates the declared functional for every eligible occurrence;
- produces dense rankings and complete epsilon-extremum sets;
- repeats the complete declared coefficient-sensitivity sweep over occurrence
  membership;
- intersects every selector and emits final occurrence-domain retention and
  indeterminate ratios;
- retains per-metric interpretation, including fragile sensitivity without
  erasing the raw base ranking.

Node-internal quantities remain fixed unless the null hypothesis randomizes
them. Graph-derived functional values and their evidence are recomputed; an
unavailable derived value remains indeterminate rather than being copied. Base
and sensitivity functional work have separate aggregate hard preflights.

The aggregate artifact binds the carrier, source census, trial censuses,
counting domain, selection policy, selector order, all executions, and exact
work counts. Disabled models remain `not-run`. Enabled selection replay reports
`trial-selection-complete` and explicitly leaves metric distributions and
baseline interpretation pending.

## Consequences

- replacement multiplicity survives cohort construction, tie-breaking,
  sensitivity, and final admission;
- ordinary candidate selection retains its prior public artifact and byte
  semantics;
- primitive and arbitrary-depth null trials use the same scientific selector
  contract as their observed run;
- raw variational measurements remain available when sensitivity is fragile,
  with the fragility recorded per metric;
- sample distributions, observed-value comparison, zero-variance handling,
  and closure integration remain the next baseline boundary.

## Verification

Conformance covers all three models, frozen uniform replacement duplicates,
occurrence-to-proposed-candidate functional lineage, complete base-ranking and
admission count reconciliation, actually executed coefficient sensitivity,
fragile metric interpretation, aggregate work ceilings, disabled state,
primitive and generalized-depth replay, exact verification, tampering, kernel
facade methods, public types, compiled JSON Schema, and local Node.js 20/22
execution.
