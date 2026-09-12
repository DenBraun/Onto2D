import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalize, hashArtifactBytes, hashCanonical } from "@onto2d/kernel";
import { buildModelPack, verifyModelPack } from "@onto2d/model-pack";
import { ROOT, loadCanonicalSource, verifyCanonicalEvidence } from "./source.mjs";

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function compileCanonicalGraph({ graph, migration }, evidence, sourceFiles) {
  const claims = new Map(graph.claims.map((c) => [c.id, c]));
  const sources = new Map(graph.sources.map((s) => [s.id, s]));
  function rationale(ids) {
    return ids.map((id) => {
      const claim = claims.get(id);
      return { ...claim, citations: claim.citations.map((c) => ({ ...c, source: sources.get(c.sourceId) })) };
    });
  }
  const nodes = graph.entities.map((entity) => ({
    ...entity, level: 0, typeRole: entity.kind, scientificStatus: entity.status,
    shortDescription: entity.description, rationale: rationale(entity.claimIds)
  }));
  const edges = [];
  for (const rule of graph.rules) {
    nodes.push({
      ...rule, level: 0, typeRole: "construction-rule", scientificStatus: "proposed-rule",
      shortDescription: rule.conditions.join("; "),
      description: `${rule.name}. ALL declared premises and conditions are jointly required. No successful instance is asserted by this rule specification.`,
      rationale: rationale(rule.claimIds)
    });
    for (const input of rule.inputs) edges.push({
      id: `${input.entityId}->${rule.id}`, source: input.entityId, target: rule.id,
      relationLayer: "descriptive", role: "rule-premise", ruleId: rule.id,
      inputLogic: "all", multiplicity: input, claimIds: rule.claimIds,
      assertion: "This entity is a declared joint premise of the proposed rule; no physical causal effect is asserted."
    });
    for (const output of rule.outputEntityIds) edges.push({
      id: `${rule.id}->${output}`, source: rule.id, target: output,
      relationLayer: "descriptive", role: "rule-conclusion", ruleId: rule.id,
      claimIds: rule.claimIds, instanceAdmission: "none",
      assertion: "This is the proposed output class if every rule gate passes; existence is not established."
    });
  }
  return buildModelPack({
    model: { ...graph.model, description: graph.scope.summary },
    source: { id: "canonical-research-source-v1", files: sourceFiles, auditHash: hashCanonical("onto2d:canonical-reconstruction-evidence:v1", evidence) },
    nodes, edges,
    dictionaries: {
      sources: graph.sources, claims: graph.claims, constructionRules: graph.rules,
      scope: graph.scope, migration, evidence,
      presentation: {
        labels: { catalogTitle: "Canonical reconstruction", searchPlaceholder: "Find a concept or construction rule", typeFilter: "Record kind", statusFilter: "Evidence status", parents: "Premises / incoming", children: "Consequences / outgoing" },
        boundary: {
          title: "Level 0 · research reconstruction",
          summary: "Definitions, reviewed findings and proposed rules. No physical CRT instance has passed all gates in the existing model.",
          note: "33 specification records. Legacy levels 1–7 and all 971 historical parent assertions remain in the review ledger; the 2026.08.15 release is preserved."
        }
      }
    }
  });
}

export async function buildCanonicalRelease() {
  const data = await loadCanonicalSource();
  const evidence = await verifyCanonicalEvidence();
  const paths = [...new Set([
    "references/canonical/graph.json", "references/canonical/migration.json", "references/canonical/schema.json",
    "models/causal-emergence/canonical/source.mjs", "models/causal-emergence/canonical/build.mjs",
    "models/causal-emergence/reconstruction/level-0-proposal.json",
    "cases/level-0-oscillator/model-v1.json", "cases/level-0-oscillator/level-zero-validation-v3.json",
    "cases/level-0-oscillator/source-lock.json",
    ...data.graph.sources.filter((s) => s.path).map((s) => s.path)
  ])].sort();
  const files = await Promise.all(paths.map(async (p) => ({ path: p, hash: hashArtifactBytes(new Uint8Array(await readFile(path.join(ROOT, p)))) })));
  return compileCanonicalGraph(data, evidence, files);
}

export function releaseDirectory(pack) {
  return path.join(ROOT, "models/causal-emergence/releases", pack.manifest.model.version);
}

async function collectFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...await collectFiles(path.join(directory, entry.name), `${relative}/`));
    else result.push(relative);
  }
  return result.sort();
}

export async function verifyCanonicalRelease(pack, directory = releaseDirectory(pack)) {
  const expected = { "manifest.json": pack.manifest, ...pack.files, "bundle.json": pack };
  assert.deepEqual(await collectFiles(directory), Object.keys(expected).sort(), "Release file inventory differs");
  for (const [relative, value] of Object.entries(expected)) {
    assert.equal(await readFile(path.join(directory, relative), "utf8"), serialize(value), `Stale canonical derivative: ${relative}`);
  }
  verifyModelPack(pack);
  return pack;
}

/** Existing releases may only be replayed byte-for-byte, never replaced. */
export async function writeCanonicalRelease(pack, directory = releaseDirectory(pack)) {
  verifyModelPack(pack);
  let exists = false;
  try { await readdir(directory); exists = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) {
    try { return await verifyCanonicalRelease(pack, directory); }
    catch (error) { throw new Error(`Refusing to overwrite release ${pack.manifest.model.version}; choose a new source version. ${error.message}`); }
  }
  await mkdir(directory, { recursive: true });
  for (const [relative, value] of Object.entries({ "manifest.json": pack.manifest, ...pack.files, "bundle.json": pack })) {
    const target = path.join(directory, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, serialize(value), { flag: "wx" });
  }
  return verifyCanonicalRelease(pack, directory);
}

export async function run({ verify = false } = {}) {
  const pack = await buildCanonicalRelease();
  if (verify) await verifyCanonicalRelease(pack);
  else await writeCanonicalRelease(pack);
  console.log(`${verify ? "Verified" : "Built"} canonical reconstruction ${pack.manifest.model.version}: ${pack.manifest.statistics.nodeCount} records, ${pack.manifest.statistics.edgeCount} rule incidences; ${pack.manifest.rootHash}`);
  return pack;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error); process.exitCode = 1; });
}
