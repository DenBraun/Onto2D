# History Matters reference pilot

This eight-unit fixture tests the benchmark pipeline, not a scientific theory.
Each unit has an observed present symbol at ordinal 2, two ordered history
symbols at ordinals 0 and 1, and a separately stored target class at ordinal 3.
The complete population is used; unit IDs are join keys and never features.

| Control | Present errors | Present + history errors | Interpretation |
| --- | --- | --- | --- |
| Positive | 16 / 28 | 0 / 28 | The path class resolves present ambiguity |
| Negative | 0 / 28 | 12 / 28 | Irrelevant distinctions over-separate target classes |
| Neutral | 0 / 28 | 0 / 28 | Repeated history adds no distinction |

The negative control measures a limitation of the declared exact-equality
evaluator. It does not say that an optimal evaluator cannot ignore history.
The positive fixture must also outperform the frozen wrong-history null mean.
Sixteen deterministic hash-priority permutations are diagnostic controls, not
independent statistical evidence.

The builder also projects the complete Git (six histories), OCI (four
histories), and reproducible-build (four executions) fixtures. Their target
classes are explicitly regime-derived. Git's six heads have two final tree
identities; the metadata control shares its ancestry class. OCI's unique layer
classes survive history reassignment, which the Explorer discloses. Reproducible
builds compare joint output/toolchain classes and preserve the ambient control.

```sh
npm run history-benchmark:goldens
npm run history-benchmark:test
npm run dev:site
```

Open `http://127.0.0.1:8080/apps/history-matters-benchmark/`.

`source/controls.json` is authored input. Each control directory freezes its
contract, observations, target table, P/H views, census membership and result.
Software outputs live in each existing case's `history-benchmark/` directory.
`expected/suite.json` lists exact results without a global score.
The builder also emits the registry and browser payload with its byte pin.
Verification never writes or accepts drift. Regeneration changes the frozen
contract identity and needs review; it is not independent preregistration.
