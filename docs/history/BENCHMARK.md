# History Matters benchmark

The implemented pilot compares a fixed present representation P with the same
P plus admissible history H for a declared target Y. P0 uses P, P1 uses P+H and
N0 reassigns H under a declared null. Exact semantic evaluation and numeric
prediction preparation are separate profiles. Empirical scoring and independent
review remain open; see the [current roadmap](../ROADMAP.md).

A cross-domain average and a global history score have no defined meaning.
Synthetic controls test the evaluator; software identity labels are semantic
conventions, not independently observed outcomes. Pairwise error penalizes
spurious splitting as well as missed distinctions.

## Implemented corpus

| Contrast | Claim/design | P0 errors | P1 errors | Verdict |
| --- | --- | --- | --- | --- |
| Synthetic path control | synthetic/control | 16/28 | 0/28 | positive |
| Synthetic irrelevant distinctions | synthetic/control | 0/28 | 12/28 | negative |
| Synthetic repeated history | synthetic/control | 0/28 | 0/28 | neutral-within-resolution |
| Git ancestry | semantic/exact | 6/15 | 0/15 | positive |
| OCI layer sequence | semantic/exact | 6/6 | 0/6 | positive |
| Reproducible-build toolchain | semantic/exact | 2/6 | 0/6 | positive |
| Operational Aging (EVALUATION_READY) | empirical/predictive preparation | — | — | not-evaluated |
| LTEE (NOT_ELIGIBLE for this scoring profile) | empirical/experimental protocol audit | — | — | not-evaluated |

These results apply only to the declared census and equality evaluator. In OCI,
permuting unique histories preserves the partition: its null does not show that
correct correspondence adds utility. All null assignments and this limitation
are published. Git's complete census contains two final trees; equal-state
comparisons are pair-local rather than a claim that all six heads share a tree.

## Use and remaining evaluation

```sh
npm run history-benchmark:goldens
npm run history-benchmark:test
npm run history-benchmark:check
```

The [Explorer](../../apps/history-matters-benchmark/index.html) verifies exact
payload bytes and replays all six available results locally on each page load.
This is deterministic verification, not model training or scoring of candidates.
Three compact synthetic checks explain the method above the domain examples.

FD001 preparation contains 100 training and 100 test engines, 972 training
prefixes, four frozen prediction views and 16 history-null preparations.
Preparation and default checks do not read test RUL. Review the frozen design
before joining held-out targets and publish the result regardless of direction.
The source was already analyzed; this is not independent preregistration.

The [LTEE protocols](../../cases/ltee-evolutionary-contingency/history-benchmark/README.md)
preserve three distinct source-bound cohorts and missing cells. Its descriptive
census does not supply a scored present/history comparison. An aggregate-count
model or additional unit-level evidence needs a justified new scoring contract.

<a id="history-benchmark-contract-v1--pilot-profile"></a>

## History Benchmark Contract v1 — pilot profile

The [contract schema](../../packages/schemas/schemas/history-benchmark-contract.schema.json)
is closed, as are observation, view, target, split, result, suite and registry
schemas. Runtime validation additionally checks source uniqueness, population
joins, exact bindings, cutoff and event order. Unsupported designs are rejected.

Contracts carry source-byte hashes, canonical observation/target hashes, builder
hash, evaluator implementation hash and version, population, view definitions,
cutoff policy, selection/split policy, oriented metric/resolution, null plan and
interpretation boundary. Changing an interpretation-bearing field changes the
contract identity. Filesystem paths identify source locks inside the repository;
canonical result identity contains no execution timestamp or platform label.

The only evaluator is `identity-partition-v1`: compare equality of P, and of
the tuple (P, ordered H), against equality of separately stored target labels.
Every unordered unit pair is evaluated. Error is the disagreement count divided
by pair count; oriented gain is (P0 errors − P1 errors) / pair count. Integer
counts are authoritative, and the numeric rendering uses ECMAScript binary64.
Resolution is declared in [0,1]; there is no fitted statistical uncertainty.
Ordinal cutoffs establish declared availability order, not physical wall time.

The only split is `complete-census`. No training or held-out predictive claim
is supported. Unit rows are sorted by ECMAScript UTF-16 code-unit ID order before hashing/evaluation;
IDs and absolute ordinals do not enter features. Ordered historical values do.
Target labels can be null, which yields an indeterminate result without metrics.

`history-permutation-v1` sorts donor histories by domain-separated SHA-256
priorities of seed, trial and unit ID. Assignments are bijective and fully
recorded. These hash-priority trials are deterministic diagnostics, not uniform
random samples or a p-value. The null can be diagnostic or required to have a
mean error worse than P1 by more than the declared resolution. A reassigned
history is explicitly a counterfactual control, never admissible source evidence.

| Result | Meaning |
| --- | --- |
| positive | P1 improves beyond resolution, and any required null comparison passes |
| negative | P1 worsens beyond resolution |
| neutral-within-resolution | No difference beyond the declared resolution |
| indeterminate | Missing target, insufficient census, incomplete null or unmet required null comparison |
| invalid | Input binding, population, cutoff or order violation |
| not-evaluated | Registry member without a run; no primary metric |

Malformed shape, unsupported profiles and outcome-aware selection declarations
throw typed validation errors rather than yielding a scientific verdict.
An exhausted null retains any completed primary metric but makes the verdict
indeterminate. Verification recomputes the full result, not merely its hash.
Suite construction replays every member and rejects duplicate benchmark IDs.
Execution options are plain canonical data with an optional integer
`maxNullTrials` in [0,256]. Null budgets, arrays, unknown fields and accessors
are rejected; a malformed budget cannot silently select the full ensemble.

`EVALUATED` means a complete reproducible run exists; it does not mean
`REPLICATED` or `REVIEWED`. The pilot builder can intentionally regenerate
contracts, but `--verify` never writes and rejects any drift. A new frozen
artifact hash does not itself prove preregistration before seeing outcomes.

The [LTEE case-local contracts](../../cases/ltee-evolutionary-contingency/history-benchmark/README.md)
use a separate protocol-census audit and separate schemas. Their registry entry
links a protocol set and `assessmentPath`; it remains `NOT_ELIGIBLE` for scored
P/P+H evaluation under that profile, with verdict `not-evaluated`. Audit records
never enter this exact result suite or masquerade as regression preparations.

<a id="history-benchmark-leakage-boundary"></a>

## History Benchmark leakage boundary

The root v0 API implements an exact census profile. A separate
[regression profile](#history-regression-preparation-v1) now implements unit-disjoint
preparation and scoring, with independent review pending for the FD001 case.
Neither profile establishes causal identification.
The [LTEE protocol audit](../../cases/ltee-evolutionary-contingency/history-benchmark/README.md)
is a third, case-local evidence profile with no scoring. It uses the complete
already-published table census, preserves protocol-specific exposure and null
missing cells, and rejects generation-to-clone/genotype promotion. P/H/Y are
documented views of retrospective aggregate evidence, not target-blind fitted
features. No independent-unit split, pooled rate or exchangeable-history null
is inferred from those aggregates.

| Boundary | Mechanical protection | Remaining review obligation |
| --- | --- | --- |
| Target access | P/H builder accepts only a closed observation object; target table joins later | Case projection must not encode a target or proxy into an opaque symbol |
| Availability | Present time equals cutoff; ordered history times are at or before cutoff; future targets are later | Source times and evidence availability must mean what the case declares |
| Population | Complete input hashes, unique IDs, exact target join; pilot regeneration uses every source-fixture unit | Source selection and original case design can still be outcome-aware |
| Source drift | Checker rebuilds all artifacts from exact source bytes and implementation hashes | Hashes bind bytes, not authenticity or truth |
| Split | Only complete census accepted; unsupported held-out claims rejected | Future predictor must enforce unit/duplicate separation and train-only preprocessing |
| Null | Fixed seed, trial count and role; bijective assignments; incomplete ensemble is indeterminate | Exchangeability, statistical uncertainty and useful null semantics are domain-specific |
| Reporting | Registry retains empirical candidates; controls include negative/neutral results | Case inclusion and independent preregistration cannot be proven by local code alone |

P and H values in this pilot are opaque exact symbols. Arbitrary proxy detection
is not claimed. Synthetic labels are designed controls; semantic labels derive
from the identity regime. Neither is evidence of independent predictive utility.
Source records may legitimately be duplicate observations of distinct units;
the census keeps them. Unit IDs themselves cannot be duplicated.

The current Operational Aging source pair used the supplied outcome during
selection. It remains illustrative. Only a new full-cohort pipeline, with
separate target extraction and frozen splits, can support a predictive result.

Tests inject stale history/target bytes, duplicate IDs, extra target fields,
post-cutoff history, reversed events, mismatched populations, metric/seed/code
drift, missing labels and incomplete nulls. Independent review must still check
the meaning and lineage of every feature and target before an empirical claim.

<a id="history-regression-preparation-v1"></a>

## History regression preparation v1

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

<a id="history-matters-testing-and-acceptance"></a>

## History Matters testing and acceptance

Use Node.js 22 or later and run commands from the repository root. The committed
FD001 observation snapshots make benchmark verification offline; no NASA download
or held-out target extraction is needed. Install the locked workspace dependencies
with `npm ci` (`npm ci --offline` works when the lockfile packages are cached).

<a id="history-matters-testing-and-acceptance--automated-checks"></a>

### Automated checks

```sh
npm run history-benchmark:test
npm run history-benchmark:aging:test
npm run history-benchmark:ltee:test
node --test test/apps/history-matters-benchmark.test.mjs
npm run history-benchmark:check
```

These checks cover both public entrypoints, analytic controls, split and cutoff
leakage, training-only normalization, deterministic distinct-unit neighbors,
numeric extremes, malformed budgets, source projection, all frozen preparations,
browser transfer limits, schemas, registry joins and the exact browser payload.
LTEE checks cover all three protocol censuses and exposure, missing-as-null,
unresolved clone identity, unchanged source discrepancies and coherently rehashed
attempts to pool protocols, alter denominators or promote claims.
The checker compares committed files with regenerated values in memory and
does not write replacement fixtures.

Run the complete repository acceptance gates before committing:

```sh
npm test
npm run build
git diff --check
```

`build` runs the repository checks, including TypeScript declarations, package
boundaries, all schemas, kernel closure, Model Pack registry and benchmark replay.

<a id="history-matters-testing-and-acceptance--browser-checklist"></a>

### Browser checklist

```sh
npm run dev:site
```

Open `http://127.0.0.1:8080/apps/history-matters-benchmark/`. If port 8080 is
occupied, use `npm run dev:site -- 8087` and the corresponding URL.

1. Wait for **Data checked. All 6 saved results reproduced locally in your
   browser.** Above the five **Examples and research** cards, **How the analysis
   works** must show three compact square controls in one desktop row. Each
   states an expected effect, brief explanation, actual error counts and
   observed verdict. Full evidence is collapsed initially. Browser console
   and network requests should show no errors.
2. Inspect the positive, negative and neutral controls: the errors must be
   16/28 → 0/28, 0/28 → 12/28 and 0/28 → 0/28 respectively. Expand **How this
   check works** to inspect P/H/Y definitions, exact metrics, nulls and artifact
   links. Example filters must not contain synthetic-only options or affect
   these controls, including open disclosures. Expand **What runs in my
   browser?**: it must explain replay on page load, with no replay on filtering,
   model training or empirical candidate evaluation.
3. Select claim class **empirical** and clear the result filter: two candidates
   remain in the examples section and neither has score panels. The example count
   is 2/5; all three analysis checks remain. Operational Aging displays EVALUATION_READY,
   not evaluated, 100 training engines, 972 prefixes and 100 test engines. Its
   three artifact links must resolve. LTEE displays NOT_ELIGIBLE for scoring
   under this source profile and not evaluated. Its three census rows show
   72 / 4, 340 / 5 and 2800 / 8 units / independent Cit+ mutants, with distinct
   unit labels and no combined total or benchmark score. Expand all three
   protocols: P/H/Y, endpoints, missingness, blockers and the replay-2 discrepancy
   must remain visible. All five LTEE JSON links must resolve.
4. Combine **empirical** with **positive**: no example cards appear, the example
   count is 0/5 and a no-matches message appears. All three analysis checks remain
   visible. Clear filters to restore five examples and hide the empty message.
5. Inspect OCI's wrong-history caveat: the true history does not beat the null
   mean. Expand exact artifacts and follow contract/result links.
6. At 390-pixel viewport width, the controls must stack. Confirm cards,
   selectors, links and expanded artifacts fit without horizontal page scrolling
   or clipped text. Use Tab to check visible focus on navigation, filters and
   disclosure controls. Expanding one desktop control must not expand the others.
7. Open History Atlas and follow a History Matters badge, including Operational
   Aging. It should navigate to the corresponding benchmark card. Test
   a synthetic control's direct card anchor as well. Check that the root Case
   Studies menu and existing case pages still load.
8. In browser developer tools, block `*/pilot.json` and reload. Results must be
   unavailable, both groups' cards and counts absent, no no-matches message and
   selectors disabled. Remove the block and reload to recover. Automated
   transfer tests additionally cover oversized streams and
   deceptive Content-Length; the payload pin rejects changed bytes.

<a id="history-matters-testing-and-acceptance--expected-evidence-boundaries"></a>

### Expected evidence boundaries

| Group | Expected result |
| --- | --- |
| Three synthetic controls | positive, negative, neutral-within-resolution |
| Git, OCI, reproducible builds | semantic/exact, P1 error 0, diagnostic nulls retained |
| Operational Aging / FD001 | four prediction views, 16 null preparations, no held-out score |
| LTEE | three frozen protocol contracts, separate census and eligibility audit, no score |
| Explorer groups | five examples/candidates; three separately counted analysis checks |
| Portfolio | eight registry entries, six scored contrasts, no aggregate metric |

Code review and passing tests do not constitute independent scientific review.
FD001 held-out scoring remains pending that review; its existing public source
analysis already exposes outcomes, so this is a retrospective preparation.

<a id="history-matters-testing-and-acceptance--intentional-regeneration"></a>

### Intentional regeneration

Only after changing a source, protocol or implementation, rebuild in dependency
order and inspect all resulting artifact changes:

```sh
npm run history-benchmark:aging:prepare
npm run history-benchmark:ltee:prepare
npm run history-benchmark:reference
npm run history-benchmark:check
```

Implementation hashes intentionally change contract/result identities. Review
metric and prediction changes separately from hash-only changes. Never regenerate
fixtures merely to hide an unexplained failing verification.
