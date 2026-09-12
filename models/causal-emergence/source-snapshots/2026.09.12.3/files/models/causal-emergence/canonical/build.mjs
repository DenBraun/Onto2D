import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { hashArtifactBytes, hashCanonical } from "@onto2d/kernel";
import { buildModelPack, verifyModelPack } from "@onto2d/model-pack";
import { ROOT, loadCanonicalSource, verifyCanonicalEvidence } from "./source.mjs";

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function compileCanonicalGraph({ graph, migration, edgeReviews, relationPolicy, pilot, pilotPolicy, routing, routingPolicy }, evidence, sourceFiles) {
  const claims = new Map(graph.claims.map((c) => [c.id, c]));
  const sources = new Map(graph.sources.map((s) => [s.id, s]));
  const studies = new Map([...pilot.studies, ...routing.studies].map((s) => [s.id, s]));
  const experiments = new Map(routing.contexts.map((c) => [c.id, c]));
  function rationale(ids) {
    return ids.map((id) => {
      const claim = claims.get(id);
      return {
        ...claim, contexts: (claim.contextIds ?? []).map((id) => studies.get(id)),
        experimentalContexts: (claim.experimentalContextIds ?? []).map((id) => ({
          ...experiments.get(id),
          review: routing.reviews.find((r) => r.contextId === id),
          measurement: routing.measurements.find((m) => m.contextId === id) ?? null,
          routes: routing.routes
        })),
        citations: claim.citations.map((c) => ({ ...c, source: sources.get(c.sourceId) }))
      };
    });
  }
  const nodes = graph.entities.map((entity) => ({
    ...entity, typeRole: entity.kind, scientificStatus: entity.status,
    shortDescription: entity.description, rationale: rationale(entity.claimIds)
  }));
  const edges = graph.relations.map(({ kind, ...relation }) => ({ ...relation, relationLayer: kind, rationale: rationale(relation.claimIds) }));
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
    source: { id: "canonical-research-source-v4", files: sourceFiles, auditHash: hashCanonical("onto2d:canonical-reconstruction-evidence:v1", evidence) },
    nodes, edges,
    dictionaries: {
      sources: graph.sources, claims: graph.claims, constructionRules: graph.rules,
      scope: graph.scope, migration, evidence, edgeReviews, relationPolicy, pilot, pilotPolicy, routing, routingPolicy,
      presentation: {
        labels: { catalogTitle: "Canonical reconstruction", searchPlaceholder: "Find a concept or construction rule", typeFilter: "Record kind", statusFilter: "Evidence status", parents: "Premises / incoming", children: "Consequences / outgoing" },
        boundary: {
          title: "Canonical reconstruction · Level 0 and retinal routes",
          summary: "Conditional definitions and scoped experiments. Eight OFF retinal comparison protocols have separate route decisions; other retinal fragments retain their own preparation boundaries. No validated whole-graph model or physical CRT instance is claimed.",
          note: `${nodes.length} records. ${edgeReviews.records.length + pilot.edgeReviews.length} historical assertions have internal decisions; ${migration.edges.filter((e) => e.status === "pending-scientific-review").length} remain pending. Levels are display groups; earlier releases are preserved.`
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
    "models/causal-emergence/canonical/retinal.mjs",
    "models/causal-emergence/canonical/routing.mjs", "models/causal-emergence/canonical/verify-routing-data.py",
    "models/causal-emergence/reconstruction/level-0-proposal.json",
    "cases/level-0-oscillator/model-v1.json", "cases/level-0-oscillator/level-zero-validation-v3.json",
    "cases/level-0-oscillator/source-lock.json",
    ...data.graph.sources.filter((s) => s.path).map((s) => s.path)
  ])].sort();
  const files = await Promise.all(paths.map(async (p) => ({ path: p, hash: hashArtifactBytes(new Uint8Array(await readFile(path.join(ROOT, p)))) })));
  return compileCanonicalGraph(data, evidence, files);
}

/** Verify bound historical bytes before replaying their archived compiler. */
export async function buildHistoricalCanonicalRelease(version) {
  assert.match(version, /^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/, "Invalid historical version");
  const directory = path.join(ROOT, "models/causal-emergence/releases", version);
  const stored = verifyModelPack(JSON.parse(await readFile(path.join(directory, "bundle.json"), "utf8")));
  assert.equal(stored.manifest.model.version, version);
  await verifyCanonicalRelease(stored, directory);
  const snapshot = path.join(ROOT, "models/causal-emergence/source-snapshots", version, "files");
  const compiler = "models/causal-emergence/canonical/build.mjs";
  assert.ok(stored.manifest.source.files.some((f) => f.path === compiler), "Historical pack does not bind a canonical compiler");
  for (const file of stored.manifest.source.files) {
    const target = path.resolve(snapshot, file.path);
    assert.ok(target.startsWith(`${snapshot}${path.sep}`), "Snapshot path escapes its root");
    assert.equal(hashArtifactBytes(new Uint8Array(await readFile(target))), file.hash, `Historical source bytes changed: ${file.path}`);
  }
  const archived = await import(pathToFileURL(path.join(snapshot, compiler)).href);
  const rebuilt = await archived.buildCanonicalRelease();
  return verifyCanonicalRelease(rebuilt, directory);
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

export async function run({ verify = false, version = null } = {}) {
  assert.ok(version === null || verify, "Historical replay requires --verify");
  const pack = version === null ? await buildCanonicalRelease() : await buildHistoricalCanonicalRelease(version);
  if (verify) await verifyCanonicalRelease(pack);
  else await writeCanonicalRelease(pack);
  console.log(`${verify ? "Verified" : "Built"} canonical reconstruction ${pack.manifest.model.version}: ${pack.manifest.statistics.nodeCount} records, ${pack.manifest.statistics.edgeCount} scoped connections; ${pack.manifest.rootHash}`);
  return pack;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ verify: process.argv.includes("--verify"), version: process.argv.find((arg) => arg.startsWith("--version="))?.slice(10) ?? null }).catch((error) => { console.error(error); process.exitCode = 1; });
}
