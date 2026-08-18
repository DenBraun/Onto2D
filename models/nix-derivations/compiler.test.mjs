import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildNixDerivationCase } from "../../cases/nix-derivation-identity/extract.mjs";
import {
  buildNixDerivationsRelease,
  verifyNixDerivationsRelease
} from "./build.mjs";
import { compileNixDerivationsModelPack } from "./compiler.mjs";

const CASE_DOMAIN = "onto2d:nix-derivation-identity-case:v1";

function resignCase(artifact) {
  const { caseIdentity: _caseIdentity, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical(CASE_DOMAIN, basis);
  return artifact;
}

test("the Nix Model Pack is valid, separate, and boundary-explicit", async () => {
  const pack = await buildNixDerivationsRelease();
  assert.deepEqual(verifyModelPack(pack), pack);
  assert.equal(pack.manifest.model.id, "nix-derivations");
  assert.equal(pack.manifest.statistics.nodeCount, 25);
  assert.equal(pack.manifest.statistics.edgeCount, 40);
  assert.match(pack.manifest.model.version, /^v1-[0-9a-f]{16}$/);
  assert.equal(pack.files["model/dictionaries.json"].provenance.derivationBuildersExecuted, false);
  assert.equal(pack.files["model/dictionaries.json"].presentation.boundary.note.includes("Historical Load remain"), true);
  assert.equal(
    pack.files["model/nodes.json"].find((node) => node.entityKind === "nix-output" && node.contentIdentity)?.name,
    "onto2d-identical-output"
  );
});

test("native direct inputs and derived closure remain different relations", async () => {
  const pack = await buildNixDerivationsRelease();
  const edges = pack.files["model/edges.json"];
  assert.equal(edges.filter((edge) => edge.relation === "inputDrv").length, 8);
  assert.equal(edges.filter((edge) => edge.relation === "transitive-inputDrv").length, 5);
  assert.equal(edges.filter((edge) => edge.relation === "inputDrv").every((edge) => edge.relationLayer === "native"), true);
  assert.equal(edges.filter((edge) => edge.relation === "transitive-inputDrv").every((edge) => edge.relationLayer === "derived"), true);
  assert.equal(edges.some((edge) => edge.relation === "produces-output"), false);
  assert.equal(edges.filter((edge) => edge.relation === "declares-output").length, 9);
});

test("the committed content-addressed release reproduces exactly", async () => {
  const pack = await buildNixDerivationsRelease();
  const verified = await verifyNixDerivationsRelease(pack);
  assert.equal(verified.manifest.rootHash, pack.manifest.rootHash);
});

test("compiler rejects substituted case identities and capture boundaries", async () => {
  const artifact = await buildNixDerivationCase();
  const substituted = structuredClone(artifact);
  substituted.caseIdentity = `sha256:${"0".repeat(64)}`;
  assert.throws(() => compileNixDerivationsModelPack(substituted), /case identity (?:differs|does not match)/);

  const widened = structuredClone(artifact);
  widened.captureBoundary.derivationBuildersExecuted = true;
  assert.throws(() => compileNixDerivationsModelPack(widened), /case identity (?:differs|does not match)|unsupported execution boundary/);
});

test("compiler rejects internally signed graph and output substitutions", async () => {
  const artifact = await buildNixDerivationCase();
  const missingEdge = structuredClone(artifact);
  missingEdge.dependencyGraph.directEdges.shift();
  resignCase(missingEdge);
  assert.throws(() => compileNixDerivationsModelPack(missingEdge), /native dependency graph omits/);

  const substitutedOutput = structuredClone(artifact);
  substitutedOutput.dependencyGraph.outputMappings[0].path = substitutedOutput.dependencyGraph.outputMappings[1].path;
  resignCase(substitutedOutput);
  assert.throws(() => compileNixDerivationsModelPack(substitutedOutput), /output mapping differs/);
});
