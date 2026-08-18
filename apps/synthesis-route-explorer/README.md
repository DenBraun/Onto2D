# Synthesis Route Explorer

A light-theme, read-only explorer for the deterministic Chemical Synthesis
History artifact.

It verifies the exact artifact bytes in the browser before rendering and shows:

1. five exact product-SMILES cohorts;
2. minimum/maximum measured-yield route-fragment comparisons;
3. identity results at target, ORD-record, and route-profile levels;
4. the native cross-referenced islatravir cascade;
5. one actual and three counterfactual analysis routes;
6. two plain-language Historical Load interpretations.

No user-controlled value is rendered through HTML interpolation. Long chemical
identifiers and hashes wrap inside bounded panels on narrow screens.
