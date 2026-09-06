import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { prepareStructuralRegime, getDistinguishabilityRegime } from "./regimes.js";
import { canonicalizeDirectedStructure } from "./canonical-core.js";
import { packFromEngineModel } from "./engine-model.js";

export const STRUCTURAL_CANONICAL_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-canonical-input.schema.json";
export const STRUCTURAL_CANONICAL_OBSERVATION_SCHEMA = "https://onto2d.dev/schemas/v1/structural-canonical-observation.schema.json";
const hash = (kind, value) => hashCanonical(`onto2d:structural-canonical-${kind}:v1`, value);
const reference = ({ id, version, contentHash }) => ({ id, version, contentHash });
const implementation = { id: "canonical-directed-observation-v1", version: "1",
  kernelOperation: "canonicalizeCandidate", kernelCanonicalSchemaVersion: "1",
  inputOrdering: "source-id-ascending", valueEncoding: "node-count-and-canonical-directed-endpoints",
  witnessMeaning: "one-isomorphism-not-canonical-orbits", attributes: "excluded" };
export const CANONICAL_STRUCTURE_IMPLEMENTATION = deepFreeze({ ...implementation, contentHash: hash("implementation", implementation) });
function fail(code, message) { throw new EngineError(`STRUCTURAL_CANONICAL_${code}`, message); }
function encoded(value) {
  const text = canonicalize(value);
  if (new TextEncoder().encode(text).length > getDistinguishabilityRegime("canonical-structure-v1").limits.maxArtifactBytes) {
    fail("LIMIT_EXCEEDED", "Canonical observation exceeds its artifact byte budget.");
  }
  return text;
}

export function observeCanonicalStructure(pack, input) {
  const request = canonicalClone(input);
  if (request === null || typeof request !== "object" || Array.isArray(request) || !Object.hasOwn(request, "regimeId")) {
    fail("INPUT_INVALID", "Canonical observation requires an explicit regime request.");
  }
  if (request.regimeId !== "canonical-structure-v1") fail("REGIME_UNSUPPORTED", "This evaluator implements only canonical-structure-v1.");
  // All later reads use this verified snapshot, never the caller's object.
  const source = verifyModelPack(pack);
  const preparation = prepareStructuralRegime(source, request);
  const selected = new Set(preparation.scope.edgeIds);
  const edges = source.files[modelPackFilePaths().edges].filter((edge) => selected.has(edge.id));
  const { value, witness } = canonicalizeDirectedStructure(preparation.scope.nodeIds, edges);
  const valueBinding = { regime: reference(preparation.regime), observable: preparation.regime.observables[0],
    implementation: reference(CANONICAL_STRUCTURE_IMPLEMENTATION), value };
  const observation = { ...valueBinding, valueHash: hash("value", valueBinding) };
  const body = { schemaVersion: "1", analysis: { id: "structural-canonical-observation", version: "1" },
    evaluation: "measured", implementation: CANONICAL_STRUCTURE_IMPLEMENTATION, preparation, observation, witness };
  const artifact = { ...body, artifactHash: hash("artifact", body) };
  encoded(artifact);
  return deepFreeze(artifact);
}

export function verifyCanonicalStructureObservation(value, pack, input) {
  const expected = observeCanonicalStructure(pack, input);
  if (encoded(value) !== encoded(expected)) fail("VERIFICATION_FAILED", "Canonical observation differs from expected source, regime, scope or exact matching replay.");
  return expected;
}

export function createCanonicalStructureObservationAnalysis() {
  return Object.freeze({ id: "structural-canonical-observation", version: "1",
    requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_CANONICAL_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_CANONICAL_OBSERVATION_SCHEMA]),
    run(context, input) { return observeCanonicalStructure(packFromEngineModel(context?.model), input); } });
}
