# ADR-0058: Integrated verified level-result census

- Status: accepted
- Date: 2026-08-12

## Context

Ordinary and depth-aware level closures already contain the complete local
candidate census, selector admission, selected formations, derived profiles,
and materialized population. Their values are reproducible, but consumers must
still join several embedded artifacts to obtain the final `LevelResult` counts
and selectivity views described by the architecture. Repeating those joins in
reports or a future visualization would create another opportunity for count,
run, or level drift.

The kernel needs one compact final census boundary. It must integrate only
already verified facts and must not introduce null baselines, scientific
interpretations, or presentation-specific values.

## Decision

`package-level-result-census-v1` accepts a loaded package, RunConfig, one
ordinary or depth-aware closed level, any required prior-level chain, and the
same execution limits used by closure. It first reproduces the complete level.
An ordinary depth-one level rejects prior levels; a depth-aware level requires
the exact contiguous chain used to produce its source population.

Before emitting an artifact, the integrator reconciles:

- generated, canonical, evaluated, rejected, indeterminate, eligible,
  excluded, selected, and final-indeterminate candidate counts;
- selected candidates with formations, profile results, and materialized
  elements;
- the level metrics with their local-census and selector-admission sources;
- selector census coverage with the recorded execution count;
- target depth, admitted element IDs, and every embedded artifact hash.

The result preserves Boolean, variational, selection, overall, and
indeterminate ratios; complete predicate and selector censuses; admitted
element IDs; the explicit disabled-baseline record; and the already recorded
level/local/admission/selector interpretations. It does not reinterpret those
values. The complete artifact is hashed in
`onto2d:package-level-result-census:v1`.

This closes the `integrated-level-result-census` capability. It is a semantic
kernel artifact suitable as an input to later run bundles and reports, but it
does not implement persistence.

## Consequences

- A consumer no longer has to reconstruct final census values by hand.
- Ordinary and arbitrary target-depth outputs share one portable result-census
  contract.
- Self-consistent but stale or tampered closures are rejected by exact replay.
- Raw selectivity remains separate from its frozen interpretation status.
- Null-model execution and source explanations remain separate kernel gates;
  physical writing and presentation remain application gates. ADR-0059 later
  adds semantic bundle materialization and the verified external-store index.

## Rejected alternatives

- Copying the complete level artifact was rejected because it would add no
  integrated boundary and would duplicate large candidate explanations.
- Recomputing only from embedded hashes was rejected because hashes alone do
  not prove the upstream package/run/level chain.
- Inventing metric interpretations in the integrator was rejected because the
  verified source stages already own those decisions.
- Adding chart labels or layout data was rejected because presentation is
  outside the kernel and remains deferred until closure completion.

## Acceptance artifacts

- ordinary depth-one and verified depth-two fixtures;
- exact count, selectivity, selector, and admitted-element reconciliation;
- prior-level-chain and tamper rejection;
- independent result-census hash reproduction;
- public kernel, TypeScript, and JSON Schema contracts;
- runtime schema conformance and Node.js 22/24 CI repository verification.
