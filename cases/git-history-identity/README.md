# Git History Identity

Status: implemented and reproducible as of 2026-08-18.

This bounded case demonstrates one precise result with native Git objects:

```text
same final tree != same commit != same ancestry
```

The builder creates a temporary SHA-1 Git repository entirely from a reviewed
JSON fixture. It writes blobs, trees, and commits with Git plumbing commands,
records their native object IDs, and independently recomputes Git's
`<type> <length>\0<content>` SHA-1 framing before accepting an object. The
temporary repository is not the evidence artifact; the normalized, committed
JSON output is.

## Result

The fixture contains 7 blobs, 8 trees, 14 commits, 6 named histories, and 4
controlled comparisons. Every comparison ends at the same native Git tree
object but at a different native commit object.

| Experiment | Tree | Commit | Ancestry | `tree-state-v1` class |
|---|---|---|---|---|
| Independent converging histories | Same | Different | Different | Same |
| Different intermediates and length | Same | Different | Different | Same |
| Merge topology versus linear | Same | Different | Different | Same |
| Metadata-only head change | Same | Different | Same | Same |

The metadata-only control matters: it shows that commit identity can change
while both the final tree and the exact parent closure below the selected head
remain unchanged. The first three comparisons then isolate genuine ancestry or
topology differences.

## Identity regimes

- **Tree identity** compares the native tree object ID referenced by each head.
- **Commit identity** compares the complete native commit object ID.
- **Ancestry identity** compares the exact parent closure and topology below
  the selected head. Head metadata is intentionally outside this projection.
- **History equivalence** applies the declared `tree-state-v1` rule and places
  histories with the same final tree in one class without merging their native
  records.

These are four different questions. The interface changes the active question;
it never changes an object, ID, or extracted relationship.

## Reproduce and verify

Node.js 22 or newer and a Git executable with SHA-1 object-format support are
required.

```sh
npm run case:git-history
npm run case:git-history:verify
node --test cases/git-history-identity/tests/*.test.mjs
```

The first command regenerates
[`artifacts/history-identity.json`](artifacts/history-identity.json). The second
builds the case independently and requires byte-for-byte equality with the
committed artifact. The tests also rebuild in two separate temporary
repositories, mutate source and parent evidence, validate the JSON Schema, and
confirm that incomplete or reordered ancestry fails closed.

Run `npm run dev:site`, then open
`http://127.0.0.1:8080/apps/git-history-identity-lab/` for the interactive view.
The browser verifies a pinned SHA-256 digest of the complete artifact before it
renders any result.

## Evidence boundary

The case establishes state/history separation only for this finite,
deterministic fixture. Git commit parentage is retained as a native Git
relation; it is not relabeled as physical, logical, or scientific causality.
The `tree-state-v1` class is a disclosed comparison rule, not a claim that the
histories are universally equivalent.

No Historical Load value is defined. The fixture does not declare a complete
counterfactual construction space or a cost function, so a load number would
be unjustified. The case also does not generalize from the fixture to arbitrary
repositories, signatures, replace refs, shallow clones, alternate object
formats, submodules, or working-tree state.

## Files

- `fixture-spec.json` is the only editable fixture source.
- `build-fixture.mjs` validates the source and constructs native Git objects.
- `src/history-identity.mjs` defines ancestry projection and regime comparison.
- `schema/history-identity.schema.json` closes the artifact transport shape.
- `artifacts/history-identity.json` is the reproducible evidence artifact.
- `tests/git-history-identity.test.mjs` covers positive and adversarial cases.
- `../../apps/git-history-identity-lab/` is the verified browser projection.

The approved design and falsification criterion remain in
[`../../docs/external-cases/GIT_HISTORY_IDENTITY_IMPLEMENTATION.md`](../../docs/external-cases/GIT_HISTORY_IDENTITY_IMPLEMENTATION.md).

## History Matters pilot

The [frozen benchmark contract](history-benchmark/contract.json) compares the
complete source-fixture census under an exact semantic identity regime.
`npm run history-benchmark:check` replays its P/H/target artifacts, wrong-history
nulls and [result](history-benchmark/result.json). This is a regime-relative
semantic result, not empirical prediction or an independent review.
