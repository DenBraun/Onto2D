import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { benchmarkRows, filterBenchmarkRows, formatScore } from "../../apps/history-matters-benchmark/presentation.js";
import { MAX_PILOT_BYTES, readPilotBytes } from "../../apps/history-matters-benchmark/transport.js";

const bundle = JSON.parse(await readFile(new URL("../../apps/history-matters-benchmark/pilot.json", import.meta.url), "utf8"));

test("benchmark filters retain negative results and unevaluated empirical candidates", () => {
  const rows = benchmarkRows(bundle.registry, bundle.entries, bundle.preparations, bundle.experimentalProtocols);
  assert.equal(rows.length, 8);
  const negative = filterBenchmarkRows(rows, { verdict: "negative" });
  assert.equal(negative.length, 1);
  assert.equal(negative[0].claimClass, "synthetic");
  const empirical = filterBenchmarkRows(rows, { claimClass: "empirical", verdict: "not-evaluated", effect: "future" });
  assert.equal(empirical.length, 2);
  assert.ok(empirical.every((row) => row.result === null));
  assert.equal(empirical.find((row) => row.caseId === "operational-aging").readiness.counts.testUnits, 100);
  const ltee = empirical.find((row) => row.caseId === "ltee-evolutionary-contingency");
  assert.equal(ltee.contract.protocols.length, 3);
  assert.equal(ltee.status, "NOT_ELIGIBLE");
  assert.equal(ltee.protocolAssessment.aggregateScore, null);
  assert.equal(filterBenchmarkRows(rows, { claimClass: "empirical", verdict: "positive" }).length, 0);
  assert.equal(formatScore(null), "Not available");
  assert.equal(formatScore({ errors: 0, pairs: 28, value: 0 }), "0 / 28 pairs (0.000)");
});

test("portfolio joins reject missing, duplicate, unregistered or relabeled results", () => {
  assert.throws(() => benchmarkRows(bundle.registry, bundle.entries.slice(1), bundle.preparations, bundle.experimentalProtocols), /membership mismatch/);
  assert.throws(() => benchmarkRows(bundle.registry, [...bundle.entries, bundle.entries[0]], bundle.preparations, bundle.experimentalProtocols), /Duplicate/);
  const registry = structuredClone(bundle.registry);
  registry.entries[0].claimClass = "empirical";
  assert.throws(() => benchmarkRows(registry, bundle.entries, bundle.preparations, bundle.experimentalProtocols), /interpretation mismatch/);
  const missing = structuredClone(bundle.registry);
  missing.entries.shift();
  assert.throws(() => benchmarkRows(missing, bundle.entries, bundle.preparations, bundle.experimentalProtocols), /Unregistered result/);
});

test("a preparation cannot be presented as an evaluated empirical result", () => {
  const preparations = structuredClone(bundle.preparations);
  preparations[0].readiness.verdict = "positive";
  assert.throws(() => benchmarkRows(bundle.registry, bundle.entries, preparations, bundle.experimentalProtocols), /readiness mismatch/);
  assert.throws(() => benchmarkRows(bundle.registry, bundle.entries, [], bundle.experimentalProtocols), /maturity mismatch/);
  const changed = structuredClone(bundle.preparations);
  changed[0].contract.primaryMetric.resolution = 99;
  assert.throws(() => benchmarkRows(bundle.registry, bundle.entries, changed, bundle.experimentalProtocols), /readiness mismatch/);
});

test("experimental protocol joins require complete, replayable and unevaluated evidence", () => {
  assert.throws(() => benchmarkRows(bundle.registry, bundle.entries, bundle.preparations, []), /protocol membership/);
  assert.throws(() => benchmarkRows(bundle.registry, bundle.entries, bundle.preparations, [...bundle.experimentalProtocols, ...bundle.experimentalProtocols]), /Duplicate experimental/);
  const withoutLtee = structuredClone(bundle.registry);
  withoutLtee.entries = withoutLtee.entries.filter((row) => row.caseId !== "ltee-evolutionary-contingency");
  assert.throws(() => benchmarkRows(withoutLtee, bundle.entries, bundle.preparations, bundle.experimentalProtocols), /Unregistered experimental/);
  for (const mutate of [
    (row) => { row.status = "CONTRAST_READY"; },
    (row) => { row.claimClass = "semantic"; },
    (row) => { row.contractPath = null; },
    (row) => { delete row.assessmentPath; }
  ]) {
    const registry = structuredClone(bundle.registry);
    mutate(registry.entries.find((row) => row.caseId === "ltee-evolutionary-contingency"));
    assert.throws(() => benchmarkRows(registry, bundle.entries, bundle.preparations, bundle.experimentalProtocols), /Experimental protocol/);
  }
  const protocols = structuredClone(bundle.experimentalProtocols);
  protocols[0].assessment.protocols[1].replicates = 72;
  assert.throws(() => benchmarkRows(bundle.registry, bundle.entries, bundle.preparations, protocols), /LTEE/);
});

test("pilot transfer enforces its byte limit before buffering the full body", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    let pulls = 0; let cancelled = false;
    const body = new ReadableStream({
      pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(pulls === 1 ? MAX_PILOT_BYTES : 1)); },
      cancel() { cancelled = true; }
    }, { highWaterMark: 0 });
    await assert.rejects(readPilotBytes(new Response(body, { headers })), /1 MiB limit/);
    assert.equal(pulls, 2);
    assert.equal(cancelled, true);
    assert.equal(body.locked, false);
  }
  let pulls = 0; let cancelled = false;
  const body = new ReadableStream({ pull() { pulls += 1; }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  await assert.rejects(readPilotBytes(new Response(body, { headers: { "content-length": String(MAX_PILOT_BYTES + 1) } })), /1 MiB limit/);
  assert.equal(pulls, 0);
  assert.equal(cancelled, true);
});

test("pilot transfer preserves exact chunked bytes and rejects failed responses", async () => {
  const bytes = new Uint8Array(MAX_PILOT_BYTES); bytes[0] = 255; bytes[bytes.length - 1] = 127;
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 3)); controller.enqueue(bytes.slice(3)); controller.close();
  } });
  assert.deepEqual(await readPilotBytes(new Response(body)), bytes);
  await assert.rejects(readPilotBytes(new Response("unavailable", { status: 503 })), /503/);
  const broken = new ReadableStream({ pull(controller) { controller.error(new Error("transfer interrupted")); } });
  await assert.rejects(readPilotBytes(new Response(broken)), /transfer interrupted/);
  assert.equal(broken.locked, false);
});
