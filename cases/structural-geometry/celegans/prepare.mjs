import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { check } from "../protocol/check.mjs";
import { verifyAuditReport } from "../protocol/audit.mjs";
import { prepareAnatomy, computeGeometry } from "./anatomy.mjs";
import { planWindows, extractResponses, matchedPopulation } from "./intake.mjs";
import { HERE, readJson, realDirectories, python } from "./io.mjs";

export async function prepare() {
  const start = performance.now(), protocol = await check(), audit = await verifyAuditReport();
  await realDirectories(["../datasets/cache", "../datasets/cache/prepared"]);
  const census = await readJson("../datasets/census.json"), lock = await readJson("../datasets/source-lock.json");
  const native = await readJson("../datasets/cache/prepared/native.json", { hash: census.nativeSha256, maximum: 16000000 });
  const applicability = await readJson("../datasets/cache/prepared/applicability.json", { hash: census.localApplicabilitySha256, maximum: 40000000 });
  const files = lock.files.filter(row => row.dataset === "celegans-witvliet-2021").map(row => ({ path: row.file, hash: `sha256:${row.sha256}` }));
  const anatomy = prepareAnatomy(native, applicability, files, protocol.celegans.primaryAnatomy);
  assert.equal(anatomy.parent.nodes.length, 180); assert.equal(anatomy.scopes.filter(scope => scope.eligible).length, 29);
  const mappings = applicability.mappings.filter(unit => unit.anatomicalUnitId === anatomy.id);
  assert.equal(mappings.length, 1);
  const plan = planWindows(native.randi.recordings, anatomy.parent.nodes, anatomy.scopes, mappings[0].recordings);
  assert.equal(plan.summary.nativeEvents, audit.celegans.nativeStimulusRows);
  assert.equal(plan.summary.eligibleEvents, audit.celegans.completeUncontaminatedWindows);
  assert.deepEqual(plan.summary.eventExclusions, audit.celegans.exclusionCounts);
  const costs = { preparationMs: performance.now() - start, geometry: [], geometryMs: 0 };
  console.log(`D5 source-only plan verified: ${plan.summary.nativeEvents} events, ${plan.summary.eligibleEvents} eligible windows, ${plan.requests.length} receiver requests.`);
  const geometry = await computeGeometry(anatomy, files, (row, cost) => {
    costs.geometry.push({ source: row.source, ...cost }); costs.geometryMs += cost.elapsedMs;
    console.log(`D5 geometry ${row.status}: ${row.source}.`);
  });
  const archiveEntry = lock.files.find(row => row.dataset === "celegans-randi-2023");
  const archive = { sha256: archiveEntry.sha256, byte_length: archiveEntry.byteLength };
  assert.deepEqual(native.randi.source, archive);
  const archivePath = fileURLToPath(new URL(`../datasets/cache/${archiveEntry.file}`, HERE));
  const extracted = await python("extract.py", [archivePath], { archive, recordings: native.randi.recordings, requests: plan.requests });
  costs.extraction = extracted.costs;
  assert.deepEqual(extracted.result.archive, archive);
  assert.equal(extracted.result.summary.verifiedMembers, native.randi.census.regular_members);
  assert.equal(extracted.result.summary.sourceNumericValues, native.randi.census.trace_values);
  assert.equal(extracted.result.summary.traceRows, native.randi.census.time_rows);
  const responseStart = performance.now();
  const responses = extractResponses(plan, extracted.result.windows);
  const matched = matchedPopulation(responses.trials, anatomy.scopes, geometry);
  costs.responsePreparationMs = performance.now() - responseStart;
  console.log(`D5 signal eligibility: ${matched.population.coverage.eligibleGroups} source groups, ${matched.population.coverage.eligibleTargetRows} target rows; ${matched.status}.`);
  return { protocol, census, archivePath, costs, data: { format: "onto2d-celegans-prepared-study-v1", archive,
    recordings: native.randi.recordings, anatomy, plan, geometry, extracted: extracted.result, responses, matched } };
}
