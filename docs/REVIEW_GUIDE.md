# Review Guide

## Review outcomes

Keep three decisions separate:

1. **Local implementation** - behavior and contracts reproduce in the checkout.
2. **Release readiness** - CI, packaging, security, and independent golden
   review pass for the release commit.
3. **Scientific validity** - case-specific assumptions and evidence support the
   stated claim.

A positive result at one level does not imply the next.

## Recommended order

1. Read [Project Structure](PROJECT_STRUCTURE.md) and confirm dependency
   direction.
2. Review canonical identity and independent fixtures before higher-level
   artifacts.
3. Review schemas and negative/tamper tests for the changed boundary.
4. Trace one complete package run through binding, generation, evaluation,
   selection, closure, and artifact replay.
5. Review case source locks and comparison rules separately from kernel logic.
6. Run the required commands and inspect the exact diff.

```sh
npm ci
npm test
npm run check
npm run build
npm run check:goldens
```

## Independent golden review

This review confirms that the frozen canonical-identity and skeleton results
were not derived from, or adjusted to, the JavaScript kernel that consumes
them. The reviewer should not be the sole author of both the reference
generator and the corresponding kernel implementation. A second implementation
is not required: the repository already contains the independent Python
implementation, but the reviewer must read and assess it rather than approve
only from a green test result.

Review the exact proposed release commit in a clean checkout. Do not regenerate
the fixtures before the initial comparison because the generation command
without `--verify` overwrites them.

```sh
git rev-parse HEAD
git status --short
node --version
python3 --version
npm ci --ignore-scripts
npm run check:goldens
npm run test:kernel
git diff --exit-code -- test/fixtures/canonical-conformance-v1.json test/fixtures/skeleton-conformance-v1.json
```

Read these inputs and consumers:

- [`scripts/reference/generate-conformance-fixtures.py`](../scripts/reference/generate-conformance-fixtures.py)
- [`test/fixtures/canonical-conformance-v1.json`](../test/fixtures/canonical-conformance-v1.json)
- [`test/fixtures/skeleton-conformance-v1.json`](../test/fixtures/skeleton-conformance-v1.json)
- [`packages/kernel/test/canonical.test.mjs`](../packages/kernel/test/canonical.test.mjs)
- [`packages/kernel/test/skeleton-enumerator.test.mjs`](../packages/kernel/test/skeleton-enumerator.test.mjs)
- [ADR-0003](adr/0003-canonical-identity-foundation.md), [ADR-0004](adr/0004-refinement-graph-canonicalization.md), and [ADR-0005](adr/0005-skeleton-enumeration-and-candidate-store.md)

Confirm the following points:

- The Python generator uses only the standard library and neither imports nor
  executes the JavaScript kernel.
- Canonical object-key ordering, number serialization, Unicode handling, byte
  encoding, domain framing, and SHA-256 inputs match the stated contracts.
- Skeleton generation visits every labelled simple graph through six nodes,
  rejects disconnected graphs, and evaluates the full vertex-permutation orbit
  before choosing a canonical representation.
- Skeleton multiplicities reconcile with the connected labelled input totals.
  The connected-unlabelled counts for one through six nodes are
  `1, 1, 2, 6, 21, 112`; the connected-labelled counts are
  `1, 1, 4, 38, 728, 26704`.
- The JavaScript tests consume the frozen values as expectations rather than
  rewriting or deriving them.

Record the reviewed commit SHA and the result in the release pull request. This
template is sufficient:

> Reviewed `scripts/reference/generate-conformance-fixtures.py` and the frozen
> canonical and skeleton fixtures at commit `<SHA>`. Confirmed that the Python
> reference does not use the JavaScript kernel, independently implements the
> documented canonical serialization, domain framing, and exhaustive
> permutation-orbit enumeration, and produces the expected graph counts.
> `npm run check:goldens` and `npm run test:kernel` pass with no fixture diff.
> Approved for `v0.1.0`.

## Critical questions

### Identity and determinism

- Do input permutations preserve identity where policy says they should?
- Do direction, role, and declared structural attributes affect identity?
- Are hashes domain-separated and based on canonical bytes?
- Are concurrency and input order absent from semantic output?

### Failure and resource behavior

- Are incomplete, indeterminate, exhausted, empty, and failed states distinct?
- Does budget exhaustion prevent interpretation of a partial result?
- Does optimized execution reproduce the exhaustive reference?
- Are malformed or stale artifacts rejected rather than repaired?

### Scientific boundary

- Are solver outputs bound to method, version, parameters, and evidence?
- Were source classification and comparison rules frozen before topology or
  results could bias them?
- Does the interface state whether a result is illustrative, reproduced, or
  externally validated?

### Persistence and packaging

- Can every stored semantic artifact be reconstructed and byte-verified?
- Are timestamps, platform labels, and resource use outside semantic hashes?
- Do package exports, declarations, licenses, and tarball contents match the
  intended public surface?

## Release evidence

Release approval requires the exact commit to pass the supported OS/Node CI
matrix, independent review of canonical fixtures, package smoke imports, and
the [Release Checklist](RELEASE_CHECKLIST.md). Current-catalogue migration and
Level-0 scientific validation remain separate projects and are not blockers for
publishing the deterministic kernel if release claims stay within scope.
