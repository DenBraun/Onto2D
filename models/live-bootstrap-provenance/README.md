# Live Bootstrap Provenance Model Pack

This directory contains the separate `live-bootstrap-provenance` external Model
Pack. It does not add live-bootstrap entities to the `causal-emergence` model.

The release version is derived from the exact upstream source identity, trace,
state history, evidence artifact, graph projection, and mapping version. The
Model Pack contains upstream and deterministic-derived provenance only; Onto2D
counterfactual paths and Historical Load results remain outside the pack.

Build and verify:

```sh
npm run model:live-bootstrap
npm run model:live-bootstrap:verify
```

Every edge keeps its evidence class, source location, method, and claim. An
`observed-order` edge remains order evidence and cannot become a dependency.
Produced-artifact records describe source-declared output/install actions, not
proof that the build ran successfully.

This downstream Model Pack is not affiliated with or endorsed by
live-bootstrap.
