# ADR-0078: Package-driven scalar candidate attributes

- Status: accepted
- Date: 2026-08-12

## Context

The generic decorator and graph canonicalizer already support structural node
and edge attributes, and local predicates can evaluate typed attribute sums,
selectors, and balances. Package-driven generation nevertheless rejected every
non-empty structural-attribute list because no rule connected package data to
finite node/edge variants. Consequently executable attribute predicates were
limited to caller-supplied candidates and could not participate in an
integrated closure universe.

Quantity attributes also exposed an unresolved identity asymmetry: generic
candidate canonicalization currently includes complete Quantity provenance,
whereas derived element identity removes evidence provenance. That policy must
not be settled accidentally while connecting the first package-driven path.

## Decision

Rule packages now normalize a closed, rules-hash-bearing
`candidateAttributes` registry. Version 1 contains two derivation sources:

- `constant-scalar-v1` assigns one finite JSON scalar to every selected node or
  every selected edge variant;
- `element-invariant-scalar-v1` copies one package-authored scalar invariant to
  a node variant and requires that invariant on every primitive at package
  load and every selected source element at generation time.

Attribute names are globally unique. A normalized RunConfig structural node or
edge attribute must resolve to a definition with the same target. Only selected
definitions enter the finite alphabet and therefore candidate identity.
Definitions are also supplied as the attribute type environment when package
predicates, functionals, and cohort expressions are compiled.

In `element-exact`, each node variant receives its exact source element value.
In `profile-quotient`, every member of the complete profile class must have the
same canonical scalar value. Member-dependent values fail the binding with
`PACKAGE_CANDIDATE_PROFILE_ATTRIBUTE_INDETERMINATE`; a representative is never
used as a shortcut. Missing values at a generalized or current-level source
also fail before partial enumeration.

Edge v1 attributes are constant because an edge has no single source element.
Quantity-valued constants/invariants remain a separate contract subsequently
closed by [ADR-0085](0085-package-driven-quantity-candidate-attributes.md).
Role-dependent edge derivations are subsequently closed by
[ADR-0086](0086-role-dependent-edge-candidate-attributes.md).
Formation-functional carry-forward is subsequently closed by
[ADR-0088](0088-formation-functional-candidate-attribute-carry-forward.md).
Dynamic
type classification is subsequently frozen under ADR-0079.

The extended finite universe is published as `package-candidate-binding-v2`,
`package-depth-candidate-binding-v2`, and
`package-current-level-candidate-binding-v2`; their generators are v5, v3, and
v3 respectively. Existing predicate pruning may consume the resulting
canonical partial graphs, but it receives no new authorization merely because
an attribute is present.

## Consequences

- package-driven closure can now execute scalar structural-attribute predicates
  over genuinely generated candidates;
- attribute type metadata, generated values, graph identity, filtering, and
  replay all originate from one normalized package rule;
- profile quotient remains conservative under member-dependent source data;
- before ADR-0085, unsupported Quantity provenance and formation-dependent
  derivations stayed fail-closed rather than acquiring an implicit identity
  policy; ADR-0085 now freezes the Quantity boundary while keeping the latter
  sources closed;
- packages that do not declare or select candidate attributes retain empty
  node/edge attribute maps and the same semantic universe, while upgraded
  binder/generator and package/rules identities disclose the new contract.

## Verification

Conformance covers default empty normalization, node invariant copying, edge
constants, predicate type analysis and filtering, exact and uniform quotient
alphabets, heterogeneous quotient rejection, missing and Quantity-valued source
rejection, primitive/depth binding parity, canonical candidate artifacts,
public TypeScript declarations, compiled JSON Schema, runtime schema validation,
pruning regressions, and local Node.js 20/22 execution.
