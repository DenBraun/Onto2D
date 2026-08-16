# ADR-0098: Read-only Engine CLI composition

Status: implemented decision

## Context

The engine and bounded Node directory loader had public APIs but no stable
command-line composition. A CLI must not duplicate pack verification, add
filesystem behavior to the engine, or turn terminal output into semantic
authority.

## Decision

`@onto2d/cli` exposes `verify`, `node`, `neighborhood`, and `paths`. `verify`
uses `@onto2d/model-pack/node`. Every model query loads the pack through that
same boundary and then calls `@onto2d/engine`; the CLI does not import the
kernel or inspect semantic files directly.

Commands are read-only. Successful results use JSON output schema `1`.
Argument errors exit `2`, rejected pack or engine data exits `3`, unexpected
internal failures exit `1`, and success exits `0`. Selectors and traversal
limits are explicit and bounded.

## Consequences

- local automation can verify and inspect a pack without custom glue code;
- CLI output is deterministic operational data, not a signed or semantic run
  artifact;
- filesystem, process, and presentation concerns remain outside the engine;
- archives, remote registries, mutation, analysis execution, and release
  comparison are not implied by this milestone.
