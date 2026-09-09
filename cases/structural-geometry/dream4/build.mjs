import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { createOllivierAnalyzer } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { createStructuralFlowAnalyzer } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { check, sha256 } from "../protocol/check.mjs";
import { verifyAuditReport } from "../protocol/audit.mjs";
import { enumerateScopes, scopePack } from "../datasets/scopes.mjs";
import { collectPairGeometry, FLOW_INPUT, PROFILE_ID } from "./geometry.mjs";
import { prepareContrast, evaluateContrast, FEATURE_NAMES } from "./evaluation.mjs";
import { validateResults } from "./report.mjs";
import { verifyImplementationBinding, verifyCompatibleReplay } from "../runtime-compatibility.mjs";

const here = new URL("./", import.meta.url);
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const json = async path => JSON.parse(await readFile(new URL(path, here), "utf8"));
const implementationFiles = ["build.mjs", "geometry.mjs", "evaluation.mjs", "report.mjs", "reference.py",
  "geometry.test.mjs", "evaluation.test.mjs", "report.test.mjs", "population.test.mjs"];
async function binding() {
  return Object.fromEntries(await Promise.all(implementationFiles.map(async path => [path, sha256(await readFile(new URL(path, here)))])));
}
async function readBound(path, expected, maximum) {
  const url = new URL(path, here), info = await lstat(url);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw new Error("Expected a bounded regular source artifact.");
  const bytes = await readFile(url);
  if (sha256(bytes) !== expected) throw new Error(`Prepared source binding differs: ${path}`);
  return JSON.parse(bytes);
}
async function writeArtifact(path, value) {
  if (!["results.json", "costs.json", "cache/details.json"].includes(path)) throw new Error("Unknown D4 output.");
  if (path.startsWith("cache/")) await mkdir(new URL("cache/", here), { recursive: true });
  for (const directory of [new URL(".", here), ...(path.startsWith("cache/") ? [new URL("cache", here)] : [])]) {
    const info = await lstat(fileURLToPath(directory).replace(/\/$/, ""));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("D4 output directory must be real.");
  }
  const target = new URL(path, here), temporary = new URL(`${path}.${randomUUID()}.tmp`, here);
  const existing = await lstat(target).catch(error => { if (error.code !== "ENOENT") throw error; });
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error("D4 output must be a regular file.");
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(encode(value)); await handle.sync(); await handle.close(); await rename(temporary, target);
  } finally { await handle.close(); await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}
async function independent(details) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-B", fileURLToPath(new URL("reference.py", here)), "--study"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Independent D4 reference timed out.")); }, 300000);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.stdin.on("error", error => { if (error.code !== "EPIPE") reject(error); });
    child.stdout.on("data", bytes => { stdout += bytes; if (stdout.length > 1024 * 1024) child.kill(); });
    child.stderr.on("data", bytes => { stderr = (stderr + bytes).slice(-10000); });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Independent D4 reference failed: ${stderr}`));
      else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } }
    });
    child.stdin.end(JSON.stringify(details));
  });
}

export async function verifyReport() {
  const protocol = await check(); await verifyAuditReport();
  const report = await json("results.json"), census = await json("../datasets/census.json");
  assert.deepEqual(Object.keys(report).sort(), ["format", "protocolId", "protocolLockSha256", "censusSha256", "nativeSha256", "applicabilitySha256",
    "implementation", "featureNames", "geometryProfileId", "geometry", "results", "independent", "localDetailsSha256", "reportSha256"].sort());
  const { reportSha256, ...body } = report;
  assert.equal(reportSha256, sha256(JSON.stringify(body)));
  assert.equal(report.format, "onto2d-dream4-geometric-rank-pilot-v1");
  assert.equal(report.protocolId, protocol.id);
  assert.equal(report.protocolLockSha256, sha256(await readFile(new URL("../protocol/frozen.json", here))));
  assert.equal(report.censusSha256, protocol.sources.censusSha256);
  assert.equal(report.nativeSha256, census.nativeSha256);
  assert.equal(report.applicabilitySha256, census.localApplicabilitySha256);
  await verifyImplementationBinding(new URL("results.json", here), report, await binding());
  assert.deepEqual(report.featureNames, FEATURE_NAMES);
  assert.equal(report.geometryProfileId, PROFILE_ID);
  assert.match(report.localDetailsSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(report.geometry.map(unit => unit.id), protocol.dream4.unitIds);
  for (const [i, unit] of report.geometry.entries()) {
    const expected = census.dream4.units[i];
    assert.deepEqual(Object.keys(unit).sort(), ["id", "nodeCount", "edgeCount", "pairCount", "evidence", "termination", "featuresSha256"].sort());
    assert.equal(unit.nodeCount, expected.graph.nodeCount); assert.equal(unit.edgeCount, expected.graph.edgeCount); assert.equal(unit.pairCount, 90);
    assert.deepEqual(unit.termination, expected.diagnostic.flowTermination);
    assert.deepEqual(Object.keys(unit.evidence).sort(), ["flow", "forman", "ollivier"]);
    assert.equal(unit.evidence.ollivier, expected.diagnostic.ollivierArtifactHash);
    assert.equal(unit.evidence.flow, expected.diagnostic.flowArtifactHash);
    assert.match(unit.evidence.forman, /^sha256:[a-f0-9]{64}$/); assert.match(unit.featuresSha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(report.independent, { status: "verified", method: "fraction-path-enumeration-and-joint-intercept-pivoted-gauss-jordan",
    descriptorPairs: 450, distinctReferenceFits: 660, predictionsChecked: 113400, predictionTolerance: 2e-10,
    scoreTies: "exact-stored-binary64-predictions-no-tolerance" });
  validateResults(report.results, protocol);
  const costs = await json("costs.json");
  assert.equal(costs.format, "onto2d-dream4-run-costs-v1"); assert.equal(costs.reportSha256, report.reportSha256);
  for (const key of ["preprocessingMs", "geometryMs", "targetPreparationMs", "independentVerificationMs", "totalMs", "cumulativeNodePeakRssBytes"]) {
    assert.ok(Number.isFinite(costs[key]) && costs[key] >= 0, `Invalid observed cost: ${key}`);
  }
  assert.deepEqual(costs.geometryByNetwork.map(row => row.id), protocol.dream4.unitIds);
  for (const contrast of ["knockouts", "knockdowns"]) {
    const measured = costs.evaluation[contrast];
    assert.equal(measured.fittingCalls, 630); assert.equal(measured.inferenceCalls, 630);
    assert.deepEqual(Object.keys(measured.byAblation), protocol.ablations.ordered);
    for (const groups of Object.values(measured.byAblation)) {
      assert.deepEqual(groups.map(row => row.heldOut), protocol.dream4.unitIds);
      for (const row of groups) {
        assert.equal(row.fittingCalls, 21); assert.equal(row.inferenceCalls, 21);
        for (const key of ["fittingMs", "inferenceMs", "fittingSampledRssBytes", "inferenceSampledRssBytes"]) assert.ok(Number.isFinite(row[key]) && row[key] >= 0);
      }
    }
  }
  return report;
}

export async function build({ verify = false } = {}) {
  const start = performance.now(), implementation = await binding(), protocol = await check();
  await verifyAuditReport();
  const census = await json("../datasets/census.json"), lock = await json("../datasets/source-lock.json");
  for (const path of ["../datasets/cache", "../datasets/cache/prepared"]) {
    const info = await lstat(fileURLToPath(new URL(path, here)));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Prepared source directories must be real.");
  }
  const native = await readBound("../datasets/cache/prepared/native.json", census.nativeSha256, 16000000);
  const applicability = await readBound("../datasets/cache/prepared/applicability.json", census.localApplicabilitySha256, 40000000);
  const costs = { format: "onto2d-dream4-run-costs-v1", recordedAt: new Date().toISOString(), runtime: process.version,
    platform: process.platform, architecture: process.arch,
    preprocessingMs: performance.now() - start, geometryMs: 0, geometryByNetwork: [], evaluation: {},
    scope: "D4 loading/hash checks of prepared D2 data, fresh geometry and verification, feature extraction, nested fitting and prediction; excludes raw D1 acquisition/D2 adaptation",
    resources: "Node cumulative process peak and phase-end RSS samples; solver subprocess peaks are not measured; timings are observational and excluded from semantic identity" };
  const geometry = [], sourceFiles = lock.files.filter(file => file.dataset === "dream4-size10").map(file => ({ path: file.file, hash: `sha256:${file.sha256}` }));
  for (const unit of [...native.dream4.units].sort((a, b) => a.id < b.id ? -1 : 1)) {
    const begin = performance.now(), scope = enumerateScopes(unit)[0], { pack, mapping } = scopePack(scope, sourceFiles, unit.id);
    const cached = applicability.dream4.find(entry => entry.id === unit.id);
    assert.deepEqual(cached.scope, scope); assert.deepEqual(cached.pack, pack); assert.deepEqual(cached.mapping, mapping);
    const artifacts = { forman: analyzeStructuralGeometry(pack),
      ollivier: await createOllivierAnalyzer(createPythonOllivierAdapter()).analyze(pack, { edgeIds: pack.files["model/edges.json"].map(e => e.id), idleness: "half" }),
      flow: await createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter()).analyze(pack, FLOW_INPUT) };
    for (const name of ["forman", "ollivier", "flow"]) assert.deepEqual(artifacts[name], cached.artifacts[name], "Fresh geometry differs from accepted D2 evidence.");
    const features = collectPairGeometry({ graph: scope.graph, pack, mapping, artifacts });
    geometry.push({ id: unit.id, status: "complete", graph: scope.graph, fields: features.fields, termination: features.termination, geometry: features });
    const elapsed = performance.now() - begin;
    costs.geometryMs += elapsed;
    costs.geometryByNetwork.push({ id: unit.id, elapsedMs: elapsed, sampledRssBytes: process.memoryUsage().rss });
    console.log(`D4 geometry verified: ${unit.id}, ${features.pairs.length} pairs.`);
  }
  // Finalize both complete target/geometry populations before any model fitting.
  const populationStart = performance.now();
  const populations = ["knockouts", "knockdowns"].map(contrast => prepareContrast(native.dream4.units, geometry, contrast));
  costs.targetPreparationMs = performance.now() - populationStart;
  const results = [], traces = {};
  for (const population of populations) {
    const contrast = population.population.contrast, timing = {};
    const result = evaluateContrast(population, timing);
    costs.evaluation[contrast] = timing;
    if (result.report.status !== "complete") throw new Error(`D4 ${contrast} primary unavailable: ${result.report.reason}; ${JSON.stringify(result.report.exclusions)}; ${result.report.diagnostic ?? ""}`);
    results.push(result.report); traces[contrast] = result.trace;
    console.log(`D4 ${contrast}: all six ablations and five outer folds calculated; awaiting independent verification.`);
  }
  const details = { format: "onto2d-dream4-local-replay-v1", units: native.dream4.units, geometry, traces };
  const referenceStart = performance.now(), reference = await independent(details);
  costs.independentVerificationMs = performance.now() - referenceStart;
  validateResults(results, protocol);
  const body = { format: "onto2d-dream4-geometric-rank-pilot-v1", protocolId: protocol.id,
    protocolLockSha256: sha256(await readFile(new URL("../protocol/frozen.json", here))),
    censusSha256: protocol.sources.censusSha256, nativeSha256: census.nativeSha256, applicabilitySha256: census.localApplicabilitySha256,
    implementation, featureNames: FEATURE_NAMES, geometryProfileId: PROFILE_ID,
    geometry: geometry.map(unit => ({ id: unit.id, nodeCount: unit.graph.nodes.length, edgeCount: unit.graph.edges.length,
      pairCount: unit.geometry.pairs.length, evidence: unit.geometry.evidence, termination: unit.termination,
      featuresSha256: sha256(JSON.stringify(unit.geometry)) })), results, independent: reference,
    localDetailsSha256: sha256(encode(details)) };
  const report = { ...body, reportSha256: sha256(JSON.stringify(body)) };
  assert.deepEqual(await binding(), implementation, "D4 implementation changed during the run."); await check();
  if (verify) await verifyCompatibleReplay(new URL("results.json", here), report);
  costs.totalMs = performance.now() - start;
  costs.cumulativeNodePeakRssBytes = process.resourceUsage().maxRSS * 1024;
  costs.reportSha256 = report.reportSha256;
  await writeArtifact("cache/details.json", details);
  if (!verify) { await writeArtifact("results.json", report); await writeArtifact("costs.json", costs); }
  console.log(`D4 ${verify ? "replayed" : "written"}: independent geometry and nested-model controls verified.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--check"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/dream4/build.mjs --write|--verify|--check"); process.exitCode = 1;
  } else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] === "--verify" }))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
