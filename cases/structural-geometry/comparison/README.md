# Strict structural comparison controls

SG2-014/015 contains 21 declared pairs expanded into 43 regime runs. The
[protocol](PROTOCOL.md) and [controls](controls.json) precede result generation.
Sources reuse the existing typed controls and exact Causal Emergence release;
two uniformly typed three-node stars add a direct topology collision control.
The [contract](../../../docs/structural-geometry/OBSERVATIONS.md#strict-structural-comparison-and-mandatory-coverage) defines
strict result and mandatory coverage semantics.

| Regime | Complete equal, distance 0 | Complete different, distance 1 | Indeterminate, distance null |
|---|---:|---:|---:|
| Canonical structure | 8 | 3 | 0 |
| Topology summaries | 9 | 2 | 3 |
| Joint typed relations | 6 | 4 | 8 |
| Total | 23 | 9 | 11 |

The outward/inward stars share all seven topology summaries but differ under
directed graph isomorphism. Correlated/crossed edge fields share an untyped graph
and topology profile but differ under a single joint typed matching. Approved
code renumbering restores typed equality; unapproved or partial maps leave the
typed component unresolved. Missing fields, incompatible source vocabularies and
caller-declared use restrictions produce explicit incomplete coverage.

A known untyped difference remains visible when typed data is missing. Rejecting
one summary yields 6/7 coverage; restricting all seven yields 0/7, never equality.
Missing source fields and rejected use remain separately visible. The unchanged
real-source control compares the declared six-node fragment with itself and a
five-node induced scope. It does not establish cross-domain equivalence.

The independent standard-library Python reference reads source declarations,
enumerates directed/typed graph permutations and uses Boolean matrix closure
for summaries. It does not read production artifacts when generating expectations.
Artifact verification also checks comparable graph values belong to the expected
independent isomorphism classes. The strict aggregation census covers all 3,280
profiles of zero through seven components, including the empty-profile failure
of vacuous equality. These are bounded computational controls, not empirical
validation or independent scientific review.

```sh
npm run structural-geometry:comparison:check
npm run structural-geometry:comparison:report
```

The check verifies 117 pinned legacy files, regenerates the independent expected
results in memory, replays all 43 stored comparisons, verifies graph values in
Python and runs 25 behavior/schema/browser tests. The full `npm test` also
discovers three reference tests. Report mode verifies before printing results.

For an intentional new control revision, review declarations and independently
derived outcomes before updating the new suite:

```sh
python3 -B cases/structural-geometry/comparison/reference.py --write
npm run structural-geometry:comparison:build
```

The builder validates every source binding and independent result before writing
any output. Do not rewrite earlier observation suites, mappings or goldens.
The [suite index](suite.json) binds all 43 artifact hashes and the independent
[reference](reference.json). See the [review](../../../docs/structural-geometry/EVIDENCE.md)
for runtime verification evidence and the next stage.
