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
- dependency-free `@onto2d/view` catalogue and neighborhood projections with
  deterministic SVG-ready layout;
- initial Model Studio over the exact bundled release with query, local graph,
  source-record inspection, and full in-browser Model Pack verification;
- public JavaScript and TypeScript entrypoints with boundary tests;
- read-only CLI for bounded local pack verification, node inspection,
  neighborhoods, and shortest-path queries;
- strict local ZIP32 transport with bounded decompression and shared
  file-or-directory dispatch;
- browser-safe bounded loading for split HTTP Model Packs and raw bundle
  `Blob` or byte sources, with strict response validation and full pack
  reconstruction;
- versioned browser-worker Model Pack verification with bounded concurrency,
  cancellation, explicit byte-transfer semantics, stable errors, and a
  reproducibly checked self-contained Studio worker asset;
- browser-safe verified Model Pack caching keyed by exact release identity,
  with canonical immutable records, verify-on-read and verify-before-write,
  bounded IndexedDB storage, and deterministic eviction;
- a browser-safe read-only Model Pack registry with explicit model/version
  selection, content-hash pinning, exact release resolution, same-origin
  relative pack locations, and verified Studio composition.

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
2. Keep `@onto2d/view` limited to deterministic presentation projections;
   Model Pack verification and scientific interpretation stay upstream.
3. Extend Studio with model selection, comparison, and artifact inspection
   when a second real release, reviewed lineage, and further registered
   analysis artifacts exist.

## External models

Start with a narrow RDF import profile, then SHACL validation. Consider OWL,
OntoUML, SysML, ASAM, and SAMM adapters only from concrete reviewed use cases;
do not merge their semantics into the generic engine.

## Operations

The first operations milestones are the read-only `@onto2d/cli`, strict local
ZIP transport, the bounded browser Model Pack adapter, and an explicit worker
protocol built on that stable browser contract. The verified cache milestone
is also complete, including Model Studio integration without making storage a
trust boundary. The narrow read-only remote registry is also complete: it
resolves only explicit model/version pairs and stays separate from loading and
verification. The next operations milestone is lazy presentation loading for
large verified models.
Numerical Level-0 validation,
catalogue migration, generalization and independent comparison of the external
solver, and empirical Historical Load remain scientific projects tracked in
the [Scientific Roadmap](SCIENTIFIC_ROADMAP.md).
