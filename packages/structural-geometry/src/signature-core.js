import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { STRUCTURAL_RESPONSE_POLICY, STRUCTURAL_RESPONSE_REGISTRY, STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER } from "./responses.js";
import { STRUCTURAL_INVARIANCE_POLICY, STRUCTURAL_INVARIANCE_REGISTRY, STRUCTURAL_SHADOW_OBSERVATION_ADAPTER } from "./invariance.js";

export const SIGNATURE_CODEC = Object.freeze({ limits: Object.freeze({ maxEntries: 1000000 }) });
export const signatureReference = ({ id, version, contentHash }) => ({ id, version, contentHash });
export const signatureHash = (kind, body) => hashCanonical(`onto2d:structural-response-signature-${kind}:v1`, body, SIGNATURE_CODEC);
export function signatureFail(code, message) { throw new EngineError(`STRUCTURAL_RESPONSE_SIGNATURE_${code}`, message); }
export function signatureEncoded(value) {
  const encoded = canonicalize(value, SIGNATURE_CODEC);
  if (new TextEncoder().encode(encoded).length > 8388608) signatureFail("LIMIT_EXCEEDED", "Signature output exceeds its 8 MiB byte budget.");
  return encoded;
}
export function signatureSeal(kind, body, field = "artifactHash") {
  const result = { ...body, [field]: signatureHash(kind, body) };
  signatureEncoded(result); return deepFreeze(result);
}
const names = ["feedback", "necessary", "enabling", "direction", "support"];
export const STRUCTURAL_RESPONSE_SIGNATURE_POLICY = signatureSeal("policy", {
  id: "graph-native-response-signature-v0", version: "1",
  response: { policy: signatureReference(STRUCTURAL_RESPONSE_POLICY), registry: signatureReference(STRUCTURAL_RESPONSE_REGISTRY),
    adapter: signatureReference(STRUCTURAL_RESPONSE_OBSERVATION_ADAPTER) },
  invariance: { policy: signatureReference(STRUCTURAL_INVARIANCE_POLICY), registry: signatureReference(STRUCTURAL_INVARIANCE_REGISTRY),
    adapter: signatureReference(STRUCTURAL_SHADOW_OBSERVATION_ADAPTER) },
  features: STRUCTURAL_RESPONSE_REGISTRY.probes.map((probe, i) => ({
    id: `${names[i]}-response-multiset-v0`, probe: signatureReference(probe), regimeIds: probe.regimeIds,
    mandatory: true, value: "joint-complete-response-multiset", multiplicity: "exact-positive-integer-count",
    coordinates: "ordered-observable-id-state-scalar-delta", applicability: "nonempty-exhaustive-applied-complete-targets"
  })),
  aggregation: "canonical-joint-row-grouping-with-multiplicity",
  missingness: "null-whole-feature-no-partial-histogram-or-default-zero",
  coverage: "observed-features-over-fixed-compatible-profile",
  eligibility: "all-features-observed-and-all-invariance-controls-passed",
  valueHash: "fixed-profile-and-value-only-no-provenance-or-availability",
  typedComparison: "source-local-vocabulary-authority-required-separately",
  evidence: "complete-source-bound-response-and-invariance-artifacts",
  integrations: "graph-native-only-history-motif-admissibility-identity-unconfigured",
  geometry: "excluded", distance: "deferred-to-R6",
  limits: { maxFeatures: 5, maxFeatureRows: 64, maxFeatureComponentVisits: 448,
    maxObservationEvaluations: 70, maxCanonicalizerCalls: 140, maxCanonicalEntries: 1000000, maxArtifactBytes: 8388608 }
}, "contentHash");

export function signatureProfile(regime) {
  return signatureSeal("profile", { policy: signatureReference(STRUCTURAL_RESPONSE_SIGNATURE_POLICY),
    regime: signatureReference(regime),
    features: STRUCTURAL_RESPONSE_SIGNATURE_POLICY.features.filter(f => f.regimeIds.includes(regime.id))
      .map(f => ({ id: f.id, probe: f.probe, observables: regime.observables })) }, "profileHash");
}

// Private aggregation consumes freshly rebuilt response runs, never caller claims.
export function signatureFeature(probe, definition, profileHash) {
  const reasons = [];
  if (probe.execution.reason) reasons.push({ code: probe.execution.reason, count: 1 });
  const rejected = probe.runs.filter(r => r.execution === "rejected").length;
  const missing = probe.runs.filter(r => r.execution === "applied" && r.response.status === "indeterminate").length;
  if (rejected) reasons.push({ code: "rejected-transformations", count: rejected });
  if (missing) reasons.push({ code: "missing-observations", count: missing });
  const observed = probe.selection.state === "complete" && probe.runs.length > 0 && !reasons.length;
  let value = null;
  if (observed) {
    const rows = new Map();
    for (const run of probe.runs) {
      const components = run.response.components.map(c => ({ observableId: c.observableId, state: c.state, delta: c.delta }));
      const key = signatureEncoded(components);
      if (rows.has(key)) rows.get(key).count += 1;
      else rows.set(key, { components, count: 1 });
    }
    value = [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, row]) => row);
  }
  return { id: definition.id, probeId: definition.probe.id, state: observed ? "observed" : "indeterminate",
    value, valueHash: value === null ? null : signatureHash("feature-value", { profileHash, id: definition.id, value }),
    coverage: probe.summary.coverage, reasons, evidence: { probeHash: probe.probeHash } };
}

export function summarizeSignature(features, invarianceStatus) {
  const numerator = features.filter(f => f.state === "observed").length, denominator = features.length;
  const complete = denominator > 0 && numerator === denominator, reasons = [];
  if (!complete) reasons.push("incomplete-response-features");
  if (invarianceStatus !== "passed") reasons.push(`invariance-${invarianceStatus}`);
  return { status: reasons.length ? "indeterminate" : "complete",
    coverage: { numerator, denominator, complete }, invarianceStatus, reasons };
}
