import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "./io.mjs";
import { verifyReport, validateReport } from "./build.mjs";
import { validatePopulation, validateStudy } from "./report.mjs";
import { sha256 } from "../protocol/check.mjs";

test("functional report binds every source root, frozen policy, implementation and complete score", async () => {
  const report = await verifyReport();
  assert.equal(report.population.coverage.groups, 180);
  assert.equal(report.intake.nativeEvents, 5808);
  assert.equal(report.geometry.length, 29);
  assert.equal(report.study.status, "complete");
});

test("rehashed report cannot change source binding, mapping census or independent coverage", async () => {
  const original = await readJson("results.json");
  const changes = [
    r => { r.anatomyId = "Dataset8"; }, r => { r.sourceArchiveSha256 = "0".repeat(64); },
    r => { r.intake.eligibleEvents--; }, r => { r.windows.requestedSamples--; },
    r => { r.geometry[0].scopeHash = "0".repeat(64); }, r => { r.independent.predictionsChecked++; },
    r => { r.study = { status: "unavailable", reason: "required-geometry-computation-failed", primary: null }; }
  ];
  for (const change of changes) {
    const report = structuredClone(original); change(report);
    const { reportSha256, ...body } = report; report.reportSha256 = sha256(JSON.stringify(body));
    await assert.rejects(() => validateReport(report));
  }
});

test("coverage and score validation reject dropped roots, inflated eligibility, altered metrics and tuning", async () => {
  const report = await readJson("results.json"), audit = await readJson("../protocol/audit.json");
  for (const change of [p => p.groups.pop(), p => p.coverage.eligibleTargetRows++, p => p.trialStates.observed++, p => p.pairExclusions["no-trial-rows"]--]) {
    const population = structuredClone(report.population); change(population);
    assert.throws(() => validatePopulation(population, report.intake, audit));
  }
  const groups = report.population.groups.filter(group => group.eligible);
  for (const change of [s => s.ablations.B.groups.pop(), s => { s.ablations.B.groups[0].lambda = 123; },
    s => { s.ablations.B.groups[0].interventions[0].rankSkill.value = 0.123; },
    s => { s.ablations.B.groups[0].candidates[0].groups[0].id = s.ablations.B.groups[0].id; },
    s => { s.primary.interpretation = "geometry-improves-biology"; }, s => { s.propagation.meanRankSkill = 0.123; }]) {
    const study = structuredClone(report.study); change(study);
    assert.throws(() => validateStudy(study, groups));
  }
});
