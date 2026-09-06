# Representation policies

## `source-parent-directed-v1`, version `1`

This closed policy replaces the proposal's provisional `causal-directed-v1`
name. The current Causal Emergence release contains source-parent relations,
including known source findings, rather than reviewed causal relations.

The policy consumes the complete verified v1 model. Every node and every edge
is represented once with its original ID and endpoints. Each edge must have
`relationLayer: "source-parent"`. Other layers, self-loops and parallel edges
with the same ordered endpoints fail explicitly. Reciprocal edges are allowed.
There is no silent filtering, symmetrization, fragment scope, condensation,
inferred hyperedge or induced simplex. Missing categories are preserved as
missing; all declared necessities and ontological roles are included.

Projection nodes retain, when present: `level`, `phase`, `phaseId`, `typeRole`,
`typeRoleId`, `scienceIds`, `scientificStatus`, and `requirements`.
Projection edges retain, when present: `relationLayer`, `causalDirections`,
`causalDirectionIds`, `interactionModes`, `interactionModeIds`, `weight`,
`necessity`, `dependencyType`, `dependencyTypeId`, `ontologicalRole`, and
`quantization`. Values are copied without recoding or repair. Preserving these
typed channels does not validate their scientific interpretation or dictionary
consistency. Unknown source fields remain in the source record, not in the
projection's closed attribute profile.

Each projected record contains a `sourceRecordHash` over the entire original
record (domain `onto2d:structural-source-record:v1`, input `{kind, record}`).
Names, descriptions, evidence and layout coordinates are excluded from geometry;
they remain traceable through the original ID, record hash and exact pack.
Local dictionary codes acquire meaning only within that exact pack.

The canonical projection body contains `schemaVersion`, `model`, `policy`,
`policyHash`, `nodes` and `edges`. Nodes and edges sort by original ID using
UTF-16 code-unit order, as in Model Pack v1. `projectionHash` hashes that body
under `onto2d:structural-projection:v1`. The model binding always includes
`modelId`, `modelVersion`, `modelRootHash` and `manifestHash`; a semantic root
alone does not pin a release manifest. The complete policy is hashed under
`onto2d:structural-projection-policy:v1`.

V1 permits at most 4096 nodes and 16384 edges, with the existing canonical
codec's 100000-entry, depth and string bounds also applying. Exceeding a bound
fails; a partial graph is never reported as a complete result. Input size limits
are not a guarantee that every graph below the count bounds fits the codec.

## Replay and invariance

Public projection and analysis calls verify a Model Pack before consuming it.
The engine bridge reconstructs the pack from its Model and checks its exact
manifest. Verification of a stored projection or result requires the source
pack and recomputes the complete expected object; matching a self-declared hash
is insufficient. Input objects and verified results remain immutable.

Reordering input records before building a pack, or changing JSON key order,
preserves canonical output. Relabeling IDs gives equivariant numerical results
after mapping IDs back, but deliberately changes source and artifact hashes.
Changing labels or source annotations also changes provenance, even when
curvature is unchanged. Relabeling is not exact artifact identity. Edge
subdivision, fragment boundaries and added neighbors need not preserve values.

Future [distinguishability regimes](DISTINGUISHABILITY_DESIGN.md) may compare
separate invariant descriptors under declared matching rules. They do not change
this source/projection identity policy or make Model Pack canonical serialization
an unlabeled graph-isomorphism algorithm. Conditional abstraction probes require
their own reviewed rules; source-parent annotations are not automatically causal.
