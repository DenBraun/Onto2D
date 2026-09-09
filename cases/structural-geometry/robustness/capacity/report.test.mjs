import assert from "node:assert/strict";
import test from "node:test";
import { verifyReport, validateReport } from "./build.mjs";
import { readJson } from "./io.mjs";
import { digest } from "../../datasets/scopes.mjs";

test("capacity report binds every scope, immutable study population and exact primary reproduction", async () => {
  const report = await verifyReport(); assert.equal(report.scopes.length, 34);
  assert.deepEqual(report.studies.map(row => row.targets.length), [450, 450, 60]);
  assert.ok(report.studies.every(row => Object.keys(row.report.ablations).length === 6));
});

test("rehashing cannot authorize changed sources, targets, tuning, predictions, capacity counts or reference coverage", async () => {
  const original = await readJson("results.json");
  const changes = [r => { r.dependencies.celegans = "0".repeat(64); }, r => r.scopes.pop(),
    r => { r.scopes[0].graphSha256 = "0".repeat(64); }, r => { r.profile.models.reverse(); }, r => r.studies.pop(),
    r => { r.studies[0].targets[0].magnitude++; }, r => { r.studies[1].targets[0].groupId = "wrong-network"; },
    r => { r.studies[0].outerEvidence["B+S"][0].predictions.reverse(); }, r => { r.studies[0].report.primary.meanDelta++; },
    r => { r.studies[0].report.ablations["B+Q"].groups[0].lambda = 99; },
    r => { r.studies[2].report.capacity["B+S"][0].constantColumns.push("invented-column"); },
    r => { r.studies[0].report.comparisons[4].exactMeanDelta.numerator = "1"; },
    r => { r.studies[0].report.comparisons[4].interpretation = "limited-fixed-representation-gain"; },
    r => { r.independent.exactComparisonsChecked--; },
    r => { r.independent.fitting[0].predictionsChecked--; }];
  for (const change of changes) {
    const report = structuredClone(original); change(report); const { reportSha256, ...body } = report; report.reportSha256 = digest(body);
    await assert.rejects(validateReport(report));
  }
});
