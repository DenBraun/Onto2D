import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deepFreeze } from "@onto2d/kernel/canonical";
import { buildModelPack } from "@onto2d/model-pack";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { buildStructuralProvider, requireStructuralMetricValues } from "@onto2d/structural-geometry/providers";
import { createStructuralFlowAnalyzer, prepareStructuralFlow, verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { pairCoordinates, PROFILE_ID as COORDINATE_LAYOUT_ID } from "../../dream4/geometry.mjs";
import { graphBaselineFeatures } from "../../protocol/baselines.mjs";
import { digest } from "../../datasets/scopes.mjs";

export const PROFILE = deepFreeze(JSON.parse(readFileSync(new URL("profile.json", import.meta.url))));
export const GEOMETRY_PROFILE_ID = `${PROFILE.id}:pair-geometry`;
export const fraction = value => ({ numerator: String(value), denominator: "1" });
export const variantFor = id => { const variant = PROFILE.variants.find(row => row.id === id); assert.ok(variant, "Undeclared metric variant."); return variant; };
export const LIMIT_REASONS = ["STRUCTURAL_FLOW_LIMIT_EXCEEDED", "STRUCTURAL_FLOW_NUMERIC_LIMIT"];

export function carrier(graph, sourceId) {
  graphBaselineFeatures(graph);
  const nodes = [...graph.nodes].sort(), mapping = nodes.map((id, i) => ({ sourceId: id, nodeId: `n${String(i).padStart(4, "0")}` }));
  const ids = new Map(mapping.map(row => [row.sourceId, row.nodeId]));
  const edges = [...graph.edges].sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
  const canonical = { nodes, edges }, binding = { profileId: PROFILE.id, sourceId, graphSha256: digest(canonical), masses: "declared-unit-analysis-mass" };
  const pack = buildModelPack({ model: { id: `metric-sensitivity-${digest(binding).slice(0, 24)}`, version: "1", name: "Graph-derived transport metric sensitivity", status: "synthetic" },
    source: { id: PROFILE.id, files: [], auditHash: `sha256:${digest(binding)}` }, nodes: mapping.map(row => ({ id: row.nodeId })),
    edges: edges.map((edge, i) => ({ id: `e${String(i).padStart(5, "0")}`, source: ids.get(edge.source), target: ids.get(edge.target), relationLayer: "source-parent", weight: 1 })), dictionaries: {} });
  return { graph: canonical, mapping, pack };
}

export function inputs(context, variantId) {
  const variant = variantFor(variantId), { pack } = context;
  graphBaselineFeatures(context.graph);
  assert.deepEqual(context.mapping, [...context.graph.nodes].sort().map((sourceId, i) => ({ sourceId, nodeId: `n${String(i).padStart(4, "0")}` })));
  const ids = new Map(context.mapping.map(row => [row.sourceId, row.nodeId]));
  assert.deepEqual(pack.files["model/edges.json"].map(e => [e.source, e.target, e.weight]), context.graph.edges.map(e => [ids.get(e.source), ids.get(e.target), 1]), "Carrier graph or declared masses differ.");
  const provider = buildStructuralProvider(pack, { providerId: variant.provider });
  const values = requireStructuralMetricValues(provider, pack, { providerId: variant.provider });
  const edges = pack.files["model/edges.json"];
  const initialLengths = values.edges.map(edge => ({ edgeId: edge.id, length: variant.initial === "double-unit" ? fraction(2) :
    variant.initial === "one-plus-source-outdegree" ? fraction(1 + edges.filter(other => other.source === edge.source).length) : edge.length }));
  return { provider, input: { ...PROFILE.flow, idleness: variant.idleness, initialLengths } };
}

export function collect(context, variantId, flow) {
  const variant = variantFor(variantId), { pack, graph } = context, { provider, input } = inputs(context, variantId);
  verifyStructuralFlowArtifact(flow, pack, input);
  const edges = pack.files["model/edges.json"], f = analyzeStructuralGeometry(pack).result.edges, last = flow.states.at(-1);
  // Shape-only initialization preserves the unit static transport field.
  const useInitial = variant.initial === "provider";
  const staticValues = useInitial ? flow.states[0].edges.map(edge => edge.curvature) : null;
  return { provider, input, fields: edges.map((edge, i) => ({ forman: fraction(f[i].curvature), ollivier: staticValues?.[i] ?? null,
    length: last.edges[i].length, curvature: last.edges[i].curvature })), graph, termination: flow.termination };
}

export async function measure(context, variantId, unitStatic = null) {
  const { provider, input } = inputs(context, variantId);
  let request = null, flow;
  try {
    request = prepareStructuralFlow(context.pack, input);
    flow = await createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter()).analyze(context.pack, input);
  } catch (error) {
    if (!LIMIT_REASONS.includes(error.code)) throw error;
    return { status: "unavailable", reason: error.code, provider, input, request, flow: null, geometry: null };
  }
  const collected = collect(context, variantId, flow);
  if (collected.fields.some(row => row.ollivier === null)) {
    assert.ok(unitStatic && unitStatic.length === context.graph.edges.length, "Unit static field is required for shape-only initialization.");
    collected.fields.forEach((row, i) => { row.ollivier = unitStatic[i]; });
  }
  const { fields, termination } = collected;
  const geometry = { ...pairCoordinates(context.graph, fields, termination), profileId: GEOMETRY_PROFILE_ID,
    coordinateLayoutId: COORDINATE_LAYOUT_ID, fields, termination };
  return { status: "complete", reason: null, provider, input, request, flow, geometry };
}

export const semanticGeometry = geometry => ({ pairs: geometry.pairs, fields: geometry.fields, termination: geometry.termination });
export const numericalFlow = flow => ({ states: flow.states.map(row => ({ iteration: row.iteration, edges: row.edges, summary: row.summary })), termination: flow.termination, cuts: flow.cuts });
