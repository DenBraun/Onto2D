# ADR-0069: Formation-functional profile invariants

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0038 deliberately copied only the package-authored base invariant vector
into a residual profile. The architecture requires derived profile data to be
formation-dependent, typed, reproducible, and identity-bearing, but the old
generic profile guard/value placeholders do not provide such a contract.
Silently accepting a caller-computed invariant would bypass package rules and
the verified candidate population.

The kernel already has a closed numeric expression language and a verified
post-filter functional evaluator. Reusing that evaluator avoids introducing a
second arithmetic, missing-data, unit, uncertainty, or provenance policy.

## Decision

Add the opt-in `profileDefinition.kind = "residual-slots-v2"`. It retains the
v1 base profile, residual-slot, derived-type-tag, and claim semantics and adds
a canonical `derivedInvariants` list. Each entry binds:

- one unique profile `semantic` not present in the base invariant vector;
- one declared package `functional`;
- one positive normalized `quantization` Quantity.

At package load, the functional reference must resolve, its result semantic
must equal the profile semantic, and its result unit must be dimensionally
compatible with the quantization unit. Quantization semantic must also match.
Definitions are normalized by semantic and functional ID and remain part of
the rules and package hashes.

`package-derived-profile-extractor-v2` evaluates every declared functional for
every selected formation against that formation's already reproduced eligible
filter and exact package/run binding. A scored result becomes the normalized
profile coordinate; its declared quantization is retained. The output embeds
every complete functional-evaluation artifact, and its claim/evidence union
includes the functional result, functional claims, quantization, base profile,
definition, and formation lineage.

Evaluation is all-or-nothing. Every declared functional is executed even when
another is indeterminate. If any result is indeterminate, the formation emits
`profile-derived-invariant-indeterminate`, the complete list of evaluation
hashes/reasons, no capacity consumptions, no profile, and therefore no partial
derived population. Successful derived coordinates are composed with the base
invariant vector before the profile and element identities are computed.

`residual-slots-v1` remains accepted and produces no functional-derived
coordinates. Generic slot guards, formation-derived ontology coordinates,
formation-derived type rules beyond the existing fixed type tags, and derived
candidate structural attributes remain separate contracts. ADR-0079
subsequently closes the former with Quantity-threshold rules over these exact
derived coordinates.

## Consequences

- formation-dependent profile quantities now use the same typed expression,
  numerical policy, missing-data behavior, and exact replay as ranking
  functionals;
- arbitrary caller values cannot enter a derived profile;
- unit, semantic, uncertainty, claims, and evidence remain auditable through
  the embedded functional artifacts;
- one unresolved coordinate cannot leak a reduced or partially materialized
  depth population;
- the existing v1 residual policy remains a stable, explicitly base-only
  hypothesis.

## Verification

Conformance covers v2 package normalization, missing functional references,
semantic drift, functional execution over a concrete formation, derived
profile and element invariant propagation, complete evaluation lineage,
indeterminate tolerance failure, no partial consumptions/elements, exact
artifact replay, published schemas, and local Node.js 20/22 execution.
