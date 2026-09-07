import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { STRUCTURAL_RESPONSE_SIGNATURE_POLICY } from "./signature.js";

export const PSEUDOMETRIC_CODEC = Object.freeze({ limits: Object.freeze({ maxEntries: 2000000 }) });
export const pseudometricReference = ({ id, version, contentHash }) => ({ id, version, contentHash });
export const pseudometricHash = (kind, value) => hashCanonical(`onto2d:structural-pseudometric-${kind}:v1`, value, PSEUDOMETRIC_CODEC);
export function pseudometricFail(code, message) { throw new EngineError(`STRUCTURAL_PSEUDOMETRIC_${code}`, message); }
export function pseudometricEncoded(value) {
  const text = canonicalize(value, PSEUDOMETRIC_CODEC);
  if (new TextEncoder().encode(text).length > 16777216) pseudometricFail("LIMIT_EXCEEDED", "Pseudometric output exceeds its 16 MiB budget.");
  return text;
}
export function pseudometricSeal(kind, body, field = "artifactHash") {
  const result = { ...body, [field]: pseudometricHash(kind, body) }; pseudometricEncoded(result); return deepFreeze(result);
}
export const STRUCTURAL_PSEUDOMETRIC_POLICY = pseudometricSeal("policy", {
  id: "fixed-domain-response-pseudometric-v0", version: "1",
  signature: pseudometricReference(STRUCTURAL_RESPONSE_SIGNATURE_POLICY),
  components: "all-ordered-compatible-signature-families",
  componentDistance: "exact-joint-multiset-mismatch-zero-or-one", weight: 1, scale: 1,
  aggregation: "mismatch-count-over-fixed-family-count",
  numeric: "reduced-bounded-integer-fraction-zero-is-0-over-1",
  domain: "complete-signature-with-passed-invariance",
  untypedDomain: "common-fixed-profile", typedDomain: "one-verified-full-source-context",
  vocabulary: "no-pairwise-mapping-or-approval-override",
  missingness: "strict-null-distance-retain-component-reasons",
  partial: "opt-in-pairwise-available-mean-no-metric-guarantee",
  equality: "exact-values-not-fingerprints", metadata: "excluded-from-distance",
  errors: "throw-no-partial-artifact",
  limits: { maxComponents: 5, maxObservationEvaluations: 140, maxCanonicalizerCalls: 280,
    maxCanonicalEntries: 2000000, maxArtifactBytes: 16777216 }
}, "contentHash");

export function pseudometricProfile(signature) {
  return pseudometricSeal("profile", { policy: pseudometricReference(STRUCTURAL_PSEUDOMETRIC_POLICY),
    regime: signature.profile.regime, signatureProfileHash: signature.profile.profileHash,
    components: signature.profile.features.map(f => ({ featureId: f.id, weight: 1, scale: 1 })) }, "profileHash");
}
export function pseudometricDomain(signature, profile) {
  return pseudometricSeal("domain", { profileHash: profile.profileHash, vocabulary: signature.comparisonContext,
    membership: "complete-signature-with-passed-invariance" }, "domainHash");
}
export function fraction(numerator, denominator) {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || numerator < 0 ||
      denominator < 1 || numerator > denominator || denominator > 5) pseudometricFail("NUMERIC_INVALID", "Expected a bounded nonnegative ratio of at most five components.");
  let a = numerator, b = denominator;
  while (b) { const rest = a % b; a = b; b = rest; }
  return { numerator: numerator / a, denominator: denominator / a };
}
export function featureMismatch(left, right) { return pseudometricEncoded(left) === pseudometricEncoded(right) ? 0 : 1; }

// Private component extraction consumes only freshly rebuilt signature evidence.
export function pseudometricComponents(left, right, compatible) {
  if (left.profile.profileHash !== right.profile.profileHash || left.features.length !== right.features.length) {
    pseudometricFail("PROFILE_MISMATCH", "Signature profiles differ.");
  }
  return left.features.map((a, i) => {
    const b = right.features[i], reasons = [];
    if (a.id !== b.id) pseudometricFail("PROFILE_MISMATCH", "Signature feature order differs.");
    if (!compatible) reasons.push({ side: "pair", code: "incompatible-domain", count: 1 });
    const side = (name, signature, feature) => {
      for (const gap of feature.reasons) reasons.push({ side: name, ...gap });
      if (signature.summary.invarianceStatus !== "passed") reasons.push({ side: name, code: `invariance-${signature.summary.invarianceStatus}`, count: 1 });
      return { measurement: feature.state, valueHash: feature.valueHash };
    };
    const leftState = side("left", left, a), rightState = side("right", right, b);
    const comparable = !reasons.length && a.state === "observed" && b.state === "observed";
    const distance = comparable ? featureMismatch(a.value, b.value) : null;
    return { featureId: a.id, weight: 1, scale: 1, left: leftState, right: rightState,
      state: !comparable ? "indeterminate" : distance === 0 ? "equal" : "different", distance, reasons };
  });
}
export function summarizePseudometric(components, mode) {
  const equalFeatureIds = [], differentFeatureIds = [], incompleteFeatureIds = [];
  for (const c of components) (c.state === "equal" ? equalFeatureIds : c.state === "different" ? differentFeatureIds : incompleteFeatureIds).push(c.featureId);
  const numerator = equalFeatureIds.length + differentFeatureIds.length, denominator = components.length;
  const complete = denominator > 0 && numerator === denominator, coverage = { numerator, denominator, complete };
  const distance = complete ? fraction(differentFeatureIds.length, denominator) : null;
  return { status: !complete ? "indeterminate" : distance.numerator === 0 ? "indistinguishable-under-signature" : "distinguishable-under-signature",
    distance, coverage, diagnostics: { equalFeatureIds, differentFeatureIds, incompleteFeatureIds,
      partial: mode === "partial-with-coverage" ? { kind: "exploratory-pairwise-available-mean", guarantee: "none", coverage,
        value: numerator ? fraction(differentFeatureIds.length, numerator) : null } : null } };
}
