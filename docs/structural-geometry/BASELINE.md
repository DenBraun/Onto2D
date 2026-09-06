# Pre-regime implementation baseline

Date: 2026-09-06. Baseline ID: `structural-geometry-pre-regime-v1`.
Purpose: R0 migration reference before metric-provider or comparison changes.

The [inventory](baselines/pre-regime-v1.json) pins 1534 implementation, test,
toolchain, input and output files, including the repository's 158 existing test
files and 117 legacy geometry compatibility files. It records SHA-256 file
digests, exact source identity, scientific artifact hashes and validation
evidence. Tests are inventoried with the same filename/ignored-directory rules
as `scripts/test.mjs`. This is a development inventory, not a newly published
scientific artifact schema or performance benchmark.

Inventory SHA-256:
`be0cf622409f6e2bc66cef0c5a91ae13df8c19de4a288b830954496a5ecc2be1`.
It hashes compact JSON with sorted object keys and ASCII escapes, excluding
the `inventorySha256` field. The verifier implements that encoding explicitly.

## Snapshot identity and scope

The baseline identifies the **current working tree**, including uncommitted
Structural Geometry implementation, not the contents of HEAD alone. HEAD at
capture was `92db9f5e6462606aef860a5423f189899cf6a79b`. No commit, tag, package
release or archive was created. Hashes identify the current files; this inventory
is not a recoverable copy of historical source code. Retain version-control
history when reviewing and committing subsequent implementation changes.

Pinned legacy compatibility inputs include the source catalogue, exact Causal
Emergence release, all existing structural schemas, geometry fixture inputs,
source locks, reference outputs and frozen artifacts. Algorithm/test files are
also inventoried for attribution of the recorded checks. Documentation is
excluded so plan corrections do not change scientific baseline identity.
Additional future fixtures are permitted; this inventory pins existing files
and is not a permanent prohibition on new work.

| Existing output | Frozen identity / coverage |
|---|---|
| Source Model Pack | `causal-emergence@2026.08.15`, root `sha256:1364547211fc56dbcfb7962612458d12cb40ee92aa30b11ccb819151015cd2ab`, manifest `sha256:39203e307d7c55582946fce0037682141acae31cdec54640202874d943c7c213` |
| Complete projection/unit Forman | 249 nodes, 971 edges; artifact `sha256:c455cd2dba039e9545ab6866b390a2f3522b23247bbef550df0a1c86710cb745` |
| Typed/local-weight experiments | 72 runs; suite `sha256:b9a05b0aa9dd2184e8f8dc3463fa8d4dc018bc649e5468506f8770801a0612d4` |
| Unit directed Ollivier | 40 runs, 242 edge values; suite `sha256:3a9cf842ccf6a0f3a46e7eea8d03ce8104e5383e0726a4a3071a51ff17ff6be1` |
| Exact normalized flow | 11 runs, 68 states, 1089 edge calculations; suite `sha256:13203d479b53fd3bddc5f10585bced5d889894109995b17c51bfae0f9a35d313` |

The suite files pin individual request/artifact identities and convergence/cut
records. Flow includes all five stopping semantics in code/tests, exact rational
normalization and the published `G(3,2)` recurrence. The new document's dedicated
star and single-bridge flow controls were absent at capture. They are now
verified in a [separate R1 supplement](FLOW_CONTROLS_REVIEW.md), and are not
retroactively claimed as baseline fixtures. This inventory is not rewritten.

## Read-only checks

```sh
python3 -B docs/structural-geometry/baselines/verify_baseline.py
python3 -B docs/structural-geometry/baselines/verify_baseline.py --compatibility
npm run structural-geometry:check
```

The first verifies all 1534 pinned files. The compatibility mode verifies the
117 scientific input/schema/golden files while allowing intentional runtime
refactoring. Neither mode regenerates files, resolves a mismatch by changing
expectations, checks newly added files, or replaces semantic/certificate replay.
Run the normal geometry checks and relevant independent references as well.

During R2, ordinary legacy API calls must still reproduce their pinned artifacts.
New provider-aware envelopes have separate identity and reference those exact
outputs. Retain this inventory when adding a later baseline; do not overwrite
it to make a refactor appear compatible. A deliberate semantic change requires
a new policy/artifact version and an explicit comparison with the old baseline.

## Verification and observed timing

Freshly executed for this revision on Node 24.19.0 / Python 3.9.6 / macOS arm64:

- Combined geometry check: passed in **69.910 seconds**.
- Foundation: 35 tests; typed experiments: 23; Ollivier: 26; flow: 23.
  Total focused tests: **107 passed**, no failures.
- Full source projection/Forman replay, 72 experiments, 40 Ollivier runs and
  11 flow trajectories matched their frozen outputs.
- Published recurrence: 714 exact edge values across 17 states passed.

The prior flow acceptance on the same unchanged implementation recorded
**1303 passing repository tests** in 203.46 seconds and a successful complete
build (182 schemas, 16 workspaces, 195 implemented kernel capabilities). Both
NetworkX 3.2.1 references were executed at that acceptance. This documentation
revision reruns the combined geometry check against their frozen outputs; it
does not mislabel the earlier full-suite or fresh external-reference execution
as a new run. The [flow review](FLOW_REVIEW.md) retains that evidence.

These are observed validation timings on a development machine, not an isolated
solver benchmark, speedup, statistical sample or cross-platform performance
claim. Future provider comparisons should freeze a separate performance workload
and timing protocol before claiming an improvement. Remote CI and independent
scientific review are not inferred from local success.
