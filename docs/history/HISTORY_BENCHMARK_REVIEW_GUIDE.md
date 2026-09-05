# History Matters review guide

No independent reviewer is recorded for the v0 pilot. Passing checks establishes
engineering reproducibility, not independent scientific review.

Review the complete source-to-target boundary for each proposed new contrast:

1. Confirm P is a reasonable present representation and H was available at the
   cutoff. Separate recorded, embodied and reconstructed evidence.
2. Trace source bytes and the target's definition. Disclose semantic circularity;
   require independent outcomes for predictive claims.
3. Inspect population selection without held-out targets. For future empirical
   evaluators, verify unit-disjoint splits, duplicates, train-only normalization,
   missingness policy, frozen hyperparameters and uncertainty.
4. Check the primary metric, resolution, null model and decision rule were fixed
   before the primary evaluation. Do not infer preregistration from a hash alone.
5. Replay all results, including negative, invalid and indeterminate outcomes.
   Check that permuted history tests useful correspondence rather than merely
   preserving a unique partition.
6. Record reviewer identity, exact commit and contract hashes, findings and their
   disposition before upgrading maturity to REVIEWED.

The release gate for benchmark v1 is an independently reviewed design plus at
least one evaluated empirical contrast and exact reproduction. HM-0 semantic
sensitivity cannot be promoted into HM-2 prediction, HM-4 causality or HM-5
fundamental irreducibility.
