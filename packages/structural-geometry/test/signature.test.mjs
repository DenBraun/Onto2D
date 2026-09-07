import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { runStructuralResponseSignature, verifyStructuralResponseSignature, createStructuralResponseSignatureAnalysis,
  STRUCTURAL_RESPONSE_SIGNATURE_POLICY } from "@onto2d/structural-geometry/signature";
import { signatureHash, signatureEncoded, signatureFeature, summarizeSignature } from "../src/signature-core.js";
import { fixtures, readJson } from "../../../cases/structural-geometry/signatures/fixtures.mjs";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";

const examples = await fixtures(), source = id => examples.find(f => f.id === id);
const artifacts = new Map(await Promise.all(examples.map(async f => [f.id, await readJson(`artifacts/${f.id}.json`)])));
const get = id => artifacts.get(id), run = f => runStructuralResponseSignature(f.pack, f.input);
const frozen = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const resign = a => { const { artifactHash, ...body } = a; return { ...body, artifactHash: signatureHash("artifact", body) }; };

test("signature composition preserves source/request bytes and embeds the exact prior response artifacts", async () => {
  const f = structuredClone(source("diamond-feedback-typed")), before = canonicalize(f);
  const a = run(f); assert.equal(canonicalize(f), before); frozen(a); frozen(STRUCTURAL_RESPONSE_SIGNATURE_POLICY);
  for (const f of examples.slice(0, 16)) assert.deepEqual(get(f.id).evidence.responses, await readJson(`../responses/artifacts/${f.id}.json`));
  assert.deepEqual(a.evidence.responses.preparation, a.evidence.invariance.preparation);
  assert.equal(a.evidence.responses.preparation.regime.probeSets.response.execution, "none");
});

test("fixed three/five-feature profiles bind all probes, observables and independent supplier policies", () => {
  for (const a of artifacts.values()) {
    assert.equal(a.features.length, a.request.regimeId === "typed-relations-v1" ? 5 : 3);
    assert.deepEqual(a.features.map(f => f.id), a.profile.features.map(f => f.id));
    assert.deepEqual(a.features.map(f => f.probeId), a.evidence.responses.profile.probeIds);
    assert.equal(a.profile.policy.contentHash, STRUCTURAL_RESPONSE_SIGNATURE_POLICY.contentHash);
    assert.equal(a.policy.response.policy.contentHash, a.evidence.responses.policy.contentHash);
    assert.equal(a.policy.invariance.policy.contentHash, a.evidence.invariance.policy.contentHash);
    for (const field of ["distance", "weights", "geometry", "admissibilityChanged"]) assert.equal(Object.hasOwn(a.value ?? {}, field), false);
  }
});

test("complete signatures contain only the ordered joint response multisets with exact multiplicity", () => {
  let complete = 0;
  for (const a of artifacts.values()) {
    if (a.summary.status !== "complete") { assert.equal(a.value, null); assert.equal(a.valueHash, null); continue; }
    complete += 1; assert.equal(a.summary.invarianceStatus, "passed"); assert.deepEqual(a.summary.reasons, []);
    assert.deepEqual(a.value, { features: a.features.map(f => ({ id: f.id, value: f.value })) });
    for (const [i, f] of a.features.entries()) {
      assert.equal(f.state, "observed"); assert.deepEqual(f.reasons, []);
      assert.equal(f.value.reduce((n, row) => n + row.count, 0), a.evidence.responses.probes[i].execution.targetCount);
      for (const row of f.value) {
        assert.deepEqual(Object.keys(row).sort(), ["components", "count"]);
        for (const c of row.components) assert.deepEqual(Object.keys(c).sort(), ["delta", "observableId", "state"]);
      }
    }
  }
  assert.equal(complete, 12);
});

test("empty and unresolved selectors retain null features with distinct reasons instead of measured zeros", () => {
  const empty = get("chain-topology").features[0], unresolved = get("missing-necessity").features[1];
  assert.deepEqual(empty.reasons, [{ code: "no-eligible-targets", count: 1 }]);
  assert.deepEqual(unresolved.reasons, [{ code: "missing-selector-evidence", count: 1 }]);
  for (const f of [empty, unresolved]) { assert.equal(f.value, null); assert.equal(f.valueHash, null); assert.equal(f.coverage.complete, false); }
  assert.ok(get("chain-topology").features[1].value);
  assert.equal(get("isolates").summary.coverage.numerator, 0);
});

test("rejected and missing target measurements invalidate the whole family while retaining complete evidence", () => {
  const mixed = get("mixed-topology"), direction = mixed.features[1];
  assert.deepEqual(direction.reasons, [{ code: "rejected-transformations", count: 2 }]);
  assert.deepEqual(direction.coverage, { numerator: 14, denominator: 28, complete: false }); assert.equal(direction.value, null);
  assert.equal(mixed.evidence.responses.probes[1].summary.counts.rejected, 2);
  const missing = get("missing-role");
  assert.deepEqual(missing.features[1].reasons, [{ code: "missing-observations", count: 2 }]);
  assert.equal(missing.features[1].value, null);
  assert.deepEqual(missing.summary.reasons, ["incomplete-response-features", "invariance-indeterminate"]);
  assert.ok(missing.evidence.responses.probes[1].runs[0].response.components.some(c => c.state === "different"));
});

test("invariance acceptance is a separate mandatory gate, including when feature coverage is complete", () => {
  const features = get("diamond-feedback-typed").features;
  for (const status of ["failed", "indeterminate"]) {
    const summary = summarizeSignature(features, status);
    assert.equal(summary.status, "indeterminate"); assert.equal(summary.coverage.complete, true);
    assert.deepEqual(summary.reasons, [`invariance-${status}`]);
  }
  assert.equal(summarizeSignature([], "passed").status, "indeterminate");
});

test("a typed family retains both rejection and missing-observation reasons without exposing a partial histogram", () => {
  const f = source("mixed-topology"), edges = f.pack.files["model/edges.json"];
  const { ontologicalRole, ...missing } = edges[0]; void ontologicalRole;
  const pack = buildModelPack({ model: { ...f.pack.manifest.model, id: "signature-mixed-gaps" }, source: f.pack.manifest.source,
    nodes: f.pack.files["model/nodes.json"], edges: [missing, ...edges.slice(1)], dictionaries: f.pack.files["model/dictionaries.json"] });
  const a = runStructuralResponseSignature(pack, { regimeId: "typed-relations-v1" }), direction = a.features[3];
  assert.deepEqual(direction.reasons, [{ code: "rejected-transformations", count: 2 }, { code: "missing-observations", count: 2 }]);
  assert.equal(direction.value, null); assert.equal(a.valueHash, null);
});

test("joint grouping preserves correlations lost by independent marginals and retains multiplicity", () => {
  const a = get("diamond-feedback-typed"), base = a.evidence.responses.probes[1], definition = a.profile.features[1];
  const make = states => {
    const runs = states.map(pair => ({ ...base.runs[0], response: { ...base.runs[0].response,
      status: pair.includes("different") ? "changed" : "unchanged",
      components: base.runs[0].response.components.map((c, i) => ({ ...c, state: pair[i] })) } }));
    return signatureFeature({ ...base, runs }, definition, a.profile.profileHash);
  };
  const same = make([["equal", "equal"], ["different", "different"]]), crossed = make([["equal", "different"], ["different", "equal"]]);
  assert.notDeepEqual(same.value, crossed.value); assert.notEqual(same.valueHash, crossed.valueHash);
  const doubled = make([["equal", "equal"], ["equal", "equal"]]);
  assert.equal(doubled.value.length, 1); assert.equal(doubled.value[0].count, 2);
  assert.notEqual(doubled.valueHash, make([["equal", "equal"]]).valueHash);
});

test("frozen structural/typed negatives separate and all isolate-extension collisions remain disclosed", async () => {
  const suite = await readJson("suite.json");
  for (const c of suite.contrasts) {
    const left = get(c.left), right = get(c.right);
    assert.equal(left.summary.status, "complete"); assert.equal(right.summary.status, "complete");
    assert.equal(left.valueHash === right.valueHash ? "equal" : "different", c.outcome);
    if (c.id === "isolated-collision") assert.notEqual(left.evidence.responses.baseline.graph.nodes.length, right.evidence.responses.baseline.graph.nodes.length);
  }
});

test("typed value fingerprints exclude source provenance without granting cross-source semantic authority", () => {
  const f = source("diamond-feedback-typed"), original = get(f.id);
  const foreign = buildModelPack({ model: { ...f.pack.manifest.model, id: "foreign-signature-source" }, source: f.pack.manifest.source,
    nodes: f.pack.files["model/nodes.json"], edges: f.pack.files["model/edges.json"], dictionaries: f.pack.files["model/dictionaries.json"] });
  const a = runStructuralResponseSignature(foreign, f.input);
  assert.equal(a.valueHash, original.valueHash); assert.deepEqual(a.value, original.value);
  assert.notEqual(a.artifactHash, original.artifactHash); assert.notDeepEqual(a.comparisonContext, original.comparisonContext);
  assert.equal(a.comparisonContext.kind, "source-local-typed");
  assert.throws(() => verifyStructuralResponseSignature(original, foreign, f.input), e => e.code === "STRUCTURAL_RESPONSE_SIGNATURE_VERIFICATION_FAILED");
});

test("full expected-source replay rejects rehashed value, evidence, coverage, work and policy forgeries", () => {
  const f = source("diamond-feedback-typed"), original = get(f.id);
  for (const mutate of [
    a => { a.features[0].value[0].count += 1; }, a => { a.value.features[0].value[0].count += 1; },
    a => { a.policy.features[0].multiplicity = "normalized"; }, a => { a.profile.features.reverse(); },
    a => { a.evidence.responses.probes[0].runs.pop(); }, a => { a.evidence.invariance.runs[0].representation.payload += " "; },
    a => { a.comparisonContext.contextHash = a.artifactHash; }, a => { a.source.scopeHash = a.artifactHash; },
    a => { a.summary.coverage.numerator = 0; }, a => { a.work.featureRows += 1; }, a => { a.valueHash = a.artifactHash; }
  ]) { const a = structuredClone(original); mutate(a); assert.throws(() => verifyStructuralResponseSignature(resign(a), f.pack, f.input)); }
  assert.throws(() => verifyStructuralResponseSignature(original, f.pack, { ...f.input, scope: { kind: "induced", nodeIds: ["n0", "n1"] } }));
  assert.deepEqual(verifyStructuralResponseSignature(original, f.pack, f.input), original);
});

test("closed signature inputs reject feature selection, callbacks, arbitrary outcomes and getters without executing them", () => {
  let calls = 0;
  const getter = Object.defineProperty({ regimeId: "topology-only-v1" }, "scope", { enumerable: true, get() { calls += 1; } });
  for (const input of [null, [], {}, getter, { regimeId: "unknown" }, { regimeId: "topology-only-v1", featureIds: [] },
    { regimeId: "topology-only-v1", response: {} }, { regimeId: "topology-only-v1", weights: [] },
    { regimeId: "topology-only-v1", transform() { calls += 1; } }]) assert.throws(() => runStructuralResponseSignature(source("chain-topology").pack, input));
  assert.equal(calls, 0);
});

test("signature composition accepts the maximum upstream workload and preserves explicit resource errors", () => {
  const a = run(source("maximum"));
  assert.equal(a.work.observationEvaluations, 70); assert.equal(a.work.featureComponentVisits, 448); assert.equal(a.work.canonicalizerCalls, 0);
  const large = packFor({ id: "signature-over-target-budget", nodes: 33, edges: Array.from({ length: 33 }, (_, from) => ({ from, to: (from + 1) % 33, types: {} })) });
  assert.throws(() => runStructuralResponseSignature(large, { regimeId: "topology-only-v1" }), e => e.code === "STRUCTURAL_RESPONSE_LIMIT_EXCEEDED");
  assert.throws(() => signatureEncoded(Array.from({ length: 10 }, () => "x".repeat(900000))), e => e.code === "STRUCTURAL_RESPONSE_SIGNATURE_LIMIT_EXCEEDED");
});

test("scoped signature requests retain full-source typed validation and exact boundary accounting", () => {
  const pack = packFor({ id: "signature-invalid-excluded-type", nodes: 3, edges: [{ from: 1, to: 2, types: { necessity: "invalid" } }] });
  assert.throws(() => runStructuralResponseSignature(pack, { regimeId: "typed-relations-v1", scope: { kind: "induced", nodeIds: ["n0"] } }));
  const a = get("boundary"); assert.deepEqual(a.evidence.responses.preparation.scope, a.evidence.invariance.preparation.scope);
  assert.deepEqual(get("opaque").evidence.responses.baseline.mapping.nodes.map(n => n.sourceNodeId), [" left ", "right\n"]);
});

test("signature engine integration is opt-in and requires an authentic Model", async () => {
  const f = source("chain-topology"), definition = createStructuralResponseSignatureAnalysis();
  const engine = await Onto2D.create({ models: [f.pack], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, f.input), get(f.id));
  assert.throws(() => definition.run({ model: {} }, f.input));
  const plain = await Onto2D.create({ models: [f.pack] }); await assert.rejects(() => plain.analyze(definition.id, f.input));
});
