# Frozen directed topology cases

SG2-012 implements the seven-observable `topology-only-v1` profile. Read the
[contract](../../../docs/structural-geometry/TOPOLOGY_OBSERVATIONS.md) for exact
semantics, source/scope identities and the limits of summary equality.

[controls.json](controls.json) declares 21 synthetic graphs and two explicit
Causal Emergence scopes. The synthetic graphs cover isolates, directed chains,
stars, cycles, reciprocal arcs, disconnected components, numeric component-size
ordering, source relabeling/annotations and the 64-node/256-edge bounds.
The Causal scopes use 6 nodes / 11 edges and 32 nodes / 88 edges from the existing
[source lock](../causal-emergence/source-lock.json); full-source validation
precedes scope selection. No domain fact is inferred from synthetic labels.

[reference.py](reference.py) computes Boolean matrix closure with Python's
standard library. Directed/undirected closure and mutual reachability supply
the seven values and source memberships independently of production BFS.
Closure also gives analytic pair-visit and adjacency-scan totals. The earlier
[independent permutation reference](../canonical/reference.py) supplies small
graph isomorphism classes; it does not call the production canonicalizer.
[reference.json](reference.json) freezes the expectations and source-file hashes.

[census.mjs](census.mjs) verifies every labeled loopless directed graph on 1–4
nodes: 4,165 graphs, 238 isomorphism classes and 69 summary classes. It retains
38 summary classes containing multiple isomorphism classes. It also verifies
all whole-edge transpositions. The four-node census alone has a summary shared
by 22 different isomorphism classes; no isomorphism claim follows from equality.

[suite.json](suite.json) binds 23 measured artifacts, the census and explicit
controls. Outward/inward stars have equal topology values, while the public
exact canonical evaluator separates them. Source metadata/relabeling controls
also retain equal observations with distinct full provenance.

```sh
npm run structural-geometry:topology:check
npm run structural-geometry:topology:report
```

The focused check verifies legacy compatibility, the independent reference,
all case bytes, independent artifact values/memberships/work and API/schema/
browser behavior. `npm test` also runs the census/reference as named tests.
`npm run build` includes this gate. No web server is required.

Deliberate regeneration is two steps: review and regenerate the independent
reference with `python3 -B cases/structural-geometry/topology/reference.py --write`,
then run `npm run structural-geometry:topology:build`. The builder verifies source
hashes and agreement before writing. It never rewrites prior geometry cases,
regime/spec declarations or canonical observations. These are bounded
computational controls, not empirical validation or completed response probes.
