import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize } from "@onto2d/kernel/canonical";
import { runStructuralResponseProbes, verifyStructuralResponseProbes } from "@onto2d/structural-geometry/responses";
import { responseHash, RESPONSE_CODEC, summarizeResponseProbe } from "../../../packages/structural-geometry/src/responses-core.js";
import { orbitKey } from "../invariance/build.mjs";
import { packFor } from "../typed/fixtures.mjs";
import { directory, fixtures, readJson } from "./fixtures.mjs";

const referenceFiles = ["controls.json", "PROTOCOL.md", "../canonical/reference.py", "../typed/reference.py", "../topology/reference.py",
  "../invariance/build.mjs", "../../../models/causal-emergence/releases/2026.08.15/bundle.json"];
const encoded = value => JSON.stringify(canonicalClone(value, RESPONSE_CODEC), null, 2) + "\n";
const digest = value => createHash("sha256").update(canonicalize(value, RESPONSE_CODEC)).digest("hex");
export async function verifyReferenceSources(reference) {
  assert.deepEqual(Object.keys(reference.sourceHashes).sort(), [...referenceFiles].sort());
  for (const file of referenceFiles) assert.equal(createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex"),
    reference.sourceHashes[file], `Response reference source binding differs: ${file}`);
}
function values(observation, regime) {
  return observation ? observation.observations.map(o => ({ value: o.value === null || regime === "topology-only-v1" ? o.value
    : orbitKey(o.value, o.observable.id === "canonical-typed-directed-structure-v1"), missing: o.missing })) : null;
}
export function referenceSummary(id, artifact) {
  const regime = artifact.request.regimeId, b = artifact.baseline, graph = g => g ? { nodes: g.nodes, edges: g.edges } : null;
  const { edgeScans, ...selection } = artifact.work.selection;
  return { id, scopeAccounting: Object.fromEntries(["nodeIds", "edgeIds", "incomingBoundaryEdgeIds", "outgoingBoundaryEdgeIds", "externalEdgeIds"].map(k => [k, artifact.preparation.scope[k]])),
    profile: { probeIds: artifact.profile.probeIds, excludedProbeIds: artifact.profile.excludedProbeIds },
    baseline: { graph: graph(b.graph), mapping: b.mapping, values: values(b.observation, regime) },
    probes: artifact.probes.map(p => ({ probeId: p.probe.id, selection: p.selection, execution: p.execution, summary: p.summary,
      runs: p.runs.map(r => ({ target: r.target, transformation: r.transformation, execution: r.execution, rejection: r.rejection,
        graph: graph(r.graph), edgeMapping: r.edgeMapping, changes: r.changes, values: values(r.observation, regime), response: r.response })) })),
    summary: artifact.summary, work: { ...artifact.work, selection } };
}
function verifyAggregation(reference) {
  const rows = [];
  for (let n = 0; n <= 4; n += 1) {
    const results = Array.from({ length: 4 ** n }, (_, code) => {
      const states = Array.from({ length: n }, (_, i) => ["changed", "unchanged", "indeterminate", "rejected"][Math.floor(code / 4 ** (n - i - 1)) % 4]);
      return summarizeResponseProbe(states.map(status => status === "rejected"
        ? { execution: "rejected", rejection: { code: "parallel-edge-after-reversal" }, response: null }
        : { execution: "applied", rejection: null, response: { status, coverage: { numerator: status === "indeterminate" ? 1 : 2 },
          components: [{ observableId: "canonical-directed-structure-v1", state: status === "unchanged" ? "equal" : "different", delta: null },
            { observableId: "canonical-typed-directed-structure-v1", state: status === "indeterminate" ? "indeterminate" : "equal", delta: null }] } }), 2);
    });
    rows.push({ targets: n, profiles: results.length, sha256: digest(results) });
  }
  assert.deepEqual(rows, reference.aggregationProfiles, "Independent response aggregation differs.");
}
export async function verifyCensus(reference) {
  const controls = await readJson("controls.json"), types = controls.types[controls.censusType];
  const digests = [], totals = { requests: 0, probes: 0, targets: 0, applied: 0, rejected: 0, unavailableProbes: 0 };
  for (let n = 1; n <= 3; n += 1) {
    const pairs = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? null : [u, v]).filter(Boolean)).flat();
    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
      const pack = packFor({ id: `responses-census-${n}-${mask}`, nodes: n, edges: pairs.filter((_, i) => mask & (1 << i)).map(([from, to]) => ({ from, to, types })) });
      for (const regimeId of ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]) {
        const id = `n${n}-mask${mask}-${regimeId}`, value = referenceSummary(id, runStructuralResponseProbes(pack, { regimeId }));
        digests.push({ id, sha256: digest(value) }); totals.requests += 1; totals.probes += value.probes.length;
        totals.targets += value.summary.targets.total; totals.applied += value.summary.targets.applied; totals.rejected += value.summary.targets.rejected;
        totals.unavailableProbes += value.probes.filter(p => p.execution.state === "unavailable").length;
      }
    }
  }
  assert.deepEqual({ totals, digests }, reference.census, "Independent exhaustive response census differs.");
  verifyAggregation(reference);
  return totals;
}
export async function run({ write = false, report = false } = {}) {
  if (write && report) throw new Error("Choose write or verified report.");
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  const examples = await fixtures(); assert.deepEqual(examples.map(f => f.id), reference.cases.map(c => c.id));
  assert.equal(new Set(examples.map(f => f.id)).size, examples.length);
  const outputs = [], runs = [];
  for (const [i, f] of examples.entries()) {
    const artifact = runStructuralResponseProbes(f.pack, f.input); verifyStructuralResponseProbes(artifact, f.pack, f.input);
    assert.deepEqual(referenceSummary(f.id, artifact), reference.cases[i], `Independent responses differ: ${f.id}`);
    const file = `artifacts/${f.id}.json`; outputs.push([file, encoded(artifact)]);
    runs.push({ id: f.id, file, regimeId: f.input.regimeId, summary: artifact.summary,
      probes: artifact.probes.map(p => ({ id: p.probe.id, execution: p.execution, summary: p.summary })), artifactHash: artifact.artifactHash });
  }
  const census = await verifyCensus(reference);
  const body = { schemaVersion: "1", suiteId: "structural-response-probes-v1", status: "bounded-computational-agreement",
    referenceHash: responseHash("reference", reference), census, aggregationProfiles: 341, runs };
  const suite = { ...body, artifactHash: responseHash("suite", body) }; outputs.push(["suite.json", encoded(suite)]);
  if (write) await mkdir(new URL("artifacts/", directory), { recursive: true });
  for (const [file, bytes] of outputs) {
    if (write) await writeFile(new URL(file, directory), bytes);
    else assert.equal(await readFile(new URL(file, directory), "utf8"), bytes, `Response replay differs: ${file}`);
  }
  if (report) console.table(runs.map(r => ({ case: r.id, regime: r.regimeId, status: r.summary.status, observedProbes: r.summary.coverage.numerator,
    requiredProbes: r.summary.coverage.denominator, targets: r.summary.targets.total, rejected: r.summary.targets.rejected })));
  console.log(`Response suite ${write ? "written" : "verified"}: ${runs.length} controls; ${census.requests} independent requests / ${census.targets} targets.`);
  return suite;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--verify", "--report"].includes(args[0])) {
    console.error("Usage: node cases/structural-geometry/responses/build.mjs --write | --verify | --report"); process.exitCode = 1;
  } else run({ write: args[0] === "--write", report: args[0] === "--report" }).catch(error => { console.error(error); process.exitCode = 1; });
}
