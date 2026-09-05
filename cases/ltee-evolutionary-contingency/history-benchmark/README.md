# LTEE History Matters — three frozen protocol contracts

The documented LTEE protocol milestone is implemented as a case-local,
replayable **protocol and eligibility audit**. It formalizes each published
experiment's population, exposure, P/H/Y views, cutoff, missingness, comparison
and evidence requirements. The evaluator is `protocol-census-audit-v1`.

The selected profile is `NOT_ELIGIBLE` for a scored P/P+H comparison and its
verdict is `not-evaluated`. This applies to this aggregate-table profile, not
to LTEE research generally. Independent review remains pending. The observations
and published outcomes were already known; these contracts are retrospective,
not preregistration.

## Three separate protocol records

| Contract | Published unit | Generation groups | Not-run cells | Units | Independent Cit+ mutants | Endpoint |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| [Replay 1](contracts/replay-1.json) | replay population | 12 | 4 | 72 | 4 | approximately 3,700 replay generations; screening every 250 |
| [Replay 2](contracts/replay-2.json) | MC plate | 12 | 4 | 340 | 5 | 59 days |
| [Replay 3](contracts/replay-3.json) | culture plated on MC agar | 14 | 2 | 2,800 | 8 | 45 days |

These are separately preserved observations from Tables 1 and 2 of
[Blount, Borland and Lenski (2008)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2430337/).
The canonical build consumes the existing exact
[source projection](../source/ltee-ara3-citrate-replay.json) and
[upstream lock](../upstream.json), with no network request. The
[original case](../README.md) and its Model Pack retain their identities.

Each contract preserves all 16 published generation labels. A missing
generation-by-protocol cell has status `not-run`, a null observation ID and
null counts. A completed cell with zero mutants is `not-observed`, with its
positive replicate denominator retained. No row becomes `impossible`.
The 38 observed aggregate cells are not 38 independently sampled clones.

## Present, history, target and comparison

- **P:** reported starting Cit- phenotype and the exact replay context. This
  is a coarse protocol-level description, not a measured complete genotype or
  a matched full present state for every replay unit.
- **H:** recorded Ara-3 source generation, known when the replay begins.
  It does not resolve a unique clone or genotype. Original LTEE history and
  the subsequent replay trajectory remain different records.
- **Y:** independent Cit+ mutant counts and observation status at that
  protocol's endpoint, retained with the published unit denominator.
- **Cutoff:** before the new replay, with outcome observation at the separately
  declared endpoint. No unreported per-unit timestamps are invented.
- **P0/P1:** a history-collapsed inventory within one protocol versus the same
  cells displayed by recorded generation. This supports a descriptive census;
  no fitted P0 or P1 predictions or error score are available in this profile.

Every published cell is retained independently of its mutant count. Neither
early/late generation thresholds nor exclusions are selected from outcomes.
No train/test split is manufactured from aggregate rows. There is no pooled
denominator, global mutant rate, benchmark gain or causal effect estimate.

The audit identifies unresolved unit and repeated-clone linkage, the coarse
present representation and the absence of a reviewed scoring design. A future
comparison can supply a justified model for aggregate counts and dependence,
or obtain individual covariates, clone links and outcomes. Either approach
needs a new explicit evaluation policy. The audit does not claim that
aggregate-count analysis is mathematically impossible.

No null is executed: exchangeability of source histories and repeated clones
has not been established. Published Monte Carlo summaries remain attributed.
Replay 2 retains the published expected mean of 28,382 and the simple Table 1
replicate-weighted diagnostic of 26,382; the latter does not replace the former
or reproduce the published Monte Carlo method. This remains an unresolved
diagnostic discrepancy, with no recomputed P value.

## Artifacts and identity

| Artifact | Purpose |
| --- | --- |
| [policy.json](policy.json) | Complete supported interpretation policy |
| [protocol-set.json](protocol-set.json) | Three contracts, source and implementation bindings, review status |
| [assessment.json](assessment.json) | Per-protocol census, blockers and discrepancy; all scores remain null |
| [bundle.json](bundle.json) | Source projection, policy and artifacts for independent local replay |
| [protocol-set schema](schema/protocol-set.schema.json) | Closed case-local protocol transport |
| [assessment schema](schema/assessment.schema.json) | Closed case-local audit transport |

`protocol-model.js` snapshots plain data before reading fields, requires the
exact canonical source projection, validates the complete supported policy and
reconstructs every contract and assessment. Canonical, domain-separated hashes
bind contracts, policy, source, compiler and evaluator. `build.mjs` additionally
rebuilds and verifies the approved original case and source-byte identity.
`--verify` compares all generated files without writing.

The History Matters browser includes this bundle under `experimentalProtocols`.
It verifies the downloaded payload, replays the protocol audit and requires an
exact registry join. An audit cannot become an empirical result or regression
preparation through relabeling. The six existing scored contrasts remain the
three synthetic controls and three software comparisons.

## Reproduce and test

```sh
npm run history-benchmark:ltee:verify
npm run history-benchmark:ltee:test
npm run history-benchmark:check
```

After intentionally changing the supported policy or compiler, regenerate in
dependency order and review the complete diff:

```sh
npm run history-benchmark:ltee:prepare
npm run history-benchmark:reference
npm run history-benchmark:check
```

In the [Explorer](../../../apps/history-matters-benchmark/index.html#ltee-evolutionary-contingency-history-matters-v1),
inspect the three-row census, expand each protocol's P/H/Y and blockers, and
follow all five JSON links. Filtering `empirical` retains LTEE without score
panels. The [repository testing guide](../../../docs/history/HISTORY_BENCHMARK_TESTING.md)
includes the complete acceptance checks.
The [implementation review](../../../docs/history/HISTORY_LTEE_PROTOCOL_REVIEW.md)
records local validation separately from independent scientific review.
