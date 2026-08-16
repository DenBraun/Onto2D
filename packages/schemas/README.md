# `@onto2d/schemas`

JSON Schema Draft 2020-12 contracts for Onto2D inputs and artifacts.

```sh
npm install @onto2d/schemas
```

```js
import { schemaUrls } from "@onto2d/schemas";

console.log(schemaUrls.candidate.href);
```

The package covers:

- ontology, primitives, profiles, candidates, graph policy, and run config;
- quantities, expressions, predicates, evaluations, and witnesses;
- enumeration, pruning, censuses, null models, selection, and closure;
- explanations, semantic run bundles, persistence receipts, and execution
  records;
- source-classification and reviewed migration artifacts.
- bounded RDF import artifacts and semantics-neutral graph projections;
- deterministic SHACL validation plans and exact-input reports;
- reviewed RDF-to-Onto2D policies and complete statement-accounting artifacts.

`schemaUrls` is the authoritative exported registry. Repository checks compile
every schema, resolve references, and verify export coverage.

Schema validation checks shape. Runtime verifiers still enforce canonical
identity, cross-record references, arithmetic reconciliation, replay, evidence,
and scientific policy. Passing a schema never turns an unverified object into a
kernel artifact.
