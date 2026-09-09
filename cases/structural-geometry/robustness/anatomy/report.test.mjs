import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "./io.mjs";
import { verifyReport, validateReport } from "./build.mjs";
import { digest } from "../../datasets/scopes.mjs";

test("Dataset8 report binds the source-only census, every prepared scope and all three sensitivity studies", async () => {
  const report = await verifyReport();
  assert.equal(report.geometry.length, 32); assert.equal(report.population.coverage.groups, 180);
  assert.equal(report.intake.nativeEvents, 5808);
  const audit = await readJson("source-audit.json");
  assert.equal(audit.recordingIds[0], "randi2023-recording-0");
  assert.equal(audit.recordingIds.at(-1), "randi2023-recording-112");
  assert.deepEqual(report.studies.map(row => row.id), ["Dataset8-native", "Dataset7-matched", "Dataset8-matched"]);
});

test("rehashed anatomy reports reject changed source, overlap, eligibility, ranks and numerical coverage", async () => {
  const original = await readJson("results.json");
  const changes = [r => { r.parentGraphSha256 = "0".repeat(64); }, r => { r.dependencyReportSha256 = "0".repeat(64); },
    r => { r.profile.anatomies.reverse(); }, r => { r.intake.eligibleEvents++; }, r => r.geometry.pop(),
    r => { r.geometry.find(row => row.status === "complete").termination.cycleStart = 0; },
    r => r.population.groups.pop(), r => { r.population.coverage.eligibleTargetRows++; },
    r => { r.population.groups.find(row => !row.scopeEligible).scopeReason = "invented-source-reason"; },
    r => { r.priorTargets[0].magnitude++; }, r => r.overlap.candidates.pop(), r => { r.overlap.groups[0].eligible = !r.overlap.groups[0].eligible; },
    r => r.studies.pop(), r => { r.studies[0].targets[0].rank++; }, r => { r.studies[0].targets[0].id = "wrong"; },
    r => { r.studies[0].targets[0].recordingIds[0] = "randi2023-recording-113"; },
    r => { r.independent.samplesChecked++; }, r => { r.independent.fitting[0].predictionsChecked++; },
    r => { r.comparison.status = "invented-success"; }];
  for (const change of changes) {
    const report = structuredClone(original); change(report); const { reportSha256, ...body } = report; report.reportSha256 = digest(body);
    await assert.rejects(validateReport(report));
  }
});
