# Fixed-domain response pseudometric controls

The [protocol](PROTOCOL.md) and [controls](controls.json) freeze the R6 domain,
categorical families, equal weights, exact arithmetic and missingness rules.
The [contract](../../../docs/structural-geometry/SIGNATURES.md#fixed-domain-structuralpseudometric-v0)
explains the API and mathematical boundary.

```sh
npm run structural-geometry:pseudometric:check
npm run structural-geometry:pseudometric:report
```

The report verifies source bindings, all artifacts and property matrices before
printing any results. Deliberate regeneration uses `python3 -B
cases/structural-geometry/pseudometric/reference.py --write`, followed by
`npm run structural-geometry:pseudometric:build`; expected generation reads no
production artifact. Frozen sources/policies must not be tuned after outcomes.

`fixtures.mjs` constructs a shared source containing nine disjoint fragments.
The 48 ordered complete comparisons use four induced scopes in each regime;
12 further controls cover incomplete/empty/rejected targets, missing types,
foreign typed authority, legitimate untyped cross-source equality and maximum
upstream work. All source IDs and scope partitions participate in evidence.

[suite.json](suite.json) indexes 60 artifacts: 28 indistinguishable, 22
distinguishable and 10 indeterminate. Isolate-extension collisions remain zero
in all regimes; partial self-comparisons remain indeterminate even with observed
zero diagnostic values. Typed cross-source equality of raw signatures never
grants a common domain. Maximum work is 140 observations for a topology pair.

`reference.py` independently reconstructs source-derived response signatures,
then uses Python `Fraction`. Endpoint hashes bind every source-level signature
summary, not merely the final distance. Protocols, controls, independent helper
implementations and the JavaScript summary bridges are pinned by SHA-256.
Production and Python agree on all 59,778 categorical pairs, 14,368,590 triangles
and 728 aggregation profiles. Three symbols denote distinct nonempty joint
multisets; all results use fixed three/five-dimensional domains.

Tests additionally replay all artifacts in the browser, transport 48 source-pair
comparisons, reject rehashed forgeries and check schemas, engine snapshots,
input closure and resource errors. Prior scientific fixtures remain unchanged.
The [review](../../../docs/structural-geometry/EVIDENCE.md)
records acceptance. Domain meaning and empirical utility still require later
research gates.
