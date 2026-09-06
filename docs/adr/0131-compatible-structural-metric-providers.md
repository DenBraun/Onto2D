# ADR 0131: compatible structural metric providers

- Status: Accepted
- Date: 2026-09-06
- Scope: SG2-005 / revised R2

## Context

[ADR 0130](0130-distinguishability-research-program.md) requires provider
identities before regime/probe work, with exact preservation of existing
geometry artifacts. The current unit and inverse-target-share policies supply
numbers; necessity, role and multiplex policies supply discrete selections.
Treating all of them as lengths would change their scientific and numeric
meaning. A caller-provided projection hash alone is insufficient source authority.

## Decision

Add the portable `/providers` subpath to the existing structural-geometry package.
Implement five closed built-in providers: unit, inverse-target-share, necessity
filtration, role subset and typed channels. Descriptors state capabilities,
numeric policy, representation, origin, context requirements and bounds.
Numeric consumers reject discrete view capabilities.

A verified full-source context snapshots the Model Pack and projection. Its
private runtime identity is separate from the serializable binding, which
includes model, projection, full-source normalization and local dictionaries.
Build checks the provided projection and computes from that immutable snapshot.
Artifact verification reconstructs the result from an expected pack and input.

Share the original experiment selection/audit/metric operations through a private
module without changing their formulas, validation semantics or hash domains.
Provider-aware analysis envelopes carry the unmodified legacy root/experiment
artifact and separate metric/view provider identities. Add six closed schemas,
readonly types and explicit engine definitions. Existing entrypoints retain
their v1 output. Ollivier distance policy and flow initialization stay separate.

The [contract](../structural-geometry/METRIC_PROVIDERS.md) was fixed before the
implementation; the [review](../structural-geometry/METRIC_PROVIDER_REVIEW.md)
records compatibility evidence and work limits.

## Consequences

Old root/experiment results replay exactly through the new envelopes; legacy
Ollivier and flow regressions remain mandatory. Dictionary identity does not
create a cross-model vocabulary mapping. Missing or invalid source weights do
not become default lengths. Provider values are positive edge costs, not an
inter-structure metric or a scientific validation result.

Contexts must be recreated from sources after serialization. New providers
need separately reviewed contracts; arbitrary plugins and response-derived
lengths are outside this milestone. Regime/observable contracts are next.
