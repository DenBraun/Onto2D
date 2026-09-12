import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadCanonicalSource, validateCanonicalSource, verifyCanonicalEvidence } from "../../models/causal-emergence/canonical/source.mjs";
import { commonExperimentalContexts } from "../../models/causal-emergence/canonical/routing.mjs";
import { buildCanonicalRelease, buildHistoricalCanonicalRelease } from "../../models/causal-emergence/canonical/build.mjs";

const data = await loadCanonicalSource();
const legacy = await Promise.all(Array.from({ length: 8 }, async (_, i) => JSON.parse(await readFile(new URL(`../../references/level-${i}.json`, import.meta.url), "utf8"))));

test("route review separates eight complete comparisons and preserves unresolved alternatives", () => {
  assert.equal(data.routing.contexts.length, 8);
  assert.equal(data.routing.studies.length, 2);
  assert.equal(data.routing.reviews.length, 8);
  assert.equal(data.routing.measurements.length, 6);
  const mouse = data.routing.reviews.find((r) => r.contextId === "grimes-mouse-5");
  assert.deepEqual(mouse.candidates.map((r) => [r.routeId, r.status]), [
    ["primary-off", "contributes"], ["secondary-off", "not-resolved"],
    ["tertiary-off", "not-resolved"], ["non-primary-off", "contributes"]
  ]);
  assert.ok(data.routing.reviews.find((r) => r.contextId === "grimes-primate-200").candidates.every((r) => r.status === "not-resolved"));
  assert.equal(data.migration.edges.filter((e) => e.status === "internally-reviewed").length, 106);
});

test("scope validation rejects same-publication pooling, changed light meaning and unsupported route identification", () => {
  for (const mutate of [
    (d) => { d.routing.contexts.pop(); },
    (d) => { d.routing.reviews.pop(); },
    (d) => { d.routing.measurements.pop(); },
    (d) => { d.routing.studies[1].id = "grimes2018"; },
    (d) => { d.routing.contexts[0].organismGroup = "mouse"; },
    (d) => { d.routing.contexts[0].cellType = "OFF sustained alpha RGC"; },
    (d) => { d.routing.contexts[0].stimulus.light.role = "flash-intensity"; },
    (d) => { d.routing.contexts[0].stimulus.light.unit = "lux"; },
    (d) => { d.routing.contexts[0].stimulus.frequencyHz = 2; },
    (d) => { d.routing.contexts[3].stimulus.light.value = 0.5; },
    (d) => { d.routing.contexts[0].reviewedLocators = ["unread figure"]; },
    (d) => { d.routing.reviews[4].candidates[1].status = "contributes"; },
    (d) => { d.routing.reviews[0].candidates.pop(); },
    (d) => { d.routing.measurements[0].ratioCell = "D17"; },
    (d) => { d.graph.claims.find((c) => c.id === "routing:grimes-primate-2").experimentalContextIds.push("grimes-mouse-0p5"); },
    (d) => { d.graph.relations.find((r) => r.id === "retinal:routing-primate-off").experimentalContextIds = ["grimes-mouse-5"]; },
    (d) => { d.graph.relations[0].experimentalContextIds = ["grimes-primate-2"]; },
    (d) => { const r = structuredClone(d.graph.relations.find((r) => r.id === "retinal:routing-primate-off")); r.id = "retinal:unreviewed-bridge"; delete r.experimentalContextIds; d.graph.relations.push(r); },
    (d) => { d.graph.entities.find((e) => e.id === "ret:primate-off-drive").legacyCodes = ["4.22"]; }
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => validateCanonicalSource(changed, legacy));
  }
});

test("published summary cells replay exactly with no invented uncertainty", async () => {
  const { routingData } = await verifyCanonicalEvidence();
  assert.deepEqual(routingData.rows.map((r) => [r.intensity, r.responseRatio]), [[2, 0.09], [20, 0.18], [200, 0.8], [0.49, 0.097], [4.9, 0.63], [49, 1]]);
  assert.ok(data.routing.measurements.every((m) => m.uncertainty === "not-provided-in-workbook" && m.ratioUnit === "dimensionless"));
});

test("context compatibility requires one shared complete protocol across the entire path", () => {
  const relations = [
    { id: "a", source: "A", target: "B", experimentalContextIds: ["x", "y"] },
    { id: "b", source: "B", target: "C", experimentalContextIds: ["y", "z"] },
    { id: "c", source: "C", target: "D", experimentalContextIds: ["x", "z"] },
    { id: "d", source: "D", target: "E", contextIds: ["same-publication"] }
  ];
  assert.deepEqual(commonExperimentalContexts(relations, ["a", "b"]), ["y"]);
  assert.deepEqual(commonExperimentalContexts(relations, ["b", "c"]), ["z"]);
  assert.deepEqual(commonExperimentalContexts(relations, ["a", "b", "c"]), []);
  assert.deepEqual(commonExperimentalContexts(relations, ["c", "d"]), []);
  assert.throws(() => commonExperimentalContexts(relations, ["a", "c"]), /Disconnected/);
  assert.throws(() => commonExperimentalContexts(relations, ["unknown"]), /Unknown/);
  assert.throws(() => commonExperimentalContexts(relations, []), /must contain/);
});

test("compiled endpoints expose experimental contexts, alternatives and exact source-cell provenance", async () => {
  const pack = await buildCanonicalRelease();
  assert.deepEqual(pack.manifest.statistics, { nodeCount: 56, edgeCount: 60 });
  assert.equal(pack.manifest.source.files.length, 41);
  const node = pack.files["model/nodes.json"].find((n) => n.id === "ret:primate-off-readout");
  assert.equal(node.rationale.length, 3);
  const e = node.rationale[1].experimentalContexts[0];
  assert.equal(e.id, "grimes-primate-20");
  assert.equal(e.review.candidates.length, 4);
  assert.equal(e.measurement.ratioCell, "F18");
  assert.equal(e.measurement.responseRatio, 0.18);
  assert.equal(node.rationale[1].citations.find((c) => c.sourceId === "grimes2018-fig6-data").source.doi, "10.7554/eLife.38281.019");
  const edges = pack.files["model/edges.json"];
  assert.equal(edges.filter((e) => e.relationLayer === "functional-support").length, 12);
  assert.equal(edges.filter((e) => e.relationLayer === "descriptive").length, 48);
  assert.deepEqual(pack.files["model/dictionaries.json"].routing, data.routing);
});

test("the preceding functional-support edition still rebuilds from its original source", async () => {
  const pack = await buildHistoricalCanonicalRelease("2026.09.12.2");
  assert.equal(pack.manifest.rootHash, "sha256:75b3b75dfb0b92fd4c2ce3c1124af6d42f1ee1645d643ef38b64abf056c02628");
  assert.deepEqual(pack.manifest.statistics, { nodeCount: 50, edgeCount: 57 });
  assert.equal(pack.manifest.source.files.length, 31);
});
