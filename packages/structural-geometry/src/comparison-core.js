import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";

const definition = { id: "strict-discrete-structural-comparison-v1", version: "1",
  profile: "all-ordered-mandatory-regime-observables", equality: "exact-canonical-value",
  distance: "complete-equal-zero-complete-different-one-incomplete-null",
  missingness: "strict-indeterminate-v1", emptyProfile: "indeterminate",
  diagnostics: "retain-comparable-equalities-and-differences",
  vocabulary: "existing-explicit-typed-alignment", metadata: "excluded-from-distance",
  evidenceRestrictions: "caller-declared-use-only-never-skip-source-or-mapping-verification",
  errors: "throw-no-partial-success", partialDistance: "unsupported",
  signaturePseudometric: "deferred-to-R6", ordering: "regime-observable-then-left-right",
  limits: { maxComponents: 7, maxEvidenceGaps: 14, maxCanonicalizerCalls: 5,
    maxCanonicalEntries: 500000, maxArtifactBytes: 4194304 } };
export const comparisonHash = (kind, value) => hashCanonical(`onto2d:structural-comparison-${kind}:v1`, value, COMPARISON_CODEC);
export const COMPARISON_CODEC = { limits: { maxEntries: definition.limits.maxCanonicalEntries } };
export const STRUCTURAL_COMPARISON_POLICY = deepFreeze({ ...definition, contentHash: comparisonHash("policy", definition) });
export const comparisonReference = ({ id, version, contentHash }) => ({ id, version, contentHash });
export function comparisonFail(code, message) { throw new EngineError(`STRUCTURAL_COMPARISON_${code}`, message); }
export function comparisonObject(value, allowed, required = allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !allowed.includes(k)) ||
      required.some((k) => !Object.hasOwn(value, k))) comparisonFail("INPUT_INVALID", "Expected a closed comparison contract object.");
  return value;
}
export function comparisonEncoded(value) {
  const text = canonicalize(value, COMPARISON_CODEC);
  if (new TextEncoder().encode(text).length > definition.limits.maxArtifactBytes) comparisonFail("LIMIT_EXCEEDED", "Comparison exceeds its artifact byte bound.");
  return text;
}
export const comparisonClone = (value) => canonicalClone(value, COMPARISON_CODEC);

// Private aggregation of already evaluated components. Empty profiles never
// authorize equality, even though the current public regimes are nonempty.
export function summarizeComparison(components) {
  const equalObservableIds = [], differentObservableIds = [], incompleteObservableIds = [];
  const families = new Map();
  let numerator = 0;
  for (const component of components) {
    const comparable = component.state !== "indeterminate";
    if (comparable) numerator += 1;
    if (!families.has(component.family)) families.set(component.family, { family: component.family, numerator: 0, denominator: 0 });
    const family = families.get(component.family); family.denominator += 1;
    if (comparable) family.numerator += 1;
    (component.state === "equal" ? equalObservableIds : component.state === "different" ? differentObservableIds : incompleteObservableIds).push(component.observable.id);
  }
  const denominator = components.length, complete = denominator > 0 && numerator === denominator;
  const distance = complete ? (differentObservableIds.length ? 1 : 0) : null;
  return { coverage: { numerator, denominator, complete, families: [...families.values()] },
    diagnostics: { equalObservableIds, differentObservableIds, incompleteObservableIds }, distance,
    status: !complete ? "indeterminate" : distance === 0 ? "indistinguishable-under-regime" : "distinguishable-under-regime" };
}
