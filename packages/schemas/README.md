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
- structural projection/metric policies, complete source-bound projections,
  closed geometry requests and exact-replay directed Forman artifacts.
- typed structural selections, experimental local-weight and interval policies,
  replayable metric experiments, incoming-weight audits and their reference suite.
- bounded directed Ollivier policy/input/request/response contracts and
  source-bound artifacts carrying exact transport optimality certificates.
- shadow-flow policies, inputs, source requests, per-step transport requests and
  responses, normalized states and complete certified histories with stopping/cuts.
- provider descriptors, verified-source context bindings, metric/view inputs and
  artifacts, and additive analysis envelopes preserving closed legacy results.
- frozen distinguishability regimes and observable specifications, explicit
  source/scope inputs and unevaluated contract preparations.
- exact canonical directed observations, source mapping witnesses and
  explicit bounded input contracts preserving the original preparations.
- seven-field directed topology observations, source component/reachability
  diagnostics and fixed input bounds under the preserved topology regime.
- joint five-field typed observations with explicit missing evidence, source-bound
  vocabulary mappings and separately authorized compatible/unresolved alignments.

`schemaUrls` is the authoritative exported registry. Repository checks compile
every schema, resolve references, and verify export coverage.

Schema validation checks shape. Runtime verifiers still enforce canonical
identity, cross-record references, arithmetic reconciliation, replay, evidence,
and scientific policy. Passing a schema never turns an unverified object into a
kernel artifact.
