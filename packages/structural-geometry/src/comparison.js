import { canonicalize, deepFreeze, isContentHash } from "@onto2d/kernel/canonical";
import { verifyModelPack } from "@onto2d/model-pack";
import { getDistinguishabilityRegime } from "./regimes.js";
import { observeCanonicalStructure } from "./canonical.js";
import { observeStructuralTopology, TOPOLOGY_OBSERVATION_IMPLEMENTATION } from "./topology.js";
import { alignTypedRelations } from "./typed-vocabulary.js";
import { packFromEngineModel } from "./engine-model.js";
import { STRUCTURAL_COMPARISON_POLICY, comparisonClone, comparisonEncoded, comparisonFail,
  comparisonHash, comparisonObject, comparisonReference, summarizeComparison } from "./comparison-core.js";

export { STRUCTURAL_COMPARISON_POLICY } from "./comparison-core.js";
export const STRUCTURAL_COMPARISON_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-comparison-input.schema.json";
export const STRUCTURAL_COMPARISON_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-comparison-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: "structural-comparison", version: "1" });

function normalize(input) {
  const raw = comparisonObject(comparisonClone(input), ["regimeId", "leftScope", "rightScope", "vocabulary", "evidenceGaps"], ["regimeId"]);
  const regime = getDistinguishabilityRegime(raw.regimeId);
  if (regime.id !== "typed-relations-v1" && Object.hasOwn(raw, "vocabulary")) {
    comparisonFail("INPUT_INVALID", "Vocabulary alignment options require the typed-relations-v1 regime.");
  }
  const gaps = Object.hasOwn(raw, "evidenceGaps") ? raw.evidenceGaps : [];
  if (!Array.isArray(gaps) || gaps.length > STRUCTURAL_COMPARISON_POLICY.limits.maxEvidenceGaps) {
    comparisonFail("INPUT_INVALID", "Evidence restrictions require a bounded array.");
  }
  const order = new Map(regime.observables.map((s, i) => [s.id, i])), seen = new Set();
  for (const gap of gaps) {
    comparisonObject(gap, ["side", "observableId", "disposition", "reference", "contentHash"]);
    if (!["left", "right"].includes(gap.side) || !order.has(gap.observableId) || !["unavailable", "rejected"].includes(gap.disposition) ||
        typeof gap.reference !== "string" || !gap.reference.length || gap.reference !== gap.reference.trim() || !isContentHash(gap.contentHash)) {
      comparisonFail("INPUT_INVALID", "Evidence restrictions require a current observable, side, disposition and content-bound reason.");
    }
    const key = `${gap.side}:${gap.observableId}`;
    if (seen.has(key)) comparisonFail("INPUT_INVALID", "Only one use restriction is allowed per side and observable.");
    seen.add(key);
  }
  gaps.sort((a, b) => order.get(a.observableId) - order.get(b.observableId) || (a.side === b.side ? 0 : a.side === "left" ? -1 : 1));
  const side = (key) => ({ regimeId: regime.id, scope: Object.hasOwn(raw, key) ? raw[key] : { kind: "full" } });
  return { regime, leftInput: side("leftScope"), rightInput: side("rightScope"),
    vocabulary: Object.hasOwn(raw, "vocabulary") ? raw.vocabulary : {}, gaps };
}

function evaluate(leftPack, rightPack, request) {
  const { regime, leftInput, rightInput } = request;
  if (regime.id === "typed-relations-v1") {
    const alignment = alignTypedRelations(leftPack, leftInput, rightPack, rightInput, request.vocabulary);
    const { left, right } = alignment.sources;
    return { evidence: { kind: "typed", alignment }, leftPreparation: left.preparation, rightPreparation: right.preparation,
      vocabulary: { mappingHash: alignment.mapping?.artifactHash ?? null, approvedMappingHash: alignment.request.approvedMappingHash },
      rows: [{ family: "structure", left: left.observations[0], right: right.observations[0], reasons: [] },
        { family: "typed-relations", left: { availability: left.observations[1].availability, value: alignment.aligned?.left.value ?? null },
          right: { availability: right.observations[1].availability, value: alignment.aligned?.right.value ?? null },
          reasons: alignment.compatibility.reasons }] };
  }
  const observe = regime.id === "canonical-structure-v1" ? observeCanonicalStructure : observeStructuralTopology;
  const left = observe(leftPack, leftInput), right = observe(rightPack, rightInput);
  const value = (v) => ({ availability: "observed", value: v });
  const rows = regime.id === "canonical-structure-v1"
    ? [{ family: "structure", left: value(left.observation.value), right: value(right.observation.value), reasons: [] }]
    : TOPOLOGY_OBSERVATION_IMPLEMENTATION.valueFields.map(({ field }) => ({ family: "topology",
      left: value(left.observation.value[field]), right: value(right.observation.value[field]), reasons: [] }));
  return { evidence: { kind: regime.id === "canonical-structure-v1" ? "canonical" : "topology", left, right },
    leftPreparation: left.preparation, rightPreparation: right.preparation, vocabulary: null, rows };
}

export function compareStructuralModels(leftPack, rightPack, input) {
  const request = normalize(input);
  // Use restrictions never suppress verification or swallow evaluator failures.
  const evaluated = evaluate(leftPack, rightPack, request);
  const components = evaluated.rows.map((row, index) => {
    const observable = request.regime.observables[index], reasons = [...row.reasons];
    const side = (name) => {
      const gap = request.gaps.find((g) => g.side === name && g.observableId === observable.id);
      if (gap) reasons.push({ code: `evidence-${gap.disposition}`, side: name, reference: gap.reference, contentHash: gap.contentHash });
      return { availability: row[name].availability, disposition: gap?.disposition ?? "accepted" };
    };
    const left = side("left"), right = side("right");
    const comparable = !reasons.length && left.availability === "observed" && right.availability === "observed" &&
      left.disposition === "accepted" && right.disposition === "accepted";
    return { observable, family: row.family, mandatory: true, left, right,
      values: comparable ? { left: row.left.value, right: row.right.value } : null,
      state: !comparable ? "indeterminate" : canonicalize(row.left.value) === canonicalize(row.right.value) ? "equal" : "different", reasons };
  });
  const body = { schemaVersion: "1", analysis: ANALYSIS, policy: STRUCTURAL_COMPARISON_POLICY,
    regime: comparisonReference(request.regime), request: { regimeId: request.regime.id,
      leftScope: evaluated.leftPreparation.request.scope, rightScope: evaluated.rightPreparation.request.scope,
      vocabulary: evaluated.vocabulary, evidenceGaps: request.gaps }, evidence: evaluated.evidence, components,
    ...summarizeComparison(components) };
  const artifact = { ...body, artifactHash: comparisonHash("artifact", body) };
  comparisonEncoded(artifact);
  return deepFreeze(artifact);
}

export function verifyStructuralComparison(value, leftPack, rightPack, input) {
  const expected = compareStructuralModels(leftPack, rightPack, input);
  if (comparisonEncoded(value) !== comparisonEncoded(expected)) comparisonFail("VERIFICATION_FAILED", "Comparison differs from expected sources, scopes, regime, vocabulary approval, evidence restrictions or exact replay.");
  return expected;
}

export function createStructuralComparisonAnalysis(rightPack) {
  const rightSource = verifyModelPack(rightPack);
  return Object.freeze({ ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_COMPARISON_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_COMPARISON_ARTIFACT_SCHEMA]),
    run(context, input) { return compareStructuralModels(packFromEngineModel(context?.model), rightSource, input); } });
}
