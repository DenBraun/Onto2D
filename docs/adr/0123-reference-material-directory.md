# ADR-0123: Descriptive directory for preserved reference material

Status: implemented

## Context

The repository keeps its original eight-level catalogue, catalogue dictionaries,
schema and two foundational papers together. The original abbreviated directory
name did not communicate this role and was easily confused with executable
source code. The root `src/` directory already owns the private runtime facade.

## Decision

Keep the same twelve files under `references/`. Update documentation links,
catalogue readers, source locks and every current and archived case input to
the new repository-relative location. Preserve every source byte and source
content hash.

Rebuild the existing dependent artifacts through their original compilers and
solvers. Level 0 model identities include source paths, so relocation changes
model, candidate, request and analysis hashes. Refresh downstream dependency
bindings and documentation hash references in dependency order. This is a
source-location amendment with the same scientific rules, parameters and results.

The Causal Emergence pack retains its semantic files. Its source-file paths are
part of the manifest root input, so rebuild the source metadata, root hash and
manifest hash, update the exact registry entry and Studio
registry pin, and synchronize the Studio module cache revision with the existing
revision updater.

## Consequences and verification

There is one authoritative reference directory. No compatibility symlink or
duplicate source copy is needed. Source catalogue audit facts, source-PDF hashes,
numerical outputs, structural conclusions and scientific maturity remain the
same. Hash-bound artifacts use the new location consistently and replay without
a fallback to an absent directory.

Acceptance covers byte-for-byte comparison of the twelve sources, regeneration
and comparison of all eleven Level 0 artifacts, Causal Emergence semantic-file
equality and refreshed source-bound hashes, catalogue audit, source locks, full repository tests,
registry/cache checks and document links.
