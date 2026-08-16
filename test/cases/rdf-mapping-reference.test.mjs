import assert from "node:assert/strict";
import test from "node:test";
import { verifyModelPack } from "@onto2d/model-pack";
import { run } from "../../cases/rdf-mapping-reference/run.mjs";

test("the public RDF mapping case replays all frozen evidence exactly", async () => {
  const result = await run({ verify: true });
  assert.equal(result.validation.conforms, true);
  assert.deepEqual(result.mapping.statistics, {
    sourceStatementCount: 10,
    statementCount: 10,
    duplicateStatementCount: 0,
    nodeCount: 3,
    edgeCount: 2,
    labelStatementCount: 3,
    ignoredStatementCount: 2
  });
  assert.equal(result.mapping.statementAccounting.length, result.data.statements.length);
  assert.equal(result.modelPack.manifest.source.auditHash, result.mapping.mappingHash);
  assert.equal(verifyModelPack(result.modelPack).manifest.rootHash, result.modelPack.manifest.rootHash);
});
