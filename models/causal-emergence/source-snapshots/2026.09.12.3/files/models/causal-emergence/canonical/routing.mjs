import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const policyHash = createHash("sha256").update(await readFile(new URL("../../../references/canonical/routing-policy.json", import.meta.url))).digest("hex");
const sorted = (values) => [...values].sort();
function index(records, name) {
  const map = new Map(records.map((r) => [r.id, r]));
  assert.equal(map.size, records.length, `Duplicate routing ${name}`);
  return map;
}

/** A complete comparison protocol must cover every edge. This is evidence lookup,
 * not a simulator, a causal identification test, or evidence for unreviewed paths. */
export function commonExperimentalContexts(relations, relationIds) {
  const byId = index(relations, "relation");
  assert.ok(relationIds.length, "An evidence path must contain a relation");
  assert.equal(new Set(relationIds).size, relationIds.length, "Repeated path relation");
  const path = relationIds.map((id) => {
    assert.ok(byId.has(id), `Unknown path relation ${id}`);
    return byId.get(id);
  });
  for (let i = 1; i < path.length; i++) assert.equal(path[i - 1].target, path[i].source, "Disconnected evidence path");
  return sorted((path[0].experimentalContextIds ?? []).filter((id) => path.every((r) => r.experimentalContextIds?.includes(id))));
}

/** Validate provenance and scope bindings; scientific prose still needs review. */
export function validateRoutingReview({ graph, routing, routingPolicy }, { sources, claims, entities, relations }) {
  assert.equal(routing.policySha256, policyHash, "Routing policy bytes differ");
  assert.equal(routing.policyId, routingPolicy.id);
  const contexts = index(routing.contexts, "context");
  const reviews = index(routing.reviews, "review");
  const studies = index(routing.studies, "study");
  const expectedIds = routingPolicy.cases.map((c) => c.id);
  assert.deepEqual([...contexts.keys()], expectedIds, "Incomplete routing contexts");
  assert.deepEqual(routing.reviews.map((r) => r.contextId), expectedIds, "Incomplete routing adjudications");
  assert.deepEqual(routing.measurements.map((m) => m.contextId), routingPolicy.cases.filter((c) => c.dataCells).map((c) => c.id), "Incomplete routing measurements");
  assert.deepEqual([...studies.keys()], [...new Set(routingPolicy.cases.map((c) => c.studyId))]);
  assert.deepEqual(routing.retrievals.map((r) => r.studyId), [...studies.keys()], "Missing article retrieval record");
  for (const [i, c] of routingPolicy.cases.entries()) {
    const ctx = contexts.get(c.id);
    const review = routing.reviews[i];
    const claim = claims.get(c.claimId);
    const relation = relations.get(c.relationId);
    assert.equal(ctx.studyId, c.studyId, "Routing publication changed");
    assert.equal(ctx.organismGroup, c.organismGroup, "Routing species changed");
    assert.equal(ctx.cellType, c.cellType, "Routing cell class changed");
    assert.equal(ctx.stimulus.kind, c.stimulusKind, "Routing stimulus changed");
    for (const field of ["wavelengthNm", "frequencyHz", "durationSeconds"]) assert.equal(ctx.stimulus[field], c[field], `Unreviewed routing stimulus parameter ${field}`);
    assert.deepEqual(ctx.stimulus.light, { role: c.lightRole, value: c.lightValue, nominalValue: c.nominalValue, unit: "R*/rod/s" }, "Routing light quantity changed");
    for (const locator of ctx.reviewedLocators) assert.ok(studies.get(c.studyId).reviewedLocators.includes(locator), "Unreviewed experimental locator");
    assert.equal(review.claimId, c.claimId);
    assert.equal(review.relationId, c.relationId);
    assert.equal(claim?.status, "publication-supported");
    assert.deepEqual(claim.contextIds, [c.studyId]);
    assert.deepEqual(claim.experimentalContextIds, [c.id], "Claim merges or drops experimental contexts");
    assert.equal(claim.statement, `${review.observation} ${review.inference}`, "Claim differs from routing decision");
    assert.deepEqual(claim.limitations, review.limitations, "Routing claim drops limitations");
    assert.deepEqual(ctx.limitations, studies.get(c.studyId).limitations, "Experimental context drops study limitations");
    assert.deepEqual(review.limitations, ctx.limitations, "Routing decision drops context limitations");
    assert.ok(claim.citations.some((ref) => ref.sourceId === "routing-review" && ref.locator === `/reviews/${i}`), "Missing route decision citation");
    assert.ok(claim.citations.some((ref) => ref.sourceId === c.studyId && ref.role === "supports" && ctx.reviewedLocators.includes(ref.locator)), "Missing experimental support citation");
    assert.equal(relation?.kind, "functional-support");
    assert.equal(relation.legacyReviewId, null, "New bridge must not silently review a historical assertion");
    for (const endpoint of [relation.source, relation.target]) {
      assert.deepEqual(entities.get(endpoint)?.legacyCodes, [], "Routing boundary silently reviews a legacy card");
      assert.ok(entities.get(endpoint).claimIds.includes(claim.id), "Routing endpoint lacks its claim");
    }
    assert.deepEqual(review.candidates.map((r) => r.routeId), routing.routes.map((r) => r.id), "Incomplete route alternatives");
    for (const candidate of review.candidates) if (candidate.status !== "not-resolved") assert.ok(c.identifiableRouteIds.includes(candidate.routeId), "Contrast cannot identify this route separately");
    const nonPrimary = review.candidates.find((r) => r.routeId === "non-primary-off");
    const secondary = review.candidates.find((r) => r.routeId === "secondary-off");
    const tertiary = review.candidates.find((r) => r.routeId === "tertiary-off");
    if ([secondary, tertiary].some((r) => r.status !== "not-resolved")) assert.notEqual(nonPrimary.status, "not-resolved", "Resolved member without its inclusive-OR candidate");
    if (c.dataCells) {
      const measurement = routing.measurements.find((m) => m.contextId === c.id);
      assert.equal(measurement.intensityCell, c.dataCells.intensity);
      assert.equal(measurement.ratioCell, c.dataCells.ratio);
      assert.equal(measurement.intensity, c.lightValue);
      assert.ok(claim.citations.some((ref) => ref.sourceId === measurement.datasetId && ref.locator === `Sheet1!${measurement.intensityCell},${measurement.ratioCell}`), "Missing exact data-cell citation");
    }
  }
  const expectedRelations = [...new Set(routingPolicy.cases.map((c) => c.relationId))];
  assert.deepEqual(graph.relations.filter((r) => r.id.startsWith("retinal:routing-")).map((r) => r.id), expectedRelations, "Unreviewed routing bridge");
  for (const id of expectedRelations) {
    const cases = routingPolicy.cases.filter((c) => c.relationId === id);
    const relation = relations.get(id);
    assert.deepEqual(relation.claimIds, cases.map((c) => c.claimId));
    assert.deepEqual(relation.experimentalContextIds, cases.map((c) => c.id), "Relation drops or merges a routing context");
    assert.deepEqual(relation.contextIds, [...new Set(cases.map((c) => c.studyId))]);
  }
  for (const r of relations.values()) if (r.experimentalContextIds || r.claimIds.some((id) => claims.get(id)?.experimentalContextIds)) assert.ok(expectedRelations.includes(r.id), "Unreviewed relation borrows experimental scope");
  for (const c of claims.values()) if (c.experimentalContextIds) assert.ok(routingPolicy.cases.some((r) => r.claimId === c.id), "Unreviewed claim borrows experimental scope");
  for (const [id, file] of [["routing-review", "routing-review.json"], ["routing-policy", "routing-policy.json"]]) assert.equal(sources.get(id)?.path, `references/canonical/${file}`);
  assert.equal(sources.get("grimes2018-fig6-data")?.path, "references/canonical/data/elife-38281-fig6-data1-v2.xlsx");
  assert.equal(reviews.size, contexts.size);
}
