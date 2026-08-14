# Historical Load Explorer

This directory contains a dependency-free interface prototype for exploring
the illustrative quantity `ΔH(x | F) = aF - a0`.

The current examples are deliberately small, disclosed path sets evaluated in
the browser. They are not verified kernel run artifacts, scientific solver
outputs, or empirical results. The boundary is stated in the interface and in
the Methods dialog.

Run the local static server from the repository root:

```sh
npm run dev:explorer
```

Then open `http://127.0.0.1:8080`. Pass another port directly when needed:

```sh
node apps/historical-load-explorer/serve.mjs 8090
```

The pure model is in `model.js`; its regression tests live in
`test/apps/historical-load-explorer.test.mjs`.
