import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyDictionaryWitnesses } from "./dictionary-witnesses.mjs";

const requiredChecks = new Map([
  ["InteractionModes:0", ["cubic-sign"]],
  ["InteractionModes:1", ["inactive-inequality"]],
  ["InteractionModes:2", ["feedback-sign", "time-domain", "unit-circle-boundary"]],
  ["CausalDirections:2", ["horizontal-asymmetry"]],
  ["CausalDirections:3", ["stable-cross-level-loop"]],
  ["CarrierGroups:3", ["cycle-count-unit"]],
  ["CarrierGroups:4", ["token-individuation"]],
  ["CarrierTypes:10", ["cycle-count-unit"]],
  ["CarrierTypes:11", ["token-individuation"]]
]);

/** Completeness, provenance and admission checks; not machine verification of prose. */
export function validateDictionaryReview(data, originals, policyBytes) {
  const { dictionaryReview: review, dictionaryPolicy: policy, graph } = data;
  assert.equal(review.policyId, policy.id);
  assert.equal(review.policySha256, createHash("sha256").update(policyBytes).digest("hex"), "Dictionary policy bytes differ");
  assert.deepEqual(policy.groups, Object.fromEntries(Object.entries(originals).map(([g, rs]) => [g, rs.length])));
  const expected = Object.entries(originals).flatMap(([group, records]) => records.map((original, i) => ({
    id: `dict:${group}:${original.Id}`, group, legacyId: original.Id, pointer: `/${group}/${i}`, original
  })));
  assert.deepEqual(review.records.map(({ id, group, legacyId, pointer, original }) => ({ id, group, legacyId, pointer, original })), expected, "Dictionary identity, order, coverage or original bytes changed");
  const sources = new Map(graph.sources.map((s) => [s.id, s]));
  const witnesses = new Set(verifyDictionaryWitnesses().cases.map((c) => c.id));
  for (const record of review.records) {
    assert.deepEqual(record.fieldDecisions.map((f) => f.key), Object.keys(record.original), `Incomplete field decisions ${record.id}`);
    for (const field of record.fieldDecisions) {
      assert.equal(field.action, policy.fieldActions[field.key] ?? policy.defaultFieldAction, `Unauthorized field promotion ${record.id}/${field.key}`);
    }
    const expectedDisposition = record.group === "ComplexityLevels"
      ? record.legacyId >= 8 ? "dictionary-only-proposal" : "display-group"
      : record.group === "Ontologicals" ? "subject-tag" : "scoped-definition";
    assert.equal(record.disposition, expectedDisposition, `Unsupported dictionary status ${record.id}`);
    const checks = record.group === "DependencyTypes" ? ["normalized-weight-not-necessity"] : requiredChecks.get(`${record.group}:${record.legacyId}`) ?? [];
    assert.deepEqual(record.checkIds, checks, `Dictionary counterexample binding differs ${record.id}`);
    assert.ok(record.citations.some((c) => c.sourceId === "legacy-dictionaries" && c.locator === record.pointer && c.role === "original-assertion"), `Missing original dictionary citation ${record.id}`);
    const methodId = ["CarrierGroups", "CarrierTypes"].includes(record.group) ? "vim2012"
      : record.group === "DependencyTypes" && record.legacyId === 3 ? "iupac-catalyst"
      : record.group === "InteractionModes" && record.legacyId === 1 ? "boyd2004"
      : record.group === "InteractionModes" && record.legacyId === 2 ? "astrom2008"
      : record.group === "CausalDirections" && [0, 1, 4].includes(record.legacyId) ? "rubenstein2017" : null;
    if (methodId) assert.ok(record.citations.some((c) => c.sourceId === methodId && c.role === "method"), `Missing reviewed method ${record.id}`);
    for (const citation of record.citations) {
      const source = sources.get(citation.sourceId);
      assert.ok(source, `Unknown dictionary source ${citation.sourceId}`);
      if (citation.role === "original-assertion") assert.ok(citation.sourceId === "legacy-dictionaries" && citation.locator === record.pointer);
      if (citation.role === "method") {
        assert.equal(source.kind, "research-publication", `Dictionary method source is not a publication ${record.id}`);
        assert.ok(source.review.locators.includes(citation.locator), `Unreviewed dictionary method locator ${record.id}`);
      }
      if (citation.role === "counterexample") assert.ok(citation.sourceId === "dictionary-witnesses" && checks.length > 0 && citation.locator === checks.join(", "), `Invalid witness citation ${record.id}`);
    }
    for (const check of checks) {
      assert.ok(witnesses.has(check), `Unknown dictionary witness ${check}`);
      assert.ok(record.citations.some((c) => c.role === "counterexample"), `Uncited witness ${record.id}`);
    }
    if (record.group === "CarrierTypes") assert.ok(originals.CarrierGroups.some((g) => g.Id === record.original.GroupId), `Unknown carrier group ${record.id}`);
  }
  // No shortcut from vocabulary or historic quantities into executable graph semantics.
  const dictionaryIds = new Set(expected.map((r) => r.id));
  assert.ok(graph.entities.every((e) => !dictionaryIds.has(e.id)), "A dictionary record cannot silently become a physical entity");
  return review;
}

/** Reproducible accounting only; this function makes no scientific edge decision. */
export function buildQuantitativeCensus(legacyLevels, dictionaries) {
  const types = new Map(dictionaries.CarrierTypes.map((t) => [t.Id, t]));
  const records = [];
  const weightSumAnomalies = [];
  for (const [level, nodes] of legacyLevels.entries()) for (const [i, node] of nodes.entries()) {
    const childId = `${node.Level}.${node.Id}`;
    const weightSum = node.Parents.reduce((sum, p) => sum + p.Weight, 0);
    if (node.Parents.length && Math.abs(weightSum - 1) > 1e-9) weightSumAnomalies.push({ legacyId: childId, sourceId: `legacy-${level}`, pointer: `/${i}/Parents`, sum: weightSum });
    for (const [j, parent] of node.Parents.entries()) {
      const q = parent.Quantization;
      const type = types.get(q.CarrierTypeId);
      assert.ok(type, `Unresolved carrier dictionary ID for ${childId}`);
      const mismatch = type.GroupId !== q.CarrierGroupId;
      records.push({
        legacyId: `${parent.ParentCode}->${childId}`, sourceId: `legacy-${level}`, pointer: `/${i}/Parents/${j}`,
        original: { Weight: parent.Weight, Necessity: parent.Necessity, Quantization: structuredClone(q) },
        disposition: "withheld-unoperationalized",
        expectedCarrierGroupId: type.GroupId,
        flags: mismatch ? ["carrier-group-type-mismatch"] : [],
        carrierDecision: mismatch ? "unresolved-mechanism-review" : "dictionary-consistent-mechanism-unverified"
      });
    }
  }
  const mismatches = records.filter((r) => r.flags.length);
  const numericCount = (key) => records.filter((r) => typeof r.original.Quantization[key] === "number").length;
  return {
    id: "legacy-quantitative-census-v1",
    scope: "Mechanical census of all original parent assertions. This is not additional node or relation scientific-review coverage.",
    summary: {
      assertionCount: records.length, weightCount: records.length,
      numericMinimumCount: numericCount("N_min"), numericCriticalCount: numericCount("N_crit"),
      nullCriticalCount: records.length - numericCount("N_crit"), nullSaturationCount: records.filter((r) => r.original.Quantization.N_sat === null).length,
      carrierMismatchCount: mismatches.length,
      carrierMismatchNodeCount: new Set(mismatches.map((r) => r.legacyId.split("->")[1])).size,
      carrierMismatchesByLevel: Object.fromEntries(legacyLevels.map((_, level) => [level, mismatches.filter((r) => r.sourceId === `legacy-${level}`).length])),
      weightSumAnomalyCount: weightSumAnomalies.length,
      activeLegacyQuantitativeAdmissions: 0
    },
    weightSumAnomalies, records,
    limit: "The expected group is a dictionary lookup, not a scientifically corrected carrier selection. Unknown values retain null; no unit, threshold, weight, necessity or uncertainty is inferred. Existing retinal observations remain separately scoped."
  };
}

export function compileVocabulary(review, sources) {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  return review.records.map((r) => ({
    id: r.id, group: r.group, legacyId: r.legacyId, name: r.original.Name,
    definition: r.definition, finding: r.finding, disposition: r.disposition, status: r.status,
    sourcePointer: r.pointer, checkIds: r.checkIds,
    citations: r.citations.map((c) => ({ ...c, source: sourceById.get(c.sourceId) }))
  }));
}
