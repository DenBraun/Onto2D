# ADR-0079: Formation-derived type classification

- Status: accepted
- Date: 2026-08-12

## Context

Residual-profile policies could assign one static `derivedTypeTags` set and
could derive Quantity-valued profile invariants from verified formation
functionals. They could not classify two selected formations differently from
those computed results. Adding an unrelated expression runtime would duplicate
the already replayed functional path and risk assigning identity-bearing types
from an unverified value.

## Decision

The opt-in `profileDefinition.kind = "residual-slots-v3"` extends v2 with a
canonical `derivedTypeRules` set. Each rule declares:

- one globally unique output `typeTag` that does not duplicate a static
  `derivedTypeTags` entry;
- one `invariant` semantic declared in the same definition's
  `derivedInvariants` set;
- one closed Quantity comparator; and
- one compatible normalized Quantity `threshold` whose semantic equals the
  referenced invariant.

The extractor first executes the complete v2 formation-functional invariant
stage. If any source functional is indeterminate, the existing all-or-nothing
profile failure applies and no type rule runs. Otherwise every type rule reads
the reproduced scored invariant and uses the kernel's tolerance-aware Quantity
comparison with equal-semantic enforcement. A passing comparison assigns the
tag; a non-passing comparison records `not-assigned`. Every rule retains its
source functional evaluation hash, full comparison transcript, and outcome.
The final type set is the sorted union of static and assigned tags.

`package-derived-profile-extractor-v3` publishes those evaluations and the
final type set beside each residual profile. `package-derived-depth-population-v3`
copies that verified set to the derived `Element`; it no longer rereads only the
static package tags. When `identityPolicy.typeTagsStructural` is true, the
verified result set participates in element identity. When false, the visible
classification remains present but does not change the element ID.

Threshold evidence enters the derived-profile evidence union. Rule order is
non-semantic after normalization. This contract does not infer a type from
derivation depth, ontology coordinates, selectors, or representative members,
and it does not introduce an independent functional-evaluation path.

## Consequences

- selected formations can now acquire different deterministic type tags from
  their verified formation properties;
- every assigned or withheld tag has a replayable quantitative witness;
- package rules and element identity disclose the exact classification policy;
- incomplete functional data cannot produce a partial type classification;
- multi-invariant Boolean type rules and non-Quantity classification sources
  remain later, separately frozen extensions.

## Verification

Conformance covers package normalization, missing-invariant and duplicate-tag
rejection, semantic/unit closure, assigned and withheld threshold outcomes,
source-evaluation linkage, result ordering, type-tag propagation, structural
and non-structural identity behavior, exact replay, TypeScript declarations,
compiled JSON Schema, and Node.js 22/24 CI execution.
