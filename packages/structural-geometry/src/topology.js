import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { modelPackFilePaths, verifyModelPack } from "@onto2d/model-pack";
import { prepareStructuralRegime, getDistinguishabilityRegime } from "./regimes.js";
import { measureDirectedTopology } from "./topology-core.js";
import { packFromEngineModel } from "./engine-model.js";

export const STRUCTURAL_TOPOLOGY_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-topology-input.schema.json";
export const STRUCTURAL_TOPOLOGY_OBSERVATION_SCHEMA = "https://onto2d.dev/schemas/v1/structural-topology-observation.schema.json";
const hash = (kind, value) => hashCanonical(`onto2d:structural-topology-${kind}:v1`, value);
const reference = ({ id, version, contentHash }) => ({ id, version, contentHash });
const implementation = { id: "directed-topology-observation-v1", version: "1",
  reachability: "breadth-first-from-each-scoped-node",
  strongComponents: "mutual-directed-reachability", weakComponents: "undirected-breadth-first",
  componentSizeOrdering: "numeric-ascending", diagnosticOrdering: "source-id-ascending",
  pairVisits: "distinct-source-target-visits-including-self-seeds",
  edgeScans: "directed-adjacency-entries-scanned-by-reachability-only",
  attributes: "excluded", graphIsomorphismClaim: false,
  valueFields: [
    { observableId: "node-count-v1", field: "nodeCount" },
    { observableId: "edge-count-v1", field: "edgeCount" },
    { observableId: "weak-component-sizes-v1", field: "weakComponentSizes" },
    { observableId: "strong-component-sizes-v1", field: "strongComponentSizes" },
    { observableId: "reachable-ordered-pair-count-v1", field: "reachableOrderedPairCount" },
    { observableId: "cyclic-node-count-v1", field: "cyclicNodeCount" },
    { observableId: "isolated-node-count-v1", field: "isolatedNodeCount" }
  ] };
export const TOPOLOGY_OBSERVATION_IMPLEMENTATION = deepFreeze({ ...implementation, contentHash: hash("implementation", implementation) });
function fail(code, message) { throw new EngineError(`STRUCTURAL_TOPOLOGY_${code}`, message); }
function encoded(value) {
  const text = canonicalize(value);
  if (new TextEncoder().encode(text).length > getDistinguishabilityRegime("topology-only-v1").limits.maxArtifactBytes) {
    fail("LIMIT_EXCEEDED", "Topology observation exceeds its artifact byte budget.");
  }
  return text;
}

export function observeStructuralTopology(pack, input) {
  const request = canonicalClone(input);
  if (request === null || typeof request !== "object" || Array.isArray(request) || !Object.hasOwn(request, "regimeId")) {
    fail("INPUT_INVALID", "Topology observation requires an explicit regime request.");
  }
  if (request.regimeId !== "topology-only-v1") fail("REGIME_UNSUPPORTED", "This evaluator implements only topology-only-v1.");
  const source = verifyModelPack(pack);
  const preparation = prepareStructuralRegime(source, request);
  const selected = new Set(preparation.scope.edgeIds);
  const edges = source.files[modelPackFilePaths().edges].filter((edge) => selected.has(edge.id));
  const { value, diagnostics } = measureDirectedTopology(preparation.scope.nodeIds, edges);
  const valueBinding = { regime: reference(preparation.regime), observables: preparation.regime.observables,
    implementation: reference(TOPOLOGY_OBSERVATION_IMPLEMENTATION), value };
  const observation = { ...valueBinding, valueHash: hash("value", valueBinding) };
  const body = { schemaVersion: "1", analysis: { id: "structural-topology-observation", version: "1" },
    evaluation: "measured", implementation: TOPOLOGY_OBSERVATION_IMPLEMENTATION, preparation, observation, diagnostics };
  const artifact = { ...body, artifactHash: hash("artifact", body) };
  encoded(artifact);
  return deepFreeze(artifact);
}

export function verifyStructuralTopologyObservation(value, pack, input) {
  const expected = observeStructuralTopology(pack, input);
  if (encoded(value) !== encoded(expected)) fail("VERIFICATION_FAILED", "Topology observation differs from expected source, regime, scope or directed summary replay.");
  return expected;
}

export function createStructuralTopologyObservationAnalysis() {
  return Object.freeze({ id: "structural-topology-observation", version: "1",
    requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: STRUCTURAL_TOPOLOGY_INPUT_SCHEMA, outputArtifacts: Object.freeze([STRUCTURAL_TOPOLOGY_OBSERVATION_SCHEMA]),
    run(context, input) { return observeStructuralTopology(packFromEngineModel(context?.model), input); } });
}
