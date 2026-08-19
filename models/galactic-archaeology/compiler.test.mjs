import assert from "node:assert/strict";
import test from "node:test";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildGalacticArchaeologyCase } from "../../cases/galactic-archaeology/extract.mjs";
import { compileGalacticArchaeologyModelPack } from "./compiler.mjs";

test("the Galactic Archaeology compiler is deterministic and produces a valid Model Pack", async () => {
  const artifact = await buildGalacticArchaeologyCase();
  const first = compileGalacticArchaeologyModelPack(artifact);
  const second = compileGalacticArchaeologyModelPack(artifact);
  assert.deepEqual(first, second);
  assert.deepEqual(verifyModelPack(first), first);
  assert.deepEqual(first.manifest.statistics, { nodeCount: 83, edgeCount: 437 });
});

test("the graph keeps every epistemic layer and quality regime visible", async () => {
  const pack = compileGalacticArchaeologyModelPack(await buildGalacticArchaeologyCase());
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(nodes.filter(({ entityKind }) => entityKind === "stellar-source").length, 64);
  assert.deepEqual(nodes.filter(({ entityKind }) => entityKind === "evidence-layer").sort((left, right) => left.layerOrder - right.layerOrder).map(({ typeRole }) => typeRole), ["observed", "gaia-derived", "published-derived", "onto2d-classified", "publication-context"]);
  assert.equal(edges.filter(({ relation, target }) => relation === "included-in-quality-view" && target === "quality:high").length, 32);
  assert.ok(edges.filter(({ relation }) => relation === "estimates-orbit-for").every(({ directObservation, uncertaintyRetained }) => !directObservation && uncertaintyRetained));
});

test("the compiled graph contains no origin, ancestry, causal, or native-label promotion", async () => {
  const pack = compileGalacticArchaeologyModelPack(await buildGalacticArchaeologyCase());
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(edges.some(({ relation }) => ["born-in", "descends-from", "shares-ancestry-with", "causes"].includes(relation)), false);
  assert.equal(nodes.some((node) => node.birthOriginClaim || node.commonAncestryClaim || node.singleFormationHistoryClaim || node.nativeGaiaPopulationLabel), false);
  assert.deepEqual(pack.files["model/dictionaries.json"].audit, {
    ...pack.files["model/dictionaries.json"].audit,
    directObservationOrbitPromotions: 0,
    nativeGaiaPopulationLabelsInvented: 0,
    birthOriginClaims: 0,
    commonAncestryClaims: 0,
    causalEdges: 0,
    liveQueriesDuringBuild: 0,
    historicalLoadStatus: "not-evaluated"
  });
});

test("the compiler rejects a rehashed or unapproved case mutation", async () => {
  const artifact = structuredClone(await buildGalacticArchaeologyCase());
  artifact.records[0].assignment.birthOriginClaim = true;
  assert.throws(() => compileGalacticArchaeologyModelPack(artifact), /case identity differs from content/);
});
