# LTEE protocol implementation review — 2026-09-05

Scope: the next LTEE protocol-formalization milestone, based on commit
`3b7aa86e154401b3f8e84b61a80a2be92ef06d6a`. This is local implementation
self-review, not independent scientific review or permission to score FD001.

## Reviewed behavior

The case-local policy and projector retain all three published protocols and
their units, exposure, generation cohorts and missingness. Six generated JSON
artifacts reproduce from the existing exact source projection. The closed
protocol-set and assessment schemas complement runtime reconstruction, which
rejects modified meaning even after every affected hash is recalculated.

The browser/registry join rejects missing, duplicate, unregistered and relabeled
experimental bundles. LTEE's protocol audit cannot masquerade as an exact result
or numeric regression preparation. All scores remain null; the case-specific
`NOT_ELIGIBLE` status concerns scored P/P+H evaluation under this profile.

Review clarified that aggregate counts do not make statistical analysis
impossible: a future reviewed aggregate-count model is an explicit alternative
to collecting individual-unit evidence. An accidental extra argument introduced
while updating two test clones was also removed and the Explorer tests rerun.
No unresolved implementation finding remains from this review.

## Validation record

Local environment: macOS, Node.js 24.19.0, native headless Chrome.

- `npm ci --offline`: succeeded from the locked dependency cache.
- `npm test`: **1,162 passed, 0 failed**; seven added behavioral tests.
- Focused LTEE and Explorer tests: **12 passed, 0 failed**. The six Explorer
  tests also passed after the final test-only cleanup.
- `npm run build`: all repository checks passed, including 158 shared schemas,
  the two additional case-local schemas, types, package boundaries, 24 Atlas
  cases, 20 Model Packs, FD001 preparation and exact pilot/protocol replay.
- Chrome: three compact controls and five examples, scoped filters, empty
  selections, all 20 JSON artifact links, all three LTEE protocol disclosures,
  source discrepancy, direct anchors and the LTEE History Atlas link passed.
  Expanded layouts fit 320, 390 and 768 pixels; keyboard focus remained visible.
  Corrupted or blocked payloads cleared both sections and recovered on reload.
- Direct comparison with the base commit: all six previous input sets, primary
  metrics, verdicts, null assignments/results and interpretation boundaries are
  identical. Compiler-bound hashes changed coherently with pilot assembly.
- The original LTEE source projection, upstream lock, case artifact, Model Pack
  registry and FD001 readiness remain byte-identical to the base commit.
- `git diff --check`: passed.

Windows, Linux and Node.js 22 were not executed locally. The existing CI matrix
must supply those platform results. No independent reviewer is recorded, no
new empirical score or P value is computed, and no benchmark-v1 claim is made.

The [protocol package](../../cases/ltee-evolutionary-contingency/history-benchmark/README.md)
and [testing guide](HISTORY_BENCHMARK_TESTING.md) provide reproducible commands,
expected observations and the next scientific evaluation requirements.
