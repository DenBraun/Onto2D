import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";

export const LIVE_BOOTSTRAP_MODEL_MAPPING_VERSION = "live-bootstrap-model-mapping-v2";
const RELEASE_DOMAIN = "onto2d:live-bootstrap-model-release:v2";
const AUDIT_DOMAIN = "onto2d:live-bootstrap-model-audit:v1";

function fail(message) {
  throw new TypeError(`live-bootstrap Model Pack compilation failed: ${message}`);
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueLocations(records) {
  const seen = new Set();
  const locations = [];
  for (const record of records) {
    if (record.source === null) continue;
    const key = `${record.source.path}:${record.source.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push(record.source);
  }
  return locations.sort((left, right) =>
    compareCodePoints(left.path, right.path) || left.line - right.line
  );
}

function entityKind(node) {
  if (node.kind === "event") return "bootstrap-event";
  if (node.kind === "state") return "bootstrap-state";
  if (node.id.startsWith("external-root:")) return "trust-root";
  if (node.id.startsWith("source:")) return "source-artifact";
  if (node.id.startsWith("artifact:")) return "produced-artifact-reference";
  if (node.id.startsWith("tool:") || node.id.startsWith("tool-set:")
      || node.id.startsWith("milestone:")) return "package-tool-milestone";
  if (node.id.startsWith("unknown:")) return "unresolved-entity";
  return "evidence-entity";
}

function nameForNode(node, event, state) {
  if (event !== undefined) {
    if (event.directive === "uninstall") return `uninstall ${event.targets.join(" ")}`;
    if (event.directive === "define") return `define ${event.definition.name}`;
    return `${event.directive} ${event.target}`;
  }
  if (state !== undefined) return state.afterEvent === null ? "Initial bootstrap state" : `State after ${state.afterEvent}`;
  return node.label;
}

function statusForLayer(layer) {
  if (layer === "upstream-fact") return "upstream-observed";
  if (layer === "derived-fact") return "deterministically-derived";
  return "onto2d-analysis";
}

export function compileLiveBootstrapModelPack(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("input must be an object");
  const { trace, stateHistory, evidence, graph } = input;
  if (trace?.format !== "onto2d-live-bootstrap-upstream-trace") fail("verified trace is required");
  if (stateHistory?.traceIdentity !== trace.traceIdentity) fail("state history is bound to another trace");
  if (evidence?.traceIdentity !== trace.traceIdentity) fail("evidence is bound to another trace");
  if (graph?.traceIdentity !== trace.traceIdentity
      || graph?.evidenceIdentity !== evidence.evidenceIdentity) {
    fail("graph is bound to different trace or evidence");
  }
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  if (graphNodeIds.size !== graph.nodes.length) fail("graph node IDs must be unique");
  if (graph.edges.some((edge) => !graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target))) {
    fail("every graph edge endpoint must resolve");
  }

  const eventsById = new Map(trace.events.map((event) => [event.eventId, event]));
  const statesById = new Map(stateHistory.states.map((state) => [state.stateId, state]));
  const evidenceByEntity = new Map();
  for (const record of evidence.records) {
    for (const id of [record.subject, record.object]) {
      if (!evidenceByEntity.has(id)) evidenceByEntity.set(id, []);
      evidenceByEntity.get(id).push(record);
    }
  }

  const nodes = graph.nodes.map((node) => {
    const event = eventsById.get(node.id);
    const state = statesById.get(node.id);
    const records = evidenceByEntity.get(node.id) ?? [];
    const kind = entityKind(node);
    const description = kind === "bootstrap-state"
      ? "Deterministic manifest-state projection; not a complete filesystem simulation."
      : kind === "bootstrap-event"
        ? "Pinned manifest directive occurrence; repeated package builds remain separate events."
        : "Entity referenced by bounded provenance evidence; existence here does not claim successful runtime production.";
    return {
      id: node.id,
      name: nameForNode(node, event, state),
      description,
      shortDescription: description,
      entityKind: kind,
      typeRole: kind,
      phase: event?.directive ?? (state === undefined ? "evidence" : "state-transition"),
      evidenceLayer: node.layer,
      scientificStatus: statusForLayer(node.layer),
      active: node.active,
      sourceLocations: uniqueLocations(records.length > 0 ? records : node.source === null ? [] : [{ source: node.source }]),
      provenance: event !== undefined
        ? {
            layer: "upstream-fact",
            source: event.source,
            profileStatus: event.profileStatus
          }
        : state !== undefined
          ? {
              layer: "derived-fact",
              derivedBy: state.provenance.method,
              afterEvent: state.afterEvent
            }
          : {
              layer: node.layer,
              evidenceRecords: records.map((record) => record.evidenceId).sort(compareCodePoints)
            }
    };
  });
  const recordsById = new Map(evidence.records.map((record) => [record.evidenceId, record]));
  const edges = graph.edges.map((edge) => {
    const record = recordsById.get(edge.id);
    if (record === undefined) fail(`graph edge ${edge.id} has no evidence record`);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      relationLayer: edge.layer,
      dependencyType: edge.relation,
      necessity: edge.evidenceClass,
      evidenceClass: edge.evidenceClass,
      evidenceStatus: edge.status,
      claim: record.claim,
      method: record.method,
      sourceLocation: record.source
    };
  });

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, {
    mappingVersion: LIVE_BOOTSTRAP_MODEL_MAPPING_VERSION,
    sourceIdentity: trace.source.sourceIdentity,
    traceIdentity: trace.traceIdentity,
    stateHistoryIdentity: stateHistory.stateHistoryIdentity,
    evidenceIdentity: evidence.evidenceIdentity,
    graphIdentity: graph.graphIdentity
  });
  const version = `v2-${releaseIdentity.slice("sha256:".length, "sha256:".length + 16)}`;
  const audit = {
    mappingVersion: LIVE_BOOTSTRAP_MODEL_MAPPING_VERSION,
    releaseIdentity,
    upstream: {
      repository: trace.source.repository,
      revision: trace.source.revision,
      sourceIdentity: trace.source.sourceIdentity
    },
    derivedArtifacts: {
      traceIdentity: trace.traceIdentity,
      stateHistoryIdentity: stateHistory.stateHistoryIdentity,
      evidenceIdentity: evidence.evidenceIdentity,
      graphIdentity: graph.graphIdentity
    },
    inventory: { nodeCount: nodes.length, edgeCount: edges.length },
    counterfactualRecords: 0
  };
  const sourceFiles = trace.source.files.map((file) => ({ path: file.path, hash: file.sha256 }));
  return buildModelPack({
    model: {
      id: "live-bootstrap-provenance",
      name: "Live Bootstrap Provenance",
      version,
      description: "Pinned live-bootstrap manifest events, states, and evidence-classified provenance relations.",
      status: "external-source-provenance-case"
    },
    source: {
      id: `live-bootstrap-${trace.source.sourceIdentity.slice("sha256:".length, "sha256:".length + 16)}`,
      files: sourceFiles,
      auditHash: hashCanonical(AUDIT_DOMAIN, audit)
    },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: {
        upstreamRepository: trace.source.repository,
        upstreamRevision: trace.source.revision,
        upstreamTree: trace.source.revisionTree,
        sourceIdentity: trace.source.sourceIdentity,
        traceIdentity: trace.traceIdentity,
        stateHistoryIdentity: stateHistory.stateHistoryIdentity,
        evidenceIdentity: evidence.evidenceIdentity,
        graphIdentity: graph.graphIdentity,
        evidenceProfileIdentity: evidence.evidenceProfile.profileIdentity,
        releaseIdentity,
        mappingVersion: LIVE_BOOTSTRAP_MODEL_MAPPING_VERSION,
        nonEndorsement: "live-bootstrap does not endorse Onto2D or any Onto2D analysis."
      },
      evidenceClasses: {
        "observed-order": "Immediate source order only; not a dependency claim.",
        "declared-input": "An input or tool assignment directly declared by selected source text.",
        "script-reference": "A tool or artifact directly referenced by selected source text.",
        "produced-artifact": "A source line declares an output or install action; runtime success is not asserted.",
        "derived-state": "A deterministic state projection from one manifest event.",
        "inferred-dependency": "Onto2D inference; absent from this upstream/derived Model Pack release.",
        "external-root": "A root explicitly outside the consumed ancestry boundary.",
        "unknown": "The bounded evidence does not resolve the relation."
      },
      presentation: {
        profile: "live-bootstrap-provenance-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "evidenceLayer",
        evidenceClassField: "evidenceClass",
        labels: {
          catalogTitle: "Bootstrap entities",
          searchPlaceholder: "Search bootstrap entities",
          typeFilter: "Entity",
          phaseFilter: "Manifest class",
          statusFilter: "Evidence layer",
          parents: "Incoming relations",
          children: "Outgoing relations"
        },
        coordinates: [
          { field: "typeRole", label: "Kind" },
          { field: "scientificStatus", label: "Evidence" }
        ],
        boundary: {
          title: "Provenance boundary",
          summary: "Pinned upstream observations and deterministic derived state are kept distinct; source order alone is not a dependency claim.",
          note: "Counterfactual paths and Historical Load are Onto2D analysis artifacts outside this Model Pack. live-bootstrap does not endorse Onto2D."
        }
      },
      trustBoundary: {
        submodules: trace.source.submodules,
        note: "Submodule content, hardware, firmware, microcode, host preparation, mirrors, and runtime effects are outside this Model Pack's verified source boundary."
      },
      audit
    })
  });
}
