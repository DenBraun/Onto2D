# Ollivier implementation review

Date: 2026-09-06.
Scope: computational stage 4 under the [adopted contract](OLLIVIER_CURVATURE.md).

## Findings and corrections

- Kept transport optimization in the external Python reference and used exact
  primal/dual checks in JavaScript. A self-reported objective or a feasible plan
  alone cannot establish optimality.
- Fixed the unit directed convention, zero/half idleness, source/sink fallback,
  finite-support reasoning and explicit induced-scope interpretation before
  freezing artifacts. Full-model source verification precedes fragment selection.
- Made explicit null options invalid, alongside unknown fields and malformed ID
  sets. Set membership never relies on object-key coercion.
- Bound cache entries to the complete normalized request and verify certificates
  on hits. Failed responses cannot poison the cache; source preparation captures
  the exact immutable pre-await snapshot.
- Declared UTF-16 support ordering and applied it independently in the NetworkX
  wrapper, including non-BMP relabeling controls.
- Kept the portable module free of process imports. Node execution has isolated
  Python startup, fixed script identity, no shell, bounded pipes and a deadline.
- Corrected schema closure metadata and exercised actual engine registration in
  the tests. All five new transport schemas are exported and TypeScript covers
  both public subpaths.
- The first full test run found the workspace registry test still expecting 170
  schemas. Updated its census to 175 with assertions for all five new exports;
  the subsequent full run passed.

## Validation evidence

The focused Ollivier check passes 26 tests, including exact analytic controls,
40 frozen source/certificate replays, forged and nonoptimal responses, graph and
request bounds, cache identity/eviction, source mutation, directed reversal,
disconnected graphs, Unicode labels, schema rejection and browser verification.
An additional deterministic 16-graph family at both idleness values agrees with
exhaustive small transport enumeration.

The external NetworkX 3.2.1 reference was installed in an isolated temporary
environment and executed locally. It independently reconstructed neighborhoods
and directed distances and reproduced all 40 runs / 242 exact edge values using
network simplex. Its frozen output records the algorithm source SHA-256. Normal
checks compare frozen independent values; a separate CI job reruns NetworkX.

Final local validation on Node 24.19.0 / Python 3.9.6 / macOS:

- `npm test`: 1,280 passed, 0 failed, 0 skipped (175.15 seconds).
- `npm run build`: all repository checks passed, including original Forman
  artifact replay, the 72 stage-three experiments, the Ollivier suite, 175
  schemas, 16 workspace export boundaries, TypeScript declarations, source
  integrity, worker assets and the unchanged 195-capability kernel closure.
- `npm run check:docs`: 302 Markdown files passed link/structure checks.
- Independent `networkx_reference.py --verify`: all 40 runs passed.
- Public-package dry run includes both Ollivier subpaths, declarations and the
  packaged Python script. The README example executes against the frozen model
  and its returned artifact verifies exactly.
- `git diff --check` passed; the preserved original roadmap SHA-256 is unchanged.

The CI matrix and new independent-reference job are configured; remote CI runs
and other operating-system/runtime executions are not claimed as local results.

## Remaining limitations

No unresolved implementation finding is known within the bounded unit profile.
Independent scientific review, held-out utility and full-model scalability remain
open. Weighted transport and normalized shadow flow were separate gates at this
stage's acceptance; the subsequent [stage-five review](FLOW_REVIEW.md) records
their bounded implementation. Independent algorithm agreement does not establish
causal validity or scientific significance. The two real source fragments are
illustrative induced scopes with disclosed boundary edges.

The kernel, source snapshots, existing Forman artifacts and browser applications
retain their existing contracts. Stage 5 uses separate length, normalization,
stopping and published-benchmark contracts.
