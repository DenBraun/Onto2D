import { canonicalClone, canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel/canonical";
import { STRUCTURAL_FLOW_SOLVER } from "./flow-policy.js";
import { ONE, F, allDistances, compare, encode, fail, fields, integer, limits, mul, plus, rational, sub, sum, div } from "./flow-math.js";

const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const lcm = (a, b) => a / gcd(a, b) * b;
const order = (a, b) => a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0;

export function flowMeasures(graph, idleness) {
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  graph.edges.forEach((edge) => { incoming.get(edge.target).push(edge.source); outgoing.get(edge.source).push(edge.target); });
  function measure(endpoint, neighbors) {
    if (!neighbors.length) return [{ nodeId: endpoint, denominator: 1 }];
    const values = neighbors.map((nodeId) => ({ nodeId, denominator: neighbors.length * (idleness === "half" ? 2 : 1) }));
    if (idleness === "half") values.push({ nodeId: endpoint, denominator: 2 });
    if (values.length > limits.maxSupportSize) fail("LIMIT_EXCEEDED", "Flow transport support exceeds the declared bound.");
    return values.sort(order);
  }
  return graph.edges.map((edge) => {
    const left = measure(edge.source, incoming.get(edge.source));
    const right = measure(edge.target, outgoing.get(edge.target));
    const denominator = [...left, ...right].reduce((d, value) => lcm(d, value.denominator), 1);
    if (denominator > limits.maxMassDenominator) fail("LIMIT_EXCEEDED", "Flow mass denominator exceeds the declared bound.");
    const encodeMeasure = (values) => values.map(({ nodeId, denominator: d }) => ({ nodeId, units: denominator / d }));
    return { sourceMeasure: encodeMeasure(left), targetMeasure: encodeMeasure(right), massDenominator: denominator };
  });
}

export function prepareTransport(request, lengths, iteration, previousStateHash) {
  const graph = request.graph;
  const distances = allDistances(graph, lengths);
  const measures = flowMeasures(graph, request.parameters.idleness);
  const metricHash = hashCanonical("onto2d:structural-flow-metric:v1", { flowRequestHash: request.requestHash, lengths: lengths.map(encode) });
  const problems = graph.edges.map((edge, i) => ({ edgeId: edge.id, source: edge.source, target: edge.target,
    distance: encode(distances(edge.source, edge.target)), ...measures[i],
    costs: measures[i].sourceMeasure.map((a) => measures[i].targetMeasure.map((b) => {
      const distance = distances(a.nodeId, b.nodeId);
      if (distance === null) fail("UNREACHABLE_SUPPORT", "Flow transport requires an unreachable directed support pair.");
      return encode(distance);
    })) }));
  const body = { schemaVersion: "1", flowRequestHash: request.requestHash, iteration, previousStateHash, metricHash,
    solver: STRUCTURAL_FLOW_SOLVER, problems };
  const result = deepFreeze({ ...body, requestHash: hashCanonical("onto2d:structural-flow-transport:v1", body) });
  if (new TextEncoder().encode(canonicalize(result)).length > limits.maxTransportBytes) fail("LIMIT_EXCEEDED", "Flow transport request exceeds its byte bound.");
  return result;
}

function array(value, length) {
  if (!Array.isArray(value) || value.length !== length) fail("CERTIFICATE_INVALID", "Flow certificate dimensions differ from the exact request.");
}

export function verifyTransport(response, request) {
  const value = canonicalClone(response);
  if (new TextEncoder().encode(canonicalize(value)).length > limits.maxTransportBytes) fail("LIMIT_EXCEEDED", "Flow transport response exceeds its byte bound.");
  fields(value, ["schemaVersion", "requestHash", "solver", "solutions"]);
  if (value.schemaVersion !== "1" || value.requestHash !== request.requestHash || canonicalize(value.solver) !== canonicalize(request.solver)) {
    fail("RESPONSE_BINDING_MISMATCH", "Flow transport response differs from the expected request/solver identity.");
  }
  array(value.solutions, request.problems.length);
  const edges = request.problems.map((problem, index) => {
    const solution = value.solutions[index];
    fields(solution, ["edgeId", "flow", "sourcePotentials", "targetPotentials", "costNumerator"]);
    if (solution.edgeId !== problem.edgeId) fail("CERTIFICATE_INVALID", "Flow certificate edge order differs.");
    const m = problem.sourceMeasure.length; const n = problem.targetMeasure.length;
    array(solution.flow, m); array(solution.sourcePotentials, m); array(solution.targetPotentials, n);
    const a = solution.sourcePotentials.map((v) => rational(v));
    const b = solution.targetPotentials.map((v) => rational(v));
    const columns = Array(n).fill(0);
    const primalTerms = []; const dualTerms = [];
    for (let i = 0; i < m; i += 1) {
      array(solution.flow[i], n);
      let row = 0;
      for (let j = 0; j < n; j += 1) {
        const mass = integer(solution.flow[i][j], 0, problem.massDenominator);
        const cost = rational(problem.costs[i][j]);
        if (compare(plus(a[i], b[j]), cost) > 0) fail("CERTIFICATE_INVALID", "Flow dual feasibility is violated.");
        row += mass; columns[j] += mass;
        primalTerms.push(mul(F(mass), cost));
      }
      if (row !== problem.sourceMeasure[i].units) fail("CERTIFICATE_INVALID", "Flow source mass is not conserved.");
      dualTerms.push(mul(a[i], F(row)));
    }
    columns.forEach((mass, j) => {
      if (mass !== problem.targetMeasure[j].units) fail("CERTIFICATE_INVALID", "Flow target mass is not conserved.");
      dualTerms.push(mul(b[j], F(mass)));
    });
    const primal = sum(primalTerms); const dual = sum(dualTerms);
    if (compare(primal, dual) !== 0 || compare(primal, rational(solution.costNumerator)) !== 0) {
      fail("CERTIFICATE_INVALID", "Flow transport does not prove exact primal/dual equality.");
    }
    const wasserstein = div(primal, F(problem.massDenominator));
    return { id: problem.edgeId, wasserstein, curvature: sub(ONE, div(wasserstein, rational(problem.distance, true))) };
  });
  return { response: value, edges };
}
