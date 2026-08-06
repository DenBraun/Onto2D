# Kernel Foundation Review Guide

Status: prepared for maintainer review on 2026-08-06. This review package was
checked statically under an explicit instruction not to run the project. No
Node.js module, npm script, test, build, or application runtime was executed.

## What is ready for review

The proposed foundation contains guarded canonical JSON, domain-separated
content hashes, deterministic schema-v1 package loading, primitive/profile
identity, exact supplied-graph canonicalization, bounded connected-skeleton
enumeration, a deterministic CandidateStore, public TypeScript contracts, and
26 JSON Schemas. Pending scientific and closure capabilities fail explicitly;
they do not return placeholder results.

The review boundary is intentionally smaller than the target architecture.
Candidate decoration, expression evaluation, predicates, cohort ranking,
sensitivity execution, source migration/condensation, complete unit algebra,
scientific-oracle validation, explanations, and closure are not implemented.

## Recommended review order

1. Read [Kernel Implementation Status](KERNEL_IMPLEMENTATION_STATUS.md) to fix
   the implemented/pending boundary.
2. Review [Kernel Architecture](KERNEL_ARCHITECTURE.md), especially sections 4,
   8, 9, and 11, as the normative target.
3. Review [Draft/Addendum Omissions](KERNEL_DRAFT_OMISSIONS.md) for the complete
   disposition of source material and the SCC-blocker note.
4. Inspect [ADR-0003](adr/0003-canonical-identity-foundation.md),
   [ADR-0004](adr/0004-refinement-graph-canonicalization.md), and
   [ADR-0005](adr/0005-skeleton-enumeration-and-candidate-store.md).
5. Review `packages/kernel/src/canonical.js`, `hash.js`, and
   `package-loader.js`, then their tests.
6. Review `graph-canonicalizer.js`, `skeleton-enumerator.js`, and
   `candidate-store.js`, then their tests.
7. Compare `packages/kernel/src/index.d.ts` with `packages/schemas/schemas/`.
8. Review the legacy `onto2d.js` change and its characterization fixtures
   separately from the new kernel.

## Decisions that deserve explicit approval

- Evidence provenance remains package-semantic but is excluded from ordinary
  primitive and profile structural identity. Quantity value, unit, tolerance,
  and semantic meaning remain identity-bearing when enabled by policy.
- Source IDs are non-structural by default. A package may opt into structural
  source IDs through the hashed identity policy.
- Candidate and skeleton hashes use separate domains. Skeleton projection is
  undirected, simple, and unlabelled; candidate identity retains direction,
  roles, enabled multiplicity/loops, references, domain, and declared
  structural attributes.
- Graph labeling uses exact refinement plus exhaustive individualization within
  a deterministic search budget. Exhaustion emits no partial identity.
- Partial enumeration/store results are explicitly non-interpretable.
- The current loader accepts only `profileDefinition.kind = "explicit-only"`.
  It rejects source migration and condensed clusters until edge/member
  reconciliation and condensation validation exist.
- Catalogue cycles are resolved by frozen typed classification, node
  resolution, and SCC condensation. No source edge is deleted, no member order
  is invented, and no retroactive blind-classification claim is made.

## Static verification record

The pre-review pass checks all 45 JSON files for parseability, all 26 schema
identifiers and relative references, schema export coverage, relative source
imports, Markdown links/fences, public implementation/type names, source-lock
hashes and sizes, and whitespace errors in the maintained source/documentation
surface outside the preserved catalogue. `git diff --check` is also required
to remain clean.

The locked external draft and addendum match their current files in
`/Users/db/Downloads`. `scr/theory-of-causal-arisings.pdf` is byte-identical to
the former tracked `scr/main.pdf`; `scr/topology-of-arising.pdf` is the newly
analysed foundation source. Both repository PDF hashes and byte sizes match
`cases/level-0-oscillator/source-lock.json`.

## Deferred execution gates

The following commands are the maintainer's first authorized dynamic review
step, in this order:

```sh
npm ci
npm test
npm run check
npm run build
```

Passing them is required before changing ADR-0003, ADR-0004, or ADR-0005 from
“proposed implementation baseline” to accepted. Acceptance also requires an
independent canonical-byte implementation, an independent skeleton-generator
comparison, supported-platform Node.js execution, and review of binary64 and
Unicode edge cases.

## Known review risks

- Exact graph search is intentionally bounded and optimized for at most six
  nodes; highly symmetric inputs can exhaust the budget.
- Unit strings currently receive exact same-unit guards, not dimensional
  parsing or conversion.
- JSON Schema validates record shape but cannot replace executable reference,
  acyclicity, identity, endpoint, unit, and count reconciliation checks.
- Source-migration schemas describe the target contract, while the current
  loader deliberately rejects those inputs until the migration engine exists.
- The tests are present but remain unexecuted in this review package.
