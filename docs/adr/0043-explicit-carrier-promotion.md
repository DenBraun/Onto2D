# ADR-0043: Explicit carrier promotion from verified closure artifacts

Status: proposed implementation baseline; local conformance passed,
independent and cross-platform review pending

## Context

ADR-0038 materializes selected formations, deterministic profiles, and derived
elements. ADR-0041 closes and replays bounded ladders, while ADR-0042 tests the
profile abstraction and preserves counterexamples. None of those operations
may silently reinterpret a derived element as a primitive of a higher ontology
level. Architecture section 12.3 requires that redescription to be a separate,
falsifiable and evidence-bound artifact.

## Decision

`package-carrier-promotion-materializer-v1` consumes an independently verified
loaded package, RunConfig, closure ladder, bounded profile-collapse report, and
closed promotion policy.

- The policy declares one source depth, source and strictly higher target
  ontology coordinates, target type tags, package claim/evidence references,
  and an explicit `block` or `record-and-promote` disposition for a collapse
  counterexample.
- Every claim and evidence reference must exist in the verified package. The
  policy evidence must include every evidence reference of its claims.
- Source carriers come only from the selected, admitted derived population of
  the exactly replayed ladder level. A promotion requires a normalized profile
  with at least one slot or invariant. The operation is all-or-nothing when a
  source profile is empty or the source level/collapse is indeterminate.
- If an element already declares an ontology coordinate, it must equal the
  policy source coordinate. Otherwise the artifact records that the source
  coordinate was declared by the promotion policy; it does not write it into
  the source element.
- An equivalent completed collapse permits promotion. A completed
  counterexample is either blocked or preserved in `collapseBasis` and
  explicitly accepted according to policy. Truncation or indeterminacy never
  produces a target carrier.
- Each promotion contains an immutable mapping, profile/rules/collapse basis,
  claim and evidence lineage, a domain hash, and a complete `PrimitiveDefinition`
  suitable as target-package input. It does not reuse or mutate the source
  element identity.
- The policy, every decision and promotion, terminal interpretation, and
  source artifact hashes are covered by
  `onto2d:package-carrier-promotions:v1`. Stored sets are accepted only after
  exact deterministic replay.

## Consequences

- derivation depth and ontology level remain independent;
- promotion is executable without turning profile collapse into an
  unquestioned theorem;
- unresolved abstraction evidence remains visible even when an authored policy
  permits the target input to be emitted;
- promoted primitive inputs can be validated by the ordinary package loader;
- bounded current-level fixpoints are subsequently implemented by
  [ADR-0044](0044-bounded-current-level-fixpoint.md); their round-local
  null-model execution is subsequently closed by
  [ADR-0080](0080-current-level-round-null-model-execution.md).

## Verification

Local conformance covers successful promotion from a verified level,
policy-supplied source coordinates, target-axis provenance, domain hashes,
exact replay, tamper rejection, missing-evidence and invalid-level rejection,
configured-kernel adapters, strict runtime JSON Schema validation, and loading
the emitted target primitive through the ordinary package loader. The complete
repository suite passes locally on Node.js 20 and 22. Independent implementation
comparison and additional-platform evidence remain acceptance requirements.
