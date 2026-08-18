# Project Structure

## Dependency direction

```text
applications and cases
        |
        v
 cli + engine + model-pack + rdf-mapping + adapters + solvers + run-store
       |       |              |          |
       v       v              v          v
      view   kernel + schemas + shacl-validation + rdf-import + kernel/canonical
```

Dependencies point inward. `@onto2d/kernel` has no package dependencies and
must not import adapters, filesystem code, UI code, catalogue formats, or
scientific implementations. Schemas describe transport shapes; runtime code
still verifies cross-record and semantic invariants.

`@onto2d/engine` is catalogue-independent. A facade or application supplies
verified Model Packs; the private root facade supplies the bundled Causal
Emergence snapshot.

## Ownership

| Location | Owns |
|---|---|
| `packages/kernel` | Deterministic semantic execution and verification |
| `packages/cli` | Read-only local Model Pack verification and engine queries |
| `packages/schemas` | Versioned external data shapes |
| `packages/model-pack` | Canonical releases, bounded verification transports, workers, verified caching, and read-only registry resolution |
| `packages/engine` | Headless model access, traversal, workspaces, analyses, diff, and verified presentation composition |
| `packages/canonical-identity-analysis` | Replayable kernel-backed identity analysis |
| `packages/view` | Deterministic presentation projections, lazy pages, explicit inspection, and graph layout |
| `packages/rdf-import` | Bounded RDF 1.1 import artifacts and semantics-neutral graph projection |
| `packages/shacl-validation` | Closed SHACL 1.0 Core validation plans and reports over exact RDF imports |
| `packages/rdf-mapping` | Reviewed RDF-to-Onto2D policies, complete statement accounting, and Model Pack projection |
| `packages/catalog-adapter` | Catalogue loading, audit, and reviewed migration replay |
| `packages/scientific-adapter` | Interface for external numerical implementations |
| `packages/level-zero-solver` | Bounded Phase-B numerical implementation outside the kernel |
| `packages/run-store` | Filesystem persistence of verified run bundles and execution records |
| `cases` | Source locks, case rules, reproducible scripts, and frozen results |
| `apps` | Explanatory studies and model readers over disclosed or versioned inputs |
| `models` | Reproducible, reviewed Model Pack releases and their compilers |
| `src` | Private root facade that composes the engine with bundled releases |
| `scr` | Preserved source catalogue and reference material |
| `scripts` | Repository checks and independent conformance tooling |
| `tools` | Standalone local prototypes that remain independent of case interpretation |
| `test` | Behavioral, schema, integration, case, and golden evidence |
| `docs/adr` | Accepted architectural decisions |
| `docs/history` | Authoritative History Model taxonomy, portfolio, evidence, identity, reachability, and reconstruction documentation |
| `docs/cases` | Canonical case-specific implementation plans |
| `docs/external-cases` | Compatibility pointers for the superseded software-first program paths |

## Boundary rules

- Source data in `scr/` is not edited to satisfy an audit.
- The CLI composes public loader and engine APIs; it does not bypass pack verification.
- Directory, ZIP, and HTTP transport metadata never changes Model Pack semantic identity.
- Cache records are verified before use; storage and eviction metadata never
  changes Model Pack semantic identity.
- Registry selection is explicit and its paths remain below the registry
  origin; registry metadata never changes Model Pack semantic identity.
- A registry-backed application may list releases only from a validated,
  hash-pinned snapshot and must re-verify the selected pack before activation.
- External source facts, deterministic derivations, and project analysis use
  distinct records and identities; counterfactual edges never enter extracted
  upstream evidence or an upstream/derived-only Model Pack.
- External case overview pages may describe planned work, but must expose its
  status and must not present a plan, expected output, or flagship experiment
  as a completed result.
- Cases may call the kernel but must not add case-specific branches to it.
- Scientific solvers may implement adapter contracts but must not import the kernel.
- Applications do not become authorities for scientific values or canonical
  identity; they project disclosed models or tested artifacts.
- View layouts are derived presentation output and never enter model identity.
- Lazy presentation may omit non-visible records, but complete semantic
  execution must use a fully materialized and verified Model Pack.
- RDF import preserves RDF terms and predicates without assigning Onto2D
  levels, relation kinds, causality, or Model Pack readiness. Crossing that
  boundary requires a separate reviewed mapping policy.
- Blank-node identities are local to one exact RDF source hash and never merge
  implicitly across imports.
- SHACL validation binds exact data and shapes imports, performs only its
  declared Core constraints and class traversal, and never implies an
  RDF-to-Onto2D semantic mapping.
- RDF mapping consumes only exact imports and a conforming exact SHACL report;
  its policy carries both source IDs and all exact input hashes, declares
  source, level, class, relation, and omission policy, and accounts for every
  source statement before building a Model Pack.
- Model Pack indexes are derived accelerators and never authority over the
  canonical model files.
- Operational metadata such as timestamps and resource use does not enter
  semantic hashes.
- Generated run output belongs in ignored `runs/`; only reviewed fixtures are
  committed.
- A neutral tool must not import the engine or acquire case-specific analysis
  vocabulary merely because one case is its first consumer.

Use an ADR when a change affects canonical identity, evidence semantics,
scientific trust boundaries, or dependency direction.
