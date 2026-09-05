# LTEE — History Matters protocol formalization

Status: three source-bound protocol contracts and a reproducible eligibility
audit are implemented. The selected aggregate-table profile is `NOT_ELIGIBLE`
for scored P/P+H evaluation; its verdict remains `not-evaluated`. Independent
review is pending. See the [protocol package](history-benchmark/README.md).

## Completed milestone

The three Ara-3 replay experiments now have separate machine-readable contracts
for their cohorts, source generations, units, exposure, cutoff, P/H/Y definitions,
eligibility, denominators, missing cells and evaluator. The complete census
preserves 38 reported generation-by-protocol observations and 10 not-run cells.
Generation does not identify a complete genotype or a unique clone. Zero mutants
remain non-observation, and replay history remains distinct from original LTEE
history.

The `protocol-census-audit-v1` evaluator reproduces observations and explicitly
identifies what the selected source can support: a per-protocol descriptive
history-collapsed/by-generation census. It does not invent a fitted present-only
baseline, independent replay-unit rows, a null distribution or a benchmark gain.
Published statistical summaries and the replay-2 arithmetic discrepancy remain
attributed and visible.

## Next evaluation milestone

1. Review each frozen contract against the primary publication and specify the
   scientific claim that a P/P+H comparison could test.
2. Supply either a defensible aggregate-count model with an explicit dependence
   policy, or source-locked individual replay-unit observations, pre-replay
   covariates, clone identifiers and repeated-clone links.
3. Freeze the evaluator, target, metric, resolution, uncertainty, selection and
   evaluation design. Review exchangeability before any history null is run.
4. Publish every outcome under a new protocol revision, including negative and
   indeterminate results. Preserve the current protocol audit for comparison.

This is an experimental candidate, not a causal identification claim. No finite
mutation path/cost space is provided, so no Historical Load is evaluated.
