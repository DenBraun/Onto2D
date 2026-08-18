# ADR 0112: Separate chemical identifiers, reaction records, and material continuity

- Status: accepted
- Date: 2026-08-18

## Context

Chemical Synthesis History needs to show that one target can retain multiple
recorded construction histories. ORD supplies structured reaction records, but
three distinctions must survive mapping:

1. identifier equality is not reaction-record identity;
2. identifier equality is not physical-batch continuity;
3. a declared route-space shortcut is not evidence of chemical feasibility.

The selected Ahneman dataset provides many independently recorded condition
histories for five exact product strings. The selected islatravir dataset
provides native cross-reaction references through a three-record cascade.

## Decision

1. Pin ORD data release v0.1.0 at commit
   `8b83754b865c8a9f30667fbea4dfdc892d4dad60` and the validation workflow's
   ord-schema tag v0.3.10.
2. Bind both selected Git LFS objects by compressed and uncompressed SHA-256,
   dataset ID, reaction count, and publication DOI.
3. Use byte-exact native product SMILES as the first target identity profile.
   Perform no silent canonicalization and state that this may under-merge
   equivalent structures.
4. Use reaction ID plus recorded input, condition, and workup fields for route
   fragment identity. Preserve missing measurements as `null`.
5. Create a physical-material continuity relation only from a native ORD
   `reaction_id` cross-reference. A compound-identifier match remains a
   derived identifier relation.
6. Keep the ten Ahneman extrema records and the three-record islatravir chain
   as actual source evidence. Keep all shortcut routes counterfactual.
7. Resolve Historical Load only in the four-route islatravir analysis space.
   The +2 values describe additional records or intermediate states required
   by the declared evidence rule, not chemical difficulty, yield, safety, or
   feasibility.

## Consequences

The model can share one target node across different reaction records without
collapsing their histories. Native cross-references support a stronger
continuity edge than exact identifier equality. The explorer can explain why
two routes with the same product differ while making the limited meaning of
the numeric Historical Load result explicit.
