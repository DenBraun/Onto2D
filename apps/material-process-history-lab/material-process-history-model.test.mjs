import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMaterialProcessHistoryModel } from "./material-process-history-model.js";

const artifactUrl = new URL("../../cases/material-process-history/artifacts/material-process-history.json", import.meta.url);
const load = () => readFile(artifactUrl, "utf8").then(JSON.parse);

test("Material Process History browser model accepts the exact artifact", async () => {
  const model = createMaterialProcessHistoryModel(await load());
  assert.equal(model.identity, "sha256:3a56371445a7b1b9e18da9fbff2dbe0d8ace1d289ef519998a4cf90aa4dd5889");
  assert.deepEqual(model.buildIds, ["AMB2022-718-AMMT-B6", "AMB2022-718-AMMT-B7", "AMB2022-718-AMMT-B8"]);
  assert.deepEqual(model.components, ["XX", "ZZ"]);
  assert.equal(model.points("XX").length, 2248);
  assert.equal(model.points("ZZ", 0.25).length, model.slice(0.25).pointCount);
  assert.equal(model.build("AMB2022-718-AMMT-B7").comparisonPart.id, model.residualStrain.targetPartId);
});

test("browser model exposes identity and missing-state boundaries", async () => {
  const model = createMaterialProcessHistoryModel(await load());
  assert.deepEqual(model.identityRegimes.map(({ id, classes, unresolved }) => [id, classes.length, unresolved.length]), [["nominal-material", 1, 0], ["nominal-recipe", 1, 0], ["build-record", 3, 0], ["part-record", 3, 0], ["measured-state", 1, 2]]);
  assert.deepEqual(model.regime("measured-state").unresolved, ["AMB2022-718-AMMT-B6-P3", "AMB2022-718-AMMT-B8-P3"]);
  assert.equal(model.historicalLoad.value, null);
  assert.equal(model.audit.causalEdges, 0);
});

test("browser selectors fail closed and the approved artifact is deeply immutable", async () => {
  const model = createMaterialProcessHistoryModel(await load());
  assert.throws(() => model.build("AMB2022-718-AMMT-B9"), /unknown build/);
  assert.throws(() => model.regime("global-identity"), /unknown identity regime/);
  assert.throws(() => model.slice(99), /unknown height slice/);
  assert.throws(() => model.slice(null), /unknown height slice/);
  assert.throws(() => model.points("XX", ""), /unknown height slice/);
  assert.throws(() => model.points("XY"), /unknown strain component/);
  assert.throws(() => { model.builds[0].status = "rewritten"; }, TypeError);
});

test("browser model rejects source, measurement, and causal mutations", async () => {
  const source = await load();
  source.source.snapshotIdentity = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  assert.throws(() => createMaterialProcessHistoryModel(source), /case or source release differs/);

  const measurement = await load();
  measurement.residualStrain.targetPartId = "AMB2022-718-AMMT-B6-P3";
  assert.throws(() => createMaterialProcessHistoryModel(measurement), /residual-strain authority differs/);

  const causal = await load();
  causal.audit.causalEdges = 1;
  assert.throws(() => createMaterialProcessHistoryModel(causal), /epistemic audit differs/);

  const thermography = await load();
  thermography.builds[1].thermography.solidCoolingRate.dataDoi = "10.18434/mds2-2722";
  assert.throws(() => createMaterialProcessHistoryModel(thermography), /thermography boundary differs/);

  const membership = await load();
  membership.identityRegimes.at(-1).classes[0].members = ["AMB2022-718-AMMT-B6-P3"];
  assert.throws(() => createMaterialProcessHistoryModel(membership), /membership differs/);
});
