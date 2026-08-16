# RDF-to-Onto2D mapping reference

This reproducible case closes the first reviewed external-model mapping
boundary. It adapts the public W3C SHACL Person and Company teaching example
into a small conforming N-Triples graph, validates that exact graph, maps it by
an exact reviewed policy, and builds a transparent Model Pack.

The chain is:

```text
data.nt + shapes.nt
        -> exact RDF imports
        -> conforming SHACL report
        -> hash-bound mapping policy
        -> complete statement accounting
        -> mapping artifact
        -> verified Model Pack
```

The policy makes the semantic choices visible:

- exact data and shapes source IDs are carried with their import hashes;
- only explicit `rdf:type` selects a Person or Company;
- source IRIs remain node IDs;
- `rdfs:label` becomes the node label;
- `ex:worksFor` becomes a directed `works-for` edge;
- SSN values do not enter the structural Model Pack, but each omitted
  statement ID and the reason remain in the audit;
- every node receives level 0 because this is a flat source layer.

That last choice does not mean kernel Level 0, zero Historical Load, or a
formation result. It means only that this specific external directory has no
reviewed formation hierarchy. The `levelMeaning` field carries that warning on
every node.

The exact source reference, adaptation notice, and license are recorded in
`source-lock.json`, `NOTICE.md`, and the hashed policy provenance. The fixture
is not a W3C conformance test and W3C has not endorsed it.

Regenerate the frozen evidence:

```sh
npm run case:rdf-mapping
```

Verify it without changing files:

```sh
npm run case:rdf-mapping:verify
```
