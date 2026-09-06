# SG2-011: exact canonical directed observations

Status: implemented bounded evaluator for `canonical-structure-v1`.
Date: 2026-09-06. See [ADR 0133](../adr/0133-exact-canonical-structural-observations.md),
the [acceptance review](CANONICAL_OBSERVATION_REVIEW.md) and the
[operative roadmap](REVISED_ROADMAP.md).

## Implemented boundary

`@onto2d/structural-geometry/canonical` computes the first mandatory observation
declared by the [SG2-010 contracts](REGIME_CONTRACTS.md). It preserves the directed
adjacency and every selected node, including isolates, modulo arbitrary node
renaming. Source IDs, names, attributes, dictionaries, geometry and scientific
confidence remain outside the observed value.

This is a measured observation of one verified scoped graph. It is not the
three-regime comparison API, a response signature or an empirical equivalence
claim. Topology and typed evaluators, tri-state comparison and strict coverage
remain subsequent R3 work. The probe runner follows their acceptance gate.

## API and artifacts

```js
import {
  observeCanonicalStructure, verifyCanonicalStructureObservation,
  createCanonicalStructureObservationAnalysis
} from "@onto2d/structural-geometry/canonical";

const input = {
  regimeId: "canonical-structure-v1",
  scope: { kind: "induced", nodeIds: ["0.0", "0.1", "0.2"] }
};
const artifact = observeCanonicalStructure(causalPack, input);
verifyCanonicalStructureObservation(artifact, causalPack, input);
console.log(artifact.observation.value, artifact.observation.valueHash);
```

The regime must be explicit. Omitting scope selects the full source. Supported
scopes contain 1–6 nodes and at most 30 loopless, nonparallel directed edges.
The full 249-node Causal Emergence release therefore requires an explicit induced
fragment. Oversized graphs, invalid source records, unsupported regimes and
undeclared parameters raise errors; they do not yield a partial observation.

The evaluator verifies and snapshots the complete Model Pack, then invokes the
unchanged preparation API. It uses only that frozen source for later reads.
Corrupt records and unsupported topology outside the selected scope still fail.
Boundary-edge accounting remains attached to the exact original preparation.

The closed artifact contains:

- `evaluation: "measured"`, an explicit analysis and implementation identity;
- `preparation`, byte-identical to the existing SG2-010 preparation, including
  its own `evaluation: "not-run"` marker for that preparatory step;
- `observation`, with regime/spec/implementation content references, canonical
  `{nodeCount, edges: [{from, to}]}` and its content hash;
- `witness`, with every source node mapped to a canonical integer in `0..n-1`,
  every source edge mapped to directed canonical endpoints, kernel candidate
  and skeleton hashes, and deterministic search statistics;
- a separate source-bound `artifactHash` over the complete artifact.

`valueHash` excludes source metadata, source IDs, scope provenance and witness
tie choices. It binds the exact canonical payload and regime/spec/implementation
references. Equal verified values under those same contracts express the same
directed structure under permitted relabeling. They do not imply identical Model
Packs, shared mechanisms or matching domain semantics. An outward and inward
three-node star have different values despite equal counts and weak skeletons.

`verifyCanonicalStructureObservation(artifact, expectedPack, expectedInput)`
recomputes both preparation and matching. Merely rehashing a forged value or
mapping cannot satisfy replay. A different valid automorphism witness is still
a different artifact: verification promises the deterministic source replay,
not acceptance of every possible isomorphism certificate.

No `distance`, comparison `status`, probe result or response signature is added.
Two additive schemas and readonly TypeScript declarations cover the new API;
all old closed v1 schemas and artifacts are preserved. The engine factory opts
into `structural-canonical-observation` through the authentic Model bridge.
The same API computes and verifies all examples in a browser bundle.

## Faithful translation and exact matching

The adapter reuses the frozen `directed-candidate-matching-v1` contract. Each
selected node receives the same synthetic content-hash reference. Each edge
receives the same `source-parent` role and retains its ordered endpoints. No
attributes are passed. Disconnected graphs are explicitly permitted. Source
node and edge IDs determine input order only, and are kept in the witness.

This translation is faithful: any directed-graph isomorphism preserves the
uniform candidate labels and ordered edges. Conversely, any candidate
isomorphism preserves the original directed adjacency and node count because
all labels are uniform and every edge is represented exactly once. The kernel's
undirected skeleton is a redundant derived part of candidate identity; it
does not replace the directed candidate comparison. The observed value retains
the canonical directed endpoints returned by the candidate canonicalizer.

Canonical JSON alone does not perform this matching. The production kernel
uses bounded graph canonicalization, while the independent reference enumerates
all node permutations and minimizes a directed adjacency bitmask. The two
implementations need not choose the same canonical numbering. Their isomorphism
partitions must coincide in both directions, and every output must remain in
the source graph's independently computed orbit.

One witness mapping is **not an invariant target selector** on a symmetric
graph. Permuting indistinguishable leaves may change which source leaf receives
a particular canonical number. Future probes must use their declared orbit,
role or invariant aggregation policy; they must not select a scientific target
by an arbitrary witness number or lexicographically first source ID.

Matching uses the unchanged six-node/30-edge/100,000-search-state limits. The
budget counts both kernel skeleton and candidate phases in one call. Kernel
budget exhaustion propagates as an error; there is no approximate identity or
fallback. Canonical serialization remains bounded at 100,000 entries and each
complete observation artifact at 1 MiB. A preparation near its own byte limit
can exceed the observation envelope's limit after adding a value and witness;
that produces an explicit error.

The additive `@onto2d/kernel/graph-canonicalizer` export routes directly to the
existing functions and declarations. It allows browser use without importing
the full kernel's Node-only Oracle validator. No graph algorithm, kernel
operation, default policy or previous result changes.

Hash domains use `onto2d:structural-canonical-{kind}:v1`: `implementation`,
`value`, `artifact`, and the case `reference`, `census-value`, `census`, `suite`.
The immutable implementation ID is `canonical-directed-observation-v1`.
Changes to the scientific profile or canonical numbering contract require a
separately identified implementation/profile and review of frozen outputs.

## Independent acceptance controls

The [case suite](../../cases/structural-geometry/canonical/README.md) contains:

| Nodes | All labelled loopless directed graphs | Independent isomorphism classes |
|---|---:|---:|
| 1 | 1 | 1 |
| 2 | 4 | 3 |
| 3 | 64 | 16 |
| 4 | 4,096 | 218 |

For all 4,165 graphs, the adapter's canonical values match the 238 independently
enumerated classes with no false merge or split. The census also checks that
every value and node mapping reconstruct the source's directed edges. All 720
relabelings of a declared asymmetric six-node graph preserve the canonical
value. This does not claim exhaustive enumeration of all five/six-node graphs.

Seventeen frozen public observations include isolates, directed/reciprocal
edges, opposite star orientations, cycles, disconnected graphs, six-node
symmetry, relabeling/annotation controls and the six-node/11-edge real source
fragment. Python independently checks their permutation orbits and complete
mapping witnesses. Explicit UTF-8 I/O preserves Unicode controls across platforms.

```sh
npm run structural-geometry:canonical:check
npm run structural-geometry:canonical:report
```

Both commands replay frozen outputs. Deliberate observation regeneration uses
`structural-geometry:canonical:build`; the independent reference has a separate
explicit `python3 -B cases/structural-geometry/canonical/reference.py --write`.
These controls establish bounded computational agreement, not empirical usefulness.
