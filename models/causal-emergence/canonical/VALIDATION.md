# Canonical reconstruction validation record

Validation completed 2026-09-12 for research release `2026.09.11`.
The [source guide](../../../references/canonical/README.md) explains the
scientific scope, construction decisions and remaining obligations.

## Exact artifact

The [manifest](../releases/2026.09.11/manifest.json) binds 25 local source and
implementation files. The release contains 33 specification records and 23
rule incidences, derived from 27 concepts, six proposed rules and 41 scoped
claims. Its bibliography has 18 source records, including two external
research publications; source records also include manuscripts, internal
checks, numerical evidence and the preserved legacy catalogues.

```text
rootHash: sha256:91eeb207dc0deab775985da6bcb06ce26adfe5780ddeb0fa88144c4d283034cb
manifestHash: sha256:3042b6ca258eac6360552a8716a3b98b1155713cfa5097600a164d1c05cf96db
```

All 12 historical reference files and all 12 files of the `2026.08.15`
release were compared byte-for-byte with Git `HEAD` and matched. The new
migration ledger accounts for all 249 legacy nodes and 971 incoming edges.
It records 24 reinterpreted nodes, 225 pending node reviews and 971 pending
historical edge decisions. Its accounting is checked against the original
JSON pointers, with reciprocal entity mappings for both splits.

## Checks performed

| Check | Result and boundary |
|---|---|
| `npm test` | Final complete rerun passed: 1,809 tests, zero failures, approximately 434 seconds |
| Focused source, engine, selection, evidence-link and public-site tests | 80 tests passed after the final source and interface corrections |
| `npm run check:canonical` | Closed schema, source hashes, citation and rule references, status constraints, migration coverage, finite mathematical witnesses and exact derivative replay passed |
| `npm run model:causal-emergence:legacy:verify` | Exact historical source-to-release reproduction passed |
| `npm run case:level-0:verify` | Reproduced the frozen portable v3 case with the same model-specific negative objecthood conclusion |
| Headless Chrome, local HTTP, 1500 × 1100 viewport | Loaded `R-promote` with 33 records / 23 incidences, exposed publication and repository links, received HTTP 200 for linked local sources, switched to the 249 / 971 historical release, restored the canonical default; no runtime exceptions or horizontal body overflow |
| Registry and public module checks | 21 exact releases; Studio revision `20260911.4`, with 21 aligned module dependencies and the current registry hash |
| Schema and kernel contract checks | 217 public schemas; 195 implemented kernel capabilities, zero pending, 372 mapped kernel tests |

The initial `npm run build` passed its preceding stages but stopped at an
Ollivier Python-oracle timeout in the existing LRU-cache test. The complete
Ollivier stage was rerun through `node scripts/check-structural-ollivier.mjs`:
all 26 tests passed in approximately seven seconds. No solver deadline or
numeric expectation was changed. The timeout did not recur; its underlying
environmental cause was not established.

Every remaining build stage then passed: shadow flow, Structural Geometry
site replay, exact registry, canonical reconstruction, public schemas, kernel
closure, documentation and historical catalogue audit. Source syntax and
public module revisions were checked again. Thus the build check set is
covered by the initial run plus the successful retry and continuation; this
record does **not** describe a single uninterrupted successful `npm run build`
invocation. `npm run build` remains the command for replaying the entire set.

## Scientific acceptance boundary

These checks establish reproducibility and the declared finite witnesses.
They do not automatically verify scientific prose, establish physical CRT
instances, supply independent peer review, classify all historical edges, or
complete the remaining levels. Rules in this release are specifications with
joint conditions and no admitted instances. A source DOI is a locator, not
evidence that a manuscript passed peer review. The exact limitations and
roles of each citation remain part of the source records and Inspector.
