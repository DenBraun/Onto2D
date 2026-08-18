# Artwork Provenance Model Pack

Deterministic Model Pack compiled from `cases/getty-artwork-provenance/`. It exposes exact Getty artwork, activity, actor, place, and stock-book records alongside two derived history views, one explicit unknown interval, and five regime-relative equivalence results.

Native Getty relations remain marked `native`; Onto2D projections and comparisons are `derived`; the gap is `reconstructed` with `unknown` contents. Every acquisition/current-owner edge explicitly records that it is not an Onto2D legal-title determination.

Build with `npm run model:artwork-provenance`; verify with `npm run model:artwork-provenance:verify`.
