import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize } from "@onto2d/kernel/canonical";
import { buildGeometricSignature } from "@onto2d/structural-geometry/geometric-signature";
import { createOllivierAnalyzer } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { createStructuralFlowAnalyzer } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { GEOMETRIC_CODEC, geometricHash, geometricRoles, scalarDescriptor, thresholdEvents, geometricSummary } from "../../../packages/structural-geometry/src/geometric-signature-core.js";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const files = ["controls.json", "sources.json", "PROTOCOL.md", "measurements.py", "measurements.json", "../flow/networkx_reference.py", "../flow/paper_reference.py", "../experiments/reference.py"];
const digest = value => createHash("sha256").update(canonicalize(value, GEOMETRIC_CODEC)).digest("hex");
const encoded = value => JSON.stringify(canonicalClone(value, GEOMETRIC_CODEC), null, 2) + "\n";
export async function verifyReferenceSources(reference, measurements) {
  assert.deepEqual(Object.keys(reference.sourceHashes).sort(), [...files].sort());
  assert.deepEqual(Object.keys(measurements.sourceHashes).sort(), files.filter(f => f !== "measurements.json").sort());
  for (const file of files) {
    const hash = createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex");
    assert.equal(hash, reference.sourceHashes[file], file);
    if (file !== "measurements.json") assert.equal(hash, measurements.sourceHashes[file], file);
  }
}
export function referenceSummary(id, a) {
  const features = canonicalClone(a.features.map(f => Object.fromEntries(["id", "state", "coverage", "value", "provenance", "reasons"].map(k => [k, f[k]]))), GEOMETRIC_CODEC);
  if (features[2].provenance) for (const frame of features[2].provenance.frames) delete frame.stateHash;
  return { id, population: { nodeIds: a.population.nodeIds, edgeIds: a.population.edgeIds }, features, summary: a.summary, value: a.value, work: a.work };
}
export function measurementSummary(id, a) {
  const f = a.evidence.forman?.legacyArtifact, o = a.evidence.ollivier, flow = a.evidence.flow;
  const sourceGraph = f ? { nodes: f.result.nodes, edges: f.result.edges } : o?.request.graph ?? flow?.request.graph;
  const graph = sourceGraph ? { nodes: sourceGraph.nodes.map(n => ({ id: n.id })), edges: sourceGraph.edges.map(e => ({ id: e.id, source: e.source, target: e.target })) }
    : null;
  return { id, graph, forman: f ? f.result.edges.map(e => ({ id: e.id, length: e.length ?? { numerator: "1", denominator: "1" },
    curvature: typeof e.curvature === "number" ? { lowerTicks: String(BigInt(e.curvature) * 1000000000000n), upperTicks: String(BigInt(e.curvature) * 1000000000000n) } : e.curvature })) : null,
    ollivier: o ? o.result.edges.map(e => ({ id: e.id, curvature: e.curvature })) : null,
    flow: flow ? { horizon: flow.request.parameters.maxIterations, states: flow.states.map(s => ({ iteration: s.iteration,
      edges: s.edges.map(e => ({ id: e.id, length: e.length, curvature: e.curvature })),
      maxLengthChange: s.summary.maxLengthChange, maxCurvatureChange: s.summary.maxCurvatureChange, stableStepCount: s.summary.stableStepCount })),
    termination: flow.termination, cuts: flow.cuts } : null };
}
const q = n => ({ numerator: String(n), denominator: "1" });
const tuples = (size, n) => Array.from({ length: size ** n }, (_, code) => Array.from({ length: n }, (_, i) => Math.floor(code / size ** (n - 1 - i)) % size));
export function verifyProperties(reference) {
  const intervals = [[-1, -1], [-1, 0], [0, 0], [0, 1], [1, 1]], extrema = [], traces = [], adjudications = [];
  for (let n = 0; n <= 4; n += 1) {
    const graph = { nodes: Array.from({ length: n + 1 }, (_, i) => ({ id: String(i) })),
      edges: Array.from({ length: n }, (_, i) => ({ id: String(i), source: String(i), target: String(i + 1) })) };
    for (const rows of tuples(5, n)) extrema.push(scalarDescriptor(rows.map((s, i) => ({ id: String(i), value: { lower: q(intervals[s][0]), upper: q(intervals[s][1]) } })), geometricRoles(graph), "certified-interval"));
  }
  for (let n = 0; n <= 3; n += 1) {
    for (const rows of tuples(3, 2 * n)) {
      const states = Array.from({ length: n }, (_, i) => ({ iteration: i, edges: [0, 1].map(j => ({ id: String(j), length: q(rows[2 * i + j] + 1) })) }));
      traces.push(thresholdEvents(states, { kind: "final-length", threshold: q(2) }));
    }
    for (const states of tuples(3, n)) adjudications.push(geometricSummary(states.map((s, i) => ({ id: String(i), state: ["observed", "partial", "unavailable"][s] }))));
  }
  assert.deepEqual({ intervalExtrema: { profiles: extrema.length, sha256: digest(extrema) }, thresholdTraces: { profiles: traces.length, sha256: digest(traces) },
    aggregation: { profiles: adjudications.length, sha256: digest(adjudications) } }, reference.properties);
}
export async function computeEvidence(f, analyzers = {}) {
  const ollivier = analyzers.ollivier ?? createOllivierAnalyzer(createPythonOllivierAdapter());
  const flow = analyzers.flow ?? createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter());
  return { ollivier: f.input.ollivier && !f.missing.includes("ollivier") ? await ollivier.analyze(f.pack, f.input.ollivier) : null,
    flow: f.input.flow && !f.missing.includes("flow") ? await flow.analyze(f.pack, f.input.flow) : null };
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or report.");
  const reference = await readJson("reference.json"), measurements = await readJson("measurements.json"); await verifyReferenceSources(reference, measurements);
  const examples = await fixtures(); assert.deepEqual(examples.map(f => f.id), reference.cases.map(c => c.id));
  assert.deepEqual(examples.map(f => f.id), measurements.cases.map(c => c.id));
  const outputs = [], runs = [], analyzers = { ollivier: createOllivierAnalyzer(createPythonOllivierAdapter()), flow: createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter()) };
  for (const [i, f] of examples.entries()) {
    const file = `artifacts/${f.id}.json`;
    const old = write ? null : await readJson(file);
    const evidence = write ? await computeEvidence(f, analyzers) : { ollivier: old.evidence.ollivier, flow: old.evidence.flow };
    for (const name of ["ollivier", "flow"]) assert.equal(evidence[name] === null, f.input[name] === null || f.missing.includes(name), `${f.id}: ${name} availability`);
    const artifact = buildGeometricSignature(f.pack, f.input, evidence);
    const observed = measurementSummary(f.id, artifact);
    if (observed.graph === null) {
      // Missing receipts still retain the explicitly prepared scoped population.
      const nodeIds = new Set(artifact.population.nodeIds), edgeIds = new Set(artifact.population.edgeIds);
      observed.graph = { nodes: f.pack.files["model/nodes.json"].filter(n => nodeIds.has(n.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(n => ({ id: n.id })),
        edges: f.pack.files["model/edges.json"].filter(e => edgeIds.has(e.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(e => ({ id: e.id, source: e.source, target: e.target })) };
    }
    assert.deepEqual(observed, measurements.cases[i], `${f.id}: independent measurements`);
    assert.deepEqual(referenceSummary(f.id, artifact), reference.cases[i], `${f.id}: independent descriptors`);
    outputs.push([file, encoded(artifact)]);
    runs.push({ id: f.id, file, summary: artifact.summary, features: artifact.features.map(({ id, state, coverage }) => ({ id, state, coverage })),
      termination: artifact.evidence.flow?.termination.reason ?? null, valueHash: artifact.valueHash, artifactHash: artifact.artifactHash });
  }
  verifyProperties(reference);
  const body = { schemaVersion: "1", suiteId: "geometric-signature-v1", status: "bounded-computational-agreement",
    referenceHash: geometricHash("reference", reference), properties: reference.properties, runs };
  const suite = { ...body, artifactHash: geometricHash("suite", body) }; outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, file);
  }
  if (report) console.table(runs.map(r => ({ case: r.id, status: r.summary.status, observed: `${r.summary.coverage.numerator}/3`,
    Forman: r.features[0].state, Ollivier: r.features[1].state, flow: `${r.features[2].state} (${r.features[2].coverage.numerator}/${r.features[2].coverage.denominator})`, termination: r.termination })));
  console.log(`Geometric signature suite ${write ? "written" : "verified"}: 25 cases, 781 interval profiles, 820 threshold traces, 40 adjudications.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/geometric-signatures/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch(e => { console.error(e); process.exitCode = 1; });
}
