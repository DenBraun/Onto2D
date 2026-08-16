# ADR 0096: Deterministic View Boundary and Initial Studio

- Status: Accepted
- Date: 2026-08-16

## Context

The engine can query an exact Model Pack, but applications had no shared way to
project catalogue results or directed neighborhoods. Reimplementing layout in
each page would make graph behavior inconsistent and could blur the boundary
between model facts and browser presentation. Only one real catalogue release
currently exists.

## Decision

- Add dependency-free `@onto2d/view`. It validates explicit JSON node and edge
  arrays and produces deterministic catalogue, bounded neighborhood, and
  SVG-ready layout projections.
- Keep the package free of DOM, filesystem, engine, and hashing dependencies.
  Coordinates and routes are derived output and never affect model identity.
- Add a static Model Studio that reads the transparent Causal Emergence release,
  checks its declared identity and counts, and exposes search, filters, local
  graph navigation, and exact source-record inspection.
- Do not add version comparison until a second real release and reviewed
  lineage exist. Browser checks do not replace authoritative Model Pack
  verification.

## Consequences

Applications can share deterministic graph behavior without moving semantic or
scientific authority into the UI. Dense neighborhoods remain explicitly
bounded, and omitted nodes or edges are reported. Studio is useful with one
release while leaving model selection, lineage comparison, and artifact
inspection as honest later extensions.
