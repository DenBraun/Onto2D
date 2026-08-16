const GRAPH_POSITIONS = Object.freeze([
  Object.freeze({ x: 150, y: 45 }),
  Object.freeze({ x: 65, y: 205 }),
  Object.freeze({ x: 235, y: 205 })
]);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertView(view) {
  if (!view || !view.scenario || !Array.isArray(view.labels) || view.labels.length !== 3) {
    throw new Error("Identity graph view requires one scenario and exactly three labels.");
  }
  if (!Array.isArray(view.edges) || view.edges.length !== 3) {
    throw new Error("Identity graph view requires exactly three directed edges.");
  }
  for (const edge of view.edges) {
    if (!Number.isInteger(edge.from) || !Number.isInteger(edge.to) || !GRAPH_POSITIONS[edge.from] || !GRAPH_POSITIONS[edge.to]) {
      throw new Error("Identity graph edge endpoints must reference the three displayed nodes.");
    }
    if (edge.from === edge.to || typeof edge.role !== "string" || edge.role.length === 0) {
      throw new Error("Identity graph edges require distinct endpoints and a non-empty role.");
    }
  }
}

function clippedLine(edge) {
  const start = GRAPH_POSITIONS[edge.from];
  const end = GRAPH_POSITIONS[edge.to];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  return Object.freeze({
    x1: start.x + ux * 21,
    y1: start.y + uy * 21,
    x2: end.x - ux * 24,
    y2: end.y - uy * 24
  });
}

export function graphSvg(view) {
  assertView(view);
  const paths = view.edges.map((edge, index) => {
    const line = clippedLine(edge);
    const roleEdge = edge.role === "inhibits";
    return `<path class="graph-edge${roleEdge ? " role-edge" : ""}" data-edge-index="${index}" data-from="${edge.from}" data-to="${edge.to}" data-role="${escapeXml(edge.role)}" d="M${line.x1.toFixed(1)} ${line.y1.toFixed(1)}L${line.x2.toFixed(1)} ${line.y2.toFixed(1)}" marker-end="url(#${roleEdge ? "identity-role-arrow" : "identity-arrow"})"></path>`;
  }).join("");
  const nodes = GRAPH_POSITIONS.map((position, index) => (
    `<g class="graph-node" data-node-index="${index}" data-label="${escapeXml(view.labels[index])}"><circle cx="${position.x}" cy="${position.y}" r="20"></circle><text x="${position.x}" y="${position.y}" dominant-baseline="middle">${escapeXml(view.labels[index])}</text></g>`
  )).join("");
  const description = view.edges.map((edge) => (
    `${view.labels[edge.from]} to ${view.labels[edge.to]} [${edge.role}]`
  )).join("; ");

  return `<svg viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="identity-graph-title identity-graph-description"><title id="identity-graph-title">${escapeXml(view.scenario.name)}</title><desc id="identity-graph-description">Input edges: ${escapeXml(description)}.</desc><defs><marker id="identity-arrow" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10" refY="5" viewBox="0 0 10 10" orient="auto"><path d="M0 0 10 5 0 10z"></path></marker><marker class="role-marker" id="identity-role-arrow" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10" refY="5" viewBox="0 0 10 10" orient="auto"><path d="M0 0 10 5 0 10z"></path></marker></defs><g class="input-graph-edges">${paths}</g><g class="input-graph-nodes">${nodes}</g></svg>`;
}
