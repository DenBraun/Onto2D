# Three-Node Motif Explorer

This static application is a read-only interactive projection of the frozen
[`cases/three-node-motifs`](../../cases/three-node-motifs/README.md) catalogue
and 1,000-trial analysis artifact. It does not recompute the census in the
browser and does not alter the case result.

Serve the repository root and open `/apps/three-node-motif-explorer/`:

```sh
node apps/historical-load-explorer/serve.mjs 8080
```

Cross-check tests verify every displayed edge list, canonical ID, count,
null mean, Z-score and rank against the authoritative case files.
