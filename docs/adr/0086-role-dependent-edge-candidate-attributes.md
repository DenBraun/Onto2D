# ADR-0086: Role-dependent edge candidate attributes

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0078 and ADR-0085 connect constant and element-invariant scalar/Quantity
values to finite candidate decorations. An edge constant cannot represent a
scientific attribute whose value is determined by the already declared edge
role, even though the RunConfig role alphabet is finite and identity-bearing.
Leaving that case to callers would split package rules from the generated
candidate universe.

## Decision

The normalized `candidateAttributes` registry accepts two edge-only sources:

- `edge-role-scalar-v1` contains a non-empty finite `values` map from role ID
  to one JSON scalar;
- `edge-role-quantity-v1` contains a non-empty finite `values` map from role ID
  to one normalized Quantity.

Role IDs are normalized identifiers and maps are limited to 256 entries. Every
scalar entry in one map must have the same JSON scalar type. Every Quantity
entry must have compatible SI dimensions and one semantic; individual
tolerances and evidence provenance may differ and remain part of the selected
value. Quantity evidence references close through the package evidence
registry. Authored map order is non-semantic.

A selected role-dependent definition must cover every role in the normalized
RunConfig `roleAlphabet`. Missing coverage fails binding before enumeration
with `PACKAGE_CANDIDATE_ATTRIBUTE_ROLE_UNAVAILABLE`. Extra package roles remain
identity-bearing rules but do not enter a run that did not select them. Node
targets are invalid because a node has no unique generating edge role.

Edge variants are derived independently for each normalized run role. The
selected scalar or complete normalized Quantity participates in candidate
canonicalization exactly like constant decorations. Primitive, profile-
quotient, arbitrary-depth, and bounded current-level bindings share the same
variant derivation and coverage check.

The attribute map contributes one homogeneous expression type to package
analysis. This decision does not enable same-candidate formation-functional
decoration or lift any separately fail-closed structural-sum runtime boundary.

Existing binding and generator version labels remain unchanged: artifact
layout and traversal do not change, while the new source discriminator, map,
rules hash, and resulting edge variants already disclose the semantic
expansion.

## Consequences

- packages can define different structural scalar or Quantity values for each
  finite edge role without caller-supplied decoration arrays;
- incomplete role maps cannot silently reduce or partially decorate a run;
- compatible units normalize before map hashing and generation;
- role-dependent values work identically at primitive, generalized-depth, and
  current-level boundaries;
- formation-functional candidate carry-forward remained undecided until
  ADR-0088 froze its later-depth path.

## Verification

Conformance covers scalar and Quantity maps, canonical map ordering, SI
normalization, evidence closure, homogeneous type/unit/semantic validation,
edge-only targeting, complete run-role coverage, exact/profile generation,
derived-depth and current-level reuse, public TypeScript declarations, JSON
Schema target conditions, runtime schema validation, capability publication,
and repository regression execution.
