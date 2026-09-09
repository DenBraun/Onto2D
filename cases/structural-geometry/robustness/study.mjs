import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildModelPack } from "@onto2d/model-pack";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { createOllivierAnalyzer } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { createStructuralFlowAnalyzer } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { check, sha256 } from "../protocol/check.mjs";
import { verifyReport as verifyDream } from "../dream4/build.mjs";
import { verifyReport as verifyWorm } from "../celegans/build.mjs";
import { evaluateRows } from "../dream4/evaluation.mjs";
import { collectPairGeometry, FLOW_INPUT } from "../dream4/geometry.mjs";
import { digest, normalizeGraph } from "../datasets/scopes.mjs";
import { NULL_PROFILE, sampleNull } from "./nulls.mjs";
import { HERE, readJson, realDirectories } from "./io.mjs";

export const scopeId = (datasetId, root) => JSON.stringify([datasetId, root]);
export const targetValues = rows => rows.map(({ x, ...row }) => row);
export const rowScope = (studyId, row) => studyId.startsWith("dream4-") ? scopeId(row.groupId, null) : scopeId("Dataset7", row.source);

export async function loadSources() {
  const protocol = await check(), dream = await verifyDream(), worm = await verifyWorm();
  await realDirectories(["../dream4/cache", "../celegans/cache"]);
  const d4 = await readJson("../dream4/cache/details.json", { hash: dream.localDetailsSha256, maximum: 24000000 });
  const d5 = await readJson("../celegans/cache/details.json", { hash: worm.localDetailsSha256, maximum: 64000000 });
  assert.equal(d4.format, "onto2d-dream4-local-replay-v1"); assert.equal(d5.format, "onto2d-celegans-local-replay-v1");
  assert.equal(d5.evaluationState.status, "complete");
  const originals = d4.geometry.map(unit => {
    assert.equal(unit.status, "complete");
    assert.deepEqual(unit.graph, normalizeGraph(d4.units.find(row => row.id === unit.id)));
    return { id: scopeId(unit.id, null), datasetId: unit.id, root: null, graph: unit.graph, originalGraphSha256: digest(unit.graph) };
  });
  for (const row of d5.data.geometry) {
    assert.equal(row.status, "complete"); assert.equal(digest(row.scope.graph), row.scope.graphHash);
    originals.push({ id: scopeId("Dataset7", row.source), datasetId: "Dataset7", root: row.source,
      graph: row.scope.graph, originalGraphSha256: row.scope.graphHash });
  }
  assert.equal(originals.length, 34); assert.equal(new Set(originals.map(row => row.id)).size, originals.length);
  const targets = ["knockouts", "knockdowns"].map(contrast => ({ id: `dream4-${contrast}`,
    rows: targetValues(d4.traces[contrast].rows), original: dream.results.find(row => row.contrast === contrast) }));
  targets.push({ id: "celegans-Dataset7", rows: targetValues(d5.trace.rows), original: worm.study });
  for (const study of targets) {
    assert.equal(study.original.status, "complete");
    assert.equal(new Set(study.rows.map(row => row.id)).size, study.rows.length);
    assert.ok(study.rows.every(row => row.eligible && originals.some(graph => graph.id === rowScope(study.id, row))));
  }
  const sourceFiles = await Promise.all(["dream4", "celegans"].map(async name => ({
    path: `cases/structural-geometry/${name}/results.json`, hash: `sha256:${sha256(await readFile(new URL(`../${name}/results.json`, HERE)))}`
  })));
  return { protocol, originals, targets, sourceFiles, dependencies: { dream4: dream.reportSha256, celegans: worm.reportSha256 } };
}

export async function measureNull(original, sampled, sourceFiles) {
  assert.equal(sampled.status, "complete"); assert.equal(sampled.originalGraphSha256, original.originalGraphSha256);
  assert.equal(sampled.datasetId, original.datasetId); assert.equal(sampled.root, original.root);
  const mapping = sampled.graph.nodes.map((sourceId, i) => ({ sourceId, nodeId: `n${String(i).padStart(4, "0")}` }));
  const ids = new Map(mapping.map(row => [row.sourceId, row.nodeId]));
  const binding = { profileId: NULL_PROFILE.id, datasetId: original.datasetId, root: original.root,
    originalGraphSha256: original.originalGraphSha256, graphSha256: sampled.graphSha256, nullIndex: sampled.nullIndex };
  const pack = buildModelPack({ model: { id: `biological-null-${digest(binding).slice(0, 24)}`, version: "1",
    name: "Constrained synthetic graph null", status: "synthetic" },
    source: { id: NULL_PROFILE.id, files: sourceFiles, auditHash: `sha256:${digest(binding)}` },
    nodes: mapping.map(row => ({ id: row.nodeId })),
    edges: sampled.graph.edges.map((edge, i) => ({ id: `e${String(i).padStart(5, "0")}`, source: ids.get(edge.source),
      target: ids.get(edge.target), relationLayer: "source-parent" })), dictionaries: {} });
  try {
    const artifacts = { forman: analyzeStructuralGeometry(pack),
      ollivier: await createOllivierAnalyzer(createPythonOllivierAdapter()).analyze(pack, {
        edgeIds: pack.files["model/edges.json"].map(row => row.id), idleness: "half" }),
      flow: await createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter()).analyze(pack, FLOW_INPUT) };
    const geometry = collectPairGeometry({ graph: sampled.graph, pack, mapping, artifacts });
    return { status: "complete", reason: null, pack, mapping, artifacts, geometry };
  } catch (error) {
    if (!error.code?.endsWith("LIMIT_EXCEEDED")) throw error;
    return { status: "unavailable", reason: error.code };
  }
}

export function evaluateNullStudy(target, scopes, costs = null) {
  const byId = new Map(scopes.map(row => [row.id, row]));
  assert.equal(byId.size, scopes.length);
  const required = [...new Set(target.rows.map(row => rowScope(target.id, row)))].sort();
  assert.ok(required.every(id => byId.has(id)), "Every original target-bearing scope must be retained.");
  const failures = required.flatMap(id => {
    const scope = byId.get(id);
    return scope.sampled.status !== "complete" ? [{ id, phase: "sampling", reason: scope.sampled.reason }] :
      scope.measured.status !== "complete" ? [{ id, phase: "geometry", reason: scope.measured.reason }] : [];
  });
  if (failures.length) return { status: "unavailable", reason: "complete-matched-null-population-required", failures, report: null, trace: null };
  const features = new Map();
  for (const id of required) for (const pair of byId.get(id).measured.geometry.pairs) {
    const key = JSON.stringify([id, pair.source, pair.target]);
    assert.ok(!features.has(key)); features.set(key, [...pair.baseline, ...pair.geometry]);
  }
  const rows = target.rows.map(row => {
    const x = features.get(JSON.stringify([rowScope(target.id, row), row.source, row.target]));
    assert.ok(x, "Null geometry must retain every original eligible pair, including newly unreachable pairs.");
    return { ...row, x };
  });
  assert.deepEqual(targetValues(rows), target.rows);
  try { return { status: "complete", reason: null, failures: [], ...evaluateRows(rows, costs) }; }
  catch (error) {
    return { status: "unavailable", reason: "required-null-model-computation-failed", diagnostic: error.message,
      failures: [], report: null, trace: null };
  }
}

export async function runReplicate(sources, nullIndex) {
  const scopes = [], costs = { nullIndex, scopes: [], evaluation: {} };
  for (const original of sources.originals) {
    const start = performance.now();
    const sampled = sampleNull({ datasetId: original.datasetId, root: original.root, graph: original.graph,
      originalGraphSha256: original.originalGraphSha256, nullIndex });
    const samplingMs = performance.now() - start, geometryStart = performance.now();
    const measured = sampled.status === "complete" ? await measureNull(original, sampled, sources.sourceFiles) :
      { status: "not-run", reason: "sampling-unavailable" };
    scopes.push({ id: original.id, sampled, measured });
    costs.scopes.push({ id: original.id, samplingMs, geometryMs: performance.now() - geometryStart,
      sampledRssBytes: process.memoryUsage().rss });
  }
  const studies = sources.targets.map(target => {
    const timing = {}; costs.evaluation[target.id] = timing;
    return { id: target.id, ...evaluateNullStudy(target, scopes, timing) };
  });
  return { details: { format: "onto2d-biological-degree-null-replicate-v1", nullIndex, scopes, studies }, costs };
}
