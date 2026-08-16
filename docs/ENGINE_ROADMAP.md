# Engine Roadmap

Updated: 2026-08-16.

## Completed foundation

- deterministic, transparent Model Pack build and verification;
- frozen Causal Emergence source snapshot with exact version resolution;
- headless `Onto2D.create()` facade and stable read/traversal API;
- isolated workspaces with explicit model and run references;
- structural model diff that does not invent lineage;
- content-addressed lineage records checked against exact releases and actual
  structural changes;
- bounded Node.js directory loading with strict entry, encoding, size, and
  integrity checks;
- Canonical Identity as a registered, replayable analysis included by the root
  facade;
- public JavaScript and TypeScript entrypoints with boundary tests.

## Release lifecycle

Before publishing the root facade:

1. independently review the bundled Model Pack golden files and source audit;
2. create a second real release before defining a meaningful `previous` alias
   or committing its reviewed lineage record;
3. decide whether lineage sidecars should become optional manifest-bound files
   in the next Model Pack format revision;
4. decide whether the root package should become publishable or remain an
   integration facade.

## Shared analysis and visualization

1. Keep Historical Load illustrative until empirical values and preprocessing
   are reviewed.
2. Add a small `@onto2d/view` layer for deterministic layouts and verified
   overlays without moving authority into the browser.
3. Build a minimal Studio only after the shared analysis contract is stable:
   model selection, query, neighborhood, comparison, and artifact inspection.

## External models

Start with a narrow RDF import profile, then SHACL validation. Consider OWL,
OntoUML, SysML, ASAM, and SAMM adapters only from concrete reviewed use cases;
do not merge their semantics into the generic engine.

## Operations

Later work includes archive transport with decompression limits, a CLI, browser
and worker adapters, verified caches, remote registries, and lazy presentation
loading. Numerical Level-0 validation,
catalogue migration, an external solver, and empirical Historical Load remain
scientific projects tracked in the [Scientific Roadmap](SCIENTIFIC_ROADMAP.md).
