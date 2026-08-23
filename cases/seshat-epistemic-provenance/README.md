# Seshat Epistemic Dependency and Provenance

This bounded case asks whether the same historical categorical value can retain
different epistemic identity when the public support dependency structure is
preserved.

The outcome-blind selection profile freezes one Polaris-2026 variable, `Road`,
for three polities:

- Egypt - Classic Old Kingdom (`eg_old_k_1`);
- Roman Empire - Principate (`it_roman_principate`);
- Cahokia - Emergent Mississippian II (`us_emergent_mississippian_2`).

All three workbook rows retain the exact native code `P`; all three selected API
records retain the mapped value `present`. The source narratives contain one,
zero, and four inline reference records respectively. The resulting canonical
labelled support DAGs have three different exact support hashes.

## Exact release boundary

The source projection records:

- Polaris-2026 commit
  `55ca5fbc2b563ddbbc1a3413071d4bd243d0a5fa`;
- Polaris workbook SHA-256
  `cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41`;
- Seshat server-code commit
  `9e812bcdbdfe5bb3e87e7a2588d2bcb9a2dc78f0`;
- public serializer SHA-256
  `3571ba8fab32d62ca57bd2052d7da1e67431f90b36947b222dc421a4fab3251f`;
- Seshat Code Book version `4.20.2021`, SHA-256
  `31442ad457955c768a67a5eb4675f8e4cbf23616dcc1f1fc1cfabae05482601d`;
- captured current Public Data terms SHA-256
  `0e3c6581527917fc9a332193fc534e72e6b4402f2aac011b86c1f271da498321`;
- exact SHA-256 and byte count for the source projection, selection profile,
  data-availability probe, and authority projection.

Normal extraction is offline. `upstream.json` is the machine-readable lock.
The compact source projection retains upstream attribution and source links.
The Polaris build repository records an MIT license for its repository scope.
Seshat Public Data is separately licensed under CC BY-SA 4.0; the compact data
projection records its adaptation and remains within that license boundary.

## Epistemic model

The case-local library keeps these axes independent:

```text
ArtifactKind
DerivationOperation
ResolutionState
EvidenceBasis
ReviewStatus
AgreementStatus
Precision
```

Evidence records cannot carry claim resolution or derivation operations.
Coding claims require both. The native Seshat code table round-trips `A`, `P`,
inferred, unknown, transitional, disputed, not-applicable, and blank forms
without replacing the source spelling. Separate contracts preserve exact
numeric range lexemes and integer/null time bounds. A direct-attestation
firewall prevents unknown, disputed, transitional, and inferred forms from
silently becoming direct categorical evidence.

Exact support identity is a domain-separated hash of the canonical labelled
support closure, including claim and mapping identity. Composition counts are
descriptive and never act as an equality key.

## Public metadata firewall

The public Road objects do not expose a per-datapoint research assistant,
expert, review event, or intervention timestamp. Those group cuts are `null`
with an explicit reason. A separate polity-level RA relation is not promoted to
a datapoint-level coder relation. The API `TRS` tag is retained as a confidence
qualifier and is not interpreted as a person.

Inline `§REF§` payloads are mapped by one explicit, versioned local table. The
mapping does not claim bibliographic completeness or source independence. In
particular, two Cahokia reference branches map to one Pauketat 2014 work group.

## Ablation semantics

Every declared support edge in this MVP is required. Removing a group removes
its member nodes and all transitive dependents in a new graph; it never mutates
the frozen source graph. The committed output retains the raw categorical
transition `Resolved -> Unknown`, removed node and edge IDs, and `null`
threshold/qualitative-label fields. No PCA or imputation is performed.
The first categorical flip is also committed explicitly as the minimum group
removal that changes `present` to the exact categorical response `unresolved`;
the separate raw resolution response remains `Resolved -> Unknown`, and
unavailable group types remain `null` with a reason.

## Reproduce and verify

```sh
npm run case:seshat-epistemic-provenance:verify
node --test cases/seshat-epistemic-provenance/tests/seshat-epistemic-provenance.test.mjs
node --test apps/seshat-evidence-dependency-lab/seshat-evidence-model.test.mjs
```

The approved case identity is
`sha256:40dea4e1ae5d51311c7b8f26b26e8e003e6d81cc328a160c9b9a997d118a0d2a`.

The broader frozen-cohort experiment and its remaining implementation work are
specified in
[`docs/cases/SESHAT_FULL_DEPENDENCY_EXPERIMENT.md`](../../docs/cases/SESHAT_FULL_DEPENDENCY_EXPERIMENT.md).
