# ADR 0111: Preserve native in-toto warning semantics and separate Onto2D admissibility layers

- Status: accepted
- Date: 2026-08-18

## Context

The in-toto case needs to compare byte-identical artifacts whose construction
histories have different admissibility. A signed layout and link records supply
native policy evidence, while Onto2D also needs a finite counterfactual space
and cost-relative Historical Load.

The pinned in-toto Specification v1.0.0 assigns different semantics to its
fields. Signatures, thresholds, required steps, and artifact rules participate
in verification. A mismatch between `expected_command` and a link command is
only a warning and must not be silently upgraded into native rejection.

## Decision

1. Freeze deterministic JSON metablocks, Ed25519 fixture identities, target
   bytes, evaluation time, layout, and five signed execution scenarios.
2. Fail closed if any committed fixture byte or expected file differs before
   interpretation.
3. Record native verifier checks and warnings separately from their aggregate
   verdict.
4. Model `onto2d-exact-command-profile-v1` as an optional derived constraint;
   it may reject a native warning, but it is never labeled an in-toto rule.
5. Keep actual execution sets separate from the declared route space. Only the
   valid route is both a route-space baseline and mapped from an actual record;
   every route labeled counterfactual has `actual: false`.
6. Define Historical Load only over four enumerated routes and four named cost
   functions. It belongs to Onto2D and carries no general in-toto meaning.
7. Describe the evaluator as a bounded implementation of the exercised v1.0
   semantics, not a general in-toto verifier.

## Consequences

The flagship result depends on native missing-step and artifact-continuity
failures, so equal final bytes genuinely coexist with different native
admissibility. Command deviation remains available as a second experiment
without misrepresenting the upstream specification. Users can audit each
mapped rule through an exact layout pointer, while Model Studio retains the
epistemic distinction among record, verification, policy addition, and
counterfactual analysis.
