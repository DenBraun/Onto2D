import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { Onto2D } from "@onto2d/engine";
import { compareStructuralModels, verifyStructuralComparison, createStructuralComparisonAnalysis,
  STRUCTURAL_COMPARISON_POLICY } from "@onto2d/structural-geometry/comparison";
import { getDistinguishabilityRegime } from "@onto2d/structural-geometry/regimes";
import { fixtures, readJson } from "../../../cases/structural-geometry/comparison/fixtures.mjs";
import { packFor, readJson as readTyped } from "../../../cases/structural-geometry/typed/fixtures.mjs";
import { summarizeComparison } from "../src/comparison-core.js";

const examples = await fixtures(), controls = await readTyped("controls.json");
const f = (pair, regime = "typed-relations-v1") => examples.find(x => x.id === `${pair}-${regime}`);
const compare = x => compareStructuralModels(x.left, x.right, x.input);
const source = f("self").left, input = { regimeId: "canonical-structure-v1" };
const canonical = "canonical-directed-structure-v1", typed = "canonical-typed-directed-structure-v1";
const gap = (observableId = canonical, side = "left", disposition = "unavailable") =>
  ({ observableId, side, disposition, reference: "test-only", contentHash: `sha256:${"1".repeat(64)}` });
const code = suffix => e => e.code === `STRUCTURAL_COMPARISON_${suffix}`;
const frozen = value => { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const resign = a => { const { artifactHash: _hash, ...body } = a; return { ...body, artifactHash: hashCanonical("onto2d:structural-comparison-artifact:v1", body, { limits: { maxEntries: 500000 } }) }; };

test("comparison snapshots sources and input, binds the policy, and preserves ordered mandatory observables", () => {
  const x = structuredClone(f("self")), before = canonicalize(x), a = compare(x);
  assert.equal(canonicalize(x), before); frozen(a); frozen(STRUCTURAL_COMPARISON_POLICY);
  assert.deepEqual(a.components.map(c => c.observable), getDistinguishabilityRegime(x.input.regimeId).observables);
  assert.ok(a.components.every(c => c.mandatory)); assert.deepEqual(a.policy, STRUCTURAL_COMPARISON_POLICY);
  assert.deepEqual(a, resign(a)); assert.equal(a.distance, 0); assert.equal(a.coverage.complete, true);
});

test("topology can merge structures which directed isomorphism separates", () => {
  assert.equal(compare(f("topology-collision", "canonical-structure-v1")).distance, 1);
  assert.equal(compare(f("topology-collision", "topology-only-v1")).distance, 0);
  assert.equal(compare(f("topology-collision")).distance, 1);
});

test("joint typed relations split graphs that both untyped regimes merge", () => {
  assert.equal(compare(f("joint-fields", "canonical-structure-v1")).distance, 0);
  assert.equal(compare(f("joint-fields", "topology-only-v1")).distance, 0);
  const a = compare(f("joint-fields")); assert.equal(a.distance, 1);
  assert.deepEqual(a.diagnostics.equalObservableIds, [canonical]); assert.deepEqual(a.diagnostics.differentObservableIds, [typed]);
});

test("relabeling, metadata and set order preserve equality under declared vocabulary alignment", async () => {
  for (const pair of ["relabel", "annotations", "set-order"]) for (const regime of ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]) {
    const a = await readJson(`artifacts/${pair}-${regime}.json`);
    assert.equal(a.distance, 0); assert.equal(a.status, "indistinguishable-under-regime");
  }
});

test("missing mandatory typed fields keep strict null distance and already observed structural differences", () => {
  const a = compare(f("missing-with-difference"));
  assert.equal(a.status, "indeterminate"); assert.equal(a.distance, null);
  assert.deepEqual(a.diagnostics.differentObservableIds, [canonical]); assert.deepEqual(a.diagnostics.incompleteObservableIds, [typed]);
  assert.deepEqual(a.coverage, { numerator: 1, denominator: 2, complete: false, families: [
    { family: "structure", numerator: 1, denominator: 1 }, { family: "typed-relations", numerator: 0, denominator: 1 }] });
  assert.equal(a.components[1].left.availability, "missing"); assert.equal(a.components[1].values, null);
});

test("raw typed equality never bypasses a changed dictionary or cross-source mapping requirement", () => {
  for (const pair of ["dictionary-change", "cross-source-unbound"]) {
    const a = compare(f(pair)), observations = a.evidence.alignment.sources;
    assert.deepEqual(observations.left.observations[1].value, observations.right.observations[1].value);
    assert.equal(a.distance, null); assert.ok(a.components[1].reasons.some(r => r.code === "cross-source-mapping-required"));
  }
});

test("renumbering requires an externally approved complete mapping", () => {
  assert.equal(compare(f("renumbered-approved")).distance, 0);
  for (const [pair, reason] of [["renumbered-unapproved", "mapping-not-approved"], ["partial-approved", "mapping-value-uncovered"]]) {
    const a = compare(f(pair)); assert.equal(a.distance, null); assert.ok(a.components[1].reasons.some(r => r.code === reason));
  }
});

test("two scopes of the same source share vocabulary while retaining their structural difference", () => {
  const a = compare(f("same-source-scopes")); assert.equal(a.distance, 1);
  assert.equal(a.evidence.alignment.compatibility.basis, "same-source");
  assert.notDeepEqual(a.request.leftScope, a.request.rightScope);
});

test("unavailable and rejected components remove coverage without producing a partial distance", () => {
  for (const pair of ["unavailable-summary", "rejected-summary-with-difference", "all-summary-evidence-unavailable"]) {
    const a = compare(f(pair, "topology-only-v1"));
    assert.equal(a.distance, null); assert.equal(a.coverage.denominator, 7); assert.equal(a.coverage.complete, false);
    assert.equal(a.coverage.numerator, pair.startsWith("all-") ? 0 : 6);
    if (pair.startsWith("rejected-")) assert.ok(a.diagnostics.differentObservableIds.length > 0);
  }
});

test("a use rejection and a missing source field remain separately visible", () => {
  const a = compare(f("missing-and-rejected")), c = a.components[1];
  assert.deepEqual(c.left, { availability: "missing", disposition: "rejected" });
  assert.deepEqual(c.reasons.map(r => r.code), ["missing-typed-observation", "evidence-rejected"]);
  assert.equal(a.distance, null); assert.equal(a.evidence.alignment.sources.left.evaluation, "incomplete");
});

test("all fourteen side restrictions are bounded and normalized in observable then side order", () => {
  const regimeId = "topology-only-v1", ids = getDistinguishabilityRegime(regimeId).observables.map(o => o.id);
  const evidenceGaps = ids.flatMap(id => [gap(id, "left"), gap(id, "right", "rejected")]);
  const a = compareStructuralModels(source, source, { regimeId, evidenceGaps });
  const b = compareStructuralModels(source, source, { regimeId, evidenceGaps: [...evidenceGaps].reverse() });
  assert.deepEqual(a, b); assert.deepEqual(a.request.evidenceGaps, evidenceGaps); assert.equal(a.coverage.numerator, 0);
  assert.throws(() => compareStructuralModels(source, source, { regimeId, evidenceGaps: [...evidenceGaps, gap(ids[0])] }), code("INPUT_INVALID"));
});

test("closed requests reject custom policies, empty profiles, duplicate restrictions and unsupported states", () => {
  for (const request of [null, [], {}, { regimeId: "history-aware-v1" }, { ...input, threshold: 1 }, { ...input, components: [] },
    { ...input, leftScope: null }, { ...input, rightScope: { kind: "induced", nodeIds: [] } }, { ...input, vocabulary: {} },
    { ...input, evidenceGaps: null }, { ...input, evidenceGaps: [gap(), gap()] }, { ...input, evidenceGaps: [gap(typed)] },
    ...[{ side: "both" }, { disposition: "observed" }, { disposition: "missing" }, { disposition: "unresolved" },
      { reference: " " }, { reference: "bad\n" }, { contentHash: "sha256:bad" }, { approved: true }]
      .map(change => ({ ...input, evidenceGaps: [{ ...gap(), ...change }] }))]) {
    assert.throws(() => compareStructuralModels(source, source, request));
  }
  let invoked = false;
  assert.throws(() => compareStructuralModels(source, source, { get regimeId() { invoked = true; return input.regimeId; } }));
  assert.equal(invoked, false);
});

test("source and mapping errors still throw when every requested component is unavailable", () => {
  const request = { ...input, evidenceGaps: [gap()] }, corrupt = structuredClone(source);
  corrupt.files["model/edges.json"][0].dependencyTypeId = 100;
  assert.throws(() => compareStructuralModels(corrupt, source, request));
  const x = structuredClone(f("self")); x.input.evidenceGaps = [gap(canonical), gap(typed)];
  x.input.vocabulary.mapping.declaration.fields.dependencyTypeId[0].right = 100;
  assert.throws(() => compare(x));
  const g = structuredClone(controls.controls.find(c => c.id === "single-edge")); g.edges[0].types.necessity = "invalid";
  const malformed = packFor(g);
  assert.throws(() => compareStructuralModels(malformed, malformed, { regimeId: "typed-relations-v1", evidenceGaps: [gap(typed)] }));
});

test("source identifiers with whitespace remain opaque in both full and induced comparison scopes", () => {
  const g = structuredClone(controls.controls.find(c => c.id === "single-edge")); g.labels = [" left ", "right\n"];
  const pack = packFor(g);
  for (const regimeId of ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]) {
    const a = compareStructuralModels(pack, pack, { regimeId, rightScope: { kind: "induced", nodeIds: [...g.labels].reverse() } });
    assert.equal(a.distance, 0); assert.deepEqual(a.request.rightScope.nodeIds, [...g.labels].sort());
    assert.throws(() => compareStructuralModels(pack, pack, { regimeId, rightScope: { kind: "induced", nodeIds: ["left"] } }));
  }
});

test("rehashed status, coverage, family, value, provenance and policy tampering fails external-source replay", () => {
  const a = compareStructuralModels(source, source, input);
  for (const mutate of [
    x => { x.distance = 1; }, x => { x.status = "distinguishable-under-regime"; }, x => { x.coverage.numerator = 0; },
    x => { x.coverage.families[0].numerator = 0; }, x => { x.components[0].values.left.nodeCount = 1; },
    x => { x.components[0].mandatory = false; }, x => { x.components[0].observable.contentHash = gap().contentHash; },
    x => { x.components[0].left.disposition = "rejected"; }, x => { x.diagnostics.differentObservableIds.push(canonical); },
    x => { x.evidence.left.witness.nodes[0].sourceNodeId = "forged"; }, x => { x.policy.partialDistance = "supported"; }
  ]) { const changed = structuredClone(a); mutate(changed); assert.throws(() => verifyStructuralComparison(resign(changed), source, source, input), code("VERIFICATION_FAILED")); }
});

test("replay takes expected evidence restrictions and mapping approval from the caller", () => {
  const restricted = { ...input, evidenceGaps: [gap()] }, a = compareStructuralModels(source, source, restricted);
  assert.throws(() => verifyStructuralComparison(a, source, source, input), code("VERIFICATION_FAILED"));
  assert.throws(() => verifyStructuralComparison(a, source, source, { ...restricted, evidenceGaps: [{ ...gap(), reference: "different" }] }), code("VERIFICATION_FAILED"));
  const x = f("renumbered-approved"), b = compare(x);
  assert.throws(() => verifyStructuralComparison(b, x.left, x.right, { ...x.input, vocabulary: { mapping: x.input.vocabulary.mapping } }), code("VERIFICATION_FAILED"));
});

test("verification enforces the comparison serialization budget", () => {
  const a = structuredClone(compareStructuralModels(source, source, input)); a.extra = Array(5000).fill("x".repeat(1024));
  assert.throws(() => verifyStructuralComparison(a, source, source, input), code("LIMIT_EXCEEDED"));
});

test("engine integration snapshots its right source and requires explicit analysis registration and an authentic left Model", async () => {
  const right = structuredClone(source), definition = createStructuralComparisonAnalysis(right);
  right.files["model/edges.json"][0].dependencyTypeId = 100;
  const engine = await Onto2D.create({ models: [source], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, input), compareStructuralModels(source, source, input));
  assert.throws(() => definition.run({ model: {} }, input)); assert.throws(() => createStructuralComparisonAnalysis(right));
  const plain = await Onto2D.create({ models: [source] }); await assert.rejects(() => plain.analyze(definition.id, input));
});

test("all 3280 profiles of zero through seven components obey the independent strict aggregation census", async () => {
  const census = (await readJson("reference.json")).aggregationCensus;
  let total = 0;
  for (let size = 0; size <= 7; size += 1) {
    const counts = { equal: 0, different: 0, indeterminate: 0 };
    for (let bits = 0; bits < 3 ** size; bits += 1) {
      const states = Array.from({ length: size }, (_, i) => ["equal", "different", "indeterminate"][Math.floor(bits / 3 ** i) % 3]);
      const rows = states.map((state, i) => ({ state, family: i % 2 ? "topology" : "structure", observable: { id: `test-${i}` } }));
      const result = summarizeComparison(rows), complete = size > 0 && !states.includes("indeterminate");
      const distance = complete ? Number(states.includes("different")) : null;
      assert.equal(result.distance, distance); assert.equal(result.coverage.complete, complete);
      assert.equal(result.status, !complete ? "indeterminate" : distance ? "distinguishable-under-regime" : "indistinguishable-under-regime");
      for (const [state, key] of [["equal", "equalObservableIds"], ["different", "differentObservableIds"], ["indeterminate", "incompleteObservableIds"]]) {
        assert.deepEqual(result.diagnostics[key], rows.filter(r => r.state === state).map(r => r.observable.id));
      }
      assert.equal(result.coverage.numerator, states.filter(s => s !== "indeterminate").length);
      assert.equal(result.coverage.denominator, size);
      for (const family of result.coverage.families) {
        assert.equal(family.denominator, rows.filter(r => r.family === family.family).length);
        assert.equal(family.numerator, rows.filter(r => r.family === family.family && r.state !== "indeterminate").length);
      }
      counts[{ "indeterminate": "indeterminate", "distinguishable-under-regime": "different", "indistinguishable-under-regime": "equal" }[result.status]] += 1; total += 1;
    }
    assert.deepEqual(census[size], { components: size, profiles: 3 ** size, ...counts });
  }
  assert.equal(total, 3280);
});
