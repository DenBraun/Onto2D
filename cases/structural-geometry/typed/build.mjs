import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { observeTypedRelations, verifyTypedRelationsObservation, createStructuralVocabularyMapping,
  verifyStructuralVocabularyMapping, alignTypedRelations, verifyTypedRelationsAlignment } from "@onto2d/structural-geometry/typed";
import { fixtures, mappingFixtures, readJson, directory } from "./fixtures.mjs";
import { verifyCensus, verifySixNodeRelabelings, referenceKey } from "./census.mjs";

const encoded = (value) => `${JSON.stringify(canonicalClone(value), null, 2)}\n`;
export async function verifyReferenceSources(reference) {
  for (const [file, expected] of [["controls.json", reference.controlsFileSha256], ["PROTOCOL.md", reference.protocolFileSha256],
    ["../../../models/causal-emergence/releases/2026.08.15/bundle.json", reference.causalFileSha256],
    ["../canonical/reference.py", reference.canonicalReferenceFileSha256]]) {
    assert.equal(createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex"), expected,
      `Independent reference source binding differs: ${file}`);
  }
}
export async function alignmentFixtures() {
  const examples = new Map((await fixtures()).map((f) => [f.id, f]));
  const mappings = new Map((await mappingFixtures()).map((m) => [m.id, createStructuralVocabularyMapping(m.left.pack, m.right.pack, m.declaration)]));
  return (await readJson("controls.json")).alignments.map((entry) => {
    const mapping = mappings.get(entry.mapping);
    return { id: entry.id, left: examples.get(entry.left), right: examples.get(entry.right),
      options: mapping ? { mapping, ...(entry.approve ? { approvedMappingHash: mapping.artifactHash } : {}) } : {} };
  });
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const reference = await readJson("reference.json"), controls = await readJson("controls.json");
  await verifyReferenceSources(reference);
  const census = await verifyCensus(), relabelings = await verifySixNodeRelabelings();
  const outputs = [], runs = [], mappings = [], alignments = [], values = new Map();
  const examples = await fixtures();
  assert.deepEqual(examples.map((f) => f.id), reference.controls.map((c) => c.id));
  assert.equal(new Set(examples.map((f) => f.id)).size, examples.length);
  for (const [i, f] of examples.entries()) {
    const artifact = observeTypedRelations(f.pack, f.input), expected = reference.controls[i];
    verifyTypedRelationsObservation(artifact, f.pack, f.input);
    assert.deepEqual(artifact.evidence.missing, expected.missing);
    assert.equal(artifact.observations[0].value.nodeCount, expected.nodes);
    assert.equal(artifact.observations[0].value.edges.length, expected.edges);
    const value = artifact.observations[1].value;
    assert.equal(value ? referenceKey(value) : null, expected.typedKey, `Independent typed orbit differs: ${f.id}`);
    if (f.id === "causal-fragment") assert.deepEqual(artifact.preparation.context.model, await readJson("../causal-emergence/source-lock.json"));
    const file = `artifacts/${f.id}.json`; outputs.push([file, encoded(artifact)]);
    values.set(f.id, value ? canonicalize(value) : null);
    runs.push({ id: f.id, input: f.input, file, evaluation: artifact.evaluation,
      untypedValueHash: artifact.observations[0].valueHash, typedValueHash: artifact.observations[1].valueHash,
      missingFields: artifact.evidence.missing.length, artifactHash: artifact.artifactHash });
  }
  for (const [kind, pairs] of [["equalities", controls.equalities], ["differences", controls.differences]]) for (const [a, b] of pairs) {
    assert.ok(values.has(a) && values.has(b) && values.get(a) !== null && values.get(b) !== null);
    if (kind === "equalities") assert.equal(values.get(a), values.get(b), `Expected equal typed values: ${a}, ${b}`);
    else assert.notEqual(values.get(a), values.get(b), `Expected different typed values: ${a}, ${b}`);
  }
  for (const m of await mappingFixtures()) {
    const artifact = createStructuralVocabularyMapping(m.left.pack, m.right.pack, m.declaration);
    verifyStructuralVocabularyMapping(artifact, m.left.pack, m.right.pack, m.declaration);
    const file = `mappings/${m.id}.json`; outputs.push([file, encoded(artifact)]);
    mappings.push({ id: m.id, file, artifactHash: artifact.artifactHash });
  }
  const af = await alignmentFixtures();
  assert.deepEqual(af.map((f) => f.id), reference.alignments.map((a) => a.id));
  for (const [i, f] of af.entries()) {
    const args = [f.left.pack, f.left.input, f.right.pack, f.right.input, f.options];
    const artifact = alignTypedRelations(...args); verifyTypedRelationsAlignment(artifact, ...args);
    assert.equal(artifact.compatibility.state === "compatible", reference.alignments[i].compatible, f.id);
    if (artifact.aligned) assert.equal(canonicalize(artifact.aligned.left.value) === canonicalize(artifact.aligned.right.value), reference.alignments[i].equalAlignedValues, f.id);
    const file = `alignments/${f.id}.json`; outputs.push([file, encoded(artifact)]);
    alignments.push({ id: f.id, file, compatibility: artifact.compatibility, artifactHash: artifact.artifactHash });
  }
  const body = { schemaVersion: "1", suiteId: "structural-typed-observations-v1", status: "bounded-computational-agreement",
    referenceHash: hashCanonical("onto2d:structural-typed-reference:v1", reference), census, relabelings,
    controls: { equalities: controls.equalities, differences: controls.differences }, runs, mappings, alignments };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-typed-suite:v1", body) };
  outputs.push(["suite.json", encoded(suite)]);
  if (write) for (const name of ["artifacts/", "mappings/", "alignments/"]) await mkdir(new URL(name, directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, `Typed artifact replay differs: ${file}`);
  }
  if (report) { console.table(census.rows); console.table(runs.map(({ id, evaluation, missingFields, typedValueHash }) => ({ id, evaluation, missingFields, typedValueHash })));
    console.table(alignments.map(({ id, compatibility }) => ({ id, state: compatibility.state, basis: compatibility.basis, reasons: compatibility.reasons.map((r) => r.code).join(", ") }))); }
  console.log(`Typed observations ${write ? "written" : "verified"}: 26 observations, 5 mappings, 8 alignments; 739 exhaustive colored graphs / 145 classes and 720 relabelings.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/typed/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch((error) => { console.error(error); process.exitCode = 1; });
}
