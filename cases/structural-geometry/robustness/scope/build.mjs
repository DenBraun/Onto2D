import { verifyImplementationBinding, verifyCompatibleReplay, verifyPythonCosts } from "../../runtime-compatibility.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../protocol/check.mjs";
import { digest } from "../../datasets/scopes.mjs";
import { verifyReport as verifyMetric } from "../metric/build.mjs";
import { verifyReport as verifyAnatomy } from "../anatomy/build.mjs";
import { verifyReport as verifyCapacity } from "../capacity/build.mjs";
import { closed } from "../capacity/report.mjs";
import { PROFILE } from "./selection.mjs";
import { loadSources, sourceAudit, runVariant } from "./study.mjs";
import { validateAudit, summarizeVariant, validateVariant } from "./report.mjs";
import { HERE, readJson, writeJson, encode, python } from "./io.mjs";

const files = ["profile.json", "source-audit.json", "selection.mjs", "study.mjs", "report.mjs", "build.mjs", "io.mjs", "reference.py", "selection.test.mjs", "report.test.mjs"];
const implementation = async () => Object.fromEntries(await Promise.all(files.map(async path => [path, sha256(await readFile(new URL(path, HERE)))])));
export async function validateReport(report, { audit = null, checkAudit = true } = {}) {
  const metric = await verifyMetric(), anatomy = await verifyAnatomy(), capacity = await verifyCapacity();
  audit ??= await readJson("source-audit.json"); if (checkAudit) validateAudit(audit);
  closed(report, ["format", "profile", "implementation", "dependencies", "sourceAuditSha256", "coverage", "variants", "independentAudit", "reportSha256"]);
  const { reportSha256, ...body } = report; assert.equal(reportSha256, digest(body));
  assert.equal(report.format, "onto2d-scope-coverage-study-v1"); assert.deepEqual(report.profile, PROFILE);
  await verifyImplementationBinding(new URL("results.json", HERE), report, await implementation()); assert.equal(report.sourceAuditSha256, digest(audit));
  assert.deepEqual(report.dependencies, { metric: metric.reportSha256, anatomy: anatomy.reportSha256, capacity: capacity.reportSha256 });
  assert.deepEqual(audit.dependencies, report.dependencies); assert.deepEqual(audit.originalTargets, capacity.studies[2].targets);
  assert.deepEqual(report.coverage, audit.units.map(u => ({ id: u.id, targetCoverageRole: u.targetCoverageRole, bins: u.bins })));
  assert.deepEqual(report.variants.map(v => v.variant), PROFILE.variants); report.variants.forEach(v => validateVariant(v, audit, capacity));
  assert.deepEqual(report.independentAudit, { status: "verified", anatomicalNodes: 360, scopes: 1440, dream4Nodes: 50, originalTargetRows: 60,
    matchedRows: audit.populations.map(p => ({ variant: p.variant, rows: p.rows.length, groups: p.groups.filter(g => g.eligible).length })) });
  return report;
}
export async function verifyReport() {
  const report = await validateReport(await readJson("results.json")), costs = await readJson("costs.json");
  assert.equal(costs.reportSha256, report.reportSha256); assert.equal(costs.format, "onto2d-scope-coverage-costs-v1");
  const measured = n => assert.ok(Number.isFinite(n) && n >= 0);
  for (const key of ["totalMs", "preparationMs", "cumulativeNodePeakRssBytes"]) measured(costs[key]);
  assert.deepEqual(costs.variants.map(v => v.variant), PROFILE.variants);
  costs.variants.forEach((variant, i) => {
    const result = report.variants[i]; assert.deepEqual(variant.geometry.map(s => s.root), result.scopes.map(s => s.root));
    variant.geometry.forEach(s => { measured(s.elapsedMs); measured(s.sampledRssBytes); });
    verifyPythonCosts(variant.independent);
    assert.equal(variant.fitting.length, result.status === "complete" ? 2 : 0);
    variant.fitting.forEach(context => { assert.deepEqual(Object.keys(context), PROFILE.models); for (const rows of Object.values(context)) {
      assert.deepEqual(rows.map(r => r.heldOut), result.scopes.map(s => s.root)); rows.forEach(row => {
        assert.equal(row.fittingCalls, 5 * (rows.length - 1) + 1); assert.equal(row.inferenceCalls, row.fittingCalls);
        for (const key of ["fittingMs", "inferenceMs", "fittingSampledRssBytes", "inferenceSampledRssBytes"]) measured(row[key]);
      });
    } });
  }); return report;
}
export async function build({ verify = false } = {}) {
  const start = performance.now(), binding = await implementation(), sources = await loadSources(), audit = await readJson("source-audit.json");
  assert.deepEqual(audit, sourceAudit(sources), "Frozen source-only scope audit differs.");
  const independentAudit = await python("--audit", { audit, units: sources.units });
  if (verify) await verifyReport();
  const variants = [], costs = { format: "onto2d-scope-coverage-costs-v1", recordedAt: new Date().toISOString(),
    runtime: process.version, platform: process.platform, architecture: process.arch, preparationMs: performance.now() - start, audit: independentAudit.costs, variants: [],
    scope: "Complete source census/preflight, target-bearing alternative geometry, both-context four-model fitting and independent replay. Native extraction, reference geometry/features reuse authenticated evidence. Node cumulative/phase-end RSS and separate reference Python peak; runtime solver subprocess peaks unmeasured." };
  for (const variant of PROFILE.variants) {
    console.log(`D6.5 ${variant}: declared common target population.`);
    const run = await runVariant(sources, audit, variant);
    const independent = await python("--study", { details: run.details, audit, referenceScopes: sources.capacity.scopes.filter(s => s.datasetId === "Dataset7") }, { networkx: true });
    const summary = { ...summarizeVariant(run.details), independent: independent.result, localDetailsSha256: sha256(encode(run.details)) };
    validateVariant(summary, audit, sources.capacity.capacity); variants.push(summary);
    costs.variants.push({ ...run.costs, independent: independent.costs }); await writeJson(`cache/${variant}.json`, run.details);
  }
  const body = { format: "onto2d-scope-coverage-study-v1", profile: PROFILE, implementation: binding, dependencies: sources.dependencies,
    sourceAuditSha256: digest(audit), coverage: audit.units.map(u => ({ id: u.id, targetCoverageRole: u.targetCoverageRole, bins: u.bins })), variants, independentAudit: independentAudit.result };
  const report = { ...body, reportSha256: digest(body) }; await validateReport(report, { audit, checkAudit: false });
  assert.deepEqual(binding, await implementation(), "D6.5 inputs or implementation changed during computation.");
  if (verify) await verifyCompatibleReplay(new URL("results.json", HERE), report);
  costs.totalMs = performance.now() - start; costs.cumulativeNodePeakRssBytes = process.resourceUsage().maxRSS * 1024; costs.reportSha256 = report.reportSha256;
  if (!verify) { await writeJson("results.json", report, { pretty: true }); await writeJson("costs.json", costs, { pretty: true }); }
  console.log(`D6.5 ${verify ? "replay verified" : "written"}: complete coverage ledger and all four outcomes retained.`); return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--check"].includes(args[0])) { console.error("Expected --write, --verify or --check"); process.exitCode = 1; }
  else (args[0] === "--check" ? verifyReport() : build({ verify: args[0] === "--verify" })).catch(error => { console.error(error); process.exitCode = 1; });
}
