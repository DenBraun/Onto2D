import { verifyImplementationBinding, verifyCompatibleReplay, verifyPythonCosts } from "../runtime-compatibility.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { check, sha256 } from "../protocol/check.mjs";
import { verifyAuditReport } from "../protocol/audit.mjs";
import { verifyReport as verifyDreamReport } from "../dream4/build.mjs";
import { FEATURE_NAMES } from "../dream4/evaluation.mjs";
import { STOP_REASONS } from "../dream4/geometry.mjs";
import { prepare } from "./prepare.mjs";
import { evaluatePrepared } from "./evaluation.mjs";
import { summarizePopulation, validatePopulation, validateStudy, closed } from "./report.mjs";
import { HERE, encode, readJson, writeJson, python } from "./io.mjs";

const files = ["build.mjs", "io.mjs", "prepare.mjs", "anatomy.mjs", "intake.mjs", "extract.py", "reference.py", "evaluation.mjs", "report.mjs",
  "intake.test.mjs", "extract.test.mjs", "test_extract.py", "reference.test.mjs", "evaluation.test.mjs", "report.test.mjs"];
async function binding() {
  return Object.fromEntries(await Promise.all(files.map(async path => [path, sha256(await readFile(new URL(path, HERE)))])));
}
const countValues = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(other => other === value).length]));

export async function validateReport(report) {
  const protocol = await check(), audit = await verifyAuditReport(), dream = await verifyDreamReport();
  closed(report, ["format", "protocolId", "protocolLockSha256", "censusSha256", "nativeSha256", "applicabilitySha256",
    "dependencyReportSha256", "implementation", "anatomyId", "sourceArchiveSha256", "featureNames", "intake", "windows",
    "population", "geometry", "study", "independent", "localDetailsSha256", "reportSha256"]);
  const { reportSha256, ...body } = report;
  assert.equal(reportSha256, sha256(JSON.stringify(body)));
  assert.equal(report.format, "onto2d-celegans-functional-rank-study-v1");
  assert.equal(report.protocolId, protocol.id); assert.equal(report.anatomyId, protocol.celegans.primaryAnatomy);
  assert.equal(report.protocolLockSha256, sha256(await readFile(new URL("../protocol/frozen.json", HERE))));
  assert.equal(report.censusSha256, protocol.sources.censusSha256);
  assert.equal(report.nativeSha256, audit.nativeSha256); assert.equal(report.applicabilitySha256, audit.applicabilitySha256);
  assert.equal(report.dependencyReportSha256, dream.reportSha256);
  await verifyImplementationBinding(new URL("results.json", HERE), report, await binding()); assert.deepEqual(report.featureNames, FEATURE_NAMES);
  const source = (await readJson("../datasets/source-lock.json")).files.find(row => row.dataset === "celegans-randi-2023");
  assert.equal(report.sourceArchiveSha256, source.sha256); assert.match(report.localDetailsSha256, /^[0-9a-f]{64}$/);
  const intake = report.intake;
  closed(intake, ["recordings", "nativeEvents", "eligibleEvents", "eventExclusions", "receiverRows", "receiverStates", "receiverReasons",
    "requestedWindows", "requestedSamples", "unboundLabelSlots"]);
  assert.equal(intake.recordings, 113); assert.equal(intake.nativeEvents, audit.celegans.nativeStimulusRows);
  assert.equal(intake.eligibleEvents, audit.celegans.completeUncontaminatedWindows);
  assert.deepEqual(intake.eventExclusions, audit.celegans.exclusionCounts); assert.equal(intake.unboundLabelSlots, 42);
  const sum = ledger => { Object.values(ledger).forEach(value => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= 100000)); return Object.values(ledger).reduce((a, b) => a + b, 0); };
  assert.equal(sum(intake.receiverStates), intake.receiverRows);
  assert.equal(sum(intake.receiverReasons), intake.receiverRows - intake.requestedWindows);
  assert.equal(intake.receiverStates["window-requested"], intake.requestedWindows);
  assert.equal(intake.requestedSamples, intake.requestedWindows * 120);
  assert.equal(intake.receiverStates.unobserved, intake.receiverReasons["no-accepted-receiver-column"]);
  assert.equal(intake.receiverReasons["directly-stimulated-receiver"], intake.eligibleEvents);
  const census = await readJson("../datasets/census.json");
  assert.deepEqual(report.windows, { verifiedMembers: census.randi.census.regular_members, traceRows: census.randi.census.time_rows,
    sourceNumericValues: census.randi.census.trace_values, requestedWindows: intake.requestedWindows, requestedSamples: intake.requestedSamples });
  const groups = validatePopulation(report.population, intake, audit);
  const preparedRoots = audit.celegans.roots.filter(root => root.scopeEligible);
  assert.deepEqual(report.geometry.map(row => row.source), preparedRoots.map(root => root.source));
  for (const [i, row] of report.geometry.entries()) {
    closed(row, ["source", "status", "reason", "scopeHash", "nodeCount", "edgeCount", "pairCount", "evidence", "termination", "stateCount", "featuresSha256"]);
    assert.equal(row.scopeHash, preparedRoots[i].graphHash); assert.equal(row.nodeCount, preparedRoots[i].nodeCount);
    assert.ok(Number.isSafeInteger(row.edgeCount) && row.edgeCount > 0 && row.edgeCount <= 32);
    if (row.status === "complete") {
      assert.equal(row.reason, null); assert.equal(row.pairCount, row.nodeCount * (row.nodeCount - 1));
      assert.match(row.featuresSha256, /^[0-9a-f]{64}$/);
      closed(row.evidence, ["forman", "ollivier", "flow"]);
      Object.values(row.evidence).forEach(value => assert.match(value, /^sha256:[0-9a-f]{64}$/));
      assert.ok(STOP_REASONS.includes(row.termination.reason)); assert.ok(Number.isInteger(row.termination.iteration) && row.termination.iteration >= 0 && row.termination.iteration <= 4);
      assert.equal(row.stateCount, row.termination.iteration + 1);
      if (row.termination.reason === "iteration-limit") assert.equal(row.termination.iteration, 4);
    } else {
      assert.equal(row.status, "unavailable"); assert.ok(typeof row.reason === "string" && row.reason.endsWith("LIMIT_EXCEEDED"));
      for (const key of ["pairCount", "evidence", "termination", "stateCount", "featuresSha256"]) assert.equal(row[key], null);
    }
  }
  assert.equal(report.geometry.some(row => row.status !== "complete"), report.study.reason === "required-geometry-computation-failed");
  validateStudy(report.study, groups);
  const g = groups.length, n = report.population.coverage.eligibleTargetRows, evaluated = report.study.status === "complete";
  assert.deepEqual(report.independent, { status: "verified", method: "independent-native-window-selection-fraction-means-bellman-ford-joint-ridge",
    nativeEventsChecked: intake.nativeEvents, samplesChecked: intake.requestedSamples,
    descriptorPairs: report.geometry.reduce((sum, row) => sum + (row.pairCount ?? 0), 0), eligibleTargets: n,
    distinctReferenceFits: evaluated ? g * (g - 1) / 2 * 30 + g * 6 : 0,
    predictionsChecked: evaluated ? n * 6 * (5 * (g - 1) + 1) : 0,
    numericTolerance: 2e-10, rankTies: "exact-binary64-no-tolerance" });
  return report;
}

export async function verifyReport() {
  const report = await validateReport(await readJson("results.json", { maximum: 4000000 }));
  const costs = await readJson("costs.json", { maximum: 1000000 });
  assert.equal(costs.format, "onto2d-celegans-run-costs-v1"); assert.equal(costs.reportSha256, report.reportSha256);
  for (const key of ["preparationMs", "geometryMs", "responsePreparationMs", "totalMs", "cumulativeNodePeakRssBytes"]) assert.ok(Number.isFinite(costs[key]) && costs[key] >= 0);
  for (const phase of ["extraction", "independent"]) verifyPythonCosts(costs[phase]);
  assert.deepEqual(costs.geometry.map(row => row.source), report.geometry.map(row => row.source));
  costs.geometry.forEach(row => { assert.ok(Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0); assert.ok(Number.isFinite(row.sampledRssBytes) && row.sampledRssBytes >= 0); });
  if (report.study.status === "complete") {
    const g = report.population.coverage.eligibleGroups, calls = 6 * g * (5 * (g - 1) + 1);
    assert.equal(costs.evaluation.fittingCalls, calls); assert.equal(costs.evaluation.inferenceCalls, calls);
    assert.deepEqual(Object.keys(costs.evaluation.byAblation), Object.keys(report.study.ablations));
    for (const [name, rows] of Object.entries(costs.evaluation.byAblation)) {
      assert.deepEqual(rows.map(row => row.heldOut), report.study.ablations[name].groups.map(row => row.id));
      for (const row of rows) {
        assert.equal(row.fittingCalls, 5 * (g - 1) + 1); assert.equal(row.inferenceCalls, row.fittingCalls);
        for (const key of ["fittingMs", "inferenceMs", "fittingSampledRssBytes", "inferenceSampledRssBytes"]) assert.ok(Number.isFinite(row[key]) && row[key] >= 0);
      }
    }
  }
  return report;
}

export async function build({ verify = false } = {}) {
  const started = performance.now(), implementation = await binding(), dependency = await verifyDreamReport();
  const prepared = await prepare(), costs = { ...prepared.costs, format: "onto2d-celegans-run-costs-v1",
    recordedAt: new Date().toISOString(), runtime: process.version, platform: process.platform, architecture: process.arch,
    evaluation: {}, resources: "Node cumulative peak and phase-end RSS samples; separate extraction/reference Python peaks; geometry solver subprocess peaks not measured",
    scope: "D5 source binding, whole-scope geometry, one-pass archive windows, response aggregation and all nested fits/predictions; excludes D1 acquisition and D2 adaptation" };
  const result = evaluatePrepared(prepared.data, costs.evaluation);
  const details = { format: "onto2d-celegans-local-replay-v1", data: prepared.data, trace: result.trace,
    evaluationState: { status: result.report.status, reason: result.report.reason } };
  console.log(`D5 evaluation ${result.report.status}; verifying native sample selection, target aggregation, geometry and fits independently.`);
  const reference = await python("reference.py", ["--study", prepared.archivePath], details);
  costs.independent = reference.costs;
  const body = { format: "onto2d-celegans-functional-rank-study-v1", protocolId: prepared.protocol.id,
    protocolLockSha256: sha256(await readFile(new URL("../protocol/frozen.json", HERE))),
    censusSha256: prepared.protocol.sources.censusSha256, nativeSha256: prepared.census.nativeSha256,
    applicabilitySha256: prepared.census.localApplicabilitySha256, dependencyReportSha256: dependency.reportSha256,
    implementation, anatomyId: prepared.data.anatomy.id, sourceArchiveSha256: prepared.data.archive.sha256, featureNames: FEATURE_NAMES,
    intake: prepared.data.plan.summary, windows: prepared.data.extracted.summary, population: summarizePopulation(prepared.data),
    geometry: prepared.data.geometry.map(row => ({ source: row.source, status: row.status, reason: row.reason,
      scopeHash: row.scope.graphHash, nodeCount: row.scope.graph.nodes.length, edgeCount: row.scope.graph.edges.length,
      pairCount: row.geometry?.pairs.length ?? null, evidence: row.geometry?.evidence ?? null,
      termination: row.geometry?.termination ?? null, stateCount: row.artifacts?.flow.states.length ?? null,
      featuresSha256: row.geometry ? sha256(JSON.stringify(row.geometry)) : null })),
    study: result.report, independent: reference.result, localDetailsSha256: sha256(encode(details)) };
  const report = { ...body, reportSha256: sha256(JSON.stringify(body)) };
  await validateReport(report); assert.deepEqual(await binding(), implementation);
  if (verify) await verifyCompatibleReplay(new URL("results.json", HERE), report);
  costs.totalMs = performance.now() - started; costs.cumulativeNodePeakRssBytes = process.resourceUsage().maxRSS * 1024;
  costs.reportSha256 = report.reportSha256;
  await writeJson("cache/details.json", details);
  if (!verify) { await writeJson("results.json", report, { pretty: true }); await writeJson("costs.json", costs, { pretty: true }); }
  console.log(`D5 ${verify ? "replayed" : "written"}: ${report.population.coverage.eligibleGroups} source groups; stopping events ${JSON.stringify(countValues(report.geometry.map(row => row.termination?.reason ?? row.reason)))}.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--check"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/celegans/build.mjs --write|--verify|--check"); process.exitCode = 1;
  } else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] === "--verify" })).catch(error => { console.error(error); process.exitCode = 1; });
}
