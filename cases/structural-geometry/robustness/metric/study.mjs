import assert from "node:assert/strict";
import { verifyReport as verifyCapacity } from "../capacity/build.mjs";
import { realDirectories } from "../capacity/io.mjs";
import { rowScope, targetValues } from "../capacity/study.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { PROFILE, carrier, measure, semanticGeometry } from "./geometry.mjs";
import { evaluate, unavailable } from "./evaluation.mjs";
import { readJson } from "./io.mjs";

export async function loadSources() {
  const capacity = await verifyCapacity();
  await realDirectories(["cache"]);
  const details = await readJson("../capacity/cache/details.json", { hash: capacity.localDetailsSha256, maximum: 40000000 });
  assert.equal(details.format, "onto2d-biological-capacity-local-replay-v1");
  assert.deepEqual(details.scopes.map(s => s.id), capacity.scopes.map(s => s.id));
  for (const [i, scope] of details.scopes.entries()) {
    assert.equal(digest(scope.graph), capacity.scopes[i].graphSha256);
    assert.equal(digest(scope.features), capacity.scopes[i].featuresSha256);
    assert.equal(digest(scope.geometry), capacity.scopes[i].geometrySha256);
  }
  assert.deepEqual(details.studies.map(s => s.id), PROFILE.studies);
  details.studies.forEach((study, i) => assert.deepEqual(targetValues(study.trace.rows), capacity.studies[i].targets));
  return { capacity, scopes: details.scopes, targets: details.studies.map((s, i) => ({ id: s.id, rows: s.trace.rows, original: capacity.studies[i] })) };
}

export const auditOf = capacity => ({ format: "onto2d-metric-source-audit-v1", profileChoicesSha256: digest(PROFILE),
  comparativeScoresComputed: false, capacityReportSha256: capacity.reportSha256, scopes: capacity.scopes,
  targets: capacity.studies.map(s => ({ id: s.id, targetCount: s.targets.length, targetValuesSha256: digest(s.targets), groups: s.report.ablations.B.groups.map(g => ({ id: g.id, targetCount: g.targetCount })) })) });
export function failuresFor(targetId, scopes) {
  return scopes.filter(s => (targetId.startsWith("dream4-") ? s.datasetId !== "Dataset7" : s.datasetId === "Dataset7") && s.measured.status !== "complete")
    .map(s => ({ id: s.id, reason: s.measured.reason }));
}
export function joinRows(target, scopes) {
  const lookup = new Map(scopes.flatMap(s => s.measured.status === "complete" ? s.measured.geometry.pairs.map(p => [JSON.stringify([s.id, p.source, p.target]), p]) : []));
  return target.rows.map(row => {
    const p = lookup.get(JSON.stringify([rowScope(target.id, row), row.source, row.target])); assert.ok(p);
    assert.deepEqual(p.baseline, row.x.slice(0, 23));
    return { ...row, x: [...row.x.slice(0, 85), ...p.geometry] };
  });
}

export async function runVariant(sources, variantId) {
  const scopes = [], costs = { variantId, scopes: [], evaluation: {} };
  for (const source of sources.scopes) {
    const start = performance.now(), context = carrier(source.graph, source.id);
    assert.deepEqual(context.graph, source.graph, "Primary scoped graph ordering differs.");
    const measured = await measure(context, variantId, source.geometry.fields.map(row => row.ollivier));
    if (["unit-half", "double-unit-initial"].includes(variantId)) {
      assert.equal(measured.status, "complete"); assert.deepEqual(semanticGeometry(measured.geometry), semanticGeometry(source.geometry));
    }
    scopes.push({ id: source.id, datasetId: source.datasetId, root: source.root, context, measured });
    costs.scopes.push({ id: source.id, elapsedMs: performance.now() - start, sampledRssBytes: process.memoryUsage().rss });
    if (measured.status !== "complete") console.log(`D6.4 ${variantId} ${source.id}: ${measured.reason}`);
  }
  const studies = sources.targets.map(target => {
    const failures = failuresFor(target.id, scopes), measured = {}; costs.evaluation[target.id] = measured;
    if (failures.length) return { id: target.id, report: unavailable(failures), trace: null };
    const rows = joinRows(target, scopes); assert.deepEqual(targetValues(rows), targetValues(target.rows));
    const result = evaluate(rows, target.original.report, measured);
    if (["unit-half", "double-unit-initial"].includes(variantId)) for (const name of PROFILE.models) {
      assert.deepEqual(result.report.models[name].summary, target.original.report.ablations[name]);
      assert.deepEqual(result.report.models[name].outerEvidence, target.original.outerEvidence[name]);
      assert.deepEqual(result.report.models[name].capacity, target.original.report.capacity[name]);
    }
    return { id: target.id, ...result };
  });
  return { details: { format: "onto2d-metric-variant-local-v1", variantId, scopes, studies }, costs };
}
