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
                 |
             run-store
```

`@onto2d/kernel` is the innermost executable boundary and remains free of
package dependencies. Schemas are transport contracts. Adapters translate
external formats, scientific implementations, or verified artifacts at the
filesystem boundary; the kernel never imports them.

## Current tree

```text
Onto2D/
├── .github/workflows/ci.yml
├── apps/
│   └── historical-load-explorer/  # ΔH prototype + motif case projection
├── cases/
│   ├── level-0-oscillator/
│   │   ├── README.md
│   │   └── source-lock.json
│   └── three-node-motifs/        # frozen external motif reproduction
│       ├── artifacts/analysis.json
│       ├── src/
│       ├── motif-catalog.json
│       ├── graph-conventions.json
│       ├── null-model.json
│       ├── published-reference.json
│       ├── run.mjs
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
│   ├── catalog-adapter/        # source loader and read-only graph audit
│   ├── scientific-adapter/     # validated external-computation port
│   └── run-store/              # verified bundles and operational records
├── scripts/                    # checks, test runner, and conformance references
├── scr/                        # preserved source catalogue and locked sources
├── test/
│   ├── cases/
│   ├── fixtures/
│   └── workspace/
├── runs/                       # ignored runtime output boundary
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
| `packages/run-store` | atomic local publication/full reconstruction of verified run bundles and separate append-only execution records | kernel semantics, partial overwrite, mixing operational metadata into semantic hashes, or trusting files without replay |
| `cases` | source locks, frozen rules, fixtures, expected artifacts | hard-coded kernel branches |
| `scripts` | repository automation and isolated conformance references | runtime domain semantics duplicated from packages |
| `scr` | preserved source data and reference artifacts | generated run results |
| `apps/historical-load-explorer` | illustrative browser interaction, a disclosed finite toy path model, and a read-only tested projection of the frozen motif case | altering case results, scientific solver semantics, kernel semantics |

## Growth sequence

Implementation grows through the following sequence:

1. complete R0 checks and contract coverage;
2. execute and harden the implemented model/load/canonical/hash foundation;
3. review the graph canonicalizer against an independent implementation and
   freeze its golden byte fixtures;
4. review skeleton reference counts/store truncation, the finite decorator,
   the implemented primitive package/run binding, and verified graph-predicate
   evaluation plus package-bound local numeric filtering, exact/compensated
   scalar and Quantity structural-attribute sums, compatible derived Quantity
   addition and scalar scaling, plus element-exact, strict profile-wide, and
   explicit numeric profile-mean
   invariant resolution for Quantities and package-authored scalar symbols,
   candidate-local invariant uncertainty, node/edge attribute balance, and
   directed cycle-edge selection, canonical single-removal irreducibility, plus
   complete package-bound local-filter census construction/verification and
   eligible-filter-bound finite functional scoring with coefficients and
   general Quantity products, plus total cohort construction/verification;
   complete dense selector ranking/verification, coefficient sensitivity, and
   multi-selector admission and selected-formation materialization are also
   implemented, followed by residual-slot profile extraction and derived
   population materialization and the integrated primitive-to-depth-1 level
   coordinator, verified arbitrary-depth source selection, complete depth-aware
   selection/materialization, generalized target-depth closure, explicit
   bounded ladder execution, profile-collapse/level-boundary diagnostics, and
   explicit carrier-promotion target inputs plus bounded current-level
   fixpoint execution, exhaustive policy-bound `minimal` evaluation, and
   package-authored scalar invariant execution, exact-domain constituent
   novelty, exhaustive typed `stableUnder`, seeded sampled stability, explicit
   numeric profile-invariant aggregation, explicit-semantic local Quantity
   products, and audited pre-admission plus recursive generator-frontier
   pruning with differential censuses at depth one and arbitrary verified
   target depths, followed by verified per-level explanation indexes and
   integrated final result censuses plus verified semantic run bundles,
   runHash-bound candidate lookup, atomic local bundle persistence, and exact
   null-model carrier/gate/independent-stream planning, all three proposal
   populations, occurrence-local trial censuses and selection, and per-model
   distributions integrated into primitive/generalized-depth baselines, plus
   opt-in complete-candidate profile-slot capacity and typed partner-guard
   gating at primitive, arbitrary-depth, and current-level boundaries, plus
   package-authored constant/element-invariant scalar/Quantity candidate
   attributes with exact profile-class consensus, role-dependent edge maps,
   acyclic formation-functional later-depth attribute carry-forward,
   formation-derived Quantity-threshold type rules, and current-level round-
   carrier null execution, plus nested substructure invariant resolution and a
   closed schema-v1 profile-aggregation registry, plus closed source-migration
   and condensed-cluster package/run binding under ADR-0091; canonical-prefix pre-admission pruning
   is integrated after the complete profile gate under ADR-0083, and raw-
   frontier profile censuses under ADR-0084; audited node-
   growth pruning is implemented under ADR-0082 and replay-resumable traversal
   under ADR-0081;
5. author and review source-classification and node-resolution policies with
   the executable freeze contracts now that predicate numeric bindings and
   Oracle validation are executable, then collect independent annotations with
   the executable annotation/adjudication contracts;
6. apply the implemented isolated-node reconciliation and lossless condensation
   engine only after actual reviewed policy/annotation/disposition inputs exist;
7. add current-catalogue migration fixtures to
   `packages/catalog-adapter/test/fixtures`;
8. expand `cases/level-0-oscillator` only when quantities and evidence are
   operationally defined;
9. maintain the frozen three-node-motif reproduction and its tested Explorer
   projection without retuning the predeclared external comparison;
10. add further applications after kernel artifact contracts stabilize.

Catalogue files remain in `scr/` as immutable source inputs and reference
artifacts.
