import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildChemicalSynthesisHistoryCase } from "../../cases/chemical-synthesis-history/extract.mjs";
import { buildChemicalReactionProvenanceRelease, verifyChemicalReactionProvenanceRelease } from "./build.mjs";
import { compileChemicalReactionProvenanceModelPack } from "./compiler.mjs";

test("the chemical reaction Model Pack reproduces its committed release", async () => {
  const pack = await buildChemicalReactionProvenanceRelease();
  assert.deepEqual(verifyModelPack(pack), pack);
  assert.deepEqual(await verifyChemicalReactionProvenanceRelease(pack), pack);
  assert.equal(pack.manifest.model.id, "chemical-reaction-provenance");
  assert.equal(pack.manifest.model.version, "v1-47225e07891b6f70");
});

test("five shared target nodes retain ten distinct reaction records", async () => {
  const pack = await buildChemicalReactionProvenanceRelease();
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  const routeFragments = nodes.filter((node) => node.typeRole === "condition-route-fragment");
  const targetNodes = nodes.filter((node) => node.typeRole === "target");
  assert.equal(routeFragments.length, 10);
  assert.equal(targetNodes.length, 6);
  const sweepProductEdges = edges.filter((edge) => edge.relation === "records-product-identifier" && routeFragments.some((node) => node.id === edge.source));
  assert.equal(sweepProductEdges.length, 10);
  assert.equal(new Set(sweepProductEdges.map((edge) => edge.target)).size, 5);
});

test("derived identifier equality never becomes native batch continuity", async () => {
  const pack = await buildChemicalReactionProvenanceRelease();
  const edges = pack.files["model/edges.json"];
  const shared = edges.filter((edge) => edge.relation === "shares-exact-product-identifier");
  assert.equal(shared.length, 5);
  assert.ok(shared.every((edge) => edge.relationLayer === "derived" && edge.physicalBatchContinuity === false));
  const continuity = edges.filter((edge) => edge.relation === "native-material-continuity");
  assert.deepEqual(continuity.map((edge) => edge.nativeReferenceMultiplicity).sort(), [1, 2]);
  assert.ok(continuity.every((edge) => edge.evidenceClass === "ord-reaction-id-cross-reference"));
});

test("only the actual linked route maps native ORD records", async () => {
  const pack = await buildChemicalReactionProvenanceRelease();
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  const routes = nodes.filter((node) => node.typeRole === "analysis-route");
  assert.equal(routes.length, 4);
  assert.equal(routes.filter((route) => route.actual).length, 1);
  assert.equal(edges.filter((edge) => edge.relation === "maps-record").length, 3);
  assert.ok(edges.filter((edge) => edge.relation === "maps-record").every((edge) => edge.source === "route:ord-cross-referenced-cascade"));
});

test("compiler fails closed when a native source field is mutated", async () => {
  const artifact = await buildChemicalSynthesisHistoryCase();
  artifact.cohorts.conditionSweep.targets[0].routes[0].inputs.catalyst.smiles = "mutated";
  assert.throws(() => compileChemicalReactionProvenanceModelPack(artifact), /route identity was substituted/);
});

test("compiler rejects a re-signed source identity substitution", async () => {
  const artifact = structuredClone(await buildChemicalSynthesisHistoryCase());
  artifact.source.identity = `sha256:${"0".repeat(64)}`;
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:chemical-synthesis-history-case:v1", basis);
  assert.throws(() => compileChemicalReactionProvenanceModelPack(artifact), /source identity was substituted/);
});
