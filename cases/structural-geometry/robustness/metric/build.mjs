import { verifyImplementationBinding, verifyCompatibleReplay, verifyPythonCosts } from "../../runtime-compatibility.mjs";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../protocol/check.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { verifyReport as verifyCapacity } from "../capacity/build.mjs";
import { closed } from "../capacity/report.mjs";
import { PROFILE } from "./geometry.mjs";
import { auditOf, loadSources, runVariant } from "./study.mjs";
import { summarizeScope, validateVariant } from "./report.mjs";
import { HERE, readJson, writeJson, encode, python } from "./io.mjs";

async function implementation() {
  const files = ["profile.json", "source-audit.json", "geometry.mjs", "study.mjs", "evaluation.mjs", "report.mjs", "build.mjs", "io.mjs", "reference.py", "controls.mjs", "controls.json", "metric.test.mjs", "evaluation.test.mjs", "report.test.mjs",
    "../../flow/networkx_reference.py", "../../flow/paper_reference.py"];
  async function collect(path) {
    for (const entry of await readdir(new URL(path, HERE), { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "__pycache__") await collect(`${path}/${entry.name}`);
      else if (entry.isFile() && /\.(js|py)$/.test(entry.name)) files.push(`${path}/${entry.name}`);
    }
  }
  await collect("../../../../packages/structural-geometry/src");
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha256(await readFile(new URL(file, HERE)))])));
}
export async function validateReport(report) {
  const capacity = await verifyCapacity(), audit = await readJson("source-audit.json");
  closed(report, ["format", "profile", "implementation", "capacityReportSha256", "sourceAuditSha256", "variants", "reportSha256"]);
  const { reportSha256, ...body } = report; assert.equal(reportSha256, digest(body));
  assert.equal(report.format, "onto2d-biological-metric-sensitivity-v1"); assert.deepEqual(report.profile, PROFILE);
  await verifyImplementationBinding(new URL("results.json", HERE), report, await implementation()); assert.equal(report.capacityReportSha256, capacity.reportSha256);
  assert.deepEqual(audit, auditOf(capacity)); assert.equal(report.sourceAuditSha256, digest(audit));
  assert.deepEqual(report.variants.map(v => v.id), PROFILE.variants.map(v => v.id));
  report.variants.forEach(v => validateVariant(v, capacity));
  const reference = report.variants[0], scale = report.variants.at(-1);
  assert.deepEqual(scale.studies, reference.studies);
  scale.scopes.forEach((scope, i) => assert.equal(scope.geometrySha256, reference.scopes[i].geometrySha256));
  return report;
}
export async function verifyReport() {
  const report = await validateReport(await readJson("results.json", { maximum: 12000000 })), costs = await readJson("costs.json", { maximum: 2000000 });
  assert.equal(costs.format, "onto2d-metric-sensitivity-costs-v1"); assert.equal(costs.reportSha256, report.reportSha256);
  const measured = value => assert.ok(Number.isFinite(value) && value >= 0);
  measured(costs.totalMs); measured(costs.cumulativeNodePeakRssBytes); measured(costs.preparationMs);
  assert.deepEqual(costs.variants.map(v => v.variantId), PROFILE.variants.map(v => v.id));
  for (const [i, variant] of costs.variants.entries()) {
    const result = report.variants[i];
    assert.deepEqual(variant.scopes.map(s => s.id), result.scopes.map(s => s.id));
    variant.scopes.forEach(s => { measured(s.elapsedMs); measured(s.sampledRssBytes); });
    verifyPythonCosts(variant.independent);
    assert.deepEqual(Object.keys(variant.evaluation), PROFILE.studies);
    for (const study of result.studies) {
      const evaluation = variant.evaluation[study.id];
      if (study.report.status !== "complete") { assert.deepEqual(evaluation, {}); continue; }
      assert.deepEqual(Object.keys(evaluation), PROFILE.models);
      for (const name of PROFILE.models) {
        const ids = study.report.models[name].summary.groups.map(g => g.id);
        assert.deepEqual(evaluation[name].map(g => g.heldOut), ids);
        evaluation[name].forEach(g => { assert.equal(g.fittingCalls, 5 * (ids.length - 1) + 1); assert.equal(g.inferenceCalls, g.fittingCalls);
          for (const key of ["fittingMs", "inferenceMs", "fittingSampledRssBytes", "inferenceSampledRssBytes"]) measured(g[key]); });
      }
    }
  }
  return report;
}
export async function build({ verify = false } = {}) {
  const start = performance.now(), binding = await implementation(), sources = await loadSources();
  const audit = await readJson("source-audit.json"); assert.deepEqual(audit, auditOf(sources.capacity));
  if (verify) await verifyReport();
  const variants = [];
  const costs = { format: "onto2d-metric-sensitivity-costs-v1", recordedAt: new Date().toISOString(), runtime: process.version, platform: process.platform, architecture: process.arch,
    preparationMs: performance.now() - start, variants: [], scope: "New provider/flow/pair collection, two-model nested refitting and independent verification. Source extraction, target preparation and B/S features and baseline fits reuse authenticated D6.3 evidence. Node cumulative peak and phase-end RSS; separate reference Python peak; runtime solver subprocess peaks are not measured." };
  for (const variant of PROFILE.variants) {
    console.log(`D6.4 ${variant.id}: all 34 original scopes and every original target group.`);
    const run = await runVariant(sources, variant.id);
    console.log(`D6.4 ${variant.id}: independent trajectory, feature, model and comparison verification.`);
    const independent = await python("--study", { details: run.details, sources }, { networkx: true });
    run.costs.independent = independent.costs; costs.variants.push(run.costs);
    const summary = { id: variant.id, scopes: run.details.scopes.map((scope, i) => summarizeScope(scope, sources.scopes[i])),
      studies: run.details.studies.map(({ id, report }) => ({ id, report })), independent: independent.result, localDetailsSha256: sha256(encode(run.details)) };
    validateVariant(summary, sources.capacity); variants.push(summary);
    await writeJson(`cache/${variant.id}.json`, run.details);
  }
  const body = { format: "onto2d-biological-metric-sensitivity-v1", profile: PROFILE, implementation: binding, capacityReportSha256: sources.capacity.reportSha256,
    sourceAuditSha256: digest(audit), variants };
  const report = { ...body, reportSha256: digest(body) }; await validateReport(report);
  assert.deepEqual(await implementation(), binding, "D6.4 implementation changed during computation.");
  if (verify) await verifyCompatibleReplay(new URL("results.json", HERE), report);
  costs.totalMs = performance.now() - start; costs.cumulativeNodePeakRssBytes = process.resourceUsage().maxRSS * 1024; costs.reportSha256 = report.reportSha256;
  if (!verify) { await writeJson("results.json", report, { pretty: true }); await writeJson("costs.json", costs, { pretty: true }); }
  console.log(`D6.4 ${verify ? "replay verified" : "written"}: all five variants, complete outcomes and failures retained.`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--check"].includes(args[0])) { console.error("Expected --write, --verify or --check"); process.exitCode = 1; }
  else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] === "--verify" })).catch(error => { console.error(error); process.exitCode = 1; });
}
