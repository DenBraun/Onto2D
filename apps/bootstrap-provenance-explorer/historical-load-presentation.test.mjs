import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createBootstrapProvenanceModel } from "./bootstrap-provenance-model.js";
import { formatHistoricalLoadCost, presentHistoricalLoad } from "./historical-load-presentation.js";

const CASE_ROOT = new URL("../../cases/live-bootstrap-provenance/", import.meta.url);

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, CASE_ROOT), "utf8"));
}

async function model() {
  const [trace, stateHistory, evidence, graph, constructionSpace, regimes, analysis] = await Promise.all([
    json("generated/upstream-trace.json"),
    json("generated/state-transitions.json"),
    json("generated/evidence.json"),
    json("generated/graph.json"),
    json("analysis/construction-space.json"),
    json("analysis/regimes.json"),
    json("analysis/historical-load.json")
  ]);
  return createBootstrapProvenanceModel({ trace, stateHistory, evidence, graph, constructionSpace, regimes, analysis });
}

function presentation(instance, costFunction, regimeId) {
  const result = instance.historicalLoad(costFunction, regimeId);
  return presentHistoricalLoad({
    result,
    regime: instance.regime(regimeId),
    freePath: instance.path(result.freePath),
    admissiblePath: instance.path(result.admissiblePath)
  });
}

test("default Historical Load explains the concrete 78-event difference and its limits", async () => {
  const view = presentation(await model(), "event-count", "bootstrappable");
  assert.equal(view.displayedDelta, "+78");
  assert.equal(view.formula, "79 - 1 = +78 event count");
  assert.match(view.meaning, /3 declared paths/);
  assert.match(view.meaning, /adds 78 counted events/);
  assert.match(view.scope, /not elapsed build time, difficulty, security, completeness/);
});

test("a zero load distinguishes an unchanged cost from an unchanged route", async () => {
  const instance = await model();
  assert.match(
    presentation(instance, "trust-root-count", "source-derived").meaning,
    /changes the selected route.*measured load is zero/
  );
  assert.match(
    presentation(instance, "trust-root-count", "free").meaning,
    /adds no cost under this measure/
  );
  assert.equal(formatHistoricalLoadCost(1, "distinct-tool-count"), "1 distinct tool");
  assert.equal(formatHistoricalLoadCost(2, "distinct-tool-count"), "2 distinct tools");
});
