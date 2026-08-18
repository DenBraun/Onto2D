# ADR 0113: Keep build-history equivalence regime-relative

- Status: accepted
- Date: 2026-08-18

## Context

Reproducible builds create an important counterexample to both of these global
rules:

```text
different execution history => different identity in every sense
same output bytes => same execution history in every sense
```

The official Reproducible Builds definition scopes byte reproducibility to
specified source, build environment, instructions, and artifacts. Onto2D must
therefore retain both the distinct execution records and the declared basis on
which any pair is considered equivalent.

## Decision

1. Capture four actual fixture executions and keep their source, runtime,
   environment, output, and timestamp records immutable.
2. Define five versioned regimes: byte output, declared inputs, toolchain,
   normalized environment, and provenance.
3. Compute a separate deterministic projection identity for each history and
   regime. An equivalence verdict compares only two projections under the same
   regime.
4. Record excluded ambient fields explicitly. In v1,
   `ONTO2D_SESSION_LABEL` is evidence but is not part of normalized environment
   identity.
5. Preserve every execution as a distinct history even when selected
   projections are equal.
6. Treat cross-machine and non-Darwin reproducibility as unknown because the v1
   captures do not supply that evidence.
7. Do not emit Historical Load. Without candidate routes, admissibility, and a
   cost function, the value is undefined rather than zero.

## Consequences

The same pair can be byte-equivalent and input-equivalent while being distinct
under toolchain and provenance. Changing an excluded field cannot silently
change environment equivalence; changing a declared input changes only the
regimes whose selected fields observe it. The kernel receives no universal
history-equivalence relation.
