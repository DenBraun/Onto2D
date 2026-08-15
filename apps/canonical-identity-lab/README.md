# Canonical Identity Lab

This dependency-free interface demonstrates one executable Onto2D kernel
invariant: node/edge input permutations preserve candidate identity, while a
declared change to direction or edge role changes candidate identity.

The browser deliberately does not implement a second graph canonicalizer.
`model.js` contains frozen kernel fixtures, and repository tests recompute all
displayed candidate and skeleton IDs with `@onto2d/kernel`, including all 36
node-permutation x edge-order representations of the baseline graph.

Serve the repository root and open `/apps/canonical-identity-lab/`:

```sh
node apps/historical-load-explorer/serve.mjs 8080
```
