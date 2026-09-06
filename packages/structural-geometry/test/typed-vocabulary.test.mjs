import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { observeTypedRelations, createStructuralVocabularyMapping, verifyStructuralVocabularyMapping,
  alignTypedRelations, verifyTypedRelationsAlignment } from "@onto2d/structural-geometry/typed";
import { fixtures, mappingFixtures, readJson, input } from "../../../cases/structural-geometry/typed/fixtures.mjs";
import { alignmentFixtures } from "../../../cases/structural-geometry/typed/build.mjs";

const examples = new Map((await fixtures()).map((f) => [f.id, f]));
const declarations = new Map((await mappingFixtures()).map((f) => [f.id, f]));
const alignments = new Map((await alignmentFixtures()).map((f) => [f.id, f]));
const run = (f) => alignTypedRelations(f.left.pack, f.left.input, f.right.pack, f.right.input, f.options);
const code = (suffix) => (e) => e.code === `STRUCTURAL_TYPED_${suffix}`;

test("five vocabulary maps and eight alignments replay with their expected sources and externally supplied approvals", async () => {
  for (const m of declarations.values()) {
    const artifact = await readJson(`mappings/${m.id}.json`);
    assert.deepEqual(verifyStructuralVocabularyMapping(artifact, m.left.pack, m.right.pack, m.declaration), artifact);
  }
  for (const f of alignments.values()) {
    const artifact = await readJson(`alignments/${f.id}.json`);
    assert.deepEqual(verifyTypedRelationsAlignment(artifact, f.left.pack, f.left.input, f.right.pack, f.right.input, f.options), artifact);
  }
});

test("equal raw code values and equal dictionaries in different sources do not authorize vocabulary compatibility", () => {
  const f = alignments.get("cross-source-unbound"), a = run(f);
  assert.equal(a.sources.left.vocabulary.dictionaryHash, a.sources.right.vocabulary.dictionaryHash);
  assert.equal(a.sources.left.observations[1].valueHash, a.sources.right.observations[1].valueHash);
  assert.equal(a.compatibility.state, "unresolved"); assert.equal(a.aligned, null);
  assert.deepEqual(a.compatibility.reasons, [{ code: "cross-source-mapping-required" }]);
});

test("mapping creation and its review-evidence reference do not self-approve the mapping", () => {
  const f = alignments.get("renumbered-unapproved"), a = run(f);
  assert.equal(a.compatibility.state, "unresolved"); assert.equal(a.aligned, null);
  assert.deepEqual(a.compatibility.reasons, [{ code: "mapping-not-approved" }]);
  const wrongApproval = run({ ...f, options: { ...f.options, approvedMappingHash: `sha256:${"0".repeat(64)}` } });
  assert.equal(wrongApproval.compatibility.state, "unresolved");
  assert.equal(run(alignments.get("renumbered-approved")).compatibility.state, "compatible");
});

test("an approved renumbering recanonicalizes the joint graph instead of replacing codes in old canonical positions", () => {
  const a = run(alignments.get("renumbered-approved"));
  assert.notDeepEqual(a.sources.left.observations[1].value, a.sources.right.observations[1].value);
  assert.deepEqual(a.aligned.left.value, a.aligned.right.value);
  const stalePositions = structuredClone(a.sources.right.observations[1].value);
  for (const e of stalePositions.edges) for (const [field, pairs] of Object.entries(a.mapping.declaration.fields)) {
    const lookup = new Map(pairs.map((p) => [p.right, p.left]));
    e.types[field] = Array.isArray(e.types[field]) ? e.types[field].map((v) => lookup.get(v)).sort((a, b) => a - b) : lookup.get(e.types[field]);
  }
  assert.notDeepEqual(stalePositions, a.aligned.left.value, "This control must require a new canonical numbering.");
  assert.notDeepEqual(a.aligned.right.witness.nodes, a.sources.right.observations[1].witness.nodes);
});

test("approved partial mappings retain explicit uncovered values on both sides and no aligned graph", () => {
  const a = run(alignments.get("partial-approved"));
  assert.equal(a.compatibility.state, "unresolved"); assert.equal(a.aligned, null);
  assert.deepEqual(a.compatibility.reasons, [
    { code: "mapping-value-uncovered", side: "left", field: "dependencyTypeId", value: 1 },
    { code: "mapping-value-uncovered", side: "right", field: "dependencyTypeId", value: 10 }
  ]);
});

test("approved mappings cannot fill absent typed fields or override incomplete evidence", () => {
  const a = run(alignments.get("missing-approved"));
  assert.equal(a.compatibility.state, "unresolved"); assert.equal(a.aligned, null);
  assert.deepEqual(a.compatibility.reasons, [{ code: "missing-typed-observation", side: "right" }]);
  assert.equal(a.sources.right.observations[1].value, null);
});

test("all five mapping fields are explicit, including reviewed enum correspondences", () => {
  const a = run(alignments.get("role-approved"));
  assert.notDeepEqual(a.sources.left.observations[1].value, a.sources.right.observations[1].value);
  assert.deepEqual(a.aligned.left.value, a.aligned.right.value);
  assert.equal(a.aligned.right.value.edges[0].types.ontologicalRole, "arising");
});

test("same exact source vocabulary supports different scopes without asserting their graph equality", () => {
  const f = examples.get("asymmetric-six");
  const a = alignTypedRelations(f.pack, { ...input, scope: { kind: "induced", nodeIds: ["n0", "n1"] } }, f.pack,
    { ...input, scope: { kind: "induced", nodeIds: ["n2", "n3", "n4"] } });
  assert.deepEqual(a.compatibility, { state: "compatible", basis: "same-source", reasons: [] });
  assert.notDeepEqual(a.aligned.left.value, a.aligned.right.value);
  for (const key of ["distance", "status", "responseSignature"]) assert.equal(Object.hasOwn(a, key), false);
  assert.equal(run(alignments.get("identity-approved")).compatibility.basis, "approved-mapping");
});

test("mappings are exact-source and orientation bound even when raw code observations coincide", () => {
  const m = declarations.get("renumbered"), mapping = createStructuralVocabularyMapping(m.left.pack, m.right.pack, m.declaration);
  assert.throws(() => verifyStructuralVocabularyMapping(mapping, m.right.pack, m.left.pack, m.declaration), code("VERIFICATION_FAILED"));
  const f = alignments.get("identity-approved"), changed = examples.get("changed-dictionary");
  assert.equal(observeTypedRelations(changed.pack, input).observations[1].valueHash, observeTypedRelations(f.right.pack, input).observations[1].valueHash);
  assert.throws(() => alignTypedRelations(f.left.pack, input, changed.pack, input, f.options), code("VERIFICATION_FAILED"));
});

test("mapping entry order is normalized while duplicates, many-to-one maps, invalid atoms and extra declarations reject", () => {
  const m = declarations.get("renumbered"), original = createStructuralVocabularyMapping(m.left.pack, m.right.pack, m.declaration);
  const reordered = structuredClone(m.declaration);
  Object.values(reordered.fields).forEach((pairs) => pairs.reverse());
  assert.deepEqual(createStructuralVocabularyMapping(m.left.pack, m.right.pack, reordered), original);
  for (const change of [
    (d) => { d.fields.dependencyTypeId.push(d.fields.dependencyTypeId[0]); },
    (d) => { d.fields.dependencyTypeId[1].right = d.fields.dependencyTypeId[0].right; },
    (d) => { d.fields.dependencyTypeId[1].left = -1; }, (d) => { d.fields.interactionModeIds[0].left = [0]; },
    (d) => { delete d.fields.necessity; }, (d) => { d.fields.necessity[0].right = "unknown"; },
    (d) => { d.approved = true; }, (d) => { d.reviewEvidence.contentHash = "self-approved"; },
    (d) => { d.reviewEvidence.reference = " "; }
  ]) { const d = structuredClone(m.declaration); change(d); assert.throws(() => createStructuralVocabularyMapping(m.left.pack, m.right.pack, d)); }
});

test("the mapping bound rejects 1025 entries and accepts a valid 1024-entry declaration", () => {
  const m = declarations.get("renumbered"), d = structuredClone(m.declaration);
  for (const field of Object.keys(d.fields)) d.fields[field] = [];
  d.fields.dependencyTypeId = Array.from({ length: 1024 }, (_, i) => ({ left: i, right: 1024 - i }));
  assert.equal(createStructuralVocabularyMapping(m.left.pack, m.right.pack, d).declaration.fields.dependencyTypeId.length, 1024);
  d.fields.dependencyTypeId.push({ left: 1024, right: 0 });
  assert.throws(() => createStructuralVocabularyMapping(m.left.pack, m.right.pack, d), code("LIMIT_EXCEEDED"));
});

test("rehashed mapping changes lose external approval and cannot pass expected-declaration verification", () => {
  const f = alignments.get("renumbered-approved"), m = declarations.get("renumbered");
  const changed = structuredClone(m.declaration); changed.reviewEvidence.reference = "different-review";
  const mapping = createStructuralVocabularyMapping(m.left.pack, m.right.pack, changed);
  assert.throws(() => verifyStructuralVocabularyMapping(mapping, m.left.pack, m.right.pack, m.declaration), code("VERIFICATION_FAILED"));
  assert.equal(run({ ...f, options: { ...f.options, mapping } }).compatibility.state, "unresolved");
});

test("alignment verification rejects rehashed compatibility, mapped values and source witnesses", () => {
  const f = alignments.get("renumbered-approved"), original = run(f);
  for (const mutate of [
    (a) => { a.aligned.right.value.edges[0].types.dependencyTypeId = 999; },
    (a) => { a.aligned.right.witness.edges[0].types.interactionModeIds = []; },
    (a) => { a.compatibility.basis = "same-source"; }, (a) => { a.request.approvedMappingHash = null; },
    (a) => { a.distance = 0; }, (a) => { a.sources.left.evidence.observedFieldCount = 0; }
  ]) {
    const a = structuredClone(original); mutate(a); const { artifactHash: _old, ...body } = a;
    const forged = { ...body, artifactHash: hashCanonical("onto2d:structural-typed-alignment:v1", body) };
    assert.throws(() => verifyTypedRelationsAlignment(forged, f.left.pack, f.left.input, f.right.pack, f.right.input, f.options), code("VERIFICATION_FAILED"));
  }
  assert.ok(Object.isFrozen(original.aligned.right.value.edges[0].types.interactionModeIds));
  assert.equal(canonicalize(f.options.mapping), canonicalize(original.mapping));
});

test("invalid mapping payloads and options reject even when another evidence gap would leave alignment unresolved", () => {
  const f = alignments.get("missing-approved");
  const forged = structuredClone(f.options.mapping); forged.left.dictionaryHash = `sha256:${"0".repeat(64)}`;
  assert.throws(() => run({ ...f, options: { ...f.options, mapping: forged } }), code("VERIFICATION_FAILED"));
  for (const options of [{ mapping: null }, { approvedMappingHash: f.options.approvedMappingHash },
    { ...f.options, threshold: 0.1 }, { ...f.options, approvedMappingHash: "not-a-hash" }]) assert.throws(() => run({ ...f, options }));
});
