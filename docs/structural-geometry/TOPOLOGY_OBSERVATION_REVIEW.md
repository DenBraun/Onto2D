# SG2-012 topology observation review

Date: 2026-09-06. Scope: frozen directed summary evaluator and acceptance cases.

Subsequent SG2-013 acceptance is recorded in the [typed observation review](TYPED_OBSERVATION_REVIEW.md).

## Implemented boundary

The `/topology` entrypoint measures all seven existing topology specs, preserves
the exact SG2-010 preparation and adds a separate measured envelope. It verifies
the full source before scoping, includes scoped isolates, excludes boundary paths
and keeps source metadata outside observed coordinates. It provides closed
input/output schemas, readonly types and opt-in engine/browser APIs.

Directed BFS computes reachability; mutual reachability identifies SCCs, and
undirected BFS identifies weak components. Counts are exact, component-size
vectors sort numerically, and self pairs are excluded from reachability even
on cycles. The traversal budget includes self seeds and is enforced before
accepting a visit. All fixed limits remain inherited from `topology-only-v1`.

## Review findings and resolutions

- The seven global summaries cannot resolve whole-edge reversal. Retained
  outward/inward-star equality and verified that public exact canonical analysis
  separates the graphs. The contract and report disclose the full small-graph
  collision census rather than claiming isomorphism from summary equality.
- IDs must not become observation coordinates through diagnostics. Component
  memberships and per-source reachability counts bind the full artifact only;
  relabeling, edge-ID changes and metadata/dictionary controls retain the same
  observation. They supply no invariant probe-target identity.
- String ordering can differ between JavaScript and Python for supplementary
  Unicode characters. The independent reference explicitly orders source IDs
  by UTF-16, and the relabeling fixture includes supplementary and BMP labels.
  Reference I/O uses explicit UTF-8 and LF for portable replay.
- A larger Causal scope must consist of actual explicitly listed source IDs.
  The 32-node membership is frozen in the new fixture and independently checked
  against the unchanged release. It contains 88 edges, 377 reachable ordered
  pairs, four isolates and a three-node SCC. No full-model claim is made.
- Work diagnostics separate distinct visits from repeated adjacency scans.
  The 64-node/256-edge control reaches exactly 4,096 visits and 16,384 scans;
  these counters describe reachability, not all analysis/serialization work.
- Reference regeneration must not bless stale inputs. The case builder checks
  raw hashes of its control file, the Causal bundle and the reused independent
  permutation source before generation, then checks all values and diagnostics
  against independent expectations before writing any artifact.
- A self-consistent hash is insufficient verification. Tests rehash modified
  values, ordered specs, memberships, statistics and fabricated result fields;
  expected-source replay rejects them, including equal summaries from another
  source. Full-source corruption and excluded invalid arcs also reject.

## Independent evidence

Python Boolean Floyd–Warshall closure independently supplies seven values,
component memberships and analytic traversal totals for 23 artifacts. The
exhaustive census covers all 4,165 loopless directed graphs on 1–4 nodes.
Independent permutation orbits yield 238 isomorphism classes and 69 summary
classes; 38 summary classes contain multiple isomorphism classes. The largest
four-node collision contains 22 classes. Every transpose retains its summary.

The cases include 21 synthetic controls and two source-locked Causal fragments.
Separate tests cover boundaries, multiple paths, cyclic self exclusion,
numerical ordering, induced paths, source/relabel invariance and tampering.
This is independent algorithm agreement, not independent scientific review.

## Validation record

- `npm test`: **1,393 passed**, zero failures/skips; 225,292 ms locally. The
  new stage contributes 17 behavior tests, four schema/browser tests and two
  independent census/reference tests.
- Focused checks passed: 21 API/schema/browser tests, independent reference and
  artifact replay, exhaustive collision census, published TypeScript and 196
  versioned schemas.
- `npm pack --dry-run` includes the three new topology source/type files in the
  structural-geometry package: 40 files, 214,417 unpacked bytes.
- Before/after SHA-256 comparison preserves **455** prior scientific case,
  schema, proposal/baseline and geometry/kernel implementation files exactly.
  The original **117** pinned compatibility files also verify. Documentation,
  export/schema registration and check wiring are intentionally additive.
- `npm run build`: passed, including **192** geometry API/behavior tests plus
  independent reference runners, 196 schemas, 16 package boundaries, 332
  Markdown files, source/worker/registry/catalogue checks and existing kernel
  closure (195 capabilities, zero pending). Checked source census: 551
  JavaScript and 879 JSON files.

These are local results on macOS arm64, Node 24.19.0 and Python 3.9.6. They do
not assert that remote CI or independent reviewer approval has run.

Frozen topology suite:
`sha256:5dcfd0ff8312235810521b429a9cf248d39289b410e5db7e3648538cc6b91950`.
Census:
`sha256:cdb24fd58ae955dd9e8a2b53be3e84835448b8e13163e24496fb79dc291744ce`.
The six-node Causal value is
`sha256:492f1bf7a13f4274f70d561b3bd2583c70692bbaa0a5209c024f4459b84eeee3`;
the 32-node Causal value is
`sha256:9e88bd5c61a8074e6e310e5e50bb00ded5efecaffdbf0e5403b08f78a0206caa`.

## Reproduction and next task

```sh
npm run structural-geometry:topology:check
npm run structural-geometry:topology:report
npm test
npm run build
```

See the [contract](TOPOLOGY_OBSERVATIONS.md) and
[cases](../../cases/structural-geometry/topology/README.md) for regeneration
boundaries. Commands do not require a web server. The next task is SG2-013 typed
observations, including all five fields, common-bijection matching and explicit
vocabulary compatibility. Comparison/status/coverage remain SG2-014/015;
probes and signatures remain R4/R5. Website implementation is still gated.
