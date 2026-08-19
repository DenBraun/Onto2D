# Operational Aging Model Pack

This source-locked Model Pack compiles the NASA C-MAPSS FD001 analysis into separate, queryable evidence layers.

- Current-frame distance uses settings and sensors only.
- Observed prefixes contain no future test rows and do not expose latent health.
- NASA-provided RUL remains a held-out outcome, never a distance input or a prediction.
- The flagship pair is outcome-aware and selection-biased; it is a demonstration, not a predictor evaluation.
- Declared nearness does not create exact engine-state identity.
- Historical Load remains `null` because the case defines no finite alternative-history space, route cost, or baseline route.

Build with `node models/operational-aging/build.mjs`; verify the committed release with `node models/operational-aging/build.mjs --verify`.
