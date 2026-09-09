import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../datasets/scopes.mjs";
import { readJson } from "./io.mjs";
import { verifyReport, validateReport } from "./build.mjs";

test("the null report binds all 32 indices, source studies, complete populations and independent checks", async () => {
  const report = await verifyReport();
  assert.equal(report.replicates.length, 32); assert.equal(report.sourceScopes.length, 34);
  assert.equal(report.targets.length, 3);
  assert.ok(report.replicates.every(row => row.independent.nullScopesChecked === 34));
});

test("rehashing omitted indices, changed eligibility, means, tuning or null coverage cannot verify", async () => {
  const original = await readJson("results.json");
  const mutations = [
    report => { report.replicates.pop(); },
    report => { report.replicates[1].nullIndex = 0; },
    report => { report.dependencies.celegans = "0".repeat(64); },
    report => { report.sourceScopes[5].originalGraphSha256 = "0".repeat(64); },
    report => { report.targets[2].groups.pop(); },
    report => { report.profile.maxProposals *= 2; },
    report => { report.replicates[0].scopes[0].sampling.proposals++; },
    report => { report.replicates[0].scopes[0].sampling.accepted--; },
    report => { report.replicates[0].studies[0].report.ablations.B.meanRankSkill += 0.01; },
    report => { report.replicates[0].studies[0].report.ablations.B.groups[0].candidates.pop(); },
    report => { report.replicates[0].studies[0].report.primary.meanDelta += 0.1; },
    report => { report.replicates[0].independent.predictionsChecked--; },
    report => { report.summary.scopes[0].distinctGraphs++; },
    report => { report.summary.studies[0].relativeToOriginal.below++; }
  ];
  for (const mutate of mutations) {
    const report = structuredClone(original); mutate(report);
    const { reportSha256, ...body } = report; report.reportSha256 = digest(body);
    await assert.rejects(validateReport(report));
  }
});
