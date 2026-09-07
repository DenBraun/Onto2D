# ResponseSignature-v0 controls

These SG2-024 controls implement the [fixed protocol](PROTOCOL.md) and
[signature contract](../../../docs/structural-geometry/SIGNATURES.md#graph-native-responsesignature-v0).
They preserve all previous response/invariance cases and source identities.

From the repository root:

```sh
npm run structural-geometry:signature:check
npm run structural-geometry:signature:report
```

The report independently verifies all artifacts and census results before
printing coverage and the nine fixed contrasts. Regenerate with
`npm run structural-geometry:signature:build` only after deliberate review of
the protocol, controls and independent source-derived expectations.
`python3 -B cases/structural-geometry/signatures/reference.py --help` lists
the separate reference generation and verification commands.

## Results and interpretation

There are 27 artifacts: the 16 existing response sources plus 11 variants
declared before signature evaluation. Twelve signatures are complete; 15 retain
null whole values with explicit missing, rejected or absent-target evidence.
Complete individual features remain inspectable. The maximum upstream control
performs 70 observations and 448 feature-component visits.

| Fixed contrast | Canonical | Topology | Typed |
|---|---|---|---|
| Subdivide feedback edge | Different | Different | Different |
| Add isolated node | Equal | Equal | Equal |
| Contextual edge becomes necessary | Equal | Equal | Different |

All compared signatures in this table are complete. Isolate extension is a
retained collision between different baseline graphs, not an equivalence claim.
The typed change does not alter the untyped graph. No source IDs, provenance,
coverage counters or geometric values enter the feature tuple.

## Independent evidence

`reference.py` reads source controls and invokes the earlier independent Python
response calculation: exhaustive selectors, set edits, Boolean closure and graph
orbits. It separately sorts/groups complete joint response rows and adjudicates
feature eligibility. The fixed invariance gate's expected status follows
mandatory baseline observation availability. Expectation generation reads no
production artifact. All source/protocol/reference dependencies are SHA-256 bound.

The census covers all 69 loopless directed graphs on one through three nodes in
each regime: 207 requests and 345 observed features. None has a complete signature
under all mandatory probe families. The reference compares the available
features and every gap, not just null whole values. All 2,343 eligibility
adjudications agree, spanning five feature states in profiles of zero through
four features and all three invariance statuses.

Transport tests check 393 small-graph topology bijections and all 72
diamond-with-feedback regime/bijection combinations, plus four induced-scope,
opaque-ID and missing-evidence cases. They compare every feature, reason and
fingerprint while retaining different provenance. Browser verification rebuilds
all 27 complete evidence composites. See the
[acceptance review](../../../docs/structural-geometry/EVIDENCE.md).
