import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { analyzeStructuralMetricExperiment, auditStructuralWeights } from "@onto2d/structural-geometry/experiments";
import { STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS, createStructuralMetricContext, createStructuralMetricProvider,
  buildStructuralProvider, verifyStructuralProviderArtifact, requireStructuralMetricValues,
  analyzeStructuralGeometryWithProvider, verifyStructuralProviderAnalysis,
  createStructuralMetricProviderAnalysis, createStructuralProviderAnalysis } from "@onto2d/structural-geometry/providers";
import { fixtures as ollivierFixtures, readJson as readOllivier } from "../../../cases/structural-geometry/ollivier/fixtures.mjs";

const base = new URL("../../../cases/structural-geometry/experiments/", import.meta.url);
const controls = JSON.parse(await readFile(new URL("controls.json", base), "utf8")).cases;
const control = (id = "typed-diamond") => structuredClone(controls.find((g) => g.id === id));
const packFor = (graph, dictionaries = {}) => buildModelPack({
  model: { id: `provider-${graph.id}`, name: "Provider control", version: "1" }, source: { id: "declared-control", files: [] },
  nodes: graph.nodes, edges: graph.edges.map((e) => ({ relationLayer: "source-parent", ...e })), dictionaries });
const unit = { providerId: "unit-v1" };
const weighted = { providerId: "inverse-target-share-v1" };
const channels = { providerId: "typed-channel-v1", parameters: { field: "interactionModeIds", values: [1, 0] } };
const code = (suffix) => (error) => error.code === `STRUCTURAL_PROVIDER_${suffix}`;
const fraction = (n, d = 1) => ({ numerator: String(n), denominator: String(d) });
function frozen(value) {
  if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function resign(name, artifact) {
  const { artifactHash: _old, ...body } = artifact;
  return { ...body, artifactHash: hashCanonical(`onto2d:structural-provider-${name}:v1`, body, { limits: { maxEntries: 500000 } }) };
}

test("provider registry has five immutable capability descriptors and rejects unimplemented families", () => {
  assert.deepEqual(STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS.map((d) => d.kind), ["metric-values", "metric-values", "filtration", "selection", "channels"]);
  frozen(STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS);
  for (const d of STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS) assert.deepEqual(createStructuralMetricProvider(d.id).descriptor, d);
  for (const id of ["response-derived-v1", "declared-weight-v1", "constructor", {}, null]) assert.throws(() => createStructuralMetricProvider(id), code("UNSUPPORTED"));
});

test("context is an immutable verified snapshot and a serialized binding cannot impersonate it", () => {
  const source = structuredClone(packFor(control()));
  const before = JSON.stringify(source);
  const context = createStructuralMetricContext(source);
  const provider = createStructuralMetricProvider("unit-v1");
  frozen(context);
  const result = provider.build(structuredClone(context.projection), context);
  assert.equal(JSON.stringify(source), before);
  source.files["model/edges.json"][0].weight = 0;
  assert.deepEqual(provider.build(context.projection, context), result);
  assert.throws(() => verifyStructuralProviderArtifact(result, source, unit));
  for (const fake of [{}, { ...context }, structuredClone(context), null]) {
    assert.throws(() => provider.build(context.projection, fake), code("CONTEXT_REQUIRED"));
  }
  const changed = structuredClone(context.projection); changed.edges.pop();
  assert.throws(() => provider.build(changed, context), code("PROJECTION_MISMATCH"));
});

test("provider inputs are closed, bounded, canonical sets and do not execute property accessors", () => {
  const source = packFor(control());
  let reads = 0;
  const accessor = { get providerId() { reads += 1; return "unit-v1"; } };
  for (const input of [null, [], {}, accessor, { ...unit, parameters: null }, { ...unit, extra: true },
    { ...unit, parameters: { scope: "partial" } },
    { providerId: "role-subset-v1", parameters: { roles: [] } },
    { providerId: "role-subset-v1", parameters: { roles: ["arising", "arising"] } },
    { providerId: "role-subset-v1", parameters: { roles: ["unknown"] } },
    { ...channels, parameters: { field: "necessity", values: [0] } },
    ...[[], [0, 0], [-1], [0.5], [Number.MAX_SAFE_INTEGER + 1], ["1"], Array.from({ length: 33 }, (_, i) => i)]
      .map((values) => ({ ...channels, parameters: { field: "interactionModeIds", values } }))
  ]) assert.throws(() => buildStructuralProvider(source, input));
  assert.equal(reads, 0);
  const a = buildStructuralProvider(source, channels);
  assert.deepEqual(a.request.parameters.values, [0, 1]);
  assert.deepEqual(a, buildStructuralProvider(source, { ...channels, parameters: { field: "interactionModeIds", values: [0, 1] } }));
  assert.deepEqual(buildStructuralProvider(source, { ...channels, parameters: { field: "interactionModeIds", values: [10, 2] } }).request.parameters.values, [2, 10]);
  const roles = { providerId: "role-subset-v1", parameters: { roles: ["modulation", "arising"] } };
  assert.deepEqual(buildStructuralProvider(source, roles).request.parameters.roles, ["arising", "modulation"]);
});

test("both numeric providers reproduce legacy exact lengths, edge weights and context identities", () => {
  for (const graph of controls) for (const request of [unit, weighted]) {
    const source = packFor(graph);
    const provided = buildStructuralProvider(source, request);
    const legacy = analyzeStructuralMetricExperiment(source, { metricPolicyId: request.providerId });
    assert.equal(provided.result.metricContextHash, legacy.metricContextHash);
    assert.equal(provided.result.metricPolicyHash, legacy.metricPolicyHash);
    assert.equal(provided.result.weightAuditHash, legacy.weightAuditHash);
    assert.deepEqual(provided.result.edges.map(({ id, length }) => ({ id, length })), legacy.result.edges.map(({ id, length }) => ({ id, length })));
    for (const edge of provided.result.edges) assert.deepEqual(edge.weight, edge.length);
    for (const node of provided.result.nodes) assert.deepEqual(node.weight, fraction(1));
    frozen(provided);
  }
});

test("weighted selection keeps full-source denominators and excluded edges in the metric context", () => {
  const source = packFor(control("non-unit-sums"));
  const input = { analysis: "structural-metric-experiment", metricProviderId: "inverse-target-share-v1", selection: { kind: "necessity", through: "necessary" } };
  const a = analyzeStructuralGeometryWithProvider(source, input);
  assert.deepEqual(a.legacyArtifact.result.edges.map((e) => e.id), ["a->c"]);
  assert.deepEqual(a.legacyArtifact.result.edges[0].length, fraction(3)); // (0.2 + 0.4) / 0.2, not 0.2 / 0.2.
  assert.deepEqual(a.metricArtifact.result.edges.map((e) => e.id), ["a->c", "b->c", "c->d"]);
  assert.equal(a.metricArtifact.result.metricContextHash, a.legacyArtifact.metricContextHash);
  assert.equal(auditStructuralWeights(source).nonUnitTargetIds.length, 2);
  const all = analyzeStructuralGeometryWithProvider(source, { ...input, selection: { kind: "all" } });
  assert.equal(all.metricArtifact.artifactHash, a.metricArtifact.artifactHash);
  assert.equal(a.viewArtifact.result.stages[0].projectionHash, a.legacyArtifact.projectionHash);
});

test("invalid full-source weights cannot be hidden by a filtered view while unit and discrete providers remain available", () => {
  for (const weight of [undefined, "0.5", 0, -0.1, 1.1, 0.0000001]) {
    const graph = control();
    if (weight === undefined) delete graph.edges[3].weight; else graph.edges[3].weight = weight;
    const source = packFor(graph);
    assert.throws(() => buildStructuralProvider(source, weighted), (e) => e.code === "STRUCTURAL_EXPERIMENT_WEIGHTS_INVALID");
    assert.throws(() => analyzeStructuralGeometryWithProvider(source, { analysis: "structural-metric-experiment", metricProviderId: "inverse-target-share-v1",
      selection: { kind: "necessity", through: "necessary" } }), (e) => e.code === "STRUCTURAL_EXPERIMENT_WEIGHTS_INVALID");
    assert.doesNotThrow(() => buildStructuralProvider(source, unit));
    assert.doesNotThrow(() => buildStructuralProvider(source, { providerId: "necessity-filtration-v1" }));
  }
});

test("local weight rescaling leaves derived metric values unchanged but preserves distinct provenance", () => {
  const graph = control("non-unit-sums");
  const before = buildStructuralProvider(packFor(graph), weighted);
  for (const edge of graph.edges.filter((e) => e.target === "c")) edge.weight *= 2;
  const after = buildStructuralProvider(packFor(graph), weighted);
  assert.deepEqual(after.result.edges, before.result.edges);
  assert.notEqual(after.context.sourceProjectionHash, before.context.sourceProjectionHash);
  assert.notEqual(after.artifactHash, before.artifactHash);
});

test("necessity filtration adds edges in the established order and retains every source node", () => {
  const graph = control(); graph.nodes.push({ id: "isolated" });
  const source = packFor(graph);
  const { result } = buildStructuralProvider(source, { providerId: "necessity-filtration-v1" });
  assert.deepEqual(result.nodeIds, ["a", "b", "c", "d", "isolated"]);
  assert.deepEqual(result.stages.map((v) => v.selection.through), ["necessary", "enabling", "contextual", "optional"]);
  assert.deepEqual(result.stages.map((v) => v.edges.length), [1, 2, 3, 4]);
  for (const [index, view] of result.stages.entries()) {
    const legacy = analyzeStructuralMetricExperiment(source, { selection: view.selection });
    assert.deepEqual(view.accounting, legacy.accounting);
    assert.equal(view.projectionHash, legacy.projectionHash);
    assert.equal(view.accounting.sourceNodeCount, 5);
    if (index) assert.ok(result.stages[index - 1].edges.every((e) => view.accounting.selectedEdgeIds.includes(e.id)));
  }
});

test("roles and overlapping typed channels retain missing-field accounting and model-local dictionary binding", () => {
  const graph = control(); delete graph.edges[1].interactionModeIds;
  const source = packFor(graph, { interactionModes: { "0": "local-a", "1": "local-b" } });
  const a = buildStructuralProvider(source, channels);
  const [first, second] = a.result.channels;
  assert.ok(first.accounting.selectedEdgeIds.includes("a->b") && second.accounting.selectedEdgeIds.includes("a->b"));
  assert.deepEqual(first.accounting.missingChannelEdgeIds, ["a->c"]);
  for (const view of a.result.channels) assert.deepEqual(view.accounting, analyzeStructuralMetricExperiment(source, { selection: view.selection }).accounting);
  const other = packFor(graph, { interactionModes: { "0": "different-meaning", "1": "local-b" } });
  const b = buildStructuralProvider(other, channels);
  assert.notEqual(a.context.dictionaryHash, b.context.dictionaryHash);
  assert.notEqual(a.context.contextHash, b.context.contextHash);
  assert.throws(() => verifyStructuralProviderArtifact(a, other, channels), code("VERIFICATION_FAILED"));
  const absent = buildStructuralProvider(source, { ...channels, parameters: { field: "interactionModeIds", values: [99] } });
  assert.deepEqual(absent.result.channels[0].edges, []);
  const role = buildStructuralProvider(source, { providerId: "role-subset-v1", parameters: { roles: ["arising"] } });
  assert.deepEqual(role.result.view.accounting.selectedEdgeIds, ["a->b", "c->d"]);
});

test("full-source topology and category validation cannot be bypassed by provider selections", () => {
  for (const change of [
    (g) => { g.edges[3].necessity = "unknown"; }, (g) => { delete g.edges[3].necessity; }
  ]) {
    const graph = control(); change(graph);
    assert.throws(() => buildStructuralProvider(packFor(graph), { providerId: "necessity-filtration-v1" }), (e) => e.code === "STRUCTURAL_EXPERIMENT_CATEGORY_INVALID");
  }
  for (const change of [
    (g) => { g.edges[3].source = g.edges[3].target; },
    (g) => { g.edges[3].relationLayer = "annotation"; },
    (g) => { g.edges.push({ ...g.edges[0], id: "duplicate-pair" }); }
  ]) {
    const graph = control(); change(graph);
    assert.throws(() => buildStructuralProvider(packFor(graph), channels));
  }
  const graph = control(); graph.edges[0].interactionModeIds = [0, 0];
  assert.throws(() => buildStructuralProvider(packFor(graph), channels), (e) => e.code === "STRUCTURAL_EXPERIMENT_CHANNEL_INVALID");
});

test("numeric consumers reject every discrete provider even if an attacker adds fabricated lengths", () => {
  const source = packFor(control());
  for (const input of [{ providerId: "necessity-filtration-v1" }, { providerId: "role-subset-v1", parameters: { roles: ["arising"] } }, channels]) {
    const a = structuredClone(buildStructuralProvider(source, input));
    a.result.edges = [{ id: "a->b", length: fraction(1) }];
    assert.throws(() => requireStructuralMetricValues(a, source, input), code("CAPABILITY_UNSUPPORTED"));
    assert.throws(() => analyzeStructuralGeometryWithProvider(source, { analysis: "structural-metric-experiment", metricProviderId: input.providerId }), code("CAPABILITY_UNSUPPORTED"));
  }
  const a = buildStructuralProvider(source, weighted);
  assert.deepEqual(requireStructuralMetricValues(a, source, weighted), a.result);
  assert.throws(() => requireStructuralMetricValues(a, source, unit), code("VERIFICATION_FAILED"));
});

test("source-bound verification rejects rehashed metric, policy, context, membership and legacy-output tampering", () => {
  const source = packFor(control());
  for (const mutate of [
    (a) => { a.result.edges[0].length = fraction(9); }, (a) => { a.result.nodes.pop(); },
    (a) => { a.context.normalizationContext = "selected-only"; },
    (a) => { a.context.dictionaryHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.provider.version = "2"; }, (a) => { a.request.parameters.extra = true; }
  ]) {
    const a = structuredClone(buildStructuralProvider(source, weighted)); mutate(a);
    assert.throws(() => verifyStructuralProviderArtifact(resign("artifact", a), source, weighted), code("VERIFICATION_FAILED"));
  }
  const a = structuredClone(buildStructuralProvider(source, channels)); a.result.channels[0].accounting.missingChannelEdgeIds.push("a->b");
  assert.throws(() => verifyStructuralProviderArtifact(resign("artifact", a), source, channels), code("VERIFICATION_FAILED"));
  const input = { analysis: "structural-metric-experiment", metricProviderId: "inverse-target-share-v1", selection: { kind: "roles", roles: ["arising"] } };
  for (const mutate of [
    (a) => { a.legacyArtifact.result.edges[0].curvature.lowerTicks = "123"; },
    (a) => { a.viewArtifact.result.view.edges.pop(); }, (a) => { a.metricArtifact.result.edges.pop(); },
    (a) => { a.request.selection.roles = ["maintenance"]; }
  ]) {
    const a = structuredClone(analyzeStructuralGeometryWithProvider(source, input)); mutate(a);
    assert.throws(() => verifyStructuralProviderAnalysis(resign("analysis", a), source, input), code("VERIFICATION_FAILED"));
  }
});

test("legacy root and experiment outputs replay exactly through provider envelopes without altering inputs", () => {
  for (const graph of controls) {
    const source = packFor(graph); const before = JSON.stringify(source);
    const input = { analysis: "structural-geometry", metricProviderId: "unit-v1" };
    const root = analyzeStructuralGeometryWithProvider(source, input);
    assert.deepEqual(root.legacyArtifact, analyzeStructuralGeometry(source));
    assert.deepEqual(verifyStructuralProviderAnalysis(root, source, input), root);
    for (const metricProviderId of ["unit-v1", "inverse-target-share-v1"]) {
      const request = { analysis: "structural-metric-experiment", metricProviderId };
      const a = analyzeStructuralGeometryWithProvider(source, request);
      assert.equal(canonicalize(a.legacyArtifact), canonicalize(analyzeStructuralMetricExperiment(source, { metricPolicyId: metricProviderId })));
      frozen(a);
    }
    assert.equal(JSON.stringify(source), before);
  }
});

test("unit provider agrees with every existing Ollivier scoped edge without changing its scope or policy", async () => {
  for (const f of await ollivierFixtures()) {
    const a = await readOllivier(`artifacts/${f.id}.json`);
    const metric = buildStructuralProvider(f.pack, unit);
    assert.equal(metric.context.sourceProjectionHash, a.request.sourceProjectionHash);
    const values = new Map(metric.result.edges.map((e) => [e.id, e.length]));
    for (const edge of a.request.graph.edges) assert.deepEqual(values.get(edge.id), fraction(1));
    assert.equal(a.request.policy.id, "ollivier-directed-in-out-unit-v1");
  }
});

test("view-edge occurrence bound accepts 32768 and rejects a larger result without truncation", () => {
  const nodes = Array.from({ length: 33 }, (_, i) => ({ id: `n${i}` }));
  const values = Array.from({ length: 32 }, (_, i) => i);
  const edges = nodes.flatMap((a) => nodes.filter((b) => a.id !== b.id).map((b) => ({
    id: `${a.id}->${b.id}`, source: a.id, target: b.id, interactionModeIds: values })));
  const input = { ...channels, parameters: { field: "interactionModeIds", values } };
  const accepted = buildStructuralProvider(packFor({ id: "view-budget", nodes, edges: edges.slice(0, 1024) }), input);
  assert.equal(accepted.result.channels.reduce((total, view) => total + view.edges.length, 0), 32768);
  assert.throws(() => buildStructuralProvider(packFor({ id: "view-budget", nodes, edges: edges.slice(0, 1025) }), input), code("LIMIT_EXCEEDED"));
});

test("both provider engine definitions are opt-in, use the authentic Model bridge and match direct replay", async () => {
  const source = packFor(control());
  const raw = createStructuralMetricProviderAnalysis(); const wrapped = createStructuralProviderAnalysis();
  const engine = await Onto2D.create({ models: [source], analyses: [raw, wrapped] });
  assert.deepEqual(await engine.analyze("structural-metric-provider", weighted), buildStructuralProvider(source, weighted));
  const input = { analysis: "structural-metric-experiment", metricProviderId: "inverse-target-share-v1" };
  assert.deepEqual(await engine.analyze("structural-provider-analysis", input), analyzeStructuralGeometryWithProvider(source, input));
  assert.throws(() => raw.run({ model: {} }, weighted));
  assert.throws(() => wrapped.run({ model: {} }, input));
  const plain = await Onto2D.create({ models: [source] });
  await assert.rejects(() => plain.analyze("structural-metric-provider", unit));
});
