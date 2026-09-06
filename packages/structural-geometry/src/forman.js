import { canonicalize } from "@onto2d/kernel/canonical";

const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function summarize(values) {
  let sum = 0;
  let minimum = null;
  let maximum = null;
  const counts = new Map();
  for (const curvature of values) {
    sum += curvature;
    minimum = minimum === null ? curvature : Math.min(minimum, curvature);
    maximum = maximum === null ? curvature : Math.max(maximum, curvature);
    counts.set(curvature, (counts.get(curvature) ?? 0) + 1);
  }
  return {
    count: values.length,
    sum,
    minimum,
    maximum,
    mean: values.length === 0 ? null : { numerator: sum, denominator: values.length },
    histogram: [...counts].sort(([a], [b]) => a - b).map(([curvature, count]) => ({ curvature, count }))
  };
}

function group(edges, attributeRecord, field) {
  const groups = new Map();
  for (const edge of edges) {
    const record = attributeRecord(edge);
    const key = Object.hasOwn(record, field)
      ? { present: true, value: record[field] }
      : { present: false };
    const serialized = canonicalize(key);
    if (!groups.has(serialized)) groups.set(serialized, { key, values: [] });
    groups.get(serialized).values.push(edge.curvature);
  }
  return [...groups].sort(([a], [b]) => compareText(a, b)).map(([, entry]) => ({
    key: entry.key,
    summary: summarize(entry.values)
  }));
}

// Internal only: callers construct this projection from a verified Model Pack.
export function calculateDirectedUnitForman(projection) {
  const nodes = projection.nodes.map(({ id }) => ({
    id, inDegree: 0, outDegree: 0, incomingCurvature: 0, outgoingCurvature: 0, balance: 0
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of projection.edges) {
    byId.get(edge.source).outDegree += 1;
    byId.get(edge.target).inDegree += 1;
  }
  const edges = projection.edges.map(({ id, source, target }) => {
    const from = byId.get(source);
    const to = byId.get(target);
    // Saucan et al., equation (5): incoming at SOURCE, outgoing at TARGET.
    const curvature = 2 - from.inDegree - to.outDegree;
    from.outgoingCurvature += curvature;
    to.incomingCurvature += curvature;
    return { id, source, target, inDegreeAtSource: from.inDegree, outDegreeAtTarget: to.outDegree, curvature };
  });
  for (const node of nodes) node.balance = node.incomingCurvature - node.outgoingCurvature;
  const summary = summarize(edges.map((edge) => edge.curvature));
  const nodeAttributes = new Map(projection.nodes.map((node) => [node.id, node.attributes]));
  const edgeAttributes = new Map(projection.edges.map((edge) => [edge.id, edge.attributes]));
  return {
    nodes,
    edges,
    summary,
    groups: {
      bySourceLevel: group(edges, (edge) => nodeAttributes.get(edge.source), "level"),
      byTargetLevel: group(edges, (edge) => nodeAttributes.get(edge.target), "level"),
      byDependencyType: group(edges, (edge) => edgeAttributes.get(edge.id), "dependencyType"),
      byNecessity: group(edges, (edge) => edgeAttributes.get(edge.id), "necessity"),
      byOntologicalRole: group(edges, (edge) => edgeAttributes.get(edge.id), "ontologicalRole")
    },
    extrema: {
      minimumEdgeIds: edges.filter((edge) => edge.curvature === summary.minimum).map((edge) => edge.id),
      maximumEdgeIds: edges.filter((edge) => edge.curvature === summary.maximum).map((edge) => edge.id)
    }
  };
}
