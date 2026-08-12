# ADR-0085: Package-driven Quantity candidate attributes

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0078 connected package-authored finite scalar values to structural node and
edge decorations, but intentionally left `Quantity` sources fail-closed. The
runtime already had normalized SI quantities, typed structural-attribute
expressions, canonical graph identity, generalized-depth bindings, and bounded
current-level fixpoints. Enabling the package path therefore required an
explicit decision about normalization, profile-class agreement, evidence
references, and the existing difference between candidate and derived-element
identity.

## Decision

The normalized `candidateAttributes` registry accepts two additional closed
source kinds:

- `constant-quantity-v1` assigns one normalized Quantity to every selected
  node or edge variant;
- `element-invariant-quantity-v1` copies one normalized Quantity invariant to
  an exact node variant. It is node-only and requires the named Quantity on
  every primitive at load time and every selected generalized/current-level
  source element at binding time.

Constant quantities are normalized through the same SI unit, tolerance,
semantic, and provenance rules as all other package values. Their evidence IDs
must resolve in the package evidence registry. Element-invariant definitions
must reference object-valued Quantity invariants; the scalar and Quantity
discriminators cannot be interchanged. Both source kinds enter the rules hash
and provide Quantity type metadata to predicate, functional, and cohort
expression analysis.

`element-exact` binds each exact element's complete normalized value. A
`profile-quotient` node variant is admitted only when every member of the
complete profile class has the same canonical normalized Quantity, including
provenance. Disagreement fails before enumeration with
`PACKAGE_CANDIDATE_PROFILE_ATTRIBUTE_INDETERMINATE`; the disclosed class
representative is never substituted for consensus.

A Quantity selected as a structural graph attribute contributes its complete
normalized record, including provenance, to candidate canonicalization. Thus
equal physical values with different evidence IDs have distinct candidate
identities. Derived-element identity keeps its existing structural projection:
value, unit, tolerance, and semantic remain structural while evidence
provenance is retained in the derivation index rather than the element ID.
Consequently distinct provenance-complete candidate derivations may reconcile
to one derived element without losing their formation records. This is an
intentional boundary, not an accidental omission.

Primitive, arbitrary-depth, and bounded current-level bindings share the same
variant derivation function. The existing binder and generator version labels
remain unchanged because their artifact layout, canonicalization algorithm,
and execution policy do not change; the new source discriminators and values
are already identity-bearing through the package rules hash and binding input.

Role-dependent edge sources are subsequently closed by
[ADR-0086](0086-role-dependent-edge-candidate-attributes.md).
Formation-functional candidate attributes are not inferred from this decision
and remain fail-closed at this boundary; ADR-0088 later freezes their acyclic
next-depth carry-forward path.

## Consequences

- package closure can generate and filter SI-normalized Quantity-valued node
  and edge decorations without caller-supplied candidates;
- unit conversion occurs once at package load, before finite alphabet hashing;
- exact, depth-aware, current-level, and profile-quotient paths use one typed
  derivation contract;
- profile quotients cannot hide member-specific values or evidence provenance;
- the candidate/derived-element provenance boundary is explicit and replayable;
- at this boundary the umbrella pending structural-attribute capability remains
  open for role-dependent and formation-functional sources; ADR-0086 later
  closes the former and ADR-0088 closes the latter through derived `Element`
  invariants.

## Verification

Conformance covers constant and element-invariant Quantity schema branches,
type-discriminator rejection, evidence-reference closure, SI normalization,
predicate filtering, primitive and generalized-depth parity, current-level
fixpoint binding, exact profile-class consensus, heterogeneous-class rejection,
complete-provenance candidate identity, capability publication, runtime schema
validation, and full repository regression execution.

`POST-CLOSURE-VIS-01` remains scheduled after the complete kernel closure gate;
this contract does not start presentation work early.
