import { canonicalClone } from "@onto2d/kernel/canonical";
import { verifyModelPack } from "@onto2d/model-pack";
import { getDistinguishabilityRegime } from "./regimes.js";
import { runStructuralResponseSignature } from "./signature.js";
import { packFromEngineModel } from "./engine-model.js";
import { STRUCTURAL_PSEUDOMETRIC_POLICY, PSEUDOMETRIC_CODEC, pseudometricEncoded, pseudometricFail,
  pseudometricSeal, pseudometricProfile, pseudometricDomain, pseudometricComponents, summarizePseudometric } from "./pseudometric-core.js";

export { STRUCTURAL_PSEUDOMETRIC_POLICY } from "./pseudometric-core.js";
export const STRUCTURAL_PSEUDOMETRIC_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-pseudometric-input.schema.json";
export const STRUCTURAL_PSEUDOMETRIC_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-pseudometric-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: "structural-pseudometric", version: "1" });

export function compareStructuralSignatures(leftPack, rightPack, input) {
  const raw = canonicalClone(input, PSEUDOMETRIC_CODEC);
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.hasOwn(raw, "regimeId") ||
      Object.keys(raw).some(k => !["regimeId", "leftScope", "rightScope", "diagnostics"].includes(k))) {
    pseudometricFail("INPUT_INVALID", "Expected an explicit regime, optional scopes and diagnostic mode only.");
  }
  getDistinguishabilityRegime(raw.regimeId);
  const mode = raw.diagnostics ?? "coverage-only";
  if (!["coverage-only", "partial-with-coverage"].includes(mode) || (Object.hasOwn(raw, "diagnostics") && raw.diagnostics === null)) {
    pseudometricFail("INPUT_INVALID", "Unsupported pseudometric diagnostic mode.");
  }
  const sideInput = side => ({ regimeId: raw.regimeId, scope: Object.hasOwn(raw, side) ? raw[side] : { kind: "full" } });
  const left = runStructuralResponseSignature(leftPack, sideInput("leftScope"));
  const right = runStructuralResponseSignature(rightPack, sideInput("rightScope"));
  const evidence = { left, right }, profile = pseudometricProfile(left);
  let bytes = new TextEncoder().encode(pseudometricEncoded(evidence)).length;
  const leftDomain = pseudometricDomain(left, profile), rightDomain = pseudometricDomain(right, pseudometricProfile(right));
  const compatible = leftDomain.domainHash === rightDomain.domainHash;
  const components = pseudometricComponents(left, right, compatible);
  for (const component of components) bytes += new TextEncoder().encode(pseudometricEncoded(component)).length;
  const work = { componentComparisons: components.filter(c => c.state !== "indeterminate").length,
    observationEvaluations: left.work.observationEvaluations + right.work.observationEvaluations,
    canonicalizerCalls: left.work.canonicalizerCalls + right.work.canonicalizerCalls };
  const limits = STRUCTURAL_PSEUDOMETRIC_POLICY.limits;
  if (bytes > limits.maxArtifactBytes || components.length > limits.maxComponents ||
      work.observationEvaluations > limits.maxObservationEvaluations || work.canonicalizerCalls > limits.maxCanonicalizerCalls) {
    pseudometricFail("LIMIT_EXCEEDED", "Pseudometric composition exceeds its fixed cumulative budget.");
  }
  return pseudometricSeal("artifact", { schemaVersion: "1", analysis: ANALYSIS, evaluation: "measured",
    policy: STRUCTURAL_PSEUDOMETRIC_POLICY, profile,
    request: { regimeId: raw.regimeId, leftScope: left.request.scope, rightScope: right.request.scope, diagnostics: mode },
    domains: { left: leftDomain, right: rightDomain, compatible, commonDomainHash: compatible ? leftDomain.domainHash : null,
      membership: { left: left.summary.status === "complete" ? "eligible" : "ineligible",
        right: right.summary.status === "complete" ? "eligible" : "ineligible" } },
    evidence, components, ...summarizePseudometric(components, mode), work });
}
export function verifyStructuralPseudometric(value, leftPack, rightPack, input) {
  const expected = compareStructuralSignatures(leftPack, rightPack, input);
  if (pseudometricEncoded(value) !== pseudometricEncoded(expected)) pseudometricFail("VERIFICATION_FAILED",
    "Pseudometric differs from expected sources, scopes, fixed domains, signature evidence, exact fractions or coverage.");
  return expected;
}
export function createStructuralPseudometricAnalysis(rightPack) {
  const right = verifyModelPack(rightPack);
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_PSEUDOMETRIC_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_PSEUDOMETRIC_ARTIFACT_SCHEMA]),
    run(context, input) { return compareStructuralSignatures(packFromEngineModel(context?.model), right, input); } });
}
