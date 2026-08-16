# `@onto2d/shacl-validation`

```sh
npm install @onto2d/shacl-validation
```

This browser-safe package validates one exact RDF import artifact against one
exact shapes import artifact. It compiles the shapes graph into an immutable,
hash-bound plan and returns a deterministic validation report.

```js
import { importNTriples } from "@onto2d/rdf-import";
import { validateShacl } from "@onto2d/shacl-validation";

const data = importNTriples(dataSource, { sourceId: "data-v1" });
const shapes = importNTriples(shapesSource, { sourceId: "shapes-v1" });
const report = validateShacl(data, shapes);

console.log(report.conforms, report.reportHash);
```

## Closed profile

`shacl10-core-structural-v1` deliberately implements a small stable SHACL 1.0
Core boundary:

- explicit `sh:NodeShape` and `sh:PropertyShape` declarations;
- `sh:targetNode`, `sh:targetClass`, `sh:targetSubjectsOf`, and
  `sh:targetObjectsOf`;
- one IRI predicate as each property path;
- `sh:minCount`, `sh:maxCount`, `sh:datatype`, `sh:nodeKind`, and `sh:class`;
- `sh:severity`, `sh:message`, and `sh:deactivated`;
- the class traversal required by these SHACL constraints, using only explicit
  `rdf:type` and `rdfs:subClassOf` statements in the data artifact.

The profile rejects implicit shape typing, unreferenced property shapes,
complex paths, custom targets, logical constraints, lists, SPARQL, JavaScript,
rules, draft SHACL 1.2 features, unknown shape predicates, network access, and
external entailment. Cardinality literals use canonical non-negative
`xsd:integer` lexical forms and deactivation uses `true` or `false`.
Datatype constraints are bounded to `xsd:string`, `rdf:langString`,
`xsd:boolean`, `xsd:integer`, `xsd:decimal`, `xsd:float`, and `xsd:double`;
matching literals must also have a valid lexical form. Class traversal accepts
IRI class nodes only and rejects non-IRI `rdf:type` or `rdfs:subClassOf`
endpoints instead of silently ignoring them. Public budgets also bound target
statement scans, shape evaluations, subclass visits, value checks, and results.

`conforms` is false whenever the report contains any validation result,
including warning or information severities. Result, plan, data, and shapes
identities are explicit. A result limit fails closed and never returns a
partial conforming report.

## Semantic boundary

Validation checks RDF graph shape only. It does not assign Onto2D levels,
relation roles, causality, Historical Load, scientific status, or Model Pack
identity. It does not mutate either graph. Crossing from validated RDF into an
Onto2D Model Pack still requires a separate reviewed mapping policy.
