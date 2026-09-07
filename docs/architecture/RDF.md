# Rdf

Current contracts. Public APIs and schemas are checked by the repository verification suite.

- [Narrow RDF 1.1 import profile](#narrow-rdf-11-import-profile)
- [Closed SHACL validation profile](#closed-shacl-validation-profile)
- [Explicit RDF-to-Model-Pack mapping](#explicit-rdf-to-model-pack-mapping)

<a id="narrow-rdf-11-import-profile"></a>

## Narrow RDF 1.1 import profile

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

<a id="closed-shacl-validation-profile"></a>

## Closed SHACL validation profile

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

<a id="explicit-rdf-to-model-pack-mapping"></a>

## Explicit RDF-to-Model-Pack mapping

Add a browser-safe `@onto2d/rdf-mapping` package with profile
`rdf-to-model-pack-explicit-v1`. It accepts two verified RDF imports, an exact
replayable SHACL report with `conforms: true`, and a canonical mapping policy
bound to the data and shapes source IDs, their import hashes, and the report
hash. Keeping source IDs in the policy is required because they participate in
exact import identity; replay from raw files must not depend on hidden caller
configuration.

The policy must contain source title, stable URI, version, license URI, and an
adaptation notice. It selects nodes only through one directly asserted mapped
`rdf:type`. Nodes keep their source IRIs. One constant non-negative level and
its meaning are declared globally. Class rules assign `typeRole` and
`scientificStatus`. Predicate rules may supply one xsd:string label, a directed
edge with explicit source and target classes, layer, and role, or an ignored
disposition with a reason.

Every mapped class and every label or edge predicate must have active coverage
in the exact compiled SHACL plan. Every data statement must then receive
exactly one `node-type`, `node-label`, `edge`, or `ignored` disposition. Unknown
statements, ambiguous classes or labels, blank-node entities, unmapped edge
endpoints, non-conforming reports, input drift, and unsupported policy fields
fail without a partial artifact.

The mapping artifact preserves complete statement accounting and exact source
term and statement identities. Its Model Pack projection uses the RDF source
hashes, places `mappingHash` in `source.auditHash`, and embeds the complete
policy and mapping audit in dictionaries. Verification replays the mapping and
normal Model Pack construction.

Add `cases/rdf-mapping-reference` as a derived, conforming teaching fixture
from the W3C example. Record the stable Recommendation URL, license, changes,
and non-endorsement notice. SSN statements are explicitly omitted from the
structural pack and remain in the audit. Level 0 means only a flat source layer;
it is not kernel Level 0, Historical Load zero, or a formation claim.
