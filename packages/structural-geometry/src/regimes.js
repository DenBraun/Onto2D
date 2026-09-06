import { canonicalClone, canonicalize, deepFreeze } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { createStructuralMetricContext } from "./providers.js";
import { packFromEngineModel } from "./engine-model.js";
import { DISTINGUISHABILITY_REGIMES, STRUCTURAL_OBSERVABLE_SPECS, regimeHash } from "./regime-policies.js";

export { DISTINGUISHABILITY_REGIMES, STRUCTURAL_OBSERVABLE_SPECS } from "./regime-policies.js";
export const STRUCTURAL_OBSERVATION_SPEC_SCHEMA = "https://onto2d.dev/schemas/v1/structural-observation-spec.schema.json";
export const DISTINGUISHABILITY_REGIME_SCHEMA = "https://onto2d.dev/schemas/v1/distinguishability-regime.schema.json";
export const STRUCTURAL_REGIME_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-regime-input.schema.json";
export const STRUCTURAL_REGIME_PREPARATION_SCHEMA = "https://onto2d.dev/schemas/v1/structural-regime-preparation.schema.json";

function fail(code, message) { throw new EngineError(`STRUCTURAL_REGIME_${code}`, message); }
function object(value, allowed, required) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(value, key))) {
    fail("INPUT_INVALID", "Regime input must be a closed object with its required fields.");
  }
  return value;
}
function lookup(entries, id) {
  const result = entries.find((entry) => entry.id === id);
  if (!result) fail("UNSUPPORTED", "The requested regime or observable contract is unsupported.");
  return result;
}
function verify(value, expected) {
  if (canonicalize(value) !== canonicalize(expected)) fail("VERIFICATION_FAILED", "Contract differs from the expected built-in content, identity or policy.");
  return expected;
}
export function getDistinguishabilityRegime(id) { return lookup(DISTINGUISHABILITY_REGIMES, id); }
export function verifyDistinguishabilityRegime(value, expectedId) {
  return verify(value, getDistinguishabilityRegime(expectedId));
}
export function verifyStructuralObservationSpec(value, expectedId) {
  return verify(value, lookup(STRUCTURAL_OBSERVABLE_SPECS, expectedId));
}
function normalize(input) {
  const raw = object(canonicalClone(input), ["regimeId", "scope"], ["regimeId"]);
  const regime = getDistinguishabilityRegime(raw.regimeId);
  const scope = Object.hasOwn(raw, "scope") ? raw.scope : { kind: "full" };
  object(scope, ["kind", "nodeIds"], ["kind"]);
  if (scope.kind === "full") object(scope, ["kind"], ["kind"]);
  else if (scope.kind === "induced") {
    const ids = scope.nodeIds;
    if (!Array.isArray(ids) || ids.length < regime.limits.minNodes || ids.length > regime.limits.maxNodes
      || ids.some((id) => typeof id !== "string" || !id.length) || new Set(ids).size !== ids.length) {
      fail("INPUT_INVALID", "An induced scope requires distinct source node IDs within the regime node bounds.");
    }
    // Source identifiers are opaque Model Pack strings. Preserve whitespace;
    // membership checks below resolve the exact spelling without trimming it.
    ids.sort();
  } else fail("INPUT_INVALID", "Scope must be full or an explicit induced node set.");
  return { regimeId: raw.regimeId, scope };
}

// A preparation binds a future observation to source and contract. It contains
// no measured observation, comparison status, distance or passed probe claim.
export function prepareStructuralRegime(pack, input) {
  const request = normalize(input);
  const regime = getDistinguishabilityRegime(request.regimeId);
  const context = createStructuralMetricContext(pack);
  const { projection } = context;
  const allIds = new Set(projection.nodes.map((node) => node.id));
  const nodeIds = request.scope.kind === "full" ? [...allIds] : request.scope.nodeIds;
  if (nodeIds.some((id) => !allIds.has(id))) fail("SCOPE_INVALID", "Induced scope contains a node absent from the verified source.");
  if (nodeIds.length < regime.limits.minNodes || nodeIds.length > regime.limits.maxNodes) {
    fail("LIMIT_EXCEEDED", "Scoped node count exceeds the declared matching bounds; select an explicit smaller induced scope.");
  }
  const nodes = new Set(nodeIds);
  const edgeIds = [], incomingBoundaryEdgeIds = [], outgoingBoundaryEdgeIds = [], externalEdgeIds = [];
  for (const edge of projection.edges) {
    const from = nodes.has(edge.source), to = nodes.has(edge.target);
    (from && to ? edgeIds : from ? outgoingBoundaryEdgeIds : to ? incomingBoundaryEdgeIds : externalEdgeIds).push(edge.id);
  }
  if (edgeIds.length > regime.limits.maxEdges) fail("LIMIT_EXCEEDED", "Scoped edge count exceeds the declared matching bounds.");
  const scopeBody = { kind: request.scope.kind, sourceProjectionHash: projection.projectionHash,
    sourceNodeCount: projection.nodes.length, sourceEdgeCount: projection.edges.length,
    nodeIds, edgeIds, incomingBoundaryEdgeIds, outgoingBoundaryEdgeIds, externalEdgeIds };
  const scope = { ...scopeBody, scopeHash: regimeHash("scope", scopeBody) };
  const body = { schemaVersion: "1", analysis: { id: "structural-regime-preparation", version: "1" },
    evaluation: "not-run", request, regime, context: context.binding, scope,
    observableSpecs: regime.observables.map(({ id }) => lookup(STRUCTURAL_OBSERVABLE_SPECS, id)) };
  const artifact = { ...body, artifactHash: regimeHash("preparation", body) };
  encode(artifact, regime);
  return deepFreeze(artifact);
}
function encode(value, regime) {
  const text = canonicalize(value);
  if (new TextEncoder().encode(text).length > regime.limits.maxArtifactBytes) fail("LIMIT_EXCEEDED", "Regime preparation exceeds its artifact byte budget.");
  return text;
}
export function verifyStructuralRegimePreparation(value, pack, input) {
  const expected = prepareStructuralRegime(pack, input);
  if (encode(value, expected.regime) !== encode(expected, expected.regime)) {
    fail("VERIFICATION_FAILED", "Preparation differs from the expected source, scope or regime replay.");
  }
  return expected;
}
export function createStructuralRegimePreparationAnalysis() {
  return Object.freeze({ id: "structural-regime-preparation", version: "1",
    requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_REGIME_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_REGIME_PREPARATION_SCHEMA]),
    run(context, input) { return prepareStructuralRegime(packFromEngineModel(context?.model), input); } });
}
