import { verifyImplementationBinding, verifyCompatibleReplay, verifyPythonCosts } from "../runtime-compatibility.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { check, sha256 } from "../protocol/check.mjs";
import { verifyReport as verifyDream } from "../dream4/build.mjs";
import { verifyReport as verifyWorm } from "../celegans/build.mjs";
import { digest } from "../datasets/scopes.mjs";
import { NULL_PROFILE, labelledConstraints } from "./nulls.mjs";
import { loadSources, runReplicate, scopeId } from "./study.mjs";
import { compactReport, targetSummary, summarizeReplicate, summarizeAll, validateCompact, validateReplicate, closed } from "./report.mjs";
import { HERE, encode, readJson, writeJson, reference } from "./io.mjs";

const files = ["nulls.mjs", "study.mjs", "report.mjs", "build.mjs", "io.mjs", "reference.py",
  "nulls.test.mjs", "study.test.mjs", "report.test.mjs"];
const binding = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, sha256(await readFile(new URL(file, HERE)))])));
const localPath = index => `cache/null-${String(index).padStart(2, "0")}.json`;

export async function validateReport(report) {
  const protocol = await check(), dream = await verifyDream(), worm = await verifyWorm();
  closed(report, ["format", "protocolId", "protocolLockSha256", "dependencies", "implementation", "profile", "sourceScopes", "targets",
    "replicates", "summary", "reportSha256"]);
  const { reportSha256, ...body } = report; assert.equal(reportSha256, digest(body));
  assert.equal(report.format, "onto2d-biological-degree-null-study-v1"); assert.equal(report.protocolId, protocol.id);
  assert.equal(report.protocolLockSha256, sha256(await readFile(new URL("../protocol/frozen.json", HERE))));
  assert.deepEqual(report.dependencies, { dream4: dream.reportSha256, celegans: worm.reportSha256 });
  await verifyImplementationBinding(new URL("results.json", HERE), report, await binding()); assert.deepEqual(report.profile, NULL_PROFILE);
  const expected = [...dream.geometry.map(row => ({ id: scopeId(row.id, null), datasetId: row.id, root: null,
    nodeCount: row.nodeCount, edgeCount: row.edgeCount })),
  ...worm.geometry.map(row => ({ id: scopeId("Dataset7", row.source), datasetId: "Dataset7", root: row.source,
    nodeCount: row.nodeCount, edgeCount: row.edgeCount, originalGraphSha256: row.scopeHash }))];
  assert.equal(report.sourceScopes.length, expected.length);
  for (const [i, row] of report.sourceScopes.entries()) {
    closed(row, ["id", "datasetId", "root", "originalGraphSha256", "nodeCount", "edgeCount", "constraintsSha256"]);
    for (const [key, value] of Object.entries(expected[i])) assert.deepEqual(row[key], value);
    assert.match(row.originalGraphSha256, /^[a-f0-9]{64}$/); assert.match(row.constraintsSha256, /^[a-f0-9]{64}$/);
    // DREAM4 graph bytes are authenticated through D4's bound local details
    // during full replay; its compact primary report has no scope graph hash.
  }
  const primary = [...dream.results.map(row => ({ id: `dream4-${row.contrast}`, original: row })), { id: "celegans-Dataset7", original: worm.study }];
  assert.deepEqual(report.targets.map(row => row.id), primary.map(row => row.id));
  for (const [i, target] of report.targets.entries()) {
    closed(target, ["id", "targetCount", "targetValuesSha256", "requiredScopes", "groups", "original"]);
    assert.match(target.targetValuesSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(target.original, compactReport(primary[i].original));
    const groups = primary[i].original.ablations.B.groups;
    assert.deepEqual(target.groups, groups.map(row => ({ id: row.id, targetCount: row.targetCount, interventionIds: row.interventions.map(item => item.id) })));
    assert.equal(target.targetCount, groups.reduce((sum, row) => sum + row.targetCount, 0));
    assert.deepEqual(target.requiredScopes, groups.map(row => i < 2 ? scopeId(row.id, null) : scopeId("Dataset7", row.id)).sort());
    validateCompact(target.original, target);
  }
  assert.deepEqual(report.replicates.map(row => row.nullIndex), Array.from({ length: 32 }, (_, i) => i));
  for (const rep of report.replicates) validateReplicate(rep, report.sourceScopes, report.targets);
  assert.deepEqual(report.summary, summarizeAll(report.replicates, report.sourceScopes, report.targets));
  return report;
}

export async function verifyReport() {
  const report = await validateReport(await readJson("results.json", { maximum: 16000000 }));
  const costs = await readJson("costs.json", { maximum: 4000000 });
  assert.equal(costs.format, "onto2d-biological-degree-null-costs-v1"); assert.equal(costs.reportSha256, report.reportSha256);
  for (const key of ["preparationMs", "totalMs", "cumulativeNodePeakRssBytes"]) assert.ok(Number.isFinite(costs[key]) && costs[key] >= 0);
  assert.deepEqual(costs.replicates.map(row => row.nullIndex), report.replicates.map(row => row.nullIndex));
  for (const [i, cost] of costs.replicates.entries()) {
    const rep = report.replicates[i];
    assert.deepEqual(cost.scopes.map(row => row.id), report.sourceScopes.map(row => row.id));
    for (const row of cost.scopes) for (const key of ["samplingMs", "geometryMs", "sampledRssBytes"]) assert.ok(Number.isFinite(row[key]) && row[key] >= 0);
    verifyPythonCosts(cost.independent);
    assert.deepEqual(Object.keys(cost.evaluation), report.targets.map(row => row.id));
    for (const [j, study] of rep.studies.entries()) {
      const measured = cost.evaluation[study.id], groups = report.targets[j].groups, callsPerGroup = 5 * (groups.length - 1) + 1;
      if (study.status === "complete") {
        assert.equal(measured.fittingCalls, 6 * groups.length * callsPerGroup); assert.equal(measured.inferenceCalls, measured.fittingCalls);
        assert.deepEqual(Object.keys(measured.byAblation), Object.keys(study.report.ablations));
        for (const rows of Object.values(measured.byAblation)) {
          assert.deepEqual(rows.map(row => row.heldOut), groups.map(row => row.id));
          for (const row of rows) {
            assert.equal(row.fittingCalls, callsPerGroup); assert.equal(row.inferenceCalls, callsPerGroup);
            for (const key of ["fittingMs", "inferenceMs", "fittingSampledRssBytes", "inferenceSampledRssBytes"]) assert.ok(Number.isFinite(row[key]) && row[key] >= 0);
          }
        }
      } else if (study.failures.length) assert.deepEqual(measured, {});
    }
  }
  return report;
}

export async function build({ verify = false, index = null } = {}) {
  assert.ok(index === null || (verify && Number.isInteger(index) && index >= 0 && index < 32));
  const start = performance.now(), implementation = await binding(), sources = await loadSources();
  const expected = verify ? await verifyReport() : null;
  const sourceScopes = sources.originals.map(({ graph, ...row }) => ({ ...row, nodeCount: graph.nodes.length, edgeCount: graph.edges.length,
    constraintsSha256: digest(labelledConstraints(graph)) }));
  const targets = sources.targets.map(targetSummary);
  const costs = { format: "onto2d-biological-degree-null-costs-v1", recordedAt: new Date().toISOString(), runtime: process.version,
    platform: process.platform, architecture: process.arch, preparationMs: performance.now() - start, replicates: [],
    scope: "D6.1 dependency/source binding, all indexed proposals, fresh null geometry, complete eligible nested fits and independent verification; excludes primary source acquisition/extraction",
    resources: "Node cumulative peak and phase-end RSS samples plus independent Python peaks; geometry solver subprocess peaks are not measured" };
  const replicates = [];
  const indices = index === null ? Array.from({ length: 32 }, (_, i) => i) : [index];
  for (const nullIndex of indices) {
    console.log(`D6.1 null ${nullIndex}/31: sampling all 34 source scopes and recomputing geometry/models.`);
    const { details, costs: measured } = await runReplicate(sources, nullIndex);
    const payload = { originals: sources.originals, targets: sources.targets.map(({ id, rows }) => ({ id, rows })), details };
    console.log(`D6.1 null ${nullIndex}: ${details.studies.map(row => `${row.id}=${row.status}`).join(", ")}; independent verification.`);
    const independent = await reference(payload); measured.independent = independent.costs; costs.replicates.push(measured);
    const rep = summarizeReplicate(details, independent.result, sha256(encode(payload)));
    validateReplicate(rep, sourceScopes, targets);
    if (verify) assert.deepEqual(rep, expected.replicates[nullIndex], `D6 null ${nullIndex} semantic replay differs.`);
    await writeJson(localPath(nullIndex), payload); replicates.push(rep);
    console.log(`D6.1 null ${nullIndex} verified: ${independent.result.proposalsChecked} proposals, ${independent.result.predictionsChecked} predictions.`);
  }
  assert.deepEqual(await binding(), implementation, "D6 implementation changed during the run.");
  if (index !== null) { console.log(`D6.1 selected null ${index} replayed exactly; this is not a full 32-index replay.`); return expected; }
  const body = { format: "onto2d-biological-degree-null-study-v1", protocolId: sources.protocol.id,
    protocolLockSha256: sha256(await readFile(new URL("../protocol/frozen.json", HERE))), dependencies: sources.dependencies,
    implementation, profile: NULL_PROFILE, sourceScopes, targets, replicates, summary: summarizeAll(replicates, sourceScopes, targets) };
  const report = { ...body, reportSha256: digest(body) };
  await validateReport(report);
  if (verify) await verifyCompatibleReplay(new URL("results.json", HERE), report);
  costs.totalMs = performance.now() - start; costs.cumulativeNodePeakRssBytes = process.resourceUsage().maxRSS * 1024;
  costs.reportSha256 = report.reportSha256;
  if (!verify) { await writeJson("results.json", report, { pretty: true }); await writeJson("costs.json", costs, { pretty: true }); }
  console.log(`D6.1 ${verify ? "replayed" : "written"}: all 32 indexed nulls, every scope and failed computation retained.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const single = args.length === 1 && ["--write", "--verify", "--check"].includes(args[0]);
  const selected = args.length === 2 && args[0] === "--verify-index" && /^(0|[1-9]|[12][0-9]|3[01])$/.test(args[1]);
  if (!single && !selected) {
    console.error("Usage: node cases/structural-geometry/robustness/build.mjs --write|--verify|--check|--verify-index 0..31"); process.exitCode = 1;
  } else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] !== "--write", index: selected ? Number(args[1]) : null }))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
