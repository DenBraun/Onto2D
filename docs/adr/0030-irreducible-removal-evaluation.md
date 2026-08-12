# ADR-0030: Deterministic irreducible-removal evaluation

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

The predicate language already normalizes `irreducibleRemoval(P, removal)` and
the run configuration freezes a `SubstructurePolicy`, but the local runtime
rejects every substructure combinator. Gate B of the foundational Level-0 case
requires node-removal irreducibility in addition to whole-candidate balance and
loop conditions. A removal verdict must not depend on input labelling, silently
treat an invalid removal as a failed inner predicate, or omit the concrete
substructures that justify the result.

## Decision

`local-predicate-evaluator-v10` executes `irreducibleRemoval` for complete
canonical candidates under the run's explicit substructure policy.

- The requested `node` or `edge` removal must be permitted by the policy's
  `remove` field. Policy mismatch fails before any removal is evaluated.
- The evaluator first evaluates the nested predicate on the whole candidate.
  A whole-candidate failure makes the combinator fail; an indeterminate whole
  result makes it indeterminate. Removals are enumerated only after a whole
  pass because they cannot change either result.
- Every canonical parent node or edge is removed exactly once in ascending
  parent-index order. Node removal also removes incident edges. When
  `retainIsolatedNodes` is false, all nodes with no remaining incident edge are
  removed before normalization.
- Empty removals are evaluated only when `includeEmpty` is true. Their identity
  uses `onto2d:substructure:v1` because an empty graph is not a valid standalone
  candidate. Non-empty removals use the existing candidate canonicalizer with
  the parent graph policy except that disconnected input is admitted for
  normalization; predicate connectivity still uses the original projection.
- A disconnected removal is evaluated only when `includeDisconnected` is
  true. Excluded empty or disconnected removals are recorded as skipped and do
  not enter the evaluated denominator.
- For a whole pass, any passing removal makes the combinator fail; otherwise
  any indeterminate removal makes it indeterminate; otherwise all evaluated
  removals failing makes it pass. Zero evaluated removals is indeterminate,
  rather than a silent vacuous pass.
- Successful and unsuccessful witnesses retain the whole nested result, every
  attempted parent removal, retained parent node/edge indexes, canonical-to-
  parent mappings, normalized substructure identity, nested outcome, and nested
  witnesses. This keeps removal evidence auditable across canonical relabelling.
- Nested substructure evaluation shares a hard limit of 10,000 attempted
  removals per top-level evaluation. Runtime invariants inside a removed
  substructure remain rejected until missing-node and profile-subset semantics
  are frozen; graph predicates and the already supported structural numeric
  subset are executable.

The local artifact binds the normalized substructure policy and moves to hash
domain `onto2d:predicate-local-evaluation:v10`. Package filtering embeds these
artifacts and therefore moves to `package-candidate-filter-evaluator-v11` and
`onto2d:package-candidate-filter:v11`.

At this artifact version, `minimal`, `novel`, and `stableUnder` remain
unsupported. `minimal` additionally
requires exhaustive proper-subgraph generation; `novel` requires materialized
derivational constituents; and `stableUnder` requires the perturbation runtime.
ADR-0045 subsequently implements the exhaustive `minimal` boundary without
changing this single-removal contract.

## Consequences

- the kernel can express and audit the single-removal irreducibility part of
  the Level-0 triad case without claiming complete CRT admission;
- invalid or policy-excluded removals cannot masquerade as evidence that the
  nested predicate failed;
- a singleton under an empty-excluding node policy is explicitly
  indeterminate rather than irreducible by vacuity;
- complete nested witnesses increase artifact size, bounded by the explicit
  removal ceiling;
- invariant-bearing removal predicates and, at this version, the remaining
  substructure combinators continue to fail closed.

## Verification

Conformance fixtures cover node- and edge-irreducible cycles, a reducible graph,
whole failure, zero valid removals, included empty removals, disconnected and
isolate policies, policy mismatch, nested-invariant refusal, canonical
relabelling invariance, package-bound execution, schema conformance, content-
hash reproduction, and Node.js 20/22 determinism.
