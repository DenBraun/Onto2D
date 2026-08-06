# Level-0 oscillator case

This directory is the future executable case package for the foundational
Level-0 theory. It currently freezes source identities only; it does not yet
claim that the paper's resonant triad has been implemented or validated.

The computational decomposition, equation traceability, admissibility gates,
and limitations are documented in
[Foundational Paper Analysis](../../docs/FOUNDATIONAL_PAPER_ANALYSIS.md). The
implementation sequence and acceptance gates are in
[Kernel Refactor Plan](../../docs/KERNEL_REFACTOR_PLAN.md).

`source-lock.json` is deliberately machine-readable. External Markdown inputs
are identified by name and digest but are not runtime filesystem dependencies.
