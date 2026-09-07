# Git History Identity

Case ID: `git-history-identity`. [History case registry](../history-case-registry.json).

- [Git History Identity — use and reproduction](#git-history-identity--use-and-reproduction)
- [Git History Identity — source and interpretation](#git-history-identity--source-and-interpretation)

<a id="git-history-identity--use-and-reproduction"></a>

## Git History Identity — use and reproduction

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

<a id="git-history-identity--use-and-reproduction--result"></a>

### Result

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

<a id="git-history-identity--use-and-reproduction--identity-regimes"></a>

### Identity regimes

- **Tree identity** compares the native tree object ID referenced by each head.
- **Commit identity** compares the complete native commit object ID.
- **Ancestry identity** compares the exact parent closure and topology below
  the selected head. Head metadata is intentionally outside this projection.
- **History equivalence** applies the declared `tree-state-v1` rule and places
  histories with the same final tree in one class without merging their native
  records.

These are four different questions. The interface changes the active question;
it never changes an object, ID, or extracted relationship.

<a id="git-history-identity--use-and-reproduction--reproduce-and-verify"></a>

### Reproduce and verify

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

<a id="git-history-identity--use-and-reproduction--evidence-boundary"></a>

### Evidence boundary

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

<a id="git-history-identity--use-and-reproduction--files"></a>

### Files

- `fixture-spec.json` is the only editable fixture source.
- `build-fixture.mjs` validates the source and constructs native Git objects.
- `src/history-identity.mjs` defines ancestry projection and regime comparison.
- `schema/history-identity.schema.json` closes the artifact transport shape.
- `artifacts/history-identity.json` is the reproducible evidence artifact.
- `tests/git-history-identity.test.mjs` covers positive and adversarial cases.
- `../../apps/git-history-identity-lab/` is the verified browser projection.

The approved design and falsification criterion remain in
[`../../cases/git-history-identity/README.md`](#git-history-identity--source-and-interpretation).

<a id="git-history-identity--use-and-reproduction--history-matters-pilot"></a>

### History Matters pilot

The [frozen benchmark contract](history-benchmark/contract.json) compares the
complete source-fixture census under an exact semantic identity regime.
`npm run history-benchmark:check` replays its P/H/target artifacts, wrong-history
nulls and [result](history-benchmark/result.json). This is a regime-relative
semantic result, not empirical prediction or an independent review.

<a id="git-history-identity--source-and-interpretation"></a>

## Git History Identity — source and interpretation

<a id="git-history-identity--source-and-interpretation--purpose"></a>

### Purpose

Create the smallest rigorous external case showing that identical current state
does not uniquely determine history.

Primary distinction:

```text
same tree state
    !=
same commit identity
    !=
same ancestry
```

This case should become the canonical introductory Onto2D demonstration of
state/history separation.

<a id="git-history-identity--source-and-interpretation--scope"></a>

### Scope

Use a deterministic local fixture repository created entirely by test code.

Do not depend on a large public Git repository for the canonical experiment.

The fixture must create at least two histories converging to the same final tree.

<a id="git-history-identity--source-and-interpretation--canonical-fixture"></a>

### Canonical Fixture

Target:

```text
History A                 History B

A0                        B0
 |                         |
A1                        B1
 |                         |
A2                        B2
  \                       /
   +--- same final tree --+
```

Required:

```text
tree(A2) == tree(B2)
commit(A2) != commit(B2)
ancestry(A2) != ancestry(B2)
```

The fixture builder must record exact object IDs.

<a id="git-history-identity--source-and-interpretation--falsification-criterion"></a>

### Falsification Criterion

The case fails if Onto2D cannot represent:

```text
same current structure
+
different historical identity
```

without duplicating or corrupting the current-state structure.
