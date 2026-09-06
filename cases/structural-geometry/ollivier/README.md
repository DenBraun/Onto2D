# Ollivier reference suite

The stage-four suite contains 18 synthetic graphs and two explicit induced
fragments of the frozen Causal Emergence Model Pack. Each is evaluated with
`zero` and `half` idleness: 40 runs and 242 exact edge calculations.

- [controls.json](controls.json) declares synthetic topology and analyzed edges.
- [fragments.json](fragments.json) fixes the source identity and selected node sets.
- [suite.json](suite.json) indexes source-bound certified artifacts and summaries.
- [networkx-expected.json](networkx-expected.json) freezes independently computed
  NetworkX values and the external algorithm's version/source hash.
- [networkx_reference.py](networkx_reference.py) reconstructs directed distances
  and probabilities independently and solves integer transport with NetworkX.

## Run and inspect

Node 22+ and Python 3.9+ are sufficient for normal runtime and repository checks:

```sh
npm run structural-geometry:ollivier:check
npm run structural-geometry:ollivier:report
```

The check reruns the packaged Python oracle, compares every artifact with frozen
bytes and independent reference values, verifies exact optimality certificates,
and runs behavioral/schema/browser contract tests. It does not install NetworkX.
The report performs replay before printing selected summaries. The combined
`npm run structural-geometry:check` includes this stage.

To repeat the external gate in an isolated environment (POSIX example):

```sh
python3 -m venv /tmp/onto2d-ollivier-reference
/tmp/onto2d-ollivier-reference/bin/python -m pip install -r cases/structural-geometry/ollivier/requirements-reference.txt
/tmp/onto2d-ollivier-reference/bin/python -B cases/structural-geometry/ollivier/networkx_reference.py --verify
```

CI also repeats this independent NetworkX gate. The external script never imports
the packaged transport oracle. It checks graph distances and measure construction
before comparing optimal values; plans may differ between solvers.

Regeneration is deliberate and does not resolve a disagreement by itself:

```sh
npm run structural-geometry:ollivier:build
/tmp/onto2d-ollivier-reference/bin/python -B cases/structural-geometry/ollivier/networkx_reference.py --write
npm run structural-geometry:ollivier:check
```

Review the definition and source before accepting any changed golden. The
independent `--write` operation first requires agreement with computed artifacts.

## Reading the controls

| Graph / edge | Zero-idleness curvature | Meaning within this policy |
|---|---:|---|
| Single directed edge | 0 | Both empty neighborhoods stay at their endpoints |
| Middle edge of a four-node directed path | -2 | All mass travels three forward steps |
| Directed three-cycle | 1 | Incoming and outgoing measures share the same node |
| Bidirected three-node clique | 1/2 | Shared support reduces minimum transport cost |
| Open endpoint-degree control | -2 | No shortcut between the two neighborhoods |
| Same endpoint degrees with a shortcut | 0 | A direct neighborhood route reduces cost |

The Causal Emergence seed fragment has 10 nodes / 18 scoped edges and 27 boundary
edges; the admissibility fragment has 9 nodes / 17 scoped edges and 43 boundary
edges. Their values describe these induced graphs, not the full 249-node graph.
The selection is illustrative and fixed, not a statistically representative
sample. Source snapshot findings and source-parent semantics are unchanged.

See the [method contract](../../../docs/structural-geometry/OLLIVIER_CURVATURE.md)
and [review](../../../docs/structural-geometry/OLLIVIER_REVIEW.md).
