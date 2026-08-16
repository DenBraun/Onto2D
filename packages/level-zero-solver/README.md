# `@onto2d/level-zero-solver`

Bounded external solver for the frozen Level-0 Phase-B reference benchmark.
It implements the `@onto2d/scientific-adapter` interface and does not import
the Onto2D kernel.

```js
import { levelZeroReferenceSolver } from "@onto2d/level-zero-solver";

const response = await levelZeroReferenceSolver.evaluate({
  requestHash,
  request
});
```

The method evaluates periodic complex plane-wave modes with second-order
central differences, reports coarse/fine stationarity residuals, and binds
every returned quantity to the exact request and evidence identifiers.
Requests are bounded by the exported `LEVEL_ZERO_SOLVER_LIMITS`. Invalid,
unsupported, mismatched, and over-limit requests fail with distinct
`LevelZeroSolverError` codes.

This package reproduces a finite computational-conformance benchmark. It is
not a general Level-0 solver and does not establish empirical validity.
