import { canonicalClone } from "@onto2d/kernel/canonical";
import { packFromEngineModel } from "./engine-model.js";
import { runStructuralResponseProbes } from "./responses.js";
import { runStructuralInvarianceProbes } from "./invariance.js";
import { STRUCTURAL_RESPONSE_SIGNATURE_POLICY, SIGNATURE_CODEC, signatureHash,
  signatureEncoded, signatureSeal, signatureFail, signatureProfile, signatureFeature, summarizeSignature } from "./signature-core.js";

export { STRUCTURAL_RESPONSE_SIGNATURE_POLICY } from "./signature-core.js";
export const STRUCTURAL_RESPONSE_SIGNATURE_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-response-signature-input.schema.json";
export const STRUCTURAL_RESPONSE_SIGNATURE_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-response-signature-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: "structural-response-signature", version: "1" });

export function runStructuralResponseSignature(pack, input) {
  const request = canonicalClone(input, SIGNATURE_CODEC);
  if (!request || typeof request !== "object" || Array.isArray(request) || !Object.hasOwn(request, "regimeId") ||
      Object.keys(request).some(k => !["regimeId", "scope"].includes(k))) signatureFail("INPUT_INVALID", "Expected an explicit regime and optional scope only.");
  const responses = runStructuralResponseProbes(pack, request), invariance = runStructuralInvarianceProbes(pack, request);
  if (signatureEncoded(responses.preparation) !== signatureEncoded(invariance.preparation)) {
    signatureFail("BINDING_MISMATCH", "Response and invariance evidence differ in source, scope or regime.");
  }
  const evidence = { responses, invariance };
  // Account for both complete upstream artifacts before adding feature copies.
  let bytes = new TextEncoder().encode(signatureEncoded(evidence)).length;
  const profile = signatureProfile(responses.preparation.regime), source = {
    contextHash: responses.preparation.context.contextHash, scopeHash: responses.preparation.scope.scopeHash
  };
  const features = responses.probes.map((probe, i) => {
    const feature = signatureFeature(probe, profile.features[i], profile.profileHash);
    bytes += new TextEncoder().encode(signatureEncoded(feature)).length;
    if (bytes > STRUCTURAL_RESPONSE_SIGNATURE_POLICY.limits.maxArtifactBytes) signatureFail("LIMIT_EXCEEDED", "Cumulative signature output exceeds its byte budget.");
    return feature;
  });
  const summary = summarizeSignature(features, invariance.summary.status);
  const value = summary.status === "complete" ? { features: features.map(f => ({ id: f.id, value: f.value })) } : null;
  const work = {
    featureRows: features.reduce((n, f) => n + (f.value?.length ?? 0), 0),
    featureComponentVisits: responses.probes.reduce((n, p, i) => n + (features[i].state === "observed" ?
      p.runs.reduce((m, r) => m + r.response.components.length, 0) : 0), 0),
    observationEvaluations: responses.work.observationEvaluations + invariance.work.observationEvaluations,
    canonicalizerCalls: responses.work.canonicalizerCalls + invariance.work.canonicalizerCalls
  };
  const limits = STRUCTURAL_RESPONSE_SIGNATURE_POLICY.limits;
  if (features.length > limits.maxFeatures || work.featureRows > limits.maxFeatureRows ||
      work.featureComponentVisits > limits.maxFeatureComponentVisits || work.observationEvaluations > limits.maxObservationEvaluations ||
      work.canonicalizerCalls > limits.maxCanonicalizerCalls) signatureFail("LIMIT_EXCEEDED", "Signature composition exceeds its fixed work budget.");
  return signatureSeal("artifact", { schemaVersion: "1", analysis: ANALYSIS, evaluation: "measured",
    policy: STRUCTURAL_RESPONSE_SIGNATURE_POLICY, request: responses.request, source, profile,
    comparisonContext: request.regimeId === "typed-relations-v1" ? { kind: "source-local-typed", contextHash: source.contextHash }
      : { kind: "untyped-graph" },
    evidence, features, summary, value,
    valueHash: value === null ? null : signatureHash("value", { profileHash: profile.profileHash, value }), work });
}
export function verifyStructuralResponseSignature(value, pack, input) {
  const expected = runStructuralResponseSignature(pack, input);
  if (signatureEncoded(value) !== signatureEncoded(expected)) signatureFail("VERIFICATION_FAILED",
    "Signature differs from expected source, scope, policies, complete evidence, response features or eligibility.");
  return expected;
}
export function createStructuralResponseSignatureAnalysis() {
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_RESPONSE_SIGNATURE_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_RESPONSE_SIGNATURE_ARTIFACT_SCHEMA]),
    run(context, input) { return runStructuralResponseSignature(packFromEngineModel(context?.model), input); } });
}
