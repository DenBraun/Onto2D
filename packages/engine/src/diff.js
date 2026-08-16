import { canonicalize, deepFreeze, hashCanonical } from "@onto2d/kernel";
import { engineFail } from "./errors.js";
import { dataEntries } from "./input.js";
import { verifyModelLineage } from "./lineage.js";

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function changedFields(left, right, ignored = new Set(["id"])) {
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((field) => {
      if (ignored.has(field)) return false;
      const leftHas = Object.prototype.hasOwnProperty.call(left, field);
      const rightHas = Object.prototype.hasOwnProperty.call(right, field);
      if (leftHas !== rightHas) return true;
      return canonicalize(left[field]) !== canonicalize(right[field]);
    })
    .sort(compareText);
}

function requireDiffOptions(options) {
  if (options === undefined) return {};
  const entries = dataEntries(options, {
    code: "ENGINE_DIFF_OPTIONS_INVALID",
    subject: "Model diff options",
    allowed: new Set(["lineage"])
  });
  return entries.has("lineage") ? { lineage: entries.get("lineage") } : {};
}

function requireReferences(event, leftIds, rightIds) {
  for (const identifier of event.from) {
    if (!leftIds.has(identifier)) {
      engineFail("ENGINE_LINEAGE_REFERENCE_MISSING", "A lineage source entity is absent from the left model.", {
        eventId: event.id,
        identifier
      });
    }
  }
  for (const identifier of event.to) {
    if (!rightIds.has(identifier)) {
      engineFail("ENGINE_LINEAGE_REFERENCE_MISSING", "A lineage target entity is absent from the right model.", {
        eventId: event.id,
        identifier
      });
    }
  }
}

function changedRecord(diff, identifier) {
  return diff.changed.find((entry) => entry.id === identifier);
}

function requireDeclaredFields(event, actualFields) {
  for (const field of event.fields ?? []) {
    if (!actualFields.includes(field)) {
      engineFail("ENGINE_LINEAGE_CHANGE_UNSUPPORTED", "A declared lineage field did not change structurally.", {
        eventId: event.id,
        field
      });
    }
  }
}

function validateLineageEvents(lineage, left, right, modelDiff, nodeDiff, edgeDiff) {
  const leftNodes = new Set(left.nodes().map((node) => node.id));
  const rightNodes = new Set(right.nodes().map((node) => node.id));
  const leftEdges = new Set(left.edges().map((edge) => edge.id));
  const rightEdges = new Set(right.edges().map((edge) => edge.id));
  const removedNodes = new Set(nodeDiff.removed);
  const addedNodes = new Set(nodeDiff.added);
  const removedEdges = new Set(edgeDiff.removed);
  const addedEdges = new Set(edgeDiff.added);

  for (const event of lineage.events) {
    if (event.entity === "node") requireReferences(event, leftNodes, rightNodes);
    if (event.entity === "edge") requireReferences(event, leftEdges, rightEdges);

    if (["rename", "split", "merge", "replace"].includes(event.kind)) {
      const removed = event.entity === "node" ? removedNodes : removedEdges;
      const added = event.entity === "node" ? addedNodes : addedEdges;
      if (event.from.some((id) => !removed.has(id)) || event.to.some((id) => !added.has(id))) {
        engineFail("ENGINE_LINEAGE_CHANGE_UNSUPPORTED", "A lineage identity change must match added and removed entities.", {
          eventId: event.id
        });
      }
    } else if (event.kind === "deprecate") {
      const removed = event.entity === "node" ? removedNodes : removedEdges;
      if (event.from.some((id) => !removed.has(id))) {
        engineFail("ENGINE_LINEAGE_CHANGE_UNSUPPORTED", "A deprecation must reference removed entities.", {
          eventId: event.id
        });
      }
    } else if (["move", "classification-change"].includes(event.kind)) {
      const change = changedRecord(nodeDiff, event.from[0]);
      if (!change) {
        engineFail("ENGINE_LINEAGE_CHANGE_UNSUPPORTED", "The declared node did not change structurally.", {
          eventId: event.id
        });
      }
      requireDeclaredFields(event, change.fields);
    } else if (event.kind === "relation-change") {
      if (event.from[0] === event.to[0]) {
        const change = changedRecord(edgeDiff, event.from[0]);
        if (!change || (event.fields ?? []).length === 0) {
          engineFail("ENGINE_LINEAGE_CHANGE_UNSUPPORTED", "An in-place relation change requires changed fields.", {
            eventId: event.id
          });
        }
        requireDeclaredFields(event, change.fields);
      } else if (!removedEdges.has(event.from[0]) || !addedEdges.has(event.to[0])) {
        engineFail("ENGINE_LINEAGE_CHANGE_UNSUPPORTED", "A reidentified relation must match removed and added edges.", {
          eventId: event.id
        });
      }
    } else if (event.kind === "metadata-only-change") {
      requireDeclaredFields(event, modelDiff.changedFields);
    }
  }
}

function lineageProjection(lineage) {
  if (!lineage) {
    return {
      status: "not-declared",
      events: [],
      renamed: [],
      splits: [],
      merges: []
    };
  }
  const project = (kind) => lineage.events
    .filter((event) => event.kind === kind)
    .map((event) => ({ eventId: event.id, from: event.from, to: event.to }));
  return {
    status: "declared",
    lineageHash: lineage.lineageHash,
    events: lineage.events,
    renamed: project("rename"),
    splits: project("split"),
    merges: project("merge")
  };
}

function compareRecords(leftRecords, rightRecords) {
  const left = new Map(leftRecords.map((record) => [record.id, record]));
  const right = new Map(rightRecords.map((record) => [record.id, record]));
  const added = [...right.keys()].filter((id) => !left.has(id)).sort(compareText);
  const removed = [...left.keys()].filter((id) => !right.has(id)).sort(compareText);
  const changed = [...left.keys()].filter((id) => right.has(id))
    .map((id) => ({ id, fields: changedFields(left.get(id), right.get(id)) }))
    .filter((entry) => entry.fields.length > 0)
    .sort((a, b) => compareText(a.id, b.id));
  return { added, removed, changed };
}

export function diffModels(left, right, options = {}) {
  if (!left?.manifest || !right?.manifest || typeof left.nodes !== "function" || typeof right.nodes !== "function") {
    engineFail("ENGINE_DIFF_MODEL_INVALID", "diffModels requires two verified engine models.");
  }
  const normalizedOptions = requireDiffOptions(options);
  const nodeDiff = compareRecords(
    left.nodes().map((node) => node.data),
    right.nodes().map((node) => node.data)
  );
  const edgeDiff = compareRecords(left.edges(), right.edges());
  const modelDiff = {
    changedFields: changedFields(
      left.manifest.model,
      right.manifest.model,
      new Set(["id", "version"])
    )
  };
  const lineage = normalizedOptions.lineage === undefined
    ? undefined
    : verifyModelLineage(normalizedOptions.lineage, { from: left, to: right });
  if (lineage) validateLineageEvents(lineage, left, right, modelDiff, nodeDiff, edgeDiff);
  const body = {
    schemaVersion: "1",
    builder: "onto2d-structural-model-diff-v2",
    left: {
      modelId: left.id,
      modelVersion: left.version,
      modelRootHash: left.rootHash
    },
    right: {
      modelId: right.id,
      modelVersion: right.version,
      modelRootHash: right.rootHash
    },
    lineage: lineageProjection(lineage),
    model: modelDiff,
    nodes: nodeDiff,
    edges: edgeDiff,
    statistics: {
      addedNodeCount: nodeDiff.added.length,
      removedNodeCount: nodeDiff.removed.length,
      changedNodeCount: nodeDiff.changed.length,
      addedEdgeCount: edgeDiff.added.length,
      removedEdgeCount: edgeDiff.removed.length,
      changedEdgeCount: edgeDiff.changed.length,
      changedModelFieldCount: modelDiff.changedFields.length,
      lineageEventCount: lineage?.events.length ?? 0
    }
  };
  return deepFreeze({
    ...body,
    diffHash: hashCanonical("onto2d:structural-model-diff:v2", body)
  });
}
