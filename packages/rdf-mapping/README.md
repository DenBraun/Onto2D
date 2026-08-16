# `@onto2d/rdf-mapping`

```sh
npm install @onto2d/rdf-mapping
```

This package is the reviewed semantic boundary between exact RDF evidence and
an Onto2D Model Pack. It consumes verified `RdfImportArtifact` values and an
exact conforming `ShaclValidationReport`. It does not parse RDF, run network
requests, perform inference, or extend SHACL.

The first profile is intentionally narrow:

- entities are selected only by an explicit `rdf:type` statement;
- entity IDs remain their source IRIs;
- one constant level and its meaning are declared by policy;
- node classes declare `typeRole` and `scientificStatus`;
- predicates become one label, directed edges, or reviewed omissions;
- mapped classes and predicates require active SHACL coverage;
- every source statement receives exactly one recorded disposition;
- ignored statements retain their IDs, predicates, and review reasons.

```js
import { validateShacl } from "@onto2d/shacl-validation";
import {
  buildRdfMappedModelPack,
  createRdfMappingPolicy,
  mapRdfToOnto2D
} from "@onto2d/rdf-mapping";

const report = validateShacl(data, shapes);
const policy = createRdfMappingPolicy({
  schemaVersion: "1",
  format: "onto2d-rdf-mapping-policy",
  formatVersion: "1",
  profile: "rdf-to-model-pack-explicit-v1",
  id: "people-directory-v1",
  provenance: {
    title: "Reviewed people directory",
    sourceUri: "https://example.test/directory",
    sourceVersion: "1.0.0",
    licenseUri: "https://example.test/license",
    adaptation: "No adaptation; direct mapping of the reviewed source."
  },
  inputs: {
    dataSourceId: data.source.id,
    shapesSourceId: shapes.source.id,
    dataImportHash: data.importHash,
    shapesImportHash: shapes.importHash,
    validationReportHash: report.reportHash
  },
  levelPolicy: {
    kind: "constant",
    value: 0,
    meaning: "Flat source layer; not an inferred formation depth."
  },
  nodeRules: [{
    classIri: "https://example.test/Person",
    typeRole: "Person",
    scientificStatus: "external-reference"
  }],
  predicateRules: [{
    predicateIri: "https://example.test/name",
    action: "label",
    required: true
  }]
});

const mapping = mapRdfToOnto2D(data, shapes, report, policy);
const pack = buildRdfMappedModelPack(data, shapes, report, policy, {
  id: "people-directory",
  name: "People directory",
  version: "1.0.0"
});
```

The source IDs are part of the exact import identity. Keeping them in the
policy makes a reviewed set of raw `data.nt`, `shapes.nt`, and
`mapping-policy.json` independently replayable without hidden configuration.

`level: 0` in the example is a reviewed source-layer statement. It does not
claim that the imported records have passed the Onto2D formation kernel or
that their Historical Load is zero. The mapping policy and complete statement
accounting remain inside the generated Model Pack dictionaries, while node and
edge records retain exact source term and statement IDs.
