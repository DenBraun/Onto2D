# Engine Roadmap

Updated: 2026-08-17.

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
  relative pack locations, and verified Studio composition;
- a bounded registry snapshot API and generic Model Studio selector that opens
  both registered models, preserves exact identity in the URL and UI, and
  resets incompatible workspace state at model boundaries;
- a separate content-addressed `live-bootstrap-provenance` Model Pack with
  source provenance on every entity and evidence-classified relation;
- exact-identity lazy presentation sessions with bounded lightweight catalogue
  pages, graph projections, explicit full-record inspection, and verified
  Model Studio composition;
- a narrow browser-safe RDF 1.1 N-Triples import profile with bounded parsing,
  exact source binding, document-scoped blank nodes, deterministic graph
  identity, and a semantics-neutral graph projection;
- a closed browser-safe SHACL 1.0 Core structural profile over exact RDF import
  artifacts, with deterministic compiled plans, bounded class traversal, and
  hash-bound validation reports;
- a reviewed, fail-closed RDF-to-Onto2D mapping profile with exact input
  binding, explicit level and relation policy, complete statement accounting,
  source provenance, a Model Pack bridge, a frozen public reference case, and
  local verified-set import through Model Studio.

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
3. Keep completed cross-model selection separate from version comparison;
   comparison still requires reviewed lineage and compatible artifacts.

## External models

The narrow RDF import, SHACL validation, and first RDF-to-Onto2D mapping
boundaries are complete. `@onto2d/rdf-mapping` consumes exact imports and a
conforming exact report, then applies a hash-bound policy with explicit class,
level, label, relation, omission, and provenance rules. The public W3C-derived
reference case replays the complete chain into a verified Model Pack.
Model Studio exposes the same chain for an exact local data, shapes, and policy
set; it does not accept unreviewed RDF as an Onto2D model or publish the result.

The reference proves the engineering contract, not an empirical or domain
mapping claim. A second mapping must begin with a concrete independently
reviewed dataset and domain policy; only then should the profile be generalized
or a dedicated OWL, OntoUML, SysML, ASAM, or SAMM adapter be considered. Their
semantics must not enter the generic importer, validator, mapper, or engine.

The live-bootstrap provenance case is a second registered external model with
a different schema vocabulary. It validates generic selection and presentation
boundaries without mixing external entities into Causal Emergence. Its focused
Explorer and finite analysis remain application/case concerns rather than
generic engine semantics.

## Operations

The first operations milestones are the read-only `@onto2d/cli`, strict local
ZIP transport, the bounded browser Model Pack adapter, and an explicit worker
protocol built on that stable browser contract. The verified cache milestone
is also complete, including Model Studio integration without making storage a
trust boundary. The narrow read-only remote registry is also complete: it
resolves only explicit model/version pairs and stays separate from loading and
verification. Lazy presentation loading for large verified models is complete
at the presentation boundary; it does not pretend that Model Pack v1 has
independently verifiable semantic chunks. A physical chunked transport requires
a reviewed Model Pack format revision. The next format-level engineering
milestone is a Model Pack v2 proposal for manifest-bound optional artifacts and
independently verifiable semantic chunks. It must settle lineage sidecars,
chunk identity, complete-model verification, and v1 compatibility before code
or release fixtures are changed.
Numerical Level-0 validation,
catalogue migration, generalization and independent comparison of the external
solver, and empirical Historical Load remain scientific projects tracked in
the [Scientific Roadmap](SCIENTIFIC_ROADMAP.md).
