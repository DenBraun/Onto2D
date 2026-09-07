import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { fraction, encodedFraction, SCALE } from "./rational.js";

export const GEOMETRIC_CODEC = Object.freeze({ limits: Object.freeze({ maxEntries: 2000000 }) });
export const geometricFail = (code, message) => { throw new EngineError(`GEOMETRIC_SIGNATURE_${code}`, message); };
export const geometricHash = (kind, value) => hashCanonical(`onto2d:geometric-signature-${kind}:v1`, value, GEOMETRIC_CODEC);
export function geometricEncoded(value) {
  const text = canonicalize(value, GEOMETRIC_CODEC);
  if (new TextEncoder().encode(text).length > 25165824) geometricFail("LIMIT_EXCEEDED", "Geometric signature exceeds its 24 MiB budget.");
  return text;
}
export function geometricSeal(kind, body, field = "artifactHash") {
  const value = { ...body, [field]: geometricHash(kind, body) }; geometricEncoded(value); return deepFreeze(value);
}
export const GEOMETRIC_SIGNATURE_POLICY = geometricSeal("policy", {
  id: "geometric-signature-v1", version: "1", source: "expected-verified-model-pack",
  layers: ["forman-curvature-v1", "ollivier-curvature-v1", "flow-trajectory-v1"],
  population: "same-exact-scoped-nodes-and-edges-for-all-requested-layers",
  scalar: "exact-multiset-of-closed-rational-intervals", intervals: "retain-certified-endpoints-no-midpoints",
  extrema: "possible-and-certain-attainment-with-inclusive-ties",
  roles: "source-target-in-out-degree-multisets", provenance: "exact-edge-ids-excluded-from-values",
  flow: "joint-normalized-length-curvature-multisets",
  alignment: "absolute-iteration-through-requested-cap-no-padding",
  earlyStop: "unavailable-tail-partial-horizon-never-convergence-substitution",
  cuts: "strict-threshold-events-and-terminal-consecutive-run-lengths",
  missingness: "observed-partial-unavailable-whole-value-only-if-all-three-observed",
  comparison: "no-distance-or-cross-source-comparability-authority",
  verification: "expected-source-request-and-external-evidence-replay",
  errors: "throw-no-partial-success",
  limits: { maxNodes: 64, maxEdges: 64, maxFrames: 25, maxScalarSamples: 3328, maxJointSamples: 1600,
    maxCanonicalEntries: 2000000, maxArtifactBytes: 25165824 }
}, "contentHash");
export const geometricCoverage = (numerator, denominator) => ({ numerator, denominator, complete: denominator > 0 && numerator === denominator });
export function geometricFields(value, allowed, required = allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(value, k))) {
    geometricFail("INPUT_INVALID", "Object fields differ from the closed geometric signature contract.");
  }
}
const textOrder = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const cmp = (a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
const decode = v => fraction(BigInt(v.numerator), BigInt(v.denominator));
const bounds = row => [decode(row.lower), decode(row.upper)];
export const point = value => ({ lower: value, upper: value });
export const integerPoint = value => point(encodedFraction(fraction(BigInt(value))));
export const intervalPoint = value => ({ lower: encodedFraction(fraction(BigInt(value.lowerTicks), SCALE)), upper: encodedFraction(fraction(BigInt(value.upperTicks), SCALE)) });
export function geometricMultiset(values, compare = (a, b) => textOrder(geometricEncoded(a), geometricEncoded(b))) {
  const sorted = [...values].sort(compare), rows = [];
  for (const value of sorted) {
    const last = rows.at(-1);
    if (last && geometricEncoded(last.value) === geometricEncoded(value)) last.count += 1;
    else rows.push({ value, count: 1 });
  }
  return rows;
}
export function geometricRoles(graph) {
  const degrees = new Map(graph.nodes.map(n => [n.id, { incoming: 0, outgoing: 0 }]));
  for (const e of graph.edges) { degrees.get(e.source).outgoing += 1; degrees.get(e.target).incoming += 1; }
  return new Map(graph.edges.map(e => [e.id, { sourceInDegree: degrees.get(e.source).incoming, sourceOutDegree: degrees.get(e.source).outgoing,
    targetInDegree: degrees.get(e.target).incoming, targetOutDegree: degrees.get(e.target).outgoing }]));
}
// Private descriptor helpers consume only verified upstream values.
export function scalarDescriptor(samples, roles, numeric) {
  if (!samples.length) return null;
  const rows = samples.map(s => ({ ...s, q: bounds(s.value) }));
  const signs = { negative: 0, zero: 0, positive: 0, unresolved: 0 };
  for (const { q: [lo, hi] } of rows) signs[hi.n < 0n ? "negative" : lo.n > 0n ? "positive" : lo.n === 0n && hi.n === 0n ? "zero" : "unresolved"] += 1;
  function extreme(maximum) {
    const select = (index) => rows.reduce((value, r) => (maximum ? cmp(r.q[index], value) > 0 : cmp(r.q[index], value) < 0) ? r.q[index] : value, rows[0].q[index]);
    const lower = select(0), upper = select(1);
    const possible = rows.filter(r => maximum ? cmp(r.q[1], lower) >= 0 : cmp(r.q[0], upper) <= 0);
    const certain = rows.filter(r => rows.every(other => other === r || (maximum ? cmp(r.q[0], other.q[1]) >= 0 : cmp(r.q[1], other.q[0]) <= 0)));
    return { value: { lower: encodedFraction(lower), upper: encodedFraction(upper),
      possibleRoles: geometricMultiset(possible.map(r => roles.get(r.id))), certainRoles: geometricMultiset(certain.map(r => roles.get(r.id))) },
      provenance: { possibleEdgeIds: possible.map(r => r.id).sort(), certainEdgeIds: certain.map(r => r.id).sort() } };
  }
  const minimum = extreme(false), maximum = extreme(true);
  return { value: { numeric, count: rows.length,
    distribution: geometricMultiset(samples.map(s => s.value), (a, b) => cmp(decode(a.lower), decode(b.lower)) || cmp(decode(a.upper), decode(b.upper))),
    signs, minimum: minimum.value, maximum: maximum.value }, provenance: { minimum: minimum.provenance, maximum: maximum.provenance } };
}
export function thresholdEvents(states, cut) {
  if (cut.kind === "none") return { value: null, provenance: null };
  const threshold = decode(cut.threshold), events = [], provenance = [], streaks = new Map(); let previous = new Set();
  for (const state of states) {
    const above = new Set(state.edges.filter(e => cmp(decode(e.length), threshold) > 0).map(e => e.id));
    const entered = [...above].filter(id => !previous.has(id)).sort(), exited = [...previous].filter(id => !above.has(id)).sort();
    for (const e of state.edges) streaks.set(e.id, above.has(e.id) ? (streaks.get(e.id) ?? 0) + 1 : 0);
    events.push({ iteration: state.iteration, aboveCount: above.size, enteredCount: entered.length, exitedCount: exited.length });
    provenance.push({ iteration: state.iteration, aboveEdgeIds: [...above].sort(), enteredEdgeIds: entered, exitedEdgeIds: exited }); previous = above;
  }
  return { value: { threshold: cut.threshold, frames: events,
    terminalRunLengths: geometricMultiset([...previous].map(id => streaks.get(id)), (a, b) => a - b) }, provenance };
}
export function flowDescriptor(artifact, roles) {
  const provenance = [], horizon = artifact.request.parameters.maxIterations, stop = artifact.termination;
  const frames = Array.from({ length: horizon + 1 }, (_, iteration) => {
    const state = artifact.states[iteration];
    if (!state) return { iteration, value: null, reason: `after-${stop.reason}` };
    const lengths = scalarDescriptor(state.edges.map(e => ({ id: e.id, value: point(e.length) })), roles, "exact-rational");
    const curvatures = scalarDescriptor(state.edges.map(e => ({ id: e.id, value: point(e.curvature) })), roles, "exact-rational");
    provenance.push({ iteration, lengths: lengths.provenance, curvatures: curvatures.provenance, stateHash: state.stateHash });
    return { iteration, reason: null, value: {
      jointDistribution: geometricMultiset(state.edges.map(e => ({ length: e.length, curvature: e.curvature })),
        (a, b) => cmp(decode(a.length), decode(b.length)) || cmp(decode(a.curvature), decode(b.curvature))),
      lengths: lengths.value, curvatures: curvatures.value,
      maxLengthChange: state.summary.maxLengthChange, maxCurvatureChange: state.summary.maxCurvatureChange,
      stableStepCount: state.summary.stableStepCount } };
  });
  const events = thresholdEvents(artifact.states, artifact.cuts.policy);
  return { value: { horizon, frames,
    termination: { reason: stop.reason, iteration: stop.iteration, cycleStart: stop.cycleStart, cyclePeriod: stop.cyclePeriod, degenerateEdgeCount: stop.edgeIds.length },
    cuts: { policy: artifact.cuts.policy, iteration: artifact.cuts.iteration, removedEdgeCount: artifact.cuts.removedEdgeIds.length,
      weakComponentSizes: artifact.cuts.weakComponents.map(g => g.length).sort((a, b) => a - b),
      strongComponentSizes: artifact.cuts.strongComponents.map(g => g.length).sort((a, b) => a - b), connectivity: artifact.cuts.connectivity },
    thresholdEvents: events.value }, provenance: { frames: provenance, thresholdEvents: events.provenance,
      degenerateEdgeIds: stop.edgeIds, cuts: artifact.cuts } };
}
export function geometricFeature(id, coverage, descriptor, reason) {
  const state = !descriptor ? "unavailable" : coverage.complete ? "observed" : "partial";
  return { id, state, coverage, value: descriptor?.value ?? null, provenance: descriptor?.provenance ?? null,
    reasons: reason ? [reason] : [], valueHash: descriptor ? geometricHash("feature-value", { id, value: descriptor.value }) : null };
}
export function geometricSummary(features) {
  const coverage = geometricCoverage(features.filter(f => f.state === "observed").length, features.length);
  return { status: coverage.complete ? "complete" : "indeterminate", coverage,
    partialFeatureIds: features.filter(f => f.state === "partial").map(f => f.id),
    unavailableFeatureIds: features.filter(f => f.state === "unavailable").map(f => f.id) };
}
