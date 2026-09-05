# History Matters Benchmark Explorer

Run `npm run dev:site` and open
`http://127.0.0.1:8080/apps/history-matters-benchmark/`.

The static page checks the SHA-256 pin of `pilot.json` before parsing it, replays
all six results through `@onto2d/history-benchmark`, checks suite identity and
registry correspondence, then enables filters. A mismatch leaves results
unavailable. No network service or third-party runtime dependency is required.
Transfer is limited to 1 MiB of decoded bytes and 15 seconds; oversized streams
are cancelled before their remaining body is buffered. Failed verification
clears cards and leaves filters disabled.
The page explains that this local replay runs on each page load: three synthetic
checks and three completed domain examples are recalculated against the saved
reference. Filtering does not replay results. No models are trained or empirical
candidates evaluated in the browser.
The separate LTEE experimental bundle is reconstructed as a protocol/census
audit before registry joins. Its three contracts retain distinct units and
exposure, missing cells and source-attributed statistics. The card shows a
three-row census and expandable P/H/Y and evidence requirements; a protocol
audit is never counted among the six scored results.

**Examples and research** contains the five domain cases and candidates. Claim
class, result, history access and effect filters apply only to this section;
its count excludes synthetic controls. An empty selection is explained explicitly.

**How the analysis works** comes first, with three compact square cards in one
desktop row: history helps, hurts or changes nothing. Each card states the
expected effect, explains the setup and shows the actual pairwise error counts
and verdict. **How this check works** expands the full evidence. On narrow
screens the cards stack and grow to fit the text. These synthetic controls
explain and test the evaluator; they are not evidence about real systems.
All three remain visible regardless of example filters. Existing section and
card anchors still allow direct navigation.

Missing results have no numeric zero. Cards show P/H/Y definitions, exact error
counts, null outcome, interpretation boundaries and links to the frozen contract
and result.

```sh
npm run history-benchmark:check
```

The six completed pilot results are synthetic and semantic. Operational Aging
now shows an evaluation-ready full-cohort preparation, frozen contract and
prediction links; its held-out error remains unavailable pending independent
review. LTEE has three frozen protocols and an eligibility audit; this
aggregate-table profile remains ineligible for scoring pending an appropriate
reviewed evaluation design. See the
[method](../../docs/history/HISTORY_MATTERS_BENCHMARK.md).
