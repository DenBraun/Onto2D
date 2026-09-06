import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import {
  auditStructuralWeights, verifyStructuralWeightAudit, analyzeStructuralMetricExperiment,
  verifyStructuralMetricExperiment, structuralMetricExperimentAnalysis
} from "@onto2d/structural-geometry/experiments";

const base = new URL("../../../cases/structural-geometry/experiments/", import.meta.url);
const json = async (file) => JSON.parse(await readFile(new URL(file, base), "utf8"));
const controls = (await json("controls.json")).cases;
const goldens = (await json("expected.json")).cases;
const control = (id = "typed-diamond") => structuredClone(controls.find((graph) => graph.id === id));
const weighted = { metricPolicyId: "inverse-target-share-v1" };
const pack = (graph) => buildModelPack({
  model: { id: `experiment-${graph.id}`, version: "1", name: "Synthetic metric experiment" },
  source: { id: "declared-control", files: [] }, nodes: graph.nodes,
  edges: graph.edges.map((edge) => ({ relationLayer: "source-parent", ...edge })), dictionaries: {}
});
const compact = (result) => ({
  edges: result.edges.map(({ id, length, curvature }) => ({ id, length, curvature })),
  nodes: result.nodes.map(({ id, incomingCurvature, outgoingCurvature, balance }) => ({ id, incomingCurvature, outgoingCurvature, balance }))
});
const code = (suffix) => (error) => error.code === `STRUCTURAL_EXPERIMENT_${suffix}`;
function oracle(graph, request) {
  const child = spawnSync("python3", [fileURLToPath(new URL("reference.py", base)), "--stdin"], {
    input: JSON.stringify({ graph, request }), encoding: "utf8", timeout: 30000,
    maxBuffer: 2 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: "ascii" }
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}
function freezeCheck(value) {
  if (value && typeof value === "object") {
    assert.ok(Object.isFrozen(value));
    Object.values(value).forEach(freezeCheck);
  }
}

for (const graph of controls) test(`weighted metric matches separate Decimal/Fraction golden: ${graph.id}`, () => {
  const { id: _id, ...expected } = goldens.find((value) => value.id === graph.id);
  assert.deepEqual(compact(analyzeStructuralMetricExperiment(pack(graph), weighted).result), expected);
});

test("unit interval experiments preserve all original unit curvature values exactly", async () => {
  const graphs = JSON.parse(await readFile(new URL("../synthetic/graphs.json", base), "utf8")).cases;
  for (const graph of graphs) {
    const source = pack(graph);
    const original = analyzeStructuralGeometry(source);
    const experiment = analyzeStructuralMetricExperiment(source);
    assert.equal(experiment.sourceProjectionHash, original.projectionHash);
    experiment.result.edges.forEach((edge, i) => {
      assert.equal(edge.unitCurvature, original.result.edges[i].curvature);
      assert.deepEqual(edge.curvature, { lowerTicks: String(BigInt(edge.unitCurvature) * 10n ** 12n), upperTicks: String(BigInt(edge.unitCurvature) * 10n ** 12n) });
      assert.equal(edge.unitComparison, "equal");
    });
  }
});

test("necessity regimes are nested, preserve isolated nodes and use the full normalization context", () => {
  const source = pack(control());
  let previous;
  for (const [i, through] of ["necessary", "enabling", "contextual", "optional"].entries()) {
    const request = { ...weighted, selection: { kind: "necessity", through } };
    const artifact = analyzeStructuralMetricExperiment(source, request);
    assert.equal(artifact.result.edges.length, i + 1);
    assert.equal(artifact.result.nodes.length, 4);
    assert.equal(artifact.accounting.excludedEdgeIds.length, 3 - i);
    if (previous) {
      assert.equal(artifact.metricContextHash, previous.metricContextHash);
      for (const before of previous.result.edges) {
        const after = artifact.result.edges.find((edge) => edge.id === before.id);
        assert.ok(after);
        assert.deepEqual(before.length, after.length);
        assert.ok(BigInt(after.curvature.upperTicks) <= BigInt(before.curvature.upperTicks));
      }
    } else assert.equal(artifact.result.connectivity.isolatedNodeCount, 2);
    if (through === "contextual") {
      assert.deepEqual(artifact.result.edges.find((edge) => edge.id === "b->d").length, { numerator: "4", denominator: "1" });
      assert.ok(artifact.accounting.excludedEdgeIds.includes("c->d"));
    }
    previous = artifact;
  }
  assert.deepEqual(previous.result, analyzeStructuralMetricExperiment(source, weighted).result);
});

test("directed connectivity distinguishes a DAG, a cycle and cyclic components joined by a bridge", async () => {
  const graphs = JSON.parse(await readFile(new URL("../synthetic/graphs.json", base), "utf8")).cases;
  for (const [id, expected] of [
    ["diamond-dag", { weakComponentCount: 1, strongComponentCount: 4, cyclicNodeCount: 0, isolatedNodeCount: 0 }],
    ["cycle", { weakComponentCount: 1, strongComponentCount: 1, cyclicNodeCount: 4, isolatedNodeCount: 0 }],
    ["bridge", { weakComponentCount: 1, strongComponentCount: 2, cyclicNodeCount: 8, isolatedNodeCount: 0 }]
  ]) assert.deepEqual(analyzeStructuralMetricExperiment(pack(graphs.find((graph) => graph.id === id))).result.connectivity, expected);
});

test("role selections are canonical sets and overlapping multiplex channels are not partitions", () => {
  const source = pack(control());
  const selection = { kind: "roles", roles: ["modulation", "arising"] };
  const first = analyzeStructuralMetricExperiment(source, { selection });
  const second = analyzeStructuralMetricExperiment(source, { selection: { kind: "roles", roles: ["arising", "modulation"] } });
  assert.equal(first.artifactHash, second.artifactHash);
  assert.equal(first.result.edges.length, 3);
  const channels = [0, 1].map((value) => analyzeStructuralMetricExperiment(source, { selection: { kind: "channel", field: "interactionModeIds", value } }));
  assert.ok(channels.reduce((count, item) => count + item.result.edges.length, 0) > 4);
  assert.ok(channels.every((item) => item.accounting.selectedEdgeIds.includes("a->b")));
  assert.equal(new Set(channels.flatMap((item) => item.accounting.selectedEdgeIds)).size, 4);
  const empty = analyzeStructuralMetricExperiment(source, { selection: { kind: "channel", field: "dependencyTypeId", value: 99 } });
  assert.equal(empty.result.edges.length, 0);
  assert.equal(empty.result.connectivity.weakComponentCount, 4);
  assert.equal(empty.result.connectivity.strongComponentCount, 4);
  assert.equal(empty.result.connectivity.isolatedNodeCount, 4);
  assert.equal(empty.result.summary.mean, null);
  assert.equal(empty.result.summary.minimum, null);
});

test("separate reference agrees across typed filtered and Unicode controls", () => {
  const graph = control("irrational-feedback");
  graph.nodes[0].id = "\u{10000}";
  graph.edges = graph.edges.map((edge) => ({ ...edge, source: edge.source === "a" ? "\u{10000}" : edge.source, target: edge.target === "a" ? "\u{10000}" : edge.target }));
  const selections = [
    { kind: "all" }, ...["necessary", "enabling", "contextual", "optional"].map((through) => ({ kind: "necessity", through })),
    { kind: "roles", roles: ["arising", "modulation"] },
    { kind: "channel", field: "dependencyTypeId", value: 0 },
    { kind: "channel", field: "interactionModeIds", value: 1 },
    { kind: "channel", field: "causalDirectionIds", value: 0 }
  ];
  for (const selection of selections) for (const metricPolicyId of ["unit-v1", "inverse-target-share-v1"]) {
    const request = { selection, metricPolicyId };
    assert.deepEqual(compact(analyzeStructuralMetricExperiment(pack(graph), request).result), oracle(graph, request));
  }
});

test("inverse shares are invariant to admissible target-local rescaling but retain changed provenance", () => {
  const graph = control();
  const first = analyzeStructuralMetricExperiment(pack(graph), weighted);
  graph.edges.filter((edge) => edge.target === "d").forEach((edge) => { edge.weight *= 0.5; });
  const second = analyzeStructuralMetricExperiment(pack(graph), weighted);
  assert.deepEqual(second.result, first.result);
  assert.notEqual(second.artifactHash, first.artifactHash);
  assert.notEqual(second.metricContextHash, first.metricContextHash);
  assert.deepEqual(auditStructuralWeights(pack(graph)).nonUnitTargetIds, ["d"]);
});

test("exact roots, irrational bounds and zero classifications retain their numeric meaning", () => {
  const result = analyzeStructuralMetricExperiment(pack(control("rational-root")), weighted).result;
  assert.deepEqual(result.edges.find((edge) => edge.id === "a->b").curvature, { lowerTicks: "1500000000000", upperTicks: "1500000000000" });
  const zero = result.edges.find((edge) => edge.id === "b->c");
  assert.equal(zero.sign, "zero");
  assert.deepEqual(zero.curvature, { lowerTicks: "0", upperTicks: "0" });
  const irrational = analyzeStructuralMetricExperiment(pack(control("irrational-feedback")), weighted).result;
  assert.ok(irrational.edges.some((edge) => edge.curvature.lowerTicks !== edge.curvature.upperTicks));
  assert.equal(Object.values(irrational.summary.signs).reduce((a, b) => a + b), irrational.edges.length);
  assert.equal(Object.values(irrational.summary.unitComparison).reduce((a, b) => a + b), irrational.edges.length);
});

test("invalid weights are audited and cannot be hidden by a selection or become epsilon weights", () => {
  const changes = [undefined, "0.5", null, 0, -1, 2, 0.0000001];
  for (const weight of changes) {
    const graph = control();
    if (weight === undefined) delete graph.edges[3].weight;
    else graph.edges[3].weight = weight;
    const source = pack(graph);
    const audit = auditStructuralWeights(source);
    assert.equal(audit.eligibleForInverseShare, false);
    assert.equal(audit.invalidWeights.length, 1);
    assert.equal(analyzeStructuralMetricExperiment(source).result.edges.length, 4);
    assert.throws(() => analyzeStructuralMetricExperiment(source, { ...weighted, selection: { kind: "necessity", through: "necessary" } }), code("WEIGHTS_INVALID"));
  }
});

test("intervals crossing zero or a unit value remain unresolved instead of being rounded into a claim", () => {
  const graph = control();
  graph.edges = [
    { id: "a-b", source: "a", target: "b", weight: 0.5 },
    { id: "d-b", source: "d", target: "b", weight: 0.5 },
    { id: "b-c", source: "b", target: "c", weight: 0.5000000000000001 },
    { id: "a-c", source: "a", target: "c", weight: 0.5 }
  ];
  const artifact = analyzeStructuralMetricExperiment(pack(graph), weighted);
  const edge = artifact.result.edges.find((edge) => edge.id === "b-c");
  assert.deepEqual(edge.curvature, { lowerTicks: "0", upperTicks: "2" });
  assert.equal(edge.sign, "unresolved");
  assert.equal(edge.unitComparison, "overlapping");
  assert.deepEqual(compact(artifact.result), oracle(graph, weighted));
});

test("missing channel fields are accounted for while malformed typed categories fail closed", () => {
  const graph = control(); delete graph.edges[0].interactionModeIds;
  const request = { selection: { kind: "channel", field: "interactionModeIds", value: 0 } };
  const result = analyzeStructuralMetricExperiment(pack(graph), request);
  assert.deepEqual(result.accounting.missingChannelEdgeIds, ["a->b"]);
  for (const value of [null, 0, [0, 0], ["0"], [-1]]) {
    graph.edges[0].interactionModeIds = value;
    assert.throws(() => analyzeStructuralMetricExperiment(pack(graph), request), code("CHANNEL_INVALID"));
  }
  for (const [field, selection] of [["necessity", { kind: "necessity", through: "necessary" }], ["ontologicalRole", { kind: "roles", roles: ["arising"] }]]) {
    const broken = control(); delete broken.edges[3][field];
    assert.throws(() => analyzeStructuralMetricExperiment(pack(broken), { selection }), code("CATEGORY_INVALID"));
  }
});

test("closed requests and the incidence budget reject unsupported work without partial output", () => {
  const source = pack(control());
  for (const request of [null, [], { extra: 1 }, { selection: null }, { metricPolicyId: null }, { metricPolicyId: "raw-weight" },
    { selection: { kind: "all", extra: true } }, { selection: { kind: "__proto__" } },
    { selection: { kind: ["all"] } }, { selection: { kind: ["necessity"], through: "necessary" } },
    { selection: { kind: "necessity", through: "unknown" } }, { selection: { kind: "roles", roles: [] } },
    { selection: { kind: "roles", roles: ["arising", "arising"] } },
    { selection: { kind: "channel", field: "scienceIds", value: 1 } },
    { selection: { kind: "channel", field: "dependencyTypeId", value: -1 } }]) {
    assert.throws(() => analyzeStructuralMetricExperiment(source, request));
  }
  const graph = { id: "dense-budget", nodes: Array.from({ length: 39 }, (_, i) => ({ id: `n${i}` })), edges: [] };
  for (const from of graph.nodes) for (const to of graph.nodes) if (from.id !== to.id) {
    graph.edges.push({ id: `${from.id}->${to.id}`, source: from.id, target: to.id });
  }
  assert.throws(() => analyzeStructuralMetricExperiment(pack(graph)), code("LIMIT_EXCEEDED"));
});

test("source and results are immutable and selected experiments replay the expected request", () => {
  const source = structuredClone(pack(control()));
  const before = JSON.stringify(source);
  const request = { ...weighted, selection: { kind: "necessity", through: "contextual" } };
  const artifact = analyzeStructuralMetricExperiment(source, request);
  const audit = auditStructuralWeights(source);
  freezeCheck(artifact); freezeCheck(audit);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(verifyStructuralMetricExperiment(artifact, source, request), artifact);
  assert.deepEqual(verifyStructuralWeightAudit(audit, source), audit);
  assert.throws(() => verifyStructuralMetricExperiment(artifact, source), code("VERIFICATION_FAILED"));
  const mutations = [
    (a) => { a.request.selection.through = "optional"; }, (a) => { a.model.manifestHash = a.projectionHash; },
    (a) => { a.result.edges[0].curvature.lowerTicks = "0"; }, (a) => { a.result.summary.signs.negative += 1; },
    (a) => { a.result.connectivity.strongComponentCount += 1; }, (a) => { a.metricContextHash = a.projectionHash; },
    (a) => { a.weightAuditHash = null; }, (a) => { a.accounting.excludedEdgeIds = []; },
    (a) => { a.numericPolicy.decimalPlaces = 6; }, (a) => { a.metricPolicy.normalizationContext = "selected-edges"; }
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(artifact); mutate(forged);
    const { artifactHash: _hash, ...body } = forged;
    forged.artifactHash = hashCanonical("onto2d:structural-metric-experiment:v1", body);
    assert.throws(() => verifyStructuralMetricExperiment(forged, source, request), code("VERIFICATION_FAILED"));
  }
  const forged = structuredClone(audit); forged.nonUnitTargetIds.push("a");
  const { artifactHash: _hash, ...body } = forged;
  forged.artifactHash = hashCanonical("onto2d:structural-weight-audit:v1", body);
  assert.throws(() => verifyStructuralWeightAudit(forged, source), code("AUDIT_VERIFICATION_FAILED"));
});

test("record permutations preserve artifacts and relabeling preserves numerical results", () => {
  const graph = control(); const before = analyzeStructuralMetricExperiment(pack(graph), weighted);
  graph.nodes.reverse(); graph.edges.reverse();
  assert.equal(analyzeStructuralMetricExperiment(pack(graph), weighted).artifactHash, before.artifactHash);
  graph.nodes = graph.nodes.map((node) => ({ ...node, id: `renamed-${node.id}` }));
  graph.edges = graph.edges.map((edge) => ({ ...edge, id: `renamed-${edge.id}`, source: `renamed-${edge.source}`, target: `renamed-${edge.target}` }));
  const renamed = analyzeStructuralMetricExperiment(pack(graph), weighted);
  assert.deepEqual(renamed.result.summary, before.result.summary);
  assert.deepEqual(renamed.result.connectivity, before.result.connectivity);
  assert.deepEqual(renamed.result.edges.map((edge) => edge.curvature), before.result.edges.map((edge) => edge.curvature));
  assert.notEqual(renamed.artifactHash, before.artifactHash);
});

test("the experimental engine analysis is opt-in and matches direct computation", async () => {
  const source = pack(control());
  const engine = await Onto2D.create({ models: [source], analyses: [structuralMetricExperimentAnalysis] });
  const actual = await engine.analyze("structural-metric-experiment", weighted);
  assert.deepEqual(actual, analyzeStructuralMetricExperiment(source, weighted));
  assert.throws(() => structuralMetricExperimentAnalysis.run({ model: {} }, weighted));
});

test("the full weighted snapshot replays and agrees with the separate numeric reference", async () => {
  const source = JSON.parse(await readFile(new URL("../../../models/causal-emergence/releases/2026.08.15/bundle.json", import.meta.url), "utf8"));
  const artifact = await json("weighted-full.json"); const audit = await json("weight-audit.json");
  assert.deepEqual(verifyStructuralMetricExperiment(artifact, source, weighted), artifact);
  assert.deepEqual(verifyStructuralWeightAudit(audit, source), audit);
  assert.deepEqual(audit.nonUnitTargetIds, ["0.18", "0.2", "0.9"]);
  assert.deepEqual(audit.targets.filter((target) => target.disposition === "non-unit-sum").map((target) => target.sourceWeightSum), [
    { numerator: "9", denominator: "10" }, { numerator: "19", denominator: "10" }, { numerator: "9", denominator: "10" }
  ]);
  assert.deepEqual(compact(artifact.result), oracle({ nodes: source.files["model/nodes.json"], edges: source.files["model/edges.json"] }, weighted));
  const suite = await json("suite.json");
  for (const metricPolicyId of ["unit-v1", "inverse-target-share-v1"]) {
    const regimes = suite.runs.filter((run) => run.request.metricPolicyId === metricPolicyId && run.request.selection.kind === "necessity");
    assert.deepEqual(regimes.map((run) => run.edgeCount), [613, 863, 958, 971]);
    assert.ok(regimes.every((run) => run.nodeCount === 249));
    assert.equal(new Set(regimes.map((run) => run.metricContextHash)).size, 1);
  }
});
