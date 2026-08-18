import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyGettyArtworkProvenanceCaseIdentity } from "../../cases/getty-artwork-provenance/extract.mjs";

export const ARTWORK_PROVENANCE_MAPPING_VERSION = "artwork-provenance-mapping-v1";
const RELEASE_DOMAIN = "onto2d:artwork-provenance-model-release:v1";
const AUDIT_DOMAIN = "onto2d:artwork-provenance-model-audit:v1";
const EDGE_DOMAIN = "onto2d:artwork-provenance-model-edge:v1";

function fail(message) { throw new TypeError(`artwork-provenance Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }
function artworkNode(id) { return `artwork:${id.split("/").at(-1)}`; }
function entityNode(kind, id) { return `${kind}:${id.split("/").at(-1)}`; }

export function compileArtworkProvenanceModelPack(input) {
  let artifact;
  try { artifact = verifyGettyArtworkProvenanceCaseIdentity(input); } catch (error) { fail(error.message); }

  const objectNodes = artifact.cohort.objects.map((object) => ({
    id: artworkNode(object.id), name: `${object.stockNumber} / ${object.label}`,
    description: "An exact Getty HumanMadeObject record. Equal labels do not merge record identity, and this node is not an Onto2D authenticity or legal-title finding.",
    shortDescription: `${object.nativeType}; ${object.identifiers.length} native identifier(s).`, entityKind: "artwork-record", typeRole: object.id === artifact.flagship.objectId ? "flagship-artwork" : "cohort-artwork", phase: "direct-record", evidenceStatus: object.evidenceState,
    gettyId: object.id, stockNumber: object.stockNumber, artworkRecordIdentity: object.artworkRecordIdentity
  }));
  const actorNodes = artifact.actors.map((actor) => ({ id: entityNode("actor", actor.id), name: actor.label, description: "Actor named by the bounded Getty records; its graph role reflects only the exact source relation.", shortDescription: actor.nativeType, entityKind: "actor-record", typeRole: "actor", phase: "direct-record", evidenceStatus: actor.evidenceState, gettyId: actor.id }));
  const placeNodes = artifact.places.map((place) => ({ id: entityNode("place", place.id), name: place.label, description: "Place named by the exact Getty current_location relation.", shortDescription: place.nativeType, entityKind: "place-record", typeRole: "place", phase: "direct-record", evidenceStatus: place.evidenceState, gettyId: place.id }));
  const recordNodes = artifact.sourceRecords.map((record) => ({ id: entityNode("source-record", record.id), name: record.label, description: "Exact Getty LinguisticObject metadata. Its retained transcription is represented by hash and byte count and creates no ownership inference.", shortDescription: `${record.transcription.bytes} transcription bytes; ownership inference: none.`, entityKind: "source-record", typeRole: "stock-book-record", phase: "direct-record", evidenceStatus: record.evidenceState, gettyId: record.id, transcription: record.transcription, ownershipInference: null }));
  const eventNodes = artifact.events.map((event) => ({ id: entityNode("activity", event.id), name: event.label, description: "Getty Activity with native Acquisition parts. transferred_title_of is preserved as source data and is not a legal-title determination by Onto2D.", shortDescription: `${event.time.label}; ${event.transfers.length} transfer relation(s); ${event.time.precision}.`, entityKind: "provenance-activity", typeRole: event.kind, phase: "direct-record", evidenceStatus: event.evidenceState, gettyId: event.id, time: event.time }));
  const contextNode = { id: "context:current-owner", name: "Current Getty context", description: "The current_owner and current_location relations observed in the frozen A1983 object response. Relation start and legal title are not established.", shortDescription: "Observed relation; start unknown; no legal-title finding.", entityKind: "current-context", typeRole: "current-context", phase: "direct-record", evidenceStatus: artifact.flagship.currentContext.evidenceState, observedAt: artifact.flagship.currentContext.observedAt, relationStart: null, legalTitleDetermination: false };
  const gapNode = { id: `gap:${artifact.flagship.gap.id}`, name: artifact.flagship.gap.label, description: artifact.flagship.gap.interpretation, shortDescription: "Known missingness; contents unknown; no asserted transfer.", entityKind: "evidence-gap", typeRole: "unknown-interval", phase: "reconstructed", evidenceStatus: "unknown", contents: null, assertedTransfer: false, legalTitleDetermination: false };
  const historyNodes = artifact.historyEquivalence.histories.map((history) => ({ id: `history:${history.id}`, name: history.label, description: history.includesUnknownInterval ? "A reconstruction that makes the known missing interval visible without inventing its contents." : "A projection containing only directly encoded activities and current context.", shortDescription: `${history.segments.length} segment(s); complete: no.`, entityKind: "history-view", typeRole: history.id, phase: history.evidenceState, evidenceStatus: history.evidenceState, historyIdentity: history.historyIdentity, complete: false }));
  const resultNodes = artifact.historyEquivalence.comparison.results.map((result) => ({ id: `comparison-result:${result.regimeId}`, name: `${result.label}: ${result.verdict}`, description: result.question, shortDescription: `${result.verdict}; ${result.normalization}.`, entityKind: "equivalence-result", typeRole: result.regimeId, phase: "derived", evidenceStatus: result.verdict, result }));
  const boundaryNode = { id: "analysis:historical-load-boundary", name: "Historical Load is undefined", description: artifact.historicalLoad.reason, shortDescription: "Not evaluated; null is not zero.", entityKind: "analysis-boundary", typeRole: "historical-load", phase: "derived", evidenceStatus: artifact.historicalLoad.status, value: null };
  const nodes = [...objectNodes, ...actorNodes, ...placeNodes, ...recordNodes, ...eventNodes, contextNode, gapNode, ...historyNodes, ...resultNodes, boundaryNode];
  const edges = [];
  for (const event of artifact.events) for (const transfer of event.transfers) {
    const activity = entityNode("activity", event.id);
    const object = artworkNode(transfer.objectId);
    edges.push({ id: edgeId("transferred-title-of", activity, object, transfer.sourceOrdinal), source: activity, target: object, relation: "transferred-title-of", relationLayer: "native", evidenceClass: "getty-acquisition-part", evidenceStatus: "captured", legalTitleDetermination: false });
    for (const id of transfer.fromActorIds) edges.push({ id: edgeId("transferred-title-from", entityNode("actor", id), activity, object), source: entityNode("actor", id), target: activity, relation: "transferred-title-from", relationLayer: "native", evidenceClass: "getty-acquisition-part", evidenceStatus: "captured", legalTitleDetermination: false });
    for (const id of transfer.toActorIds) edges.push({ id: edgeId("transferred-title-to", activity, entityNode("actor", id), object), source: activity, target: entityNode("actor", id), relation: "transferred-title-to", relationLayer: "native", evidenceClass: "getty-acquisition-part", evidenceStatus: "captured", legalTitleDetermination: false });
  }
  const flagship = artworkNode(artifact.flagship.objectId);
  for (const record of artifact.sourceRecords) edges.push({ id: edgeId("documented-by", flagship, entityNode("source-record", record.id)), source: flagship, target: entityNode("source-record", record.id), relation: "documented-by", relationLayer: "native", evidenceClass: "getty-referred-to-by", evidenceStatus: "captured", ownershipInference: null });
  for (const order of artifact.eventOrder) edges.push({ id: edgeId("before", entityNode("activity", order.earlierEventId), entityNode("activity", order.laterEventId)), source: entityNode("activity", order.earlierEventId), target: entityNode("activity", order.laterEventId), relation: "before", relationLayer: "native", evidenceClass: "getty-before-after", evidenceStatus: "captured" });
  edges.push({ id: edgeId("has-current-context", flagship, contextNode.id), source: flagship, target: contextNode.id, relation: "has-current-context", relationLayer: "native", evidenceClass: "getty-current-relation", evidenceStatus: "captured", legalTitleDetermination: false });
  for (const id of artifact.flagship.currentContext.ownerIds) edges.push({ id: edgeId("current-owner-relation", contextNode.id, entityNode("actor", id)), source: contextNode.id, target: entityNode("actor", id), relation: "current-owner-relation", relationLayer: "native", evidenceClass: "getty-current-owner", evidenceStatus: "captured", legalTitleDetermination: false });
  edges.push({ id: edgeId("current-location-relation", contextNode.id, entityNode("place", artifact.flagship.currentContext.locationId)), source: contextNode.id, target: entityNode("place", artifact.flagship.currentContext.locationId), relation: "current-location-relation", relationLayer: "native", evidenceClass: "getty-current-location", evidenceStatus: "captured" });
  const sale = entityNode("activity", artifact.events[1].id);
  edges.push({ id: edgeId("bounded-after", sale, gapNode.id), source: sale, target: gapNode.id, relation: "bounded-after", relationLayer: "reconstructed", evidenceClass: "declared-missingness", evidenceStatus: "unknown", assertedTransfer: false });
  edges.push({ id: edgeId("bounded-before", gapNode.id, contextNode.id), source: gapNode.id, target: contextNode.id, relation: "bounded-before", relationLayer: "reconstructed", evidenceClass: "declared-missingness", evidenceStatus: "unknown", assertedTransfer: false });
  for (const history of artifact.historyEquivalence.histories) {
    const historyId = `history:${history.id}`;
    edges.push({ id: edgeId("projects-object", historyId, flagship), source: historyId, target: flagship, relation: "projects-object", relationLayer: "derived", evidenceClass: "declared-history-view", evidenceStatus: history.evidenceState });
    for (const eventId of history.directEventIds) edges.push({ id: edgeId("includes-activity", historyId, entityNode("activity", eventId)), source: historyId, target: entityNode("activity", eventId), relation: "includes-activity", relationLayer: "derived", evidenceClass: "declared-history-view", evidenceStatus: history.evidenceState });
    edges.push({ id: edgeId("includes-context", historyId, contextNode.id), source: historyId, target: contextNode.id, relation: "includes-context", relationLayer: "derived", evidenceClass: "declared-history-view", evidenceStatus: history.evidenceState });
    if (history.includesUnknownInterval) edges.push({ id: edgeId("includes-gap", historyId, gapNode.id), source: historyId, target: gapNode.id, relation: "includes-gap", relationLayer: "reconstructed", evidenceClass: "declared-missingness", evidenceStatus: "unknown" });
  }
  for (const result of artifact.historyEquivalence.comparison.results) for (const history of artifact.historyEquivalence.histories) edges.push({ id: edgeId("compares-view", `comparison-result:${result.regimeId}`, `history:${history.id}`), source: `comparison-result:${result.regimeId}`, target: `history:${history.id}`, relation: "compares-view", relationLayer: "derived", evidenceClass: "regime-projection", evidenceStatus: result.verdict, regimeId: result.regimeId });

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);
  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: ARTWORK_PROVENANCE_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = { mappingVersion: ARTWORK_PROVENANCE_MAPPING_VERSION, releaseIdentity, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, sourceInventory: { artworks: objectNodes.length, activities: eventNodes.length, sourceRecords: recordNodes.length, actors: actorNodes.length, places: placeNodes.length }, analysisInventory: { historyViews: historyNodes.length, equivalenceResults: resultNodes.length, gaps: 1 }, legalTitleDeterminations: 0, historicalLoad: { status: artifact.historicalLoad.status, value: null } };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.externalFiles, ...artifact.source.queryFiles].map((file) => ({ path: `cases/getty-artwork-provenance/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "artwork-provenance", name: "Artwork Provenance", version, description: "Source-locked Getty artwork, activity, stock-book, current-context, explicit-gap, and regime-relative history-equivalence records.", status: "external-source-locked-cultural-heritage-case" },
    source: { id: `getty-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes, edges,
    dictionaries: canonicalClone({
      provenance: { publisher: artifact.getty.publisher, dataModel: artifact.getty.dataModel, documentation: artifact.getty.documentation, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: ARTWORK_PROVENANCE_MAPPING_VERSION, license: artifact.getty.license, attribution: artifact.evidenceBoundary.attribution },
      evidenceClasses: { "getty-acquisition-part": "Native transferred_title_of/from/to relations in a Getty Activity Acquisition part; not an Onto2D legal-title finding.", "getty-before-after": "Native bidirectional Getty Activity ordering relation.", "getty-referred-to-by": "Native object-to-LinguisticObject source reference; no ownership inference.", "getty-current-relation": "Current context retained from the frozen HumanMadeObject response.", "getty-current-owner": "Native current_owner relation; relation start and legal title remain unknown.", "getty-current-location": "Native current_location relation, kept separate from owner.", "declared-history-view": "Onto2D projection over direct records.", "declared-missingness": "Explicit unknown interval with null contents and no asserted transfer.", "regime-projection": "Deterministic comparison under one named equivalence regime." },
      identityRegimes: Object.fromEntries(artifact.historyEquivalence.regimes.map((regime) => [regime.id, regime.question])),
      presentation: { profile: "artwork-provenance-presentation-v1", nodeKindField: "entityKind", relationField: "relation", layerField: "evidenceStatus", evidenceClassField: "evidenceClass", labels: { catalogTitle: "Artwork provenance evidence", searchPlaceholder: "Search artworks, activities, actors, records, and gaps", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming provenance relations", children: "Outgoing provenance relations" }, coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }], boundary: { title: "Artwork evidence boundary", summary: "Getty records, derived history projections, and explicit missingness remain visibly separate.", note: "Native source relations are not legal-title, authenticity, restitution, or complete-chain determinations. Historical Load is undefined, not zero." } }, audit
    })
  });
}
