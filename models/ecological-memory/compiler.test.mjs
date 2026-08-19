import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildEcologicalMemoryCase } from "../../cases/ecological-memory/extract.mjs";
import { buildEcologicalMemoryRelease, verifyEcologicalMemoryRelease } from "./build.mjs";
import { compileEcologicalMemoryModelPack, ECOLOGICAL_MEMORY_MAPPING_VERSION } from "./compiler.mjs";

const resign = (artifact) => {
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:ecological-memory-case:v1", basis);
  return artifact;
};

test("the Ecological Memory compiler emits a valid exact Model Pack", async () => {
  const artifact = await buildEcologicalMemoryCase();
  const pack = compileEcologicalMemoryModelPack(artifact);
  assert.equal(verifyModelPack(pack).manifest.model.id, "ecological-memory");
  assert.equal(pack.manifest.model.version, "v1-f4d78af8ab98228a");
  assert.equal(pack.manifest.statistics.nodeCount, 24);
  assert.equal(pack.manifest.statistics.edgeCount, 29);
  assert.equal(pack.files["model/dictionaries.json"].provenance.mappingVersion, ECOLOGICAL_MEMORY_MAPPING_VERSION);
});

test("recorded temporal context never compiles into a causal edge", async () => {
  const pack = compileEcologicalMemoryModelPack(await buildEcologicalMemoryCase());
  const edges = pack.files["model/edges.json"];
  assert.equal(edges.some((edge) => edge.relation === "causes" || edge.causal === true), false);
  const temporal = edges.find((edge) => edge.relation === "recorded-before");
  assert.ok(temporal);
  assert.equal(temporal.causal, false);
  const event = pack.files["model/nodes.json"].find((node) => node.id === "event:creek-fire-record-group");
  assert.equal(event.causalRole, "context-only");
  assert.equal(event.exactTilePerimeterJoin, false);
});

test("projection-relative equality cannot become ecosystem or history identity", async () => {
  const pack = compileEcologicalMemoryModelPack(await buildEcologicalMemoryCase());
  const edge = pack.files["model/edges.json"].find((candidate) => candidate.relation === "declared-equivalent");
  assert.deepEqual([edge.regime, edge.createsFullEcosystemIdentity, edge.createsHistoryIdentity], ["rounded-four-quantile-projection", false, false]);
  const node = pack.files["model/nodes.json"].find((candidate) => candidate.id === "analysis:cell-7880-rounded-signature");
  assert.deepEqual(node.signature, [3, 3.5, 3.8, 4]);
  assert.equal(node.createsFullEcosystemIdentity, false);
  assert.equal(node.createsHistoryIdentity, false);
});

test("the compiled graph keeps measurement, event, interpretation, and boundary layers visible", async () => {
  const pack = compileEcologicalMemoryModelPack(await buildEcologicalMemoryCase());
  const nodes = pack.files["model/nodes.json"];
  assert.equal(nodes.filter((node) => node.entityKind === "survey").length, 2);
  assert.equal(nodes.filter((node) => node.entityKind === "recorded-event").length, 1);
  assert.equal(nodes.filter((node) => node.entityKind === "history-window").length, 3);
  assert.equal(nodes.filter((node) => node.entityKind === "analysis-boundary").length, 4);
  const audit = pack.files["model/dictionaries.json"].audit;
  assert.deepEqual([audit.causalEdges, audit.futurePredictions, audit.recoveryTrajectoryClaims, audit.fullEcosystemIdentityClaims], [0, 0, 0, 0]);
  assert.equal(audit.historicalLoadStatus, "not-evaluated");
});

test("the compiler rejects altered case releases even when the top-level hash is refreshed", async () => {
  const artifact = await buildEcologicalMemoryCase();
  artifact.cellGrid.rows[0][5] += 1;
  assert.throws(() => compileEcologicalMemoryModelPack(resign(artifact)), /not the approved ecological-memory-soap-v1 release/);
});

test("the committed Ecological Memory release remains byte-for-byte reproducible", async () => {
  const expected = await buildEcologicalMemoryRelease();
  const stored = await verifyEcologicalMemoryRelease(expected);
  assert.deepEqual(stored, expected);
  assert.equal(expected.manifest.rootHash, "sha256:63cdc5068c2dd9a8090194b18b8f122859a594f4806cf7f301ffe33d18d3ba4f");
});
