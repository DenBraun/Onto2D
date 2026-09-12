import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const policyHash = createHash("sha256").update(await readFile(new URL("../../../references/canonical/retinal-policy.json", import.meta.url))).digest("hex");
const dictionaries = JSON.parse(await readFile(new URL("../../../references/descriptions.json", import.meta.url), "utf8"));
const sorted = (values) => [...values].sort();
const coordinates = ({ legacyId, sourceId, pointer }) => ({ legacyId, sourceId, pointer });

/** Enforce traceable curation and preparation boundaries, not the truth of scientific prose. */
export function validateRetinalPilot({ graph, migration, pilot, pilotPolicy, routing }, legacy, { sources, claims, entities, relations }) {
  assert.equal(pilot.policyId, pilotPolicy.id);
  assert.equal(pilot.policySha256, policyHash, "Pilot policy bytes differ");
  const studyRecords = [...pilot.studies, ...routing.studies];
  const studies = new Map(studyRecords.map((s) => [s.id, s]));
  assert.equal(studies.size, studyRecords.length, "Duplicate study");
  const selected = new Set(pilotPolicy.legacyNodeIds);
  const expected = { nodes: [], evidence: [], edges: [] };
  const originals = new Map();
  for (const [level, nodes] of legacy.entries()) for (const [i, node] of nodes.entries()) {
    const legacyId = `${level}.${node.Id}`;
    if (!selected.has(legacyId)) continue;
    const sourceId = `legacy-${level}`;
    expected.nodes.push({ legacyId, sourceId, pointer: `/${i}` });
    originals.set(`${sourceId}:/${i}`, node);
    node.Evidence.forEach((e, j) => {
      expected.evidence.push({ legacyId, sourceId, pointer: `/${i}/Evidence/${j}` });
      originals.set(`${sourceId}:/${i}/Evidence/${j}`, e);
    });
    node.Parents.forEach((e, j) => {
      expected.edges.push({ legacyId: `${e.ParentCode}->${legacyId}`, sourceId, pointer: `/${i}/Parents/${j}` });
      originals.set(`${sourceId}:/${i}/Parents/${j}`, e);
    });
  }
  for (const [records, expectedRecords] of [[pilot.nodeReviews, expected.nodes], [pilot.evidenceReviews, expected.evidence], [pilot.edgeReviews, expected.edges]]) {
    assert.deepEqual(records.map(coordinates), expectedRecords, "Incomplete pilot source accounting");
    assert.equal(new Set(records.map((r) => r.id)).size, records.length, "Duplicate pilot review ID");
    for (const r of records) assert.deepEqual(r.original, originals.get(`${r.sourceId}:${r.pointer}`), `Pilot changed original ${r.id}`);
  }
  assert.deepEqual(sorted(graph.scope.reviewedLegacyNodeIds), sorted(migration.nodes.filter((n) => n.status !== "pending-scientific-review").map((n) => n.legacyId)), "Scope differs from reviewed node accounting");
  for (const [level, nodes] of legacy.entries()) {
    const count = nodes.filter((n) => graph.scope.reviewedLegacyNodeIds.includes(`${level}.${n.Id}`)).length;
    const key = count === nodes.length ? "reviewedLegacyLevels" : count ? "partiallyReviewedLegacyLevels" : "pendingLegacyLevels";
    assert.ok(graph.scope[key].includes(level), `Incorrect review coverage for level ${level}`);
  }
  for (const s of studies.values()) {
    const source = sources.get(s.sourceId);
    assert.equal(s.id, s.sourceId);
    assert.equal(source?.kind, "research-publication", `Missing pilot publication ${s.id}`);
    assert.equal(source.doi, s.doi, `Study DOI differs ${s.id}`);
    assert.equal(source.review.extent, s.readExtent);
    assert.deepEqual(source.review.locators, s.reviewedLocators);
  }
  const admittedStatuses = new Set(["publication-supported", "literature-synthesis"]);
  for (const c of claims.values()) {
    if (admittedStatuses.has(c.status)) assert.ok(c.contextIds?.length, `Published claim lacks study context ${c.id}`);
    if (!c.contextIds) continue;
    for (const id of c.contextIds) {
      const s = studies.get(id);
      assert.equal(s?.studyType, "primary-experiment", `Claim context is not a primary experiment ${c.id}: ${id}`);
      assert.ok(c.citations.some((ref) => ref.sourceId === s.sourceId && s.reviewedLocators.includes(ref.locator)), `Unreviewed or missing study locator ${c.id}: ${id}`);
    }
    if (admittedStatuses.has(c.status)) {
      assert.ok(c.citations.some((ref) => ref.role === "supports" && c.contextIds.includes(ref.sourceId)), `Publication support missing ${c.id}`);
      if (c.contextIds.length > 1) assert.equal(c.status, "literature-synthesis", `Multiple preparations presented as one experiment ${c.id}`);
    }
  }
  for (const r of pilot.nodeReviews) {
    assert.deepEqual(sorted(Object.keys(r.fieldDispositions)), sorted(Object.keys(r.original)), `Missing field disposition ${r.id}`);
    assert.deepEqual(r.targetIds, migration.nodes.find((n) => n.legacyId === r.legacyId).targetIds);
    for (const id of r.claimIds) assert.ok(claims.has(id) && r.targetIds.some((t) => entities.get(t)?.claimIds.includes(id)), `Unbound node-review claim ${id}`);
  }
  for (const r of pilot.evidenceReviews) {
    assert.equal(r.resolvedSourceId === null, r.disposition === "unidentified-original-replaced-with-scoped-evidence", `Fabricated original identity ${r.id}`);
    if (r.resolvedSourceId) assert.ok(studies.has(r.resolvedSourceId), `Unknown resolved source ${r.id}`);
    for (const id of r.replacementSourceIds) assert.equal(studies.get(id)?.studyType, "primary-experiment", `Replacement is not primary ${r.id}`);
    for (const id of r.claimIds) assert.ok(claims.has(id), `Unknown evidence claim ${id}`);
    for (const sid of r.replacementSourceIds) assert.ok(r.claimIds.some((id) => claims.get(id).citations.some((ref) => ref.sourceId === sid)), `Unbound replacement source ${r.id}: ${sid}`);
  }
  for (const [i, r] of pilot.edgeReviews.entries()) {
    const quantization = r.original.Quantization;
    const expectedGroup = dictionaries.CarrierTypes.find((t) => t.Id === quantization.CarrierTypeId)?.GroupId;
    assert.ok(Number.isInteger(expectedGroup), `Unknown pilot carrier ${r.id}`);
    const flags = ["weight-without-calibration", "necessity-without-contextual-test", "thresholds-without-counting-contract"];
    if (quantization.CarrierGroupId !== expectedGroup) flags.push("carrier-group-type-mismatch");
    if (r.original.DependencyType === 11) flags.push("transport-label-without-specified-mechanism");
    assert.deepEqual(r.quantitativeFindings, { expectedCarrierGroupId: expectedGroup, flags }, `Incorrect pilot quantitative audit ${r.id}`);
    const c = claims.get(r.claimId);
    assert.ok(c?.citations.some((ref) => ref.sourceId === r.sourceId && ref.locator === r.pointer), `Missing exact assertion citation ${r.id}`);
    assert.ok(c.citations.some((ref) => ref.sourceId === "retinal-review" && ref.locator === `/edgeReviews/${i}`), `Missing decision citation ${r.id}`);
    assert.ok(c.contextIds?.length, `Decision lacks reviewed study contexts ${r.id}`);
    if (r.decision === "withhold") {
      assert.deepEqual(r.targetRelationIds, [], `Withheld edge promoted ${r.id}`);
      assert.equal(r.endpointBinding, null);
      assert.equal(c.status, "unresolved");
      continue;
    }
    assert.equal(r.targetRelationIds.length, 1, `Scoped edge lacks a single explicit replacement ${r.id}`);
    const relation = relations.get(r.targetRelationIds[0]);
    assert.equal(relation?.legacyReviewId, r.id);
    assert.ok(relation.claimIds.includes(r.claimId));
    assert.equal(relation.source, r.endpointBinding?.sourceEntityId);
    assert.equal(relation.target, r.endpointBinding?.targetEntityId);
    const [parent, child] = r.legacyId.split("->");
    assert.ok(entities.get(relation.target)?.legacyCodes.includes(child), `Changed pilot target ${r.id}`);
    if (selected.has(parent)) {
      assert.equal(r.endpointBinding.sourceMapping, "reviewed-concept");
      assert.ok(entities.get(relation.source)?.legacyCodes.includes(parent), `Changed pilot source ${r.id}`);
    } else {
      assert.equal(r.endpointBinding.sourceMapping, "boundary-specialization");
      assert.deepEqual(entities.get(relation.source)?.legacyCodes, [], "A boundary context must not silently review an entire legacy parent");
      assert.equal(migration.nodes.find((n) => n.legacyId === parent)?.status, "pending-scientific-review");
    }
    if (relation.kind === "descriptive") assert.equal(c.status, "definition");
    else assert.ok(admittedStatuses.has(c.status), `Unsupported operating assertion ${r.id}`);
  }
  for (const r of relations.values()) {
    if (!r.id.startsWith("retinal:")) {
      assert.equal(r.kind, "descriptive", "This pilot does not promote Level-0 definitions to physical support");
      continue;
    }
    assert.ok(r.source.startsWith("ret:") && r.target.startsWith("ret:"), "No empirical Level-0 bridge has been admitted");
    assert.ok(r.contextIds?.length, `Relation lacks contexts ${r.id}`);
    const supported = r.claimIds.filter((id) => r.kind === "descriptive" ? claims.get(id).status === "definition" : admittedStatuses.has(claims.get(id).status));
    assert.ok(supported.length, `Relation lacks an appropriate claim ${r.id}`);
    for (const id of r.contextIds) assert.ok(supported.some((cid) => claims.get(cid).contextIds?.includes(id)), `Relation context is not supported ${r.id}`);
    for (const cid of supported) assert.deepEqual(sorted(claims.get(cid).contextIds), sorted(r.contextIds), `Relation drops claim context ${r.id}`);
  }
  for (const e of entities.values()) {
    if (!e.id.startsWith("ret:")) { assert.equal(e.level, 0); continue; }
    if (e.status === "evidence-scoped") assert.ok(e.claimIds.some((id) => admittedStatuses.has(claims.get(id).status)), `Entity lacks scoped evidence ${e.id}`);
  }
  for (const c of pilot.comparisons) {
    for (const id of c.sourceIds) assert.equal(studies.get(id)?.studyType, "primary-experiment");
    if (c.result !== "not-tested") assert.ok(c.sourceIds.length, "Comparison result lacks evidence");
  }
  for (const [id, file] of [["retinal-review", "retinal-review.json"], ["retinal-policy", "retinal-policy.json"]]) assert.equal(sources.get(id)?.path, `references/canonical/${file}`);
}
