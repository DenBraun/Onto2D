import { canonicalClone, deepFreeze } from "@onto2d/kernel/canonical";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { prepareStructuralRegime } from "./regimes.js";
import { canonicalizeDirectedStructure } from "./canonical-core.js";
import { packFromEngineModel } from "./engine-model.js";
import { canonicalizeTypedDirectedStructure, normalizeEdgeTypes, typedFields, typedRegime, typedFail } from "./typed-core.js";
import { typedHash, typedReference, typedEncoded, typedSeal, localTypedVocabulary, scopedTypedEdges } from "./typed-common.js";

export const STRUCTURAL_TYPED_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-typed-input.schema.json";
export const STRUCTURAL_TYPED_OBSERVATION_SCHEMA = "https://onto2d.dev/schemas/v1/structural-typed-observation.schema.json";
const implementation = { id: "typed-directed-observation-v1", version: "1", kernelOperation: "canonicalizeCandidate",
  kernelCanonicalSchemaVersion: "1", inputOrdering: "source-id-ascending",
  valueEncoding: "node-count-and-directed-endpoints-with-five-joint-edge-fields",
  setEncoding: "canonical-json-string-of-numeric-sorted-distinct-integers", sourceAudit: "all-present-fields-before-scoped-measurement",
  missingScopedField: "null-typed-value-with-explicit-evidence-gaps", vocabularyMeaning: "source-local-codes-require-separate-comparison-compatibility",
  witnessMeaning: "one-common-bijection-not-canonical-orbits", otherAttributes: "excluded" };
export const TYPED_RELATIONS_IMPLEMENTATION = deepFreeze({ ...implementation, contentHash: typedHash("implementation", implementation) });

export function observeTypedRelations(pack, input) {
  const request = canonicalClone(input);
  if (!request || typeof request !== "object" || Array.isArray(request) || !Object.hasOwn(request, "regimeId")) {
    typedFail("INPUT_INVALID", "Typed observation requires an explicit regime request.");
  }
  if (request.regimeId !== typedRegime.id) typedFail("REGIME_UNSUPPORTED", "This evaluator implements only typed-relations-v1.");
  const source = verifyModelPack(pack), preparation = prepareStructuralRegime(source, request);
  // Missing excluded fields do not become scoped evidence gaps, but a present
  // malformed field anywhere in the full source is never hidden by scoping.
  for (const edge of source.files[modelPackFilePaths().edges]) normalizeEdgeTypes(edge);
  const edges = scopedTypedEdges(source, preparation), missing = [];
  for (const edge of edges) for (const field of normalizeEdgeTypes(edge).missing) missing.push({ sourceEdgeId: edge.id, field });
  const untyped = canonicalizeDirectedStructure(preparation.scope.nodeIds, edges);
  const typed = missing.length ? null : canonicalizeTypedDirectedStructure(preparation.scope.nodeIds, edges);
  const observations = [untyped, typed].map((result, i) => {
    const binding = { regime: typedReference(typedRegime), observable: typedRegime.observables[i],
      implementation: typedReference(TYPED_RELATIONS_IMPLEMENTATION), value: result?.value ?? null };
    return { ...binding, availability: result ? "observed" : "missing",
      valueHash: result ? typedHash("value", binding) : null, witness: result?.witness ?? null };
  });
  return typedSeal("observation", { schemaVersion: "1", analysis: { id: "structural-typed-observation", version: "1" },
    evaluation: typed ? "measured" : "incomplete", implementation: TYPED_RELATIONS_IMPLEMENTATION, preparation,
    vocabulary: localTypedVocabulary(preparation.context), observations,
    evidence: { requiredFieldCount: edges.length * typedFields.length,
      observedFieldCount: edges.length * typedFields.length - missing.length, missing } });
}
export function verifyTypedRelationsObservation(value, pack, input) {
  const expected = observeTypedRelations(pack, input);
  if (typedEncoded(value) !== typedEncoded(expected)) typedFail("VERIFICATION_FAILED", "Typed observation differs from expected source, scope, vocabulary or exact replay.");
  return expected;
}
export function createTypedRelationsObservationAnalysis() {
  return Object.freeze({ id: "structural-typed-observation", version: "1",
    requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_TYPED_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_TYPED_OBSERVATION_SCHEMA]),
    run(context, input) { return observeTypedRelations(packFromEngineModel(context?.model), input); } });
}
