# Historical Load Explorer

This directory contains a dependency-free interface prototype for the
illustrative quantity `dH(x | F) = aF - a0`.

The examples are deliberately small, disclosed path sets evaluated in the
browser. They are not verified kernel run artifacts, scientific solver
outputs, or empirical results. This boundary is stated in the interface and
in the Methods dialog. The empirical motif reproduction has its own
[Three-Node Motif Explorer](../three-node-motif-explorer/README.md).

Run the local static server from the repository root (npm is not required):

```sh
node apps/historical-load-explorer/serve.mjs 8080
```

Then open `http://127.0.0.1:8080/apps/historical-load-explorer/`. The server
also exposes the project landing page at `http://127.0.0.1:8080/`. If npm is
installed, the equivalent shortcut is `npm run dev:site`. Pass another port
directly when needed:

```sh
node apps/historical-load-explorer/serve.mjs 8090
```

The pure illustrative model is in `model.js`; browser rendering and controls
are in `app.js`.
