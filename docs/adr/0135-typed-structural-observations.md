# ADR 0135: typed structural observations and explicit vocabulary alignment

- Status: Accepted
- Date: 2026-09-06
- Scope: SG2-013 / R3 typed observation and vocabulary compatibility

## Context

SG2-010 froze five typed edge fields under one common node bijection. Exact
untyped and topology observations are implemented. Local code equality does
not establish cross-source semantic equality, and missing fields must not
be silently replaced by defaults or empty sets.

## Decision

Add `/typed` to the structural-geometry package. Reuse the unchanged kernel
canonicalizer with the frozen directed typed translation. Encode sorted sets
as canonical JSON scalar strings and decode them in public values/witnesses.
Audit all present fields in the full verified source. Preserve untyped results
and explicit scoped field gaps if the typed observation cannot be measured.

Bind the full source dictionary and exact model identity as local vocabulary
provenance. Treat canonical raw-code hashes as syntactic fingerprints. Do not
invent a universal dictionary schema or infer semantic authority from labels.

Add explicit source-bound partial-bijection mappings across all five fields.
Mappings declare review-evidence references but cannot approve themselves.
Alignment requires the exact same source vocabulary or an externally accepted
mapping hash supplied by trusted caller policy. Check both-sided scoped coverage
and rerun joint canonicalization after remapping right codes into the left
vocabulary. Incomplete evidence/compatibility leaves aligned values null;
invalid artifacts raise validation errors.

Keep observation, mapping and alignment contracts separate from final comparison
statuses and distances. Add five closed schemas, readonly/browser/engine APIs,
26 observations, five mappings, eight alignment controls and independent
permutation verification. Preserve all previous contracts and scientific bytes.
See the [contract](../structural-geometry/TYPED_OBSERVATIONS.md) and
[review](../structural-geometry/TYPED_OBSERVATION_REVIEW.md).

## Consequences

All three initial regimes now have observation evaluators. R3 remains open until
SG2-014/015 implement strict comparison/status/coverage behavior and its combined
split/merge controls. Probe/signature work and the site remain later gates.
Alignment compatibility is neither graph equality nor a global metric-domain
guarantee. Domain mapping review and empirical validation remain external work;
synthetic fixture approval is explicitly labeled test authorization.
