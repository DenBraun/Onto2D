import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const json = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), "utf8"));
const schema = await json("references/canonical/schema.json");
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
const CHECK_IDS = new Set([
  "operator-sign", "stationarity-not-minimum", "simple-cycle-minimum",
  "balance-not-localization", "objecthood-negative"
]);

function index(records, subject) {
  const result = new Map();
  for (const record of records) {
    assert.ok(!result.has(record.id), `Duplicate ${subject}: ${record.id}`);
    result.set(record.id, record);
  }
  return result;
}

/** Structural/scientific-status contract, not automatic validation of prose. */
export function validateCanonicalSource(data, legacyLevels) {
  assert.ok(validate(data), `Canonical source schema: ${JSON.stringify(validate.errors)}`);
  const { graph, migration } = data;
  const sources = index(graph.sources, "source");
  const claims = index(graph.claims, "claim");
  const entities = index(graph.entities, "entity");
  index([...graph.entities, ...graph.rules], "graph node");
  assert.equal(migration.toVersion, graph.model.version, "Migration target version differs");
  const levels = [...graph.scope.reviewedLegacyLevels, ...graph.scope.pendingLegacyLevels];
  assert.deepEqual(levels.toSorted((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7], "Scope must partition the legacy levels");
  for (const source of sources.values()) {
    assert.equal(source.path === null, source.sha256 === null, `Unbound source ${source.id}`);
    assert.ok(source.path || source.url, `Source has no retrievable location: ${source.id}`);
    if (source.kind === "research-publication") assert.ok(source.url && source.authors.length && Number.isInteger(source.year), `Missing publication metadata: ${source.id}`);
  }
  for (const claim of claims.values()) {
    for (const citation of claim.citations) assert.ok(sources.has(citation.sourceId), `Unknown citation ${citation.sourceId}`);
    for (const check of claim.checkIds) assert.ok(CHECK_IDS.has(check), `Unknown check ${check}`);
    if (claim.status === "analytically-checked") {
      assert.ok(claim.checkIds.some((id) => id !== "objecthood-negative"), `Analytical claim lacks a witness: ${claim.id}`);
      assert.ok(claim.citations.some((c) => c.sourceId === "witnesses" && c.role === "supports"), `Analytical claim lacks executable evidence: ${claim.id}`);
    }
    if (claim.status === "case-negative") {
      assert.ok(claim.checkIds.includes("objecthood-negative"), `Negative claim lacks case check: ${claim.id}`);
      assert.ok(claim.citations.some((c) => c.sourceId === "level-zero-v3" && c.role === "supports"), `Negative claim lacks case evidence: ${claim.id}`);
    }
    if (claim.kind === "method") assert.ok(claim.citations.some((c) => c.role === "method" && sources.get(c.sourceId).kind === "research-publication"), `Method lacks publication: ${claim.id}`);
  }
  for (const entity of entities.values()) {
    for (const id of entity.claimIds) assert.ok(claims.has(id), `Unknown entity claim ${id}`);
    for (const coord of entity.sourceCoordinates) assert.ok(sources.has(coord.sourceId), `Unknown coordinate source ${coord.sourceId}`);
    if (entity.kind.includes("class")) assert.equal(entity.status, "class-uninstantiated", "This source contract does not admit physical instances");
  }
  for (const rule of graph.rules) {
    const inputIds = new Set();
    for (const input of rule.inputs) {
      assert.ok(entities.has(input.entityId), `Unknown premise ${input.entityId}`);
      assert.ok(!inputIds.has(input.entityId), `Duplicate premise ${input.entityId}`);
      inputIds.add(input.entityId);
      assert.ok(input.maxCount === null || input.maxCount >= input.minCount, `Inverted multiplicity ${rule.id}`);
      if (input.minCount > 1) assert.ok(input.distinct && input.role === "candidate-instances", `Missing distinct-instance semantics ${rule.id}`);
    }
    for (const id of rule.outputEntityIds) assert.ok(entities.has(id) && !inputIds.has(id), `Invalid conclusion ${id}`);
    for (const id of rule.claimIds) assert.ok(claims.has(id), `Unknown rule claim ${id}`);
  }
  const expectedNodes = [];
  const expectedEdges = [];
  legacyLevels.forEach((nodes, level) => nodes.forEach((node, i) => {
    const id = `${node.Level}.${node.Id}`;
    expectedNodes.push({ legacyId: id, sourceId: `legacy-${level}`, pointer: `/${i}` });
    node.Parents.forEach((edge, j) => expectedEdges.push({
      legacyId: `${edge.ParentCode}->${id}`, sourceId: `legacy-${level}`, pointer: `/${i}/Parents/${j}`
    }));
  }));
  for (const [records, expected, type] of [[migration.nodes, expectedNodes, "nodes"], [migration.edges, expectedEdges, "edges"]]) {
    assert.deepEqual(records.map(({ legacyId, sourceId, pointer }) => ({ legacyId, sourceId, pointer })), expected, `Incomplete legacy ${type} accounting`);
    for (const record of records) {
      assert.ok(sources.has(record.sourceId), `Unknown migration source ${record.sourceId}`);
      if (type === "edges" || record.status === "pending-scientific-review") assert.deepEqual(record.targetIds, [], "Pending records cannot silently become canonical relations");
      else {
        assert.ok(record.targetIds.length > 0, "Reinterpreted node lacks targets");
        assert.ok(graph.scope.reviewedLegacyLevels.includes(Number(record.legacyId.split(".")[0])), "Mapping outside reviewed scope");
        for (const id of record.targetIds) assert.ok(entities.get(id)?.legacyCodes.includes(record.legacyId), `Nonreciprocal mapping ${id}`);
      }
    }
  }
  for (const entity of entities.values()) for (const id of entity.legacyCodes) {
    assert.ok(migration.nodes.find((m) => m.legacyId === id)?.targetIds.includes(entity.id), `Missing reverse mapping ${id}`);
  }
  return data;
}

export async function loadCanonicalSource() {
  const [graph, migration, ...legacyLevels] = await Promise.all([
    json("references/canonical/graph.json"), json("references/canonical/migration.json"),
    ...Array.from({ length: 8 }, (_, i) => json(`references/level-${i}.json`))
  ]);
  const data = validateCanonicalSource({ graph, migration }, legacyLevels);
  await Promise.all(graph.sources.filter((s) => s.path).map(async (source) => {
    const bytes = await readFile(path.join(ROOT, source.path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, `Source bytes changed: ${source.path}; review before rebinding`);
  }));
  return data;
}

export async function verifyCanonicalEvidence() {
  const result = spawnSync("python3", ["models/causal-emergence/reconstruction/verify.py"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, `Foundation witnesses failed: ${result.error ?? result.stderr}`);
  const witnesses = JSON.parse(result.stdout);
  const artifact = await json("cases/level-0-oscillator/artifacts/level-zero-validation-v3.json");
  assert.equal(artifact.conclusion.declaredModelLevelZeroValidated, false, "Objecthood disposition changed: reassess the canonical claims and gates");
  assert.equal(artifact.conclusion.empiricalValidationClaimed, false);
  assert.equal(artifact.conclusion.declaredCaseExecutionComplete, true);
  return {
    mathematicalWitnesses: witnesses.mathematicalWitnesses,
    objecthoodConclusion: artifact.conclusion,
    limit: "Replayed finite mathematical witnesses and checked the bound case disposition. This build does not rerun the nonlinear solver or independently validate scientific prose."
  };
}
