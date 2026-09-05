# Onto2D History Model

Updated: 2026-08-18

This directory is the authoritative entry point for Onto2D's history-case
program. Cases are organized by two independent questions:

1. How is history available: **Recorded**, **Embodied**, or **Reconstructed**?
2. What can history change: **Identity**, **Present State**, or **Future**?

Subject domains remain filters and test environments. They do not own cases or
determine repository paths.

## Canonical documents

- [History Matters Benchmark](HISTORY_MATTERS_BENCHMARK.md) defines the v0
  comparison pilot and its separate contract, leakage model and review guide.
- [History regression preparation](HISTORY_REGRESSION_PREPARATION.md) defines
  unit-disjoint numeric predictions, nulls and the separate scoring boundary.
- [History benchmark testing](HISTORY_BENCHMARK_TESTING.md) provides offline
  checks, expected results, manual browser checks and regeneration instructions.
- [History benchmark implementation review](HISTORY_BENCHMARK_IMPLEMENTATION_REVIEW.md)
  records corrected findings and local validation, separately from scientific review.

- [History Model Taxonomy](HISTORY_MODEL_TAXONOMY.md) defines the two axes,
  their epistemic boundaries, and the migration policy.
- [History Case Portfolio](HISTORY_CASE_PORTFOLIO.md) is the human-readable
  portfolio view generated conceptually from the registry.
- [History Evidence Model](HISTORY_EVIDENCE_MODEL.md) separates records,
  measurements, interpretations, reconstructions, and counterfactuals.
- [History Identity Regimes](HISTORY_IDENTITY_REGIMES.md) defines
  regime-relative identity and equivalence.
- [History-Conditioned Reachability](HISTORY_REACHABILITY.md) scopes analyses
  in which history changes accessible futures.
- [History Reconstruction](HISTORY_RECONSTRUCTION.md) scopes inference from
  surviving evidence to candidate pasts.

Machine-readable portfolio metadata lives in
[`cases/history-case-registry.json`](../../cases/history-case-registry.json).
Case-specific implementation plans live in [`docs/cases/`](../cases/README.md).

The registry is the source for website navigation and matrix placement. A case
may appear in several matrix cells, while its `caseId`, URL, and directory stay
stable.
