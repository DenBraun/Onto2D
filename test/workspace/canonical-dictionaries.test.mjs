import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadCanonicalSource, validateCanonicalSource, loadQuantitativeCensus } from "../../models/causal-emergence/canonical/source.mjs";
import { buildCanonicalRelease, buildHistoricalCanonicalRelease } from "../../models/causal-emergence/canonical/build.mjs";
import { verifyDictionaryWitnesses } from "../../models/causal-emergence/canonical/dictionary-witnesses.mjs";

const data = await loadCanonicalSource();
const legacy = await Promise.all(Array.from({ length: 8 }, async (_, i) => JSON.parse(await readFile(new URL(`../../references/level-${i}.json`, import.meta.url), "utf8"))));

test("dictionary review rejects lost evidence, misbound methods, numeric defaults and speculative promotion", () => {
  const record = (d, group, id) => d.dictionaryReview.records.find((r) => r.group === group && r.legacyId === id);
  for (const mutate of [
    (d) => { d.dictionaryReview.records.pop(); },
    (d) => { d.dictionaryReview.records[0].original.MathForm.Equations = []; },
    (d) => { d.dictionaryReview.records[0].fieldDecisions.pop(); },
    (d) => { record(d, "CarrierTypes", 0).fieldDecisions.find((f) => f.key === "QuantitativeCharacteristics").action = "retain-label"; },
    (d) => { record(d, "CarrierTypes", 0).original.GroupId = 0; },
    (d) => { record(d, "TypeRoles", 0).fieldDecisions.find((f) => f.key === "Causality").action = "retain-dictionary-membership"; },
    (d) => { record(d, "ComplexityLevels", 8).disposition = "display-group"; },
    (d) => { record(d, "Ontologicals", 0).status = "empirically-validated"; },
    (d) => { record(d, "InteractionModes", 2).checkIds = []; },
    (d) => { record(d, "InteractionModes", 2).citations = record(d, "InteractionModes", 2).citations.filter((c) => c.role !== "method"); },
    (d) => { record(d, "InteractionModes", 1).citations.find((c) => c.role === "method").locator = "unread theorem"; },
    (d) => { record(d, "DependencyTypes", 3).citations.find((c) => c.role === "method").sourceId = "legacy-dictionaries"; },
    (d) => { d.dictionaryReview.policySha256 = "0".repeat(64); },
    (d) => { d.dictionaryPolicy.quantities.numericalAdmissions = [{ weight: 0.5 }]; }
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => validateCanonicalSource(changed, legacy));
  }
});

test("the census preserves all numerical assertions without confusing dictionary consistency with scientific repair", async () => {
  const census = await loadQuantitativeCensus();
  assert.deepEqual(census.summary, {
    assertionCount: 971, weightCount: 971, numericMinimumCount: 971, numericCriticalCount: 967,
    nullCriticalCount: 4, nullSaturationCount: 971, carrierMismatchCount: 164,
    carrierMismatchNodeCount: 37, carrierMismatchesByLevel: { 0: 16, 1: 0, 2: 4, 3: 1, 4: 0, 5: 143, 6: 0, 7: 0 },
    weightSumAnomalyCount: 3, activeLegacyQuantitativeAdmissions: 0
  });
  assert.deepEqual(census.records.map(({ legacyId, sourceId, pointer }) => ({ legacyId, sourceId, pointer })), data.migration.edges.map(({ legacyId, sourceId, pointer }) => ({ legacyId, sourceId, pointer })));
  for (const record of census.records) {
    const [i, , j] = record.pointer.slice(1).split("/");
    const original = legacy[Number(record.sourceId.slice(7))][Number(i)].Parents[Number(j)];
    assert.deepEqual(record.original, { Weight: original.Weight, Necessity: original.Necessity, Quantization: original.Quantization });
    assert.equal(record.disposition, "withheld-unoperationalized");
    if (record.flags.length) assert.equal(record.carrierDecision, "unresolved-mechanism-review");
  }
  assert.deepEqual(census.weightSumAnomalies.map((r) => r.legacyId), ["0.2", "0.9", "0.18"]);
});

test("vocabulary compilation exposes scoped decisions without importing historical equations, defaults or extra graph nodes", async () => {
  const pack = await buildCanonicalRelease();
  const d = pack.files["model/dictionaries.json"];
  assert.equal(d.vocabulary.length, 112);
  assert.equal(d.vocabulary.filter((r) => r.disposition === "dictionary-only-proposal").length, 6);
  assert.equal(d.vocabulary.filter((r) => r.disposition === "subject-tag").length, 45);
  assert.ok(d.vocabulary.every((r) => r.MathForm === undefined && r.QuantitativeCharacteristics === undefined && r.Causality === undefined));
  assert.equal(pack.files["model/nodes.json"].length, 56);
  assert.equal(pack.files["model/edges.json"].length, 60);
  assert.equal(d.migration.edges.filter((r) => r.status === "internally-reviewed").length, 106);
  assert.deepEqual(d.quantitativeCensus, await loadQuantitativeCensus());
  assert.equal(d.evidence.dictionaryWitnesses.cases.length, 10);
  assert.equal(verifyDictionaryWitnesses().cases.find((c) => c.id === "normalized-weight-not-necessity").example.outcomes.or, 1);
});

test("the preceding routing edition replays after dictionary and compiler evolution", async () => {
  const pack = await buildHistoricalCanonicalRelease("2026.09.12.3");
  assert.equal(pack.manifest.rootHash, "sha256:65b6d0ced1f860551a51a8f956b77ef02570e9fc17791506d884f669420f38cc");
  assert.equal(pack.manifest.source.files.length, 36);
  assert.equal(pack.files["model/dictionaries.json"].vocabulary, undefined);
});
