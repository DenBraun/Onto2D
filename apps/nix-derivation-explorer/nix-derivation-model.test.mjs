import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createNixDerivationModel } from "./nix-derivation-model.js";

const artifact = JSON.parse(await readFile(new URL("../../cases/nix-derivation-identity/artifacts/nix-derivation-identity.json", import.meta.url), "utf8"));

test("browser model validates the pinned bounded Nix artifact", () => {
  const model = createNixDerivationModel(artifact);
  assert.equal(model.statistics.derivationCount, 9);
  assert.equal(model.statistics.directEdgeCount, 8);
  assert.equal(model.statistics.closureEdgeCount, 5);
  assert.equal(model.statistics.comparisonCount, 4);
  assert.equal(Object.isFrozen(model.derivations[0]), true);
});

test("flagship result keeps content and construction identities separate", () => {
  const model = createNixDerivationModel(artifact);
  const comparison = model.comparison("same-content-different-derivation");
  assert.equal(comparison.results["output-content"].equal, true);
  assert.equal(comparison.results.derivation.equal, false);
  assert.equal(comparison.results["input-closure"].equal, false);
  assert.equal(comparison.results["builder-environment"].equal, false);
});

test("unrealized content stays unresolved", () => {
  const model = createNixDerivationModel(artifact);
  const comparison = model.comparison("addressing-mode");
  assert.deepEqual(comparison.results["output-content"], {
    left: `sha256:${artifact.nativeOutput.contentSha256}`,
    right: null,
    equal: null,
    status: "unresolved"
  });
});

test("browser validation fails closed on native and derived substitutions", () => {
  const nativeMutation = structuredClone(artifact);
  nativeMutation.dependencyGraph.directEdges[0].evidence = "derived";
  assert.throws(() => createNixDerivationModel(nativeMutation), /direct graph contains/);

  const projectionMutation = structuredClone(artifact);
  projectionMutation.comparisons[0].results["input-closure"].left = `sha256:${"0".repeat(64)}`;
  assert.throws(() => createNixDerivationModel(projectionMutation), /closure result is substituted/);

  const nativeProcessMutation = structuredClone(artifact);
  nativeProcessMutation.derivations[0].native.args.push("substituted");
  assert.throws(() => createNixDerivationModel(nativeProcessMutation), /native process record is substituted/);

  const missingEdge = structuredClone(artifact);
  missingEdge.dependencyGraph.directEdges.shift();
  assert.throws(() => createNixDerivationModel(missingEdge), /direct graph omits/);

  const outputMutation = structuredClone(artifact);
  outputMutation.dependencyGraph.outputMappings[0].path = outputMutation.dependencyGraph.outputMappings[1].path;
  assert.throws(() => createNixDerivationModel(outputMutation), /output mapping is not uniquely bound/);

  const contentMutation = structuredClone(artifact);
  contentMutation.comparisons[0].results["output-content"].left = `sha256:${"0".repeat(64)}`;
  contentMutation.comparisons[0].results["output-content"].equal = false;
  assert.throws(() => createNixDerivationModel(contentMutation), /output-content result is substituted/);

  const boundaryMutation = structuredClone(artifact);
  boundaryMutation.captureBoundary.derivationBuildersExecuted = true;
  assert.throws(() => createNixDerivationModel(boundaryMutation), /capture boundary/);
});
