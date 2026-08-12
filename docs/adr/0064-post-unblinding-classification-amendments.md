# ADR-0064: Post-unblinding classification amendments

- Status: accepted
- Date: 2026-08-12

## Context

Frozen annotations and adjudication must never be rewritten after SCC-aware
material becomes visible. Nevertheless, an approved later review may conclude
that a relation kind should change. The architecture requires the original
kind, new kind, reason, approver, and changed identities to remain visible, and
the frozen risk policy already contains a maximum post-unblinding
reclassification share.

Without a separate immutable log, callers could either hide legitimate
corrections or mutate the original artifact and falsely present the result as
blind classification.

## Decision

`@onto2d/kernel` implements `source-classification-amendments-v1`. The caller
supplies a complete snapshot frozen strictly after adjudication unblinding.
Every change names a frozen relation, a new supported kind, a canonical UTC
instant, a reason, an approver identity/role, and an approval `ArtifactRef`.

The freezer:

1. exactly replays policy, annotations, and adjudication;
2. rejects pre-unblinding, post-freeze, unknown-relation, no-op, and
   same-relation/same-instant ambiguous changes;
3. sorts changes chronologically and derives each `originalKind` from the
   frozen decision or preceding amendment;
4. binds every change to a `priorStateHash` and derives a content-addressed
   `changeId`;
5. emits one effective-decision record per frozen relation without modifying
   the adjudication artifact;
6. counts both change records and unique changed relations, compares the
   latter share with the precommitted risk threshold, and combines that signal
   with existing historical-exposure/disagreement reasons;
7. hashes the complete amendment snapshot under its own domain.

An empty log is meaningful: it attests that no post-unblinding changes were
recorded through its `frozenAt` instant. Source reconciliation diagnostics now
require such a verified log. A non-empty log cannot be paired with a
condensation made from the old kinds; it fails with
`SOURCE_MIGRATION_REPROJECTION_REQUIRED`. ADR-0065 supplies the separately
versioned effective projection; callers must still supply reviewed downstream
decisions for any changed SCC identities or destinations.

## Consequences

- Corrections remain possible without rewriting or relabeling the blind
  classification history.
- Multiple sequential corrections to one relation form an explicit state
  chain, while order-independent input produces the same artifact.
- Post-unblinding risk is executable for a complete log snapshot.
- Applying non-empty changes to projection, resolution, and condensation is
  executable under ADR-0065; integration into a reviewed migration package,
  depth basis, and run identity remains a fail-closed migration step.
- This does not author or apply changes to the current catalogue and does not
  activate `POST-CLOSURE-VIS-01`.
