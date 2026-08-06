# Kernel Implementation Status

Status: deterministic package and graph-identity foundation implemented;
execution not performed for this change; closure pipeline pending.

## Implemented boundary

`@onto2d/kernel` now has its first executable layer:

- `canonical.js` converts plain JSON-compatible values to guarded canonical
  bytes, normalizes negative zero, rejects non-finite numbers, cycles,
  accessors, sparse arrays, invalid Unicode, prototype-sensitive keys, and
  configured resource-limit violations;
- `hash.js` frames versioned Onto2D domains before SHA-256 hashing and produces
  `sha256:<hex>` content identifiers and canonical forms;
- `errors.js` defines stable `code`, `stage`, `message`, and structured
  `details` contracts;
- `package-loader.js` materializes deterministic defaults, validates and
  normalizes a schema-v1 `RulePackage`, resolves claim/evidence and
  selector/functional/cohort references, rejects current-depth predicate
  references and ontology-phase cycles, computes explicit profile and ordinary
  primitive identities, and emits package/rules/depth-basis/identity-policy
  hashes;
- `graph-canonicalizer.js` validates supplied candidates and graph policy,
  applies exact 1-WL refinement plus deterministic individualization search,
  derives canonical unlabeled simple skeletons, emits domain-separated
  candidate/skeleton identities, and preserves reversible node/edge mappings;
- `skeleton-enumerator.js` exhaustively visits the bounded labelled simple-graph
  universe, rejects disconnected inputs, deduplicates canonical skeletons, and
  emits explicit completion or budget-exhaustion state;
- `candidate-store.js` fixes one counting domain and canonicalization policy,
  admits one canonical representative, counts duplicates, sorts snapshots by
  candidate ID, and requires explicit successful finalization for
  interpretability;
- `kernel.js` exposes `createKernel().loadPackage()`,
  graph/skeleton canonicalization, connected-skeleton enumeration,
  CandidateStore creation, and a truthful capability manifest.

The loader requires at least one primitive and currently requires every
primitive profile to be explicit. Declarative `profileDefinition` derivation is
not silently simulated. Unit strings are preserved and same-unit guards are
enforced where the bootstrap compares values; full unit grammar and conversion
algebra remain R1 work.

Quantity evidence is preserved in the normalized package and therefore changes
the package identity, while ordinary primitive and profile structural identity
uses value, unit, tolerance, and semantic meaning without evidence provenance.
The Oracle, sensitivity-report, and normalized-run schemas and public types are
aligned with the normative contracts, but their evaluators are not implemented.

## Identity flow

```text
RulePackage
  -> guarded canonical clone
  -> deterministic defaults
  -> structural/reference validation
  -> normalized profiles -> profile hashes
  -> primitive structural payloads -> element IDs
  -> primitive ID set + identity policy -> depth-basis hash
  -> rules/configuration -> rules hash
  -> normalized package -> package ID
```

```text
CandidateInput + GraphPolicy
  -> guarded canonical clone
  -> contract, resource, and connectivity validation
  -> structural attribute projection
  -> unlabeled simple skeleton canonicalization -> SkeletonId
  -> directed role-labelled refinement/individualization
  -> canonical Candidate + reversible input mappings -> CandidateId
```

Only declared structural attributes enter candidate identity. Direction, role,
parallel multiplicity, enabled self-loops, node references, counting domain,
and the derived skeleton remain structural. Policy flags that only decide
admissibility do not change the identity of a graph accepted under multiple
policies. The exact decision and resource limits are recorded in
[ADR-0004](adr/0004-refinement-graph-canonicalization.md).

The enumerator and store state/budget semantics are recorded in
[ADR-0005](adr/0005-skeleton-enumeration-and-candidate-store.md). Their
reference fixtures have not yet been executed or compared with an independent
generator.

Source IDs, claims, and evidence do not enter ordinary primitive structural
identity by default. The provisional cluster identity branch binds the frozen
classification policy, node-resolution artifact, condensation artifact, and
disposition rather than review timestamps or annotator identity. It remains
unreachable until migration reconciliation is implemented. The exact
provisional decision is recorded in
[ADR-0003](adr/0003-canonical-identity-foundation.md).

The schemas already describe classified relations and condensed clusters, but
the foundation loader rejects `sourceMigration` and condensed-cluster inputs
with explicit `SOURCE_*_FOUNDATION_UNAVAILABLE` issues. They cannot be loaded
until exact member/edge reconciliation and condensation validation exist.

## Explicitly pending

- candidate decoration, partial streaming/pruning, and the integrated generator
  state machine;
- typed expression analysis and predicate evaluation;
- cohort construction and functional ranking;
- sensitivity, baselines, profiles derived from rules, closure, and ladder
  execution;
- source-classification/condensation execution;
- explanation and artifact indexes;
- complete unit algebra and external scientific-oracle validation.

Calls to public pending operations throw `KERNEL_NOT_IMPLEMENTED`. They never
return an empty or fabricated scientific result.

## Verification status

Canonical JSON, loader, and graph tests were added for determinism, domain
separation, unsafe values, stable package/depth identities, 30 independently
permuted graph pairs, non-isomorphic negatives, structural attributes,
reversible mappings, connected-skeleton reference counts, candidate-store
deduplication/order, policy failures, generator/canonicalization budgets,
current-depth rejection, phase-cycle rejection, missing references, and
unavailable closure.
Per the instruction for this change, the project, test runner, and JavaScript
modules were not executed. These tests remain awaiting the next authorized
Node.js verification pass and independent canonical-byte review.
