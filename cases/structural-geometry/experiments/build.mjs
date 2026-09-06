import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalClone, canonicalize, hashCanonical } from "@onto2d/kernel/canonical";
import { auditStructuralWeights, analyzeStructuralMetricExperiment, TYPED_SELECTION_POLICY } from "@onto2d/structural-geometry/experiments";

const MODEL = new URL("../../../models/causal-emergence/releases/2026.08.15/bundle.json", import.meta.url);
const LOCK = new URL("../causal-emergence/source-lock.json", import.meta.url);
const json = async (url) => JSON.parse(await readFile(url, "utf8"));
const encoded = (value) => `${JSON.stringify(canonicalClone(value), null, 2)}\n`;

export function experimentSelections(pack) {
  const selections = [{ kind: "all" }, ...TYPED_SELECTION_POLICY.necessityOrder.map((through) => ({ kind: "necessity", through }))];
  const roles = TYPED_SELECTION_POLICY.roleUniverse;
  for (let mask = 1; mask < 8; mask += 1) selections.push({ kind: "roles", roles: roles.filter((_, i) => mask & (1 << i)) });
  for (const field of TYPED_SELECTION_POLICY.channels) {
    const values = [...new Set(pack.files["model/edges.json"].flatMap((edge) => edge[field] ?? []))].sort((a, b) => a - b);
    for (const value of values) selections.push({ kind: "channel", field, value });
  }
  return selections;
}

function transition(before, after) {
  const from = new Map(before.result.edges.map((edge) => [edge.id, edge]));
  const to = new Map(after.result.edges.map((edge) => [edge.id, edge]));
  let unchanged = 0; let decreased = 0; let overlapping = 0;
  for (const [id, edge] of from) {
    const next = to.get(id);
    if (!next) throw new Error("Necessity selections must be nested.");
    const oldLo = BigInt(edge.curvature.lowerTicks); const oldHi = BigInt(edge.curvature.upperTicks);
    const newLo = BigInt(next.curvature.lowerTicks); const newHi = BigInt(next.curvature.upperTicks);
    if (newLo > oldLo || newHi > oldHi) throw new Error("Fixed-context positive-weight curvature cannot increase under edge addition.");
    if (newLo === oldLo && newHi === oldHi) unchanged += 1;
    else if (newHi < oldLo) decreased += 1;
    else overlapping += 1;
  }
  return {
    metricPolicyId: before.request.metricPolicyId, from: before.request.selection.through, to: after.request.selection.through,
    persistentEdgeCount: from.size, addedEdgeIds: [...to.keys()].filter((id) => !from.has(id)),
    unchangedIntervalCount: unchanged, decreasedIntervalCount: decreased, overlappingIntervalCount: overlapping
  };
}

export async function run({ verify = false, report = false } = {}) {
  if (verify && report) throw new Error("Choose verification or reporting.");
  const pack = await json(MODEL);
  const audit = auditStructuralWeights(pack);
  if (canonicalize(audit.model) !== canonicalize(await json(LOCK))) throw new Error("The stage-three source lock differs.");
  const runs = [];
  const transitions = [];
  let fullWeighted;
  for (const metricPolicyId of ["unit-v1", "inverse-target-share-v1"]) {
    let previous;
    for (const selection of experimentSelections(pack)) {
      const artifact = analyzeStructuralMetricExperiment(pack, { selection, metricPolicyId });
      if (selection.kind === "all" && metricPolicyId === "inverse-target-share-v1") fullWeighted = artifact;
      if (selection.kind === "necessity") {
        if (previous) transitions.push(transition(previous, artifact));
        previous = artifact;
      }
      runs.push({
        request: artifact.request, artifactHash: artifact.artifactHash, projectionHash: artifact.projectionHash,
        metricContextHash: artifact.metricContextHash, nodeCount: artifact.result.nodes.length,
        edgeCount: artifact.result.edges.length, connectivity: artifact.result.connectivity, summary: artifact.result.summary
      });
    }
  }
  const body = {
    schemaVersion: "1", suiteId: "causal-emergence-stage-three-v1", status: "descriptive-no-metric-promotion",
    model: audit.model, sourceProjectionHash: audit.sourceProjectionHash, weightAuditHash: audit.artifactHash,
    defaultMetricPolicyId: "unit-v1", runs, necessityTransitions: transitions
  };
  const suite = { ...body, artifactHash: hashCanonical("onto2d:structural-metric-suite:v1", body) };
  for (const [filename, value] of [["weight-audit.json", audit], ["weighted-full.json", fullWeighted], ["suite.json", suite]]) {
    const url = new URL(filename, import.meta.url);
    if (verify || report) {
      if (await readFile(url, "utf8") !== encoded(value)) throw new Error(`Stage-three fixture differs: ${filename}`);
    } else await writeFile(url, encoded(value));
  }
  if (report) {
    console.log(`Structural Geometry stage 3: ${runs.length} verified experiments; default remains unit-v1.`);
    console.log(`Source: ${audit.model.modelId}@${audit.model.modelVersion}`);
    console.log(`Targets with non-unit source sums: ${audit.nonUnitTargetIds.join(", ")}; invalid weights: ${audit.invalidWeights.length}.`);
    console.table(runs.filter((entry) => ["all", "necessity"].includes(entry.request.selection.kind)).map((entry) => ({
      metric: entry.request.metricPolicyId, selection: entry.request.selection.through ?? "all",
      nodes: entry.nodeCount, edges: entry.edgeCount, strongComponents: entry.connectivity.strongComponentCount,
      cyclicNodes: entry.connectivity.cyclicNodeCount, isolatedNodes: entry.connectivity.isolatedNodeCount,
      negative: entry.summary.signs.negative, zero: entry.summary.signs.zero,
      positive: entry.summary.signs.positive, unresolved: entry.summary.signs.unresolved
    })));
    console.log(`Suite: ${suite.artifactHash}`);
  } else console.log(`Stage-three suite ${verify ? "verified" : "written"}: ${runs.length} experiments, ${transitions.length} necessity transitions.`);
  return suite;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !["--verify", "--report"].includes(arg))) {
    console.error("Usage: node cases/structural-geometry/experiments/build.mjs [--verify | --report]");
    process.exitCode = 1;
  } else run({ verify: args.includes("--verify"), report: args.includes("--report") }).catch((error) => {
    console.error(error.message); process.exitCode = 1;
  });
}
