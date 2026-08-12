# ADR-0080: Current-level round null-model execution

- Status: accepted
- Date: 2026-08-12

## Context

Primitive and generalized-depth closure already executed every configured null
model over the exact census carrier used by the observed level. Bounded
current-level closure changes that carrier after each monotone round, so a
single null baseline evaluated only before or after the fixpoint would describe
the wrong candidate universe. The previous coordinator therefore rejected any
enabled null model and published only `null-models-disabled`.

## Decision

`package-current-level-fixpoint-closure-v2` executes the complete existing
null-model chain independently inside every round:

1. the round's verified current-level census defines the carrier;
2. the plan derives model/trial streams from that census, its current-level
   binding, the normalized run seed, and the round-specific carrier hash;
3. proposal generation preserves the existing role-shuffle, degree-rewire,
   and exact-uniform contracts;
4. every proposed occurrence is filtered with the current-level prepared
   filter session, then repartitioned, rescored, sensitivity-tested, and
   readmitted through the shared verified selector path;
5. the round's observed census and admission are compared with its own trial
   selections to produce per-model distributions and one integrated baseline.

The chain is executed after observed admission and before round interpretation.
An indeterminate baseline makes that round indeterminate under the same
fail-closed interpretation used by ordinary levels. No null sample, metric, or
distribution is pooled across rounds, depths, carrier hashes, or ontology
gates.

`package-current-level-fixpoint-round-v2` embeds its baseline and, when null
models are enabled, the full plan/proposal/trial-census/trial-selection chain.
The enclosing level exposes the terminal round's baseline and null artifacts
beside the separately materialized monotone population. Disabled null models
remain explicit `not-run` results and do not add null artifacts. Exact replay
recomputes every round and therefore verifies the full chain.

The null-model artifact formats remain v1 because their carrier identity was
already generic. Their trial-census schema now admits the current-level filter
evaluation variant in addition to primitive and generalized-depth variants.

## Consequences

- current-level self-referential closure no longer rejects configured null
  models;
- every baseline is tied to the precise candidate carrier it interprets;
- changing the current set changes the next round's streams and hashes without
  making execution-order or replay order semantic;
- terminal level reports cannot accidentally present a baseline from an
  earlier round;
- null-model cost remains bounded by the existing per-chain limits and the
  round count remains bounded independently by `maxIterations`;
- cumulative cross-round profile-collapse statistics remain a separate
  contract and are not inferred from terminal-round null output.

## Verification

Conformance covers enabled and disabled null paths, two distinct fixpoint
round carriers, complete per-round artifact chains, current-level filter
evaluation schemas, terminal-baseline projection, artifact-presence
conditionals, exact replay, capability/status publication, strict Draft
2020-12 schema compilation, and Node.js 20/22 execution.
