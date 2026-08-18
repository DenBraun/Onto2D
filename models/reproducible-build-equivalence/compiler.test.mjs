import assert from "node:assert/strict";
import test from "node:test";
import { hashCanonical } from "@onto2d/kernel";
import { verifyModelPack } from "@onto2d/model-pack";
import { buildReproducibleBuildEquivalenceCase } from "../../cases/reproducible-build-equivalence/extract.mjs";
import { buildReproducibleBuildEquivalenceRelease, verifyReproducibleBuildEquivalenceRelease } from "./build.mjs";
import { compileReproducibleBuildEquivalenceModelPack } from "./compiler.mjs";

test("the Reproducible Build Equivalence Model Pack reproduces its committed release", async () => {
  const pack = await buildReproducibleBuildEquivalenceRelease();
  assert.deepEqual(verifyModelPack(pack), pack);
  assert.deepEqual(await verifyReproducibleBuildEquivalenceRelease(pack), pack);
  assert.equal(pack.manifest.model.id, "reproducible-build-equivalence");
  assert.match(pack.manifest.model.version, /^v1-[0-9a-f]{16}$/);
});

test("four histories retain two outputs and two captured toolchains", async () => {
  const pack = await buildReproducibleBuildEquivalenceRelease();
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  assert.equal(nodes.filter((node) => node.typeRole === "execution-history").length, 4);
  assert.equal(nodes.filter((node) => node.typeRole === "specified-output").length, 2);
  assert.equal(nodes.filter((node) => node.typeRole === "toolchain").length, 2);
  assert.equal(edges.filter((edge) => edge.relation === "produces").length, 4);
});

test("the complete three by five verdict matrix remains regime-relative", async () => {
  const pack = await buildReproducibleBuildEquivalenceRelease();
  const verdicts = pack.files["model/nodes.json"].filter((node) => node.typeRole === "regime-verdict");
  assert.equal(verdicts.length, 15);
  assert.equal(verdicts.filter((node) => node.equal).length, 9);
  assert.equal(verdicts.filter((node) => !node.equal).length, 6);
  assert.equal(verdicts.filter((node) => node.regimeId === "provenance" && node.equal).length, 0);
});

test("the environment exclusion and undefined Historical Load remain explicit", async () => {
  const pack = await buildReproducibleBuildEquivalenceRelease();
  const nodes = pack.files["model/nodes.json"];
  const environment = nodes.find((node) => node.id === "regime:environment");
  assert.deepEqual(environment.excludedFields, ["environment.observedIrrelevant.ONTO2D_SESSION_LABEL"]);
  const boundary = nodes.find((node) => node.typeRole === "historical-load-boundary");
  assert.equal(boundary.value, null);
  assert.equal(nodes.some((node) => node.typeRole === "historical-load-result"), false);
});

test("the compiler fails closed when a derived verdict is mutated", async () => {
  const artifact = structuredClone(await buildReproducibleBuildEquivalenceCase());
  artifact.comparisons[0].regimes[0].equal = false;
  assert.throws(() => compileReproducibleBuildEquivalenceModelPack(artifact), /history-equivalence results were substituted/);
});

test("the compiler rejects a re-signed derived-field substitution", async () => {
  const artifact = structuredClone(await buildReproducibleBuildEquivalenceCase());
  artifact.comparisons[0].regimes[0].differingFields = ["invented-review-field"];
  const { caseIdentity: ignored, ...basis } = artifact;
  artifact.caseIdentity = hashCanonical("onto2d:reproducible-build-equivalence-case:v1", basis);
  assert.throws(() => compileReproducibleBuildEquivalenceModelPack(artifact), /history-equivalence results were substituted/);
});
