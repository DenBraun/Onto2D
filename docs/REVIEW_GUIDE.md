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
