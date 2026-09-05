# ADR 0125: Model Pack v2 chunks and optional artifacts

- Status: Proposed; runtime remains v1
- Date: 2026-09-05

## Context

The completed lazy-presentation milestone verifies all v1 semantic files before
opening a session. The next documented engineering milestone is a format
proposal for independently checked downloads and manifest-bound lineage.
Changing released files first would leave identity, completeness and compatibility
undefined. Existing v1 cache, registry and transport layouts reject format 2.

## Proposed decision

Adopt the [v2 proposal](../model-pack-v2/README.md): hash logical canonical node,
edge and dictionary collections independently of their physical partition.
Bind chunk envelopes, offsets, ID ranges, decoded lengths, optional indexes and
inert artifact profiles in an exact manifest. Separate manifest/chunk checks
from the complete-model gate that verifies global graph closure and recomputes
logical hashes before engine use.

Reuse existing lineage-v1 records as optional artifacts of their target release.
Their endpoints bind semantic roots and versions, without a target manifest
hash; roots precede lineage, which precedes manifest hashing. Historical claims
still require complete endpoint models, structural event checks and review.

Preserve v1 builders, schemas, APIs and release fixtures. Future v2 support needs
explicit format dispatch and versioned registry/cache/worker integration. The
draft schemas and executable examples stay under documentation and do not make
format 2 a supported package contract.

## Alternatives considered

- Hashing physical chunks into the semantic root is simpler but makes repacking
  redefine model identity. Logical collection hashes preserve that distinction.
- Merkle range proofs can establish partial membership against a semantic root,
  but add a tree/proof contract beyond this milestone. This proposal guarantees
  independently checked manifest declarations and requires full recomputation
  to establish their consistency with the semantic root.
- Putting lineage in the root would make the target root self-referential when
  lineage names that root. A manifest binding is acyclic and keeps history claims
  distinct from the exact model population used by an analysis.
- Trusting partial indexes or absent chunks as a complete graph would break the
  engine's closed-population assumption. Partial inspection uses a separate type.

## Consequences and acceptance

Repartitioning changes the manifest and preserves the v2 root; a v1-to-v2
conversion changes both identity domains and cannot reuse a v1 root. Optional
artifact failure remains explicit without redefining semantic content. Large
models gain bounded loading granularity, while full analysis retains its global
memory and verification requirements.

The proposal milestone includes closed draft transport schemas, frozen small
examples, executable integrity/negative checks and a
[local review record](../model-pack-v2/REVIEW.md). Acceptance of the format,
independent golden review and runtime implementation remain subsequent work;
this ADR does not amend the accepted v1 contract yet.
