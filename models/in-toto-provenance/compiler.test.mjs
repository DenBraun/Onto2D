import assert from "node:assert/strict";
import test from "node:test";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildInTotoAdmissibilityCase } from "../../cases/in-toto-admissibility/extract.mjs";
import { buildInTotoProvenanceRelease, verifyInTotoProvenanceRelease } from "./build.mjs";
import { compileInTotoProvenanceModelPack } from "./compiler.mjs";

test("the in-toto Model Pack compiles deterministically and verifies", async () => {
  const artifact = await buildInTotoAdmissibilityCase();
  const left = compileInTotoProvenanceModelPack(artifact);
  const right = compileInTotoProvenanceModelPack(artifact);
  assert.deepEqual(left, right);
  assert.equal(verifyModelPack(left).manifest.model.id, "in-toto-provenance");
});

test("the committed release equals a clean rebuild", async () => {
  const pack = await buildInTotoProvenanceRelease();
  assert.deepEqual(await verifyInTotoProvenanceRelease(pack), pack);
});

test("native rules and optional command policy remain different node classes", async () => {
  const pack = await buildInTotoProvenanceRelease();
  const nodes = pack.files["model/nodes.json"];
  assert.ok(nodes.some((node) => node.entityKind === "in-toto-artifact-rule" && node.nativePointer));
  const strict = nodes.find((node) => node.id === "constraint:onto2d-exact-command-profile-v1");
  assert.equal(strict.entityKind, "onto2d-mapped-constraint");
  assert.equal(strict.sourceSemantics, "in-toto warning-only");
});

test("actual executions and counterfactual routes cannot collapse", async () => {
  const pack = await buildInTotoProvenanceRelease();
  const nodes = pack.files["model/nodes.json"];
  assert.equal(nodes.filter((node) => node.entityKind === "actual-execution").every((node) => node.actual === true), true);
  assert.equal(nodes.filter((node) => node.scientificStatus === "counterfactual").every((node) => node.actual === false), true);
});

test("link material edges follow signed hashes instead of the nominal step name", async () => {
  const pack = await buildInTotoProvenanceRelease();
  const nodes = new Map(pack.files["model/nodes.json"].map((node) => [node.id, node]));
  const edges = pack.files["model/edges.json"];
  const shortcutPackage = edges.find((edge) => edge.relation === "includes-link" && edge.source === "execution:shortcut").target;
  const shortcutMaterial = nodes.get(edges.find((edge) => edge.relation === "consumes" && edge.source === shortcutPackage && edge.scenarioId === "shortcut").target);
  assert.equal(shortcutMaterial.artifactPath, "src/main.txt");
  const brokenPackage = edges.find((edge) => edge.relation === "includes-link" && edge.source === "execution:material-break" && nodes.get(edge.target).stepName === "package").target;
  const brokenMaterial = nodes.get(edges.find((edge) => edge.relation === "consumes" && edge.source === brokenPackage && edge.scenarioId === "material-break").target);
  assert.equal(brokenMaterial.artifactPath, "build/app.bin");
  const finalArtifact = [...nodes.values()].find((node) => node.typeRole === "final-product");
  assert.notEqual(brokenMaterial.sha256, finalArtifact.sha256);
  assert.equal(brokenMaterial.scientificStatus, "attested");
});
