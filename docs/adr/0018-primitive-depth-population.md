# ADR-0018: Verified primitive depth-population materialization

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0016 binds package candidate generation directly to normalized primitive
IDs and profiles. The target architecture instead requires generation from an
explicit depth population of materialized `Element` records, selected by the
run's `sourceDepths` policy. Accepting caller-supplied derived records now would
be unsafe: the kernel does not yet emit derived-element canonical content,
formation provenance, predicate admission, profile extraction, or selection
artifacts from which those identities could be reproduced.

Depth zero is different. The package loader already computes every primitive
structural identity, normalized profile and invariant, axis declaration, and
the package-wide `depthBasis`. This information is sufficient to materialize
the primitive population without inventing a derivation.

## Decision

`loaded-package-verifier-v1` becomes the shared internal boundary for consumers
of `LoadedRulePackage`. It closes the supplied artifact, removes only derived
primitive `elementId` fields from the normalized package, replays the current
loader with an independently expected kernel version, and requires the entire
reproduced artifact to match. The artifact's own version label is never used as
the verifier's authority. Package candidate binding and depth materialization
no longer maintain separate trust logic.

`materializePrimitiveDepthPopulation`, versioned as
`primitive-depth-population-v1`, accepts only that verified loader artifact.
For each normalized primitive it reproduces the identity-bearing basis under
the loaded `IdentityPolicy`, creates an `onto2d:element:v1` canonical form, and
requires its hash to equal the loader's `elementId` before emitting an
`Element` with:

- `depth: 0` and the verified package `depthBasis`;
- `axisProvenance.derivationDepth = "computed"` plus any declared ontology or
  catalogue axis provenance;
- the normalized profile, invariants, type tags, claims, coordinate, and
  optional cluster record;
- `provenance: null`, because primitives and source-condensed clusters have no
  kernel formation derivation;
- empty `admittedBy` and `selectedBy`, because membership in the primitive
  basis is not a predicate or selector result.

Elements are sorted by `ElementId`. The complete artifact binds schema and
materializer versions, package ID, depth basis, depth, and all materialized
records in the new `onto2d:depth-population:v1` domain. Package provenance can
therefore change the population hash while a non-structural source rename
leaves the policy-controlled element ID unchanged.

`package-candidate-binding-v1` now consumes this materialized population rather
than reading primitive IDs directly. Its `sourcePopulation` records the full
population artifact and a closed selection descriptor containing the run's
`sourceDepths`, `targetDepth: 1`, `availableDepths: [0]`, and
`selectedDepths: [0]`. `all-below` and `previous-only` select the same elements
when depth zero is the only available depth, but the declared policy remains in
the run and binding identities. Element-exact and profile-quotient alphabets
are derived from the materialized records.

The public materializer does not accept an arbitrary population and does not
construct depth greater than zero. ADR-0019 later supplies a versioned
package-bound formation basis and graph-only local-filter artifact. Derived-
population support remains blocked until selector admission and deterministic
profile/materialization artifacts can reproduce each derived element's
structural identity and provenance.

## Consequences

- primitive generation now crosses the same explicit `Element` and depth-
  population boundary required by later closure steps;
- element canonical bytes and the loader's `elementId` are checked against one
  another instead of merely copied;
- package/run bindings disclose exactly which depth policy selected which
  available depths;
- non-structural provenance stays outside element identity but remains bound by
  package and population hashes;
- fabricated derived IDs, unverifiable depth claims, and incomplete formation
  records still cannot enter package-driven enumeration;
- derived element construction, selector admission, alternate derivation
  indexes, profile extraction, depth greater than zero, and multi-depth
  selection remain separate work.

## Verification

Fixtures cover complete immutable primitive `Element` records, canonical-form
rehashing, depth/axis provenance, deterministic element ordering, primitive
input-order invariance, separation of package/population provenance from
policy-controlled element identity, structural source-ID opt-in, stale package
and primitive-ID rejection, package binding of the full population artifact,
profile-class derivation from elements, and explicit equivalence of both source
depth policies at target depth one, plus single-field kernel-version
substitution rejection.
