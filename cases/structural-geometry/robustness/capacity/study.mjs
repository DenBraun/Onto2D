import assert from "node:assert/strict";
import { verifyReport as verifyDream } from "../../dream4/build.mjs";
import { verifyReport as verifyWorm } from "../../celegans/build.mjs";
import { digest, normalizeGraph } from "../../datasets/scopes.mjs";
import { graphCapacityFeatures, PROFILE } from "./features.mjs";
import { readJson, realDirectories } from "./io.mjs";

export const scopeId = (datasetId, root) => JSON.stringify([datasetId, root]);
export const rowScope = (id, row) => id.startsWith("dream4-") ? scopeId(row.groupId, null) : scopeId("Dataset7", row.source);
export const targetValues = rows => rows.map(({ x, ...row }) => row);
export const groupsOf = rows => [...new Set(rows.map(row => row.groupId))].sort().map(id => {
  const selected = rows.filter(row => row.groupId === id);
  return { id, targetCount: selected.length, interventionIds: [...new Set(selected.map(row => row.interventionId))].sort() };
});

export async function loadSources() {
  const dream = await verifyDream(), worm = await verifyWorm();
  await realDirectories(["../../dream4/cache", "../../celegans/cache"]);
  const d4 = await readJson("../../dream4/cache/details.json", { hash: dream.localDetailsSha256, maximum: 24000000 });
  const d5 = await readJson("../../celegans/cache/details.json", { hash: worm.localDetailsSha256, maximum: 64000000 });
  assert.equal(d4.format, "onto2d-dream4-local-replay-v1"); assert.equal(d5.format, "onto2d-celegans-local-replay-v1");
  const scopes = d4.geometry.map(unit => {
    assert.equal(unit.status, "complete"); assert.deepEqual(unit.graph, normalizeGraph(d4.units.find(row => row.id === unit.id)));
    return { id: scopeId(unit.id, null), datasetId: unit.id, root: null, graph: unit.graph, geometry: unit.geometry };
  });
  for (const row of d5.data.geometry) {
    assert.equal(row.status, "complete"); assert.equal(digest(row.scope.graph), row.scope.graphHash);
    scopes.push({ id: scopeId("Dataset7", row.source), datasetId: "Dataset7", root: row.source, graph: row.scope.graph, geometry: row.geometry });
  }
  assert.equal(scopes.length, 34); assert.equal(new Set(scopes.map(row => row.id)).size, 34);
  const targets = ["knockouts", "knockdowns"].map(contrast => ({ id: `dream4-${contrast}`, rows: d4.traces[contrast].rows,
    original: dream.results.find(row => row.contrast === contrast) }));
  targets.push({ id: "celegans-Dataset7", rows: d5.trace.rows, original: worm.study });
  assert.deepEqual(targets.map(row => row.id), PROFILE.studies);
  for (const target of targets) { assert.equal(target.original.status, "complete"); assert.ok(target.rows.every(row => row.eligible)); }
  return { scopes, targets, dependencies: { dream4: dream.reportSha256, celegans: worm.reportSha256 } };
}

export function prepareFeatures(sources) {
  const scopes = [], costs = [];
  for (const scope of sources.scopes) {
    const start = performance.now();
    // Bounds refuse the complete run; source/target coverage never shrinks.
    const features = graphCapacityFeatures(scope.graph);
    assert.deepEqual(features.pairs.map(row => [row.source, row.target, row.baseline]), scope.geometry.pairs.map(row => [row.source, row.target, row.baseline]));
    scopes.push({ ...scope, features }); costs.push({ id: scope.id, elapsedMs: performance.now() - start, sampledRssBytes: process.memoryUsage().rss });
  }
  const lookup = new Map(scopes.flatMap(scope => scope.features.pairs.map((row, i) => [JSON.stringify([scope.id, row.source, row.target]),
    [...row.baseline, ...row.quadratic, ...row.expanded, ...scope.geometry.pairs[i].geometry]])));
  const targets = sources.targets.map(target => {
    const rows = target.rows.map(row => {
      const x = lookup.get(JSON.stringify([rowScope(target.id, row), row.source, row.target]));
      assert.ok(x); assert.equal(x.length, 116);
      assert.deepEqual([...x.slice(0, 23), ...x.slice(85)], row.x, "Frozen primary feature join differs.");
      return { ...row, x };
    });
    assert.deepEqual(targetValues(rows), targetValues(target.rows));
    return { ...target, rows };
  });
  return { scopes, targets, costs };
}
