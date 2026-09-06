# SG2-013 typed observation review

Date: 2026-09-06. Scope: joint typed observations and vocabulary alignment.

## Implemented boundary

The `/typed` API implements both frozen typed-regime specs. One kernel node
bijection preserves adjacency and all five edge fields together. Public values
retain set-valued arrays; the private kernel translation uses sorted JSON scalar
strings. Full-source present-field validation precedes scoped measurement.
Missing scoped fields preserve the untyped result and explicit null typed output.

Separate mappings bind exact source vocabularies and five partial bijections.
They require external caller approval by expected artifact hash before use.
Alignment checks coverage on both sides and recanonicalizes after code mapping.
It returns compatible/unresolved vocabulary preparation, without final graph
comparison status or distance. All earlier regime/spec and artifact identities
are preserved. The [contract](TYPED_OBSERVATIONS.md) records the complete boundary.

## Findings addressed and review controls

- Independent per-field isomorphisms can falsely match crossed correlations.
  The reciprocal-edge control matches for every field alone and splits under
  the combined tuple. Implementation and witnesses use one common bijection.
- Replacing codes in an existing canonical graph can leave the wrong node
  numbering. An approved renumbering control explicitly needs recanonicalization;
  translated witnesses still map every original right source edge and node.
- Equal numbers or even equal dictionary bytes in different sources carry no
  implicit semantic authority. A separate approval hash is required; creating a
  mapping or citing a review document does not supply that approval. Rehashed
  mapping changes lose prior authorization. Exact source/orientation mismatches
  raise validation errors, including when another evidence gap is present.
- Missing fields must differ from observed empty sets. Null typed values,
  hashes and witnesses retain every scoped gap; malformed present fields reject
  even outside the scope. Isolate-only graphs have complete vacuous edge evidence.
- Source dictionaries have no universal table layout in Model Pack. The API
  binds the complete dictionary and observes local code symbols. It does not
  claim table lookup, externally reviewed code meanings or scientific approval.
  The current fixtures supply constructed mapping authorization only.
- Mapping rows must remain injective on both sides, cover every scoped value
  and stay within the 1,024-entry limit. Partial approved mappings remain
  unresolved. No greedy or many-to-one interpretation is substituted.
- One test helper initially measured the full graph for an induced-scope
  fixture. It now transports the fixture's explicit scope. Independent case
  replay had already retained the correct isolated-node result.
- Public types were checked with positive calls and rejected mutation/invalid
  field/approval examples. The portable API reproduces all observations, maps
  and alignments in a browser bundle using the same implementation.

## Independent evidence

Python independently enumerates joint-field node permutations and reconstructs
all original/remapped witnesses. The exhaustive absent/A/B edge census covers
739 graphs on 1–3 nodes and 145 typed classes without false merges or splits.
All 720 relabelings of the declared six-node control preserve its typed value.
Five field-change controls, correlated/crossed edges, set ordering, Unicode
labels, missing data and source/dictionary changes are retained.

The suite contains 26 observations (24 measured, two incomplete), five mapping
artifacts and eight alignments (four compatible, four unresolved). Causal
Emergence contributes its unchanged six-node/11-edge fragment with 55 fields
present. There is no empirical or cross-domain equivalence claim.

## Validation record

- `npm test`: **1,433 passed**, zero failures/skips, 233,846.577958 ms locally.
  The new stage contributes 18 observation tests, 14 vocabulary tests, five
  schema/browser tests and three reference/census tests.
- Focused checks passed: **37** API/schema/browser tests, independent reference
  and artifact replay, 739-graph census, 720 relabelings, published TypeScript
  and **201** versioned schemas.
- Package dry run includes all six new typed runtime/type files:
  **46 files**, **245,365 unpacked bytes** for structural-geometry.
- Before/after SHA-256 comparison preserves **490** prior scientific case,
  schema, proposal/baseline and geometry/kernel implementation files exactly.
  The original **117** pinned compatibility files also verify. No older golden
  result, canonical implementation or regime/spec descriptor was rewritten.
- `npm run build`: passed, including **229** geometry API/behavior tests plus
  independent reference runners, 201 schemas, 16 package boundaries and 337
  Markdown files. Source census: 564 JavaScript and 926 JSON files. Worker,
  registry, catalogue and existing kernel closure checks also pass (195
  capabilities, zero pending, 372 mapped kernel tests).

Frozen suite:
`sha256:2208ac6b3e5c1c0df1f76a0a3e25eb3d1de77c49d26f614a81fb38b3c9690d45`.
Typed census:
`sha256:f359667f09cdc11c12a65f4473cc482f1f214f2c1aea94de46d8fecb9ecaa60d`.
Causal fragment typed value:
`sha256:1182c3c492624fea2f98e04cc7d31104fcea5423973c6959fe165d6a019acd75`.
Causal observation artifact:
`sha256:660763d20bd11437af09f18f6adbe6bb9ffb093ee39935b416bd49ad320ec3f2`.

These are local results on macOS arm64, Node 24.19.0 and Python 3.9.6. They do
not assert remote CI completion or independent scientific reviewer approval.

## Reproduction and next task

```sh
npm run structural-geometry:typed:check
npm run structural-geometry:typed:report
npm test
npm run build
```

See [cases](../../cases/structural-geometry/typed/README.md) for explicit
regeneration commands and frozen reference bindings. Checks require no server.
The next task is SG2-014/015: final three-way comparison results, null-distance
consistency and strict mandatory coverage across all three implemented regimes.
Probes, signatures and website gates remain open.
