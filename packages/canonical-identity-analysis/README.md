# `@onto2d/canonical-identity-analysis`

This package registers the kernel's canonical candidate operation as the first
reusable Onto2D engine analysis. It returns a content-addressed artifact bound
to the exact selected Model Pack, engine contract, input candidate, effective
graph policy, canonical mappings, and kernel result.

```js
import { canonicalIdentityAnalysis } from "@onto2d/canonical-identity-analysis";
import { Onto2D } from "@onto2d/engine";

const onto = await Onto2D.create({
  models: [pack],
  analyses: [canonicalIdentityAnalysis]
});

const artifact = await onto.analyze("canonical-identity", {
  candidate: {
    domain: "single-candidate",
    nodes: [{ ref }, { ref }],
    edges: [{ from: 0, to: 1, role: "supports" }]
  }
});
```

The analysis calls `@onto2d/kernel`; it does not implement a second graph
canonicalizer. `verifyCanonicalIdentityArtifact()` replays the request and
rejects model binding, result, or hash drift.
