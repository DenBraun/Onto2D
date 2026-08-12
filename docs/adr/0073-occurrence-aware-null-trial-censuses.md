# ADR-0073: Occurrence-aware null-trial local-filter censuses

- Status: accepted
- Date: 2026-08-12

## Context

ADR-0072 emits carrier-size proposal occurrences. In particular, the exact
uniform model samples with replacement, so two occurrences may intentionally
refer to the same canonical candidate. The ordinary package census is a set of
unique canonical candidates and cannot represent this multiplicity. Reusing it
would either copy observed predicate results without executing a trial or
silently deduplicate samples and change the denominator.

## Decision

`package-null-model-trial-censuses-v1` exactly replays a proposal artifact and
reruns the complete package local-filter session for every occurrence. It has
primitive and depth-aware entry points and uses the corresponding reproduced
binding and source population.

An occurrence receives a domain-separated identity over trial ID, occurrence
index, source candidate ID, and proposed candidate ID. It embeds the full
recomputed filter artifact. Repeated canonical candidate IDs remain separate
occurrences with separate occurrence IDs and both contribute to counts.

Each trial reports:

- evaluated, predicate-rejected, filter-indeterminate, and eligible occurrence
  counts;
- Boolean selectivity and indeterminate ratio over occurrence multiplicity;
- the complete per-predicate occurrence census, including exclusive rejection,
  inertness, and the frozen 90% dominance threshold;
- valid, empty, or threshold-bound indeterminate interpretation;
- a separate trial-census hash.

The aggregate artifact reconciles every trial and occurrence and retains the
run's indeterminate threshold. A disabled proposal yields `not-run`. An enabled
artifact reports `local-census-complete` together with the explicit reason
`cohorts-functionals-selectors-and-distributions-pending`; local completion is
not a completed null baseline.

## Consequences

- null candidates are now genuinely re-evaluated rather than borrowing the
  observed census;
- uniform replacement multiplicity remains in the statistical denominator;
- primitive and generalized-depth filtering use their actual verified source
  contexts;
- downstream trial-local cohorts need occurrence identities instead of the
  ordinary candidate-ID set contract;
- functionals, selectors, evidence invalidation, distributions, and baseline
  interpretation remain open.

## Verification

Conformance covers full carrier-size occurrence counts across all models and
trials, unique occurrence identities despite repeated candidate IDs, embedded
filter/candidate identity agreement, Boolean and predicate reconciliation,
disabled state, primitive and depth-aware execution, exact verification,
tampering, kernel facade methods, public types, compiled JSON Schema, and local
Node.js 20/22 execution.
