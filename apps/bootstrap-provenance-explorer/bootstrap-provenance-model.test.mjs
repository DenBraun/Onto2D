import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createBootstrapProvenanceModel } from "./bootstrap-provenance-model.js";

const CASE_ROOT = new URL("../../cases/live-bootstrap-provenance/", import.meta.url);

async function json(relative) {
  return JSON.parse(await readFile(new URL(relative, CASE_ROOT), "utf8"));
}

async function fixture() {
  const [trace, stateHistory, evidence, graph, constructionSpace, regimes, analysis] = await Promise.all([
    json("generated/upstream-trace.json"),
    json("generated/state-transitions.json"),
    json("generated/evidence.json"),
    json("generated/graph.json"),
    json("analysis/construction-space.json"),
    json("analysis/regimes.json"),
    json("analysis/historical-load.json")
  ]);
  return { trace, stateHistory, evidence, graph, constructionSpace, regimes, analysis };
}

test("Explorer model preserves actual, derived, and analysis boundaries", async () => {
  const model = createBootstrapProvenanceModel(await fixture());
  assert.equal(model.descriptor.eventCount, 205);
  assert.equal(model.descriptor.activeEventCount, 197);
  assert.equal(model.descriptor.inactiveEventCount, 8);
  assert.equal(model.descriptor.nodeCount, 434);
  assert.equal(model.descriptor.edgeCount, 442);
  assert.equal(model.descriptor.pathCount, 3);
  assert.equal(model.provenance("observed").edges.every((edge) => edge.layer === "upstream-fact"), true);
  assert.equal(model.provenance("derived").edges.some((edge) => edge.layer === "derived-fact"), true);
  assert.equal(model.provenance("all").inferredCount, 0);
  assert.equal(model.provenance("all").counterfactualEdges.every((edge) => edge.upstreamFact === false), true);
});

test("trace filters retain repeated events and active status", async () => {
  const model = createBootstrapProvenanceModel(await fixture());
  const tcc = model.trace({ directive: "build", query: "tcc-0.9.27" });
  assert.equal(tcc.length, 5);
  assert.equal(new Set(tcc.map((event) => event.eventId)).size, 5);
  assert.equal(model.trace({ status: "inactive" }).length, 8);
});

test("Historical Load requires an explicit optimization regime and cost", async () => {
  const model = createBootstrapProvenanceModel(await fixture());
  const result = model.historicalLoad("event-count", "bootstrappable");
  assert.equal(result.a0, 1);
  assert.equal(result.aF, 79);
  assert.equal(result.dH, 78);
  assert.throws(() => model.historicalLoad("event-count", "observed"), /optimization regime/);
  assert.throws(() => model.historicalLoad("missing", "bootstrappable"), /cost function/);
});

test("cross-boundary substitutions and leaked counterfactual evidence fail closed", async () => {
  const changedIdentity = await fixture();
  changedIdentity.evidence.traceIdentity = `sha256:${"0".repeat(64)}`;
  assert.throws(() => createBootstrapProvenanceModel(changedIdentity), /cross a source/);

  const leaked = await fixture();
  leaked.graph.edges.push({
    id: leaked.constructionSpace.counterfactualEdges[0].id,
    source: leaked.graph.nodes[0].id,
    target: leaked.graph.nodes[1].id,
    evidenceClass: "inferred-dependency",
    layer: "onto2d-analysis"
  });
  assert.throws(() => createBootstrapProvenanceModel(leaked), /not exactly backed by evidence/);
});
