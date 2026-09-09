import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { prepareAnatomy, computeGeometry } from "../../celegans/anatomy.mjs";
import { planWindows, extractResponses, matchedPopulation } from "../../celegans/intake.mjs";
import { python as extract } from "../../celegans/io.mjs";
import { averageRanks } from "../../protocol/metrics.mjs";
import { evaluateRows, pairedSummary } from "../../dream4/evaluation.mjs";
import { HERE, readJson, realDirectories } from "./io.mjs";

const key = row => JSON.stringify([row.source, row.target]);
export const targetValues = rows => rows.map(({ x, ...row }) => row);
export const groupsOf = rows => [...new Set(rows.map(row => row.groupId))].sort().map(id => {
  const selected = rows.filter(row => row.groupId === id);
  return { id, targetCount: selected.length, interventionIds: [...new Set(selected.map(row => row.interventionId))].sort() };
});

/** Target overlap is determined before any fitting; predictions never enter it. */
export function matchAnatomies(left, right) {
  assert.equal(left.anatomy.id, "Dataset7"); assert.equal(right.anatomy.id, "Dataset8");
  const inputs = [left, right];
  const maps = inputs.map(data => {
    const rows = data.matched.population.rows.filter(row => row.eligible);
    const result = new Map(rows.map(row => [key(row), row]));
    assert.equal(result.size, rows.length); return result;
  });
  const candidates = [...new Set(maps.flatMap(map => [...map.keys()]))].sort().map(id => {
    const rows = maps.map(map => map.get(id)), [source, target] = JSON.parse(id);
    const shared = rows.every(Boolean);
    if (shared) {
      // Compare the complete measurement lineage, including unavailable trials.
      const trials = inputs.map(data => data.responses.trials.filter(row => key(row) === id));
      assert.deepEqual(trials[0], trials[1], `Shared measurement lineage differs: ${id}`);
      for (const field of ["magnitude", "measuredRecordings", "recordings", "recordingIds"])
        assert.deepEqual(rows[0][field], rows[1][field], `Shared aggregate differs: ${id}/${field}`);
    }
    return { source, target, inDataset7: Boolean(rows[0]), inDataset8: Boolean(rows[1]),
      magnitude: shared ? rows[0].magnitude : null, shared,
      reason: shared ? null : rows[0] ? "absent-from-Dataset8-eligible-population" : "absent-from-Dataset7-eligible-population" };
  });
  const groups = [...new Set(candidates.map(row => row.source))].sort().map(id => {
    const rows = candidates.filter(row => row.source === id && row.shared);
    const distinct = new Set(rows.map(row => row.magnitude)).size;
    const reason = rows.length < 3 ? "fewer-than-three-shared-receivers" : distinct < 2 ? "fewer-than-two-distinct-target-magnitudes" : null;
    return { id, sharedReceiverCount: rows.length, distinctMagnitudeCount: distinct, eligible: reason === null, reason };
  });
  const accepted = new Set(groups.filter(row => row.eligible).map(row => row.id));
  const rows = inputs.map((data, index) => {
    const features = new Map(data.matched.rows.map(row => [key(row), row]));
    return groups.filter(group => group.eligible).flatMap(group => {
      const selected = candidates.filter(row => row.source === group.id && row.shared);
      const ranks = averageRanks(selected.map(row => row.magnitude));
      return selected.map((row, i) => ({ ...maps[index].get(key(row)), rank: ranks[i], y: (ranks[i] - 1) / (selected.length - 1),
        x: features.get(key(row))?.x ?? null }));
    });
  });
  return { candidates, groups, status: accepted.size >= 5 ? "complete" : "unavailable",
    reason: accepted.size >= 5 ? null : "fewer-than-five-shared-source-groups", rows };
}

export function evaluate(rows, reason = null, costs = null) {
  if (reason !== null) return { report: { status: "unavailable", reason, primary: null }, trace: null };
  assert.ok(groupsOf(rows).length >= 5);
  assert.ok(rows.every(row => Array.isArray(row.x) && row.x.length === 54 && row.x.every(Number.isFinite)));
  try { return evaluateRows(rows, costs); }
  catch (error) { return { report: { status: "unavailable", reason: "required-model-computation-failed", diagnostic: error.message, primary: null }, trace: null }; }
}

export function compareMatched(studies) {
  const [left, right] = studies;
  if (studies.some(row => row.status !== "complete")) return { status: "unavailable", reason: "both-matched-studies-required", comparisons: null };
  const difference = (a, b) => {
    const result = pairedSummary(a, b);
    return { ...result, interpretation: result.meanDelta > 0 ? "Dataset8-higher" : result.meanDelta < 0 ? "Dataset7-higher" : "equal-anatomy-scores" };
  };
  const baseline = name => difference(right.ablations[name].groups, left.ablations[name].groups);
  const gains = study => study.primary.groups.map(row => ({ id: row.id, meanRankSkill: row.delta }));
  return { status: "complete", reason: null, comparisons: {
    baseline: baseline("B"), full: baseline("B+F+O+flow"), geometryGain: difference(gains(right), gains(left)) } };
}

export async function computeAllScopes(anatomy, files, onComplete = () => {}, compute = computeGeometry) {
  const results = [];
  for (const [i, scope] of anatomy.roots.entries()) {
    if (!anatomy.scopes[i].eligible) continue;
    const start = performance.now(); let result;
    try {
      [result] = await compute({ ...anatomy, roots: [scope], scopes: [anatomy.scopes[i]] }, files);
      assert.ok(result); assert.equal(result.source, scope.root);
    } catch (error) {
      // D5's helper already returns ordinary declared work-limit failures. The
      // additional flow arithmetic bound is a computation refusal, never a
      // replacement terminal state. Integrity/programming errors still abort.
      if (error?.code !== "STRUCTURAL_FLOW_NUMERIC_LIMIT") throw error;
      result = { source: scope.root, status: "unavailable", reason: error.code, scope };
    }
    results.push(result); onComplete(result, { elapsedMs: performance.now() - start, sampledRssBytes: process.memoryUsage().rss });
  }
  return results;
}

export async function prepareDataset8(dependency) {
  const start = performance.now();
  await realDirectories(["../../datasets/cache", "../../datasets/cache/prepared", "../../celegans/cache"]);
  const census = await readJson("../../datasets/census.json"), lock = await readJson("../../datasets/source-lock.json");
  const native = await readJson("../../datasets/cache/prepared/native.json", { hash: census.nativeSha256, maximum: 16000000 });
  const applicability = await readJson("../../datasets/cache/prepared/applicability.json", { hash: census.localApplicabilitySha256, maximum: 40000000 });
  const prior = await readJson("../../celegans/cache/details.json", { hash: dependency.localDetailsSha256, maximum: 64000000 });
  assert.equal(prior.format, "onto2d-celegans-local-replay-v1");
  const files = lock.files.filter(row => row.dataset === "celegans-witvliet-2021").map(row => ({ path: row.file, hash: `sha256:${row.sha256}` }));
  const anatomy = prepareAnatomy(native, applicability, files, "Dataset8");
  const mappings = applicability.mappings.filter(unit => unit.anatomicalUnitId === anatomy.id); assert.equal(mappings.length, 1);
  const plan = planWindows(native.randi.recordings, anatomy.parent.nodes, anatomy.scopes, mappings[0].recordings);
  const costs = { preparationMs: performance.now() - start, geometry: [], geometryMs: 0 };
  console.log(`D6.2 Dataset8: ${anatomy.scopes.filter(row => row.eligible).length} prepared scopes; ${plan.summary.eligibleEvents} eligible events; ${plan.requests.length} receiver windows.`);
  const geometry = await computeAllScopes(anatomy, files, (row, cost) => {
    costs.geometry.push({ source: row.source, ...cost }); costs.geometryMs += cost.elapsedMs;
    console.log(`D6.2 geometry ${row.status}: ${row.source}.`);
  });
  const entry = lock.files.find(row => row.dataset === "celegans-randi-2023");
  const archive = { sha256: entry.sha256, byte_length: entry.byteLength }; assert.deepEqual(native.randi.source, archive);
  const archivePath = fileURLToPath(new URL(`../../datasets/cache/${entry.file}`, HERE));
  const extracted = await extract("extract.py", [archivePath], { archive, recordings: native.randi.recordings, requests: plan.requests });
  costs.extraction = extracted.costs; assert.deepEqual(extracted.result.archive, archive);
  assert.equal(extracted.result.summary.verifiedMembers, native.randi.census.regular_members);
  assert.equal(extracted.result.summary.sourceNumericValues, native.randi.census.trace_values);
  assert.equal(extracted.result.summary.traceRows, native.randi.census.time_rows);
  const responses = extractResponses(plan, extracted.result.windows), matched = matchedPopulation(responses.trials, anatomy.scopes, geometry);
  return { census, archivePath, costs, prior: prior.data,
    data: { format: "onto2d-celegans-prepared-study-v1", archive, recordings: native.randi.recordings,
      anatomy, plan, geometry, extracted: extracted.result, responses, matched } };
}
