import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildLteeEvolutionaryContingencyCase } from "../../cases/ltee-evolutionary-contingency/extract.mjs";
import { compileLteeLineageHistoryModelPack } from "./compiler.mjs";

test("LTEE Lineage History compiles deterministically into a valid Model Pack", async () => {
  const artifact = await buildLteeEvolutionaryContingencyCase();
  const first = compileLteeLineageHistoryModelPack(artifact);
  const second = compileLteeLineageHistoryModelPack(artifact);
  assert.deepEqual(first, second);
  assert.equal(verifyModelPack(first).manifest.rootHash, first.manifest.rootHash);
  assert.equal(first.manifest.model.id, "ltee-lineage-history");
  assert.equal(first.manifest.statistics.nodeCount, 73);
  assert.equal(first.manifest.statistics.edgeCount, 150);
});

test("compiled graph keeps exact replay contexts and bounded observations", async () => {
  const pack = compileLteeLineageHistoryModelPack(await buildLteeEvolutionaryContingencyCase());
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "source-background").length, 16);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "replay-protocol").length, 3);
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "replay-observation").length, 38);
  assert.equal(edges.filter(({ relation }) => relation === "starts-from").length, 38);
  assert.equal(edges.filter(({ relation }) => relation === "runs-under").length, 38);
  assert.equal(edges.filter(({ relation }) => relation === "tests-accessibility-of").length, 38);
  const replayTwoGeneration32000 = "observation:replay-2:g-32000";
  assert.deepEqual(
    edges.filter(({ source }) => source === replayTwoGeneration32000).map(({ relation, target }) => [relation, target]).sort(),
    [["runs-under", "protocol:replay-2"], ["starts-from", "background:ara-3:g-32000"], ["tests-accessibility-of", "phenotype:aerobic-citrate-use"]]
  );
  assert.ok(edges.every(({ causal, genealogical }) => causal === false && genealogical === false));
  assert.ok(nodes.filter(({ entityKind }) => entityKind === "replay-observation").every(({ impossibilityClaim, outcomeFrequencyClaim }) => !impossibilityClaim && !outcomeFrequencyClaim));
});

test("compiled source statistics expose rather than repair the replay-2 discrepancy", async () => {
  const pack = compileLteeLineageHistoryModelPack(await buildLteeEvolutionaryContingencyCase());
  const nodes = pack.files["model/nodes.json"];
  const discrepancy = nodes.find(({ id }) => id === "discrepancy:replay-2-expected-mean");
  assert.deepEqual([discrepancy.publishedExpectedMeanGeneration, discrepancy.tableOneReplicateWeightedMeanGeneration, discrepancy.silentCorrectionApplied], [28382, 26382, false]);
  assert.deepEqual(nodes.filter(({ entityKind }) => entityKind === "published-statistic").map(({ pValueRecomputed }) => pValueRecomputed), [false, false, false]);
  assert.equal(pack.files["model/dictionaries.json"].audit.sourceDiscrepanciesSilentlyCorrected, 0);
});

test("compiler rejects a changed case even when its outer hash is recomputed", async () => {
  const artifact = structuredClone(await buildLteeEvolutionaryContingencyCase());
  artifact.audit.impossibilityClaims = 1;
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:ltee-evolutionary-contingency-case:v1", basis);
  assert.throws(() => compileLteeLineageHistoryModelPack(artifact), /not the approved release/);
});
