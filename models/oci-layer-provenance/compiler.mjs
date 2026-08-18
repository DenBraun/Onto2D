import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import {
  verifyOciLayerHistoryCaseIdentity
} from "../../cases/oci-layer-history/extract.mjs";
import {
  replayLayers,
  rootfsIdentity
} from "../../cases/oci-layer-history/src/oci-layout.mjs";

export const OCI_LAYER_MAPPING_VERSION = "oci-layer-provenance-mapping-v1";
const RELEASE_DOMAIN = "onto2d:oci-layer-model-release:v1";
const AUDIT_DOMAIN = "onto2d:oci-layer-model-audit:v1";
const EDGE_DOMAIN = "onto2d:oci-layer-model-edge:v1";

function fail(message) {
  throw new TypeError(`oci-layer-provenance Model Pack compilation failed: ${message}`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function edgeId(relation, source, target, key = "") {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice("sha256:".length, "sha256:".length + 20)}`;
}

function stateNodeId(historyId, ordinal, identity) {
  return `state:${historyId}:${ordinal}:${identity.slice("sha256:".length, "sha256:".length + 16)}`;
}

function nativeEntries(layer) {
  return layer.entries.map((entry) => ({
    ...entry,
    bytes: Buffer.from(entry.contentUtf8, "utf8")
  }));
}

function verifyDerivedHistory(history) {
  const replay = replayLayers(history.layers.map((layer) => ({ id: layer.id, entries: nativeEntries(layer) })));
  for (const [index, state] of replay.states.entries()) {
    if (!same(state.operations, history.layers[index].operations)) fail(`${history.id}/${history.layers[index].id} operation projection is substituted`);
    if (!same({ identity: state.identity, files: state.files }, history.layers[index].stateAfter)) fail(`${history.id}/${history.layers[index].id} state projection is substituted`);
  }
  if (!same({ identity: replay.final.identity, files: replay.final.files }, history.finalRootfs)) fail(`${history.id} final rootfs is substituted`);
  return replay;
}

export function compileOciLayerProvenanceModelPack(input) {
  let artifact;
  try {
    artifact = verifyOciLayerHistoryCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }
  if (artifact.format !== "onto2d-oci-layer-history-case" || artifact.specification.version !== "1.1.1") fail("verified OCI v1.1.1 case artifact is required");
  const replays = new Map(artifact.histories.map((history) => [history.id, verifyDerivedHistory(history)]));

  const historyNodes = artifact.histories.map((history) => ({
    id: `history:${history.id}`,
    name: history.label,
    description: `Native OCI image history ${history.id}; its manifest and ordered layer descriptors are content-addressed source records.`,
    shortDescription: `${history.layers.length} layer(s); final rootfs ${history.finalRootfs.identity.slice(0, 23)}.`,
    entityKind: "oci-history-record",
    typeRole: "history",
    phase: "native-layout",
    scientificStatus: "cryptographically-verified",
    historyId: history.id,
    manifestIdentity: history.manifest.digest,
    layerSequenceIdentity: history.layerSequenceIdentity,
    finalRootfsIdentity: history.finalRootfs.identity
  }));
  const manifestNodes = artifact.histories.map((history) => ({
    id: history.manifest.digest,
    name: `${history.id} manifest`,
    description: "Native OCI image manifest verified against its SHA-256 descriptor and exact blob size.",
    shortDescription: `${history.layers.length} ordered layer descriptor(s).`,
    entityKind: "oci-image-manifest",
    typeRole: "manifest",
    phase: "native-layout",
    scientificStatus: "cryptographically-verified",
    nativeIdentity: history.manifest.digest,
    mediaType: history.manifest.mediaType,
    size: history.manifest.size
  }));
  const configNodes = artifact.histories.map((history) => ({
    id: history.config.digest,
    name: `${history.id} config`,
    description: "Native OCI image configuration binding ordered uncompressed DiffIDs and history records.",
    shortDescription: `${history.layers.length} DiffID(s); linux/amd64 fixture.`,
    entityKind: "oci-image-config",
    typeRole: "config",
    phase: "native-layout",
    scientificStatus: "cryptographically-verified",
    nativeIdentity: history.config.digest,
    mediaType: history.config.mediaType,
    size: history.config.size
  }));
  const layerByDigest = new Map();
  for (const history of artifact.histories) {
    for (const layer of history.layers) {
      if (!layerByDigest.has(layer.descriptor.digest)) layerByDigest.set(layer.descriptor.digest, layer);
    }
  }
  const layerNodes = [...layerByDigest.values()].map((layer) => ({
    id: layer.descriptor.digest,
    name: layer.label,
    description: "Native uncompressed OCI tar layer verified against its descriptor; whiteout markers remain distinct from derived deletions.",
    shortDescription: `${layer.entries.length} tar entry or entries; ${layer.descriptor.size} bytes.`,
    entityKind: "oci-layer",
    typeRole: "layer",
    phase: "native-layout",
    scientificStatus: "cryptographically-verified",
    nativeIdentity: layer.descriptor.digest,
    mediaType: layer.descriptor.mediaType,
    size: layer.descriptor.size,
    entries: layer.entries
  }));
  const emptyFiles = [];
  const emptyIdentity = rootfsIdentity(emptyFiles);
  const stateNodes = [{
    id: stateNodeId("empty", 0, emptyIdentity),
    name: "Empty rootfs",
    description: "Declared empty starting filesystem for every bounded history replay.",
    shortDescription: "0 files; shared replay origin.",
    entityKind: "oci-filesystem-state",
    typeRole: "state",
    phase: "derived-replay",
    scientificStatus: "declared-origin",
    rootfsIdentity: emptyIdentity,
    files: emptyFiles
  }];
  for (const history of artifact.histories) {
    for (const layer of history.layers) {
      stateNodes.push({
        id: stateNodeId(history.id, layer.ordinal + 1, layer.stateAfter.identity),
        name: `${history.id} after layer ${layer.ordinal + 1}`,
        description: "Deterministic normalized filesystem state after applying the verified layer with OCI whiteout semantics.",
        shortDescription: `${layer.stateAfter.files.length} file(s); ${layer.stateAfter.identity.slice(0, 23)}.`,
        entityKind: "oci-filesystem-state",
        typeRole: "state",
        phase: "derived-replay",
        scientificStatus: "deterministically-derived",
        historyId: history.id,
        ordinal: layer.ordinal + 1,
        rootfsIdentity: layer.stateAfter.identity,
        files: layer.stateAfter.files
      });
    }
  }
  const fileByIdentity = new Map();
  for (const history of artifact.histories) {
    for (const layer of history.layers) {
      for (const entry of layer.entries) {
        if (!entry.path.split("/").at(-1).startsWith(".wh.")) fileByIdentity.set(entry.contentIdentity, entry);
      }
    }
  }
  const fileNodes = [...fileByIdentity.values()].map((file) => ({
    id: `file:${file.contentIdentity}`,
    name: file.path,
    description: "Content-addressed regular-file payload observed in a verified native OCI tar layer.",
    shortDescription: `${file.size} bytes; ${file.contentIdentity.slice(0, 23)}.`,
    entityKind: "oci-file-object",
    typeRole: "file",
    phase: "native-layout",
    scientificStatus: "cryptographically-verified",
    contentIdentity: file.contentIdentity,
    size: file.size,
    contentUtf8: file.contentUtf8
  }));
  const operationNodes = [];
  for (const history of artifact.histories) {
    for (const layer of history.layers) {
      for (const [operationIndex, operation] of layer.operations.entries()) {
        operationNodes.push({
          id: `operation:${history.id}:${layer.ordinal}:${operationIndex}`,
          name: `${operation.kind} /${operation.target}`,
          description: "Context-sensitive layer application action derived from a native tar entry and its preceding verified filesystem state.",
          shortDescription: `${operation.changedBytes} changed byte(s).`,
          entityKind: "oci-layer-operation",
          typeRole: "operation",
          phase: "derived-replay",
          scientificStatus: "deterministically-derived",
          historyId: history.id,
          layerOrdinal: layer.ordinal,
          operation
        });
      }
    }
  }
  const nodes = [...historyNodes, ...manifestNodes, ...configNodes, ...layerNodes, ...stateNodes, ...fileNodes, ...operationNodes];

  const edges = [];
  for (const history of artifact.histories) {
    const historyId = `history:${history.id}`;
    edges.push({ id: edgeId("records-manifest", historyId, history.manifest.digest), source: historyId, target: history.manifest.digest, relation: "records-manifest", relationLayer: "native", evidenceClass: "native-oci-index", evidenceStatus: "captured" });
    edges.push({ id: edgeId("references-config", history.manifest.digest, history.config.digest), source: history.manifest.digest, target: history.config.digest, relation: "references-config", relationLayer: "native", evidenceClass: "native-oci-manifest", evidenceStatus: "captured" });
    let priorState = stateNodeId("empty", 0, emptyIdentity);
    for (const layer of history.layers) {
      const stateId = stateNodeId(history.id, layer.ordinal + 1, layer.stateAfter.identity);
      edges.push({ id: edgeId("references-layer", history.manifest.digest, layer.descriptor.digest, `${history.id}:${layer.ordinal}`), source: history.manifest.digest, target: layer.descriptor.digest, relation: "references-layer", relationLayer: "native", evidenceClass: "native-oci-manifest", evidenceStatus: "captured", ordinal: layer.ordinal });
      edges.push({ id: edgeId("next-state", priorState, stateId, `${history.id}:${layer.ordinal}`), source: priorState, target: stateId, relation: "next-state", relationLayer: "derived", evidenceClass: "deterministic-layer-replay", evidenceStatus: "derived", layerDigest: layer.descriptor.digest });
      for (const [operationIndex, operation] of layer.operations.entries()) {
        const operationId = `operation:${history.id}:${layer.ordinal}:${operationIndex}`;
        edges.push({ id: edgeId("applied-as", layer.descriptor.digest, operationId, `${history.id}:${layer.ordinal}:${operationIndex}`), source: layer.descriptor.digest, target: operationId, relation: "applied-as", relationLayer: "derived", evidenceClass: "deterministic-layer-replay", evidenceStatus: "derived" });
        if (operation.contentIdentity) {
          edges.push({ id: edgeId("writes-content", operationId, `file:${operation.contentIdentity}`), source: operationId, target: `file:${operation.contentIdentity}`, relation: "writes-content", relationLayer: "derived", evidenceClass: "verified-tar-entry", evidenceStatus: "derived", path: operation.target });
        }
      }
      for (const file of layer.stateAfter.files) {
        edges.push({ id: edgeId("contains-file", stateId, `file:${file.contentIdentity}`, file.path), source: stateId, target: `file:${file.contentIdentity}`, relation: "contains-file", relationLayer: "derived", evidenceClass: "deterministic-layer-replay", evidenceStatus: "derived", path: file.path });
      }
      priorState = stateId;
    }
    edges.push({ id: edgeId("flattens-to", historyId, priorState), source: historyId, target: priorState, relation: "flattens-to", relationLayer: "derived", evidenceClass: "deterministic-layer-replay", evidenceStatus: "derived" });
  }

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, {
    mappingVersion: OCI_LAYER_MAPPING_VERSION,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity
  });
  const version = `v1-${releaseIdentity.slice("sha256:".length, "sha256:".length + 16)}`;
  const audit = {
    mappingVersion: OCI_LAYER_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    nativeInventory: { histories: historyNodes.length, manifests: manifestNodes.length, configs: configNodes.length, uniqueLayers: layerNodes.length },
    derivedInventory: { states: stateNodes.length, operations: operationNodes.length, rootfsIdentity: artifact.histories[0].finalRootfs.identity },
    historicalLoad: artifact.historicalLoad.results.map((result) => ({ costFunction: result.costFunction, value: result.historicalLoad, unit: result.unit }))
  };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.layoutFiles].map((file) => ({
    path: `cases/oci-layer-history/${file.path}`,
    hash: file.identity
  }));
  return buildModelPack({
    model: {
      id: "oci-layer-provenance",
      name: "OCI Layer History",
      version,
      description: "Verified OCI manifests, configs, ordered layers, deterministic filesystem states, hidden operations, and bounded Historical Load results.",
      status: "external-deterministic-fixture-case"
    },
    source: {
      id: `oci-${artifact.source.identity.slice("sha256:".length, "sha256:".length + 16)}`,
      files: sourceFiles,
      auditHash: hashCanonical(AUDIT_DOMAIN, audit)
    },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: {
        ociImageSpecVersion: artifact.specification.version,
        sourceIdentity: artifact.source.identity,
        caseIdentity: artifact.caseIdentity,
        releaseIdentity,
        mappingVersion: OCI_LAYER_MAPPING_VERSION,
        layerProfile: "bounded-uncompressed-regular-files-and-whiteouts-v1",
        nonEndorsement: "The Open Container Initiative does not endorse Onto2D or this interpretation."
      },
      evidenceClasses: {
        "native-oci-index": "Reference recorded directly in the verified OCI image index.",
        "native-oci-manifest": "Descriptor and order recorded directly in a verified OCI image manifest.",
        "verified-tar-entry": "File bytes or whiteout marker parsed from a digest-verified native layer blob.",
        "deterministic-layer-replay": "State or operation derived by the bounded evaluator from verified layer bytes."
      },
      identityRegimes: Object.fromEntries(artifact.identityRegimes.map((regime) => [regime.id, regime.question])),
      presentation: {
        profile: "oci-layer-provenance-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "scientificStatus",
        evidenceClassField: "evidenceClass",
        labels: {
          catalogTitle: "OCI history records",
          searchPlaceholder: "Search manifests, layers, states, and files",
          typeFilter: "Record kind",
          phaseFilter: "Evidence phase",
          statusFilter: "Evidence status",
          parents: "Incoming native or derived relations",
          children: "Outgoing native or derived relations"
        },
        coordinates: [
          { field: "typeRole", label: "Kind" },
          { field: "scientificStatus", label: "Evidence" }
        ],
        boundary: {
          title: "OCI fixture boundary",
          summary: "Native descriptors and tar entries remain separate from derived filesystem states, equivalence classes, and cost-relative Historical Load.",
          note: "This bounded evaluator is not a general container runtime; the four Historical Load values apply only to the declared finite fixture space."
        }
      },
      audit
    })
  });
}
