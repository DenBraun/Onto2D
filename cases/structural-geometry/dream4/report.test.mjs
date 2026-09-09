import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateResults } from "./report.mjs";
import { verifyReport } from "./build.mjs";

const load = async file => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));

test("committed pilot has complete source, protocol, implementation and arithmetic bindings", async () => {
  const report = await verifyReport();
  assert.equal(report.results.length, 2);
  assert.ok(report.results.every(result => result.coverage.matchedRows === 450));
});

test("static validation rejects altered metrics, tuning, populations and interpretation", async () => {
  const report = await load("results.json"), protocol = await load("../protocol/protocol.json");
  const mutations = [
    results => { results[0].ablations.B.groups[0].interventions[0].rankSkill.value = 0.123; },
    results => { results[0].ablations.B.groups[0].lambda = 123; },
    results => { results[0].ablations.B.groups.pop(); },
    results => { results[0].ablations.B.groups[0].candidates[0].groups[0].id = "insilico_size10_1"; },
    results => { results[0].primary.interpretation = "geometry-proven-useful"; },
    results => { results[0].coverage.matchedRows = 449; },
    results => { results[0].propagation.meanRankSkill = 0.123; },
    results => { results[1].role = "primary"; },
    results => { results[0].ablations.B.groups[0].interventions[0].kendallTauB.tiedBoth = 99; }
  ];
  for (const mutate of mutations) {
    const results = structuredClone(report.results); mutate(results);
    assert.throws(() => validateResults(results, protocol));
  }
});
