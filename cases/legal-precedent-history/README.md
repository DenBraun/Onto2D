# Legal Precedent / Green available-at-time context

This case is a source-locked, deterministic representation of seven selected
U.S. Supreme Court public-school desegregation opinions from `Brown I` (1954)
through `Swann` (1971).

## Result

At the official decision date of `Green`, four selected earlier opinions were
available in the bounded cohort: `Brown I`, `Brown II`, `Cooper`, and
`Griffin`. CourtListener's native `opinion.cites` records contain direct
`Green -> earlier opinion` edges for all four. The later `Alexander` and
`Swann` opinions are retained in the complete bounded source record but are
excluded from the 1968 context projection.

The 16 native citation edges remain separate from four source-attributed
treatment claims read from the official `Green` opinion. Neither layer asserts
that a selected authority is binding. Citation counts are retained only as
provider metadata and are not used by any derivation.

## Evidence boundary

- CourtListener IDs, opinion SHA-1 values, native citation lists, and provider
  dates are pinned in a compact source projection.
- Seven official United States Reports PDFs are pinned by URL, byte count, and
  SHA-256; GovInfo decision dates drive the time slice.
- `Cooper` and `Swann` have differing GovInfo decision dates and CourtListener
  `dateFiled` values. Both fields remain visible; the conflict is not erased.
- The seven opinions are a deliberately incomplete research cohort, not a
  complete statement of school-desegregation doctrine or current law.
- The counterfactual removes `Brown II` only from a derived graph view. The
  seven source opinions and 16 recorded citation edges remain unchanged.
- Historical Load is not evaluated and remains `null`, not zero.
- The artifact and explorer are research visualizations, not legal advice.

## Reproduce

```sh
npm run case:legal-precedent
npm run case:legal-precedent:verify
npm run model:legal-precedent
npm run model:legal-precedent:verify
```
