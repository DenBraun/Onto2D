import assert from "node:assert/strict";
import test from "node:test";
import { compareStructuralSignatures } from "@onto2d/structural-geometry/pseudometric";
import { createStructuralFlowAnalyzer } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { buildGeometricSignature } from "@onto2d/structural-geometry/geometric-signature";
import { readJson, checkSources } from "../../../cases/structural-geometry/added-value/generate.mjs";
import { verifyUnit } from "../../../cases/structural-geometry/added-value/build.mjs";
import { BASELINES, LIMITS, encoded, seal, ratio, distance, eligibility, comparePair, summarize, outcome } from "../../../cases/structural-geometry/added-value/analysis.mjs";
const panel = await readJson("panel.json"), sources = await readJson("sources.json"), suite = await readJson("suite.json");
const get = async id => readJson(`artifacts/${id}.json`), request = id => panel.units.find(u => u.id === id);
const receipts = a => ({ ollivier: a.evidence.geometry.evidence.ollivier, flow: a.evidence.geometry.evidence.flow });
const id = suite.units.find(u => u.eligibility.combined).id, original = await get(id);

test("prospective source generation retains all proposals, orbit-disjoint units and fixed negative/invariance/development splits", async () => {
  const { panel: rebuilt } = await checkSources(); assert.deepEqual(rebuilt, panel);
  const bases = panel.units.filter(u => u.split === "evaluation" && u.variant === "base");
  assert.equal(new Set(bases.map(u => encoded(u.canonical))).size, 32);
  assert.equal(panel.pairs.filter(p => p.split === "evaluation").length, 496);
  assert.equal(panel.pairs.filter(p => p.split === "invariance").length, 32);
  assert.ok(panel.pairs.filter(p => p.split === "evaluation").every(p => p.truth === "different-directed-graph"));
  assert.ok(panel.pairs.filter(p => p.split === "invariance").every(p => p.truth === "same-directed-graph"));
});
test("primary evaluation preserves zero gain, all 286 exclusions and the empty degree-matched subgroup", () => {
  const s = suite.summary;
  assert.equal(s.primary.totalPairs, 496); assert.equal(s.primary.eligiblePairs, 210); assert.equal(s.primary.excludedPairs, 286);
  assert.deepEqual(s.primary.pairedGain, { numerator: 0, denominator: 1 });
  assert.equal(s.primary.both, 210); assert.equal(s.responseOnlyCoverage.lostToGeometry, 0);
  assert.equal(s.degreeMatched.totalPairs, 0); assert.equal(s.degreeMatched.status, "indeterminate"); assert.equal(s.degreeMatched.pairedGain, null);
  assert.equal(s.baselines.find(b => b.id === "degrees").distinguished, 210);
  assert.equal(s.invariance.eligiblePairs, 21); assert.equal(s.invariance.excludedPairs, 11); assert.equal(s.invariance.combinedFalseDifferences, 0);
  assert.deepEqual(summarize(suite.pairs), s);
});
test("representative complete, invariant and incomplete study distances agree with the unchanged R6 implementation", () => {
  // Distinct complete pairs, invariant pairs, and all three missing-tail controls.
  const chosen = [...suite.pairs.filter(p => p.eligible && p.split === "evaluation").slice(0, 4),
    suite.pairs.find(p => p.eligible && p.split === "invariance"), ...suite.pairs.filter(p => p.split === "development")];
  for (const p of chosen) {
    const result = compareStructuralSignatures(sources[p.left], sources[p.right], { regimeId: "topology-only-v1" });
    assert.deepEqual(p.raw.response, result.distance, p.id);
  }
});
test("early-stop geometry never acquires full comparison coverage or removes the raw response result", async () => {
  const p = suite.pairs.find(p => p.left === "development-feedback" && p.right === "development-isolate");
  assert.deepEqual(p.raw.response, { numerator: 0, denominator: 1 }); assert.equal(p.raw.combined, null);
  assert.deepEqual(p.matched, { response: null, static: null, combined: null }); assert.ok(p.reasons.some(r => r.code.includes("after-")));
  const missing = await get("development-path"); assert.equal(missing.eligibility.response, false); assert.equal(missing.eligibility.combined, false);
  assert.equal(outcome([]).pairedGain, null); assert.equal(outcome([p]).status, "indeterminate");
});
test("all 32 source transports retain exact response/geometry feature values, baseline values and eligibility", async () => {
  for (const p of panel.pairs.filter(p => p.split === "invariance")) {
    const a = await get(p.left), b = await get(p.right);
    assert.notEqual(a.unitHash, b.unitHash); assert.deepEqual(a.eligibility, b.eligibility); assert.deepEqual(a.baselines, b.baselines);
    for (const name of ["response", "geometry"]) {
      assert.deepEqual(a.evidence[name].features.map(f => ({ state: f.state, value: f.value, coverage: f.coverage })),
        b.evidence[name].features.map(f => ({ state: f.state, value: f.value, coverage: f.coverage })), `${p.id}: ${name}`);
    }
    const pair = comparePair(p, a, b); assert.ok(BASELINES.every(k => pair.baselines[k] === 0));
  }
});
test("expected-source unit replay is immutable and rejects rehashed values, baselines, denominators, contexts and certificates", () => {
  const u = request(id), expectedEvidence = receipts(original), before = encoded({ source: sources[id], u, expectedEvidence });
  const check = value => verifyUnit(value, u, sources[id], panel.config, original.baselines.refinement, original.studyHash, expectedEvidence);
  const verified = check(original); assert.ok(Object.isFrozen(verified)); assert.ok(Object.isFrozen(verified.evidence.geometry));
  assert.equal(encoded({ source: sources[id], u, expectedEvidence }), before);
  for (const mutate of [a => { a.baselines.spectrum[0]++; }, a => { a.baselines.degrees[0].count++; },
    a => { a.eligibility.combined = false; }, a => { a.work.transportProblems++; }, a => { a.source.contextHash = "sha256:" + "0".repeat(64); },
    a => { a.evidence.response.features[0].value[0].count++; }, a => { a.evidence.geometry.features[2].coverage.numerator--; },
    a => { a.evidence.geometry.evidence.flow.states.pop(); }, a => { a.baselines.refinement.pop(); }, a => { a.studyHash = "sha256:" + "0".repeat(64); }]) {
    const copy = structuredClone(original); mutate(copy); delete copy.unitHash;
    assert.throws(() => check(seal("unit", copy, LIMITS.unitBytes)));
  }
});
test("comparison conditioning rejects non-unit metrics, altered horizons, partial edges and cross-population evidence", async () => {
  for (const change of [g => { g.request.flow.maxIterations = 3; }, g => { g.request.flow.initialLengths[0].length.numerator = "2"; },
    g => { g.profile.flow.initialization = "explicit-source-lengths"; }, g => { g.request.ollivier.edgeIds.pop(); },
    g => { g.population.nodeIds.pop(); }, g => { g.request.forman.metricProviderId = "inverse-target-share-v1"; },
    g => { g.features[0].value.distribution[0].value.upper.numerator = "100"; }]) {
    const g = structuredClone(original.evidence.geometry); change(g); assert.throws(() => eligibility(original.evidence.response, g));
  }
  const u = request(id), changed = { ...u.geometryInput, flow: { ...u.geometryInput.flow, maxIterations: 1 } };
  const adapter = createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter());
  const receipt = await adapter.analyze(sources[id], changed.flow);
  const g = buildGeometricSignature(sources[id], changed, { ...receipts(original), flow: receipt });
  assert.throws(() => eligibility(original.evidence.response, g));
  assert.throws(() => verifyUnit(original, u, sources[id], panel.config, original.baselines.refinement, original.studyHash, { ollivier: null, flow: receipt }));
});
test("fixed categorical A, static and B obey metric laws on every eligible base unit and retain exact fractions", async () => {
  const units = await Promise.all(suite.units.filter(u => u.eligibility.combined && request(u.id).variant === "base").map(u => get(u.id)));
  const coordinates = units.map(u => [...u.evidence.response.features, ...u.evidence.geometry.features].map(f => encoded(f.value)));
  for (const count of [3, 5, 6]) {
    const values = coordinates.map(v => v.slice(0, count));
    const matrix = values.map(a => values.map(b => distance(a, b)));
    for (let i = 0; i < matrix.length; i++) for (let j = 0; j < matrix.length; j++) {
      assert.deepEqual(matrix[i][j], matrix[j][i]); if (i === j) assert.deepEqual(matrix[i][j], { numerator: 0, denominator: 1 });
      for (let k = 0; k < matrix.length; k++) {
        const a = matrix[i][k], b = matrix[i][j], c = matrix[j][k];
        assert.ok(a.numerator * b.denominator * c.denominator <= (b.numerator * c.denominator + c.numerator * b.denominator) * a.denominator);
      }
    }
  }
  assert.deepEqual(ratio(4, 6), { numerator: 2, denominator: 3 }); assert.equal(ratio(0, 0), null);
  for (const args of [[-1, 2], [3, 2], [1, 0], [0.5, 2]]) assert.throws(() => ratio(...args));
});
test("suite evidence links and byte/work accounting retain every measured source without duplicate pair payloads", async () => {
  let bytes = 0;
  for (const row of suite.units) { const unit = await get(row.id); assert.equal(row.unitHash, unit.unitHash); assert.deepEqual(row.work, unit.work); bytes += row.bytes; }
  assert.equal(bytes, suite.work.storedUnitBytes); assert.ok(bytes <= LIMITS.totalUnitBytes);
  const units = new Map(suite.units.map(u => [u.id, u]));
  for (const p of suite.pairs) { assert.equal(p.evidence.leftUnitHash, units.get(p.left).unitHash); assert.equal(p.evidence.rightUnitHash, units.get(p.right).unitHash); }
  assert.equal(suite.work.pairComparisons, 531);
});
