import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { modelPackFilePaths } from "@onto2d/model-pack";
import { typedRegime, typedFail, typedHashDomain } from "./typed-core.js";

export const typedHash = (kind, value) => hashCanonical(`${typedHashDomain}-${kind}:v1`, value);
export const typedReference = ({ id, version, contentHash }) => ({ id, version, contentHash });
export function typedEncoded(value) {
  const text = canonicalize(value);
  if (new TextEncoder().encode(text).length > typedRegime.limits.maxArtifactBytes) typedFail("LIMIT_EXCEEDED", "Typed artifact exceeds its byte budget.");
  return text;
}
export function typedSeal(kind, body) {
  const artifact = { ...body, artifactHash: typedHash(kind, body) };
  typedEncoded(artifact); return deepFreeze(artifact);
}
export function typedObject(value, allowed, required = allowed) {
  const result = canonicalClone(value);
  if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).some((k) => !allowed.includes(k)) ||
      required.some((k) => !Object.hasOwn(result, k))) typedFail("INPUT_INVALID", "Expected a closed typed contract object with all required fields.");
  return result;
}
export function localTypedVocabulary(context) {
  return { policy: typedReference(typedRegime.vocabularyPolicy), model: context.model, dictionaryHash: context.dictionaryHash };
}
export function scopedTypedEdges(source, preparation) {
  const selected = new Set(preparation.scope.edgeIds);
  return source.files[modelPackFilePaths().edges].filter((edge) => selected.has(edge.id));
}
