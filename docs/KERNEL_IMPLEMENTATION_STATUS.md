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

## Adapter status

| Boundary | Implemented | Still external or pending |
|---|---|---|
| Catalogue | Audit, classified projections, reviewed resolution/condensation replay, diagnostics, metrics, explanations | Policy authorship, annotation collection, reviewed current-catalogue migration inputs |
| Scientific | Adapter validation and request/response protocol | Numerical solver implementations and scientific evidence |
| Run store | Verified local bundle persistence and append-only execution records | Remote object-store persistence |

## Cases

- `cases/three-node-motifs` is a frozen, executable empirical reproduction.
- `cases/level-0-oscillator` currently freezes source identities and analysis;
  it is not a numerical validation of the theory.
- The Historical Load Explorer is illustrative rather than empirical.

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
