# History Matters implementation review — 2026-09-05

Scope: all accumulated uncommitted History Matters changes, including the new
package and public declarations, 14 schemas, source projections and generated
artifacts, benchmark/History Atlas registries, Explorer and existing navigation,
workspace integration, tests and documentation. The original supplied draft is
preserved byte-for-byte as design input. This is implementation self-review,
not independent empirical protocol review or a maturity upgrade to REVIEWED.
The reviewed worktree is based on commit `7c500045745c97720dc53ebfefb2bd8c1aa16ea8`.

## Findings fixed

| Finding and reproducing condition | Correction and evidence |
| --- | --- |
| RMSE from 28 errors of 1e12 became 1000000000000.0001, violating the output schema; errors of 1e-200 squared to zero. | Scale errors by their maximum before squaring. Tests cover both extremes, zero error and schema conformance. |
| Empty arrays/strings and `maxNullTrials: null` silently selected a full null ensemble; option and input-envelope getters could execute. | Validate a canonical plain-data options object with an explicit integer budget. Snapshot exact input/suite envelopes before dereferencing. Tests reject malformed budgets and verify getters are never called. |
| Moving the FD001 first cutoff to cycle 200 silently reduced the training cohort from 100 engines to 46 while the contract still claimed all 100. | Reject a protocol leaving any training engine without an eligible prefix. A full-source amendment test reproduces this condition. |
| Contract and browser prose hardcoded the window, sampling grid, neighbor count and preparation counts. | Derive descriptions from the validated protocol and generated readiness; validate every declared FD001 policy before projection. An amended window/grid/k test checks both features and descriptions. |
| The Explorer checked its 1 MiB limit after buffering the complete response. | Enforce the limit while reading the stream, cancel excess transfer, apply a 15-second request timeout and clear all cards/disable filters on failure. Tests cover absent and deceptive Content-Length, interrupted streams and the exact limit. |
| Source-lock validation accepted Windows drive paths and embedded control characters as repository-relative paths. | Align runtime and schema rejection of drive prefixes, URLs, traversal, backslashes and control characters; test independently of the host OS. |

The API tests additionally compare all four regression views with hand-calculated
distances and distinct-unit neighbor selections. Verification instructions now
check existing fixtures first; intentional regeneration has an explicit
preparation-before-pilot order. The Operational Aging plan reflects its completed
preparation and remaining independent review.

## Validation record

Local environment: macOS, Node.js 24.19.0, native headless Chrome. Acceptance:

- `npm ci --offline`: succeeded from the locked dependency cache.
- `npm test`: **1,155 passed, 0 failed**, including nine new review regression tests.
- Focused package/case/Explorer tests: **37 passed, 0 failed**.
- `npm run build`: passed all repository checks, including 158 schemas, public
  types, 195 implemented kernel capabilities, 24 Atlas cases and 20 Model Packs.
- Observation recapture `--verify`: matched the exact pinned NASA archive and
  both committed FD001 observation snapshots without extracting held-out targets.
- Browser: six exact results replayed, eight cards, all filters and empty-result
  combinations, 15 working artifact links, five Atlas benchmark links, root
  navigation and all 24 existing case pages passed. Desktop and 390-pixel mobile
  layouts, keyboard focus, root/Atlas mobile navigation, corrupted payload,
  blocked transfer and recovery on reload passed.
- `git diff --check`: passed. Source snapshots and the original proposal were
  verified against their existing locks/original bytes.

No unresolved implementation finding remains from this local review. Windows,
Linux and Node.js 22 were not run locally; the existing CI matrix covers those
platforms and must supply its own results.

The [testing guide](HISTORY_BENCHMARK_TESTING.md) provides repeatable automated
commands, expected counts and a manual browser checklist. Frozen artifacts were
regenerated after the reviewed implementation changes; the six exact contrasts
retain their analytic metrics and verdicts.

## Remaining scientific scope

FD001 remains EVALUATION_READY with 972 training prefixes, 100 test predictions,
four views and 16 null preparations. Held-out performance is not-evaluated and
the case protocol still records independent review as pending. No new FD001
held-out score was computed during implementation review. LTEE remains a draft.
The generic scorer's raw-target authenticity boundary, prior source outcome
exposure, lack of confidence intervals and diagnostic nature of hash-priority
nulls remain explicit in the method documents.
