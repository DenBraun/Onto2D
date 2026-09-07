import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { compareStructuralSignatures, verifyStructuralPseudometric, createStructuralPseudometricAnalysis, STRUCTURAL_PSEUDOMETRIC_POLICY } from "@onto2d/structural-geometry/pseudometric";
import { PSEUDOMETRIC_CODEC, pseudometricHash, pseudometricEncoded, pseudometricComponents, summarizePseudometric, fraction } from "../src/pseudometric-core.js";
import { fixtures, readJson } from "../../../cases/structural-geometry/pseudometric/fixtures.mjs";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";
const examples = await fixtures(), source = id => examples.find(f => f.id === id);
const artifacts = new Map(await Promise.all(examples.map(async f => [f.id, await readJson(`artifacts/${f.id}.json`)])));
const get = id => artifacts.get(id), run = f => compareStructuralSignatures(f.left.pack, f.right.pack, f.input);
const matrixId = (left, right, regime) => `${left}--${right}--${regime}`;
const frozen = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const resign = a => { const { artifactHash, ...body } = a; return { ...body, artifactHash: pseudometricHash("artifact", body) }; };

test("comparison preserves source and input bytes, freezes every layer and binds the fixed profile", () => {
  const f = structuredClone(examples[0]), before = canonicalize(f, PSEUDOMETRIC_CODEC), a = run(f);
  assert.equal(canonicalize(f, PSEUDOMETRIC_CODEC), before); frozen(a); frozen(STRUCTURAL_PSEUDOMETRIC_POLICY);
  for (const a of artifacts.values()) {
    assert.equal(a.components.length, a.request.regimeId === "typed-relations-v1" ? 5 : 3);
    assert.deepEqual(a.components.map(c => ({ featureId: c.featureId, weight: c.weight, scale: c.scale })), a.profile.components);
    assert.equal(a.profile.signatureProfileHash, a.evidence.left.profile.profileHash);
    assert.equal(a.domains.left.profileHash, a.profile.profileHash);
    assert.equal(a.domains.compatible, a.domains.left.domainHash === a.domains.right.domainHash);
  }
});
test("all complete source matrices obey exact nonnegativity, self-zero, symmetry and triangle", async () => {
  const controls = await readJson("controls.json");
  const units = a => a.distance.numerator * (a.coverage.denominator / a.distance.denominator);
  for (const regime of controls.regimes) for (const x of controls.completeFragments) for (const y of controls.completeFragments) {
    const a = get(matrixId(x, y, regime)), reverse = get(matrixId(y, x, regime));
    assert.equal(a.coverage.complete, true); assert.equal(a.domains.compatible, true);
    assert.ok(Number.isInteger(units(a)) && units(a) >= 0 && units(a) <= a.coverage.denominator);
    assert.deepEqual(a.distance, reverse.distance);
    if (x === y) assert.deepEqual(a.distance, { numerator: 0, denominator: 1 });
    for (const z of controls.completeFragments) assert.ok(units(get(matrixId(x, z, regime))) <= units(a) + units(get(matrixId(y, z, regime))));
  }
});
test("source contrasts retain isolate collisions and expose the fraction of changed whole families", () => {
  for (const [regime, subdivision, necessity] of [["canonical-structure-v1", { numerator: 2, denominator: 3 }, 0],
    ["topology-only-v1", { numerator: 1, denominator: 1 }, 0], ["typed-relations-v1", { numerator: 3, denominator: 5 }, 1]]) {
    const collision = get(matrixId("diamond-feedback", "isolated-extension", regime));
    assert.deepEqual(collision.distance, { numerator: 0, denominator: 1 });
    assert.notEqual(collision.evidence.left.evidence.responses.baseline.graph.nodes.length, collision.evidence.right.evidence.responses.baseline.graph.nodes.length);
    assert.deepEqual(get(matrixId("diamond-feedback", "subdivided-feedback", regime)).distance, subdivision);
    assert.deepEqual(get(matrixId("diamond-feedback", "necessity-change", regime)).distance, { numerator: necessity, denominator: necessity ? 5 : 1 });
  }
});
test("whole distances remain null for every mandatory gap even with known equality or differences", () => {
  const self = get("partial-chain-self"); assert.equal(self.status, "indeterminate"); assert.equal(self.distance, null);
  assert.deepEqual(self.diagnostics.partial.value, { numerator: 0, denominator: 1 }); assert.equal(self.coverage.numerator, 1);
  const different = get("partial-chain-diamond"); assert.equal(different.distance, null); assert.equal(different.diagnostics.differentFeatureIds.length, 1);
  assert.deepEqual(different.diagnostics.partial, get("partial-diamond-chain").diagnostics.partial);
  const empty = get("empty-self"); assert.equal(empty.distance, null); assert.equal(empty.coverage.numerator, 0); assert.equal(empty.diagnostics.partial.value, null);
  const rejected = get("rejected-targets"); assert.ok(rejected.components.some(c => c.reasons.some(r => r.code === "rejected-transformations" && r.count === 2)));
  for (const id of ["missing-role", "missing-necessity"]) {
    const a = get(id); assert.equal(a.distance, null); assert.equal(a.coverage.numerator, 0); assert.equal(a.diagnostics.partial.value, null);
    assert.ok(a.components.every(c => c.reasons.some(r => r.code === "invariance-indeterminate" && r.side === "left")));
  }
});
test("typed contexts are fixed domains: identical dictionaries and fingerprints never authorize a cross-source pair", () => {
  for (const id of ["external-typed", "foreign-context"]) {
    const a = get(id); assert.equal(a.evidence.left.valueHash, a.evidence.right.valueHash);
    assert.deepEqual(a.evidence.left.value, a.evidence.right.value);
    assert.deepEqual(a.domains.membership, { left: "eligible", right: "eligible" });
    assert.equal(a.domains.compatible, false); assert.equal(a.domains.commonDomainHash, null); assert.equal(a.distance, null);
    assert.equal(a.diagnostics.partial.value, null);
    assert.ok(a.components.every(c => c.left.measurement === "observed" && c.right.measurement === "observed" && c.reasons[0].code === "incompatible-domain"));
  }
  for (const id of ["external-canonical", "external-topology"]) {
    const a = get(id); assert.equal(a.domains.compatible, true); assert.deepEqual(a.distance, { numerator: 0, denominator: 1 });
    assert.notEqual(a.evidence.left.source.contextHash, a.evidence.right.source.contextHash);
  }
});
test("private extraction compares actual values and masks all coordinates when invariance fails", () => {
  const base = get(examples[0].id).evidence.left, altered = structuredClone(base);
  altered.features[0].value[0].count += 1;
  assert.equal(altered.features[0].valueHash, base.features[0].valueHash);
  assert.equal(pseudometricComponents(base, altered, true)[0].state, "different");
  altered.features[0].value = structuredClone(base.features[0].value); altered.features[0].valueHash = altered.artifactHash;
  assert.equal(pseudometricComponents(base, altered, true)[0].state, "equal");
  for (const gate of ["failed", "indeterminate"]) {
    altered.summary.invarianceStatus = gate;
    const components = pseudometricComponents(base, altered, true), summary = summarizePseudometric(components, "partial-with-coverage");
    assert.ok(components.every(c => c.state === "indeterminate" && c.reasons.some(r => r.code === `invariance-${gate}`)));
    assert.equal(summary.distance, null); assert.equal(summary.diagnostics.partial.value, null);
  }
  altered.profile.profileHash = altered.artifactHash; assert.throws(() => pseudometricComponents(base, altered, true));
});
test("expected-source replay rejects rehashed fractions, domains, metadata, policies and nested evidence forgeries", () => {
  const f = examples[0], original = get(f.id);
  for (const mutate of [a => { a.distance = { numerator: 1, denominator: 3 }; }, a => { a.distance = { numerator: 0, denominator: 3 }; },
    a => { a.policy.weight = 2; }, a => { a.profile.components.reverse(); }, a => { a.domains.left.domainHash = a.artifactHash; },
    a => { a.domains.membership.left = "ineligible"; }, a => { a.components[0].left.valueHash = a.artifactHash; },
    a => { a.components[0].state = "different"; }, a => { a.evidence.left.features[0].value[0].count += 1; },
    a => { a.evidence.right.evidence.responses.probes[0].runs.pop(); }, a => { a.evidence.left.evidence.invariance.runs[0].representation.payload += " "; },
    a => { a.coverage.numerator -= 1; }, a => { a.work.observationEvaluations += 1; }]) {
    const a = structuredClone(original); mutate(a); assert.throws(() => verifyStructuralPseudometric(resign(a), f.left.pack, f.right.pack, f.input));
  }
  assert.throws(() => verifyStructuralPseudometric(original, f.left.pack, f.right.pack, { ...f.input, diagnostics: "partial-with-coverage" }));
  assert.throws(() => verifyStructuralPseudometric(original, f.left.pack, f.right.pack, { ...f.input, rightScope: { kind: "induced", nodeIds: [f.input.rightScope.nodeIds[0]] } }));
  assert.deepEqual(verifyStructuralPseudometric(original, f.left.pack, f.right.pack, f.input), original);
});
test("closed public input rejects profile overrides, evidence, pairwise approvals and executable data", () => {
  let calls = 0;
  const getter = Object.defineProperty({ regimeId: "topology-only-v1" }, "leftScope", { enumerable: true, get() { calls += 1; } });
  for (const input of [null, [], {}, getter, { regimeId: "unknown" }, { regimeId: "topology-only-v1", diagnostics: null },
    ...["weights", "components", "vocabulary", "approvedMappingHash", "leftSignature", "threshold"].map(k => ({ regimeId: "topology-only-v1", [k]: [] })),
    { regimeId: "topology-only-v1", transform() { calls += 1; } }]) assert.throws(() => compareStructuralSignatures(examples[0].left.pack, examples[0].right.pack, input));
  assert.equal(calls, 0);
});
test("composition retains upstream resource errors, exact fraction bounds and its own whole-output byte cap", () => {
  const a = run(source("maximum")); assert.equal(a.work.observationEvaluations, 140); assert.equal(a.work.canonicalizerCalls, 0);
  const large = packFor({ id: "pseudometric-over-budget", nodes: 33, edges: Array.from({ length: 33 }, (_, from) => ({ from, to: (from + 1) % 33, types: {} })) });
  assert.throws(() => compareStructuralSignatures(large, large, { regimeId: "topology-only-v1" }), e => e.code === "STRUCTURAL_RESPONSE_LIMIT_EXCEEDED");
  for (const [n, d] of [[-1, 3], [1, 0], [1, 6], [4, 3], [0.5, 3], [NaN, 3], [1, Infinity]]) assert.throws(() => fraction(n, d));
  assert.deepEqual(fraction(2, 4), { numerator: 1, denominator: 2 }); assert.deepEqual(fraction(0, 5), { numerator: 0, denominator: 1 });
  assert.throws(() => pseudometricEncoded(Array.from({ length: 19 }, () => "x".repeat(900000))), e => e.code === "STRUCTURAL_PSEUDOMETRIC_LIMIT_EXCEEDED");
});
test("induced scopes still validate malformed declared types outside the selected fragment", () => {
  const f = examples.find(f => f.input.regimeId === "typed-relations-v1"), pack = f.left.pack;
  const edges = structuredClone(pack.files["model/edges.json"]); edges.at(-1).necessity = "invalid";
  const bad = buildModelPack({ model: pack.manifest.model, source: pack.manifest.source, nodes: pack.files["model/nodes.json"], edges, dictionaries: pack.files["model/dictionaries.json"] });
  assert.throws(() => compareStructuralSignatures(pack, bad, f.input));
});
test("engine integration snapshots the expected right pack and requires an authentic left Model", async () => {
  const f = examples[0], right = structuredClone(f.right.pack), definition = createStructuralPseudometricAnalysis(right);
  right.files["model/nodes.json"].pop();
  const engine = await Onto2D.create({ models: [f.left.pack], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, f.input), get(f.id));
  assert.throws(() => definition.run({ model: {} }, f.input));
  const plain = await Onto2D.create({ models: [f.left.pack] }); await assert.rejects(() => plain.analyze(definition.id, f.input));
});
