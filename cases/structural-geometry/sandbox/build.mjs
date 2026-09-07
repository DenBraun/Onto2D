import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { runStructuralProbeSandbox, verifyStructuralProbeSandbox } from "@onto2d/structural-geometry/sandbox";
import { packFor } from "../canonical/fixtures.mjs";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const codec = { limits: { maxEntries: 500000 } };
const encoded = value => JSON.stringify(canonicalClone(value, codec), null, 2) + "\n";
const hash = (kind, value) => hashCanonical(`onto2d:structural-sandbox-${kind}:v1`, value, codec);
const referenceFiles = ["controls.json", "PROTOCOL.md", "../canonical/controls.json", "../typed/controls.json",
  "../../../models/causal-emergence/releases/2026.08.15/bundle.json"];
export async function verifyReferenceSources(reference) {
  assert.deepEqual(Object.keys(reference.sourceHashes).sort(), [...referenceFiles].sort(), "Sandbox reference source coverage differs.");
  for (const file of referenceFiles) assert.equal(createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex"),
    reference.sourceHashes[file], `Sandbox reference source binding differs: ${file}`);
}
export function referenceSummary(id, artifact) {
  const graph = g => g ? { nodes: g.nodes, edges: g.edges } : null;
  return { id, baseline: { graph: graph(artifact.baseline.graph), mapping: artifact.baseline.mapping },
    scopeAccounting: Object.fromEntries(["nodeIds", "edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"].map(k => [k, artifact.preparation.scope[k]])),
    selection: artifact.selection, execution: artifact.execution, work: artifact.work,
    runs: artifact.runs.map(r => ({ target: r.target, transformation: r.transformation, execution: r.execution, rejection: r.rejection,
      graph: graph(r.graph), edgeMapping: r.edgeMapping, changes: r.changes })) };
}
export async function verifyCensus(reference) {
  const { operations } = await readJson("controls.json");
  const rows = [], digests = [];
  for (let n = 1; n <= 3; n += 1) {
    const pairs = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? null : [u, v]).filter(Boolean)).flat();
    const row = { nodes: n, graphs: 2 ** pairs.length, requests: 0, targets: 0, applied: 0, rejected: 0, unavailable: 0 };
    for (let mask = 0; mask < row.graphs; mask += 1) {
      const pack = packFor({ id: `sandbox-census-${n}-${mask}`, nodes: n, edges: pairs.filter((_, i) => mask & (1 << i)) });
      for (const operation of operations) {
        const id = `n${n}-mask${mask}-${operation.id}`;
        const value = referenceSummary(id, runStructuralProbeSandbox(pack, { regimeId: "topology-only-v1", transformation: operation.transformation }));
        digests.push({ id, sha256: createHash("sha256").update(canonicalize(value)).digest("hex") });
        row.requests += 1; row.targets += value.execution.targetCount; row.applied += value.execution.appliedCount;
        row.rejected += value.execution.rejectedCount; row.unavailable += Number(value.execution.state === "unavailable");
      }
    }
    rows.push(row);
  }
  const result = { rows, digests }; assert.deepEqual(result, reference.census, "Independent exhaustive sandbox outcomes differ.");
  return result;
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  const examples = await fixtures(); assert.deepEqual(examples.map(f => f.id), reference.cases.map(c => c.id));
  assert.equal(new Set(examples.map(f => f.id)).size, examples.length);
  const outputs = [], runs = [];
  for (const [i, f] of examples.entries()) {
    const artifact = runStructuralProbeSandbox(f.pack, f.input); verifyStructuralProbeSandbox(artifact, f.pack, f.input);
    assert.deepEqual(referenceSummary(f.id, artifact), reference.cases[i], `Independent sandbox differs: ${f.id}`);
    const file = `artifacts/${f.id}.json`; outputs.push([file, encoded(artifact)]);
    runs.push({ id: f.id, scenarioId: f.scenarioId, file, regimeId: f.input.regimeId, transformation: f.input.transformation,
      execution: artifact.execution, work: artifact.work, artifactHash: artifact.artifactHash });
  }
  const census = await verifyCensus(reference);
  const body = { schemaVersion: "1", suiteId: "immutable-structural-probe-sandbox-v1", status: "bounded-computational-agreement",
    referenceHash: hash("reference", reference), census: census.rows, runs };
  const suite = { ...body, artifactHash: hash("suite", body) }; outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, `Sandbox replay differs: ${file}`);
  }
  if (report) console.table(runs.map(r => ({ case: r.id, state: r.execution.state, targets: r.execution.targetCount,
    applied: r.execution.appliedCount, rejected: r.execution.rejectedCount, edgeVisits: r.work.transformationEdgeVisits })));
  console.log(`Sandbox suite ${write ? "written" : "verified"}: ${runs.length} controls; 69 graphs / 345 independently checked requests.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/sandbox/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch(error => { console.error(error); process.exitCode = 1; });
}
