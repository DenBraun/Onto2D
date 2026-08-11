import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyPredicatePlan } from "./predicate-plan-verifier.js";

const GRAPH_OPERATORS = new Set([
  "all",
  "any",
  "not",
  "degree",
  "cycleExists",
  "connected",
  "componentCount",
  "pathExists",
  "countRole"
]);
const OPTION_FIELDS = new Set(["policy", "limits"]);
const PARTIAL_FIELDS = new Set(["domain", "nodes", "edges", "nodesComplete"]);

export const GRAPH_PREDICATE_EVALUATOR_VERSION = "graph-predicate-evaluator-v1";
export const PARTIAL_GRAPH_PREDICATE_EVALUATOR_VERSION = "partial-graph-predicate-evaluator-v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "EVALUATE_GRAPH_PREDICATE", message, details });
}

function normalizeOptions(options) {
  if (!isObject(options)) throw new TypeError("Graph predicate evaluator options must be an object.");
  const value = canonicalClone(options);
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) throw new TypeError("Unknown graph predicate evaluator option.");
  return value;
}

function verifiedGraphPlan(plan) {
  const verified = verifyPredicatePlan(plan);
  const unsupported = verified.plan.requirements.operators
    .filter((operator) => !GRAPH_OPERATORS.has(operator));
  if (unsupported.length > 0) {
    fail(
      "PREDICATE_GRAPH_OPERATOR_UNSUPPORTED",
      "Graph predicate evaluation accepts only graph-structural operators.",
      { unsupported }
    );
  }
  return verified;
}

function compareNumbers(left, right) {
  return left - right;
}

function selectedNodes(graph, selector) {
  if (selector.kind === "canonical-index") {
    return selector.index < graph.nodes.length
      ? { indices: [selector.index], missing: false }
      : { indices: [], missing: true };
  }
  if (selector.kind === "all") {
    return { indices: graph.nodes.map((_, index) => index), missing: graph.nodes.length === 0 };
  }
  const expected = canonicalize(selector.equals);
  const indices = [];
  graph.nodes.forEach((node, index) => {
    const value = node.attrs?.[selector.attribute];
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      if (canonicalize(value) === expected) indices.push(index);
    }
  });
  return { indices, missing: indices.length === 0 };
}

function edgeMatchesRoles(edge, roles) {
  return roles === undefined || roles.includes(edge.role);
}

function rangePass(count, expression) {
  return (expression.min === undefined || count >= expression.min) &&
    (expression.max === undefined || count <= expression.max);
}

function partialRangeOutcome(count, expression, { passAvailable = true, failAvailable = true } = {}) {
  const hasMin = expression.min !== undefined;
  const hasMax = expression.max !== undefined;
  if (!hasMin && hasMax && failAvailable && count > expression.max) return "fail";
  if (hasMin && !hasMax && passAvailable && count >= expression.min) return "pass";
  return "indeterminate";
}

function witness(path, operator, outcome, fields = {}) {
  return {
    expressionPath: path,
    operator,
    outcome,
    ...fields
  };
}

function atomic(outcome, entry) {
  return { outcome, witnesses: [entry] };
}

function filteredEdgeRecords(graph, roles) {
  return graph.edges
    .map((edge, index) => ({ ...edge, index }))
    .filter((edge) => edgeMatchesRoles(edge, roles));
}

function cycleBounds(expression, projection, nodeCount) {
  const projectionMinimum = projection === "undirected-simple" ? 3 : 1;
  return {
    minimum: Math.max(projectionMinimum, expression.minLength ?? projectionMinimum),
    maximum: Math.min(expression.maxLength ?? nodeCount, nodeCount)
  };
}

function directedCycle(graph, expression) {
  const records = filteredEdgeRecords(graph, expression.roles);
  const adjacency = Array.from({ length: graph.nodes.length }, () => []);
  for (const edge of records) adjacency[edge.from].push(edge);
  adjacency.forEach((edges) => edges.sort((left, right) =>
    left.to - right.to || left.index - right.index
  ));
  const bounds = cycleBounds(expression, "directed", graph.nodes.length);

  function search(start, current, visited, nodes, edges) {
    for (const edge of adjacency[current]) {
      const length = edges.length + 1;
      if (edge.to === start && length >= bounds.minimum && length <= bounds.maximum) {
        return { nodes: [...nodes], edges: [...edges, edge.index] };
      }
      if (length >= bounds.maximum || visited.has(edge.to)) continue;
      visited.add(edge.to);
      nodes.push(edge.to);
      edges.push(edge.index);
      const found = search(start, edge.to, visited, nodes, edges);
      if (found !== null) return found;
      edges.pop();
      nodes.pop();
      visited.delete(edge.to);
    }
    return null;
  }

  for (let start = 0; start < graph.nodes.length; start += 1) {
    const found = search(start, start, new Set([start]), [start], []);
    if (found !== null) return found;
  }
  return null;
}

function undirectedEdges(graph, expression, simple) {
  const records = filteredEdgeRecords(graph, expression.roles);
  if (!simple) return records;
  const pairs = new Map();
  for (const edge of records) {
    if (edge.from === edge.to) continue;
    const from = Math.min(edge.from, edge.to);
    const to = Math.max(edge.from, edge.to);
    const key = `${from}:${to}`;
    if (!pairs.has(key)) pairs.set(key, { ...edge, from, to });
  }
  return [...pairs.values()].sort((left, right) =>
    left.from - right.from || left.to - right.to || left.index - right.index
  );
}

function undirectedCycle(graph, expression, simple) {
  const records = undirectedEdges(graph, expression, simple);
  const adjacency = Array.from({ length: graph.nodes.length }, () => []);
  for (const edge of records) {
    if (edge.from === edge.to) {
      adjacency[edge.from].push({ to: edge.to, index: edge.index });
    } else {
      adjacency[edge.from].push({ to: edge.to, index: edge.index });
      adjacency[edge.to].push({ to: edge.from, index: edge.index });
    }
  }
  adjacency.forEach((edges) => edges.sort((left, right) =>
    left.to - right.to || left.index - right.index
  ));
  const projection = simple ? "undirected-simple" : "undirected-multigraph";
  const bounds = cycleBounds(expression, projection, graph.nodes.length);

  function search(start, current, visitedNodes, usedEdges, nodes, edges) {
    for (const edge of adjacency[current]) {
      if (usedEdges.has(edge.index)) continue;
      const length = edges.length + 1;
      if (edge.to === start && length >= bounds.minimum && length <= bounds.maximum) {
        return { nodes: [...nodes], edges: [...edges, edge.index] };
      }
      if (length >= bounds.maximum || visitedNodes.has(edge.to)) continue;
      visitedNodes.add(edge.to);
      usedEdges.add(edge.index);
      nodes.push(edge.to);
      edges.push(edge.index);
      const found = search(start, edge.to, visitedNodes, usedEdges, nodes, edges);
      if (found !== null) return found;
      edges.pop();
      nodes.pop();
      usedEdges.delete(edge.index);
      visitedNodes.delete(edge.to);
    }
    return null;
  }

  for (let start = 0; start < graph.nodes.length; start += 1) {
    const found = search(start, start, new Set([start]), new Set(), [start], []);
    if (found !== null) return found;
  }
  return null;
}

function findCycle(graph, expression) {
  if (expression.projection === "directed") return directedCycle(graph, expression);
  return undirectedCycle(
    graph,
    expression,
    expression.projection === "undirected-simple"
  );
}

function directedPath(graph, from, to, roles) {
  if (from === to) return { nodes: [from], edges: [] };
  const adjacency = Array.from({ length: graph.nodes.length }, () => []);
  for (const edge of filteredEdgeRecords(graph, roles)) adjacency[edge.from].push(edge);
  adjacency.forEach((edges) => edges.sort((left, right) =>
    left.to - right.to || left.index - right.index
  ));
  const seen = new Set([from]);
  const pending = [{ node: from, nodes: [from], edges: [] }];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const edge of adjacency[current.node]) {
      if (seen.has(edge.to)) continue;
      const next = {
        node: edge.to,
        nodes: [...current.nodes, edge.to],
        edges: [...current.edges, edge.index]
      };
      if (edge.to === to) return { nodes: next.nodes, edges: next.edges };
      seen.add(edge.to);
      pending.push(next);
    }
  }
  return null;
}

function findPath(graph, expression) {
  const from = selectedNodes(graph, expression.from);
  const to = selectedNodes(graph, expression.to);
  if (from.missing || to.missing) return { status: "selector-empty", path: null };
  for (const source of from.indices) {
    for (const target of to.indices) {
      const found = directedPath(graph, source, target, expression.roles);
      if (found !== null) return { status: "found", path: found };
    }
  }
  return { status: "absent", path: null };
}

function weakComponents(graph) {
  const adjacency = Array.from({ length: graph.nodes.length }, () => new Set());
  for (const edge of graph.edges) {
    adjacency[edge.from].add(edge.to);
    adjacency[edge.to].add(edge.from);
  }
  const unseen = new Set(graph.nodes.map((_, index) => index));
  const components = [];
  while (unseen.size > 0) {
    const start = Math.min(...unseen);
    unseen.delete(start);
    const component = [];
    const pending = [start];
    while (pending.length > 0) {
      const node = pending.shift();
      component.push(node);
      for (const neighbor of [...adjacency[node]].sort(compareNumbers)) {
        if (!unseen.has(neighbor)) continue;
        unseen.delete(neighbor);
        pending.push(neighbor);
      }
    }
    components.push(component.sort(compareNumbers));
  }
  return components;
}

function strongComponents(graph) {
  const adjacency = Array.from({ length: graph.nodes.length }, () => []);
  for (const edge of graph.edges) adjacency[edge.from].push(edge.to);
  adjacency.forEach((neighbors) => neighbors.sort(compareNumbers));
  let nextIndex = 0;
  const indexes = Array(graph.nodes.length).fill(-1);
  const lowlinks = Array(graph.nodes.length).fill(-1);
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(node) {
    indexes[node] = nextIndex;
    lowlinks[node] = nextIndex;
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    for (const neighbor of adjacency[node]) {
      if (indexes[neighbor] === -1) {
        visit(neighbor);
        lowlinks[node] = Math.min(lowlinks[node], lowlinks[neighbor]);
      } else if (onStack.has(neighbor)) {
        lowlinks[node] = Math.min(lowlinks[node], indexes[neighbor]);
      }
    }
    if (lowlinks[node] !== indexes[node]) return;
    const component = [];
    while (component.length === 0 || component.at(-1) !== node) {
      const member = stack.pop();
      onStack.delete(member);
      component.push(member);
    }
    components.push(component.sort(compareNumbers));
  }

  for (let node = 0; node < graph.nodes.length; node += 1) {
    if (indexes[node] === -1) visit(node);
  }
  return components.sort((left, right) => left[0] - right[0]);
}

function components(graph, policy) {
  return policy.connectivityProjection === "directed-strong"
    ? strongComponents(graph)
    : weakComponents(graph);
}

function combineLogical(operator, children) {
  if (operator === "all") {
    if (children.some((child) => child.outcome === "fail")) return "fail";
    if (children.every((child) => child.outcome === "pass")) return "pass";
    return "indeterminate";
  }
  if (children.some((child) => child.outcome === "pass")) return "pass";
  if (children.every((child) => child.outcome === "fail")) return "fail";
  return "indeterminate";
}

export function evaluateCanonicalPredicateExpression(expression, path, context) {
  if (expression.op === "all" || expression.op === "any") {
    const children = expression.args.map((child, index) =>
      evaluateCanonicalPredicateExpression(child, `${path}.args[${index}]`, context)
    );
    return {
      outcome: combineLogical(expression.op, children),
      witnesses: children.flatMap((child) => child.witnesses)
    };
  }
  if (expression.op === "not") {
    const child = evaluateCanonicalPredicateExpression(expression.arg, `${path}.arg`, context);
    return {
      outcome: child.outcome === "pass"
        ? "fail"
        : child.outcome === "fail"
          ? "pass"
          : "indeterminate",
      witnesses: child.witnesses
    };
  }
  if (expression.op === "compare" && typeof context.evaluateCompare === "function") {
    return context.evaluateCompare(expression, path, context);
  }
  if (expression.op === "countRole") {
    const edges = filteredEdgeRecords(context.graph, [expression.role]).map((edge) => edge.index);
    const outcome = context.partial
      ? partialRangeOutcome(edges.length, expression)
      : rangePass(edges.length, expression) ? "pass" : "fail";
    return atomic(outcome, witness(path, expression.op, outcome, {
      edgeIndexes: edges,
      count: edges.length,
      role: expression.role,
      ...(expression.min === undefined ? {} : { min: expression.min }),
      ...(expression.max === undefined ? {} : { max: expression.max })
    }));
  }
  if (expression.op === "degree") {
    const selection = selectedNodes(context.graph, expression.node);
    if (selection.missing) {
      return atomic("indeterminate", witness(path, expression.op, "indeterminate", {
        reason: "selector-empty"
      }));
    }
    const records = selection.indices.map((node) => {
      const edgeIndexes = context.graph.edges
        .map((edge, index) => ({ edge, index }))
        .filter(({ edge }) =>
          (edge.from === node || edge.to === node) &&
          (expression.role === undefined || edge.role === expression.role)
        )
        .map(({ index }) => index);
      return { node, edgeIndexes, count: edgeIndexes.length };
    });
    let outcome;
    if (context.partial) {
      const hasMin = expression.min !== undefined;
      const hasMax = expression.max !== undefined;
      if (!hasMin && hasMax && records.some((entry) => entry.count > expression.max)) {
        outcome = "fail";
      } else if (
        hasMin && !hasMax && context.nodesComplete &&
        records.every((entry) => entry.count >= expression.min)
      ) {
        outcome = "pass";
      } else {
        outcome = "indeterminate";
      }
    } else {
      outcome = records.every((entry) => rangePass(entry.count, expression)) ? "pass" : "fail";
    }
    return {
      outcome,
      witnesses: records.map((entry) => witness(path, expression.op, outcome, {
        nodeIndexes: [entry.node],
        edgeIndexes: entry.edgeIndexes,
        count: entry.count,
        ...(expression.role === undefined ? {} : { role: expression.role }),
        ...(expression.min === undefined ? {} : { min: expression.min }),
        ...(expression.max === undefined ? {} : { max: expression.max })
      }))
    };
  }
  if (expression.op === "cycleExists") {
    const found = findCycle(context.graph, expression);
    const outcome = found === null
      ? context.partial ? "indeterminate" : "fail"
      : "pass";
    return atomic(outcome, witness(path, expression.op, outcome, {
      projection: expression.projection,
      ...(expression.roles === undefined ? {} : { roles: expression.roles }),
      ...(found === null
        ? { reason: "no-matching-cycle" }
        : { nodeIndexes: found.nodes, edgeIndexes: found.edges })
    }));
  }
  if (expression.op === "pathExists") {
    const found = findPath(context.graph, expression);
    const outcome = found.status === "found"
      ? "pass"
      : context.partial ? "indeterminate" : found.status === "selector-empty" ? "indeterminate" : "fail";
    return atomic(outcome, witness(path, expression.op, outcome, {
      ...(expression.roles === undefined ? {} : { roles: expression.roles }),
      ...(found.path === null
        ? { reason: found.status === "selector-empty" ? "selector-empty" : "no-matching-path" }
        : { nodeIndexes: found.path.nodes, edgeIndexes: found.path.edges })
    }));
  }
  if (expression.op === "connected" || expression.op === "componentCount") {
    if (context.partial) {
      return atomic("indeterminate", witness(path, expression.op, "indeterminate", {
        reason: "partial-connectivity-repairable"
      }));
    }
    const found = components(context.graph, context.graphPolicy);
    const outcome = expression.op === "connected"
      ? found.length === 1 ? "pass" : "fail"
      : found.length === expression.count ? "pass" : "fail";
    return atomic(outcome, witness(path, expression.op, outcome, {
      components: found,
      count: found.length,
      ...(expression.op === "componentCount" ? { expectedCount: expression.count } : {})
    }));
  }
  fail("PREDICATE_GRAPH_OPERATOR_UNSUPPORTED", "Predicate expression reached an unsupported graph operator.", {
    operator: expression.op,
    path
  });
}

function evaluationBasis(verified, candidate, result) {
  return {
    schemaVersion: "1",
    evaluator: GRAPH_PREDICATE_EVALUATOR_VERSION,
    predicatePlanHash: verified.plan.planHash,
    candidateId: candidate.candidateId,
    graphPolicy: candidate.graphPolicy,
    outcome: result.outcome,
    witnesses: result.witnesses
  };
}

export function evaluateGraphPredicatePlan(plan, candidate, options = {}) {
  const verified = verifiedGraphPlan(plan);
  const normalizedOptions = normalizeOptions(options);
  const canonical = canonicalizeCandidate(candidate, normalizedOptions);
  const result = evaluateCanonicalPredicateExpression(verified.analysis.expression, "$", {
    graph: canonical.canonical,
    graphPolicy: canonical.graphPolicy,
    partial: false,
    nodesComplete: true
  });
  const basis = evaluationBasis(verified, canonical, result);
  return deepFreeze({
    ...basis,
    evaluationHash: hashCanonical(HASH_DOMAINS.PREDICATE_GRAPH_EVALUATION, basis)
  });
}

function normalizePartialGraph(input) {
  if (!isObject(input)) {
    fail("PARTIAL_PREDICATE_GRAPH_INVALID", "Partial predicate graph must be an object.");
  }
  const value = canonicalClone(input);
  const unknown = Object.keys(value).filter((field) => !PARTIAL_FIELDS.has(field));
  const missing = [...PARTIAL_FIELDS].filter((field) => !Object.prototype.hasOwnProperty.call(value, field));
  if (
    unknown.length > 0 ||
    missing.length > 0 ||
    typeof value.nodesComplete !== "boolean" ||
    !Array.isArray(value.nodes) ||
    value.nodes.length === 0 ||
    !Array.isArray(value.edges)
  ) {
    fail("PARTIAL_PREDICATE_GRAPH_INVALID", "Partial predicate graph fields do not match the supported contract.", {
      unknown,
      missing
    });
  }
  const structuralNodeAttributes = [...new Set(value.nodes.flatMap((node) =>
    isObject(node?.attrs) ? Object.keys(node.attrs) : []
  ))].sort();
  const structuralEdgeAttributes = [...new Set(value.edges.flatMap((edge) =>
    isObject(edge?.attrs) ? Object.keys(edge.attrs) : []
  ))].sort();
  const canonical = canonicalizeCandidate({
    domain: value.domain,
    nodes: value.nodes,
    edges: value.edges
  }, {
    policy: {
      connected: false,
      allowParallelEdges: true,
      allowSelfLoops: true,
      connectivityProjection: "undirected",
      structuralNodeAttributes,
      structuralEdgeAttributes
    }
  });
  return {
    graph: canonical.canonical,
    nodesComplete: value.nodesComplete
  };
}

export function detectPartialGraphPredicateFailure(plan, partialGraph) {
  const verified = verifiedGraphPlan(plan);
  const normalized = normalizePartialGraph(partialGraph);
  const eligibility = verified.plan.pruning.eligibility;
  let result = { outcome: "indeterminate", witnesses: [] };
  let detection = "blocked-plan";
  let reason = "plan-not-static-proven";
  if (eligibility === "static-proven") {
    result = evaluateCanonicalPredicateExpression(verified.analysis.expression, "$", {
      graph: normalized.graph,
      graphPolicy: {
        connected: false,
        allowParallelEdges: true,
        allowSelfLoops: true,
        connectivityProjection: "undirected",
        structuralNodeAttributes: [],
        structuralEdgeAttributes: []
      },
      partial: true,
      nodesComplete: normalized.nodesComplete
    });
    detection = result.outcome === "fail" ? "persistent-failure" : "not-detected";
    reason = result.outcome === "fail"
      ? "persistent-failure-detected"
      : "partial-failure-not-detected";
  }
  const graphBasis = {
    domain: normalized.graph.domain,
    nodes: normalized.graph.nodes,
    edges: normalized.graph.edges,
    nodesComplete: normalized.nodesComplete
  };
  const basis = {
    schemaVersion: "1",
    evaluator: PARTIAL_GRAPH_PREDICATE_EVALUATOR_VERSION,
    predicatePlanHash: verified.plan.planHash,
    partialGraphHash: hashCanonical(HASH_DOMAINS.PARTIAL_PREDICATE_GRAPH, graphBasis),
    outcome: result.outcome,
    detection,
    reason,
    persistentFailureDetected: detection === "persistent-failure",
    pruningEligibility: eligibility,
    auditRequired: verified.plan.pruning.auditRequired,
    pruningAuthorized: false,
    witnesses: result.witnesses
  };
  return deepFreeze({
    ...basis,
    evaluationHash: hashCanonical(HASH_DOMAINS.PARTIAL_PREDICATE_EVALUATION, basis)
  });
}
