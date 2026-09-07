import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone } from "@onto2d/kernel/canonical";
import { runStructuralResponseSignature } from "@onto2d/structural-geometry/signature";
import { buildGeometricSignature } from "@onto2d/structural-geometry/geometric-signature";
import { createOllivierAnalyzer } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { createStructuralFlowAnalyzer } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { measurementSummary, referenceSummary as geometricSummary } from "../geometric-signatures/build.mjs";
import { directory, readJson, json, rawHash, checkSources } from "./generate.mjs";
import { baselines, graphFromPack, colorRefinement } from "./baselines.mjs";
import { CODEC, LIMITS, encoded, seal, eligibility, comparePair, summarize } from "./analysis.mjs";

export const NUMERICAL_FILES = ["PROTOCOL.md", "config.json", "panel.json", "sources.json", "measurements.py",
  "../geometric-signatures/measurements.py", "../flow/networkx_reference.py", "../flow/paper_reference.py", "../experiments/reference.py"];
export const REFERENCE_FILES = [...NUMERICAL_FILES, "measurements.json", "reference.py", "../geometric-signatures/reference.py", "../signatures/reference.py",
  "../responses/reference.py", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py"];
const bytes = value => json(canonicalClone(value, CODEC));
const size = value => new TextEncoder().encode(value).length;
export async function sourceHashes(files) { return Object.fromEntries(await Promise.all(files.map(async f => [f, rawHash(await readFile(new URL(f, directory)))]))); }
export async function verifyReferences(reference, numerical) {
  assert.deepEqual(numerical.sourceHashes, await sourceHashes(NUMERICAL_FILES), "Numerical reference dependencies differ.");
  assert.deepEqual(reference.sourceHashes, await sourceHashes(REFERENCE_FILES), "Descriptor reference dependencies differ.");
}
export function referenceSummary(unit) {
  const response = unit.evidence.response;
  return { id: unit.id, response: { features: response.features.map(f => Object.fromEntries(["id", "probeId", "state", "value", "coverage", "reasons"].map(k => [k, f[k]]))),
    summary: response.summary, value: response.value }, geometry: geometricSummary(unit.id, unit.evidence.geometry),
    baselines: unit.baselines, eligibility: unit.eligibility };
}
function assertRequest(unit, config) {
  assert.deepEqual(unit.responseInput, { regimeId: config.regimeId });
  assert.deepEqual(unit.geometryInput.forman, config.geometry.forman);
  assert.deepEqual(unit.geometryInput.flow, config.geometry.flow);
  assert.equal(unit.geometryInput.ollivier.idleness, config.geometry.ollivier.idleness);
}
function unitRecord(u, response, geometry, graph, values, studyHash) {
  const n = graph.n, factorial = n => n < 2 ? 1 : n * factorial(n - 1);
  const work = { responseObservations: response.work.observationEvaluations,
    responseTargets: response.evidence.responses.summary.targets.total, responseCanonicalizerCalls: response.work.canonicalizerCalls,
    transportProblems: geometry.evidence.ollivier.result.edges.length + geometry.evidence.flow.states.reduce((sum, s) => sum + s.edges.length, 0),
    flowFrames: geometry.work.trajectoryFrames, scalarSamples: geometry.work.scalarSamples, jointSamples: geometry.work.jointSamples,
    canonicalPermutations: factorial(n), triadPermutations: n * (n - 1) * (n - 2), refinementRounds: 6 };
  return seal("unit", { schemaVersion: "1", analysis: { id: "geometric-added-value-unit", version: "1" }, id: u.id, studyHash,
    source: geometry.source, evidence: { response, geometry }, baselines: values, eligibility: eligibility(response, geometry), work }, LIMITS.unitBytes);
}
export function verifyUnit(value, u, pack, config, refinement, studyHash, expectedEvidence) {
  assert.ok(size(encoded(value)) <= LIMITS.unitBytes);
  assertRequest(u, config);
  assert.ok(expectedEvidence.ollivier && expectedEvidence.flow, "Both independent expected receipts are required.");
  const response = runStructuralResponseSignature(pack, u.responseInput), geometry = buildGeometricSignature(pack, u.geometryInput, expectedEvidence);
  const g = graphFromPack(pack), expected = unitRecord(u, response, geometry, g, { ...baselines(g), refinement }, studyHash);
  assert.equal(encoded(value), encoded(expected), "Unit differs from expected source, profile, receipts, baselines or coverage.");
  return expected;
}
export async function run({ write = false, report = false, timingFile = null } = {}) {
  assert.ok(!(write && report));
  const started = performance.now(), { panel, sources } = await checkSources();
  assert.equal(panel.units.length, LIMITS.units); assert.equal(panel.pairs.length, LIMITS.pairs);
  const reference = await readJson("reference.json"), numerical = await readJson("measurements.json");
  await verifyReferences(reference, numerical);
  assert.deepEqual(reference.units.map(u => u.id), panel.units.map(u => u.id));
  assert.deepEqual(numerical.units.map(u => u.id), panel.units.map(u => u.id));
  const studyHash = `sha256:${rawHash(encoded({ protocol: panel.protocolSha256, config: panel.config, panelHash: rawHash(await readFile(new URL("panel.json", directory))) }))}`;
  const clockStart = performance.now(), graphs = panel.units.map(u => graphFromPack(sources[u.id])), refinement = colorRefinement(graphs);
  const refinementMs = performance.now() - clockStart, timings = [], artifacts = [], outputs = [], entries = [];
  const analyzers = { ollivier: createOllivierAnalyzer(createPythonOllivierAdapter(), { maxCacheEntries: 0 }), flow: createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter()) };
  let totalBytes = 0;
  for (const [i, u] of panel.units.entries()) {
    assertRequest(u, panel.config);
    const file = `artifacts/${u.id}.json`, old = write ? null : await readJson(file), pack = sources[u.id];
    let start = performance.now();
    const response = runStructuralResponseSignature(pack, u.responseInput), responseMs = performance.now() - start;
    start = performance.now();
    const expectedEvidence = write ? { ollivier: await analyzers.ollivier.analyze(pack, u.geometryInput.ollivier), flow: await analyzers.flow.analyze(pack, u.geometryInput.flow) }
      : { ollivier: old.evidence.geometry.evidence.ollivier, flow: old.evidence.geometry.evidence.flow };
    assert.ok(expectedEvidence.ollivier && expectedEvidence.flow, "Frozen study expects both receipts; missing data cannot be forged.");
    const geometry = buildGeometricSignature(pack, u.geometryInput, expectedEvidence), geometryMs = performance.now() - start;
    assert.deepEqual(measurementSummary(u.id, geometry), numerical.units[i], `${u.id}: independent source numerics`);
    start = performance.now();
    const values = { ...baselines(graphs[i]), refinement: refinement[i] }, baselineMs = performance.now() - start;
    assert.deepEqual(values.canonical, u.canonical); assert.deepEqual(values.degrees, u.degrees);
    const artifact = unitRecord(u, response, geometry, graphs[i], values, studyHash), work = artifact.work;
    assert.deepEqual(referenceSummary(artifact), reference.units[i], `${u.id}: independent descriptors/baselines/eligibility`);
    const output = bytes(artifact), unitBytes = size(output); assert.ok(unitBytes <= LIMITS.unitBytes);
    totalBytes += unitBytes; assert.ok(totalBytes <= LIMITS.totalUnitBytes, "Cumulative stored study output exceeds 128 MiB.");
    artifacts.push(artifact); outputs.push([file, output]); entries.push({ id: u.id, file, unitHash: artifact.unitHash, bytes: unitBytes, eligibility: artifact.eligibility, work });
    timings.push({ id: u.id, responseMs, geometryMs, baselineMs });
  }
  const units = new Map(artifacts.map(a => [a.id, a]));
  const pairs = panel.pairs.map(p => comparePair(p, units.get(p.left), units.get(p.right))), summary = summarize(pairs);
  assert.deepEqual(pairs, reference.pairs, "Independent pair adjudication differs."); assert.deepEqual(summary, reference.summary, "Independent outcome denominators differ.");
  const suite = seal("suite", { schemaVersion: "1", analysis: { id: "geometric-added-value", version: "1" }, studyHash,
    status: "bounded-synthetic-evaluation", sourceHashes: await sourceHashes([...REFERENCE_FILES, "reference.json", "generate.mjs", "baselines.mjs", "analysis.mjs", "build.mjs"]),
    units: entries, pairs: pairs.map(p => ({ ...p, evidence: { leftUnitHash: units.get(p.left).unitHash, rightUnitHash: units.get(p.right).unitHash } })),
    summary, work: { storedUnitBytes: totalBytes, unitCount: artifacts.length, pairComparisons: pairs.length,
      ...Object.fromEntries(Object.keys(entries[0].work).map(k => [k, entries.reduce((sum, u) => sum + u.work[k], 0)])) } }, LIMITS.suiteBytes);
  const suiteBytes = bytes(suite); assert.ok(size(suiteBytes) <= LIMITS.suiteBytes); outputs.push(["suite.json", suiteBytes]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, value] of outputs) {
    if (write) await writeFile(new URL(file, directory), value); else assert.equal(await readFile(new URL(file, directory), "utf8"), value, file);
  }
  if (timingFile) await writeFile(timingFile, json({ studyHash, mode: write ? "solver-generation-and-response-computation" : "certificate-replay-and-response-computation",
    runtime: process.version, platform: process.platform, architecture: process.arch, refinementMs, totalMs: performance.now() - started, units: timings }));
  if (report) {
    console.table([{ comparison: "A → B (primary)", ...summary.primary }, { comparison: "A+curvature → B", ...summary.staticToFlow },
      { comparison: "A → B (same degrees)", ...summary.degreeMatched }].map(({ comparison, status, totalPairs, eligiblePairs, both, gained, lost, neither, pairedGain }) =>
      ({ comparison, status, totalPairs, eligiblePairs, both, gained, lost, neither, gain: pairedGain ? `${pairedGain.numerator}/${pairedGain.denominator}` : null })));
    console.table(summary.baselines.map(({ id, eligiblePairs, distinguished, geometryGainsAlreadyDistinguished }) => ({ baseline: id, eligiblePairs, distinguished, geometryGainsAlreadyDistinguished })));
    console.log(json({ responseOnlyCoverage: summary.responseOnlyCoverage, invariance: summary.invariance, work: suite.work, inference: summary.inference }));
  }
  console.log(`Added-value study ${write ? "written" : "verified"}: 68 source units, 531 pairs, fixed common coverage and independent references.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  assert.ok(["--write", "--verify", "--report"].includes(args[0]) && (args.length === 1 || (args.length === 3 && args[1] === "--timing-file")), "Use --write|--verify|--report [--timing-file path].");
  await run({ write: args[0] === "--write", report: args[0] === "--report", timingFile: args[2] ?? null });
}
