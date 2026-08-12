# ADR-0088: Formation-functional candidate-attribute carry-forward

- Status: accepted
- Date: 2026-08-12

## Context

The remaining structural-attribute note could be read as permission to execute
a package functional while the same candidate is being generated and then add
its result back to that candidate. That interpretation is cyclic: the
functional may depend on the graph and its structural attributes, while the
new attribute would change the graph identity being scored. It would also
violate the frozen pipeline in which functionals are unavailable to generation
and execute only after local eligibility is reproduced.

The implemented closure ladder already contains an acyclic boundary:

```text
candidate at depth d
  -> eligible selected formation
  -> verified package functional
  -> derived profile invariant
  -> derived Element invariant
  -> element-invariant candidate attribute at depth d + 1
```

ADR-0069 freezes the functional-to-profile step, the derived-depth
materializer copies the complete profile invariant into the `Element`, and
ADR-0085 copies a typed element Quantity into the next node-variant alphabet.
ADR-0087 additionally permits the source functional to consume the candidate's
package-generated structural sums.

## Decision

Formation-functional candidate attributes use this next-depth carry-forward
pipeline. No same-candidate `formation-functional-*` candidate-attribute source
kind is introduced.

A carried Quantity is identified by one invariant name/semantic across the
three declared boundaries:

1. the primitive invariant fixes the candidate-attribute expression type;
2. a `residual-slots-v2` or `residual-slots-v3` derived-invariant definition
   binds that semantic to one package functional and compatible quantization;
3. `element-invariant-quantity-v1` copies the resulting derived `Element`
   invariant into node variants at later generalized depths or current-level
   rounds.

The loader rejects a matched carry-forward path when its primitive and
formation-functional Quantity dimensions or semantics disagree. The candidate
binder also requires every selected source element to expose one identical
runtime type descriptor: JSON scalar kind, or Quantity canonical unit and
semantic. This detects drift before enumeration and before a partial candidate
universe exists.

The full computed Quantity, including uncertainty and functional evidence,
enters next-depth candidate identity under ADR-0085. Derived-element identity
continues to project evidence provenance into the separate derivation index.
Profile-quotient generation still requires complete canonical member
consensus.

## Consequences

- formation-derived values become structural inputs only at a later acyclic
  closure boundary;
- local predicates, cohort keys, and functionals at that later boundary see
  the same typed attribute registry and value;
- direct functional feedback into the candidate being scored remains
  structurally impossible rather than silently order-dependent;
- the umbrella package candidate structural-attribute capability is closed by
  constant, element-invariant, role-dependent, and formation-functional
  carry-forward sources;
- new per-node or per-edge calculations that cannot be represented as an
  `Element` invariant require a separate future scientific contract, not an
  implicit mutation hook.

## Verification

Conformance traces a Quantity from a structural sum in a selected formation,
through its scored functional artifact and materialized profile/`Element`
invariant, into the exact node variant and generated candidates at target
depth 2. Loader negatives cover semantic/type drift; binding validation covers
runtime source-population drift. Primitive, profile-quotient, arbitrary-depth,
current-level, schema, capability, full-regression, and build checks remain
mandatory.

`POST-CLOSURE-VIS-01` remains scheduled only after every remaining kernel gate
is closed.
