# Reproducible Build Equivalence Model Pack

This exact Model Pack maps the frozen Reproducible Build Equivalence case into
separate nodes for source files, build instructions, normalized environment,
toolchains, execution histories, specified outputs, equivalence regimes,
pairwise comparisons, and regime-local verdicts.

Build or verify it with:

```sh
npm run model:reproducible-builds
npm run model:reproducible-builds:verify
```

Every execution remains a distinct node. Equal output nodes are shared by
digest, while toolchain and provenance differences remain visible. The pack
contains an explicit boundary node instead of inventing a Historical Load
result for a case without route costs or an admissibility problem.
