# ADR-0013: Source classification annotation artifacts

Status: accepted and implemented for artifact freezing only

## Context

ADR-0012 makes a reviewed classification policy reproducibly immutable, but a
policy hash alone does not prove that each source relation was classified
independently, that exposure was declared honestly, or that disagreement was
preserved through adjudication. Stage D3 requires raw annotations,
classifier/tool identities, disagreement, blind adjudication, exposure
declarations, and unblinding time to remain immutable artifacts.

The repository still has no reviewed policy content and must not assign
scientific categories to the current catalogue. The executable boundary should
therefore validate caller-supplied annotation records without creating them.

## Decision

The kernel exposes two closed artifact constructors:

- `freezeSourceClassificationAnnotations`, versioned as
  `source-classification-annotations-v1` and hashed in
  `onto2d:source-classification-annotations:v1`;
- `freezeSourceClassificationAdjudication`, versioned as
  `source-classification-adjudication-v1` and hashed in
  `onto2d:source-classification-adjudication:v1`.

Both constructors first reproduce the supplied frozen policy and reject any
content/hash mismatch.

### Raw annotations

The annotation artifact binds the policy hash, access-controlled view hash,
exact policy-visible field set, complete relation inventory, freeze time,
classifier identities, individual exposure declarations, observations,
rationales, and selected relation kinds.

For human-independent policy, the artifact requires at least the policy's
minimum classifier count and a complete Cartesian annotation matrix: every
declared classifier independently annotates every relation exactly once. For a
deterministic-precommitted policy, exactly one classifier is permitted and its
ID and version must equal the identity frozen in the policy.

Prospective-blind and deterministic-precommitted declarations require a
negative SCC-exposure statement. Under an overall historically exposed policy,
each human still declares their own truthful status, so a mixed group may
retain prospective-blind individuals while the artifact remains historically
exposed and risk-elevated. Classifier ordering, relation ordering, annotation
ordering, and observation-set ordering cannot change the artifact hash.

### Adjudication

The adjudication artifact binds both the policy and raw-annotation hashes. It
contains one final decision per relation, a policy-compatible adjudicator
identity and exposure declaration, adjudication freeze time, and explicit
unblinding time.

Raw kinds and agreement status are derived from the frozen annotations rather
than trusted from input. A unanimous classification cannot be changed during
adjudication. A disagreement remains visible even if the final decision uses a
third supported category. The artifact computes the exact disagreement count
and ratio, compares it with the frozen risk threshold, and raises fitting risk
for threshold excess or historical exposure.

Annotation freeze, adjudication freeze, and unblinding instants must be in that
order. Timestamps use canonical UTC milliseconds and are caller-supplied
provenance, not a trusted clock attestation.

## Consequences

Downstream SCC computation can require verified, immutable decisions while
retaining every raw vote and disagreement. Altered policies, annotation views,
classifier identities, exposure claims, annotation matrices, timestamps, and
adjudication decisions fail before they can enter migration state.

The kernel binds a view hash and declared visible-field set but does not serve
or access-control the annotation UI; that enforcement belongs in the catalogue
adapter/application. This implementation also does not author a policy,
classify a catalogue relation, resolve an SCC, load `sourceMigration`, or
process post-unblinding amendments. Those capabilities remain pending.

Verified decisions are translated into typed relations and SCC partitions by
[ADR-0014](0014-classified-relations-and-scc-projections.md).

## Verification

Tests cover order-independent identity, complete human annotation matrices,
deterministic classifier binding, view and exposure drift, altered policy/raw
artifacts, unanimous-result protection, disagreement/risk derivation,
timestamp ordering, immutability, public API exposure, and the explicit pending
migration boundary.
