const EXPECTED_FORMATS = Object.freeze({
  trace: "onto2d-live-bootstrap-upstream-trace",
  stateHistory: "onto2d-live-bootstrap-state-history",
  evidence: "onto2d-live-bootstrap-provenance-evidence",
  graph: "onto2d-live-bootstrap-provenance-graph",
  constructionSpace: "onto2d-live-bootstrap-construction-space",
  regimes: "onto2d-live-bootstrap-admissibility-regimes",
  analysis: "onto2d-live-bootstrap-historical-load-bundle"
});

const EVIDENCE_MODES = new Set(["observed", "derived", "all"]);

function fail(message) {
  throw new TypeError(`Bootstrap provenance model rejected its input: ${message}`);
}

function requireObject(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${name} must be an object`);
  }
  return value;
}

function requireArray(value, name) {
  if (!Array.isArray(value)) fail(`${name} must be an array`);
  return value;
}

function uniqueIndex(records, field, name) {
  const result = new Map();
  for (const record of records) {
    const id = record?.[field];
    if (typeof id !== "string" || id === "" || result.has(id)) {
      fail(`${name} must have unique ${field} values`);
    }
    result.set(id, record);
  }
  return result;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneFrozen(value) {
  const clone = structuredClone(value);
  const freeze = (entry) => {
    if (entry === null || typeof entry !== "object" || Object.isFrozen(entry)) return entry;
    Object.freeze(entry);
    Object.values(entry).forEach(freeze);
    return entry;
  };
  return freeze(clone);
}

function evidenceModeAccepts(mode, edge) {
  if (mode === "observed") return edge.layer === "upstream-fact";
  if (mode === "derived") return edge.evidenceClass !== "inferred-dependency";
  return true;
}

export class BootstrapProvenanceModel {
  #data;
  #events;
  #states;
  #evidence;
  #nodes;
  #edges;
  #paths;
  #constraints;
  #regimes;
  #results;

  constructor(input) {
    const supplied = requireObject(input, "input");
    for (const [name, format] of Object.entries(EXPECTED_FORMATS)) {
      const artifact = requireObject(supplied[name], name);
      if (artifact.format !== format || artifact.formatVersion !== "1") {
        fail(`${name} has an unsupported format`);
      }
    }
    const data = cloneFrozen(supplied);
    if (
      data.stateHistory.traceIdentity !== data.trace.traceIdentity
      || data.evidence.traceIdentity !== data.trace.traceIdentity
      || data.graph.traceIdentity !== data.trace.traceIdentity
      || data.graph.evidenceIdentity !== data.evidence.evidenceIdentity
      || data.analysis.traceIdentity !== data.trace.traceIdentity
      || data.analysis.sourceIdentity !== data.trace.source.sourceIdentity
    ) {
      fail("artifact identities cross a source or derivation boundary");
    }
    if (data.constructionSpace.bounded !== true || data.analysis.pathSpace.bounded !== true) {
      fail("the counterfactual path space must be explicitly bounded");
    }
    if (data.analysis.pathSpace.pathSpaceIdentity !== data.analysis.pathSpaceIdentity) {
      fail("Historical Load is bound to another path space");
    }
    if (
      data.analysis.pathSpace.regimesIdentity !== data.analysis.regimesIdentity
      || data.analysis.pathSpace.analysisVersion !== data.constructionSpace.analysisVersion
      || data.analysis.pathSpace.target.id !== data.constructionSpace.target.id
      || JSON.stringify(data.analysis.pathSpace.counterfactualEdges)
        !== JSON.stringify(data.constructionSpace.counterfactualEdges)
    ) {
      fail("analysis artifacts do not share one declared construction model");
    }

    this.#events = uniqueIndex(requireArray(data.trace.events, "trace.events"), "eventId", "events");
    this.#states = uniqueIndex(requireArray(data.stateHistory.states, "stateHistory.states"), "stateId", "states");
    this.#evidence = uniqueIndex(requireArray(data.evidence.records, "evidence.records"), "evidenceId", "evidence");
    this.#nodes = uniqueIndex(requireArray(data.graph.nodes, "graph.nodes"), "id", "graph nodes");
    this.#edges = uniqueIndex(requireArray(data.graph.edges, "graph.edges"), "id", "graph edges");
    this.#paths = uniqueIndex(requireArray(data.analysis.pathSpace.paths, "analysis.pathSpace.paths"), "id", "paths");
    this.#constraints = uniqueIndex(requireArray(data.regimes.constraints, "regimes.constraints"), "id", "constraints");
    this.#regimes = uniqueIndex(requireArray(data.regimes.regimes, "regimes.regimes"), "id", "regimes");
    this.#results = new Map();
    const costFunctionIds = new Set(data.analysis.pathSpace.costFunctions.map((cost) => cost.id));
    const optimizationRegimeIds = new Set(
      [...this.#regimes.values()].filter((regime) => regime.optimization).map((regime) => regime.id)
    );

    for (const edge of this.#edges.values()) {
      if (!this.#nodes.has(edge.source) || !this.#nodes.has(edge.target)) {
        fail(`graph edge ${edge.id} has an unresolved endpoint`);
      }
      const evidence = this.#evidence.get(edge.id);
      if (
        evidence === undefined
        || evidence.subject !== edge.source
        || evidence.object !== edge.target
        || evidence.evidenceClass !== edge.evidenceClass
      ) {
        fail(`graph edge ${edge.id} is not exactly backed by evidence`);
      }
    }
    for (const edge of data.constructionSpace.counterfactualEdges) {
      if (edge.upstreamFact !== false || edge.introducedBy !== "Onto2D") {
        fail(`counterfactual edge ${edge.id} crosses the upstream fact boundary`);
      }
      if (this.#edges.has(edge.id) || this.#evidence.has(edge.id)) {
        fail(`counterfactual edge ${edge.id} leaked into extracted evidence`);
      }
    }
    for (const result of data.analysis.results) {
      const key = `${result.costFunction.id}\u0000${result.regime.id}`;
      if (this.#results.has(key)) fail("Historical Load result keys must be unique");
      if (!costFunctionIds.has(result.costFunction.id) || !optimizationRegimeIds.has(result.regime.id)) {
        fail("Historical Load result has an undeclared cost or optimization regime");
      }
      if (
        result.target.id !== data.analysis.pathSpace.target.id
        || result.pathSpace.identity !== data.analysis.pathSpaceIdentity
        || result.regime.regimesIdentity !== data.analysis.regimesIdentity
        || result.traceIdentity !== data.trace.traceIdentity
        || result.upstreamRevision !== data.trace.source.revision
        || result.analysisVersion !== data.constructionSpace.analysisVersion
      ) {
        fail("Historical Load result is bound to another analysis input");
      }
      if (!this.#paths.has(result.freePath) || !this.#paths.has(result.admissiblePath)) {
        fail("Historical Load result refers to an undeclared path");
      }
      this.#results.set(key, result);
    }
    if (this.#results.size !== costFunctionIds.size * optimizationRegimeIds.size) {
      fail("Historical Load result matrix is incomplete");
    }
    this.#data = data;
    Object.freeze(this);
  }

  get descriptor() {
    return Object.freeze({
      upstreamRevision: this.#data.trace.source.revision,
      sourceIdentity: this.#data.trace.source.sourceIdentity,
      traceIdentity: this.#data.trace.traceIdentity,
      evidenceIdentity: this.#data.evidence.evidenceIdentity,
      analysisIdentity: this.#data.analysis.analysisIdentity,
      eventCount: this.#events.size,
      activeEventCount: this.#data.trace.statistics.activeEventCount,
      inactiveEventCount: this.#data.trace.statistics.inactiveEventCount,
      nodeCount: this.#nodes.size,
      edgeCount: this.#edges.size,
      pathCount: this.#paths.size,
      target: this.#data.analysis.pathSpace.target,
      disclaimer: this.#data.analysis.disclaimer
    });
  }

  get filters() {
    const directives = [...new Set([...this.#events.values()].map((event) => event.directive))]
      .sort(compareText);
    const evidenceClasses = [...new Set([...this.#edges.values()].map((edge) => edge.evidenceClass))]
      .sort(compareText);
    return Object.freeze({
      directives: Object.freeze(directives),
      evidenceClasses: Object.freeze(evidenceClasses),
      costFunctions: this.#data.analysis.pathSpace.costFunctions,
      regimes: Object.freeze([...this.#regimes.values()].filter((regime) => regime.optimization))
    });
  }

  trace({ directive = "all", status = "all", query = "" } = {}) {
    const normalizedQuery = String(query).trim().toLowerCase();
    return Object.freeze([...this.#events.values()].filter((event) => {
      const active = event.profileStatus.active;
      return (directive === "all" || event.directive === directive)
        && (status === "all" || (status === "active") === active)
        && (normalizedQuery === "" || [
          event.eventId,
          event.target,
          ...event.targets,
          event.definition?.name,
          event.source.raw,
          event.source.comment
        ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)));
    }));
  }

  provenance(mode = "derived") {
    if (!EVIDENCE_MODES.has(mode)) fail(`unknown evidence mode ${mode}`);
    const edges = [...this.#edges.values()].filter((edge) => evidenceModeAccepts(mode, edge));
    const nodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    const nodes = [...nodeIds].map((id) => this.#nodes.get(id)).sort((a, b) => compareText(a.id, b.id));
    const inferredCount = edges.filter((edge) => edge.evidenceClass === "inferred-dependency").length;
    return Object.freeze({
      mode,
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      inferredCount,
      counterfactualEdges: this.#data.constructionSpace.counterfactualEdges
    });
  }

  trustRoots() {
    const roots = new Map();
    for (const node of this.#nodes.values()) {
      if (node.id.startsWith("external-root:")) {
        roots.set(node.id, { id: node.id, label: node.label, layer: node.layer, origin: "extracted-boundary" });
      }
    }
    for (const path of this.#paths.values()) {
      for (const step of path.steps) {
        for (const id of step.trustRoots) {
          if (!roots.has(id)) {
            roots.set(id, { id, label: id.replace(/^trust-root:/, ""), layer: "onto2d-analysis", origin: "counterfactual-path" });
          }
        }
      }
    }
    return Object.freeze([...roots.values()].sort((a, b) => compareText(a.id, b.id)));
  }

  historicalLoad(costFunctionId, regimeId) {
    const regime = this.#regimes.get(regimeId);
    if (regime === undefined || regime.optimization !== true) fail("an explicit optimization regime is required");
    const result = this.#results.get(`${costFunctionId}\u0000${regimeId}`);
    if (result === undefined) fail("an explicit supported cost function is required");
    return result;
  }

  regime(id) {
    const regime = this.#regimes.get(id);
    if (regime === undefined) fail(`unknown regime ${id}`);
    return Object.freeze({
      ...regime,
      constraintRecords: Object.freeze(regime.constraints.map((constraintId) => {
        const constraint = this.#constraints.get(constraintId);
        if (constraint === undefined) fail(`regime ${id} refers to an unknown constraint`);
        return constraint;
      }))
    });
  }

  path(id) {
    const path = this.#paths.get(id);
    if (path === undefined) fail(`unknown path ${id}`);
    return path;
  }

  inspect(id) {
    if (this.#evidence.has(id)) {
      return Object.freeze({ kind: "evidence-edge", layer: this.#evidence.get(id).layer, record: this.#evidence.get(id) });
    }
    if (this.#events.has(id)) {
      const relatedEvidence = [...this.#evidence.values()].filter((record) => (
        record.subject === id || record.object === id
      ));
      return Object.freeze({ kind: "bootstrap-event", layer: "upstream-fact", record: this.#events.get(id), relatedEvidence });
    }
    if (this.#states.has(id)) {
      return Object.freeze({ kind: "bootstrap-state", layer: "derived-fact", record: this.#states.get(id) });
    }
    if (this.#nodes.has(id)) {
      return Object.freeze({ kind: "provenance-entity", layer: this.#nodes.get(id).layer, record: this.#nodes.get(id) });
    }
    const counterfactual = this.#data.constructionSpace.counterfactualEdges.find((edge) => edge.id === id);
    if (counterfactual) {
      return Object.freeze({ kind: "counterfactual-edge", layer: "onto2d-analysis", record: counterfactual });
    }
    if (this.#paths.has(id)) {
      return Object.freeze({ kind: "construction-path", layer: this.#paths.get(id).provenance.layer, record: this.#paths.get(id) });
    }
    fail(`unknown inspectable identifier ${id}`);
  }
}

export function createBootstrapProvenanceModel(input) {
  return new BootstrapProvenanceModel(input);
}
