import assert from "node:assert/strict";
import test from "node:test";
import { schemaUrls, SCHEMA_VERSION } from "../../packages/schemas/src/index.js";

test("schema package exposes every initial contract as a file URL", () => {
  assert.equal(SCHEMA_VERSION, "1");
  assert.equal(Object.keys(schemaUrls).length, 53);
  assert.ok(
    schemaUrls.decimalUnroundedAccumulation.pathname.endsWith(
      "decimal-unrounded-accumulation.schema.json"
    )
  );
  assert.ok(
    schemaUrls.candidateEnumerationInput.pathname.endsWith("candidate-enumeration-input.schema.json")
  );
  assert.ok(
    schemaUrls.candidateEnumerationResult.pathname.endsWith("candidate-enumeration-result.schema.json")
  );
  assert.ok(
    schemaUrls.packageCandidateBinding.pathname.endsWith("package-candidate-binding.schema.json")
  );
  assert.ok(
    schemaUrls.predicateGraphEvaluation.pathname.endsWith("predicate-graph-evaluation.schema.json")
  );
  assert.ok(
    schemaUrls.predicateLocalEvaluation.pathname.endsWith("predicate-local-evaluation.schema.json")
  );
  assert.ok(
    schemaUrls.partialPredicateGraph.pathname.endsWith("partial-predicate-graph.schema.json")
  );
  assert.ok(
    schemaUrls.partialPredicateGraphEvaluation.pathname.endsWith(
      "partial-predicate-graph-evaluation.schema.json"
    )
  );
  assert.ok(schemaUrls.element.pathname.endsWith("element.schema.json"));
  assert.ok(
    schemaUrls.primitiveDepthPopulation.pathname.endsWith(
      "primitive-depth-population.schema.json"
    )
  );
  assert.ok(
    schemaUrls.packageCandidateFilterEvaluation.pathname.endsWith(
      "package-candidate-filter-evaluation.schema.json"
    )
  );
  for (const url of Object.values(schemaUrls)) {
    assert.equal(url.protocol, "file:");
    assert.ok(url.pathname.endsWith(".schema.json"));
  }
});
