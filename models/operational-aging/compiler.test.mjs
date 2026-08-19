import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildOperationalAgingCase } from "../../cases/operational-aging/extract.mjs";
import { buildOperationalAgingRelease, verifyOperationalAgingRelease } from "./build.mjs";
import { compileOperationalAgingModelPack } from "./compiler.mjs";

test("the Operational Aging Model Pack reproduces its exact release", async () => {
  const pack = await buildOperationalAgingRelease();
  assert.deepEqual(verifyModelPack(pack), pack);
  assert.deepEqual(await verifyOperationalAgingRelease(pack), pack);
  assert.equal(pack.manifest.model.id, "operational-aging");
  assert.match(pack.manifest.model.version, /^v1-[0-9a-f]{16}$/);
});

test("observation, history, and provided-outcome layers remain distinct", async () => {
  const pack = await buildOperationalAgingRelease();
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(nodes.filter((node) => node.entityKind === "endpoint").length, 100);
  assert.equal(nodes.filter((node) => node.entityKind === "trajectory").length, 2);
  assert.equal(nodes.filter((node) => node.entityKind === "provided-outcome").length, 2);
  assert.ok(edges.filter((edge) => edge.relation === "has-provided-outcome").every((edge) => edge.providedRulUsedAsInput === false && edge.predicted === false));
  assert.ok(nodes.filter((node) => node.entityKind === "trajectory").every((node) => node.futureRowsIncluded === false && node.latentHealthObserved === false));
});

test("declared nearness never becomes exact state identity", async () => {
  const pack = await buildOperationalAgingRelease();
  const near = pack.files["model/edges.json"].filter((edge) => edge.relation === "declared-near");
  assert.equal(near.length, 1);
  assert.deepEqual([near[0].rank, near[0].providedRulUsedAsInput, near[0].createsExactStateIdentity], [78, false, false]);
  assert.equal(pack.files["model/nodes.json"].find((node) => node.typeRole === "historical-load-boundary").value, null);
});

test("the compiler rejects a re-signed outcome leak", async () => {
  const artifact = structuredClone(await buildOperationalAgingCase());
  artifact.distanceResults[0].providedRulUsedAsInput = true;
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:operational-aging-case:v1", basis);
  assert.throws(() => compileOperationalAgingModelPack(artifact), /distance results differ/);
});

test("the compiler rejects a fully rehashed endpoint with stale analysis results", async () => {
  const artifact = structuredClone(await buildOperationalAgingCase());
  artifact.endpointCohort[0].settings[0] += 1000;
  const { identity: ignoredEndpointIdentity, ...endpointBasis } = artifact.endpointCohort[0];
  artifact.endpointCohort[0].identity = hashCanonical("onto2d:operational-aging-endpoint:v1", endpointBasis);
  const { caseIdentity: ignoredCaseIdentity, ...caseBasis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:operational-aging-case:v1", caseBasis);
  assert.throws(() => compileOperationalAgingModelPack(artifact), /not the approved operational-aging-fd001-v1 release/);
});
