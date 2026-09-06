# ADR 0127: Typed structural metric experiments

- Status: Accepted for computational experiments; metric promotion unestablished
- Date: 2026-09-06

## Decision

Implement stage 3 under the [experiment contract](../structural-geometry/METRIC_EXPERIMENTS.md),
above the unchanged unit geometry foundation. Keep all source nodes in every
selection, account for excluded edges, use nested necessity regimes, treat role
subsets as a lattice, and expose dictionary-local relation channels separately.

Audit source Weight locally by incoming parent population. Add an explicitly
selected inverse-target-share metric with full-source normalization fixed across
all selections. Invalid weights fail the weighted path rather than becoming
epsilon values; known non-unit sums remain source findings. Unit stays default.

Use exact decimal fractions and outward integer square-root bounds for weighted
directed Forman curvature. Bind the numeric policy and serialize integer ticks,
including uncertainty around zero and comparisons. Keep new experiment and
audit schemas/hashes separate from the original unit artifacts.

## Consequences

The suite compares graph selections and a declared metric hypothesis without
inventing a global Weight scale, lifecycle ordering, confidence score or causal
interpretation. All filtered runs replay against the full exact source pack.
Directed component statistics are descriptive connectivity, not persistence.
Reference agreement and sensitivity checks complete the computational stage;
they do not satisfy the scientific gate for changing the default metric.
