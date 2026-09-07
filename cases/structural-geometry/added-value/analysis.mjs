import assert from "node:assert/strict";
import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";

export const CODEC = Object.freeze({ limits: Object.freeze({ maxEntries: 3000000 }) });
export const BASELINES = Object.freeze(["counts", "degrees", "topology", "motifs", "spectrum", "refinement", "canonical"]);
export const LIMITS = Object.freeze({ units: 68, pairs: 531, unitBytes: 33554432, totalUnitBytes: 134217728, suiteBytes: 8388608 });
export const encoded = value => canonicalize(value, CODEC);
export const same = (a, b) => encoded(a) === encoded(b);
export function seal(kind, body, limit) {
  const value = { ...body, [kind === "unit" ? "unitHash" : "artifactHash"]: hashCanonical(`onto2d:geometric-added-value-${kind}:v1`, body, CODEC) };
  assert.ok(new TextEncoder().encode(encoded(value)).length <= limit, "Study artifact exceeds its byte bound.");
  return deepFreeze(value);
}
export function ratio(n, d) {
  assert.ok(Number.isSafeInteger(n) && Number.isSafeInteger(d) && d >= 0 && n >= 0 && n <= d, "Invalid finite ratio.");
  if (!d) return null;
  let a = n, b = d;
  while (b) [a, b] = [b, a % b];
  return { numerator: n / a, denominator: d / a };
}
export function distance(left, right) {
  assert.equal(left.length, right.length); assert.ok(left.length > 0);
  return ratio(left.filter((v, i) => !same(v, right[i])).length, left.length);
}
export function eligibility(response, geometry) {
  assert.equal(response.request.regimeId, "topology-only-v1");
  assert.deepEqual(response.request.scope, { kind: "full" });
  assert.equal(response.source.contextHash, geometry.source.contextHash, "Mixed response/geometry source context.");
  const scope = response.evidence.responses.preparation.scope;
  assert.deepEqual(scope.nodeIds, geometry.population.nodeIds, "Mixed node population.");
  assert.deepEqual(scope.edgeIds, geometry.population.edgeIds, "Mixed edge population.");
  // The study only admits the frozen exact unit metric. A complete interval
  // descriptor or a matching hash does not extend this comparison domain.
  assert.equal(geometry.request.forman.analysis, "structural-geometry");
  assert.equal(geometry.request.forman.metricProviderId, "unit-v1");
  assert.deepEqual(geometry.request.forman, { analysis: "structural-geometry", metricProviderId: "unit-v1" });
  assert.equal(geometry.profile.flow.initialization, "unit");
  assert.equal(geometry.profile.ollivier.idleness, "half");
  assert.deepEqual(geometry.request.ollivier.scope, { kind: "full" });
  assert.deepEqual(geometry.request.ollivier.edgeIds, geometry.population.edgeIds);
  const { scope: flowScope, initialLengths, ...flowParameters } = geometry.request.flow;
  assert.deepEqual(flowScope, { kind: "full" });
  assert.ok(initialLengths.every(e => same(e.length, { numerator: "1", denominator: "1" })));
  assert.deepEqual(flowParameters, { maxIterations: 4, step: "half", idleness: "half",
    tolerance: { numerator: "1", denominator: "1000000" }, stableSteps: 2,
    cut: { kind: "final-length", threshold: { numerator: "2", denominator: "1" } } });
  assert.equal(geometry.features[0].value.numeric, "exact-rational");
  assert.ok(geometry.features[0].value.distribution.every(r => same(r.value.lower, r.value.upper)));
  const responseComplete = response.summary.status === "complete" && response.summary.invarianceStatus === "passed";
  const staticComplete = responseComplete && geometry.features.slice(0, 2).every(f => f.state === "observed");
  const combined = staticComplete && geometry.summary.status === "complete";
  return { response: responseComplete, static: staticComplete, combined,
    reasons: [...response.summary.reasons.map(code => `response:${code}`),
      ...geometry.features.flatMap(f => f.reasons.map(code => `${f.id}:${code}`))] };
}
// Only freshly reconstructed, fixed-profile study units reach this extractor.
export function comparePair(spec, left, right) {
  assert.equal(left.studyHash, right.studyHash);
  assert.equal(left.evidence.response.profile.profileHash, right.evidence.response.profile.profileHash);
  assert.deepEqual(left.evidence.geometry.profile, right.evidence.geometry.profile);
  const coords = unit => [...unit.evidence.response.features.map(f => f.value), ...unit.evidence.geometry.features.map(f => f.value)];
  const a = coords(left), b = coords(right), raw = {};
  for (const [name, count] of [["response", 3], ["static", 5], ["combined", 6]]) raw[name] = left.eligibility[name] && right.eligibility[name] ? distance(a.slice(0, count), b.slice(0, count)) : null;
  const eligible = raw.combined !== null;
  return { ...spec, eligible, raw,
    matched: { response: eligible ? raw.response : null, static: eligible ? raw.static : null, combined: raw.combined },
    coverage: Object.fromEntries(["response", "static", "combined"].map(name => [name, { numerator: Number(left.eligibility[name]) + Number(right.eligibility[name]), denominator: 2 }])),
    reasons: [left, right].flatMap((u, i) => u.eligibility.reasons.map(code => ({ side: i === 0 ? "left" : "right", code }))),
    baselines: Object.fromEntries(BASELINES.map(name => [name, Number(!same(left.baselines[name], right.baselines[name]))])) };
}
const positive = fraction => fraction !== null && fraction.numerator > 0;
export function outcome(pairs, leftName = "response", rightName = "combined") {
  const eligible = pairs.filter(p => p.eligible);
  const both = eligible.filter(p => positive(p.matched[leftName]) && positive(p.matched[rightName])).length;
  const gained = eligible.filter(p => !positive(p.matched[leftName]) && positive(p.matched[rightName])).length;
  const lost = eligible.filter(p => positive(p.matched[leftName]) && !positive(p.matched[rightName])).length;
  assert.equal(lost, 0, "Appending categorical coordinates cannot lose discrimination.");
  return { status: eligible.length ? "measured" : "indeterminate", totalPairs: pairs.length, eligiblePairs: eligible.length,
    excludedPairs: pairs.length - eligible.length, both, gained, lost, neither: eligible.length - both - gained - lost,
    leftRate: ratio(both + lost, eligible.length), rightRate: ratio(both + gained, eligible.length), pairedGain: ratio(gained - lost, eligible.length) };
}
export function summarize(pairs) {
  const negatives = pairs.filter(p => p.split === "evaluation"), positives = pairs.filter(p => p.split === "invariance"), eligible = negatives.filter(p => p.eligible);
  const gains = eligible.filter(p => !positive(p.matched.response) && positive(p.matched.combined));
  return { primary: outcome(negatives), staticToFlow: outcome(negatives, "static"), degreeMatched: outcome(negatives.filter(p => p.degreeMatched)),
    invariance: { totalPairs: positives.length, eligiblePairs: positives.filter(p => p.eligible).length,
      excludedPairs: positives.filter(p => !p.eligible).length,
      responseFalseDifferences: positives.filter(p => positive(p.raw.response)).length,
      combinedFalseDifferences: positives.filter(p => positive(p.raw.combined)).length,
      baselineFalseDifferences: Object.fromEntries(BASELINES.map(name => [name, positives.filter(p => p.baselines[name] !== 0).length])) },
    responseOnlyCoverage: { eligiblePairs: negatives.filter(p => p.raw.response !== null).length, totalPairs: negatives.length,
      lostToGeometry: negatives.filter(p => p.raw.response !== null && !p.eligible).length },
    baselines: BASELINES.map(name => ({ id: name, eligiblePairs: eligible.length,
      distinguished: eligible.filter(p => p.baselines[name] !== 0).length, rate: ratio(eligible.filter(p => p.baselines[name] !== 0).length, eligible.length),
      geometryGainsAlreadyDistinguished: gains.filter(p => p.baselines[name] !== 0).length })),
    unavailableBaselines: [{ id: "typed-motifs", reason: "untyped-source-panel" }, { id: "semantic-roles", reason: "no-declared-domain-role-mapping" }],
    inference: "exact-finite-panel-no-independent-pair-uncertainty-or-population-claim" };
}
