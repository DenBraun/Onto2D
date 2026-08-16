# ADR 0094: Model Pack and Engine Foundation

- Status: Accepted
- Date: 2026-08-15

## Context

The kernel has deterministic execution contracts, but applications lacked one
stable way to select, inspect, traverse, and compare a versioned model. Loading
the preserved catalogue directly in each interface would mix source quirks,
release identity, derived indexes, and presentation state.

## Decision

Add two inward-facing packages:

- `@onto2d/model-pack` builds and verifies transparent, canonical Model Packs;
- `@onto2d/engine` exposes exact-version model access, traversal, workspaces,
  registered analyses, and structural diff without embedding a catalogue.

The private root facade composes the generic engine with one frozen Causal
Emergence pack. `rootHash` binds semantic files, compatibility, and exact
source; `manifestHash` additionally binds release metadata and derived indexes.
Indexes are always rebuilt during verification.

Current catalogue relations are published as `source-parent`, not as reviewed
generative edges. Diff does not infer lineage and reports it as undeclared.

## Consequences

Applications receive deterministic model reads without depending on raw source
layout. Workspace state remains isolated, and aliases cannot hide the exact
resolved version. The root facade stays private pending independent pack review.

Studio, external ontology adapters, secure archive and remote loaders, declared
lineage, advanced semantic diff, shared view components, CLI support, caching,
and lazy loading are deferred to the Engine Roadmap.

Declared lineage, bounded local-directory loading, and the first registered
analysis were subsequently addressed by [ADR 0095](0095-lineage-loading-and-first-analysis.md).

## Verification

Package tests cover order independence, index rebuilding, tamper rejection,
version resolution, traversal, workspace isolation, diff, TypeScript surfaces,
and reproducible rebuilding of the bundled source snapshot.
