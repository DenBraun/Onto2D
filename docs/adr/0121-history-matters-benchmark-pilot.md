# ADR-0121: History Matters pilot outside the closed kernel

Status: implemented; independent benchmark review pending

## Context

The History Atlas describes evidence across domains, but selected examples do
not measure the utility of H beyond a declared P for Y. The supplied proposal
calls for leakage-aware contrasts without conflating identity with prediction.
The kernel v1 and its run-store bundle contract are locally closed.

## Decision

Add `@onto2d/history-benchmark`, depending inward only on the existing kernel
canonical subpath. Its v1 transport profile implements a complete-census exact
partition evaluator, three synthetic controls, three semantic source-fixture
contrasts and a separate maturity registry. Eight closed schemas describe its
transport. The browser checks a frozen payload pin and replays all results.

Contracts bind source, observations, targets, builder/evaluator implementation,
views, cutoff, population, split, metric resolution and null policy. Target input
is structurally absent from the view-builder API. Canonical hashing ignores unit
row order but preserves event order. Results retain error counts, every null
assignment and explicit failure states. The suite never produces a global score.

## Alternatives considered

Extending the kernel or shoehorning benchmark results into kernel run bundles
would change a closed semantic boundary for case-level convenience. A universal
ML evaluator would prematurely imply empirical safeguards that are not yet
implemented. Pair-count disagreement is used instead of partition count, which
would reward arbitrary over-separation and conceal negative controls.

## Consequences

Empirical and experimental candidates have plans and no synthetic substitution
for their missing results. Exact census permits duplicate observations of
different units but rejects duplicate unit IDs. Source meaning/proxy leakage and
independent preregistration remain explicit review responsibilities. Hash-priority
nulls are deterministic diagnostics, not statistical significance. The existing
kernel, Model Packs and scientific-adapter contracts do not migrate.

## Artifacts and acceptance

`npm run history-benchmark:check` verifies source/implementation drift, every
frozen artifact, registry correspondence and the browser pin. Tests cover
analytic positive/negative/neutral counts, semantic controls, tampering,
permutation invariance, cutoff leakage, missingness, null exhaustion and schemas.
See the [method](../history/HISTORY_MATTERS_BENCHMARK.md) and
[review guide](../history/HISTORY_BENCHMARK_REVIEW_GUIDE.md). No reviewer or
empirical validation is claimed by this engineering milestone.
