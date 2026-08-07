# ADR-0014: Classified relations and SCC projections

Status: accepted and implemented for verified projection artifacts only

## Context

ADR-0013 freezes caller-supplied raw annotations and blind adjudication, but
downstream node resolution must not trust a mutable endpoint list or recompute
SCCs from unverified labels. Stage D3 requires the same frozen decisions to
produce the same typed relations and SCC partitions independently of input
order, without deleting any source edge.

This transformation belongs in the catalogue adapter: it translates source-
relation data into general kernel contracts and may depend on the kernel, while
the dependency-free kernel must not import catalogue concepts.

## Decision

The catalogue adapter exposes two content-addressed constructors.

### Classification view

`createSourceClassificationView`, versioned as
`source-classification-view-v1`, creates the only relation payload eligible for
annotation. It reproduces the frozen classification policy and requires:

- a unique relation ID and normalized source/target endpoint for every entry;
- exactly the policy's visible local fields and no additional fields;
- membership of every field name in the kernel's closed visible-field
  vocabulary;
- explicit `source` and `target` visibility in the policy;
- equality between visible endpoint fields and the structural endpoints;
- canonical relation/field ordering before hashing in
  `onto2d:source-classification-view:v1`.

This makes endpoint substitution or hidden SCC/cycle fields change or fail the
view identity. The adapter constructs the payload; authenticating users and
delivering it through an access-controlled UI remain application concerns.

### Classified relations and SCCs

`buildSourceClassifiedRelations`, versioned as
`source-classified-relations-v1`, accepts only a reproducible policy, view,
annotation artifact, and adjudication artifact. Every upstream hash and the
complete canonical content are rechecked.

The output contains every view relation exactly once with its source, target,
final kind, agreement/adjudication status, and preserved raw kinds. It computes
two directed partitions over every endpoint in the relation inventory:

- `generative`, containing only `generative` relations;
- `formation-support`, containing `generative`, `constitutive`, and
  `intra-closure-support` relations.

SCC traversal order, relation order, annotation order, and decision order do
not affect the result. Every component records sorted members, sorted internal
relation IDs, and whether it is cyclic. A singleton with a projected self-loop
is cyclic. Component identity is hashed in
`onto2d:source-scc-component:v1` over the projection name, members, and complete
internal typed endpoint relations, not merely over relation IDs. The complete
artifact is hashed in `onto2d:source-classified-relations:v1`.

## Consequences

Node-resolution work can consume one verified typed relation inventory and
both required SCC partitions without access to raw annotation order. Endpoint
substitution, missing/duplicate relation identities, changed policy-visible
fields, altered annotations, or altered adjudication all fail before SCC
output is emitted.

The projection covers nodes occurring as relation endpoints. Full catalogue
node reconciliation, including isolated cards, remains a later migration gate.
This implementation does not author labels, run the current catalogue through
a policy, choose SCC dispositions, build clusters, construct a condensation
quotient, or load `sourceMigration`.

## Verification

Fixtures cover exact visible-field enforcement, endpoint consistency, complete
edge preservation, typed counts, the two required SCC projections, projected
self-loops, component identities, full input-order invariance, tampered view
endpoints, altered upstream artifacts, public types/schemas, and truthful
adapter capabilities.
