# Kernel Implementation Status

## Authority

The runtime exports `KERNEL_IMPLEMENTATION_STATUS` and `KERNEL_CAPABILITIES`.
The frozen closure fixture and capability-evidence manifest verify that registry
against the test suite. This document summarizes the boundary and intentionally
does not duplicate every exported function.

## Locally closed kernel

The schema-v1 registry has no pending kernel operations. Implemented capability
groups are:

- canonical serialization, hashing, graph/skeleton identity, and bounded
  candidate generation;
- quantities, exact decimals, expressions, predicates, local evaluation, and
  explicit scientific-oracle validation;
- package loading, run binding, complete filtering/censuses, cohorts,
  functionals, ranking, sensitivity, and admission;
- derived profiles/elements, depth-aware closure, ladders, current-level
  fixpoints, and carrier promotion;
- deterministic null-model planning, proposals, trials, and baselines;
- audited pruning with exhaustive differential conformance;
- explanations, integrated result censuses, semantic run bundles, and source
  migration binding.

Exact public names are available from `packages/kernel/src/index.js`; exact
data shapes are available from `@onto2d/schemas`.

## Engine status

The separate headless engine now provides verified Model Pack access, bounded
local-directory loading, exact version resolution, workspaces, declared
lineage-aware structural diff, and a registered Canonical Identity analysis.
These orchestration features do not add kernel capabilities or change the
closed schema-v1 kernel contract. See the
[Engine Architecture](ONTO2D_ENGINE_ARCHITECTURE.md).

The separate `@onto2d/view` package and Model Studio provide deterministic
catalogue and bounded neighborhood projections over the bundled release. They
are presentation features, not additional kernel or scientific capabilities.

## Adapter status

| Boundary | Implemented | Still external or pending |
|---|---|---|
| Catalogue | Audit, classified projections, reviewed resolution/condensation replay, diagnostics, metrics, explanations | Policy authorship, annotation collection, reviewed current-catalogue migration inputs |
| Scientific | Adapter validation and request/response protocol; bounded Phase-B case solver; Phase-C boundedness preflight and stabilized trial-family search | General nonlinear search, dynamic stability, and complete scientific evidence |
| Run store | Verified local bundle persistence and append-only execution records | Remote object-store persistence |

## Cases

- `cases/three-node-motifs` is a frozen, executable empirical reproduction.
- `cases/level-0-oscillator` contains a bounded numerical Phase-B reference
  benchmark, a negative Phase-C boundedness preflight, and a bounded objecthood
  search with no qualified node. It is not complete Level-0 or empirical
  validation of the theory.
- The Historical Load Explorer is illustrative rather than empirical.

The required numerical, migration, solver, and empirical work is tracked in the
[Scientific Roadmap](SCIENTIFIC_ROADMAP.md). It is separate from schema-v1
kernel implementation closure.

## Verification

Local acceptance requires:

```sh
npm test
npm run check
npm run build
npm run check:goldens
```

These checks establish deterministic implementation evidence. They do not
replace independent review, external scientific validation, or the CI matrix
required for a release.
