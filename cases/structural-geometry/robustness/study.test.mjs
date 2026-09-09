import assert from "node:assert/strict";
import test from "node:test";
import { digest, normalizeGraph } from "../datasets/scopes.mjs";
import { evaluateRows } from "../dream4/evaluation.mjs";
import { pairCoordinates } from "../dream4/geometry.mjs";
import { evaluateNullStudy, runReplicate, scopeId, targetValues } from "./study.mjs";
import { reference } from "./io.mjs";
import { summarizeReplicate, targetSummary, validateReplicate } from "./report.mjs";
import { labelledConstraints } from "./nulls.mjs";

function fixture() {
  const originals = [], rows = [];
  for (let i = 0; i < 5; i++) {
    const source = `S${i}`, id = scopeId("Dataset7", source), nodes = [source, "T0", "T1", "T2"];
    const graph = normalizeGraph({ nodes, edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 0]].map(([a, b]) => ({ source: nodes[a], target: nodes[b] })) });
    originals.push({ id, datasetId: "Dataset7", root: source, graph, originalGraphSha256: digest(graph) });
    for (let j = 0; j < 3; j++) rows.push({ id: JSON.stringify([source, `T${j}`]), groupId: source,
      interventionId: `intervention-${source}`, source, target: `T${j}`, eligible: true,
      magnitude: (j + i) % 3 + 1, y: ((j + i) % 3) / 2 });
  }
  const q = { numerator: "1", denominator: "1" };
  const scopes = originals.map(original => ({ id: original.id, sampled: { status: "complete" }, measured: { status: "complete",
    geometry: pairCoordinates(original.graph, original.graph.edges.map(() => ({ forman: q, ollivier: q, length: q, curvature: q })),
      { reason: "iteration-limit", iteration: 4 }) } }));
  const target = { id: "celegans-Dataset7", rows };
  const original = evaluateNullStudy(target, scopes).report;
  return { originals, targets: [{ ...target, original }], sourceFiles: [], scopes };
}

test("required null failures preserve the complete original population and yield no partial score", () => {
  const { targets: [target], scopes } = fixture();
  scopes[2].sampled = { status: "unavailable", reason: "swap-target-not-reached" };
  scopes[2].measured = { status: "not-run", reason: "sampling-unavailable" };
  const actual = evaluateNullStudy(target, scopes);
  assert.equal(actual.status, "unavailable"); assert.equal(actual.trace, null); assert.equal(actual.report, null);
  assert.deepEqual(actual.failures, [{ id: scopes[2].id, phase: "sampling", reason: "swap-target-not-reached" }]);
  assert.equal(target.rows.length, 15);
  assert.throws(() => evaluateNullStudy(target, scopes.slice(1)), /retained/);
});

test("non-target context failures remain visible without deleting or redefining target-bearing folds", () => {
  const { targets: [target], scopes } = fixture();
  const result = evaluateNullStudy(target, [...scopes, { id: scopeId("Dataset7", "context"),
    sampled: { status: "unavailable", reason: "swap-target-not-reached" }, measured: { status: "not-run" } }]);
  assert.equal(result.status, "complete"); assert.deepEqual(targetValues(result.trace.rows), target.rows);
  assert.deepEqual(result.report, target.original);
  assert.equal(result.trace.folds.length, 5);
});

test("missing pair geometry fails before fitting and numerical failure cannot acquire a fallback", () => {
  const { targets: [target], scopes } = fixture();
  const incomplete = structuredClone(scopes); incomplete[0].measured.geometry.pairs = [];
  assert.throws(() => evaluateNullStudy(target, incomplete), /every original eligible pair/);
  const malformed = structuredClone(scopes); malformed[0].measured.geometry.pairs.forEach(row => { row.geometry[0] = Infinity; });
  const result = evaluateNullStudy(target, malformed);
  assert.equal(result.reason, "required-null-model-computation-failed"); assert.equal(result.report, null); assert.equal(result.trace, null);
});

test("complete synthetic null geometry and nested models agree with independent references and reject altered targets", async () => {
  const sources = fixture(), { details } = await runReplicate(sources, 3);
  assert.equal(details.studies[0].status, "complete");
  const payload = { originals: sources.originals, targets: sources.targets.map(({ id, rows }) => ({ id, rows })), details };
  const independent = (await reference(payload)).result;
  assert.equal(independent.nullScopesChecked, 5); assert.equal(independent.distinctReferenceFits, 330);
  const rep = summarizeReplicate(details, independent, "0".repeat(64));
  const originals = sources.originals.map(({ graph, ...row }) => ({ ...row, nodeCount: graph.nodes.length, edgeCount: graph.edges.length,
    constraintsSha256: digest(labelledConstraints(graph)) }));
  validateReplicate(rep, originals, sources.targets.map(targetSummary));
  const altered = structuredClone(payload); altered.details.studies[0].trace.rows[0].magnitude += 1;
  await assert.rejects(reference(altered), /Original target identities/);
  const geometry = structuredClone(payload); geometry.details.scopes[0].measured.geometry.pairs[0].geometry[0] += 1;
  await assert.rejects(reference(geometry), /pair geometry differs/);
  const baseline = evaluateRows(details.studies[0].trace.rows).report;
  assert.deepEqual(baseline, details.studies[0].report);
});
