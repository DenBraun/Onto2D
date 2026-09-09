import { verifyImplementationBinding, verifyCompatibleReplay, verifyPythonCosts } from "../../runtime-compatibility.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { check, sha256 } from "../../protocol/check.mjs";
import { verifyReport as verifyDream } from "../../dream4/build.mjs";
import { verifyReport as verifyWorm } from "../../celegans/build.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { PROFILE, FEATURE_NAMES } from "./features.mjs";
import { loadSources, prepareFeatures, targetValues, groupsOf } from "./study.mjs";
import { evaluateRows } from "./evaluation.mjs";
import { closed, summarizeStudy, validateStudy } from "./report.mjs";
import { HERE, readJson, writeJson, encode, python } from "./io.mjs";

const files = ["profile.json", "source-audit.json", "features.mjs", "study.mjs", "evaluation.mjs", "report.mjs", "build.mjs", "io.mjs", "reference.py",
  "features.test.mjs", "evaluation.test.mjs", "report.test.mjs", "../../../../packages/structural-geometry/src/rational.js"];
const binding = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, sha256(await readFile(new URL(file, HERE)))])));
const sourceScopes = scopes => scopes.map(s => ({ id: s.id, datasetId: s.datasetId, root: s.root, graphSha256: digest(s.graph),
  geometrySha256: digest(s.geometry), nodeCount: s.graph.nodes.length, edgeCount: s.graph.edges.length, pairCount: s.geometry.pairs.length }));
const sourceTargets = targets => targets.map(t => ({ id: t.id, targetCount: t.rows.length, targetValuesSha256: digest(targetValues(t.rows)),
  legacyFeaturesSha256: digest(t.rows.map(r => r.x)), groups: groupsOf(t.rows) }));

export async function validateReport(report) {
  const protocol = await check(), dream = await verifyDream(), worm = await verifyWorm(), audit = await readJson("source-audit.json");
  closed(report, ["format", "protocolId", "protocolLockSha256", "implementation", "profile", "dependencies", "sourceAuditSha256", "featureNames",
    "scopes", "studies", "independent", "localDetailsSha256", "reportSha256"]);
  const { reportSha256, ...body } = report; assert.equal(reportSha256, digest(body));
  assert.equal(report.format, "onto2d-biological-graph-capacity-study-v1"); assert.equal(report.protocolId, protocol.id);
  assert.equal(report.protocolLockSha256, sha256(await readFile(new URL("../../protocol/frozen.json", HERE))));
  await verifyImplementationBinding(new URL("results.json", HERE), report, await binding()); assert.deepEqual(report.profile, PROFILE);
  assert.deepEqual(report.dependencies, { dream4: dream.reportSha256, celegans: worm.reportSha256 });
  assert.deepEqual(audit.dependencies, report.dependencies); assert.equal(report.sourceAuditSha256, digest(audit));
  assert.equal(audit.format, "onto2d-capacity-source-audit-v1"); assert.equal(audit.comparativeScoresComputed, false);
  assert.deepEqual(report.featureNames, FEATURE_NAMES); assert.match(report.localDetailsSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(report.scopes.map(({ featuresSha256, ...row }) => row), audit.scopes);
  report.scopes.forEach(row => assert.match(row.featuresSha256, /^[a-f0-9]{64}$/));
  assert.deepEqual(report.studies.map(row => row.id), PROFILE.studies);
  const originals = [...dream.results, worm.study];
  report.studies.forEach((study, i) => {
    validateStudy(study, audit.targets[i], originals[i]);
    assert.deepEqual(audit.targets[i].groups, originals[i].ablations.B.groups.map(row => ({ id: row.id, targetCount: row.targetCount,
      interventionIds: row.interventions.map(item => item.id) })));
  });
  const pairCount = report.scopes.reduce((sum, row) => sum + row.pairCount, 0);
  assert.deepEqual(report.independent, { status: "verified", method: "independent-floyd-warshall-predecessor-paths-fraction-matrix-walks-joint-ridge",
    scopeCount: report.scopes.length, descriptorPairs: pairCount, expandedExactCoordinates: pairCount * 31,
    exactComparisonsChecked: PROFILE.studies.length * PROFILE.comparisons.length,
    fitting: audit.targets.map(t => { const g = t.groups.length; return { id: t.id, distinctReferenceFits: g * (g - 1) / 2 * 30 + g * 6,
      predictionsChecked: t.targetCount * 6 * (5 * (g - 1) + 1) }; }), numericTolerance: 2e-10, rankTies: "exact-binary64-no-tolerance" });
  return report;
}

export async function verifyReport() {
  const report = await validateReport(await readJson("results.json", { maximum: 4000000 }));
  const costs = await readJson("costs.json", { maximum: 1000000 });
  assert.equal(costs.format, "onto2d-biological-graph-capacity-costs-v1"); assert.equal(costs.reportSha256, report.reportSha256);
  const measured = value => assert.ok(Number.isFinite(value) && value >= 0);
  for (const key of ["preparationMs", "totalMs", "cumulativeNodePeakRssBytes"]) measured(costs[key]);
  verifyPythonCosts(costs.independent);
  assert.deepEqual(costs.features.map(row => row.id), report.scopes.map(row => row.id));
  costs.features.forEach(row => { measured(row.elapsedMs); measured(row.sampledRssBytes); });
  assert.deepEqual(Object.keys(costs.evaluation), PROFILE.studies);
  for (const study of report.studies) {
    const ids = study.report.ablations.B.groups.map(row => row.id), perGroup = 5 * (ids.length - 1) + 1;
    assert.deepEqual(Object.keys(costs.evaluation[study.id]), PROFILE.models);
    for (const rows of Object.values(costs.evaluation[study.id])) {
      assert.deepEqual(rows.map(row => row.heldOut), ids);
      for (const row of rows) {
        assert.equal(row.fittingCalls, perGroup); assert.equal(row.inferenceCalls, perGroup);
        for (const key of ["fittingMs", "inferenceMs", "fittingSampledRssBytes", "inferenceSampledRssBytes"]) measured(row[key]);
      }
    }
  }
  return report;
}

export async function build({ verify = false } = {}) {
  const start = performance.now(), implementation = await binding(), protocol = await check(), sources = await loadSources();
  if (verify) await verifyReport();
  const audit = await readJson("source-audit.json");
  assert.deepEqual(sources.dependencies, audit.dependencies); assert.deepEqual(sourceScopes(sources.scopes), audit.scopes);
  assert.deepEqual(sourceTargets(sources.targets), audit.targets);
  const preparationMs = performance.now() - start, prepared = prepareFeatures(sources);
  const costs = { format: "onto2d-biological-graph-capacity-costs-v1", recordedAt: new Date().toISOString(), runtime: process.version,
    platform: process.platform, architecture: process.arch, preparationMs, features: prepared.costs, evaluation: {},
    resources: "Node cumulative peak and phase-end samples; independent Python peak",
    scope: "D6.3 dependency binding, graph-only feature extraction, six-model nested refitting and independent verification. Source acquisition, fluorescence extraction and geometry solving are reused D4/D5 costs, not rerun or charged here." };
  const results = prepared.targets.map(target => {
    console.log(`D6.3 ${target.id}: ${target.rows.length} fixed targets; fitting all six declared models.`);
    const measured = {}; costs.evaluation[target.id] = measured;
    const result = evaluateRows(target.rows, measured);
    assert.deepEqual(result.report.ablations.B, target.original.ablations.B);
    assert.deepEqual(result.report.ablations["B+G"], target.original.ablations["B+F+O+flow"]);
    return result;
  });
  const details = { format: "onto2d-biological-capacity-local-replay-v1", scopes: prepared.scopes,
    studies: results.map((result, i) => ({ id: sources.targets[i].id, originalRows: sources.targets[i].rows, trace: result.trace,
      comparisons: result.report.comparisons })) };
  console.log("D6.3 independent verification: expanded graph features, immutable target joins and every nested fit/prediction.");
  const independent = await python("reference.py", ["--study"], details, { maximum: 4000000 }); costs.independent = independent.costs;
  const body = { format: "onto2d-biological-graph-capacity-study-v1", protocolId: protocol.id,
    protocolLockSha256: sha256(await readFile(new URL("../../protocol/frozen.json", HERE))), implementation, profile: PROFILE,
    dependencies: sources.dependencies, sourceAuditSha256: digest(audit), featureNames: FEATURE_NAMES,
    scopes: audit.scopes.map((row, i) => ({ ...row, featuresSha256: digest(prepared.scopes[i].features) })),
    studies: results.map((result, i) => summarizeStudy(sources.targets[i].id, result)), independent: independent.result,
    localDetailsSha256: sha256(encode(details)) };
  const report = { ...body, reportSha256: digest(body) };
  await validateReport(report); assert.deepEqual(await binding(), implementation, "Capacity implementation changed during the run.");
  if (verify) await verifyCompatibleReplay(new URL("results.json", HERE), report);
  costs.totalMs = performance.now() - start; costs.cumulativeNodePeakRssBytes = process.resourceUsage().maxRSS * 1024; costs.reportSha256 = report.reportSha256;
  await writeJson("cache/details.json", details);
  if (!verify) { await writeJson("results.json", report, { pretty: true }); await writeJson("costs.json", costs, { pretty: true }); }
  console.log(`D6.3 ${verify ? "replay verified" : "written"}: all three studies, every model and comparison retained.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--check"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/robustness/capacity/build.mjs --write|--verify|--check"); process.exitCode = 1;
  } else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] === "--verify" })).catch(error => { console.error(error); process.exitCode = 1; });
}
