# Shadow geometry flow reference cases

Status: bounded computational agreement and published synthetic reproduction.
The [flow contract](../../../docs/structural-geometry/SHADOW_FLOW.md) fixes the
metric, transport, update, normalization, stopping and final-cut interpretation.

```sh
npm run structural-geometry:flow:check
npm run structural-geometry:flow:report
```

Both commands are read-only. They rerun the packaged Python reference, verify
the exact artifact bytes against the source, and compare every state with frozen
independent NetworkX output. The check also runs the published analytical
recurrence and behavioral/schema/browser tests. Python 3.9+ standard library is
sufficient. No web server is needed for this backend stage.

## Cases and results

[fixtures.mjs](fixtures.mjs) constructs nine synthetic controls and reuses two
locked source fragments from the [Ollivier suite](../ollivier/README.md).
[suite.json](suite.json) indexes all 11 artifacts, their identities, final
summaries and stopping records: 68 states and 1089 exact edge calculations.

| Control | Expected behavior |
|---|---|
| Single edge; diamond; reciprocal clique | Exact fixed normalized geometry |
| Directed path; asymmetric neighborhood | Nonuniform length evolution |
| Directed feedback triangle, full step, zero idleness | Stop before zero lengths |
| Unequal reciprocal pair, full step, zero idleness | Exact period-two cycle |
| Initial long shortcut plus isolate | Metric closure shortens the shortcut; isolate remains |
| Published `G(3,2)` | Analytical recurrence and three recovered four-node groups |

The published fixture follows [Ni et al. (2019), Appendix E](https://arxiv.org/html/1907.03993v1).
There are three complete four-node groups, each with one gateway; all gateways
are connected. Each undirected edge becomes two reciprocal arcs. At zero
idleness, uniform measures and full step, three edge classes have raw updates:

```text
inter-gateway:      D1 = (2/5) d1 + (6/5) d2
gateway-internal:   D2 = (2/5) d1 + (1/15) d2 + (1/5) d3
internal-internal:  D3 = d3 / 3
normalization:     (D1,D2,D3) * 42 / (6 D1 + 18 D2 + 18 D3)
```

[paper_reference.py](paper_reference.py) checks this recurrence independently
using only `Fraction`, including exact transport costs and curvatures. Its 714
edge checks pass. After 16 transformations, lengths are approximately 2.960073,
1.346642 and 0.000000096536 respectively. Removing the six arcs strictly longer
than 2 recovers the three known groups. The stored reason is `iteration-limit`.

The source examples both run six half steps at half idleness, starting at unit
length and applying no cut:

| Induced Causal Emergence fragment | Nodes / edges / boundary edges | Longest final links |
|---|---|---|
| Seed, `0.0`–`0.9` | 10 / 18 / 27 | `0.1->0.5`, `0.2->0.5`, length about 1.420243 |
| Admissibility, `0.15`–`0.23` | 9 / 17 / 43 | `0.16->0.19`, length about 1.623312 |

Their average length remains exactly one; both end at their iteration limit.
These rankings describe relative separation under the selected transformation.
They do not establish causal importance, full-model geometry or true communities.
The source Model Pack and source Weight values remain unchanged.

## Independent execution and regeneration

[networkx_reference.py](networkx_reference.py) reconstructs distributions,
weighted directed Dijkstra distances and transport costs at every iteration,
then independently applies closure, normalization, stopping and final cuts.
Network simplex receives integer demands and integer-scaled rational costs,
avoiding floating-point optimization. It imports no runtime geometry or oracle
code. [networkx-expected.json](networkx-expected.json) records exact results,
NetworkX version and the network-simplex source SHA-256.

```sh
python3 -m venv /tmp/onto2d-flow-reference
/tmp/onto2d-flow-reference/bin/python -m pip install -r cases/structural-geometry/flow/requirements-reference.txt
/tmp/onto2d-flow-reference/bin/python -B cases/structural-geometry/flow/networkx_reference.py --verify
```

On Windows use the environment's `Scripts/python.exe`. CI reruns the pinned
NetworkX reference as well as ordinary source/certificate replay. The reference
dependency is not added to the JavaScript runtime or bundled Python solver.

Deliberate regeneration is `npm run structural-geometry:flow:build`, followed by
the independent command with `--write`. The independent writer checks runtime
agreement and the published recurrence before replacing its expected file.
Then run the check and review the diff. Neither command rewrites source locks.

Suite hash:
`sha256:13203d479b53fd3bddc5f10585bced5d889894109995b17c51bfae0f9a35d313`.
