import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { defineScientificAdapter } from "@onto2d/scientific-adapter";
import { projectStructuralGeometry } from "./index.js";
import { packFromEngineModel } from "./engine-model.js";
import { add, encodedFraction, fraction } from "./rational.js";
import { OLLIVIER_POLICY, OLLIVIER_SOLVER } from "./ollivier-policy.js";

export { OLLIVIER_POLICY, OLLIVIER_SOLVER } from "./ollivier-policy.js";
export const OLLIVIER_ANALYSIS_ID = "structural-ollivier";
export const OLLIVIER_INPUT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-ollivier-input.schema.json";
export const OLLIVIER_ARTIFACT_SCHEMA = "https://onto2d.dev/schemas/v1/structural-ollivier-artifact.schema.json";
const ANALYSIS = Object.freeze({ id: OLLIVIER_ANALYSIS_ID, version: "1" });
const LIMITS = OLLIVIER_POLICY.limits;
const POLICY_HASH = hashCanonical("onto2d:structural-ollivier-policy:v1", OLLIVIER_POLICY);
const fail = (code, message) => { throw new EngineError(`STRUCTURAL_OLLIVIER_${code}`, message); };
const seal = (body, field, domain) => deepFreeze({ ...body, [field]: hashCanonical(domain, body) });

function exactFields(value, fields, required = fields) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => !fields.includes(key)) ||
      required.some((key) => !Object.hasOwn(value, key))) {
    fail("INPUT_INVALID", "Object fields differ from the closed Ollivier contract.");
  }
}

function ids(value, maximum, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
      value.some((id) => typeof id !== "string" || id.length === 0 || id.length > 1024) ||
      new Set(value).size !== value.length) {
    fail("INPUT_INVALID", "IDs must be unique, nonempty strings within the declared count bounds.");
  }
  return [...value].sort();
}

function normalizeInput(input) {
  const value = canonicalClone(input);
  exactFields(value, ["scope", "edgeIds", "idleness"], ["edgeIds"]);
  const scope = Object.hasOwn(value, "scope") ? value.scope : { kind: "full" };
  exactFields(scope, ["kind", "nodeIds"], ["kind"]);
  if (scope.kind === "full") exactFields(scope, ["kind"]);
  else if (scope.kind === "induced") {
    exactFields(scope, ["kind", "nodeIds"]);
    scope.nodeIds = ids(scope.nodeIds, LIMITS.maxNodes, 2);
  } else fail("INPUT_INVALID", "Choose full scope or an explicit induced node set.");
  const idleness = Object.hasOwn(value, "idleness") ? value.idleness : OLLIVIER_POLICY.defaultIdleness;
  if (!OLLIVIER_POLICY.idleness.includes(idleness)) fail("INPUT_INVALID", "Unsupported idleness.");
  return { scope, edgeIds: ids(value.edgeIds, LIMITS.maxAnalyzedEdges), idleness };
}

const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const lcm = (a, b) => a / gcd(a, b) * b;

function measure(endpoint, neighbors, idleness) {
  if (neighbors.length === 0) return [{ nodeId: endpoint, n: 1, d: 1 }];
  const half = idleness === "half";
  const values = neighbors.map((nodeId) => ({ nodeId, n: 1, d: neighbors.length * (half ? 2 : 1) }));
  if (half) values.push({ nodeId: endpoint, n: 1, d: 2 });
  values.sort((a, b) => a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0);
  if (values.length > LIMITS.maxSupportSize) fail("LIMIT_EXCEEDED", "A measure exceeds the support bound.");
  return values;
}

function distances(source, outgoing) {
  const result = new Map([[source, 0]]);
  const queue = [source];
  for (let i = 0; i < queue.length; i += 1) {
    for (const target of outgoing.get(queue[i])) {
      if (!result.has(target)) { result.set(target, result.get(queue[i]) + 1); queue.push(target); }
    }
  }
  return result;
}

export function prepareOllivierRequest(pack, input) {
  const parameters = normalizeInput(input);
  // Validate the complete source before any fragment selection can hide a finding.
  const full = projectStructuralGeometry(pack);
  const selected = parameters.scope.kind === "full" ? new Set(full.nodes.map((n) => n.id)) : new Set(parameters.scope.nodeIds);
  const nodes = full.nodes.filter((node) => selected.has(node.id)).map(({ id, sourceRecordHash }) => ({ id, sourceRecordHash }));
  if (nodes.length !== selected.size) fail("SCOPE_INVALID", "The induced scope contains unknown source nodes.");
  const edges = full.edges.filter((edge) => selected.has(edge.source) && selected.has(edge.target))
    .map(({ id, source, target, sourceRecordHash }) => ({ id, source, target, sourceRecordHash }));
  if (nodes.length > LIMITS.maxNodes || edges.length > LIMITS.maxEdges) {
    fail("LIMIT_EXCEEDED", "Choose an explicit smaller induced scope; graphs are never truncated automatically.");
  }
  const graph = { nodes, edges };
  const scope = {
    ...parameters.scope,
    excludedNodeCount: full.nodes.length - nodes.length,
    excludedEdgeCount: full.edges.length - edges.length,
    boundaryEdgeCount: full.edges.filter((e) => selected.has(e.source) !== selected.has(e.target)).length
  };
  const projectionHash = hashCanonical("onto2d:structural-ollivier-projection:v1", {
    sourceProjectionHash: full.projectionHash, scope, graph
  });
  const outgoing = new Map(nodes.map((n) => [n.id, []]));
  const incoming = new Map(nodes.map((n) => [n.id, []]));
  for (const edge of edges) { outgoing.get(edge.source).push(edge.target); incoming.get(edge.target).push(edge.source); }
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  const distanceCache = new Map();
  let cells = 0;
  const problems = parameters.edgeIds.map((id) => {
    const edge = byId.get(id);
    if (!edge) fail("SCOPE_INVALID", "Every requested edge must belong to the scoped graph.");
    const from = measure(edge.source, incoming.get(edge.source), parameters.idleness);
    const to = measure(edge.target, outgoing.get(edge.target), parameters.idleness);
    const denominator = [...from, ...to].reduce((d, entry) => lcm(d, entry.d), 1);
    cells += from.length * to.length;
    if (denominator > LIMITS.maxMassDenominator || from.length * to.length > LIMITS.maxTransportCells || cells > LIMITS.maxTotalTransportCells) {
      fail("LIMIT_EXCEEDED", "The exact transport request exceeds its bounded profile.");
    }
    const costs = from.map(({ nodeId }) => {
      if (!distanceCache.has(nodeId)) distanceCache.set(nodeId, distances(nodeId, outgoing));
      return to.map((target) => {
        const distance = distanceCache.get(nodeId).get(target.nodeId);
        // Each supported pair has a path via source -> target of at most 3 unit edges.
        if (distance === undefined) fail("UNREACHABLE_SUPPORT", "A directed support pair is unreachable.");
        return distance;
      });
    });
    const encode = (values) => values.map(({ nodeId, n, d }) => ({ nodeId, units: n * denominator / d }));
    return { edgeId: id, source: edge.source, target: edge.target, distance: 1,
      massDenominator: denominator, sourceMeasure: encode(from), targetMeasure: encode(to), costs };
  });
  const request = seal({ schemaVersion: "1", analysis: ANALYSIS, model: full.model,
    sourceProjectionHash: full.projectionHash, projectionHash, scope, graph,
    policy: OLLIVIER_POLICY, policyHash: POLICY_HASH, parameters, solver: OLLIVIER_SOLVER, problems
  }, "requestHash", "onto2d:structural-ollivier-request:v1");
  if (new TextEncoder().encode(canonicalize(request)).length > LIMITS.maxTransportBytes) fail("LIMIT_EXCEEDED", "The request exceeds its byte bound.");
  return request;
}

function integer(value, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail("CERTIFICATE_INVALID", "Certificate integers are outside their exact bounds.");
  }
  return BigInt(value);
}

function array(value, length) {
  if (!Array.isArray(value) || value.length !== length) fail("CERTIFICATE_INVALID", "Certificate dimensions differ from the request.");
}

function acceptPrepared(response, request) {
  const value = canonicalClone(response);
  if (new TextEncoder().encode(canonicalize(value)).length > LIMITS.maxTransportBytes) fail("LIMIT_EXCEEDED", "The response exceeds its byte bound.");
  exactFields(value, ["schemaVersion", "requestHash", "solver", "solutions"]);
  if (value.schemaVersion !== "1" || value.requestHash !== request.requestHash || canonicalize(value.solver) !== canonicalize(request.solver)) {
    fail("RESPONSE_BINDING_MISMATCH", "The response is not bound to this exact request and solver.");
  }
  array(value.solutions, request.problems.length);
  let total = fraction(0n);
  const signs = { negative: 0, zero: 0, positive: 0 };
  const results = request.problems.map((problem, index) => {
    const solution = value.solutions[index];
    exactFields(solution, ["edgeId", "flow", "sourcePotentials", "targetPotentials", "costNumerator"]);
    if (solution.edgeId !== problem.edgeId) fail("CERTIFICATE_INVALID", "Solution edge order differs from the request.");
    const m = problem.sourceMeasure.length; const n = problem.targetMeasure.length;
    array(solution.flow, m); array(solution.sourcePotentials, m); array(solution.targetPotentials, n);
    const a = solution.sourcePotentials.map((v) => integer(v, -LIMITS.maxPotentialMagnitude, LIMITS.maxPotentialMagnitude));
    const b = solution.targetPotentials.map((v) => integer(v, -LIMITS.maxPotentialMagnitude, LIMITS.maxPotentialMagnitude));
    const columns = Array(n).fill(0n);
    let primal = 0n; let dual = 0n;
    for (let i = 0; i < m; i += 1) {
      array(solution.flow[i], n);
      let row = 0n;
      for (let j = 0; j < n; j += 1) {
        const mass = integer(solution.flow[i][j], 0, problem.massDenominator);
        const cost = BigInt(problem.costs[i][j]);
        if (a[i] + b[j] > cost) fail("CERTIFICATE_INVALID", "Transport dual constraints are violated.");
        row += mass; columns[j] += mass; primal += mass * cost;
      }
      if (row !== BigInt(problem.sourceMeasure[i].units)) fail("CERTIFICATE_INVALID", "Source mass is not conserved.");
      dual += a[i] * row;
    }
    for (let j = 0; j < n; j += 1) {
      if (columns[j] !== BigInt(problem.targetMeasure[j].units)) fail("CERTIFICATE_INVALID", "Target mass is not conserved.");
      dual += b[j] * columns[j];
    }
    if (primal !== dual || primal !== integer(solution.costNumerator, 0, 3 * problem.massDenominator)) {
      fail("CERTIFICATE_INVALID", "The transport plan does not prove an exact optimum.");
    }
    const curvature = fraction(BigInt(problem.massDenominator) - primal, BigInt(problem.massDenominator));
    total = add(total, curvature);
    const sign = curvature.n < 0n ? "negative" : curvature.n > 0n ? "positive" : "zero";
    signs[sign] += 1;
    return { id: problem.edgeId, source: problem.source, target: problem.target,
      wasserstein: encodedFraction(fraction(primal, BigInt(problem.massDenominator))),
      curvature: encodedFraction(curvature), sign };
  });
  return seal({ schemaVersion: "1", analysis: ANALYSIS, model: request.model, request, response: value,
    result: { edges: results, summary: { count: results.length, sum: encodedFraction(total),
      mean: encodedFraction(fraction(total.n, total.d * BigInt(results.length))), signs } }
  }, "artifactHash", "onto2d:structural-ollivier-artifact:v1");
}

export function acceptOllivierResponse(response, pack, input) {
  return acceptPrepared(response, prepareOllivierRequest(pack, input));
}

export function verifyOllivierArtifact(artifact, pack, input) {
  const value = canonicalClone(artifact);
  const expected = acceptOllivierResponse(value?.response, pack, input);
  if (canonicalize(value) !== canonicalize(expected)) fail("ARTIFACT_VERIFICATION_FAILED", "The artifact differs from source replay and certificate verification.");
  return expected;
}

export function createOllivierAnalyzer(adapter, options = {}) {
  const external = defineScientificAdapter(adapter);
  const identity = { id: external.id, version: external.version, method: external.method };
  if (canonicalize(identity) !== canonicalize(OLLIVIER_SOLVER)) fail("SOLVER_UNSUPPORTED", "The adapter must implement the frozen reference contract.");
  const settings = canonicalClone(options);
  exactFields(settings, ["maxCacheEntries"], []);
  const maximum = Object.hasOwn(settings, "maxCacheEntries") ? settings.maxCacheEntries : 16;
  if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > 128) fail("INPUT_INVALID", "Cache size must be between 0 and 128 entries.");
  const cache = new Map();
  return Object.freeze({
    async analyze(pack, input) {
      const request = prepareOllivierRequest(pack, input);
      const key = request.requestHash;
      if (cache.has(key)) {
        const cached = cache.get(key);
        // Revalidate cached certificates against the freshly verified source request.
        const verified = acceptPrepared(cached.response, request);
        cache.delete(key); cache.set(key, verified);
        return verified;
      }
      const artifact = acceptPrepared(await external.evaluate(request), request);
      if (maximum > 0) {
        cache.delete(key); cache.set(key, artifact);
        while (cache.size > maximum) cache.delete(cache.keys().next().value);
      }
      return artifact;
    },
    clearCache() { cache.clear(); }
  });
}

export function createOllivierAnalysis(adapter, options = {}) {
  const analyzer = createOllivierAnalyzer(adapter, options);
  return Object.freeze({
    ...ANALYSIS, requiredModelCapabilities: Object.freeze([]), requiredAdapterCapabilities: Object.freeze([]),
    inputSchema: OLLIVIER_INPUT_SCHEMA, outputArtifacts: Object.freeze([OLLIVIER_ARTIFACT_SCHEMA]),
    run(context, input) { return analyzer.analyze(packFromEngineModel(context?.model), input); }
  });
}
