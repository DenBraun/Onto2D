# History Matters testing and acceptance

Use Node.js 22 or later and run commands from the repository root. The committed
FD001 observation snapshots make benchmark verification offline; no NASA download
or held-out target extraction is needed. Install the locked workspace dependencies
with `npm ci` (`npm ci --offline` works when the lockfile packages are cached).

## Automated checks

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

## Browser checklist

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

## Expected evidence boundaries

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

## Intentional regeneration

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
