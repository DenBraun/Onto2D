import { canonicalize, deepFreeze, isContentHash } from "@onto2d/kernel/canonical";
import { verifyModelPack } from "@onto2d/model-pack";
import { createStructuralMetricContext } from "./providers.js";
import { observeTypedRelations } from "./typed-observation.js";
import { typedHash, typedReference, typedObject, typedSeal, typedEncoded, localTypedVocabulary, scopedTypedEdges } from "./typed-common.js";
import { typedRegime, typedFields, setFields, typedFail, validTypedAtom, normalizeEdgeTypes, canonicalizeTypedDirectedStructure } from "./typed-core.js";

export const STRUCTURAL_VOCABULARY_MAPPING_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-vocabulary-mapping-input.schema.json";
export const STRUCTURAL_VOCABULARY_MAPPING_SCHEMA = "https://onto2d.dev/schemas/v1/structural-vocabulary-mapping.schema.json";
export const STRUCTURAL_TYPED_ALIGNMENT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-typed-alignment.schema.json";
const policy = { id: "explicit-typed-vocabulary-alignment-v1", version: "1",
  sameSource: "exact-model-binding-and-full-dictionary-hash", crossSource: "explicit-approved-mapping-hash",
  approval: "external-caller-allowance-not-self-asserted-by-mapping", mapping: "partial-bijection-per-field",
  requiredCoverage: "every-scoped-value-on-both-sides", targetVocabulary: "left-source",
  recanonicalization: "joint-fields-after-right-to-left-remapping", missingCompatibility: "unresolved-no-aligned-values",
  maxMappingEntries: 1024, maxCanonicalizerCalls: 5, maxSearchStatesPerCall: 100000, maxArtifactBytes: 1048576 };
export const TYPED_VOCABULARY_ALIGNMENT_POLICY = deepFreeze({ ...policy, contentHash: typedHash("alignment-policy", policy) });
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function nonempty(value) { return typeof value === "string" && value.length > 0 && value === value.trim(); }
function declaration(input) {
  const result = typedObject(input, ["id", "version", "fields", "reviewEvidence"]);
  if (!nonempty(result.id) || result.version !== "1") typedFail("INPUT_INVALID", "Mapping requires an ID and version 1.");
  result.reviewEvidence = typedObject(result.reviewEvidence, ["reference", "contentHash"]);
  if (!nonempty(result.reviewEvidence.reference) || !isContentHash(result.reviewEvidence.contentHash)) {
    typedFail("INPUT_INVALID", "Mapping requires a content-bound review evidence reference; this does not approve the mapping.");
  }
  result.fields = typedObject(result.fields, typedFields);
  let count = 0;
  for (const field of typedFields) {
    const entries = result.fields[field];
    if (!Array.isArray(entries)) typedFail("INPUT_INVALID", "Every field mapping must be an explicit array.");
    count += entries.length;
    if (count > policy.maxMappingEntries) typedFail("LIMIT_EXCEEDED", "Vocabulary mapping exceeds its entry budget.");
    const left = new Set(), right = new Set();
    result.fields[field] = entries.map((raw) => {
      const entry = typedObject(raw, ["left", "right"]);
      if (!validTypedAtom(field, entry.left) || !validTypedAtom(field, entry.right) || left.has(entry.left) || right.has(entry.right)) {
        typedFail("MAPPING_INVALID", "Every field mapping must be an injective pairing of valid left and right values.");
      }
      left.add(entry.left); right.add(entry.right); return entry;
    }).sort((a, b) => compare(a.left, b.left));
  }
  return result;
}
export function createStructuralVocabularyMapping(leftPack, rightPack, input) {
  const request = declaration(input);
  const left = localTypedVocabulary(createStructuralMetricContext(leftPack).binding);
  const right = localTypedVocabulary(createStructuralMetricContext(rightPack).binding);
  return typedSeal("vocabulary-mapping", { schemaVersion: "1", policy: TYPED_VOCABULARY_ALIGNMENT_POLICY,
    regime: typedReference(typedRegime), declaration: request, left, right });
}
export function verifyStructuralVocabularyMapping(value, leftPack, rightPack, expectedDeclaration) {
  const expected = createStructuralVocabularyMapping(leftPack, rightPack, expectedDeclaration);
  if (typedEncoded(value) !== typedEncoded(expected)) typedFail("VERIFICATION_FAILED", "Vocabulary mapping differs from expected source endpoints, declaration or replay.");
  return expected;
}
function usedValues(edges, field) {
  return [...new Set(edges.flatMap((edge) => setFields.includes(field) ? edge[field] : [edge[field]]))].sort(compare);
}

export function alignTypedRelations(leftPack, leftInput, rightPack, rightInput, options = {}) {
  const request = typedObject(options, ["mapping", "approvedMappingHash"], []);
  if (Object.hasOwn(request, "approvedMappingHash") && (!isContentHash(request.approvedMappingHash) || !request.mapping)) {
    typedFail("INPUT_INVALID", "An approved mapping hash requires an explicit mapping artifact.");
  }
  const leftSource = verifyModelPack(leftPack), rightSource = verifyModelPack(rightPack);
  const left = observeTypedRelations(leftSource, leftInput), right = observeTypedRelations(rightSource, rightInput);
  // A mapping is verified even if another evidence gap prevents alignment.
  // The approved hash is supplied separately by trusted caller policy.
  const mapping = Object.hasOwn(request, "mapping") ? verifyStructuralVocabularyMapping(request.mapping,
    leftSource, rightSource, request.mapping?.declaration) : null;
  const reasons = [];
  for (const [side, a] of [["left", left], ["right", right]]) {
    if (a.evaluation !== "measured") reasons.push({ code: "missing-typed-observation", side });
  }
  let basis = null;
  if (mapping) {
    if (request.approvedMappingHash !== mapping.artifactHash) reasons.push({ code: "mapping-not-approved" });
    else basis = "approved-mapping";
  } else if (canonicalize(left.vocabulary) === canonicalize(right.vocabulary)) basis = "same-source";
  else reasons.push({ code: "cross-source-mapping-required" });
  const leftEdges = scopedTypedEdges(leftSource, left.preparation), rightEdges = scopedTypedEdges(rightSource, right.preparation);
  if (mapping && left.evaluation === "measured" && right.evaluation === "measured") {
    for (const field of typedFields) for (const [side, edges] of [["left", leftEdges], ["right", rightEdges]]) {
      const covered = new Set(mapping.declaration.fields[field].map((entry) => entry[side]));
      for (const value of usedValues(edges, field)) if (!covered.has(value)) reasons.push({ code: "mapping-value-uncovered", side, field, value });
    }
  }
  let aligned = null;
  if (!reasons.length) {
    let rightResult = { value: right.observations[1].value, witness: right.observations[1].witness };
    if (mapping) {
      const lookups = Object.fromEntries(typedFields.map((field) => [field, new Map(mapping.declaration.fields[field].map((e) => [e.right, e.left]))]));
      const remapped = rightEdges.map((edge) => {
        const { types } = normalizeEdgeTypes(edge);
        return { id: edge.id, source: edge.source, target: edge.target,
          ...Object.fromEntries(typedFields.map((field) => [field, setFields.includes(field)
            ? types[field].map((value) => lookups[field].get(value)).sort(compare) : lookups[field].get(types[field])])) };
      });
      rightResult = canonicalizeTypedDirectedStructure(right.preparation.scope.nodeIds, remapped);
    }
    aligned = { domainHash: typedHash("vocabulary-domain", left.vocabulary),
      left: { value: left.observations[1].value, witness: left.observations[1].witness }, right: rightResult };
  }
  return typedSeal("alignment", { schemaVersion: "1", analysis: { id: "structural-typed-alignment", version: "1" },
    policy: TYPED_VOCABULARY_ALIGNMENT_POLICY, regime: typedReference(typedRegime),
    request: { approvedMappingHash: request.approvedMappingHash ?? null }, mapping, sources: { left, right },
    compatibility: { state: reasons.length ? "unresolved" : "compatible", basis: reasons.length ? null : basis, reasons }, aligned });
}
export function verifyTypedRelationsAlignment(value, leftPack, leftInput, rightPack, rightInput, options = {}) {
  const expected = alignTypedRelations(leftPack, leftInput, rightPack, rightInput, options);
  if (typedEncoded(value) !== typedEncoded(expected)) typedFail("VERIFICATION_FAILED", "Typed alignment differs from expected source, mapping approval, coverage or replay.");
  return expected;
}
