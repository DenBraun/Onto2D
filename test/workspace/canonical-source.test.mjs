import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalize } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { loadCanonicalSource, validateCanonicalSource } from "../../models/causal-emergence/canonical/source.mjs";
import { buildCanonicalRelease, buildHistoricalCanonicalRelease, writeCanonicalRelease, verifyCanonicalRelease } from "../../models/causal-emergence/canonical/build.mjs";

const data = await loadCanonicalSource();
const legacy = await Promise.all(Array.from({ length: 8 }, async (_, i) => JSON.parse(await readFile(new URL(`../../references/level-${i}.json`, import.meta.url), "utf8"))));

test("canonical reconstruction accounts for every legacy record without promoting unresolved edges", () => {
  assert.equal(data.migration.nodes.length, 249);
  assert.equal(data.migration.edges.length, 971);
  assert.equal(data.migration.nodes.filter((n) => n.status === "reinterpreted-with-obligations").length, 30);
  assert.equal(data.migration.edges.filter((e) => e.status === "internally-reviewed").length, 106);
  assert.equal(data.migration.edges.filter((e) => e.status === "pending-scientific-review" && e.targetIds.length === 0).length, 865);
  assert.equal(data.migration.nodes.find((n) => n.legacyId === "0.7").targetIds.length, 2);
  assert.equal(data.migration.nodes.find((n) => n.legacyId === "0.16").targetIds.length, 2);
});

test("the source contract rejects missing citations, invented references, unchecked truth labels and dropped legacy records", () => {
  const mutations = [
    (d) => { d.graph.claims[0].citations = []; },
    (d) => { d.graph.claims[0].citations[0].sourceId = "invented"; },
    (d) => { d.graph.entities[0].status = "empirically-established"; },
    (d) => { d.graph.claims[0].status = "analytically-checked"; },
    (d) => { d.graph.claims[0].checkIds = ["invented-check"]; },
    (d) => { d.migration.nodes.pop(); },
    (d) => { d.migration.edges.pop(); },
    (d) => { d.migration.edges[0].targetIds = ["l0:distinction"]; },
    (d) => { d.migration.nodes[0].targetIds = ["l0:crt-node"]; },
    (d) => { d.graph.entities[0].arbitraryTruth = true; },
    (d) => { d.graph.scope.empiricalValidationClaimed = true; },
    (d) => { d.graph.sources.find((s) => s.kind === "research-publication").year = null; }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => validateCanonicalSource(changed, legacy));
  }
});

test("joint rules require distinct multiplicities and cannot assert successful physical admission", () => {
  const triad = data.graph.rules.find((r) => r.id === "R-triad");
  assert.deepEqual(triad.inputs[0], { entityId: "l0:oscillatory-mode", minCount: 3, maxCount: 3, distinct: true, role: "candidate-instances" });
  for (const mutate of [
    (r) => { r.inputLogic = "any"; },
    (r) => { r.inputs[0].distinct = false; },
    (r) => { r.inputs[0].maxCount = 2; },
    (r) => { r.instanceAdmission = "passed"; }
  ]) {
    const changed = structuredClone(data);
    mutate(changed.graph.rules.find((r) => r.id === "R-triad"));
    assert.throws(() => validateCanonicalSource(changed, legacy));
  }
});

test("the compiled graph preserves rule incidence, complete rationale, negative results and historical coverage", async () => {
  const pack = await buildCanonicalRelease();
  const nodes = pack.files["model/nodes.json"];
  const edges = pack.files["model/edges.json"];
  const dictionaries = pack.files["model/dictionaries.json"];
  assert.equal(nodes.length, 56);
  assert.equal(edges.length, 60);
  assert.equal(edges.filter((e) => e.target === "R-object").length, 5);
  assert.equal(edges.filter((e) => e.ruleId).length, 25);
  assert.ok(edges.every((e) => ["descriptive", "functional-support"].includes(e.relationLayer) && e.claimIds.length));
  assert.equal(edges.filter((e) => e.relationLayer === "functional-support").length, 12);
  assert.deepEqual(dictionaries.pilot, data.pilot);
  assert.equal(nodes.find((n) => n.id === "ret:retinal-filtering").rationale[0].contexts[0].organism, data.pilot.studies.find((s) => s.id === "crook2011").organism);
  assert.deepEqual(dictionaries.edgeReviews, data.edgeReviews);
  assert.equal(nodes.find((n) => n.id === "l0:crt-node").scientificStatus, "class-uninstantiated");
  const promotion = nodes.find((n) => n.id === "R-promote");
  assert.ok(promotion.rationale.some((c) => c.citations.some((s) => s.source.doi === "10.48550/arXiv.1707.00819")));
  assert.equal(dictionaries.evidence.objecthoodConclusion.declaredModelLevelZeroValidated, false);
  assert.deepEqual(dictionaries.migration, data.migration);
  assert.ok(nodes.every((n) => n.rationale.length && n.rationale.every((c) => c.citations.every((s) => s.source))));
  assert.equal(canonicalize(await buildCanonicalRelease()), canonicalize(pack));
});

test("every Level-0 assertion has a scoped disposition; original numeric claims never become active weights", async () => {
  const records = data.edgeReviews.records;
  assert.deepEqual(Object.fromEntries(["retain-as-description", "replace-with-rule", "withhold"].map((d) => [d, records.filter((r) => r.decision === d).length])), {
    "retain-as-description": 14, "replace-with-rule": 13, withhold: 57
  });
  assert.equal(records.filter((r) => r.quantitativeDisposition.flags.includes("carrier-group-type-mismatch")).length, 16);
  const pack = await buildCanonicalRelease();
  for (const edge of pack.files["model/edges.json"]) {
    assert.equal(edge.weight, undefined);
    assert.equal(edge.Quantization, undefined);
    assert.equal(edge.Necessity, undefined);
  }
  assert.ok(data.graph.relations.some((r) => r.source === "l0:trial-field" && r.target === "l0:quadratic-action"));
  assert.ok(!data.graph.relations.some((r) => r.source === "l0:oscillatory-mode" && r.target === "l0:quadratic-action"));
  assert.ok(data.graph.rules.find((r) => r.id === "R-object").inputs.some((p) => p.entityId === "l0:deformation" && p.role === "declared-context"));
});

test("review validation rejects lost assertions, changed evidence, reversed dependencies and fabricated adoption", () => {
  const mutations = [
    (d) => { d.edgeReviews.records.pop(); },
    (d) => { d.edgeReviews.records[0].original.Weight = 0.7; },
    (d) => { d.edgeReviews.records[0].legacyLifecycle = "modulation"; },
    (d) => { d.edgeReviews.records[0].policy = "invented"; },
    (d) => { d.edgeReviews.policySha256 = "0".repeat(64); },
    (d) => { d.relationPolicy.evidenceRules.pop(); },
    (d) => { d.edgeReviews.records[0].quantitativeDisposition.expectedCarrierGroupId = 99; },
    (d) => { d.edgeReviews.records[0].quantitativeDisposition.flags.push("carrier-group-type-mismatch"); },
    (d) => { d.graph.relations[0].target = d.graph.relations[0].source; },
    (d) => { const r = d.graph.relations[0]; [r.source, r.target] = [r.target, r.source]; },
    (d) => { d.graph.relations[0].legacyReviewId = "invented"; },
    (d) => { d.graph.relations[0].kind = "generative"; },
    (d) => { d.graph.relations[0].weight = 1; },
    (d) => { d.edgeReviews.records.find((r) => r.decision === "withhold").targetRelationIds = [d.graph.relations[0].id]; },
    (d) => { d.edgeReviews.records.find((r) => r.decision === "replace-with-rule").targetRuleIds = ["R-invented"]; },
    (d) => { d.edgeReviews.records.find((r) => r.decision === "retain-as-description").decision = "withhold"; },
    (d) => { d.migration.edges[84].reviewId = d.edgeReviews.records[0].id; }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => validateCanonicalSource(changed, legacy));
  }
});

test("the first canonical release replays its bound source snapshot after current source changes", async () => {
  const pack = await buildHistoricalCanonicalRelease("2026.09.11");
  assert.equal(pack.manifest.rootHash, "sha256:91eeb207dc0deab775985da6bcb06ce26adfe5780ddeb0fa88144c4d283034cb");
  assert.equal(pack.manifest.statistics.nodeCount, 33);
  assert.equal(pack.manifest.source.files.length, 25);
  await assert.rejects(() => buildHistoricalCanonicalRelease("../2026.09.11"), /Invalid historical version/);
});

test("the completed Level-0 release replays its original compiler and all bound source files", async () => {
  const pack = await buildHistoricalCanonicalRelease("2026.09.12");
  assert.equal(pack.manifest.rootHash, "sha256:24dc9b55f0067b7c841857719ea712afab374a2f13772ec160f25b04b754bbe4");
  assert.deepEqual(pack.manifest.statistics, { nodeCount: 34, edgeCount: 42 });
  assert.equal(pack.manifest.source.files.length, 28);
});

test("functional support remains separate from formation-support semantics and the earlier pilot still replays", async () => {
  const firstPilot = await buildHistoricalCanonicalRelease("2026.09.12.1");
  assert.equal(firstPilot.manifest.rootHash, "sha256:9ce48fe546ba650860dc25b23773694ef42ba448dc60b5ca67d0b9ca6ee446af");
  assert.equal(firstPilot.manifest.source.files.length, 31);
  const pack = await buildCanonicalRelease();
  const edges = pack.files["model/edges.json"];
  assert.equal(edges.filter((e) => e.relationLayer === "functional-support").length, 12);
  assert.ok(!edges.some((e) => ["generative", "constitutive", "intra-closure-support"].includes(e.relationLayer)));
});

test("the retinal pilot preserves six complete cards, seventeen evidence entries and all twenty-two incoming assertions", () => {
  assert.equal(data.pilot.nodeReviews.length, 6);
  assert.equal(data.pilot.evidenceReviews.length, 17);
  assert.equal(data.pilot.edgeReviews.length, 22);
  assert.equal(data.pilot.edgeReviews.filter((r) => r.quantitativeFindings.flags.includes("carrier-group-type-mismatch")).length, 12);
  assert.equal(data.pilot.evidenceReviews.filter((e) => e.resolvedSourceId === null).length, 14);
  assert.equal(data.pilot.studies.filter((s) => s.studyType === "primary-experiment").length, 12);
  assert.deepEqual(data.graph.scope.partiallyReviewedLegacyLevels, [3, 4, 5]);
  assert.equal(data.migration.nodes.find((n) => n.legacyId === "5.19").targetIds.length, 2);
  assert.equal(data.migration.nodes.find((n) => n.legacyId === "3.0").status, "pending-scientific-review");
  assert.ok(!data.graph.relations.some((r) => r.source === "ret:rod-response" && r.target === "ret:retinal-filtering"));
  assert.ok(data.graph.relations.some((r) => r.source === "ret:intrinsic-light-response" && r.target === "ret:ganglion-spiking"));
});

test("the pilot rejects invented bibliography, lost fields, unscoped support and silent whole-level promotion", () => {
  const mutations = [
    (d) => { d.pilot.nodeReviews.pop(); },
    (d) => { delete d.pilot.nodeReviews[0].fieldDispositions.Requirements; },
    (d) => { d.pilot.nodeReviews[0].original.Description = "Rewritten history"; },
    (d) => { d.pilot.evidenceReviews.pop(); },
    (d) => { d.pilot.evidenceReviews[0].resolvedSourceId = "peteanu1993"; },
    (d) => { d.pilot.evidenceReviews[0].replacementSourceIds = ["burns2010"]; },
    (d) => { d.pilot.studies[0].doi = "10.1234/invented"; },
    (d) => { d.pilot.edgeReviews.pop(); },
    (d) => { d.pilot.edgeReviews[0].original.Weight = 1; },
    (d) => { d.pilot.edgeReviews[0].quantitativeFindings.expectedCarrierGroupId = 99; },
    (d) => { d.pilot.edgeReviews.find((e) => e.decision === "withhold").targetRelationIds = ["retinal:illumination"]; },
    (d) => { d.graph.claims.find((c) => c.id === "P-do2009").contextIds = []; },
    (d) => { d.graph.claims.find((c) => c.id === "P-do2009").citations[0].locator = "Unread section"; },
    (d) => { d.graph.claims.find((c) => c.id === "P-rod-synthesis").status = "publication-supported"; },
    (d) => { d.graph.relations.find((r) => r.id === "retinal:intrinsic-spikes").contextIds = ["crook2011"]; },
    (d) => { d.graph.relations.find((r) => r.id === "retinal:intrinsic-spikes").target = "l0:crt-node"; },
    (d) => { d.graph.relations.find((r) => r.id === "retinal:illumination").weight = 0.5; },
    (d) => { d.graph.scope.reviewedLegacyLevels.push(5); d.graph.scope.partiallyReviewedLegacyLevels.pop(); },
    (d) => { d.pilotPolicy.priorExposure = "Blind preregistration"; },
    (d) => { d.pilot.policySha256 = "0".repeat(64); }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => validateCanonicalSource(changed, legacy));
  }
});

test("release writing refuses replacement and verification catches stale split derivatives", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "onto2d-canonical-test-"));
  const directory = path.join(parent, "release");
  const make = (name) => buildModelPack({ model: { id: "test", name, version: "1" }, source: { id: "test", files: [] }, nodes: [{ id: "n" }], edges: [], dictionaries: {} });
  try {
    const pack = make("first");
    await writeCanonicalRelease(pack, directory);
    await writeCanonicalRelease(pack, directory);
    await assert.rejects(() => writeCanonicalRelease(make("second"), directory), /Refusing to overwrite/);
    await verifyCanonicalRelease(pack, directory);
    await rm(path.join(directory, "model/nodes.json"));
    await assert.rejects(() => verifyCanonicalRelease(pack, directory), /inventory/);
  } finally { await rm(parent, { recursive: true, force: true }); }
});
