# Historical Load Explorer

This directory contains a dependency-free page with two explicit boundaries:

- an interface prototype for the illustrative quantity
  `ΔH(x | F) = aF - a0`;
- a read-only projection of the frozen empirical
  [`three-node-motifs`](../../cases/three-node-motifs/README.md) case.

The current examples are deliberately small, disclosed path sets evaluated in
the browser. They are not verified kernel run artifacts, scientific solver
outputs, or empirical results. The separate motif section displays a real
network census, but those statistics do not enter the ΔH calculation. Both
boundaries are stated in the interface and in the Methods dialog.

Run the local static server from the repository root (npm is not required):

```sh
node apps/historical-load-explorer/serve.mjs 8080
```

Then open `http://127.0.0.1:8080`. If npm is installed, the equivalent shortcut
is `npm run dev:explorer`. Pass another port directly when needed:

```sh
node apps/historical-load-explorer/serve.mjs 8090
```

The pure illustrative model is in `model.js`. `motif-data.js` is a static
projection of the case catalogue and 1,000-trial artifact. Cross-check tests
prevent it from drifting from those authoritative files.
