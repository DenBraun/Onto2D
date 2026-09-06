import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { Onto2D } from "@onto2d/engine";
import { prepareStructuralRegime } from "@onto2d/structural-geometry/regimes";
import { observeCanonicalStructure } from "@onto2d/structural-geometry/canonical";
import { observeTypedRelations, verifyTypedRelationsObservation, createTypedRelationsObservationAnalysis,
  TYPED_RELATIONS_IMPLEMENTATION } from "@onto2d/structural-geometry/typed";
import { canonicalizeTypedDirectedStructure } from "../src/typed-core.js";
import { fixtures, packFor, input, readJson } from "../../../cases/structural-geometry/typed/fixtures.mjs";

const document = await readJson("controls.json");
const graph = (id) => structuredClone(document.controls.find((g) => g.id === id));
const source = packFor(graph("single-edge"));
const observe = (id) => {
  const g = graph(id);
  return observeTypedRelations(packFor(g), g.scope ? { ...input, scope: { kind: "induced", nodeIds: g.scope } } : input);
};
const code = (suffix) => (e) => e.code === `STRUCTURAL_TYPED_${suffix}`;
const resign = (kind, value, field = "artifactHash") => {
  const { [field]: _hash, ...body } = value;
  return { ...body, [field]: hashCanonical(`onto2d:structural-typed-${kind}:v1`, body) };
};
function frozen(value) { if (value && typeof value === "object") { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }

test("typed observations preserve preparation and supply both frozen specs with one joint typed witness", () => {
  const before = canonicalize(source), a = observeTypedRelations(source, input);
  assert.deepEqual(a.preparation, prepareStructuralRegime(source, input));
  assert.equal(a.preparation.evaluation, "not-run"); assert.equal(a.evaluation, "measured");
  assert.deepEqual(a.implementation, TYPED_RELATIONS_IMPLEMENTATION);
  assert.deepEqual(a.observations.map((o) => o.observable), a.preparation.regime.observables);
  assert.deepEqual(a.observations[0].value, observeCanonicalStructure(source, { regimeId: "canonical-structure-v1" }).observation.value);
  assert.deepEqual(a.observations[1].value.edges[0].types, document.colors[0]);
  assert.equal(a.vocabulary.dictionaryHash, a.preparation.context.dictionaryHash);
  assert.deepEqual(a.evidence, { requiredFieldCount: 5, observedFieldCount: 5, missing: [] });
  assert.deepEqual(resign("observation", a), a);
  for (const key of ["distance", "status", "responseSignature", "probes"]) assert.equal(Object.hasOwn(a, key), false);
  frozen(a); assert.equal(canonicalize(source), before);
});

test("all 26 measured or incomplete observations reproduce their exact frozen source envelopes", async () => {
  const examples = await fixtures(); assert.equal(examples.length, 26);
  for (const f of examples) {
    const a = await readJson(`artifacts/${f.id}.json`);
    assert.deepEqual(verifyTypedRelationsObservation(a, f.pack, f.input), a);
  }
});

test("each of the five fields splits an otherwise identical untyped edge", () => {
  const original = observe("single-edge");
  for (const field of Object.keys(document.colors[0])) {
    const changed = observe(`change-${field}`);
    assert.deepEqual(changed.observations[0].value, original.observations[0].value);
    assert.notDeepEqual(changed.observations[1].value, original.observations[1].value, field);
  }
});

test("separate per-field isomorphisms cannot replace one joint typed bijection", () => {
  const left = graph("reciprocal-correlated"), right = graph("reciprocal-crossed");
  const measure = (g) => observeTypedRelations(packFor(g), input).observations[1].value;
  assert.notDeepEqual(measure(left), measure(right));
  for (const field of Object.keys(document.colors[0])) {
    const onlyField = (g) => ({ ...g, edges: g.edges.map((e) => ({ ...e, types: { ...document.colors[0], [field]: e.types[field] } })) });
    assert.deepEqual(measure(onlyField(left)), measure(onlyField(right)), `Individual ${field} permits a matching; the joint tuple must still split.`);
  }
});

test("set order is ignored, explicit empty sets are observed and absent fields remain missing", () => {
  assert.deepEqual(observe("set-order").observations, observe("set-reordered").observations);
  const empty = observe("empty-sets"), missing = observe("missing-field"), allMissing = observe("all-fields-missing");
  assert.equal(empty.evaluation, "measured"); assert.deepEqual(empty.observations[1].value.edges[0].types.interactionModeIds, []);
  assert.equal(missing.evaluation, "incomplete"); assert.equal(missing.observations[0].availability, "observed");
  assert.equal(missing.observations[1].availability, "missing");
  for (const field of ["value", "valueHash", "witness"]) assert.equal(missing.observations[1][field], null);
  assert.deepEqual(missing.evidence.missing, [{ sourceEdgeId: "e0", field: "interactionModeIds" }]);
  assert.equal(allMissing.evidence.observedFieldCount, 0); assert.equal(allMissing.evidence.missing.length, 5);
  assert.equal(observe("excluded-missing").evaluation, "measured");
});

test("isolate-only graphs have complete vacuous edge evidence and preserve node counts", () => {
  const one = observe("singleton"), six = observe("six-isolates");
  assert.deepEqual(six.observations[1].value, { nodeCount: 6, edges: [] });
  assert.deepEqual(six.evidence, { requiredFieldCount: 0, observedFieldCount: 0, missing: [] });
  assert.notEqual(one.observations[1].valueHash, six.observations[1].valueHash);
});

test("source IDs, annotations, model metadata and dictionaries stay outside syntactic observation values", () => {
  const a = observe("asymmetric-six");
  for (const id of ["asymmetric-six-renamed", "asymmetric-six-annotations"]) {
    const b = observe(id);
    for (let i = 0; i < 2; i += 1) {
      assert.deepEqual(a.observations[i].value, b.observations[i].value);
      assert.equal(a.observations[i].valueHash, b.observations[i].valueHash);
    }
    assert.notEqual(a.artifactHash, b.artifactHash);
  }
  const a2 = observe("single-edge"), b2 = observe("changed-dictionary");
  assert.notEqual(a2.vocabulary.dictionaryHash, b2.vocabulary.dictionaryHash);
  assert.equal(a2.observations[1].valueHash, b2.observations[1].valueHash);
});

test("record order and edge IDs do not enter typed coordinates or change canonical identities", () => {
  const changed = buildModelPack({ model: source.manifest.model, source: source.manifest.source,
    nodes: [...source.files["model/nodes.json"]].reverse(), dictionaries: source.files["model/dictionaries.json"],
    edges: source.files["model/edges.json"].map((e) => ({ ...e, id: "renamed" })).reverse() });
  const a = observeTypedRelations(source, input), b = observeTypedRelations(changed, input);
  assert.equal(a.observations[1].valueHash, b.observations[1].valueHash);
  assert.equal(a.observations[1].witness.candidateHash, b.observations[1].witness.candidateHash);
  assert.notEqual(a.artifactHash, b.artifactHash);
});

test("every typed witness reconstructs directed endpoints and the full normalized field tuple", () => {
  for (const g of document.controls.filter((g) => !g.scope)) {
    const a = observeTypedRelations(packFor(g), input), typed = a.observations[1];
    if (typed.availability === "missing") continue;
    const mapping = new Map(typed.witness.nodes.map((n) => [n.sourceNodeId, n.canonicalNode]));
    assert.deepEqual([...mapping.values()].sort((a, b) => a - b), Array.from({ length: g.nodes }, (_, i) => i));
    for (const edge of packFor(g).files["model/edges.json"]) {
      const witness = typed.witness.edges.find((w) => w.sourceEdgeId === edge.id);
      assert.equal(witness.from, mapping.get(edge.source)); assert.equal(witness.to, mapping.get(edge.target));
      for (const f of Object.keys(document.colors[0])) assert.deepEqual(witness.types[f], Array.isArray(edge[f]) ? [...edge[f]].sort((a, b) => a - b) : edge[f]);
    }
    assert.ok(typed.witness.statistics.searchStates <= 100000);
  }
});

test("malformed present fields anywhere in the complete source cannot be hidden outside the induced scope", () => {
  const invalid = { dependencyTypeId: [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "0", null],
    interactionModeIds: [[0, 0], [-1], [0.1], ["0"], null, 0], causalDirectionIds: [[1, 1], [false], null],
    ontologicalRole: ["unknown", "", null], necessity: ["unknown", 0, null] };
  for (const [field, values] of Object.entries(invalid)) for (const value of values) {
    const g = graph("single-edge"); g.nodes = 3; g.edges[0].types[field] = value;
    assert.throws(() => observeTypedRelations(packFor(g), { ...input, scope: { kind: "induced", nodeIds: ["n2"] } }), code("FIELD_INVALID"));
  }
});

test("safe integer codes including the upper bound and numerically sorted sets retain exact values", () => {
  const g = graph("single-edge"); g.edges[0].types.dependencyTypeId = Number.MAX_SAFE_INTEGER;
  g.edges[0].types.interactionModeIds = [10, 2, Number.MAX_SAFE_INTEGER];
  const a = observeTypedRelations(packFor(g), input);
  assert.equal(a.observations[1].value.edges[0].types.dependencyTypeId, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(a.observations[1].value.edges[0].types.interactionModeIds, [2, 10, Number.MAX_SAFE_INTEGER]);
});

test("induced scope retains boundary provenance and isolates without admitting external typed edges", () => {
  const g = { id: "boundary", nodes: 5, edges: [[0, 1], [1, 2], [2, 3], [3, 0]].map(([from, to]) => ({ from, to, types: document.colors[0] })) };
  const request = { ...input, scope: { kind: "induced", nodeIds: ["n4", "n1", "n0"] } };
  const a = observeTypedRelations(packFor(g), request);
  assert.equal(a.observations[1].value.nodeCount, 3); assert.equal(a.observations[1].value.edges.length, 1);
  assert.deepEqual(a.preparation.scope.incomingBoundaryEdgeIds, ["e3"]);
  assert.deepEqual(a.preparation.scope.outgoingBoundaryEdgeIds, ["e1"]); assert.deepEqual(a.preparation.scope.externalEdgeIds, ["e2"]);
  g.edges[2].types = document.colors[1];
  const b = observeTypedRelations(packFor(g), request);
  assert.equal(a.observations[1].valueHash, b.observations[1].valueHash); assert.notEqual(a.artifactHash, b.artifactHash);
});

test("source corruption and excluded loops or parallel edges reject before observation", () => {
  const request = { ...input, scope: { kind: "induced", nodeIds: ["n1"] } };
  const corrupt = structuredClone(source); corrupt.files["model/edges.json"][0].dependencyTypeId = 1;
  assert.throws(() => observeTypedRelations(corrupt, request));
  const loop = graph("single-edge"); loop.edges[0].to = 0;
  const parallel = graph("single-edge"); parallel.edges.push(parallel.edges[0]);
  for (const g of [loop, parallel]) assert.throws(() => observeTypedRelations(packFor(g), request));
});

test("the six-node limit is enforced before matching and all 30 complete directed edges are supported", () => {
  assert.equal(observe("complete-six").observations[1].value.edges.length, 30);
  assert.throws(() => observeTypedRelations(packFor({ id: "large", nodes: 7, edges: [] }), input), (e) => e.code === "STRUCTURAL_REGIME_LIMIT_EXCEEDED");
  assert.throws(() => canonicalizeTypedDirectedStructure(["a", "b"], [{ id: "e", source: "a", target: "b" }]), code("EVIDENCE_MISSING"));
});

test("explicit typed input rejects thresholds, overrides, malformed scopes and other regimes without invoking getters", () => {
  for (const request of [{}, null, [], { ...input, tolerance: 0.1 }, { ...input, maxSearchStates: 1 },
    { ...input, scope: { kind: "induced", nodeIds: [] } }, { ...input, scope: { kind: "induced", nodeIds: ["n0", "n0"] } },
    { ...input, scope: { kind: "induced", nodeIds: ["absent"] } }]) assert.throws(() => observeTypedRelations(source, request));
  for (const regimeId of ["canonical-structure-v1", "topology-only-v1", "history-aware-v1"]) assert.throws(() => observeTypedRelations(source, { regimeId }), code("REGIME_UNSUPPORTED"));
  let invoked = false;
  assert.throws(() => observeTypedRelations(source, { get regimeId() { invoked = true; return input.regimeId; } }));
  assert.equal(invoked, false);
});

test("expected-source replay rejects rehashed typed tuples, witnesses, missingness, vocabulary and comparison claims", () => {
  const original = observeTypedRelations(source, input);
  for (const mutate of [
    (a) => { a.observations[1].value.edges[0].types.dependencyTypeId = 1; },
    (a) => { a.observations[1].value.edges[0].types.interactionModeIds = []; },
    (a) => { a.observations[1].witness.edges[0].types.necessity = "optional"; },
    (a) => { a.observations[1].witness.statistics.searchStates += 1; },
    (a) => { a.evidence.observedFieldCount = 0; }, (a) => { a.observations.reverse(); },
    (a) => { a.evaluation = "incomplete"; }, (a) => { a.vocabulary.dictionaryHash = `sha256:${"0".repeat(64)}`; },
    (a) => { a.preparation.evaluation = "measured"; }, (a) => { a.distance = 0; }, (a) => { a.status = "indeterminate"; }
  ]) {
    const a = structuredClone(original); mutate(a);
    for (const o of a.observations) if (o.value) {
      o.valueHash = hashCanonical("onto2d:structural-typed-value:v1", { regime: o.regime, observable: o.observable, implementation: o.implementation, value: o.value });
    }
    assert.throws(() => verifyTypedRelationsObservation(resign("observation", a), source, input), code("VERIFICATION_FAILED"));
  }
  assert.throws(() => verifyTypedRelationsObservation(original, packFor(graph("same-dictionary-other-source")), input), code("VERIFICATION_FAILED"));
});

test("oversized verification artifacts reject the fixed serialization budget", () => {
  const a = structuredClone(observeTypedRelations(source, input)); a.extra = "x".repeat(1048576);
  assert.throws(() => verifyTypedRelationsObservation(a, source, input), code("LIMIT_EXCEEDED"));
});

test("typed observations require engine opt-in and an authentic Model bridge", async () => {
  const definition = createTypedRelationsObservationAnalysis();
  const engine = await Onto2D.create({ models: [source], analyses: [definition] });
  assert.deepEqual(await engine.analyze(definition.id, input), observeTypedRelations(source, input));
  assert.throws(() => definition.run({ model: {} }, input));
  const plain = await Onto2D.create({ models: [source] }); await assert.rejects(() => plain.analyze(definition.id, input));
});
