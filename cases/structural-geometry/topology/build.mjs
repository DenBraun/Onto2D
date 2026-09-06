import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { observeStructuralTopology, verifyStructuralTopologyObservation } from "@onto2d/structural-geometry/topology";
import { observeCanonicalStructure } from "@onto2d/structural-geometry/canonical";
import { fixtures, directory, readJson } from "./fixtures.mjs";
import { verifyCensus } from "./census.mjs";

const encoded = (value) => `${JSON.stringify(canonicalClone(value), null, 2)}\n`;
export async function verifyReferenceSources(reference) {
  for (const [file, expected] of [["controls.json", reference.controlsFileSha256],
    ["../../../models/causal-emergence/releases/2026.08.15/bundle.json", reference.causalFileSha256],
    ["../canonical/reference.py", reference.canonicalReferenceFileSha256]]) {
    const actual = createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex");
    assert.equal(actual, expected, `Independent reference source binding differs: ${file}`);
  }
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const reference = await readJson("reference.json"), controls = await readJson("controls.json");
  await verifyReferenceSources(reference);
  const census = await verifyCensus(), examples = await fixtures();
  assert.deepEqual(reference.controls.map((c) => c.id), examples.map((f) => f.id));
  const outputs = [], runs = [], values = new Map(), artifacts = new Map();
  for (const [i, f] of examples.entries()) {
    const artifact = observeStructuralTopology(f.pack, f.input);
    verifyStructuralTopologyObservation(artifact, f.pack, f.input);
    assert.deepEqual(artifact.observation.value, reference.controls[i].value, f.id);
    assert.deepEqual(artifact.diagnostics, reference.controls[i].diagnostics, f.id);
    if (f.id.startsWith("causal-fragment")) assert.deepEqual(artifact.preparation.context.model, await readJson("../causal-emergence/source-lock.json"));
    const file = `artifacts/${f.id}.json`;
    outputs.push([file, encoded(artifact)]); artifacts.set(f.id, artifact);
    values.set(f.id, canonicalize(artifact.observation.value));
    runs.push({ id: f.id, input: f.input, file, value: artifact.observation.value,
      valueHash: artifact.observation.valueHash, artifactHash: artifact.artifactHash });
  }
  for (const [a, b] of [...controls.equalities, ...controls.collisions]) assert.equal(values.get(a), values.get(b), `Expected equal topology values: ${a}, ${b}`);
  for (const [a, b] of controls.differences) assert.notEqual(values.get(a), values.get(b), `Expected different topology values: ${a}, ${b}`);
  const collisions = controls.collisions.map(([left, right]) => {
    const a = examples.find((f) => f.id === left), b = examples.find((f) => f.id === right);
    const exactInput = { regimeId: "canonical-structure-v1" };
    const ca = observeCanonicalStructure(a.pack, exactInput), cb = observeCanonicalStructure(b.pack, exactInput);
    assert.notDeepEqual(ca.observation.value, cb.observation.value);
    return { left, right, topologyValueHash: artifacts.get(left).observation.valueHash,
      leftCanonicalValueHash: ca.observation.valueHash, rightCanonicalValueHash: cb.observation.valueHash };
  });
  const body = { schemaVersion: "1", suiteId: "structural-topology-observations-v1", status: "bounded-computational-agreement",
    referenceHash: hashCanonical("onto2d:structural-topology-reference:v1", reference), census,
    controls: { equalities: controls.equalities, differences: controls.differences, collisions }, runs };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-topology-suite:v1", body) };
  outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else if (await readFile(new URL(file, directory), "utf8") !== bytes) throw new Error(`Topology observation replay differs: ${file}`);
  }
  if (report) { console.table(census.rows); console.table(runs.map(({ id, value }) => ({ id, ...value }))); }
  console.log(`Topology observations ${write ? "written" : "verified"}: ${runs.length} artifacts, 4165 exhaustive small graphs, explicit exact-canonical collision controls.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/topology/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch((error) => { console.error(error); process.exitCode = 1; });
}
