# ADR 0106: Closed SHACL validation profile

- Status: accepted
- Date: 2026-08-16

## Context

The external-model roadmap requires validation after RDF import but before any
reviewed mapping into Onto2D semantics. A validator that accepts an arbitrary
SHACL graph would introduce SPARQL execution, extension functions, complex RDF
list traversal, rules, external entailment, and implementation-dependent
results into a boundary whose inputs currently have deterministic identities.

SHACL 1.0 is a stable W3C Recommendation. SHACL 1.2 Core remains a Working
Draft on this decision date. The first validator therefore needs an explicit
stable subset rather than an unversioned claim that future draft features are
supported.

## Decision

Add a separate browser-safe `@onto2d/shacl-validation` package with profile
`shacl10-core-structural-v1`. Both the data graph and shapes graph must already
be verified `RdfImportArtifact` values. The package compiles the exact shapes
artifact into a versioned immutable plan, then produces a versioned immutable
report bound to the exact data import, shapes import, and plan hashes.

The closed profile supports:

- explicitly typed `sh:NodeShape` and `sh:PropertyShape` nodes;
- node, class, subjects-of, and objects-of targets;
- a single IRI predicate path for each property shape;
- minimum and maximum count, datatype, node-kind, and class constraints;
- severity, string messages, and explicit deactivation;
- the `rdf:type/rdfs:subClassOf*` traversal required by SHACL class targets and
  class constraints, using only IRI class nodes in the exact data graph.

Datatype checking includes both datatype identity and valid lexical form. The
first profile admits the bounded set `xsd:string`, `rdf:langString`,
`xsd:boolean`, `xsd:integer`, `xsd:decimal`, `xsd:float`, and `xsd:double`.
Other datatype constraints require a new profile revision.

The package rejects implicit shape typing, import-local blank-node targets,
unreferenced property shapes, complex paths, custom targets, unknown shape
predicates, logical and list-taking constraints, SPARQL, JavaScript, rules,
SHACL 1.2 features, non-IRI class edges, network access, and external
entailment. Resource limits cover shapes, targets, property references,
messages, target statement scans, shape evaluations, value checks, subclass
visits, and results. Exceeding the result limit is a hard failure; no partial
report is returned.

Results have domain-separated content IDs and deterministic order. Repeated
identical findings are represented once. The report's `conforms` field is
false if any result exists, regardless of severity. Runtime verification
recompiles or revalidates and compares the complete canonical artifact; a JSON
Schema match alone is not trusted.

## Consequences

- Validation is reproducible from two exact RDF imports without dereferencing
  either graph or depending on local files, clocks, random state, or a store.
- The required class walk is validation-defined graph traversal, not general
  RDFS or OWL inference and not graph mutation.
- A validation report describes RDF structural conformance only. It assigns no
  Onto2D level, relation kind, causality, Historical Load, scientific status,
  Model Pack root hash, or canonical candidate identity.
- SHACL processors with a larger feature set may accept shapes this profile
  deliberately rejects. Supporting another Core component or datatype changes
  the profile contract and requires tests and review.
- The next external-model boundary is a reviewed mapping contract for a
  concrete use case. It must consume exact import and validation evidence
  without making this generic validator a semantic authority.
