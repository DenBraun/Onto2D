import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyChemicalSynthesisHistoryCaseIdentity } from "../../cases/chemical-synthesis-history/extract.mjs";

export const CHEMICAL_REACTION_MAPPING_VERSION = "chemical-reaction-provenance-mapping-v1";
const RELEASE_DOMAIN = "onto2d:chemical-reaction-model-release:v1";
const AUDIT_DOMAIN = "onto2d:chemical-reaction-model-audit:v1";
const EDGE_DOMAIN = "onto2d:chemical-reaction-model-edge:v1";
const COMPOUND_DOMAIN = "onto2d:chemical-identifier-node:v1";

function fail(message) {
  throw new TypeError(`chemical-reaction-provenance Model Pack compilation failed: ${message}`);
}

function edgeId(relation, source, target, key = "") {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`;
}

function compoundId(identifierType, value) {
  return `compound:${hashCanonical(COMPOUND_DOMAIN, { identifierType, value }).slice(7, 27)}`;
}

function short(value, length = 30) {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

export function compileChemicalReactionProvenanceModelPack(input) {
  let artifact;
  try {
    artifact = verifyChemicalSynthesisHistoryCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }

  const [sweepDataset, cascadeDataset] = artifact.ord.datasets;
  const datasetNodes = artifact.ord.datasets.map((dataset) => ({
    id: `dataset:${dataset.datasetId}`,
    name: dataset.name,
    description: `Pinned ORD ${artifact.ord.release} dataset with ${dataset.reactionCount} reaction record(s); exact Git LFS bytes are bound by SHA-256.`,
    shortDescription: `${dataset.reactionCount} records; ${dataset.doi}.`,
    entityKind: "ord-dataset",
    typeRole: "dataset",
    phase: "native-record",
    scientificStatus: "source-locked",
    nativeDatasetId: dataset.datasetId,
    sourceSha256: dataset.sha256,
    doi: dataset.doi
  }));

  const compoundRecords = new Map();
  const rememberCompound = (type, value, { name = null, role = "identifier", source = "direct-record" } = {}) => {
    if (!value) return null;
    const id = compoundId(type, value);
    if (!compoundRecords.has(id)) compoundRecords.set(id, { id, type, value, name, roles: new Set([role]), source });
    else compoundRecords.get(id).roles.add(role);
    return id;
  };

  for (const target of artifact.cohorts.conditionSweep.targets) {
    rememberCompound("SMILES", target.productIdentifier.value, { name: target.label, role: "target", source: "direct-record-with-derived-label" });
    for (const route of target.routes) {
      for (const [role, compound] of Object.entries(route.inputs)) rememberCompound("SMILES", compound.smiles, { name: compound.name, role, source: "direct-record" });
    }
  }
  for (const record of artifact.cohorts.linkedCascade.records) {
    rememberCompound("SMILES", record.primaryInput.smiles, { name: record.primaryInput.name, role: "material", source: "direct-record" });
    rememberCompound("SMILES", record.desiredProduct.smiles, { name: record.desiredProduct.name, role: record.ordinal === 2 ? "target" : "intermediate", source: record.desiredProduct.nameStatus });
  }

  const compoundNodes = [...compoundRecords.values()].map((record) => ({
    id: record.id,
    name: record.name ?? `SMILES ${short(record.value, 26)}`,
    description: "A source compound-identifier record. This node is not, by itself, a physical batch or a canonicalized chemical structure assertion.",
    shortDescription: short(record.value, 46),
    entityKind: "chemical-identifier-record",
    typeRole: record.roles.has("target") ? "target" : record.roles.has("intermediate") ? "intermediate" : "compound-identifier",
    phase: "native-record",
    scientificStatus: record.source,
    identifierType: record.type,
    identifierValue: record.value,
    observedRoles: [...record.roles].sort()
  }));

  const sweepReactionNodes = artifact.cohorts.conditionSweep.targets.flatMap((target) => target.routes.map((route) => ({
    id: `reaction:${route.reactionId}`,
    name: `${target.label} / ${route.selectionReason === "minimum-recorded-yield" ? "minimum" : "maximum"} yield`,
    description: "Selected native ORD reaction record projected with its input identifiers, condition profile, workup type, desired product, measured yield, and provenance DOI.",
    shortDescription: `${route.outcome.yield.value.toFixed(2)}% yield; ${route.inputs.catalyst.name ?? "unnamed catalyst"}.`,
    entityKind: "ord-reaction-record",
    typeRole: "condition-route-fragment",
    phase: "native-record",
    scientificStatus: "direct-record",
    nativeReactionId: route.reactionId,
    nativeRecordSha256: route.nativeRecordSha256,
    routeIdentity: route.routeIdentity,
    targetId: target.id,
    selectionReason: route.selectionReason,
    conditions: route.conditions,
    workups: route.workups,
    measuredYield: route.outcome.yield,
    doi: route.provenance.doi
  })));

  const cascadeReactionNodes = artifact.cohorts.linkedCascade.records.map((record) => ({
    id: `reaction:${record.reactionId}`,
    name: record.name,
    description: "Native ORD cascade record preserving selected conditions, workup sequence, outcomes, provenance, and reaction_id cross-reference evidence.",
    shortDescription: `Step ${record.ordinal + 1}; ${record.workups.length} workup(s); ${record.crossReferencedReactionIds.length} native reference(s).`,
    entityKind: "ord-reaction-record",
    typeRole: "cascade-reaction",
    phase: "native-record",
    scientificStatus: "direct-record",
    nativeReactionId: record.reactionId,
    nativeRecordSha256: record.nativeRecordSha256,
    ordinal: record.ordinal,
    catalysts: record.catalysts,
    conditions: record.conditions,
    workups: record.workups,
    outcomes: record.outcomes,
    nativeCrossReferences: record.crossReferencedReactionIds,
    doi: record.provenance.doi
  }));

  const profileNodes = [
    {
      id: `identity-profile:${artifact.identityProfiles.targetIdentity.id}`,
      name: "Exact ORD product SMILES",
      description: artifact.identityProfiles.targetIdentity.rule,
      shortDescription: "Byte-exact source string; no normalization.",
      entityKind: "identity-profile",
      typeRole: "target-identity-profile",
      phase: "derived-analysis",
      scientificStatus: "declared-derived",
      profile: artifact.identityProfiles.targetIdentity
    },
    {
      id: `identity-profile:${artifact.identityProfiles.routeIdentity.id}`,
      name: "ORD record and condition route",
      description: artifact.identityProfiles.routeIdentity.rule,
      shortDescription: `${artifact.identityProfiles.routeIdentity.fields.length} identity fields.`,
      entityKind: "identity-profile",
      typeRole: "route-identity-profile",
      phase: "derived-analysis",
      scientificStatus: "declared-derived",
      profile: artifact.identityProfiles.routeIdentity
    }
  ];

  const routeNodes = artifact.pathSpace.routes.map((route) => ({
    ...route,
    id: `route:${route.id}`,
    name: route.label,
    description: route.actual ? "The actual mapped baseline backed by the three pinned ORD records and their native cross-references." : "Declared Onto2D counterfactual used only inside the finite Historical Load analysis space; chemical feasibility is unknown.",
    shortDescription: `${route.costs.reactionRecords} record(s); ${route.costs.recordedIntermediates} intermediate(s); ${route.admissible ? "admissible" : "inadmissible"}.`,
    entityKind: "declared-synthesis-route",
    typeRole: "analysis-route",
    phase: route.actual ? "mapped-actual-route" : "counterfactual-space",
    scientificStatus: route.actual ? "direct-record-mapping" : "counterfactual",
    routeId: route.id
  }));

  const loadNodes = artifact.historicalLoad.results.map((result) => ({
    id: `analysis:historical-load:${result.costFunction}`,
    name: `Historical Load / ${result.costFunction}`,
    description: artifact.historicalLoad.interpretation,
    shortDescription: `${result.equation} ${result.unit}.`,
    entityKind: "onto2d-analysis-result",
    typeRole: "historical-load",
    phase: "derived-analysis",
    scientificStatus: "bounded-derived-result",
    result
  }));

  const evidenceNodes = [...new Map(artifact.ord.datasets.map((dataset) => [dataset.doi, dataset])).values()].map((dataset) => ({
    id: `publication:doi:${dataset.doi}`,
    name: `Publication ${dataset.doi}`,
    description: "Publication DOI retained from ORD dataset and reaction provenance.",
    shortDescription: dataset.doi,
    entityKind: "publication-reference",
    typeRole: "evidence-reference",
    phase: "native-record",
    scientificStatus: "direct-record",
    doi: dataset.doi
  }));

  const nodes = [...datasetNodes, ...compoundNodes, ...sweepReactionNodes, ...cascadeReactionNodes, ...profileNodes, ...routeNodes, ...loadNodes, ...evidenceNodes];
  const edges = [];
  for (const target of artifact.cohorts.conditionSweep.targets) {
    const targetNode = compoundId("SMILES", target.productIdentifier.value);
    const [left, right] = target.routes;
    for (const route of target.routes) {
      const reactionNode = `reaction:${route.reactionId}`;
      edges.push({ id: edgeId("contains-record", `dataset:${sweepDataset.datasetId}`, reactionNode), source: `dataset:${sweepDataset.datasetId}`, target: reactionNode, relation: "contains-record", relationLayer: "native", evidenceClass: "ord-dataset-membership", evidenceStatus: "captured" });
      for (const [role, compound] of Object.entries(route.inputs)) {
        const relation = role === "catalyst" ? "uses-catalyst" : role === "base" ? "uses-base" : role === "additive" ? "uses-additive" : "uses-input-identifier";
        edges.push({ id: edgeId(relation, reactionNode, compoundId("SMILES", compound.smiles), role), source: reactionNode, target: compoundId("SMILES", compound.smiles), relation, relationLayer: "native", evidenceClass: "ord-reaction-field", evidenceStatus: "captured", nativeRole: compound.nativeRole });
      }
      edges.push({ id: edgeId("records-product-identifier", reactionNode, targetNode), source: reactionNode, target: targetNode, relation: "records-product-identifier", relationLayer: "native", evidenceClass: "ord-reaction-outcome", evidenceStatus: "captured" });
      edges.push({ id: edgeId("classified-by", reactionNode, `identity-profile:${artifact.identityProfiles.routeIdentity.id}`), source: reactionNode, target: `identity-profile:${artifact.identityProfiles.routeIdentity.id}`, relation: "classified-by", relationLayer: "derived", evidenceClass: "declared-identity-profile", evidenceStatus: "derived" });
    }
    edges.push({ id: edgeId("shares-exact-product-identifier", `reaction:${left.reactionId}`, `reaction:${right.reactionId}`, target.id), source: `reaction:${left.reactionId}`, target: `reaction:${right.reactionId}`, relation: "shares-exact-product-identifier", relationLayer: "derived", evidenceClass: "exact-source-string-equality", evidenceStatus: "derived", physicalBatchContinuity: false });
    edges.push({ id: edgeId("classified-by", targetNode, `identity-profile:${artifact.identityProfiles.targetIdentity.id}`), source: targetNode, target: `identity-profile:${artifact.identityProfiles.targetIdentity.id}`, relation: "classified-by", relationLayer: "derived", evidenceClass: "declared-identity-profile", evidenceStatus: "derived" });
  }

  for (const record of artifact.cohorts.linkedCascade.records) {
    const reactionNode = `reaction:${record.reactionId}`;
    edges.push({ id: edgeId("contains-record", `dataset:${cascadeDataset.datasetId}`, reactionNode), source: `dataset:${cascadeDataset.datasetId}`, target: reactionNode, relation: "contains-record", relationLayer: "native", evidenceClass: "ord-dataset-membership", evidenceStatus: "captured" });
    const inputId = record.ordinal === 0 ? compoundId("SMILES", record.primaryInput.smiles) : compoundId("SMILES", artifact.cohorts.linkedCascade.records[record.ordinal - 1].desiredProduct.smiles);
    const productId = compoundId("SMILES", record.desiredProduct.smiles);
    edges.push({ id: edgeId("consumes-identified-material", reactionNode, inputId), source: reactionNode, target: inputId, relation: "consumes-identified-material", relationLayer: record.ordinal === 0 ? "native" : "mapped-native-reference", evidenceClass: record.ordinal === 0 ? "ord-reaction-field" : "ord-reaction-id-cross-reference", evidenceStatus: "captured" });
    edges.push({ id: edgeId("records-product-identifier", reactionNode, productId), source: reactionNode, target: productId, relation: "records-product-identifier", relationLayer: "native", evidenceClass: "ord-reaction-outcome", evidenceStatus: "captured" });
    if (record.ordinal > 0) {
      const prior = artifact.cohorts.linkedCascade.records[record.ordinal - 1];
      edges.push({ id: edgeId("native-material-continuity", `reaction:${prior.reactionId}`, reactionNode), source: `reaction:${prior.reactionId}`, target: reactionNode, relation: "native-material-continuity", relationLayer: "native", evidenceClass: "ord-reaction-id-cross-reference", evidenceStatus: "captured", nativeReferenceMultiplicity: record.crossReferencedReactionIds.length });
    }
  }

  const islatravirNode = compoundId("SMILES", artifact.cohorts.linkedCascade.records.at(-1).desiredProduct.smiles);
  for (const route of artifact.pathSpace.routes) {
    const routeNode = `route:${route.id}`;
    edges.push({ id: edgeId("declared-target", routeNode, islatravirNode), source: routeNode, target: islatravirNode, relation: "declared-target", relationLayer: "analysis", evidenceClass: route.actual ? "mapped-ord-chain" : "declared-counterfactual", evidenceStatus: route.actual ? "derived" : "counterfactual" });
    if (route.actual) for (const record of artifact.cohorts.linkedCascade.records) edges.push({ id: edgeId("maps-record", routeNode, `reaction:${record.reactionId}`), source: routeNode, target: `reaction:${record.reactionId}`, relation: "maps-record", relationLayer: "derived", evidenceClass: "declared-route-mapping", evidenceStatus: "derived", ordinal: record.ordinal });
  }
  for (const result of artifact.historicalLoad.results) {
    const analysisNode = `analysis:historical-load:${result.costFunction}`;
    for (const routeId of result.admissibleOptimumRoutes) edges.push({ id: edgeId("selects-admissible-optimum", analysisNode, `route:${routeId}`), source: analysisNode, target: `route:${routeId}`, relation: "selects-admissible-optimum", relationLayer: "analysis", evidenceClass: "bounded-cost-evaluation", evidenceStatus: "derived" });
    for (const routeId of result.freeOptimumRoutes) edges.push({ id: edgeId("selects-free-optimum", analysisNode, `route:${routeId}`), source: analysisNode, target: `route:${routeId}`, relation: "selects-free-optimum", relationLayer: "analysis", evidenceClass: "bounded-cost-evaluation", evidenceStatus: "derived" });
  }
  for (const dataset of artifact.ord.datasets) edges.push({ id: edgeId("cites", `dataset:${dataset.datasetId}`, `publication:doi:${dataset.doi}`), source: `dataset:${dataset.datasetId}`, target: `publication:doi:${dataset.doi}`, relation: "cites", relationLayer: "native", evidenceClass: "ord-dataset-provenance", evidenceStatus: "captured" });

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: CHEMICAL_REACTION_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: CHEMICAL_REACTION_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    nativeInventory: { datasets: datasetNodes.length, selectedReactions: sweepReactionNodes.length + cascadeReactionNodes.length, identifierRecords: compoundNodes.length, nativeContinuityEdges: edges.filter((edge) => edge.relation === "native-material-continuity").length },
    analysisInventory: { identityProfiles: profileNodes.length, routes: routeNodes.length, results: loadNodes.length },
    historicalLoad: artifact.historicalLoad.results.map((result) => ({ costFunction: result.costFunction, value: result.historicalLoad, unit: result.unit }))
  };
  const sourceFiles = artifact.source.authoredFiles.map((file) => ({ path: `cases/chemical-synthesis-history/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "chemical-reaction-provenance", name: "Chemical Synthesis History", version, description: "Pinned ORD reaction records, exact source identifier profiles, route-fragment comparisons, native cross-reaction continuity, and bounded Historical Load.", status: "external-source-locked-scientific-case" },
    source: { id: `ord-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { ordRelease: artifact.ord.release, ordCommit: artifact.ord.commit, ordSchemaVersion: artifact.ord.schemaVersion, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: CHEMICAL_REACTION_MAPPING_VERSION, license: artifact.ord.license, nonEndorsement: "The Open Reaction Database and cited authors do not endorse Onto2D or this bounded interpretation." },
      evidenceClasses: { "ord-dataset-membership": "Reaction membership in the pinned ORD Dataset protobuf.", "ord-reaction-field": "Identifier, condition, or role retained from a selected native ORD reaction field.", "ord-reaction-outcome": "Desired product or measurement retained from a selected native ORD outcome.", "ord-reaction-id-cross-reference": "Native ORD reaction_id reference from a later input to an earlier reaction record.", "exact-source-string-equality": "Derived equality over byte-exact native identifier strings; not physical-batch continuity.", "declared-counterfactual": "Onto2D route-space declaration with no claim of chemical feasibility.", "bounded-cost-evaluation": "Deterministic result over the four enumerated routes and named cost profile." },
      identityRegimes: Object.fromEntries(artifact.identityProfiles.equivalenceRegimes.map((regime) => [regime.id, regime.question])),
      presentation: {
        profile: "chemical-reaction-provenance-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "scientificStatus",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Chemical history records", searchPlaceholder: "Search reactions, targets, conditions, and routes", typeFilter: "Record kind", phaseFilter: "Evidence phase", statusFilter: "Evidence status", parents: "Incoming evidence or synthesis relations", children: "Outgoing evidence or synthesis relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "scientificStatus", label: "Evidence" }],
        boundary: { title: "Chemical evidence boundary", summary: "Native ORD identifiers and reaction_id continuity remain separate from derived equivalence, counterfactual routes, and Historical Load.", note: "Exact SMILES string equality is not canonical molecular identity or physical-batch continuity; +2 is limited to the declared islatravir route space." }
      },
      audit
    })
  });
}
