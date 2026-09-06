# SG2-011 canonical observation implementation review

Date: 2026-09-06. Status: bounded exact untyped observation complete; the rest
of R3 and the R4/R5 probe/signature gates remain open.

Subsequent SG2-012 acceptance is recorded in the
[topology observation review](TOPOLOGY_OBSERVATION_REVIEW.md).

## Implemented and reviewed

The [contract](CANONICAL_OBSERVATIONS.md) adds a measured `/canonical` API
above verified Model Packs. A faithful uniform-label translation preserves
directed adjacency and selected isolates while excluding source attributes.
The existing kernel candidate canonicalizer supplies the canonical numbering.
Each artifact carries the exact original preparation, contract-qualified value,
source node/edge mapping witness and separate source-bound hash.

Review checked the source/projection boundary, explicit six-node bounds,
complete edge accounting, source snapshots, hash domains, readonly types and
the distinction between canonical values and witness tie choices. Rehashed
values, alternate mappings, changed statistics and mismatched sources fail
exact replay. An automorphism witness cannot become an invariant probe target.

Browser validation found that importing the full kernel pulled in its Node-only
Oracle validator. The additive `@onto2d/kernel/graph-canonicalizer` subpath now
routes to the existing module and types. Browser tests confirm function identity
with the root export and exact replay of all 17 artifacts. No kernel algorithm,
operation, graph policy, numeric geometry implementation or old artifact changes.
The independent Python reference uses explicit UTF-8 input/output for portability.

Final review also binds reference generation to the exact control and Causal
release file SHA-256 values before any artifact write. A stale reference source
binding is rejected, and the exhaustive census domain is fixed at 1–4 nodes.
The three reference tests pass after this correction, including both changed
source-hash rejection cases.

## Acceptance evidence

- All **4,165** labelled loopless directed graphs on 1–4 nodes agree with
  independent exhaustive permutation classes: **1, 3, 16, 218** classes by
  node count, **238** total. Checks compare both directions of the class mapping,
  verify output orbit membership and reconstruct every directed source edge.
- All **720** relabelings of the declared asymmetric six-node control preserve
  its exact value. This is not exhaustive enumeration of all five/six-node graphs.
- **17** frozen public artifacts replay; Python independently verifies their
  graph orbits and complete witnesses, including the six-node/11-edge source
  fragment and highly symmetric six-node graphs.
- **23 new tests**: 16 behavioral tests, four schema/browser tests and three
  exhaustive/reference tests. The focused command runs the census/reference
  checks once, followed by the 20 behavioral/schema/browser tests.
- `npm test`: **1,370 passed**, zero failed/skipped, 193,992.977 ms.
- The browser suite passes all four tests after the portable export correction.
  `npm run build` passes all **171 geometry API/behavior tests** plus the
  independent census/reference runners, **194 schemas**, published TypeScript,
  **16** package boundaries, **542 JavaScript / 851 JSON** source checks,
  **328 Markdown** files, catalogue and kernel-closure checks.
- A fresh pre-task inventory confirms **431** existing scientific/schema/proposal
  and geometry/kernel implementation files remain byte-identical. The separate
  pinned compatibility check passes all **117** legacy files.
- Package dry runs include **37** structural-geometry files and **85** kernel
  files, including the new runtime/type entrypoints.

Suite hash:
`sha256:41847476e59b38d8ba7cbb86ecd0f2ef25a0f6eb653754e164da87c304ff586d`.

Census hash:
`sha256:c0b16d97948fdf7e744d30bf70d4e0192791b7c99acbecbc4514902d99febd93`.

```sh
npm run structural-geometry:canonical:check
npm run structural-geometry:canonical:report
npm test
npm run build
python3 -B docs/structural-geometry/baselines/verify_baseline.py --compatibility
```

The original regime descriptors, observation specs and six preparations remain
frozen. SG2-010's `not-run` records are not relabeled as measured; measured
results use a new envelope and two additive closed schemas. Compatibility
checks retain prior providers, curvature, flow and their source contracts.

## Remaining gates

SG2-012 implements the frozen topology-summary profile and verifies its known
collisions against the exact evaluator. SG2-013 adds typed observations and
vocabulary compatibility. SG2-014/015 implement actual tri-state comparison,
null-distance and mandatory-coverage behavior. Only then can the R3 gate close
and probe/response work claim to use completed regimes. No response signature,
pairwise distance or public Lab page is delivered by SG2-011.
