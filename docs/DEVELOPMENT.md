# Development

## Setup

Use Node.js 22+ with npm, Git, and Python 3.9+. Normal tests and Structural
Geometry checks invoke Python standard-library references. NetworkX belongs in
a separate reference environment; it is not a JavaScript runtime dependency.

```sh
npm ci
npm test
npm run build
npm run dev:site
```

`npm test` runs the repository test suite. `npm run build` runs the repository
checks and validates publishable source packages and the static worker asset;
it includes `npm run check`, so running both consecutively is unnecessary.
The development server prints its address. For local browser testing, open the
case or app from the site navigation after the checks pass.

## Check the relevant boundary

| Command | Purpose |
|---|---|
| `npm run check:docs` | Documentation files, local links and fences |
| `npm run check:types` | Published TypeScript entrypoints |
| `npm run check:schemas` | Schema compilation and export coverage |
| `npm run check:workspace` | Package and dependency boundaries |
| `npm run check:closure` | Kernel capability and closure evidence |
| `npm run check:goldens` | Independent canonicalization and skeleton fixtures |
| `npm run check:registry` | Model Pack registry and Studio pin |
| `npm run check:public-revisions` | Coherent public module revisions |
| `npm run check:worker` | Reproducible browser worker bundle |
| `npm run audit:catalogue` | Preserved source-catalogue audit |
| `npm run structural-geometry:check` | Combined geometry evidence and independent references |
| `npm run structural-geometry:added-value:check` | Frozen synthetic added-value study, coverage and baselines |
| `npm run history-benchmark:check` | History Matters sources, replay and registry |
| `npm run history-benchmark:aging:verify` | Full FD001 preparation without held-out scoring |
| `npm run history-benchmark:ltee:verify` | Three LTEE contracts and eligibility audit |

Case READMEs give focused commands, expected results, source terms and external
requirements. [Structural Geometry evidence](structural-geometry/EVIDENCE.md)
links all of its independent reference suites, including NetworkX setup.
Use `npm run` or [package.json](../package.json) for the complete command list.

## Change and review workflow

1. Find the owner in [Project structure](PROJECT_STRUCTURE.md) and read its
   current contract. Preserve unrelated working-tree changes.
2. For semantic behavior changes, add meaningful behavioral or independent
   reference coverage. Update schemas and public declarations together.
3. Update the owning subject guide, case README and roadmap status where needed.
   Do not create a separate fix history, ADR or per-stage review document.
4. Review the complete diff, error/missingness paths, budgets, source binding,
   exact arithmetic, browser/Node boundaries and artifact provenance affected by
   the change. A schema-valid or self-consistently hashed artifact still needs
   semantic verification.
5. Run focused checks. For runtime/contract changes run the full tests and build;
   for documentation-only changes run documentation and affected registry checks
   plus build. Report what was actually run and any remaining verification.

The kernel fails closed. Incomplete evidence, unavailable observations,
exhausted budgets, invalid inputs and negative scientific outcomes are distinct.
Never change frozen expected results solely to make a check pass.

## Frozen inputs and deliberate regeneration

Scientific protocols, source locks and reference results live beside cases.
Some Markdown protocols are hashed experimental inputs, so a documentation move
must not rewrite their bytes. Keep linked mathematical contracts available.
A protocol revision starts a separately identified study and preserves the
reported result of the prior study.

`python3 scripts/reference/generate-conformance-fixtures.py` deliberately writes
canonicalization/skeleton fixtures. `npm run check:goldens` compares without
writing. Use case-specific `:verify` or `:check` commands for normal work;
`:build`, writers and explicit `--write` modes are intentional regeneration.

Source facts in `references/` and upstream archives retain their exact content
and terms. Model Pack `releases/` directories are immutable dataset artifacts;
they are not a software changelog. The geometry baseline verifier's
`--compatibility` mode checks its pinned compatibility subset; its complete
pre-regime inventory is an earlier computational snapshot, not the current
repository file census.

## Browser and publication checks

Verify selection, navigation, evidence disclosure, loading failures, worker
cancellation and comparison/missingness states for the affected interface.
Confirm that displayed results come from the verified artifact and that a
planned study appears as unevaluated. Inspect at narrow and wide widths when
layout changes. Rebuild and check worker/public revisions when their inputs
change.

The project has no first published release. Before publishing: independently
review identity fixtures and source audits; run Node.js 22/24 CI on the exact
commit; inspect `npm pack --dry-run`, public declarations, licenses and source
notices; confirm package visibility and publication scope. Report observed local
checks separately from CI and independent scientific review. Package version
fields alone do not authorize or establish publication.
