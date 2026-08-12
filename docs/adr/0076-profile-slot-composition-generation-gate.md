# ADR-0076: Profile-slot composition generation gate

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0038 and ADR-0070 define deterministic residual-slot consumption and typed
partner-guard evaluation after selector admission. Candidate generation,
however, previously enumerated every graph admitted by the graph policy even
when its constituent profiles had no compatible role capacity or a typed guard
definitely rejected the partner profile. Applying those constraints only after
selection wastes a bounded universe and makes the generated denominator wider
than the explicitly requested compositional universe.

The existing pruning proofs cover complete-node edge prefixes and raw
edge-group frontiers under the graph/predicate extension model. Adding profile
capacity state or guard outcomes to those partial frontiers changes that model;
the existing audit hashes therefore cannot authorize such pruning without a
separate proof contract.

## Decision

Normalized `RunConfig` now contains an identity-bearing
`profileCompositionPolicy`. Its compatibility default is `post-admission-v1`,
which retains the pre-ADR-0076 generated universe. Callers opt into
`profile-slot-gate-v1` when candidate composition itself must respect the
bound source profiles.

The opt-in gate evaluates each complete canonical candidate before it reaches
`CandidateStore`. It uses the same deterministic allocation policy as residual
profile extraction:

- canonical edge order;
- source endpoint before target endpoint;
- exact endpoint polarity before `sym`, then ascending slot index;
- one capacity unit per directed edge endpoint;
- typed partner guards over every member of the complete partner profile
  class.

A missing compatible role/polarity/capacity or a definitely failed guard
excludes the complete candidate and increments a separate
`compositionExcludedCandidates` count. An indeterminate typed guard, a legacy
guard hash, incomplete class membership, or inconsistent binding aborts the
whole generation. It never turns unknown compatibility into a smaller
apparently complete denominator.

Every unique canonical decision retains its candidate identity, slot
consumptions, guard-evaluation hashes, outcome, and reason. The aggregate
`package-profile-composition-gate-v1` artifact reconciles compatible,
incompatible, indeterminate, and excluded-raw counts under dedicated hash
domains. The disabled policy still emits a compact content-addressed
`not-run` artifact, so the active policy and its absence are both explicit.

Primitive, arbitrary-depth, and bounded current-level-fixpoint generation use
the same gate. This ADR did not authorize pruning under the opt-in policy.
ADR-0083 later composes the complete decision with canonical-prefix pruning;
ADR-0084 independently freezes the complete profile-state extension census
required before raw edge or node subtrees may be skipped.

The low-level decorator exposes the complete-candidate callback only as an
internal kernel boundary. The public generic enumerator remains independent of
package profiles and reports zero composition exclusions.

## Consequences

- callers can choose a reproducible generated universe whose members are all
  definitely composable under their bound source profiles;
- compatibility behavior and legacy byte behavior remain explicit instead of
  changing silently for existing runs;
- excluded compositions never enter `CandidateStore`, candidate deduplication,
  local-filter selectivity, or downstream admission denominators;
- complete-candidate canonicalization currently runs once for the gate and
  again at the store boundary; this preserves the store's independent trust
  contract at the cost of bounded duplicate work;
- guard-aware generation does not imply guard-aware partial pruning.

## Verification

Conformance covers default materialization and normalization order, capacity
exhaustion, directed endpoint polarity, symmetric fallback, typed guards over
complete profile classes, deterministic decision transcripts, legacy-guard
failure, primitive/depth/current-level integration, explicit pruning rejection,
count reconciliation, public TypeScript declarations, compiled JSON Schema,
runtime artifact schema validation, exact downstream replay, and local Node.js
20/22 execution.
