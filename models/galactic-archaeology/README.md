# Galactic Archaeology Model Pack

This directory compiles the exact Gaia DR3 Galactic Archaeology case artifact
into a portable Onto2D Model Pack. The graph exposes 64 stellar-source nodes,
five evidence layers, four deterministic rule profiles, four bounded candidate
interpretations, two quality regimes, and explicit origin/ancestry boundaries.

The pack deliberately contains no birth-origin, common-ancestry, causal, or
unique-formation-history edge.

Build or verify the release from the repository root:

```sh
npm run model:galactic-archaeology
npm run model:galactic-archaeology:verify
```
