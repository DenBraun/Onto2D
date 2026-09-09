import { verifyImplementationBinding, verifyCompatibleReplay, verifyPythonCosts } from "../../runtime-compatibility.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { check, sha256 } from "../../protocol/check.mjs";
import { verifyReport as verifyPrior } from "../../celegans/build.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { summarizePopulation } from "../../celegans/report.mjs";
import { closed } from "../report.mjs";
import { prepareDataset8, matchAnatomies, targetValues, evaluate, compareMatched } from "./study.mjs";
import { summarizeStudy, validateResults } from "./report.mjs";
import { HERE, encode, readJson, writeJson, python } from "./io.mjs";

const files = ["profile.json", "source-audit.json", "build.mjs", "study.mjs", "report.mjs", "io.mjs", "reference.py", "study.test.mjs", "report.test.mjs",
  "../report.mjs", "../study.mjs", "../nulls.mjs", "../io.mjs"];
const binding = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, sha256(await readFile(new URL(file, HERE)))])));

export async function validateReport(report) {
  const protocol = await check(), prior = await verifyPrior(), audit = await readJson("source-audit.json");
  closed(report, ["format", "protocolId", "protocolLockSha256", "censusSha256", "nativeSha256", "applicabilitySha256", "dependencyReportSha256",
    "implementation", "profile", "parentGraphSha256", "sourceArchiveSha256", "intake", "windows", "population", "geometry", "priorTargets",
    "overlap", "studies", "comparison", "independent", "localDetailsSha256", "reportSha256"]);
  const { reportSha256, ...body } = report; assert.equal(reportSha256, digest(body));
  assert.equal(report.format, "onto2d-celegans-anatomy-sensitivity-v1"); assert.equal(report.protocolId, protocol.id);
  assert.equal(report.protocolLockSha256, sha256(await readFile(new URL("../../protocol/frozen.json", HERE))));
  assert.equal(report.censusSha256, protocol.sources.censusSha256); assert.equal(report.nativeSha256, prior.nativeSha256);
  assert.equal(report.applicabilitySha256, prior.applicabilitySha256); assert.equal(report.dependencyReportSha256, prior.reportSha256);
  await verifyImplementationBinding(new URL("results.json", HERE), report, await binding()); assert.deepEqual(report.profile, await readJson("profile.json"));
  assert.equal(report.parentGraphSha256, audit.parentGraphSha256); assert.equal(report.sourceArchiveSha256, prior.sourceArchiveSha256);
  assert.match(report.localDetailsSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(report.windows, { ...prior.windows, requestedWindows: audit.intake.requestedWindows, requestedSamples: audit.intake.requestedSamples });
  validateResults(report, audit, prior); return report;
}

export async function verifyReport() {
  const report = await validateReport(await readJson("results.json", { maximum: 4000000 }));
  const costs = await readJson("costs.json", { maximum: 1000000 });
  assert.equal(costs.format, "onto2d-celegans-anatomy-costs-v1"); assert.equal(costs.reportSha256, report.reportSha256);
  const positive = value => assert.ok(Number.isFinite(value) && value >= 0);
  for (const key of ["preparationMs", "geometryMs", "totalMs", "cumulativeNodePeakRssBytes"]) positive(costs[key]);
  for (const phase of ["extraction", "independent"]) verifyPythonCosts(costs[phase]);
  assert.deepEqual(costs.geometry.map(row => row.source), report.geometry.map(row => row.source));
  costs.geometry.forEach(row => { positive(row.elapsedMs); positive(row.sampledRssBytes); });
  assert.deepEqual(Object.keys(costs.evaluation), report.studies.map(row => row.id));
  for (const study of report.studies) {
    const measured = costs.evaluation[study.id], g = study.groups.length, perGroup = 5 * (g - 1) + 1;
    if (study.report.status === "complete") {
      assert.equal(measured.fittingCalls, 6 * g * perGroup); assert.equal(measured.inferenceCalls, measured.fittingCalls);
      assert.deepEqual(Object.keys(measured.byAblation), Object.keys(study.report.ablations));
      for (const rows of Object.values(measured.byAblation)) {
        assert.deepEqual(rows.map(row => row.heldOut), study.groups.map(row => row.id));
        for (const row of rows) {
          assert.equal(row.fittingCalls, perGroup); assert.equal(row.inferenceCalls, perGroup);
          for (const key of ["fittingMs", "inferenceMs", "fittingSampledRssBytes", "inferenceSampledRssBytes"]) positive(row[key]);
        }
      }
    } else if (study.report.reason !== "required-model-computation-failed") assert.deepEqual(measured, {});
  }
  return report;
}

export async function build({ verify = false } = {}) {
  const start = performance.now(), implementation = await binding(), protocol = await check(), prior = await verifyPrior();
  if (verify) await verifyReport();
  const profile = await readJson("profile.json"), audit = await readJson("source-audit.json"), prepared = await prepareDataset8(prior);
  const { data } = prepared;
  assert.deepEqual(data.recordings.map(row => row.recording_id), audit.recordingIds);
  assert.equal(digest(data.anatomy.parent), audit.parentGraphSha256); assert.deepEqual(data.plan.summary, audit.intake);
  assert.equal(digest(data.plan), audit.planSha256); assert.equal(digest(targetValues(prepared.prior.matched.rows)), audit.priorTargetValuesSha256);
  assert.deepEqual(data.anatomy.scopes, audit.roots.map(({ graphHash, edgeCount, ...row }) => row));
  const overlap = matchAnatomies(prepared.prior, data), { rows: sharedRows, ...ledger } = overlap;
  const featureMap = new Map(data.matched.rows.map(row => [row.id, row.x]));
  const nativeRows = data.matched.population.rows.filter(row => row.eligible).map(row => ({ ...row, x: featureMap.get(row.id) ?? null }));
  const definitions = [{ id: "Dataset8-native", rows: nativeRows, reason: data.matched.reason },
    { id: "Dataset7-matched", rows: sharedRows[0], reason: overlap.reason },
    { id: "Dataset8-matched", rows: sharedRows[1], reason: data.matched.failures.length ? "required-geometry-computation-failed" : overlap.reason }];
  const costs = { ...prepared.costs, format: "onto2d-celegans-anatomy-costs-v1", recordedAt: new Date().toISOString(), runtime: process.version,
    platform: process.platform, architecture: process.arch, evaluation: {},
    resources: "Node cumulative peak and phase-end samples; extraction/reference Python peaks; geometry solver subprocess peaks not measured",
    scope: "D6.2 source binding, fresh Dataset8 geometry and archive windows, all native/matched nested fits, independent verification; Dataset7 geometry reused from verified D5 details" };
  const results = definitions.map(def => {
    costs.evaluation[def.id] = {}; console.log(`D6.2 ${def.id}: ${def.rows.length} targets; ${def.reason ?? "fitting all six ablations"}.`);
    return { id: def.id, ...evaluate(def.rows, def.reason, costs.evaluation[def.id]) };
  });
  const geometry = data.geometry.map(row => ({ source: row.source, status: row.status, reason: row.reason, scopeHash: row.scope.graphHash,
    nodeCount: row.scope.graph.nodes.length, edgeCount: row.scope.graph.edges.length, pairCount: row.geometry?.pairs.length ?? null,
    evidence: row.geometry?.evidence ?? null, termination: row.geometry?.termination ?? null, stateCount: row.artifacts?.flow.states.length ?? null,
    featuresSha256: row.geometry ? digest(row.geometry) : null }));
  const studies = definitions.map((def, i) => summarizeStudy(def.id, def.rows, results[i]));
  const priorData = { anatomy: prepared.prior.anatomy, responses: prepared.prior.responses, matched: prepared.prior.matched,
    geometry: prepared.prior.geometry.map(({ source, status, scope, geometry }) => ({ source, status, scope: { graph: scope.graph }, geometry })) };
  const details = { format: "onto2d-celegans-anatomy-local-replay-v1", data, prior: priorData, overlap: ledger,
    studies: results.map(({ id, report, trace }) => ({ id, state: { status: report.status, reason: report.reason }, trace })) };
  console.log("D6.2 independently checking native samples, overlap/reranking, geometry and nested models.");
  const independent = await python("reference.py", ["--study", prepared.archivePath], details, { maximum: 4000000 });
  costs.independent = independent.costs;
  const body = { format: "onto2d-celegans-anatomy-sensitivity-v1", protocolId: protocol.id,
    protocolLockSha256: sha256(await readFile(new URL("../../protocol/frozen.json", HERE))), censusSha256: protocol.sources.censusSha256,
    nativeSha256: prepared.census.nativeSha256, applicabilitySha256: prepared.census.localApplicabilitySha256, dependencyReportSha256: prior.reportSha256,
    implementation, profile, parentGraphSha256: digest(data.anatomy.parent), sourceArchiveSha256: data.archive.sha256,
    intake: data.plan.summary, windows: data.extracted.summary, population: summarizePopulation(data), geometry,
    priorTargets: targetValues(prepared.prior.matched.rows), overlap: ledger, studies,
    comparison: compareMatched(studies.slice(1).map(row => row.report)), independent: independent.result, localDetailsSha256: sha256(encode(details)) };
  const report = { ...body, reportSha256: digest(body) };
  await validateReport(report); assert.deepEqual(await binding(), implementation, "D6.2 implementation changed during the run.");
  if (verify) await verifyCompatibleReplay(new URL("results.json", HERE), report);
  costs.totalMs = performance.now() - start; costs.cumulativeNodePeakRssBytes = process.resourceUsage().maxRSS * 1024; costs.reportSha256 = report.reportSha256;
  await writeJson("cache/details.json", details);
  if (!verify) { await writeJson("results.json", report, { pretty: true }); await writeJson("costs.json", costs, { pretty: true }); }
  console.log(`D6.2 ${verify ? "replay verified" : "written"}: ${studies.map(row => `${row.id}=${row.report.status}`).join(", ")}.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--check"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/robustness/anatomy/build.mjs --write|--verify|--check"); process.exitCode = 1;
  } else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] === "--verify" })).catch(error => { console.error(error); process.exitCode = 1; });
}
