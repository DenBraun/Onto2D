import assert from "node:assert/strict";
import { verifyStructuralGeometryArtifact } from "@onto2d/structural-geometry";
import { verifyOllivierArtifact } from "@onto2d/structural-geometry/ollivier";
import { verifyStructuralFlowArtifact } from "@onto2d/structural-geometry/flow";
import { graphBaselineFeatures } from "../protocol/baselines.mjs";

export const PROFILE_ID = "biological-pair-terminal-geometry-v1";
export const FLOW_INPUT = Object.freeze({ idleness: "half", step: "half", maxIterations: 4,
  stableSteps: 2, tolerance: Object.freeze({ numerator: "1", denominator: "1000000" }),
  cut: Object.freeze({ kind: "none" }) });
export const STOP_REASONS = Object.freeze(["fixed-point", "tolerance", "cycle", "degenerate-length", "iteration-limit"]);
const coordinates = ["source_in", "source_out", "target_in", "target_out", "direct", "shortest_union"];
export const GEOMETRY_FEATURE_NAMES = Object.freeze([
  ...["forman", "ollivier", "flow_length", "flow_curvature"].flatMap(field => coordinates.map(c => `${field}_${c}`)),
  "flow_distance", "flow_iteration", ...STOP_REASONS.map(reason => `flow_stop_${reason}`)
]);
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const q = (n, d = 1n) => { const g = gcd(n < 0n ? -n : n, d); return [n / g, d / g]; };
const zero = () => [0n, 1n];
const add = (a, b) => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const less = (a, b) => a[0] * b[1] < b[0] * a[1];
const encoded = a => ({ numerator: String(a[0]), denominator: String(a[1]) });
function rational(value) {
  if (!value || Object.keys(value).sort().join() !== "denominator,numerator" ||
      typeof value.numerator !== "string" || typeof value.denominator !== "string" ||
      !/^-?(0|[1-9][0-9]{0,255})$/.test(value.numerator) || !/^[1-9][0-9]{0,255}$/.test(value.denominator)) {
    throw new Error("Expected a bounded exact rational, never an interval midpoint.");
  }
  return q(BigInt(value.numerator), BigInt(value.denominator));
}

// Round the exact quotient directly to binary64 (nearest, ties to even).
// Converting numerator and denominator separately can overflow or double-round.
export function rationalNumber(value) {
  const [signed, d] = Array.isArray(value) ? value : rational(value), n = signed < 0n ? -signed : signed;
  if (!n) return 0;
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < (d << BigInt(exponent)) : (n << BigInt(-exponent)) < d) exponent--;
  if (exponent > 1023 || exponent < -1075) throw new Error("Rational conversion overflow/underflow.");
  const power = Math.max(exponent - 52, -1074);
  const numerator = power < 0 ? n << BigInt(-power) : n;
  const denominator = power > 0 ? d << BigInt(power) : d;
  let bits = numerator / denominator;
  const remainder = numerator % denominator;
  if (2n * remainder > denominator || (2n * remainder === denominator && bits % 2n)) bits++;
  const result = (signed < 0n ? -1 : 1) * Number(bits) * 2 ** power;
  if (!Number.isFinite(result) || result === 0) throw new Error("Rational conversion overflow/underflow.");
  return result;
}

// Arithmetic layer. The public collector below first verifies all certificates.
export function pairCoordinates(graph, fields, termination) {
  const baseline = graphBaselineFeatures(graph);
  if (graph.nodes.length > 64 || graph.edges.length > 64 || fields.length !== graph.edges.length ||
      !Number.isInteger(termination.iteration) || termination.iteration < 0 || termination.iteration > 4 ||
      !STOP_REASONS.includes(termination.reason)) throw new Error("Pair geometry domain exceeds the fixed profile.");
  const nodes = [...graph.nodes].sort(), index = new Map(nodes.map((id, i) => [id, i]));
  const n = nodes.length, edges = graph.edges.map((edge, i) => ({ s: index.get(edge.source), t: index.get(edge.target),
    values: ["forman", "ollivier", "length", "curvature"].map(name => rational(fields[i][name])) }));
  if (edges.some(e => e.values[2][0] <= 0n)) throw new Error("Terminal lengths must be positive.");
  const hops = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : Infinity));
  const distance = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? zero() : null));
  for (const e of edges) { hops[e.s][e.t] = 1; distance[e.s][e.t] = e.values[2]; }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    hops[i][j] = Math.min(hops[i][j], hops[i][k] + hops[k][j]);
    if (distance[i][k] && distance[k][j]) {
      const candidate = add(distance[i][k], distance[k][j]);
      if (!distance[i][j] || less(candidate, distance[i][j])) distance[i][j] = candidate;
    }
  }
  const pairs = baseline.pairs.map(pair => {
    const s = index.get(pair.source), t = index.get(pair.target), reachable = Number.isFinite(hops[s][t]);
    const sets = [edges.filter(e => e.t === s), edges.filter(e => e.s === s), edges.filter(e => e.t === t),
      edges.filter(e => e.s === t), edges.filter(e => e.s === s && e.t === t),
      reachable ? edges.filter(e => hops[s][e.s] + 1 + hops[e.t][t] === hops[s][t]) : []];
    const exact = [0, 1, 2, 3].flatMap(field => sets.map(set => {
      const sum = set.reduce((a, e) => add(a, e.values[field]), zero());
      return set.length ? q(sum[0], sum[1] * BigInt(set.length)) : zero();
    }));
    exact.push(distance[s][t] ?? zero(), q(BigInt(termination.iteration)),
      ...STOP_REASONS.map(reason => q(reason === termination.reason ? 1n : 0n)));
    return { source: pair.source, target: pair.target, baseline: pair.values,
      exact: exact.map(encoded), geometry: exact.map(rationalNumber) };
  });
  return { profileId: PROFILE_ID, featureNames: GEOMETRY_FEATURE_NAMES, pairs };
}

export function collectPairGeometry({ graph, pack, mapping, artifacts }) {
  const nodes = pack.files["model/nodes.json"], edges = pack.files["model/edges.json"];
  assert.equal(mapping.length, graph.nodes.length, "Source mapping must be complete.");
  assert.equal(new Set(mapping.map(row => row.sourceId)).size, mapping.length);
  assert.equal(new Set(mapping.map(row => row.nodeId)).size, mapping.length);
  assert.deepEqual(mapping.map(row => row.sourceId).sort(), [...graph.nodes].sort());
  assert.deepEqual(mapping.map(row => row.nodeId).sort(), nodes.map(node => node.id).sort());
  const sourceId = new Map(mapping.map(row => [row.nodeId, row.sourceId]));
  const key = edge => JSON.stringify([edge.source, edge.target]);
  const sourceEdges = edges.map(edge => ({ source: sourceId.get(edge.source), target: sourceId.get(edge.target) }));
  assert.deepEqual(sourceEdges.map(key).sort(), graph.edges.map(key).sort(), "Every provider must use the same source graph.");
  verifyStructuralGeometryArtifact(artifacts.forman, pack);
  verifyOllivierArtifact(artifacts.ollivier, pack, { edgeIds: edges.map(e => e.id), idleness: "half" });
  verifyStructuralFlowArtifact(artifacts.flow, pack, FLOW_INPUT);
  const terminal = artifacts.flow.states.at(-1);
  assert.equal(terminal.iteration, artifacts.flow.termination.iteration);
  const lookup = values => new Map(values.map(edge => [edge.id, edge]));
  const f = lookup(artifacts.forman.result.edges), o = lookup(artifacts.ollivier.result.edges), t = lookup(terminal.edges);
  const byPair = new Map(edges.map((edge, i) => [key(sourceEdges[i]), {
    forman: { numerator: String(f.get(edge.id).curvature), denominator: "1" },
    ollivier: o.get(edge.id).curvature, length: t.get(edge.id).length, curvature: t.get(edge.id).curvature
  }]));
  const fields = graph.edges.map(edge => byPair.get(key(edge)));
  return { ...pairCoordinates(graph, fields, artifacts.flow.termination), fields,
    termination: artifacts.flow.termination,
    evidence: { forman: artifacts.forman.artifactHash, ollivier: artifacts.ollivier.artifactHash, flow: artifacts.flow.artifactHash } };
}
