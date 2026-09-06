import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelPack, modelPackFilePaths } from "@onto2d/model-pack";
import { Model, Onto2D } from "@onto2d/engine";
import {
  SOURCE_PARENT_DIRECTED_POLICY,
  UNIT_METRIC_POLICY,
  analyzeStructuralGeometry,
  projectStructuralGeometry,
  structuralGeometryAnalysis,
  verifyStructuralGeometryArtifact,
  verifyStructuralProjection
} from "@onto2d/structural-geometry";

const directory = new URL("../../../cases/structural-geometry/", import.meta.url);
const json = async (relative) => JSON.parse(await readFile(new URL(relative, directory), "utf8"));
const graphs = (await json("synthetic/graphs.json")).cases;
const expected = (await json("synthetic/expected.json")).cases;
const graph = (id) => structuredClone(graphs.find((entry) => entry.id === id));
const paths = modelPackFilePaths();
const reference = fileURLToPath(new URL("synthetic/reference.py", directory));
const code = (suffix) => (error) => error.code === `STRUCTURAL_GEOMETRY_${suffix}`;

function input(value) {
  return {
    model: { id: `sg-${value.id}`, name: "Synthetic structural control", version: "1", status: "synthetic" },
    source: { id: "declared-synthetic-graph", files: [] },
    nodes: value.nodes,
    edges: value.edges.map((edge) => ({ relationLayer: "source-parent", ...edge })),
    dictionaries: {}
  };
}
const packFor = (value) => buildModelPack(input(value));
const compact = (result) => ({
  edges: result.edges.map(({ id, curvature }) => ({ id, curvature })),
  nodes: result.nodes.map(({ id, incomingCurvature, outgoingCurvature, balance }) => ({
    id, incomingCurvature, outgoingCurvature, balance
  }))
});
const numerics = (result) => ({
  nodes: result.nodes.map(({ id: _id, ...values }) => values),
  edges: result.edges.map(({ id: _id, source: _source, target: _target, ...values }) => values),
  summary: result.summary
});

function oracle(value) {
  const child = spawnSync("python3", [reference, "--graph-stdin"], {
    input: JSON.stringify(value), encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 30000,
    env: { ...process.env, PYTHONIOENCODING: "ascii" }
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

function assertDeepFrozen(value) {
  if (value && typeof value === "object") {
    assert.ok(Object.isFrozen(value));
    for (const child of Object.values(value)) assertDeepFrozen(child);
  }
}

for (const fixture of graphs) {
  test(`unit Forman matches frozen incidence oracle: ${fixture.id}`, () => {
    const result = analyzeStructuralGeometry(packFor(fixture)).result;
    const { id: _id, ...golden } = expected.find((entry) => entry.id === fixture.id);
    assert.deepEqual(compact(result), golden);
    assert.equal(result.nodes.reduce((sum, node) => sum + node.balance, 0), 0);
    assert.equal(result.summary.histogram.reduce((sum, item) => sum + item.count, 0), fixture.edges.length);
  });
}

test("analytic examples distinguish incoming-source from outgoing-source conventions", () => {
  const values = (id) => analyzeStructuralGeometry(packFor(graph(id))).result.edges.map((e) => e.curvature);
  assert.deepEqual(values("single-edge"), [2]);
  assert.deepEqual(values("path"), [1, 0, 1]);
  assert.deepEqual(values("cycle"), [0, 0, 0, 0]);
  assert.deepEqual(values("outward-star"), [2, 2, 2, 2]);
  assert.deepEqual(values("inward-star"), [2, 2, 2, 2]);
  assert.deepEqual(values("bidirected-clique"), [-2, -2, -2, -2, -2, -2]);
  assert.deepEqual(values("reciprocal-pair"), [0, 0]);
  const paper = analyzeStructuralGeometry(packFor(graph("paper-edge-neighborhood"))).result;
  assert.equal(paper.edges.find((e) => e.id === "1->2").curvature, -4);
  assert.deepEqual(values("feed-forward-triangle"), [1, 2, 1]);
  assert.deepEqual(values("feedback-triangle"), [0, 0, 0]);
});

test("an isolated node has a defined empty-edge result", () => {
  const result = analyzeStructuralGeometry(packFor(graph("isolated-node"))).result;
  assert.deepEqual(result.summary, { count: 0, sum: 0, minimum: null, maximum: null, mean: null, histogram: [] });
  assert.deepEqual(result.extrema, { minimumEdgeIds: [], maximumEdgeIds: [] });
  assert.ok(Object.values(result.groups).every((groups) => groups.length === 0));
  assert.deepEqual(result.nodes, [{ id: "a", inDegree: 0, outDegree: 0, incomingCurvature: 0, outgoingCurvature: 0, balance: 0 }]);
});

test("input is unchanged and source attributes and exact record traces are preserved", () => {
  const value = graph("single-edge");
  Object.assign(value.nodes[0], {
    name: "Source label", description: "Source description", x: 30, level: 0, phase: "A", phaseId: 0,
    typeRole: "Pattern", typeRoleId: 2, scienceIds: [1], scientificStatus: "conceptual",
    requirements: { MustCover: [7] }, evidence: [{ claim: "unreviewed" }]
  });
  Object.assign(value.edges[0], {
    weight: 0.1, quantization: { N_min: 1, N_sat: null }, necessity: "necessary",
    dependencyType: "Constraint", dependencyTypeId: 10, ontologicalRole: "arising",
    causalDirectionIds: [0], causalDirections: ["Upward causation"],
    interactionModeIds: [3], interactionModes: ["Initiation"]
  });
  const source = structuredClone(packFor(value));
  const before = JSON.stringify(source);
  const projection = projectStructuralGeometry(source);
  const artifact = analyzeStructuralGeometry(source);
  assert.equal(JSON.stringify(source), before);
  assertDeepFrozen(projection);
  assertDeepFrozen(artifact);
  assertDeepFrozen(SOURCE_PARENT_DIRECTED_POLICY);
  assertDeepFrozen(UNIT_METRIC_POLICY);
  for (const [kind, records, projected] of [
    ["node", source.files[paths.nodes], projection.nodes],
    ["edge", source.files[paths.edges], projection.edges]
  ]) {
    for (let i = 0; i < records.length; i += 1) {
      assert.equal(projected[i].id, records[i].id);
      assert.equal(projected[i].sourceRecordHash, hashCanonical("onto2d:structural-source-record:v1", {
        kind, record: records[i]
      }));
      for (const [key, attribute] of Object.entries(projected[i].attributes)) {
        assert.deepEqual(attribute, records[i][key]);
      }
    }
  }
  assert.deepEqual(projection.nodes[0].attributes.requirements, { MustCover: [7] });
  for (const omitted of ["name", "description", "evidence", "x"]) {
    assert.equal(Object.hasOwn(projection.nodes[0].attributes, omitted), false);
  }
  assert.throws(() => { projection.edges[0].attributes.quantization.N_min = 7; }, TypeError);
  source.files[paths.nodes][0].requirements.MustCover.push(9);
  assert.deepEqual(projection.nodes[0].attributes.requirements.MustCover, [7]);
});

test("source weights, epistemic attributes and layout do not become metric coefficients", () => {
  const value = graph("path");
  const original = analyzeStructuralGeometry(packFor(value));
  value.edges.forEach((edge, i) => {
    edge.weight = 1000 + i;
    edge.quantization = { N_min: 100 + i };
    edge.necessity = "optional";
  });
  value.nodes.forEach((node) => Object.assign(node, { name: "Renamed", x: -100, scientificStatus: "unreviewed" }));
  const changed = analyzeStructuralGeometry(packFor(value));
  assert.deepEqual(numerics(changed.result), numerics(original.result));
  assert.notEqual(changed.projectionHash, original.projectionHash);
  assert.notEqual(changed.model.modelRootHash, original.model.modelRootHash);
});

test("record and JSON key permutations preserve exact canonical artifacts", () => {
  const value = graph("layered-dag");
  const pack = packFor(value);
  value.nodes.reverse();
  value.edges.reverse();
  const permuteKeys = (record) => Object.fromEntries(Object.entries(record).reverse());
  value.edges = value.edges.map(permuteKeys);
  const reordered = packFor(value);
  assert.equal(canonicalize(pack), canonicalize(reordered));
  assert.equal(canonicalize(analyzeStructuralGeometry(pack)), canonicalize(analyzeStructuralGeometry(reordered)));
  const artifact = analyzeStructuralGeometry(pack);
  assert.deepEqual(verifyStructuralGeometryArtifact(permuteKeys(artifact), pack), artifact);
});

test("ID relabeling is numerical equivariance, with intentionally distinct provenance hashes", () => {
  for (const value of graphs) {
    const original = analyzeStructuralGeometry(packFor(value));
    const renamed = structuredClone(value);
    const ids = new Map(value.nodes.map((node, index) => [node.id, `renamed-${value.nodes.length - index}`]));
    renamed.nodes = value.nodes.map((node) => ({ ...node, id: ids.get(node.id) }));
    renamed.edges = value.edges.map((edge, index) => ({
      ...edge, id: `edge-${value.edges.length - index}`, source: ids.get(edge.source), target: ids.get(edge.target)
    }));
    const changed = analyzeStructuralGeometry(packFor(renamed));
    const originalEdges = new Map(original.result.edges.map((edge) => [edge.id, edge]));
    renamed.edges.forEach((edge, index) => {
      assert.equal(changed.result.edges.find((entry) => entry.id === edge.id).curvature,
        originalEdges.get(value.edges[index].id).curvature);
    });
    for (const node of original.result.nodes) {
      assert.deepEqual(changed.result.nodes.find((entry) => entry.id === ids.get(node.id)), {
        ...node, id: ids.get(node.id)
      });
    }
    assert.deepEqual(changed.result.summary, original.result.summary);
    assert.notEqual(changed.artifactHash, original.artifactHash);
  }
});

test("global reversal preserves corresponding edge curvature and exchanges node sums", () => {
  for (const value of graphs) {
    const original = analyzeStructuralGeometry(packFor(value));
    const reversed = { ...value, edges: value.edges.map((edge) => ({ ...edge, source: edge.target, target: edge.source })) };
    const changed = analyzeStructuralGeometry(packFor(reversed));
    assert.deepEqual(changed.result.edges.map(({ id, curvature }) => ({ id, curvature })),
      original.result.edges.map(({ id, curvature }) => ({ id, curvature })));
    changed.result.nodes.forEach((node, index) => {
      const before = original.result.nodes[index];
      assert.equal(node.incomingCurvature, before.outgoingCurvature);
      assert.equal(node.outgoingCurvature, before.incomingCurvature);
      assert.equal(node.balance, before.balance === 0 ? 0 : -before.balance);
    });
  }
});

test("grouping distinguishes missing, null, numeric and textual levels and retains all extrema ties", () => {
  const value = graph("outward-star");
  value.nodes[2].level = null;
  value.nodes[3].level = 0;
  value.nodes[4].level = "0";
  const result = analyzeStructuralGeometry(packFor(value)).result;
  const keys = result.groups.byTargetLevel.map((entry) => canonicalize(entry.key));
  assert.equal(new Set(keys).size, 4);
  for (const key of [{ present: false }, { present: true, value: null }, { present: true, value: 0 }, { present: true, value: "0" }]) {
    assert.ok(keys.includes(canonicalize(key)));
  }
  for (const groups of Object.values(result.groups)) {
    assert.equal(groups.reduce((sum, group) => sum + group.summary.count, 0), 4);
    assert.equal(groups.reduce((sum, group) => sum + group.summary.sum, 0), result.summary.sum);
  }
  assert.deepEqual(result.extrema.minimumEdgeIds, result.edges.map((edge) => edge.id));
  assert.deepEqual(result.extrema.maximumEdgeIds, result.extrema.minimumEdgeIds);
});

test("projection rejects unsupported graph classes without silently dropping edges", () => {
  for (const [patch, suffix] of [
    [(value) => { value.edges[0].relationLayer = "reviewed-causal"; }, "RELATION_LAYER_UNSUPPORTED"],
    [(value) => { value.edges[0].source = value.edges[0].target; }, "SELF_LOOP_UNSUPPORTED"],
    [(value) => { value.edges.push({ ...value.edges[0], id: "second" }); }, "PARALLEL_EDGE_UNSUPPORTED"]
  ]) {
    const value = graph("single-edge");
    patch(value);
    assert.throws(() => projectStructuralGeometry(packFor(value)), code(suffix));
  }
  const missingLayer = input(graph("single-edge"));
  delete missingLayer.edges[0].relationLayer;
  assert.throws(() => projectStructuralGeometry(buildModelPack(missingLayer)), code("RELATION_LAYER_UNSUPPORTED"));
  const oversize = input(graph("isolated-node"));
  oversize.nodes = Array.from({ length: 4097 }, (_, i) => ({ id: `n${i}` }));
  assert.throws(() => projectStructuralGeometry(buildModelPack(oversize)), code("LIMIT_EXCEEDED"));
});

test("pack integrity, missing endpoints and noncanonical inputs fail before analysis", () => {
  const pack = structuredClone(packFor(graph("single-edge")));
  pack.files[paths.edges][0].target = "missing";
  assert.throws(() => analyzeStructuralGeometry(pack), (error) => error.code === "MODEL_PACK_EDGE_ENDPOINT_MISSING");
  const stale = structuredClone(packFor(graph("single-edge")));
  stale.files[paths.nodes][0].level = 9;
  assert.throws(() => analyzeStructuralGeometry(stale), (error) => error.code === "MODEL_PACK_VERIFICATION_FAILED");
  const valid = packFor(graph("single-edge"));
  for (const request of [null, [], true, { scope: "fragment" }, { parameters: {} }]) {
    assert.throws(() => analyzeStructuralGeometry(valid, request), code("INPUT_INVALID"));
  }
  for (const request of [{ projectionPolicyId: "causal-directed-v1" }, { metricPolicyId: "weighted" }, { metricPolicyId: null }]) {
    assert.throws(() => analyzeStructuralGeometry(valid, request), code("POLICY_UNSUPPORTED"));
  }
  assert.throws(() => analyzeStructuralGeometry(valid, { metricPolicyId: undefined }));
  assert.throws(() => analyzeStructuralGeometry(valid, new Date()));
  assert.deepEqual(analyzeStructuralGeometry(valid, {
    projectionPolicyId: SOURCE_PARENT_DIRECTED_POLICY.id, metricPolicyId: UNIT_METRIC_POLICY.id
  }), analyzeStructuralGeometry(valid));
});

test("artifact and projection verification reject forged values even after hash recomputation", () => {
  const pack = packFor(graph("path"));
  const artifact = analyzeStructuralGeometry(pack);
  assert.deepEqual(verifyStructuralGeometryArtifact(artifact, pack), artifact);
  const changes = [
    (a) => { a.result.edges[0].curvature += 1; },
    (a) => { a.result.nodes[0].balance += 1; },
    (a) => { a.result.summary.sum += 1; },
    (a) => { a.result.groups.byNecessity[0].summary.count += 1; },
    (a) => { a.result.extrema.minimumEdgeIds = []; },
    (a) => { a.model.manifestHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.projectionHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.projectionPolicy.direction = "symmetrized"; },
    (a) => { a.metricPolicy.edgeWeight = 2; },
    (a) => { a.metricPolicyHash = a.projectionPolicyHash; },
    (a) => { a.algorithm.version = "2"; },
    (a) => { a.parameters = { iterations: 5 }; },
    (a) => { a.parametersHash = a.projectionPolicyHash; },
    (a) => { a.extra = true; }
  ];
  for (const change of changes) {
    const forged = structuredClone(artifact);
    change(forged);
    const { artifactHash: _hash, ...body } = forged;
    forged.artifactHash = hashCanonical("onto2d:structural-geometry-artifact:v1", body);
    assert.throws(() => verifyStructuralGeometryArtifact(forged, pack), code("ARTIFACT_VERIFICATION_FAILED"));
  }
  const projection = projectStructuralGeometry(pack);
  assert.deepEqual(verifyStructuralProjection(projection, pack), projection);
  for (const change of [
    (p) => { p.nodes[0].sourceRecordHash = p.nodes[1].sourceRecordHash; },
    (p) => { p.edges[0].source = p.edges[0].target; },
    (p) => { p.edges.pop(); },
    (p) => { p.policy.includeQuantization = false; }
  ]) {
    const forged = structuredClone(projection);
    change(forged);
    const { projectionHash: _hash, ...body } = forged;
    forged.projectionHash = hashCanonical("onto2d:structural-projection:v1", body);
    assert.throws(() => verifyStructuralProjection(forged, pack), code("PROJECTION_VERIFICATION_FAILED"));
  }
});

test("the same semantic root with a changed release manifest cannot verify an old result", () => {
  const value = input(graph("path"));
  const first = buildModelPack(value);
  value.model.version = "2";
  const second = buildModelPack(value);
  assert.equal(first.manifest.rootHash, second.manifest.rootHash);
  assert.notEqual(first.manifest.manifestHash, second.manifest.manifestHash);
  assert.throws(() => verifyStructuralGeometryArtifact(analyzeStructuralGeometry(first), second), code("ARTIFACT_VERIFICATION_FAILED"));
  // Even within one version, descriptive manifest metadata is pinned.
  value.model.version = "1";
  value.model.name = "Changed release description";
  const third = buildModelPack(value);
  assert.equal(first.manifest.rootHash, third.manifest.rootHash);
  assert.throws(() => verifyStructuralProjection(projectStructuralGeometry(first), third), code("PROJECTION_VERIFICATION_FAILED"));
});

test("engine registration is opt-in and returns the exact direct result", async () => {
  const pack = packFor(graph("path"));
  const unregistered = await Onto2D.create({ models: [pack] });
  assert.equal(unregistered.analyses().some((entry) => entry.id === "structural-geometry"), false);
  const engine = await Onto2D.create({ models: [pack], analyses: [structuralGeometryAnalysis] });
  const actual = await engine.analyze("structural-geometry", {});
  assert.deepEqual(actual, analyzeStructuralGeometry(pack));
  assert.equal(actual.model.manifestHash, pack.manifest.manifestHash);
  assert.throws(() => structuralGeometryAnalysis.run({ model: {
    manifest: pack.manifest, nodes: () => [], edges: () => []
  } }), code("MODEL_REQUIRED"));
  assert.throws(() => structuralGeometryAnalysis.run({ model: Object.create(Model.prototype) }), code("MODEL_REQUIRED"));
  class AlteredModel extends Model {
    nodes() {
      return super.nodes().map((node) => ({ toJSON: () => ({ ...node.toJSON(), level: 99 }) }));
    }
  }
  assert.throws(() => structuralGeometryAnalysis.run({ model: new AlteredModel(pack) }), code("MODEL_BINDING_MISMATCH"));
});

test("separate Python incidence reference agrees on additional deterministic graphs and Unicode IDs", () => {
  let state = 7357;
  const topologies = new Set();
  for (let trial = 0; trial < 12; trial += 1) {
    const value = { id: "seeded-reference", nodes: ["a", "b", "c", "d", "\u{10000}", "\ue000"].map((id) => ({ id })), edges: [] };
    for (const source of value.nodes) for (const target of value.nodes) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      // Use high bits: an LCG's low bits repeat with a short period and would
      // otherwise generate the same 6-node topology on every 36-draw trial.
      if (source.id !== target.id && (state >>> 24) < 64 + trial * 8) {
        value.edges.push({ id: `${source.id}->${target.id}`, source: source.id, target: target.id });
      }
    }
    topologies.add(canonicalize(value.edges));
    assert.deepEqual(compact(analyzeStructuralGeometry(packFor(value)).result), oracle(value));
  }
  assert.equal(topologies.size, 12);
});

test("the complete Causal Emergence census agrees with the separate incidence reference", async () => {
  const pack = JSON.parse(await readFile(new URL("../../../models/causal-emergence/releases/2026.08.15/bundle.json", import.meta.url), "utf8"));
  const artifact = await json("causal-emergence/artifact.json");
  const projection = await json("causal-emergence/projection.json");
  assert.equal(projection.nodes.length, 249);
  assert.equal(projection.edges.length, 971);
  assert.deepEqual(projection.model, await json("causal-emergence/source-lock.json"));
  assert.deepEqual(verifyStructuralProjection(projection, pack), projection);
  assert.deepEqual(verifyStructuralGeometryArtifact(artifact, pack), artifact);
  assert.deepEqual(compact(artifact.result), oracle(projection));
  assert.equal(artifact.result.summary.count, 971);
  const expectedNecessities = { necessary: 613, enabling: 250, contextual: 95, optional: 13 };
  assert.deepEqual(Object.fromEntries(artifact.result.groups.byNecessity.map((entry) => [entry.key.value, entry.summary.count])), expectedNecessities);
});
