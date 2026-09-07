import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, hashCanonical } from "@onto2d/kernel/canonical";
import { compareStructuralModels, verifyStructuralComparison } from "@onto2d/structural-geometry/comparison";
import { referenceKey } from "../typed/census.mjs";
import { fixtures, directory, readJson } from "./fixtures.mjs";

const codec = { limits: { maxEntries: 500000 } };
const encoded = (value) => `${JSON.stringify(canonicalClone(value, codec), null, 2)}\n`;
const referenceFiles = ["controls.json", "PROTOCOL.md", "../typed/controls.json", "../typed/reference.py", "../canonical/reference.py",
  "../topology/reference.py", "../../../models/causal-emergence/releases/2026.08.15/bundle.json"];
export async function verifyReferenceSources(reference) {
  assert.deepEqual(Object.keys(reference.sourceHashes).sort(), [...referenceFiles].sort(), "Reference source coverage differs.");
  for (const file of referenceFiles) assert.equal(createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex"),
    reference.sourceHashes[file], `Independent comparison source binding differs: ${file}`);
}
function* permutations(values) {
  if (!values.length) { yield []; return; }
  for (let i = 0; i < values.length; i += 1) for (const rest of permutations(values.filter((_, j) => i !== j))) yield [values[i], ...rest];
}
function graphKey(value, typed) {
  if (typed) return { nodeCount: value.nodeCount, key: referenceKey(value) };
  const n = value.nodeCount, slots = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? null : `${u}:${v}`).filter(Boolean)).flat();
  const positions = new Map(slots.map((key, i) => [key, i]));
  let key = Infinity;
  for (const p of permutations(Array.from({ length: n }, (_, i) => i))) key = Math.min(key,
    value.edges.reduce((sum, e) => sum + 2 ** positions.get(`${p[e.from]}:${p[e.to]}`), 0));
  return { nodeCount: n, key };
}
export function referenceSummary(id, artifact) {
  return { id, components: artifact.components.map((row) => ({ observableId: row.observable.id, family: row.family,
    left: row.left, right: row.right, state: row.state,
    values: row.values && row.family !== "topology" ? Object.fromEntries(Object.entries(row.values).map(([side, value]) =>
      [side, graphKey(value, row.family === "typed-relations")])) : row.values,
    reasons: row.reasons.map(({ reference: _reference, contentHash: _hash, ...reason }) => reason) })),
  coverage: artifact.coverage, distance: artifact.distance, status: artifact.status, diagnostics: artifact.diagnostics };
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  const examples = await fixtures();
  assert.deepEqual(examples.map((f) => f.id), reference.cases.map((c) => c.id));
  assert.equal(new Set(examples.map((f) => f.id)).size, examples.length);
  const outputs = [], runs = [];
  for (const [i, f] of examples.entries()) {
    const artifact = compareStructuralModels(f.left, f.right, f.input);
    verifyStructuralComparison(artifact, f.left, f.right, f.input);
    assert.deepEqual(referenceSummary(f.id, artifact), reference.cases[i], `Independent comparison differs: ${f.id}`);
    const file = `artifacts/${f.id}.json`; outputs.push([file, encoded(artifact)]);
    runs.push({ id: f.id, pairId: f.pairId, file, regimeId: f.input.regimeId, status: artifact.status,
      distance: artifact.distance, coverage: artifact.coverage, diagnostics: artifact.diagnostics, artifactHash: artifact.artifactHash });
  }
  const body = { schemaVersion: "1", suiteId: "structural-strict-comparisons-v1", status: "bounded-computational-agreement",
    referenceHash: hashCanonical("onto2d:structural-comparison-reference:v1", reference), aggregationCensus: reference.aggregationCensus, runs };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-comparison-suite:v1", body) }; outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, `Comparison replay differs: ${file}`);
  }
  if (report) console.table(runs.map((r) => ({ pair: r.pairId, regime: r.regimeId, status: r.status, distance: r.distance,
    coverage: `${r.coverage.numerator}/${r.coverage.denominator}`, differences: r.diagnostics.differentObservableIds.join(", ") })));
  console.log(`Strict comparison suite ${write ? "written" : "verified"}: ${runs.length} regime runs with exact coverage and independent graph values.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/comparison/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch((error) => { console.error(error); process.exitCode = 1; });
}
