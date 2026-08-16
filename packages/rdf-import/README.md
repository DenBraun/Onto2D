# `@onto2d/rdf-import`

```sh
npm install @onto2d/rdf-import
```

This package implements the narrow read-only RDF import boundary documented in
the engine roadmap. It accepts a bounded RDF 1.1 N-Triples subset and produces
a deterministic, hash-bound import artifact plus an optional neutral graph
projection.

```js
import { importNTriples, projectRdfImportGraph } from "@onto2d/rdf-import";

const artifact = importNTriples(
  '<https://example.test/a> <https://example.test/knows> <https://example.test/b> .\n',
  { sourceId: "example-v1" }
);
const graph = projectRdfImportGraph(artifact);
```

## Supported profile

- RDF 1.1 N-Triples, one triple per line;
- absolute IRI subjects and predicates;
- absolute IRI, document-scoped blank-node, or literal objects;
- simple, language-tagged, and datatype literals;
- LF or CRLF, comments, blank lines, standard string escapes, and Unicode
  `\\u` or `\\U` escapes;
- ASCII lexical transport, with non-ASCII values represented by Unicode
  escapes.

The parser intentionally rejects Turtle directives and abbreviations, RDF/XML,
relative IRIs, invalid UTF-8, a BOM, raw non-ASCII transport, RDF 1.2 `VERSION`
and triple terms, directional language strings, and any input over its public
resource limits.

`graphHash` identifies the normalized statement set. `importHash` additionally
binds exact source bytes, duplicate occurrences, and source identity. Blank
nodes are scoped to the exact source hash; consequently, `graphHash` is an
import-local identity when blank nodes are present, not an RDF dataset
canonicalization or graph-isomorphism result.

## Semantic boundary

The adapter does not dereference IRIs or perform RDFS, OWL, SHACL, or other
inference. The neutral projection treats each predicate as an uninterpreted RDF
edge label. It does not assign Onto2D levels, relation kinds, causality,
historical load, or scientific status, and it does not create a Model Pack.
A reviewed mapping policy is required before imported RDF can cross that
boundary.
