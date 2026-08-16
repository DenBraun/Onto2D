# ADR 0105: Narrow RDF 1.1 import profile

- Status: accepted
- Date: 2026-08-16

## Context

The engine roadmap requires external-model ingestion without importing the
semantics of every source notation into the generic engine. RDF is a useful
interchange boundary, but a generic RDF processor would introduce several
independent concerns at once: syntax families, network dereferencing,
blank-node scope, graph canonicalization, RDFS or OWL inference, SHACL
validation, and domain-specific mapping into Onto2D relations.

RDF 1.1 N-Triples is a stable W3C Recommendation. RDF 1.2 N-Triples is still a
Working Draft on this decision date and adds syntax and term kinds that would
change the parser and artifact model.

## Decision

Add a separate publishable `@onto2d/rdf-import` package. Its first profile is
`rdf11-n-triples-safe-v1`, a bounded subset of RDF 1.1 N-Triples with:

- absolute IRI subjects and predicates;
- absolute IRI, document-scoped blank-node, or literal objects;
- simple, language-tagged, and datatype literals;
- comments, blank lines, LF or CRLF, RDF string escapes, and Unicode escapes;
- ASCII lexical transport and fatal UTF-8 decoding;
- explicit byte, line, statement, line-size, and term-size limits.

The package rejects syntax outside that profile. In particular it rejects
Turtle directives and abbreviations, RDF/XML, relative IRIs, a BOM, raw
non-ASCII transport, and RDF 1.2 version, triple-term, and directional-language
syntax. It never dereferences an IRI.

The import result is a versioned immutable artifact. RDF term and statement IDs
use dedicated canonical hash domains. `graphHash` covers the normalized unique
statement set. `importHash` also covers the exact source hash, source identifier,
and duplicate occurrence lines. Blank-node IDs include the exact source hash as
their scope.

The package may project a verified import artifact into a neutral directed
graph. Subjects and objects become nodes; predicates remain uninterpreted edge
labels. The projection declares that inference is false and Model Pack readiness
is false.

The package uses only the browser-safe canonical kernel subpath. Exporting the
existing raw artifact-byte hash through that subpath changes no hash algorithm,
domain, kernel operation, or frozen identity.

## Consequences

- Equivalent IRI/literal statement sets can share `graphHash` despite line
  order or lexical escape differences, while `importHash` still changes with
  exact source provenance.
- Graphs containing blank nodes have import-local graph identity. This decision
  does not implement RDF Dataset Canonicalization or graph isomorphism.
- Duplicate triples collapse in the RDF graph but retain ordered source-line
  occurrences in the import artifact.
- Imported predicates acquire no Onto2D relation meaning. A separate reviewed
  mapping policy is required before Model Pack construction.
- SHACL validation is implemented as the separate exact-artifact boundary in
  [ADR 0106](0106-closed-shacl-validation-profile.md). It remains distinct from
  semantic mapping and general inference.
- Supporting RDF 1.2, Turtle, RDF/XML, datasets, named graphs, or generalized
  RDF requires a new reviewed profile and format decision.
