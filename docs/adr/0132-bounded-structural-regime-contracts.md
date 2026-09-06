# ADR 0132: bounded structural regime contracts

- Status: Accepted
- Date: 2026-09-06
- Scope: SG2-010, R3 contract foundation

## Context

The [revised program](../structural-geometry/REVISED_ROADMAP.md) needs explicit
observation regimes above compatible MetricProviders. Exact graph equivalence,
lossy topology summaries and locally typed relations have different information
and matching requirements. Source hashes alone cannot serve as relabeling-invariant
observations, and missing evidence cannot establish equality.

## Decision

Add a portable `/regimes` entrypoint with three immutable built-in contracts,
nine mandatory observable specifications, four closed schemas, readonly types
and opt-in engine preparation. Hash semantic policies and observable references
as well as regime IDs. Preserve the existing verified full-source context and
bind explicit full/induced scope with complete boundary-edge accounting.

Use the existing kernel candidate canonicalizer's six-node ceiling for exact
and typed profiles, with constant synthetic node color, constant edge role and
disconnected directed graphs. Serialize sorted type sets into scalar strings
at the future adapter boundary. This translation passes an interface check;
independent equivalence tests remain required before exposing measurements.
The summary profile fixes seven observables and separately permits 64 nodes.
Declare exact budgets and explicit failure instead of approximate fallback.

Preparations explicitly say `not-run`. Do not publish a comparison function,
synthetic status or placeholder distance before evaluators and coverage semantics
exist. Empty probe sets are content-bound declarations, not passing tests.
The [contract](../structural-geometry/REGIME_CONTRACTS.md) specifies the complete
profile and the [review](../structural-geometry/REGIME_CONTRACT_REVIEW.md) records
implementation acceptance.

## Consequences

SG2-010 is complete, while the R3 merge/split gate stays open. SG2-011 exact
canonical observations and independent small-graph checks are next. Topology
collisions, typed vocabulary compatibility and strict missingness require their
own subsequent checks. No kernel operation, numeric geometry result, legacy
artifact, automatic browser execution or public page is changed by this task.
