import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { buildGeometricSignature, verifyGeometricSignature, createGeometricSignatureAnalysis, GEOMETRIC_SIGNATURE_POLICY } from "@onto2d/structural-geometry/geometric-signature";
import { GEOMETRIC_CODEC, geometricHash, geometricEncoded, scalarDescriptor, thresholdEvents } from "../src/geometric-signature-core.js";
import { fixtures, readJson } from "../../../cases/structural-geometry/geometric-signatures/fixtures.mjs";
const examples = await fixtures(), source = id => examples.find(f => f.id === id);
const artifacts = new Map(await Promise.all(examples.map(async f => [f.id, await readJson(`artifacts/${f.id}.json`)])));
const get = id => artifacts.get(id), evidence = a => ({ ollivier: a.evidence.ollivier, flow: a.evidence.flow });
const run = f => buildGeometricSignature(f.pack, f.input, evidence(get(f.id)));
const frozen = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const resign = a => { const { artifactHash, ...body } = a; return { ...body, artifactHash: geometricHash("artifact", body) }; };
const q = n => ({ numerator: String(n), denominator: "1" });

test("composition preserves expected source/request/evidence bytes and deeply freezes the whole artifact", () => {
  const f = structuredClone(source("path")), expected = structuredClone(evidence(get(f.id))), before = canonicalize({ f, expected }, GEOMETRIC_CODEC);
  const a = buildGeometricSignature(f.pack, f.input, expected);
  assert.equal(canonicalize({ f, expected }, GEOMETRIC_CODEC), before); assert.deepEqual(a, get(f.id)); frozen(a); frozen(GEOMETRIC_SIGNATURE_POLICY);
  assert.deepEqual(a.evidence.flow, expected.flow); assert.deepEqual(a.evidence.ollivier, expected.ollivier);
});
test("whole values require all three complete families; measured partial descriptors remain available", () => {
  let complete = 0;
  for (const a of artifacts.values()) {
    assert.deepEqual(a.features.map(f => f.id), GEOMETRIC_SIGNATURE_POLICY.layers);
    assert.equal(a.summary.coverage.denominator, 3);
    if (a.summary.status === "complete") {
      complete += 1; assert.ok(a.features.every(f => f.state === "observed" && f.coverage.complete));
      assert.deepEqual(a.value, { features: a.features.map(f => ({ id: f.id, value: f.value })) }); assert.ok(a.valueHash);
    } else { assert.equal(a.value, null); assert.equal(a.valueHash, null); assert.ok(a.features.some(f => f.state !== "observed")); }
    for (const f of a.features) assert.equal(f.value === null, f.state === "unavailable");
  }
  assert.equal(complete, 4);
  assert.equal(get("path").features[2].value.termination.reason, "iteration-limit");
  assert.equal(get("complete-one-step").features[2].value.termination.reason, "fixed-point");
});
test("certified intervals retain both endpoints, uncertainty and multiplicity without midpoint conversion", () => {
  const f = get("weighted-irrational-feedback").features[0]; assert.equal(f.state, "observed"); assert.equal(f.value.numeric, "certified-interval");
  assert.ok(f.value.distribution.some(r => canonicalize(r.value.lower) !== canonicalize(r.value.upper)));
  assert.equal(f.value.distribution.reduce((n, r) => n + r.count, 0), f.coverage.numerator);
  for (const row of f.value.distribution) assert.deepEqual(Object.keys(row.value).sort(), ["lower", "upper"]);
  const empty = get("weighted-isolated").features[0]; assert.equal(empty.value, null); assert.deepEqual(empty.reasons, ["empty-population"]);
  assert.deepEqual(empty.coverage, { numerator: 0, denominator: 0, complete: false });
});
test("possible interval extrema do not acquire certainty, and exact attaining ties remain complete sets", () => {
  const roles = new Map(["a", "b"].map(id => [id, { sourceInDegree: 0, sourceOutDegree: 1, targetInDegree: 1, targetOutDegree: 0 }]));
  const a = scalarDescriptor([{ id: "a", value: { lower: q(-1), upper: q(1) } }, { id: "b", value: { lower: q(0), upper: q(2) } }], roles, "certified-interval");
  assert.deepEqual(a.provenance.minimum.possibleEdgeIds, ["a", "b"]); assert.deepEqual(a.provenance.minimum.certainEdgeIds, []);
  assert.equal(a.value.signs.unresolved, 2); assert.equal(a.value.minimum.lower.numerator, "-1");
  const tied = scalarDescriptor(["a", "b"].map(id => ({ id, value: { lower: q(1), upper: q(1) } })), roles, "exact-rational");
  assert.deepEqual(tied.provenance.minimum.certainEdgeIds, ["a", "b"]); assert.equal(tied.value.minimum.certainRoles[0].count, 2);
});
test("absolute-iteration frames retain all five stopping reasons and mark every unobserved tail slot null", () => {
  const reasons = new Set();
  for (const a of artifacts.values()) {
    const f = a.features[2]; if (!f.value) continue;
    const stop = f.value.termination; reasons.add(stop.reason);
    assert.equal(f.value.frames.length, f.value.horizon + 1);
    for (const [i, frame] of f.value.frames.entries()) {
      assert.equal(frame.iteration, i);
      if (i <= stop.iteration) { assert.ok(frame.value); assert.equal(frame.reason, null); }
      else { assert.equal(frame.value, null); assert.equal(frame.reason, `after-${stop.reason}`); }
    }
    assert.equal(f.coverage.numerator, stop.iteration + 1);
    assert.equal(f.state, stop.iteration === f.value.horizon ? "observed" : "partial");
  }
  assert.deepEqual([...reasons].sort(), ["cycle", "degenerate-length", "fixed-point", "iteration-limit", "tolerance"]);
  const cycle = get("period-two").features[2].value.termination; assert.equal(cycle.cycleStart, 0); assert.equal(cycle.cyclePeriod, 2);
  const degenerate = get("feedback-triangle").features[2]; assert.equal(degenerate.value.termination.iteration, 0); assert.ok(degenerate.value.termination.degenerateEdgeCount > 0);
});
test("threshold persistence and final partitions are measured events, with exact strict-boundary behavior", () => {
  const f = get("two-k4-single-bridge-one-zero").features[2];
  assert.equal(f.value.cuts.removedEdgeCount, 2); assert.deepEqual(f.value.cuts.weakComponentSizes, [4, 4]);
  assert.deepEqual(f.value.cuts.strongComponentSizes, [4, 4]);
  assert.equal(f.value.thresholdEvents.terminalRunLengths.reduce((n, r) => n + r.count, 0), 2);
  assert.deepEqual(f.provenance.thresholdEvents.at(-1).aboveEdgeIds, [...f.provenance.cuts.removedEdgeIds].sort());
  assert.equal(get("path").features[2].value.thresholdEvents, null);
  const t = thresholdEvents([1, 3, 2, 3, 3].map((length, iteration) => ({ iteration, edges: [{ id: "edge", length: q(length) }] })), { kind: "final-length", threshold: q(2) });
  assert.deepEqual(t.value.frames.map(r => [r.enteredCount, r.exitedCount]), [[0, 0], [1, 0], [0, 1], [1, 0], [0, 0]]);
  assert.deepEqual(t.value.terminalRunLengths, [{ value: 2, count: 1 }]);
});
test("partial Ollivier results keep measured extrema and cover only the analyzed edges", () => {
  const a = get("partial-ollivier"), f = a.features[1]; assert.equal(f.state, "partial");
  assert.deepEqual(f.coverage, { numerator: 1, denominator: a.population.edgeIds.length, complete: false });
  assert.deepEqual(f.reasons, ["partial-edge-coverage"]); assert.equal(f.value.count, 1); assert.equal(a.valueHash, null);
  assert.deepEqual(f.provenance.minimum.possibleEdgeIds, a.request.ollivier.edgeIds);
});
test("missing external receipts, disabled layers and invalid evidence are distinct outcomes", () => {
  const missing = get("missing-evidence"), disabled = get("disabled");
  assert.deepEqual(missing.features[1].reasons, ["missing-evidence"]); assert.deepEqual(missing.features[2].reasons, ["missing-evidence"]);
  assert.ok(disabled.features.every(f => f.reasons[0] === "not-requested")); assert.equal(disabled.value, null);
  const f = source("missing-evidence"); assert.throws(() => buildGeometricSignature(f.pack, f.input, { ollivier: {}, flow: null }));
  const d = source("disabled"); assert.throws(() => buildGeometricSignature(d.pack, d.input, evidence(get("path"))), e => e.code === "GEOMETRIC_SIGNATURE_EVIDENCE_UNREQUESTED");
});
test("requested layers must use one common population even when their external evidence is missing", () => {
  const f = source("path"), input = { ...f.input, ollivier: { ...f.input.ollivier, scope: { kind: "induced", nodeIds: f.pack.files["model/nodes.json"].slice(0, 2).map(n => n.id) }, edgeIds: [f.input.ollivier.edgeIds[0]] }, flow: null };
  assert.throws(() => buildGeometricSignature(f.pack, input, { ollivier: null, flow: null }), e => e.code === "GEOMETRIC_SIGNATURE_POPULATION_MISMATCH");
  const scoped = buildGeometricSignature(f.pack, { ...input, forman: null }, { ollivier: null, flow: null });
  assert.equal(scoped.population.nodeIds.length, 2); assert.equal(scoped.population.edgeIds.length, 1);
  assert.deepEqual(scoped.features[1].coverage, { numerator: 0, denominator: 1, complete: false });
  input.ollivier.scope.nodeIds = ["unknown", "another"];
  assert.throws(() => buildGeometricSignature(f.pack, input, { ollivier: null, flow: null }));
});
test("expected source, request and receipt availability cannot be replaced by a self-consistent rehash", () => {
  const f = source("path"), a = get(f.id);
  const pack = buildModelPack({ model: { ...f.pack.manifest.model, id: "geometric-foreign" }, source: f.pack.manifest.source,
    nodes: f.pack.files["model/nodes.json"], edges: f.pack.files["model/edges.json"], dictionaries: f.pack.files["model/dictionaries.json"] });
  assert.throws(() => verifyGeometricSignature(a, pack, f.input, evidence(a)));
  assert.throws(() => verifyGeometricSignature(a, f.pack, { ...f.input, flow: { ...f.input.flow, step: "one" } }, evidence(a)));
  assert.throws(() => verifyGeometricSignature(get("missing-evidence"), f.pack, f.input, evidence(a)));
  assert.throws(() => verifyGeometricSignature(a, f.pack, f.input, { ollivier: null, flow: null }));
});
test("full replay rejects rehashed distributions, interval bounds, extreme roles, trajectory events and nested certificates", () => {
  const f = source("path"), a = get(f.id);
  for (const mutate of [
    x => { x.features[0].value.distribution[0].count += 1; }, x => { x.features[0].value.minimum.possibleRoles[0].value.sourceInDegree += 1; },
    x => { x.features[1].value.minimum.lower = q(10); }, x => { x.features[2].value.frames[0].value.jointDistribution[0].value.curvature = q(10); },
    x => { x.features[2].value.termination.reason = "fixed-point"; }, x => { x.features[2].value.cuts.removedEdgeCount += 1; },
    x => { x.features[0].provenance.minimum.possibleEdgeIds.reverse(); x.features[0].provenance.minimum.possibleEdgeIds.push("foreign"); },
    x => { x.profile.flow.parameters.step = "one"; }, x => { x.policy.alignment = "pad-zero"; }, x => { x.work.scalarSamples += 1; },
    x => { x.evidence.flow.states[0].transportResponse.solutions[0].flow[0][0] += 1; }, x => { x.population.edgeIds.pop(); },
    x => { x.value.features[0].value.distribution[0].count += 1; }
  ]) { const value = structuredClone(a); mutate(value); assert.throws(() => verifyGeometricSignature(resign(value), f.pack, f.input, evidence(a))); }
  const early = source("single-edge"), value = structuredClone(get(early.id)); value.features[2].value.frames[2] = { ...value.features[2].value.frames[1], iteration: 2 };
  assert.throws(() => verifyGeometricSignature(resign(value), early.pack, early.input, evidence(get(early.id))));
});
test("closed inputs reject executable data and scientific overrides without evaluating getters", () => {
  const f = source("path"); let calls = 0;
  const getter = Object.defineProperty({ ...f.input }, "flow", { enumerable: true, get() { calls += 1; } });
  for (const input of [null, {}, [], getter, { ...f.input, bins: [] }, { ...f.input, distance: 0 }, { ...f.input, callback() { calls += 1; } }]) {
    assert.throws(() => buildGeometricSignature(f.pack, input, evidence(get(f.id))));
  }
  assert.equal(calls, 0); assert.throws(() => buildGeometricSignature(f.pack, f.input, {}));
});
test("common-population and byte budgets retain explicit errors and source validation remains complete", () => {
  const f = source("weighted-necessary"), pack = f.pack, nodes = n => Array.from({ length: n }, (_, i) => ({ id: String(i) }));
  const simple = n => buildModelPack({ model: { id: `geometric-bound-${n}`, version: "1", name: "Bound control" }, source: { id: "synthetic", files: [] }, nodes: nodes(n), edges: [], dictionaries: {} });
  const input = { forman: { analysis: "structural-geometry", metricProviderId: "unit-v1" }, ollivier: null, flow: null }, empty = { ollivier: null, flow: null };
  assert.equal(buildGeometricSignature(simple(64), input, empty).population.nodeIds.length, 64);
  assert.throws(() => buildGeometricSignature(simple(65), input, empty), e => e.code === "GEOMETRIC_SIGNATURE_LIMIT_EXCEEDED");
  assert.throws(() => geometricEncoded(Array.from({ length: 28 }, () => "x".repeat(900000))), e => e.code === "GEOMETRIC_SIGNATURE_LIMIT_EXCEEDED");
  const edges = structuredClone(pack.files["model/edges.json"]); edges.at(-1).weight = 0;
  const invalid = buildModelPack({ model: pack.manifest.model, source: pack.manifest.source, nodes: pack.files["model/nodes.json"], edges, dictionaries: pack.files["model/dictionaries.json"] });
  assert.throws(() => buildGeometricSignature(invalid, f.input, empty));
});
test("normalized requests replay identically, including omitted and explicit unit initialization", () => {
  for (const id of ["path", "period-two", "weighted-necessary", "causal-emergence-seed"]) {
    const f = source(id), a = get(id); assert.deepEqual(buildGeometricSignature(f.pack, a.request, evidence(a)), a);
  }
});
test("engine registration snapshots external receipts and requires an authentic source Model", async () => {
  const f = source("path"), supplied = structuredClone(evidence(get(f.id))), definition = createGeometricSignatureAnalysis(supplied);
  supplied.flow.states.pop();
  const engine = await Onto2D.create({ models: [f.pack], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, f.input), get(f.id));
  assert.throws(() => definition.run({ model: {} }, f.input));
  const plain = await Onto2D.create({ models: [f.pack] }); await assert.rejects(() => plain.analyze(definition.id, f.input));
});
