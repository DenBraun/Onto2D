# Seshat Epistemic Dependency and Provenance — Implementation

Updated: 2026-08-23

Implementation status: **EXPLORER** (completed 2026-08-23)

## Implemented result

The repository contains an offline, byte-locked three-claim projection from
Polaris-2026 and the public Seshat Road API. The variable and polity cohort were
frozen before stress computation. Roman Principate, Classic Old Kingdom Egypt,
and Cahokia Emergent Mississippian II all retain the exact Polaris code `P` and
API value `present`.

The canonical case separates source records, public narratives, exact inline
reference records, locally mapped source works, coding claims, and one
deterministic comparison artifact. Its support graph contains 22 nodes, 25
required edges, and 18 groups. The three claim-local canonical support hashes
are distinct even though every pair has the same native and mapped value.

Four source-work ablations are committed as raw categorical responses. Each
uses a new derived graph, retains exact removed node/edge IDs, and records
`sourceGraphMutated: false`. The Roman claim has no source-work ablation because
its public narrative exports no inline source marker.

The release also validates exact numeric range lexemes, integer/null time
bounds, direct-versus-inferred categorical evidence, and an explicit first
categorical flip for every supported group type.

## Public-data result

The public probe found native code and narrative-to-code context, plus partial
inline source-work information. It did not find public per-datapoint RA,
expert, review-event, or intervention timestamp relations. These axes remain
`unknown` or unavailable; no substitute identifiers are manufactured.

The authority projection pins Codebook `4.20.2021` by SHA-256 and separates the
MIT license of the Polaris build repository from the CC BY-SA 4.0 license of
Seshat Public Data. The captured Public Data terms response is also byte-locked.

## Explorer

The Historical Evidence Dependency Lab verifies the case artifact SHA-256 in
the browser and provides:

- an exact native claim and narrative inspector;
- an interactive claim-local labelled support DAG;
- a shared source-work fan-out view;
- exact public group-cut results;
- raw group-ablation responses;
- pairwise value/support identity comparisons;
- public metadata and non-claim boundaries.

The interface visibly states that this is a mechanism demonstration, not a
ranking of polities, evidence regimes, source quality, or historical truth.

## History model metadata

```text
History modes: Recorded + Reconstructed
Primary effects: Identity
Domain: Historical social science
Evidence profile: direct record, published interpretation, derived, unknown
Historical Load: not primary / not evaluated
History Equivalence: primary
Reachability: secondary
Reconstruction: secondary
```

## Reproduction

```sh
npm run case:seshat-epistemic-provenance:verify
node --test cases/seshat-epistemic-provenance/tests/seshat-epistemic-provenance.test.mjs
node --test apps/seshat-evidence-dependency-lab/seshat-evidence-model.test.mjs
```

The approved artifact identity is
`sha256:40dea4e1ae5d51311c7b8f26b26e8e003e6d81cc328a160c9b9a997d118a0d2a`.

See the [case README](../../cases/seshat-epistemic-provenance/README.md) and
[ADR 0120](../adr/0120-seshat-epistemic-support-identity-boundary.md) for exact
source locks, mapping semantics, identity rules, and epistemic limits.

The full population-level experiment and remaining engineering sequence are
specified in
[SESHAT_FULL_DEPENDENCY_EXPERIMENT.md](./SESHAT_FULL_DEPENDENCY_EXPERIMENT.md).
