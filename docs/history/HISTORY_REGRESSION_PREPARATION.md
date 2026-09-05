# History regression preparation v1

The predictive subpath of `@onto2d/history-benchmark` adds a separate contract
for unit-disjoint duration regression. Existing exact semantic contracts and
the closed kernel are not expanded to accept incompatible numeric records.

```js
import {
  prepareHistoryRegression,
  verifyHistoryRegressionPreparation
} from "@onto2d/history-benchmark/predictive";

const preparation = prepareHistoryRegression(contract, dataset, trainingTargets);
verifyHistoryRegressionPreparation(preparation, contract, dataset, trainingTargets);
```

Preparation has no parameter for held-out targets. It verifies canonical input
bindings, unique sample IDs, exact training-label membership, unit-disjoint
splits, one test endpoint per unit, source-prefix duplicates across splits,
present/cutoff equality and history preceding cutoff. Identical feature vectors
of distinct source records are allowed: ambiguity is not duplicate source data.
Raw prefix hashes must be derived and verified by the case compiler; the pure
API cannot establish physical identity or source authenticity from a supplied ID.

The built-in evaluator fits min/max normalization only on training features,
zeros constant training dimensions, never clips test features, and picks one
nearest prefix per training unit before selecting k neighbors. It produces P0,
P1 and their two age-augmented counterparts with exact neighbor explanations.
Sample order is irrelevant; feature-vector order is semantic. Sample IDs resolve
exact distance ties but never enter feature distances. Arithmetic is ECMAScript
binary64; exact replay means identical artifacts for the declared implementation,
not a claim of real-number statistical certainty.
RMSE scales absolute errors by their maximum before squaring, preserving small
nonzero errors and keeping the result within the declared numeric range.

Null preparations permute the held-out historical vectors, preserving all other
inputs and training ranges. This profile supports one explicitly declared
population; it must not be silently reused for a multi-condition cohort requiring
stratification. Hash-priority permutations are diagnostic, not p-values.

`maxNullTrials` can limit work: incomplete null preparation has status
`incomplete`, not `prepared`. Scoring it yields `indeterminate`. A fixed 250
million scalar distance-component budget fails with `REGRESSION_BUDGET` before
prediction work begins; it never creates negative or neutral scientific evidence.
Options must be plain canonical data; `maxNullTrials` is an integer in [0,256],
and malformed or null budgets are rejected rather than defaulting to a full run.
Missing training labels, unsupported policy, cutoff violations and contamination
throw typed errors. Missing held-out labels produce an indeterminate result with
null metrics. Bad target membership is rejected rather than dropping units.

`scoreHistoryRegression` is a separate generic operation. It replays preparation,
then joins every held-out label, retaining target identity, MAE, RMSE, age
sensitivity and each null error. Positive gain must exceed the declared
resolution and the true-history error must beat the null mean beyond that
resolution. Negative, neutral and unresolved outcomes remain visible. This rule
does not implement sampling uncertainty or a significance test.

The pure scorer binds the supplied target projection in its result; the case
must separately verify raw held-out target bytes against
`heldOutTargetSourceHash`. Local code cannot certify independent review or
preregistration. The first empirical case is therefore
[FD001 preparation](../../cases/operational-aging/history-benchmark/README.md),
with frozen predictions and no held-out score pending independent review.

Six closed schemas describe regression contracts, datasets, targets,
preparations, results and readiness records. The reference suite retains its
six evaluated synthetic/semantic contrasts; preparation records do not enter
that scored suite or acquire an invented zero.
