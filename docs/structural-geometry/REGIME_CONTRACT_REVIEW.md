# SG2-010 regime contract implementation review

Date: 2026-09-06. Status: SG2-010 contract foundation complete; R3 evaluation
and scientific acceptance gates remain open.
Subsequent SG2-011 acceptance is recorded in the [canonical observation review](CANONICAL_OBSERVATION_REVIEW.md).
The counts and next-step discussion below record this SG2-010 milestone.

## Implemented and reviewed

The [contract](REGIME_CONTRACTS.md) adds `/regimes`, three immutable profiles,
nine observable specs, four closed schemas and source-bound preparation.
Every reference binds ID, version and content hash. Full source verification
precedes scope selection; selected isolates and all four edge partitions are
retained. MetricProvider context and dictionary hashes remain exact and unchanged.
Verification rebuilds the preparation from an expected Model Pack and request.

Exact and typed matching are limited to six nodes, consistent with the existing
kernel canonicalizer. Review caught two adapter requirements before freezing
the contract: node references must be SHA-256 content identifiers, and typed
ID arrays must become canonical scalar strings. A uniform synthetic node color
and sorted set encoding satisfy that interface without source-label leakage or
kernel changes. The test covers a disconnected candidate and explicit search
budget exhaustion. This is an interface check, not the independent exhaustive
isomorphism validation required in SG2-011/013.

The topology profile freezes seven explicit lossy summaries with a separate
64-node/256-edge bound. A star and its edge reversal are a documented collision;
an evaluator must not report their shared summary as proof of graph isomorphism.
Typed vocabulary policy distinguishes missing declarations from observed empty
sets and refuses implicit cross-model authority from equal dictionary bytes.

Preparations cannot contain measured values, comparison status or distance.
They record `evaluation: "not-run"`. Empty probe sets are not passed probes.
Strict missingness, exact equality statuses and interval rejection are declared
policies; their executable comparison semantics remain SG2-014/015 work.

## Verification evidence

- The focused suite passes **19 tests** covering content-bound policies, rehashed
  tampering, mandatory evidence/order, scope partitions, retained isolates,
  node/edge/byte bounds, invalid full-source data outside scope, typed dictionary
  provenance, source relabeling, engine opt-in and exact browser replay.
- Six frozen preparations replay byte for byte: three five-node/four-edge
  synthetic controls and three six-node/11-edge Causal Emergence fragments.
  The source lock binds the complete 249-node/971-edge release.
- `npm test`: **1,347 passed**, zero failed/skipped, 186,831.871166 ms.
- Published TypeScript declarations and all **192 schemas** pass their checks.
- A fresh pre-task hash inventory confirms **305 existing scientific case,
  provider example, schema and preserved proposal files** are byte-identical.
  The pinned legacy compatibility check separately passes all **117 files**.
- Package dry run includes all **34 files**, including both regime runtime
  modules and their public declarations (188,829 unpacked bytes).
- `npm run build` passes the combined **151 geometry tests**, exact provider
  and numeric reference replay, 16 package boundaries, 533 JavaScript / 829 JSON
  source checks, 192 schemas, 324 Markdown files and the catalogue/kernel gates.

Suite hash:
`sha256:ca2f748ec504e541a576e393425957964ea8512f21b67c2ca9383848911542ef`.

```sh
npm run structural-geometry:regimes:check
npm run structural-geometry:regimes:report
npm test
npm run build
python3 -B docs/structural-geometry/baselines/verify_baseline.py --compatibility
```

The full geometry check includes the new suite. Existing unit, experimental,
provider, Ollivier, original flow and supplemental flow artifacts remain frozen;
their numerical implementations are unchanged. The pre-regime inventory is not
rewritten to hide additive implementation work.

## Next acceptance boundary

SG2-011 implements exact canonical observations, tests faithful translation and
independently enumerates small directed graphs and relabelings. SG2-012 adds the
lossy topology evaluator and collision controls. SG2-013 adds typed observations
and explicit vocabulary compatibility. SG2-014/015 must test real tri-state,
null-distance and component-coverage behavior before the R3 split/merge gate can
close. No public page or response-derived metric is delivered by this milestone.
