import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readdir, readFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { createOllivierAnalyzer, verifyOllivierArtifact } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { createStructuralFlowAnalyzer, verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { runStructuralResponseProbes } from "@onto2d/structural-geometry/responses";
import { SCOPE_POLICY, digest, enumerateScopes, graphCensus, preflightProviders, scopePack } from "./scopes.mjs";
import { TASK_PROFILE, availability, mapNeuronLabels, observation } from "./task-profile.mjs";

const here = new URL("./", import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, here), "utf8"));
const sha256 = data => createHash("sha256").update(data).digest("hex");
const implementationFiles = ["build.mjs", "prepare.py", "dream4.py", "randi.py", "witvliet.py", "scopes.mjs", "task-profile.mjs", "sources.py"];
const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(item => item === value).length]));

async function regularFile(url) {
  const info = await lstat(url);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Expected a regular local artifact.");
}

export async function atomicText(name, encoded, base = here) {
  if (!["census.json", "cache/prepared/applicability.json"].includes(name)) throw new Error("Unknown prepared artifact destination.");
  const target = new URL(name, base), temporary = new URL(`${name}.${randomUUID()}.tmp`, base);
  let created = false;
  let handle;
  const directories = [base, ...(name.startsWith("cache/") ? [new URL("cache/", base), new URL("cache/prepared/", base)] : [])];
  for (const url of directories) {
    // lstat with a trailing slash follows a directory symlink on macOS.
    const info = await lstat(resolve(fileURLToPath(url)));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Prepared directory must be a real directory.");
  }
  try {
    const info = await lstat(target).catch(error => { if (error.code !== "ENOENT") throw error; });
    if (info?.isSymbolicLink()) throw new Error("Prepared target must not be a symlink.");
    handle = await open(temporary, "wx");
    created = true;
    await handle.writeFile(encoded);
    await handle.close(); handle = null;
    await rename(temporary, target);
  } finally {
    if (handle) await handle.close();
    if (created) await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}

function runPreparation() {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-B", "prepare.py"], { cwd: fileURLToPath(here), stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Native preparation failed: ${code}`)));
  });
}

async function implementationBinding() {
  const files = [...implementationFiles, "../../../package-lock.json"];
  async function collect(prefix) {
    for (const entry of await readdir(new URL(prefix, here), { withFileTypes: true })) {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await collect(`${path}/`);
      else if (entry.isFile() && /\.(?:js|mjs|json|py)$/.test(entry.name)) files.push(path);
    }
  }
  for (const name of ["kernel", "engine", "model-pack", "scientific-adapter", "structural-geometry"]) await collect(`../../../packages/${name}/src/`);
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha256(await readFile(new URL(file, here)))])));
}

function dreamAvailability(unit) {
  const rows = [];
  for (const contrast of ["knockouts", "knockdowns"]) {
    const table = unit.tables[contrast];
    for (const intervention of table.interventions) for (const [column, gene] of table.columns.entries()) {
      const direct = gene === intervention.gene, value = table.values[intervention.rowIndex][column];
      rows.push(observation({ domain: `${unit.id}/${contrast}`, quantity: "native-expression", unit: "source-expression-scale",
        subject: `${intervention.gene}/${gene}`, state: direct ? "not-applicable" : value === 0 ? "observed-zero" : "observed",
        value: direct ? null : value, reason: direct ? "directly-intervened-gene" : null }));
    }
  }
  return { rows, summary: availability(rows) };
}

function summarizeScopes(scopes) {
  const providers = Object.keys(scopes[0].providers);
  return { candidateCount: scopes.length,
    providers: Object.fromEntries(providers.map(key => [key, counts(scopes.map(s => `${s.providers[key].state}${s.providers[key].reason ? `:${s.providers[key].reason}` : ""}`))])),
    commonPrepared: scopes.filter(s => s.providers.commonGeometry.state === "prepared").length };
}

function compactScope(scope, parent, providers) {
  const edgeIndexes = new Map(parent.edges.map((e, index) => [JSON.stringify(e), index]));
  return { policyId: scope.policyId, parentGraphHash: scope.parentGraphHash, graphHash: scope.graphHash,
    kind: scope.kind, root: scope.root, nodeIds: scope.graph.nodes, excludedNodeIds: scope.excludedNodes,
    edgeIndexes: scope.graph.edges.map(e => edgeIndexes.get(JSON.stringify(e))),
    omittedEdgeIndexes: scope.omittedEdges.map(e => edgeIndexes.get(JSON.stringify(e))),
    boundaryEdgeIndexes: scope.boundaryEdges.map(e => edgeIndexes.get(JSON.stringify(e))), providers };
}

export async function build({ verify = false } = {}) {
  const implementation = await implementationBinding();
  await runPreparation();
  const nativePath = new URL("cache/prepared/native.json", here);
  await regularFile(nativePath);
  const nativeBytes = await readFile(nativePath), native = JSON.parse(nativeBytes);
  const lockBytes = await readFile(new URL("source-lock.json", here)), lock = JSON.parse(lockBytes);
  if (native.format !== "onto2d-biological-native-preparation-v1" || native.sourceLockSha256 !== sha256(lockBytes)) throw new Error("Native source binding differs.");
  const sourceFiles = dataset => lock.files.filter(file => file.dataset === dataset).map(file => ({ path: file.file, hash: `sha256:${file.sha256}` }));
  const local = { format: "onto2d-biological-applicability-v1", nativeSha256: sha256(nativeBytes),
    scopePolicy: SCOPE_POLICY, taskProfile: TASK_PROFILE, dream4: [], witvliet: [], mappings: [] };
  const report = { format: local.format, status: "source-applicability-only-not-biological-evaluation",
    sourceLockSha256: sha256(lockBytes), sourceFileCount: lock.files.length,
    sourceBytes: lock.files.reduce((sum, file) => sum + file.byteLength, 0),
    implementation, nativeSha256: local.nativeSha256,
    scopePolicy: SCOPE_POLICY, taskProfile: TASK_PROFILE,
    dream4: { census: native.dream4.census, units: [] },
    witvliet: { census: native.witvliet.census, units: [] }, randi: { census: native.randi.census, mappingByAnatomicalUnit: [] } };
  const ollivier = createOllivierAnalyzer(createPythonOllivierAdapter(), { maxCacheEntries: 0 });
  const flow = createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter());
  for (const unit of native.dream4.units) {
    const scope = enumerateScopes(unit)[0], files = sourceFiles("dream4-size10");
    const providers = preflightProviders(scope, files, unit.id), { pack, mapping } = scopePack(scope, files, unit.id);
    const forman = analyzeStructuralGeometry(pack), observed = dreamAvailability(unit);
    const artifacts = { forman }, diagnostic = {};
    if (providers.commonGeometry.state === "prepared") {
      const input = { edgeIds: pack.files["model/edges.json"].map(e => e.id), idleness: "half" };
      try {
        artifacts.ollivier = await ollivier.analyze(pack, input);
        verifyOllivierArtifact(artifacts.ollivier, pack, input);
        diagnostic.ollivierArtifactHash = artifacts.ollivier.artifactHash;
        artifacts.flow = await flow.analyze(pack, SCOPE_POLICY.numericalDiagnostic);
        verifyStructuralFlowArtifact(artifacts.flow, pack, SCOPE_POLICY.numericalDiagnostic);
        diagnostic.flowArtifactHash = artifacts.flow.artifactHash;
        diagnostic.flowTermination = artifacts.flow.termination;
        diagnostic.observedFlowFrames = artifacts.flow.states.length;
        diagnostic.requestedFlowFrames = SCOPE_POLICY.numericalDiagnostic.maxIterations + 1;
        providers.commonGeometry.execution = "verified";
        providers.commonGeometry.stoppingEvent = artifacts.flow.termination;
      } catch (error) {
        if (!error.code?.endsWith("LIMIT_EXCEEDED")) throw error;
        providers.commonGeometry.execution = "budget-failure";
        diagnostic.numericalFailure = { state: "budget-failure", reason: error.code };
      }
    }
    try {
      artifacts.graphProbes = runStructuralResponseProbes(pack, { regimeId: "topology-only-v1" });
      diagnostic.graphProbes = { state: "executed", artifactHash: artifacts.graphProbes.artifactHash, summary: artifacts.graphProbes.summary };
    } catch (error) {
      if (!error.code?.endsWith("LIMIT_EXCEEDED")) throw error;
      diagnostic.graphProbes = { state: "budget-failure", reason: error.code };
    }
    const summary = { id: unit.id, splitGroup: unit.splitGroup, graph: graphCensus(scope.graph), providers,
      expressionAvailability: observed.summary, diagnostic };
    local.dream4.push({ ...summary, scope, mapping, pack, artifacts, expressionObservations: observed.rows });
    report.dream4.units.push(summary);
    console.log(`DREAM4 applicability checked: ${unit.id}.`);
  }
  for (const unit of native.witvliet.units) {
    const selected = enumerateScopes(unit.projection, { neighborhoods: true });
    const parent = selected[0].graph, files = sourceFiles("celegans-witvliet-2021");
    // All anatomical graphs remain separate. No functional label enters scope selection.
    const cache = new Map(), scopes = selected.map(scope => {
      if (!cache.has(scope.graphHash)) cache.set(scope.graphHash, preflightProviders(scope, files, unit.id));
      return compactScope(scope, parent, cache.get(scope.graphHash));
    });
    const { pack } = scopePack(selected[0], files, unit.id);
    const forman = analyzeStructuralGeometry(pack);
    const summary = { id: unit.id, stage: unit.stage, graph: graphCensus(parent),
      fullParentProviders: scopes[0].providers, neighborhoodScopes: summarizeScopes(scopes.slice(1)),
      parentFormanArtifactHash: forman.artifactHash };
    local.witvliet.push({ ...summary, parent, scopes, parentForman: forman });
    report.witvliet.units.push(summary);
    const mappings = native.randi.recordings.map(record => {
      const columns = record.labels.filter(label => label.column_index !== null);
      if (columns.length !== record.traces.columns || columns.some((label, index) => label.column_index !== index)) throw new Error("Native trace label index mismatch.");
      const labels = mapNeuronLabels(columns.map(label => label.raw_label), unit.projection.nodes);
      const stimulations = record.stimulations.map(stim => ({ trialIndex: stim.trial_index,
        nativeNeuronIndex: stim.native_neuron_index, state: stim.column_index === null ? "native-negative-sentinel" : labels[stim.column_index].state }));
      return { recordingId: record.recording_id, animalId: null, labels, stimulations };
    });
    local.mappings.push({ anatomicalUnitId: unit.id, basis: "exact-label-candidates-only", recordings: mappings });
    report.randi.mappingByAnatomicalUnit.push({ anatomicalUnitId: unit.id,
      traceLabelStates: counts(mappings.flatMap(record => record.labels.map(label => label.state))),
      stimulationStates: counts(mappings.flatMap(record => record.stimulations.map(stim => stim.state))),
      animalIdentity: "unverified", responseTarget: "not-extracted" });
    console.log(`Anatomical applicability checked: ${unit.id}, ${scopes.length - 1} complete neighborhood candidates.`);
  }
  if (JSON.stringify(implementation) !== JSON.stringify(await implementationBinding()) ||
      report.sourceLockSha256 !== sha256(await readFile(new URL("source-lock.json", here)))) throw new Error("Source lock or implementation changed during preparation; rerun with stable inputs.");
  const localEncoded = `${JSON.stringify(local)}\n`;
  report.localApplicabilitySha256 = sha256(localEncoded);
  const sealed = { ...report, reportSha256: digest(report) }, encoded = `${JSON.stringify(sealed, null, 2)}\n`;
  if (verify) {
    if (await readFile(new URL("census.json", here), "utf8") !== encoded) throw new Error("Biological census replay differs.");
  }
  // A failed replay must not replace the accepted applicability artifact.
  await atomicText("cache/prepared/applicability.json", localEncoded);
  if (!verify) await atomicText("census.json", encoded);
  console.log(`Biological census ${verify ? "verified" : "written"}; sources and computational applicability only.`);
  return sealed;
}

export async function verifyReport() {
  const { reportSha256, ...report } = await json("census.json");
  if (digest(report) !== reportSha256 || report.sourceLockSha256 !== sha256(await readFile(new URL("source-lock.json", here))) ||
      JSON.stringify(report.implementation) !== JSON.stringify(await implementationBinding()) ||
      JSON.stringify(report.scopePolicy) !== JSON.stringify(SCOPE_POLICY) || JSON.stringify(report.taskProfile) !== JSON.stringify(TASK_PROFILE)) throw new Error("Biological census integrity or implementation binding differs; rerun the explicit source preparation.");
  if (report.dream4.units.length !== 5 || report.witvliet.units.length !== 8 || report.randi.census.recordings !== 113) throw new Error("Incomplete selected source population.");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--check"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/datasets/build.mjs --write|--verify|--check"); process.exitCode = 1;
  } else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] === "--verify" })).catch(error => { console.error(error); process.exitCode = 1; });
}
