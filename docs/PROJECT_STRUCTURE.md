# Onto2D Project Structure

Status: current package layout and deterministic kernel foundation with
explicit extension points.

## Dependency direction

```text
@onto2d/kernel       @onto2d/schemas
       ^                    ^
       |                    |
catalog-adapter      scientific-adapter
       ^                    ^
       +---------+----------+
                 |
          applications/cases

legacy-runtime --> onto2d.js
```

`@onto2d/kernel` is the innermost executable boundary and remains free of
package dependencies. Schemas are transport contracts. Adapters translate
external formats or scientific implementations inward; the kernel never imports
them. The compatibility runtime remains isolated from the kernel and retains
its existing behavior contract.

## Current tree

```text
Onto2D/
├── .github/workflows/ci.yml
├── cases/
│   └── level-0-oscillator/
│       ├── README.md
│       └── source-lock.json
├── docs/
│   ├── adr/
│   ├── DEVELOPMENT.md
│   ├── PROJECT_STRUCTURE.md
│   ├── KERNEL_ARCHITECTURE.md
│   ├── KERNEL_IMPLEMENTATION_STATUS.md
│   ├── KERNEL_DEVELOPMENT_PLAN.md
│   ├── KERNEL_DESIGN_DECISIONS.md
│   ├── REVIEW_GUIDE.md
│   └── FOUNDATIONAL_PAPER_ANALYSIS.md
├── packages/
│   ├── kernel/                 # model, graph identity, quantities, expressions, enumeration/store
│   ├── schemas/                # JSON Schema Draft 2020-12 contracts
│   ├── catalog-adapter/        # legacy loader and read-only graph audit
│   ├── scientific-adapter/     # validated external-computation port
│   └── legacy-runtime/         # compatibility wrapper
├── scripts/                    # dependency-free checks and test runner
├── scr/                        # preserved legacy catalogue and locked sources
├── test/
│   ├── cases/
│   ├── fixtures/
│   ├── legacy/
│   └── workspace/
├── runs/                       # ignored runtime output boundary
├── onto2d.js                   # existing public legacy runtime
├── package.json
└── package-lock.json
```

## Ownership rules

| Location | Owns | Must not own |
|---|---|---|
| `packages/kernel` | canonical model, predicates, enumeration, closure, selection, artifacts | catalogue parsing, UI, solver implementations |
| `packages/schemas` | versioned external data shapes | scientific or cross-record truth |
| `packages/catalog-adapter` | source loading, audit, explicit loss-aware migration | post-hoc edge relabelling, hidden source edits |
| `packages/scientific-adapter` | adapter validation and oracle boundary | pretending a solver exists or promoting failures to passes |
| `packages/legacy-runtime` | stable import path for current API | new closure semantics inside legacy classes |
| `cases` | source locks, frozen rules, fixtures, expected artifacts | hard-coded kernel branches |
| `scripts` | repository automation | domain semantics duplicated from packages |
| `scr` | preserved legacy data and reference artifacts | generated run results |

## Growth sequence

Implementation grows through the following sequence:

1. complete R0 checks and compatibility coverage;
2. execute and harden the implemented model/load/canonical/hash foundation;
3. review the graph canonicalizer against an independent implementation and
   freeze its golden byte fixtures;
4. review skeleton reference counts/store truncation, then add deterministic
   candidate decoration;
5. bind precision/tolerance policy to compiled numeric operations and validate
   Oracle request/response contracts without invoking a solver;
6. freeze source-classification and node-resolution ADRs before migration;
7. add migration fixtures to `packages/catalog-adapter/test/fixtures`;
8. expand `cases/level-0-oscillator` only when quantities and evidence are
   operationally defined;
9. add applications after kernel artifact contracts stabilize.

Catalogue files remain in `scr/` during early stages. Moving them under a
`legacy/` tree is optional and is not required by the kernel architecture.
