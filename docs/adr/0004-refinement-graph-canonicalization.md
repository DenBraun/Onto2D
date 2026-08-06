# ADR-0004: Refinement-based graph canonicalization

Status: proposed implementation baseline; conformance execution pending

## Context

Candidate node indices and edge array order are input-local. They cannot enter
semantic identity, while direction, role labels, enabled multiplicity,
self-loops, element/profile references, and package-declared structural
attributes must remain observable. The architecture requires exact behavior for
the intended research range of at most six nodes and forbids treating a
probabilistic fingerprint as an isomorphism proof.

## Decision

`canonicalizeCandidate` first validates and normalizes the candidate and a
fully materialized `GraphPolicy`. Initial node colors are canonical signatures
of the element/profile reference and selected structural node attributes.
One-dimensional Weisfeiler-Lehman refinement repeatedly adds sorted incoming
and outgoing edge signatures containing direction, neighbor color, role, and
selected structural edge attributes.

When refinement leaves a non-singleton color class, the implementation chooses
the smallest invariant cell, individualizes every member in turn, refines
again, and explores all resulting branches. A leaf orders nodes by the discrete
colors, rewrites and sorts edges, and serializes the complete structural graph.
The lexicographically smallest canonical JSON leaf is authoritative. Input
iteration order may choose among equal automorphic mappings, but it cannot
change canonical bytes or identifiers.

The candidate payload contains its counting domain, canonical structural nodes
and edges, and a derived `SkeletonId`. The skeleton is canonicalized separately
as an unlabeled undirected simple graph: edge direction, roles, parallel copies,
and self-loops are projected away. Skeleton and candidate forms use distinct
`onto2d:skeleton:v1` and `onto2d:candidate:v1` hash domains.

Connectivity, parallel-edge, and self-loop flags decide admissibility. They do
not by themselves change the identity of a graph that is valid under two
policies. Attribute declarations affect identity through the selected
structural data; non-structural annotations are omitted from canonical content.
The returned normalized policy belongs in the future run manifest.

The standalone canonicalizer defaults to six nodes, 64 decorated edges, and
100,000 total search states shared by skeleton and candidate labeling. The edge
limit is a safety ceiling, not the generator's stricter `n + 2` run budget.
Exhaustion throws `CANONICALIZATION_BUDGET_EXHAUSTED`; no partial ID is emitted.

## Consequences

- candidate IDs are invariant under node and edge input permutations;
- direction, role, multiplicity, loops, references, and declared structural
  attributes remain distinguishable;
- canonicalization is exact within its completed search, not hash-refinement
  heuristics alone;
- both node and edge input indices receive reversible canonical mappings;
- large symmetric graphs may exhaust the explicit budget and must be reported
  as non-results;
- changing the labeling or skeleton projection requires a new hash-domain
  version and reviewed migration.

## Acceptance artifacts

- at least 30 independently permuted isomorphic pairs;
- known direction, role, multiplicity, and attribute negative pairs;
- loop, parallel-edge, connectivity, identity-mismatch, and budget failures;
- independently reviewed canonical byte goldens;
- repeat execution on every supported Node.js platform.

The tests are present but have not been executed under the current no-run
instruction. This ADR must not be marked accepted until those checks and an
independent reference comparison pass.
