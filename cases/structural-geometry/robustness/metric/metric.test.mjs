import assert from "node:assert/strict";
import test from "node:test";
import { carrier, inputs, collect, measure, GEOMETRY_PROFILE_ID } from "./geometry.mjs";
import { FIXTURES, generateControls } from "./controls.mjs";
import { readJson } from "./io.mjs";
import { failuresFor } from "./study.mjs";

test("all metric variants reproduce independent directed controls and uniform-scale invariance", async () => {
  const expected = await readJson("controls.json");
  assert.deepEqual(await generateControls({ independent: false }), expected);
  for (const row of expected.cases) {
    assert.equal(row.measured.geometry.profileId, GEOMETRY_PROFILE_ID);
    assert.equal(row.measured.geometry.coordinateLayoutId, "biological-pair-terminal-geometry-v1");
    assert.notEqual(row.measured.geometry.profileId, row.measured.geometry.coordinateLayoutId);
  }
  const select = (id, variant) => expected.cases.find(c => c.id === id && c.variantId === variant).measured;
  const base = select("diamond", "unit-half");
  assert.notDeepEqual(select("diamond", "unit-zero").geometry.fields, base.geometry.fields);
  assert.notDeepEqual(select("diamond", "inverse-share-half").geometry.fields, base.geometry.fields);
  assert.notDeepEqual(select("diamond", "outdegree-initial").geometry.fields.map(f => f.length), base.geometry.fields.map(f => f.length));
  assert.deepEqual(select("diamond", "outdegree-initial").geometry.fields.map(f => f.ollivier), base.geometry.fields.map(f => f.ollivier));
});
test("provider and flow inputs bind opaque source graphs and reject substituted parameters/certificates", async () => {
  const fixture = FIXTURES[1], context = carrier(fixture.graph, fixture.id);
  const expected = await readJson("controls.json"), base = expected.cases.find(c => c.id === fixture.id && c.variantId === "unit-half");
  assert.throws(() => collect(context, "unit-zero", base.measured.flow));
  const flow = structuredClone(base.measured.flow); flow.states[0].edges[0].curvature.numerator = "99";
  assert.throws(() => collect(context, "unit-half", flow));
  const altered = structuredClone(context); altered.graph.edges.pop(); assert.throws(() => inputs(altered, "unit-half"));
  assert.throws(() => inputs(context, "unplanned-best-variant"));
  assert.throws(() => carrier({ ...fixture.graph, outcomes: [1, 2] }, "invalid"));
  const reordered = carrier({ nodes: [...fixture.graph.nodes].reverse(), edges: [...fixture.graph.edges].reverse() }, fixture.id);
  assert.deepEqual(reordered, context);
  assert.deepEqual(inputs(context, "inverse-share-half").provider.result.edges.map(e => e.length.numerator), ["1", "1", "2", "2"]);
  await assert.rejects(measure(context, "outdegree-initial"), /Unit static/);
});
test("a real preparation limit remains unavailable and a non-target-bearing failure blocks its whole domain", async () => {
  const nodes = Array.from({ length: 9 }, (_, i) => `v${i}`);
  const edges = nodes.flatMap(source => nodes.filter(target => target !== source).map(target => ({ source, target }))).slice(0, 65);
  const measured = await measure(carrier({ nodes, edges }, "oversized-control"), "unit-half");
  assert.equal(measured.status, "unavailable"); assert.equal(measured.reason, "STRUCTURAL_FLOW_LIMIT_EXCEEDED");
  assert.equal(measured.request, null); assert.equal(measured.flow, null); assert.equal(measured.geometry, null);
  const scopes = [{ id: "context-root", datasetId: "Dataset7", measured },
    { id: "network", datasetId: "dream4", measured: { status: "complete", reason: null } }];
  assert.deepEqual(failuresFor("celegans-Dataset7", scopes), [{ id: "context-root", reason: "STRUCTURAL_FLOW_LIMIT_EXCEEDED" }]);
  assert.deepEqual(failuresFor("dream4-knockouts", scopes), []);
});
