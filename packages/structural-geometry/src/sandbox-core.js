import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";

const definition = { id: "immutable-structural-probe-sandbox-v1", version: "1",
  source: "verified-full-model-with-unchanged-regime-preparation", derivedGraph: "separate-source-bound-shadow-graph",
  operations: ["identity", "remove-edges", "reverse-edges"],
  targets: "whole-scope-or-exhaustive-all-each-internal-edge", ordering: "source-id-serialization-only-no-tie-selection",
  copies: "every-target-starts-from-baseline", nodes: "retain-all-scoped-nodes",
  annotations: "untyped-excludes-typed-preserves-five-present-fields", reversalTypes: "carried-without-semantic-recoding",
  parallelEdges: "reject-target-without-merging", emptyTargets: "unavailable-zero-runs",
  invalidInput: "error-no-partial-result", observations: "not-run", codeExecution: "closed-data-operations-only",
  work: "baseline-edges-examined-once-per-target-excludes-source-validation-and-serialization",
  limits: { maxTargets: 32, maxTransformationEdgeVisits: 1024, maxCanonicalEntries: 500000, maxArtifactBytes: 4194304 } };
export const SANDBOX_CODEC = Object.freeze({ limits: Object.freeze({ maxEntries: definition.limits.maxCanonicalEntries }) });
export const sandboxHash = (kind, value) => hashCanonical(`onto2d:structural-sandbox-${kind}:v1`, value, SANDBOX_CODEC);
export const STRUCTURAL_PROBE_SANDBOX_POLICY = deepFreeze({ ...definition, contentHash: sandboxHash("policy", definition) });
export const sandboxClone = value => canonicalClone(value, SANDBOX_CODEC);
export const sandboxReference = ({ id, version, contentHash }) => ({ id, version, contentHash });
export function sandboxFail(code, message) { throw new EngineError(`STRUCTURAL_SANDBOX_${code}`, message); }
export function sandboxObject(value, allowed, required = allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) ||
      required.some(k => !Object.hasOwn(value, k))) sandboxFail("INPUT_INVALID", "Expected a closed sandbox contract object.");
  return value;
}
export function sandboxEncoded(value) {
  const text = canonicalize(value, SANDBOX_CODEC);
  if (new TextEncoder().encode(text).length > definition.limits.maxArtifactBytes) sandboxFail("LIMIT_EXCEEDED", "Sandbox exceeds its artifact byte bound.");
  return text;
}
export function sandboxSeal(kind, value, field = "artifactHash") {
  const result = { ...value, [field]: sandboxHash(kind, value) }; sandboxEncoded(result); return deepFreeze(result);
}
export function shadowGraph(preparation, nodes, edges) {
  return sandboxSeal("graph", { schemaVersion: "1", kind: "structural-shadow-graph", regime: sandboxReference(preparation.regime),
    source: { contextHash: preparation.context.contextHash, scopeHash: preparation.scope.scopeHash }, nodes, edges }, "graphHash");
}

// Private, finite data transformation. Every invocation receives the baseline;
// no caller callbacks or arbitrary source-ID target selection are supported.
export function transformShadowGraph(preparation, baseline, target, transformation) {
  const selected = new Set(target.shadowEdgeIds), edges = [], mappings = [], removed = [], reversed = [], pairs = new Map();
  let conflict = null;
  for (const [i, edge] of baseline.graph.edges.entries()) {
    const sourceEdgeId = baseline.mapping.edges[i].sourceEdgeId;
    const action = !selected.has(edge.id) || transformation.kind === "identity" ? "preserved"
      : transformation.kind === "remove-edges" ? "removed" : "reversed";
    mappings.push({ sourceEdgeId, beforeEdgeId: edge.id, afterEdgeId: action === "removed" ? null : edge.id, action });
    if (action === "removed") { removed.push(sourceEdgeId); continue; }
    const changed = action === "reversed" ? { ...edge, source: edge.target, target: edge.source } : { ...edge };
    if (action === "reversed") reversed.push(sourceEdgeId);
    const key = `${changed.source}:${changed.target}`;
    if (pairs.has(key)) conflict = [pairs.get(key), sourceEdgeId].sort();
    else pairs.set(key, sourceEdgeId);
    edges.push(changed);
  }
  const common = { target, transformation, beforeGraphHash: baseline.graph.graphHash };
  if (conflict) return sandboxSeal("run", { ...common, execution: "rejected",
    rejection: { code: "parallel-edge-after-reversal", sourceEdgeIds: conflict }, graph: null, edgeMapping: null, changes: null }, "runHash");
  return sandboxSeal("run", { ...common, execution: "applied", rejection: null,
    graph: shadowGraph(preparation, baseline.graph.nodes.map(node => ({ ...node })), edges), edgeMapping: mappings,
    changes: { removedSourceEdgeIds: removed, reversedSourceEdgeIds: reversed } }, "runHash");
}
