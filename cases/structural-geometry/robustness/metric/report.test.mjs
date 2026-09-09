import assert from "node:assert/strict";
import test from "node:test";
import { verifyReport, validateReport } from "./build.mjs";
import { readJson } from "./io.mjs";
import { digest } from "../../datasets/scopes.mjs";

test("metric sensitivity accounts for every declared variant, scope and unchanged target population", async () => {
  const report = await verifyReport(); assert.equal(report.variants.length, 5);
  assert.ok(report.variants.every(v => v.scopes.length === 34 && v.studies.length === 3));
  assert.deepEqual(report.variants[0].studies, report.variants[4].studies);
});
test("rehashing cannot authorize changed profiles, source populations, failures, predictions or comparison signs", async () => {
  const original = await readJson("results.json");
  const mutations = [r => r.variants.pop(), r => { r.profile.variants[1].idleness = "half"; },
    r => { r.capacityReportSha256 = "0".repeat(64); }, r => r.variants[1].scopes.pop(),
    r => { r.variants[0].scopes[0].changedPairs++; }, r => { r.variants[1].scopes[0].graphSha256 = "0".repeat(64); },
    r => { r.variants[0].studies[0].report.comparisons.expandedGain.exactMeanDelta.numerator = "0"; },
    r => { r.variants[0].studies[0].report.models["B+G"].outerEvidence[0].predictions.reverse(); },
    r => { r.variants[0].independent.fitting[0].predictionsChecked--; }, r => { r.variants[0].independent.exactComparisonsChecked--; }];
  mutations.push(r => { r.variants[2].studies[2].report = { status: "unavailable", reason: "all-original-prepared-scopes-required", failures: [], models: null, comparisons: null }; });
  for (const mutate of mutations) {
    const report = structuredClone(original); mutate(report); const { reportSha256, ...body } = report; report.reportSha256 = digest(body);
    await assert.rejects(validateReport(report));
  }
});
