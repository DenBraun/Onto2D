# `@onto2d/history-benchmark`

Exact History Matters pilot comparisons outside the closed schema-v1 kernel.
The root entrypoint compares identity partitions over a complete finite
census, supporting synthetic, semantic and normative claims. The separate
`@onto2d/history-benchmark/predictive` subpath adds unit-disjoint numerical
regression preparation and scoring. Experimental protocols still require their
own future evaluator contract.

```js
import {
  runHistoryBenchmark,
  verifyHistoryBenchmarkResult
} from "@onto2d/history-benchmark";

const result = runHistoryBenchmark(contract, { observations, targets });
verifyHistoryBenchmarkResult(result, contract, { observations, targets });
console.log(result.verdict, result.primary);
```

`buildHistoryBenchmarkViews(contract, observations)` accepts no target records.
Contracts bind exact normalized observation and target inputs, source locks,
the builder and evaluator implementation, metric resolution and null plan.
`normalizeObservations` and `normalizeTargets` sort unit sets; event order
remains meaningful. Outputs are immutable plain-data envelopes with
domain-separated kernel canonical hashes.

The metric counts disagreement between input equality and reference-class
equality for every unordered pair. Both numerator and denominator are retained;
the decimal is their binary64 quotient. Positive oriented gain means fewer
errors. Synthetic controls deliberately demonstrate positive, negative and
neutral results. Wrong-history permutations use frozen seed/trial hash
priorities and expose donor assignments. They are diagnostic trials, not a
uniform statistical ensemble, confidence interval or significance test.

Malformed/unsupported contracts throw `HistoryBenchmarkError`; noncanonical
values such as accessors throw a typed kernel canonicalization error. Stale input
bindings and cutoff violations produce `invalid` results without metrics.
Missing labels, singleton populations and exhausted null budgets produce
`indeterminate`. Set `{ maxNullTrials: 0 }` to exercise exhaustion; verification
of a partial result requires the same execution option. The suite builder
accepts only full-budget replay and never averages metrics across cases.

The pure API checks normalized input bindings, not filesystem bytes or the
meaning of opaque feature symbols. The repository pilot checker additionally
rebuilds every projection from exact source files, binds all three evaluator
modules and the builder bytes, and compares frozen artifacts. Source
authenticity, hidden proxies, semantic labels, and independent preregistration
remain review responsibilities. This pilot does not claim to prevent arbitrary
upstream encodings of target information.

See the [method](../../docs/history/HISTORY_MATTERS_BENCHMARK.md),
[contract](../../docs/history/HISTORY_BENCHMARK_CONTRACT.md) and
[leakage boundary](../../docs/history/HISTORY_BENCHMARK_LEAKAGE_MODEL.md).

```sh
npm run history-benchmark:test
npm run history-benchmark:check
```

## Predictive preparation

See the [regression profile](../../docs/history/HISTORY_REGRESSION_PREPARATION.md)
for typed preparation, exact replay and separated scoring APIs. The first
[FD001 preparation](../../cases/operational-aging/history-benchmark/README.md)
is evaluation-ready with 100 training engines, 972 prefixes, 100 test endpoints
and fixed predictions; independent review and held-out scoring remain pending.
