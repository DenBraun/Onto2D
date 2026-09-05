# ADR-0122: Unit-disjoint history regression preparation

Status: implemented; independent empirical protocol review pending

## Context

The v0 exact partition evaluator cannot predict continuous remaining duration.
Operational Aging's old illustrative pair was selected with outcome information,
and its selected-history artifact cannot support a full-cohort estimate. The
documented next step requires full observations, separated outcomes and reviewed
leakage controls before case-level scoring.

## Decision

Add the `@onto2d/history-benchmark/predictive` subpath with separate closed
numeric contracts, declarations and schemas. Preparation accepts observation
features and training labels only. It uses train-only ranges, one nearest prefix
per training engine, k distinct neighbors, deterministic tie breaking and a
declared null ensemble. Four views expose a richer age baseline so an eventual
history gain cannot silently rely only on omission of observed age.

The first case captures only the two exact NASA FD001 observation members from
the pre-existing archive lock. A fixed cutoff grid produces 972 prefixes from
all 100 training units; all 100 test endpoints remain eligible. Training labels
join after feature construction. Prediction artifacts, null assignments, source
hashes, compiler/evaluator identity and protocol are frozen before any new
held-out scoring. The public maturity becomes EVALUATION_READY while verdict
remains not-evaluated and independent review remains pending.

## Alternatives considered

Using the selected 25/72 histories would retain outcome-aware selection.
Normalizing over both splits would leak test distribution information. Ordinary
nearest-neighbor selection over all prefixes could count one engine several
times. Embedding test labels in the preparation artifact would remove the clear
scoring boundary. Expanding the old exact-equality schema would conflate semantic
and predictive claims. All are excluded by this profile.

## Consequences

The input archive and old endpoint analysis are public; the preparation is not
independent preregistration or a previously unseen dataset. Raw prefix hashes
detect exact duplicate source sequences across declared splits, not all possible
derived proxies. Source meaning and independent reviewer identity remain external
evidence obligations. The generic scorer is exercised on synthetic outcomes;
FD001 test error is not computed by the preparation or default repository checks.
Nulls are descriptive diagnostics with no confidence interval or p-value.

Adding preparation membership updates the source-bound pilot compiler identity;
the six exact pilot results retain their metrics and interpretations while
their frozen contract/result hashes are regenerated coherently. No released
kernel identity, Model Pack or scientific-adapter contract changes.

## Artifacts and acceptance

The [FD001 protocol and source artifacts](../../cases/operational-aging/history-benchmark/README.md)
replay offline with `npm run history-benchmark:aging:verify`. The package's tests
cover analytic regression, negative/neutral controls, age sufficiency, target
isolation, split contamination, duplicate source records, constant dimensions,
deterministic ties, null exhaustion, tampering and schema conformance.
`npm run history-benchmark:check` verifies source preparation before accepting
registry maturity and browser summaries. Independent review and a subsequent
empirical result remain the next scientific gate.
