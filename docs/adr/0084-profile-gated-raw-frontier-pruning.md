# ADR-0084: Profile-gated audited raw-frontier pruning

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0083 composes the complete profile-slot gate with canonical-prefix
pre-admission pruning because both decisions occur after a candidate is
complete. It deliberately leaves raw edge-group and incomplete-node subtree
pruning unavailable: either optimization can skip many descendants before
their complete profile capacities and partner guards have been evaluated.

Treating every skipped descendant as profile-compatible would corrupt
pre-admission counts; treating every one as profile-excluded would corrupt the
composition transcript. Re-evaluating only the visited leaves cannot recover
the disposition of leaves that an authorized frontier removes.

## Decision

Every raw-frontier audit now constructs a separate, content-addressed profile
extension census from the complete graph-policy-admissible reference
traversal. For every strict edge-group or node-assignment prefix it records:

- a domain-separated key over the exact binding, frontier kind, partial
  candidate, and stable prefix coordinates;
- the number of reachable raw extensions that pass the complete profile gate;
- the number of reachable raw extensions that the profile gate excludes.

The census also binds the complete compatible canonical candidate set, the
raw compatible/excluded totals, the profile policy, and its own universe hash.
The predicate frontier audit still samples the full graph-policy-admissible raw
extension frame, so the profile census narrows neither falsification evidence
nor static-proof requirements. Its compatible canonical set must exactly equal
the canonical-prefix audit universe before either audit is accepted.

At execution, an authorized raw frontier must have an exact census entry whose
compatible plus excluded descendants equal the enumerator's independently
computed `remainingRawCandidates`. The generator records that entry with the
pruning decision. A complete-candidate profile session still evaluates every
visited leaf before canonical-prefix pruning; the authoritative complete
profile transcript is reproduced by the pre-admission reference.

Before returning an interpretable result, the recursive edge and node-growth
generators require all of the following:

- skipped compatible plus skipped excluded descendants equal all skipped raw
  descendants;
- visited generated plus skipped raw descendants equal reference generation;
- visited composition exclusions plus skipped profile exclusions equal the
  reference composition transcript;
- visited pre-admission removals plus skipped compatible descendants equal the
  pre-admission reference removals;
- retained CandidateStore, eligible set, and filter-indeterminate set exactly
  match the verified pre-admission and pruning-disabled references.

The same executor and census rules apply at depth one and arbitrary verified
target depths. Depth-aware artifacts additionally bind the reproduced prior
chain, target depth, and selected source population. Incomplete node prefixes
remain fail-closed for `directed-strong` connectivity because later edge
directions can still change graph-policy admission; already strongly connected
edge frontiers retain the existing monotone connectivity rule.

## Consequences

- `profile-slot-gate-v1` can safely compose with audited recursive edge-group
  and node-growth subtree pruning;
- profile and predicate exclusions remain separately countable even when a
  whole raw subtree is never visited;
- every live pruning decision is bound to a reproducible extension census,
  rather than trusting an aggregate estimate;
- the default `post-admission-v1` policy emits the same explicit census shape
  with all raw extensions classified as compatible;
- ordinary closure APIs remain exhaustive until an explicit integration policy
  selects an optimized path.

## Verification

Conformance covers profile-compatible and profile-excluded descendants inside
the same audited frame, exact edge and node frontier lookup, disabled-policy
compatibility, tamper-resistant replay, pre-admission/composition count
reconciliation, retained-store and filtered-result equality, depth-one and
generalized-depth execution, parallel edges and loops, directed-strong
fail-closed behavior, JSON Schema validation, TypeScript declarations, and
Node.js 22 execution.
