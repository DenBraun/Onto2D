# SG2-005 MetricProvider implementation review

Date: 2026-09-06. Status: SG2-005 / revised R2 compatibility gate complete.
This record distinguishes computational/API acceptance from scientific review.
Subsequent SG2-010 work is recorded in the [regime contract review](REGIME_CONTRACT_REVIEW.md);
the counts below remain this provider milestone's acceptance record.

## Adopted implementation

The [provider contract](METRIC_PROVIDERS.md) was fixed before implementation.
The new `/providers` export remains inside `@onto2d/structural-geometry` and
implements unit, inverse-target-share, necessity filtration, role subset and
typed-channel providers. Each frozen descriptor declares origin, representation,
numeric policy, capabilities, source/context requirements and work bounds.

Numeric providers supply exact positive rational edge lengths/weights and unit
vertex weights. The other three capabilities supply discrete views with fixed
source nodes and complete edge accounting. A length consumer explicitly rejects
those outputs. Necessity is not converted to arbitrary ordinal lengths and
overlapping channels are not mixed into an implicit scalar metric.

`createStructuralMetricContext` verifies and snapshots the full Model Pack.
Its private WeakMap identity prevents copied/self-asserted context bindings from
claiming source verification. Build validates the supplied complete projection,
then computes from the frozen context snapshot. The transport binding includes
model/root/manifest, full projection, projection policy, full-source normalization
and a model-local dictionary hash. Replay requires the expected source and input.

The original experiment selection, weight audit and metric functions now live
in one private shared module, with the original algorithms, error codes and hash
domains. This avoids a second normalization or selector implementation. The
ordinary experiment entrypoint still normalizes its request, verifies the full
source, selects edges, derives its full-source metric and calculates the same
outward intervals. Its public format and behavior are unchanged.

An additive `structural-provider-analysis` envelope binds metric/view provider
artifacts and the exact legacy root/experiment artifact. Both raw providers and
envelopes have opt-in engine definitions through the existing authentic Model
bridge. Six new closed schemas, readonly types and portable browser verification
complete the public contract. Ollivier/flow algorithms, request formats and
explicit flow initialization remain unchanged.

## Compatibility and review findings

The [suite](../../cases/structural-geometry/providers/README.md) checks 13 provider
profiles on the full source, all 73 legacy analyses, and seven frozen examples.
Every original experiment hash, selected-projection hash and full-source metric
context agrees. Full unit and weighted outputs match their stored bytes.
The source's known incoming sums 0.9,1.9,0.9 remain disclosed and untouched.

Targeted review checked the following boundaries:

- Weighted necessity selection retains excluded incoming edges in the
  denominator; the three-edge non-unit control gives length 3, not 1.
- Invalid weights anywhere in the full source reject the weighted provider,
  while unit and discrete providers remain available. Source topology/category
  validation cannot be bypassed by filtering.
- Four nested necessity stages preserve all nodes; role subsets keep their
  existing canonical set semantics; typed channels retain overlapping membership,
  missing-field accounting, numeric code order and model-local vocabulary identity.
- Source changes after context construction cannot mutate its snapshot.
  Lookalike contexts/projections and rehashed altered values, policies, memberships,
  dictionary identities and legacy results are rejected.
- View occurrence accounting accepts exactly 32768 and rejects the next larger
  result without truncating or returning partial success.
- Browser and engine outputs match direct portable calls; TypeScript separates
  numeric/discrete results, requires explicit channel parameters and prevents
  writes to nested values. External code cannot construct a typed verified context.

The original [pre-regime inventory](BASELINE.md) remains frozen. Its compatibility
mode checks the 117 legacy scientific input/schema/golden files. Implementation
inventory changes are intentional: shared experiment extraction, provider export,
schema registration, tests and check orchestration. The nine R1 supplemental
flow artifacts also remain unchanged; their replay gate stays enabled.

## Verification and remaining work

```sh
npm run structural-geometry:providers:check
npm run structural-geometry:providers:report
npm run structural-geometry:check
python3 -B docs/structural-geometry/baselines/verify_baseline.py --compatibility
npm test
npm run build
```

Provider checks include 16 behavioral tests and four schema/browser tests,
fresh full-source compatibility replay and the legacy inventory. Combined
checks also run the existing independent incidence, Decimal/Fraction, Ollivier
and flow references and exact artifact replays. CI includes provider replay
alongside the weighted reference checks; hosted CI is separate from local evidence.

Observed local acceptance on macOS arm64, Node 24.19.0 and Python 3.9.6:

- `npm test`: **1328 passed**, no failures or skips; 231.631 seconds.
- `npm run build`: all repository checks passed, including **132 geometry
  tests**, the 73-analysis compatibility replay, 188 schemas, declarations,
  export boundaries, worker consistency and the unchanged kernel contract.
- Focused provider check: **20 passed**; the verified report command passed.
- Fresh independent NetworkX 3.2.1 replay: all 40 Ollivier, 11 original flow and
  nine supplemental flow runs passed. The build also verified the independent
  incidence and Decimal/Fraction references for the shared arithmetic.
- All 117 baseline compatibility files passed. Comparison with the saved
  pre-provider working tree confirmed every existing case implementation,
  scientific artifact, schema file and preserved proposal stayed byte-identical.
- Source validation covered 526 JavaScript and 818 JSON files; final
  documentation-link validation covered 320 Markdown files; whitespace passed.
- Package dry run passed: 31 files, 161964 unpacked bytes, including the new
  provider implementation/declarations and shared experiment module. No publish
  or hosted CI execution was performed.

Logs for this local run are `/tmp/onto2d-provider-full-tests.log`,
`/tmp/onto2d-provider-full-build.log` and `/tmp/onto2d-provider-check.log`.
These are local execution evidence, not committed scientific artifacts.

The compatibility suite hash is
`sha256:2a9d6eaffc2000ce60cc7500777699eadacb8e8f963e6ae247febbc8882caa7f`.
This is a compatibility result, not a comparison score or proof of metric utility.
Source weights retain their experimental interpretation; provider costs need not
already be shortest endpoint distances. No response-derived lengths, arbitrary
third-party provider registration or new general weighted Ollivier policy ships.

The next bounded task is SG2-010: freeze the regime/observable contracts,
identities and bounded matching policy. Canonical/topology/typed regimes and
strict comparison semantics follow their own R3 tasks. No public page or
cross-domain comparison is implied by closing the provider gate.
