import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize } from "@onto2d/kernel/canonical";
import { compareStructuralSignatures } from "@onto2d/structural-geometry/pseudometric";
import { PSEUDOMETRIC_CODEC, pseudometricHash, featureMismatch, summarizePseudometric } from "../../../packages/structural-geometry/src/pseudometric-core.js";
import { referenceSummary as signatureSummary } from "../signatures/build.mjs";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const files = ["controls.json", "PROTOCOL.md", "../signatures/reference.py", "../signatures/build.mjs",
  ...["controls.json", "PROTOCOL.md", "../responses/reference.py", "../responses/build.mjs",
    ...["controls.json", "PROTOCOL.md", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py", "../invariance/build.mjs",
      "../../../models/causal-emergence/releases/2026.08.15/bundle.json"].map(f => `../responses/${f}`)].map(f => `../signatures/${f}`)];
const digest = value => createHash("sha256").update(canonicalize(value, PSEUDOMETRIC_CODEC)).digest("hex");
const encoded = value => JSON.stringify(canonicalClone(value, PSEUDOMETRIC_CODEC), null, 2) + "\n";
export async function verifyReferenceSources(reference) {
  assert.deepEqual(Object.keys(reference.sourceHashes).sort(), [...files].sort());
  for (const file of files) assert.equal(createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex"), reference.sourceHashes[file], file);
}
export function referenceSummary(id, a) {
  return { id, domains: { compatible: a.domains.compatible, membership: a.domains.membership },
    components: a.components.map(c => ({ ...Object.fromEntries(["featureId", "weight", "scale", "state", "distance", "reasons"].map(k => [k, c[k]])),
      left: { measurement: c.left.measurement }, right: { measurement: c.right.measurement } })),
    ...Object.fromEntries(["status", "distance", "coverage", "diagnostics", "work"].map(k => [k, a[k]])) };
}
const tuples = n => Array.from({ length: 3 ** n }, (_, code) => Array.from({ length: n }, (_, i) => Math.floor(code / 3 ** (n - 1 - i)) % 3));
const modes = ["coverage-only", "partial-with-coverage"];
export function verifyAggregation(reference) {
  const rows = Array.from({ length: 6 }, (_, n) => {
    const profiles = tuples(n).flatMap(states => modes.map(mode => summarizePseudometric(states.map((s, i) =>
      ({ featureId: String(i), state: ["equal", "different", "indeterminate"][s] })), mode)));
    return { features: n, profiles: profiles.length, sha256: digest(profiles) };
  });
  assert.deepEqual(rows, reference.aggregationProfiles);
  for (const c of reference.partialCounterexamples) {
    const pairs = [[0, 1], [1, 2], [0, 2]].map(([i, j]) => summarizePseudometric(c.vectors[i].map((a, k) => {
      const b = c.vectors[j][k];
      return { featureId: String(k), state: a === null || b === null ? "indeterminate" : a === b ? "equal" : "different" };
    }), modes[1]));
    assert.deepEqual(pairs, c.pairs);
    const values = pairs.map(p => p.diagnostics.partial.value);
    assert.ok(values[2].numerator * values[1].denominator > values[1].numerator * values[2].denominator);
    assert.equal(values[0].numerator, 0); assert.equal(pairs[0].distance, null); assert.equal(pairs[2].distance, null);
  }
}
export function verifyMetricProperties(reference) {
  // Three symbols denote distinct nonempty joint multisets, not caller hashes.
  const rows = [];
  for (const n of [3, 5]) {
    const observableIds = n === 5 ? ["canonical-directed-structure-v1", "canonical-typed-directed-structure-v1"] : ["canonical-directed-structure-v1"];
    const symbols = [1, 2, 3].map(count => [{ components: observableIds.map(observableId => ({ observableId, state: "different", delta: null })), count }]);
    const vectors = tuples(n);
    const matrix = vectors.map(a => vectors.map(b => summarizePseudometric(a.map((s, i) => ({ featureId: String(i),
      state: featureMismatch(symbols[s], symbols[b[i]]) ? "different" : "equal" })), modes[0]).distance));
    const units = matrix.map(row => row.map(d => d.numerator * (n / d.denominator)));
    for (let i = 0; i < units.length; i += 1) {
      assert.equal(units[i][i], 0);
      for (let j = 0; j < units.length; j += 1) {
        assert.ok(Number.isInteger(units[i][j]) && units[i][j] >= 0 && units[i][j] <= n);
        assert.equal(units[i][j], units[j][i]);
        for (let k = 0; k < units.length; k += 1) assert.ok(units[i][k] <= units[i][j] + units[j][k]);
      }
    }
    rows.push({ dimensions: n, vectors: vectors.length, orderedPairs: vectors.length ** 2,
      orderedTriangles: vectors.length ** 3, sha256: digest(matrix) });
  }
  assert.deepEqual(rows, reference.metricProperties);
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or report.");
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  const examples = await fixtures(); assert.deepEqual(examples.map(f => f.id), reference.cases.map(c => c.id));
  const endpointHashes = new Map(reference.endpoints.map(e => [e.id, e.sha256])), seen = new Set(), outputs = [], runs = [];
  for (const [i, f] of examples.entries()) {
    const a = compareStructuralSignatures(f.left.pack, f.right.pack, f.input);
    assert.deepEqual(referenceSummary(f.id, a), reference.cases[i], f.id);
    for (const side of ["left", "right"]) {
      const id = f[side].id; assert.equal(digest(signatureSummary(id, a.evidence[side])), endpointHashes.get(id), id); seen.add(id);
    }
    const file = `artifacts/${f.id}.json`; outputs.push([file, encoded(a)]);
    runs.push({ id: f.id, file, regimeId: f.input.regimeId, status: a.status, distance: a.distance, coverage: a.coverage,
      partial: a.diagnostics.partial, artifactHash: a.artifactHash });
  }
  assert.deepEqual([...seen].sort(), [...endpointHashes.keys()].sort());
  verifyAggregation(reference); verifyMetricProperties(reference);
  const body = { schemaVersion: "1", suiteId: "fixed-domain-response-pseudometric-v0", status: "bounded-computational-agreement",
    referenceHash: pseudometricHash("reference", reference), metricProperties: reference.metricProperties, aggregationProfiles: 728, runs };
  const suite = { ...body, artifactHash: pseudometricHash("suite", body) }; outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, file);
  }
  if (report) console.table(runs.map(r => ({ case: r.id, status: r.status,
    distance: r.distance ? `${r.distance.numerator}/${r.distance.denominator}` : "indeterminate",
    coverage: `${r.coverage.numerator}/${r.coverage.denominator}`,
    partial: r.partial?.value ? `${r.partial.value.numerator}/${r.partial.value.denominator} (no metric guarantee)` : "unavailable" })));
  console.log(`Pseudometric suite ${write ? "written" : "verified"}: ${runs.length} controls, 59778 pairs, 14368590 triangles, 728 aggregation profiles.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/pseudometric/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch(e => { console.error(e); process.exitCode = 1; });
}
