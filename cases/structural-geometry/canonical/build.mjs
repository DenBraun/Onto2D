import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { observeCanonicalStructure, verifyCanonicalStructureObservation } from "@onto2d/structural-geometry/canonical";
import { fixtures, directory, readJson } from "./fixtures.mjs";
import { verifyCensus, verifySixNodeRelabelings } from "./census.mjs";

const encoded = (value) => `${JSON.stringify(canonicalClone(value), null, 2)}\n`;
export async function verifyReferenceSources(reference) {
  for (const [file, expected] of [["controls.json", reference.controlsFileSha256],
    ["../../../models/causal-emergence/releases/2026.08.15/bundle.json", reference.causalFileSha256]]) {
    const actual = createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex");
    assert.equal(actual, expected, `Independent reference source binding differs: ${file}`);
  }
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const reference = await readJson("reference.json"), controls = await readJson("controls.json");
  await verifyReferenceSources(reference);
  const census = await verifyCensus(), relabelings = await verifySixNodeRelabelings();
  const outputs = [], runs = [], values = new Map();
  for (const f of await fixtures()) {
    const artifact = observeCanonicalStructure(f.pack, f.input);
    verifyCanonicalStructureObservation(artifact, f.pack, f.input);
    if (f.id === "causal-fragment") assert.deepEqual(artifact.preparation.context.model, await readJson("../causal-emergence/source-lock.json"));
    const file = `artifacts/${f.id}.json`;
    outputs.push([file, encoded(artifact)]);
    values.set(f.id, canonicalize(artifact.observation.value));
    runs.push({ id: f.id, input: f.input, file, nodes: artifact.observation.value.nodeCount,
      edges: artifact.observation.value.edges.length, valueHash: artifact.observation.valueHash, artifactHash: artifact.artifactHash });
  }
  for (const [a, b] of controls.equalities) assert.equal(values.get(a), values.get(b), `Expected equal canonical values: ${a}, ${b}`);
  for (const [a, b] of controls.differences) assert.notEqual(values.get(a), values.get(b), `Expected different canonical values: ${a}, ${b}`);
  const body = { schemaVersion: "1", suiteId: "structural-canonical-observations-v1", status: "bounded-computational-agreement",
    referenceHash: hashCanonical("onto2d:structural-canonical-reference:v1", reference), census, relabelings,
    controls: { equalities: controls.equalities, differences: controls.differences }, runs };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-canonical-suite:v1", body) };
  outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else if (await readFile(new URL(file, directory), "utf8") !== bytes) throw new Error(`Canonical observation replay differs: ${file}`);
  }
  if (report) { console.table(census.rows); console.table(runs.map(({ id, nodes, edges, valueHash }) => ({ id, nodes, edges, valueHash }))); }
  console.log(`Canonical observations ${write ? "written" : "verified"}: 17 artifacts, 4165 exhaustive small graphs / 238 classes, 720 six-node relabelings.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/canonical/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch((error) => { console.error(error); process.exitCode = 1; });
}
