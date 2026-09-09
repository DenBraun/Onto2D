import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { REGIMES, SCENES, selection, frameAt, format, replayScore, pairedGain, verifyEvidence, fetchPinned } from "./model.js";
import { replayControls, analyzeScene } from "./analysis.js";
import { RELEASE } from "./release.js";
const read = async name => JSON.parse(await readFile(new URL(name, import.meta.url), "utf8"));
const evidence = await read("evidence.json"), controls = await read("controls.json");

test("released biological scores replay from rank counts with equal groups, not pooled targets", () => {
  assert.equal(verifyEvidence(evidence), evidence);
  const worm = evidence.studies[2].models;
  assert.equal(replayScore(worm.B).targets, 60);
  assert.equal(replayScore(worm.B).groups.length, 9);
  assert.ok(Math.abs(pairedGain(worm.B, worm["B+G"]) + 0.2352869352869353) < 1e-12);
  const pooled = worm.B.groups.flatMap(g => g.interventions).reduce((s, i) => s + i.rankSkill.value * i.count, 0) / 60;
  assert.notEqual(replayScore(worm.B).value, pooled);
  assert.ok(pairedGain(evidence.studies[0].models.B, evidence.studies[0].models["B+G"]) > 0);
  assert.ok(pairedGain(evidence.studies[1].models.B, evidence.studies[1].models["B+G"]) < 0);
});
test("score corruption, missing ranks and unmatched populations cannot produce a gain", () => {
  const base = evidence.studies[0].models.B;
  for (const mutate of [m => m.groups[0].interventions[0].rankSkill.numerator = "999", m => m.meanRankSkill = 0, m => m.groups[0].interventions[0].rankSkill.reason = "missing", m => m.groups.push(m.groups[0])]) {
    const m = structuredClone(base); mutate(m); assert.throws(() => replayScore(m));
  }
  const renamed = structuredClone(base); renamed.groups[0].interventions[0].id = "different-population";
  assert.throws(() => pairedGain(base, renamed), /unmatched/);
  const m = structuredClone(evidence); m.scope.find(s => s.status === "unavailable").contexts = [];
  assert.throws(() => verifyEvidence(m), /Unavailable/);
  assert.equal(format(null), "Unavailable"); assert.equal(format(0), "0.0000"); assert.throws(() => format(NaN));
});
test("the selected scope is compared with its reference refitted on the same rows", () => {
  const incoming = evidence.scope.find(s => s.variant === "incoming-one");
  const [ref, alt] = incoming.contexts;
  assert.equal(replayScore(ref.models.B).targets, 35);
  assert.equal(replayScore(alt.models.B).targets, 35);
  assert.ok(pairedGain(alt.models.B, alt.models["B+G"]) > 0);
  assert.ok(pairedGain(alt.models["B+S"], alt.models["B+S+G"]) < 0);
  assert.throws(() => pairedGain(evidence.studies[2].models.B, alt.models["B+G"]), /unmatched/);
  const low = evidence.coverage[0].bins.filter(b => ["0", "1-2", "3-5"].includes(b.bin));
  assert.equal(low.reduce((n, b) => n + b.parentNodes, 0), 5);
  assert.equal(low.reduce((n, b) => n + b.eligiblePairsBySource + b.eligiblePairsByReceiver, 0), 0);
});
test("instrument controls distinguish typed fields and preserve missingness", () => {
  const results = replayControls(controls);
  assert.equal(results.length, 9);
  const find = (pair, regime) => results.find(c => c.pairId === pair && c.regimeId === regime);
  for (const regime of REGIMES) assert.equal(find("relabel", regime.id).status, "indistinguishable-under-regime");
  assert.equal(find("joint-fields", "topology-only-v1").status, "indistinguishable-under-regime");
  assert.equal(find("joint-fields", "typed-relations-v1").status, "distinguishable-under-regime");
  assert.equal(find("missing-evidence", "typed-relations-v1").status, "indeterminate");
  const bad = structuredClone(controls); bad.controls[0].artifact.status = "indeterminate";
  assert.throws(() => replayControls(bad));
});
test("all scene/regime combinations verify geometry without mutating source packs", () => {
  const before = JSON.stringify(controls);
  for (const scene of SCENES) for (const regime of REGIMES) {
    const result = analyzeScene(controls, scene.id, regime.id);
    assert.equal(result.sceneId, scene.id); assert.equal(result.regimeId, regime.id);
    assert.deepEqual(result.examples.map(e => e.id), [scene.left, scene.right]);
    if (scene.id === "missing") {
      assert.deepEqual(result.examples[0].graph, result.examples[1].graph);
      assert.equal(result.examples[1].geometric.features[1].state, "partial");
      assert.equal(result.examples[1].geometric.value, null);
    }
  }
  assert.equal(JSON.stringify(controls), before);
  assert.throws(() => selection("bogus", REGIMES[0].id));
  assert.throws(() => selection(SCENES[0].id, "history"));
  assert.throws(() => selection(SCENES[0].id, REGIMES[0].id, "bogus"));
});
test("a fixed point is retained without fabricating later flow states", () => {
  const diamond = controls.examples.find(e => e.id === "diamond-dag").artifact;
  const frame = frameAt(diamond.evidence.flow, 8);
  assert.equal(frame.held, true); assert.equal(frame.state.iteration, 1);
  assert.equal(frame.termination.reason, "fixed-point");
  assert.equal(diamond.features[2].state, "partial");
  assert.equal(frameAt(controls.examples[0].artifact.evidence.flow, 8).held, false);
  assert.throws(() => frameAt(diamond.evidence.flow, 9));
  assert.throws(() => frameAt(diamond.evidence.flow, 1.5));
  const bad = structuredClone(controls); bad.examples[0].artifact.evidence.flow.states[1].edges[0].length.numerator = "999";
  assert.throws(() => analyzeScene(bad, "branching", REGIMES[0].id));
});
test("release pins reject missing, truncated and same-size corrupted payloads", async () => {
  const bytes = await readFile(new URL("evidence.json", import.meta.url)), pin = RELEASE["evidence.json"];
  assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.sha256);
  assert.deepEqual(await fetchPinned("fixture", pin, async () => new Response(bytes), webcrypto), evidence);
  await assert.rejects(fetchPinned("fixture", pin, async () => new Response("", { status: 404 }), webcrypto), /request failed/);
  await assert.rejects(fetchPinned("fixture", pin, async () => new Response(bytes.subarray(1)), webcrypto), /byte length/);
  const corrupt = Buffer.from(bytes); corrupt[5] ^= 1;
  await assert.rejects(fetchPinned("fixture", pin, async () => new Response(corrupt), webcrypto), /checksum/);
});
