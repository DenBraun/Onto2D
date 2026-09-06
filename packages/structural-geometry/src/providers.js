import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { analyzeStructuralGeometry, projectStructuralGeometry } from "./index.js";
import { analyzeStructuralMetricExperiment } from "./experiments.js";
import { TYPED_SELECTION_POLICY } from "./experiment-policies.js";
import { metric, normalize, select } from "./experiment-core.js";
import { encodedFraction } from "./rational.js";
import { packFromEngineModel } from "./engine-model.js";

export const STRUCTURAL_PROVIDER_DESCRIPTOR_SCHEMA = "https://onto2d.dev/schemas/v1/structural-provider-descriptor.schema.json";
export const STRUCTURAL_METRIC_CONTEXT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-metric-context.schema.json";
export const STRUCTURAL_PROVIDER_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-provider-input.schema.json";
export const STRUCTURAL_PROVIDER_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-provider-artifact.schema.json";
export const STRUCTURAL_PROVIDER_ANALYSIS_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-provider-analysis-input.schema.json";
export const STRUCTURAL_PROVIDER_ANALYSIS_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-provider-analysis-artifact.schema.json";

const LIMITS = { maxNodes: 4096, maxEdges: 16384, maxViews: 32, maxTotalViewEdges: 32768,
  maxCanonicalEntries: 500000, maxArtifactBytes: 8388608 };
const CODEC = { limits: { maxEntries: LIMITS.maxCanonicalEntries } };
const ONE = Object.freeze({ numerator: "1", denominator: "1" });
const contexts = new WeakMap();
const hash = (name, value) => hashCanonical(`onto2d:structural-provider-${name}:v1`, value, CODEC);
function fail(code, message) { throw new EngineError(`STRUCTURAL_PROVIDER_${code}`, message); }
function encoded(value) {
  const text = canonicalize(value, CODEC);
  if (new TextEncoder().encode(text).length > LIMITS.maxArtifactBytes) fail("LIMIT_EXCEEDED", "Provider artifact exceeds its byte budget.");
  return text;
}
function seal(name, body) {
  const result = { ...body, artifactHash: hash(name, body) };
  encoded(result);
  return deepFreeze(result);
}
function object(value, allowed, required = []) {
  const result = canonicalClone(value);
  if (result === null || typeof result !== "object" || Array.isArray(result)
    || Object.keys(result).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(result, key))) {
    fail("INPUT_INVALID", "Provider input must be a closed object with the required fields.");
  }
  return result;
}

export const STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS = deepFreeze([
  ["unit-v1", "metric-values", "exact-positive-rational", ["positive-edge-lengths", "vertex-weights", "edge-weights"], "ignored"],
  ["inverse-target-share-v1", "metric-values", "exact-positive-rational", ["positive-edge-lengths", "vertex-weights", "edge-weights"], "required-and-audited"],
  ["necessity-filtration-v1", "filtration", "discrete-membership", ["nested-edge-views"], "unused"],
  ["role-subset-v1", "selection", "discrete-membership", ["role-selection"], "unused"],
  ["typed-channel-v1", "channels", "discrete-membership", ["overlapping-typed-channels"], "unused"]
].map(([id, kind, numeric, capabilities, sourceWeights]) => ({ id, version: "1", kind,
  origin: "existing-structural-geometry-v1", representationPolicyId: "source-parent-directed-v1", numeric, capabilities,
  context: { source: "verified-full-model", normalization: "full-source-projection", dictionaryMeaning: "model-local", sourceWeights },
  limits: LIMITS })));

function descriptor(id) {
  const value = STRUCTURAL_METRIC_PROVIDER_DESCRIPTORS.find((p) => p.id === id);
  if (!value) fail("UNSUPPORTED", "The provider ID is not implemented.");
  return value;
}

function normalizeInput(input) {
  const raw = object(input, ["providerId", "parameters"], ["providerId"]);
  const provider = descriptor(raw.providerId);
  const parameters = Object.hasOwn(raw, "parameters") ? raw.parameters : {};
  let normalized;
  if (provider.id === "role-subset-v1") {
    const value = object(parameters, ["roles"], ["roles"]);
    normalized = { roles: normalize({ selection: { kind: "roles", roles: value.roles } }).selection.roles };
  } else if (provider.id === "typed-channel-v1") {
    const value = object(parameters, ["field", "values"], ["field", "values"]);
    if (!TYPED_SELECTION_POLICY.channels.includes(value.field) || !Array.isArray(value.values)
      || value.values.length < 1 || value.values.length > LIMITS.maxViews
      || value.values.some((v) => !Number.isSafeInteger(v) || v < 0) || new Set(value.values).size !== value.values.length) {
      fail("INPUT_INVALID", "Typed channels require one supported field and 1–32 distinct nonnegative integer codes.");
    }
    normalized = { field: value.field, values: value.values.sort((a, b) => a - b) };
  } else normalized = object(parameters, []);
  return { providerId: provider.id, parameters: normalized };
}

export function createStructuralMetricContext(pack) {
  const source = verifyModelPack(pack);
  const projection = projectStructuralGeometry(source);
  const body = { schemaVersion: "1", model: projection.model, sourceProjectionHash: projection.projectionHash,
    projectionPolicyHash: projection.policyHash, normalizationContext: "full-source-projection",
    dictionaryHash: hash("dictionaries", source.files[modelPackFilePaths().dictionaries]) };
  const binding = deepFreeze({ ...body, contextHash: hash("context", body) });
  const context = Object.freeze({ projection, binding });
  contexts.set(context, { source });
  return context;
}

function contextSource(context) {
  const state = contexts.get(context);
  if (!state) fail("CONTEXT_REQUIRED", "Recreate a verified metric context from the expected Model Pack.");
  return state.source;
}

function buildFromContext(projection, context, request) {
  contextSource(context);
  if (canonicalize(projection) !== canonicalize(context.projection)) {
    fail("PROJECTION_MISMATCH", "Provider projection differs from its complete verified source context.");
  }
  // Compute only from the frozen snapshot, never from a caller-owned lookalike.
  projection = context.projection;
  const provider = descriptor(request.providerId);
  let result;
  if (provider.kind === "metric-values") {
    const values = metric(projection, provider.id);
    result = { kind: "metric-values", metricPolicy: values.policy, metricPolicyHash: values.policyHash,
      metricContextHash: values.contextHash, weightAuditHash: values.auditHash,
      nodes: projection.nodes.map(({ id }) => ({ id, weight: ONE })),
      edges: projection.edges.map(({ id, source, target }) => {
        const length = encodedFraction(values.lengths.get(id));
        return { id, source, target, length, weight: length };
      }) };
  } else {
    let occurrences = 0;
    const view = (selection) => {
      const selected = select(projection, selection);
      occurrences += selected.edges.length;
      if (occurrences > LIMITS.maxTotalViewEdges) fail("LIMIT_EXCEEDED", "Provider views exceed the total selected-edge budget.");
      return { selection, projectionHash: selected.projectionHash, accounting: selected.accounting,
        edges: selected.edges.map(({ id, source, target }) => ({ id, source, target })) };
    };
    const common = { nodeIds: projection.nodes.map((n) => n.id), selectionPolicy: TYPED_SELECTION_POLICY,
      selectionPolicyHash: hashCanonical("onto2d:structural-selection-policy:v1", TYPED_SELECTION_POLICY) };
    if (provider.kind === "filtration") {
      result = { kind: "filtration", ...common,
        stages: TYPED_SELECTION_POLICY.necessityOrder.map((through) => view({ kind: "necessity", through })) };
    } else if (provider.kind === "selection") {
      result = { kind: "selection", ...common, view: view({ kind: "roles", roles: request.parameters.roles }) };
    } else {
      result = { kind: "channels", ...common, channels: request.parameters.values.map((value) =>
        view({ kind: "channel", field: request.parameters.field, value })) };
    }
  }
  return seal("artifact", { schemaVersion: "1", analysis: { id: "structural-metric-provider", version: "1" },
    provider, providerHash: hash("descriptor", provider), context: context.binding, request, result });
}

export function createStructuralMetricProvider(id) {
  const provider = descriptor(id);
  return Object.freeze({ descriptor: provider, build(projection, context, parameters = {}) {
    return buildFromContext(projection, context, normalizeInput({ providerId: id, parameters }));
  } });
}

export function buildStructuralProvider(pack, input) {
  const request = normalizeInput(input);
  const context = createStructuralMetricContext(pack);
  return buildFromContext(context.projection, context, request);
}

export function verifyStructuralProviderArtifact(artifact, pack, input) {
  const expected = buildStructuralProvider(pack, input);
  if (encoded(artifact) !== encoded(expected)) fail("VERIFICATION_FAILED", "Provider artifact differs from exact source, context or input replay.");
  return expected;
}

export function requireStructuralMetricValues(artifact, pack, input) {
  const request = normalizeInput(input);
  if (descriptor(request.providerId).kind !== "metric-values") {
    fail("CAPABILITY_UNSUPPORTED", "A length consumer requires a metric-values provider; discrete views do not supply lengths.");
  }
  return verifyStructuralProviderArtifact(artifact, pack, request).result;
}

function normalizeAnalysis(input) {
  const raw = object(input, ["analysis", "metricProviderId", "selection"], ["analysis", "metricProviderId"]);
  if (descriptor(raw.metricProviderId).kind !== "metric-values") fail("CAPABILITY_UNSUPPORTED", "The requested analysis requires a metric-values provider.");
  if (raw.analysis === "structural-geometry") {
    if (raw.metricProviderId !== "unit-v1" || Object.hasOwn(raw, "selection")) {
      fail("CAPABILITY_UNSUPPORTED", "The original unit Forman analysis requires unit-v1 and the full projection.");
    }
    return raw;
  }
  if (raw.analysis !== "structural-metric-experiment") fail("ANALYSIS_UNSUPPORTED", "The requested provider analysis is unsupported.");
  const legacyInput = { metricPolicyId: raw.metricProviderId };
  if (Object.hasOwn(raw, "selection")) legacyInput.selection = raw.selection;
  return { analysis: raw.analysis, metricProviderId: raw.metricProviderId, selection: normalize(legacyInput).selection };
}

export function analyzeStructuralGeometryWithProvider(pack, input) {
  const request = normalizeAnalysis(input);
  const context = createStructuralMetricContext(pack);
  const source = contextSource(context);
  const metricArtifact = buildFromContext(context.projection, context, normalizeInput({ providerId: request.metricProviderId }));
  let viewArtifact = null;
  const selection = request.selection;
  if (selection?.kind === "necessity") {
    viewArtifact = buildFromContext(context.projection, context, normalizeInput({ providerId: "necessity-filtration-v1" }));
  } else if (selection?.kind === "roles") {
    viewArtifact = buildFromContext(context.projection, context, normalizeInput({ providerId: "role-subset-v1", parameters: { roles: selection.roles } }));
  } else if (selection?.kind === "channel") {
    viewArtifact = buildFromContext(context.projection, context, normalizeInput({ providerId: "typed-channel-v1", parameters: { field: selection.field, values: [selection.value] } }));
  }
  const legacyArtifact = request.analysis === "structural-geometry" ? analyzeStructuralGeometry(source)
    : analyzeStructuralMetricExperiment(source, { metricPolicyId: request.metricProviderId, selection });
  return seal("analysis", { schemaVersion: "1", analysis: { id: "structural-provider-analysis", version: "1" },
    request, context: context.binding, metricArtifact, viewArtifact, legacyArtifact });
}

export function verifyStructuralProviderAnalysis(artifact, pack, input) {
  const expected = analyzeStructuralGeometryWithProvider(pack, input);
  if (encoded(artifact) !== encoded(expected)) fail("VERIFICATION_FAILED", "Provider analysis differs from exact source and legacy replay.");
  return expected;
}

export function createStructuralMetricProviderAnalysis() {
  return Object.freeze({ id: "structural-metric-provider", version: "1", requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_PROVIDER_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_PROVIDER_ARTIFACT_SCHEMA]),
    run(context, input) { return buildStructuralProvider(packFromEngineModel(context?.model), input); } });
}

export function createStructuralProviderAnalysis() {
  return Object.freeze({ id: "structural-provider-analysis", version: "1", requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_PROVIDER_ANALYSIS_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_PROVIDER_ANALYSIS_ARTIFACT_SCHEMA]),
    run(context, input) { return analyzeStructuralGeometryWithProvider(packFromEngineModel(context?.model), input); } });
}
