import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize } from "@onto2d/kernel/canonical";
import { runStructuralInvarianceProbes, verifyStructuralInvarianceProbes } from "@onto2d/structural-geometry/invariance";
import { adjudicateInvariance, compareInvarianceObservations, observeRepresentation, invarianceHash, INVARIANCE_CODEC } from "../../../packages/structural-geometry/src/invariance-core.js";
import { packFor } from "../typed/fixtures.mjs";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const referenceFiles = ["controls.json", "PROTOCOL.md", "../sandbox/controls.json", "../canonical/controls.json", "../typed/controls.json",
  "../sandbox/reference.py", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py",
  "../../../models/causal-emergence/releases/2026.08.15/bundle.json"];
const encoded = value => JSON.stringify(canonicalClone(value, INVARIANCE_CODEC), null, 2) + "\n";
const digest = value => createHash("sha256").update(canonicalize(value, INVARIANCE_CODEC)).digest("hex");
export async function verifyReferenceSources(reference) {
  assert.deepEqual(Object.keys(reference.sourceHashes).sort(), [...referenceFiles].sort());
  for (const file of referenceFiles) assert.equal(createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex"),
    reference.sourceHashes[file], `Invariance reference source binding differs: ${file}`);
}
function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [v, ...rest]));
}
const permutationCache = new Map();
// Test/reference bridge only: brute-force orbits of production output values,
// without importing the production canonicalizer or its candidate translation.
export function orbitKey(value, typed) {
  const n = value.nodeCount;
  if (!permutationCache.has(n)) permutationCache.set(n, permutations(Array.from({ length: n }, (_, i) => i)));
  const forms = permutationCache.get(n).map(p => {
    const edges = value.edges.map(e => [p[e.from], p[e.to], ...(typed ? [e.types] : [])]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return typed ? canonicalize([n, edges]) : edges.reduce((sum, [u, v]) => sum + 2 ** (u * (n - 1) + v - Number(v > u)), 0);
  });
  return forms.reduce((a, b) => a < b ? a : b);
}
function values(observation, regime) {
  return observation.observations.map(o => ({ value: o.value === null || regime === "topology-only-v1" ? o.value
    : orbitKey(o.value, o.observable.id === "canonical-typed-directed-structure-v1"), missing: o.missing }));
}
export function referenceSummary(id, artifact) {
  const regime = artifact.request.regimeId, b = artifact.baseline;
  return { id, scopeAccounting: Object.fromEntries(["nodeIds", "edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"].map(k => [k, artifact.preparation.scope[k]])),
    baseline: { data: JSON.parse(b.representation.payload), mapping: b.mapping, values: values(b.observation, regime) },
    runs: artifact.runs.map((r, i) => ({ transformation: artifact.registry.probes[i].transformation, data: JSON.parse(r.representation.payload),
      mapping: r.mapping, payloadChanged: r.payloadChanged, values: values(r.observation, regime), comparison: r.comparison })),
    summary: artifact.summary, work: artifact.work };
}
export async function verifyCensus(reference) {
  const types = (await readJson("controls.json")).censusTypes, census = [];
  for (let n = 1; n <= 3; n += 1) {
    const pairs = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? null : [u, v]).filter(Boolean)).flat();
    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
      const pack = packFor({ id: `invariance-census-${n}-${mask}`, nodes: n, edges: pairs.filter((_, i) => mask & (1 << i)).map(([from, to]) => ({ from, to, types })) });
      for (const regimeId of ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]) {
        const id = `n${n}-mask${mask}-${regimeId}`;
        census.push({ id, sha256: digest(referenceSummary(id, runStructuralInvarianceProbes(pack, { regimeId }))) });
      }
    }
  }
  assert.deepEqual(census, reference.census, "Independent invariance census differs.");
  const profiles = [];
  for (let n = 0; n <= 7; n += 1) {
    const results = Array.from({ length: 3 ** n }, (_, code) => adjudicateInvariance(Array.from({ length: n }, (_, i) =>
      ["equal", "different", "indeterminate"][Math.floor(code / 3 ** (n - i - 1)) % 3])));
    profiles.push({ components: n, profiles: results.length, sha256: digest(results) });
  }
  assert.deepEqual(profiles, reference.profiles, "Independent strict aggregation differs.");
}
export function negativeControl(id, artifact) {
  const data = JSON.parse(artifact.baseline.representation.payload);
  if (id === "change-reciprocal-necessity") data.edges[0].types.necessity = "optional";
  else data.edges.shift();
  const payload = JSON.stringify(data), representation = { payload, payloadHash: invarianceHash("payload", payload) };
  const measured = observeRepresentation(artifact.preparation, representation, artifact.runs[0].mapping.edges);
  return { id, comparison: compareInvarianceObservations(artifact.baseline.observation, measured) };
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  const examples = await fixtures(); assert.deepEqual(examples.map(f => f.id), reference.cases.map(c => c.id));
  assert.equal(new Set(examples.map(f => f.id)).size, examples.length);
  const outputs = [], runs = [], artifacts = new Map();
  for (const [i, f] of examples.entries()) {
    const artifact = runStructuralInvarianceProbes(f.pack, f.input); verifyStructuralInvarianceProbes(artifact, f.pack, f.input);
    assert.deepEqual(referenceSummary(f.id, artifact), reference.cases[i], `Independent invariance differs: ${f.id}`);
    artifacts.set(f.id, artifact);
    const file = `artifacts/${f.id}.json`; outputs.push([file, encoded(artifact)]);
    runs.push({ id: f.id, file, regimeId: f.input.regimeId, summary: artifact.summary, artifactHash: artifact.artifactHash });
  }
  const negatives = [["remove-one-chain-edge", "chain"], ["change-reciprocal-necessity", "reciprocal"], ["remove-edge-with-missing-types", "missing"]]
    .map(([id, source]) => negativeControl(id, artifacts.get(source)));
  assert.deepEqual(negatives, reference.negativeControls);
  assert.deepEqual(negatives.map(n => n.id), (await readJson("controls.json")).negativeControls);
  await verifyCensus(reference);
  const body = { schemaVersion: "1", suiteId: "structural-invariance-probes-v1", status: "bounded-computational-agreement",
    referenceHash: invarianceHash("reference", reference), census: { graphs: 69, requests: 207, probes: 828, aggregationProfiles: 3280 }, negativeControls: negatives, runs };
  const suite = { ...body, artifactHash: invarianceHash("suite", body) }; outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, `Invariance replay differs: ${file}`);
  }
  if (report) console.table(runs.map(r => ({ case: r.id, regime: r.regimeId, status: r.summary.status,
    observed: r.summary.coverage.numerator, required: r.summary.coverage.denominator })));
  console.log(`Invariance suite ${write ? "written" : "verified"}: 13 controls, 207 independently checked requests / 828 probes.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/invariance/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch(error => { console.error(error); process.exitCode = 1; });
}
