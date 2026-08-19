import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyClinicalTrajectoriesCaseIdentity } from "../../cases/clinical-trajectories/extract.mjs";

export const CLINICAL_TRAJECTORIES_MAPPING_VERSION = "clinical-trajectories-mapping-v1";
const RELEASE_DOMAIN = "onto2d:clinical-trajectories-model-release:v1";
const AUDIT_DOMAIN = "onto2d:clinical-trajectories-model-audit:v1";
const EDGE_DOMAIN = "onto2d:clinical-trajectories-model-edge:v1";

function fail(message) {
  throw new TypeError(`clinical-trajectories Model Pack compilation failed: ${message}`);
}

function edgeId(relation, source, target, key = "") {
  return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`;
}

export function compileClinicalTrajectoriesModelPack(input) {
  let artifact;
  try {
    artifact = verifyClinicalTrajectoriesCaseIdentity(input);
  } catch (error) {
    fail(error.message);
  }
  if (artifact.cohort.patientCount !== 5 || artifact.frames.length !== 5 || artifact.histories.length !== 5 || artifact.timelines.length !== 5) fail("case inventory differs");
  if (artifact.audit.futureEventsInFrames !== 0 || artifact.audit.missingLabsImputed !== 0 || artifact.audit.diagnosisAssertions !== 0 || artifact.audit.treatmentRecommendations !== 0 || artifact.audit.outcomePredictions !== 0 || artifact.audit.treatmentEffectsInferred !== 0 || artifact.audit.causalRelationsInferred !== 0) fail("clinical safety boundary differs");

  const sourceNode = {
    id: "source:mimic-iv-demo-2.2-cohort",
    name: "MIMIC-IV Demo 2.2 cohort",
    description: "Five deterministically selected deidentified subjects projected from eight exact MIMIC-IV Clinical Database Demo v2.2 files.",
    shortDescription: "5 subjects / 8 upstream file locks / open demo.",
    entityKind: "source-cohort",
    typeRole: "source-locked-deidentified-cohort",
    phase: "source",
    evidenceStatus: "source-locked",
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    completePopulationClaim: false,
    displayedDatesAreRealCalendarDates: false
  };
  const patientNodes = artifact.cohort.patients.map((patient) => ({
    id: `patient:${patient.alias}`,
    name: `${patient.alias} / deidentified subject`,
    description: `Alias ${patient.alias} maps only to source-deidentified subject_id ${patient.sourceSubjectId} inside this pinned demo projection.`,
    shortDescription: `subject_id ${patient.sourceSubjectId}; not reidentified.`,
    entityKind: "deidentified-patient-record",
    typeRole: "source-deidentified-subject",
    phase: "source",
    evidenceStatus: "source-recorded",
    alias: patient.alias,
    sourceSubjectId: patient.sourceSubjectId,
    reidentified: false
  }));
  const encounterNodes = artifact.cohort.patients.map((patient) => ({
    id: `encounter:${patient.focusEncounterId}`,
    name: `${patient.alias} focus admission`,
    description: `The exact source admission ${patient.focusEncounterId} containing the selected latest ICU stay for ${patient.alias}.`,
    shortDescription: `hadm_id ${patient.focusEncounterId}.`,
    entityKind: "hospital-encounter",
    typeRole: "focus-admission",
    phase: "recorded-history",
    evidenceStatus: "source-recorded",
    alias: patient.alias,
    sourceSubjectId: patient.sourceSubjectId,
    hadmId: patient.focusEncounterId
  }));
  const stayNodes = artifact.cohort.patients.map((patient) => {
    const frame = artifact.frames.find((candidate) => candidate.alias === patient.alias);
    return {
      id: `icu-stay:${patient.focusStayId}`,
      name: `${patient.alias} focus ICU stay`,
      description: `The selected latest ICU stay ends at shifted source timestamp ${patient.cutoff}; the cutoff is not a real calendar date.`,
      shortDescription: `${frame.careunit}; stay_id ${patient.focusStayId}.`,
      entityKind: "icu-stay",
      typeRole: "focus-icu-stay",
      phase: "recorded-history",
      evidenceStatus: "source-recorded",
      alias: patient.alias,
      hadmId: patient.focusEncounterId,
      stayId: patient.focusStayId,
      cutoff: patient.cutoff,
      shiftedTimestamp: true
    };
  });
  const frameNodes = artifact.frames.map((frame) => ({
    id: `frame:${frame.alias}`,
    name: `${frame.alias} bounded observation frame`,
    description: `The latest four declared numeric lab records within 24 hours ending at the selected ICU outtime, plus a count of overlapping prescription records.`,
    shortDescription: `4 labs / ${frame.overlappingPrescriptionRecordCount} overlapping prescription records.`,
    entityKind: "observation-frame",
    typeRole: "bounded-current-frame",
    phase: "bounded-projection",
    evidenceStatus: "deterministically-derived",
    alias: frame.alias,
    frameIdentity: frame.identity,
    cutoff: frame.cutoff,
    lookbackHours: frame.lookbackHours,
    careunit: frame.careunit,
    completePatientState: false,
    prescriptionAdministrationClaim: false
  }));
  const labNodes = artifact.frames.flatMap((frame) => frame.labs.map((lab) => ({
    id: `frame-lab:${frame.alias}:${lab.itemId}`,
    name: `${frame.alias} / ${lab.label}`,
    description: `Exact numeric source record ${lab.source.recordId} at shifted timestamp ${lab.timestamp}.`,
    shortDescription: `${lab.value} ${lab.unit}${lab.sourceFlag ? ` / source flag ${lab.sourceFlag}` : ""}.`,
    entityKind: "lab-record",
    typeRole: "selected-frame-lab",
    phase: "bounded-projection",
    evidenceStatus: "source-recorded",
    alias: frame.alias,
    itemId: lab.itemId,
    value: lab.value,
    unit: lab.unit,
    sourceFlag: lab.sourceFlag,
    shiftedTimestamp: lab.timestamp,
    sourceLocator: canonicalClone(lab.source),
    missing: false,
    diagnosisAssertion: false
  })));
  const historyNodes = artifact.histories.map((history) => ({
    id: `history:${history.alias}`,
    name: `${history.alias} available recorded history`,
    description: "Counts of selected admissions, ICU stays, procedure codes, prescription records, flagged selected labs, and timeline events available at the frame cutoff.",
    shortDescription: `${history.priorAdmissionCount} prior admissions / ${history.timelineEventCount} available events.`,
    entityKind: "history-summary",
    typeRole: "record-count-context",
    phase: "history-aware-analysis",
    evidenceStatus: "deterministically-derived",
    alias: history.alias,
    priorAdmissionCount: history.priorAdmissionCount,
    priorIcuStayCount: history.priorIcuStayCount,
    procedureRecordCountAtCutoff: history.procedureRecordCountAtCutoff,
    prescriptionRecordCountAtCutoff: history.prescriptionRecordCountAtCutoff,
    abnormalFlaggedSelectedLabCountAtCutoff: history.abnormalFlaggedSelectedLabCountAtCutoff,
    timelineEventCount: history.timelineEventCount,
    futureSourceEventCount: history.futureSourceEventCount,
    causalClaim: false,
    clinicalInterpretation: null
  }));
  const focusHistory = artifact.histories.find((history) => history.alias === "P01");
  const historyWindowNodes = focusHistory.windows.map((window) => ({
    id: `history-window:${window.id}`,
    name: window.label,
    description: `${window.eventCount} selected source events for P01 are visible inside the declared ${window.label.toLowerCase()} boundary.`,
    shortDescription: `${window.eventCount} events / cutoff-safe.`,
    entityKind: "history-window",
    typeRole: window.id,
    phase: "history-window",
    evidenceStatus: "declared-analysis-scope",
    eventCount: window.eventCount,
    futureEventsIncluded: false
  }));
  const similarityNode = {
    id: "analysis:closest-bounded-frames",
    name: "Closest bounded frames: P04 / P05",
    description: "The declared normalized metric selects P04 and P05. Their recorded history summaries differ; no identity, clinical equivalence, or outcome conclusion follows.",
    shortDescription: `distance ${artifact.similarFrameComparison.distance}; different recorded histories.`,
    entityKind: "similarity-result",
    typeRole: "descriptive-frame-comparison",
    phase: "history-aware-analysis",
    evidenceStatus: "deterministically-derived-bounded",
    metric: artifact.similarFrameComparison.metric,
    distance: artifact.similarFrameComparison.distance,
    historyDiffers: true,
    samePatientIdentity: false,
    clinicalEquivalenceClaim: false,
    clinicalConclusion: null
  };
  const boundaryNodes = [
    {
      id: "boundary:shifted-dates",
      name: "Shifted dates only",
      description: artifact.methodology.shiftedDateSemantics,
      shortDescription: "Sequence and intervals only; no real calendar claim.",
      typeRole: "deidentification-boundary",
      evidenceStatus: "source-declared-boundary",
      realCalendarDateClaims: 0
    },
    {
      id: "boundary:prescription-records",
      name: "Prescription is not administration",
      description: artifact.methodology.prescriptionSemantics,
      shortDescription: "Order interval records; no adherence claim.",
      typeRole: "medication-semantics-boundary",
      evidenceStatus: "explicit-non-claim",
      administrationClaims: 0
    },
    {
      id: "boundary:temporal-causality",
      name: "Temporal order is not causation",
      description: "The timeline orders selected records but adds no causal edge, treatment-effect inference, or disease-course assertion.",
      shortDescription: "1,981 available events / zero causal relations.",
      typeRole: "causality-boundary",
      evidenceStatus: "explicit-non-claim",
      causalRelations: 0
    },
    {
      id: "boundary:not-clinical-use",
      name: "Not a clinical tool",
      description: artifact.disclaimer,
      shortDescription: "No diagnosis, prediction, or recommendation.",
      typeRole: "clinical-use-boundary",
      evidenceStatus: "explicit-non-claim",
      diagnosisAssertions: 0,
      outcomePredictions: 0,
      treatmentRecommendations: 0
    },
    {
      id: "boundary:historical-load",
      name: "Historical Load is undefined",
      description: artifact.historicalLoad.reason,
      shortDescription: "No path space, cost function, or baseline.",
      typeRole: "historical-load-boundary",
      evidenceStatus: "explicitly-not-evaluated",
      value: null
    }
  ].map((node) => ({ ...node, entityKind: "analysis-boundary", phase: "evidence-boundary" }));

  const nodes = [sourceNode, ...patientNodes, ...encounterNodes, ...stayNodes, ...frameNodes, ...labNodes, ...historyNodes, ...historyWindowNodes, similarityNode, ...boundaryNodes];
  const edges = [];
  const add = (relation, source, target, fields = {}) => edges.push({ id: edgeId(relation, source, target, fields.key ?? ""), source, target, relation, genealogical: false, ...fields });
  for (const patient of artifact.cohort.patients) {
    const patientId = `patient:${patient.alias}`;
    const encounterId = `encounter:${patient.focusEncounterId}`;
    const stayId = `icu-stay:${patient.focusStayId}`;
    const frameId = `frame:${patient.alias}`;
    const historyId = `history:${patient.alias}`;
    add("contains-subject", sourceNode.id, patientId, { relationLayer: "source", evidenceClass: "bounded-selection", evidenceStatus: "source-recorded", completePopulationClaim: false, key: patient.alias });
    add("has-focus-encounter", patientId, encounterId, { relationLayer: "recorded-history", evidenceClass: "native-identifier-scope", evidenceStatus: "source-recorded" });
    add("contains-icu-stay", encounterId, stayId, { relationLayer: "recorded-history", evidenceClass: "native-identifier-scope", evidenceStatus: "source-recorded" });
    add("defines-cutoff-for", stayId, frameId, { relationLayer: "bounded-projection", evidenceClass: "declared-cutoff", evidenceStatus: "derived", shiftedTimestamp: true });
    add("has-recorded-history", patientId, historyId, { relationLayer: "history-aware-analysis", evidenceClass: "source-record-counts", evidenceStatus: "derived", causal: false });
    add("contextualizes", historyId, frameId, { relationLayer: "history-aware-analysis", evidenceClass: "declared-history-context", evidenceStatus: "derived", causal: false, clinicalConclusion: false });
    for (const lab of artifact.frames.find((frame) => frame.alias === patient.alias).labs) add("contains-lab-record", frameId, `frame-lab:${patient.alias}:${lab.itemId}`, { relationLayer: "bounded-projection", evidenceClass: "exact-source-row", evidenceStatus: "source-recorded", key: lab.itemId });
    add("bounded-by", frameId, "boundary:prescription-records", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: patient.alias });
    add("bounded-by", frameId, "boundary:not-clinical-use", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: patient.alias });
    add("bounded-by", historyId, "boundary:temporal-causality", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: patient.alias });
  }
  add("bounded-by", sourceNode.id, "boundary:shifted-dates", { relationLayer: "boundary", evidenceClass: "source-deidentification", evidenceStatus: "declared" });
  for (const window of historyWindowNodes) add("scopes", window.id, "history:P01", { relationLayer: "history-window", evidenceClass: "declared-analysis-scope", evidenceStatus: "declared", key: window.id });
  add("compares-frame", similarityNode.id, "frame:P04", { relationLayer: "history-aware-analysis", evidenceClass: "declared-similarity-metric", evidenceStatus: "derived", key: "left" });
  add("compares-frame", similarityNode.id, "frame:P05", { relationLayer: "history-aware-analysis", evidenceClass: "declared-similarity-metric", evidenceStatus: "derived", key: "right" });
  add("bounded-by", similarityNode.id, "boundary:not-clinical-use", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: "clinical-use" });
  add("bounded-by", similarityNode.id, "boundary:temporal-causality", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: "causality" });
  add("bounded-by", similarityNode.id, "boundary:historical-load", { relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared", key: "historical-load" });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`);
    if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`);
    edgeIds.add(edge.id);
  }
  if (edges.some((edge) => edge.relation === "causes" || edge.causal === true || edge.clinicalConclusion === true)) fail("record order was promoted to causality or a clinical conclusion");
  if (nodes.some((node) => node.diagnosisAssertion === true || node.outcomePredictions > 0 || node.treatmentRecommendations > 0 || node.administrationClaims > 0)) fail("compiled nodes exceed the clinical-use boundary");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: CLINICAL_TRAJECTORIES_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: CLINICAL_TRAJECTORIES_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { patients: patientNodes.length, focusEncounters: encounterNodes.length, focusIcuStays: stayNodes.length, boundedFrames: frameNodes.length, selectedFrameLabs: labNodes.length, historySummaries: historyNodes.length, historyWindows: historyWindowNodes.length, availableTimelineEvents: artifact.timelines.reduce((total, timeline) => total + timeline.events.length, 0) },
    futureInputEvents: 0,
    missingLabsImputed: 0,
    diagnosisAssertions: 0,
    treatmentRecommendations: 0,
    outcomePredictions: 0,
    treatmentEffectsInferred: 0,
    causalEdges: 0,
    prescriptionAdministrationClaims: 0,
    realCalendarDateClaims: 0,
    sourceMutations: 0,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/clinical-trajectories/${file.path}`, hash: file.identity }));
  return buildModelPack({
    model: { id: "clinical-trajectories", name: "Clinical Trajectories", version, description: "A source-locked MIMIC-IV Demo case separating bounded observation frames, recorded longitudinal context, and clinical interpretation.", status: "external-source-locked-clinical-history-case" },
    source: { id: `clinical-trajectories-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { cohortId: artifact.cohort.id, retrievedAt: artifact.source.provider.retrievedAt, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: CLINICAL_TRAJECTORIES_MAPPING_VERSION, doi: artifact.source.provider.doi },
      evidenceClasses: {
        "bounded-selection": "Deterministic five-subject selection from the exact MIMIC-IV Demo v2.2 inputs.",
        "native-identifier-scope": "Native subject_id, hadm_id, and stay_id scope retained without cross-patient joins.",
        "exact-source-row": "An exact table, CSV row, and record identifier from the bounded source projection.",
        "declared-cutoff": "The selected latest ICU outtime used only as a shifted temporal cutoff.",
        "source-record-counts": "Counts of selected records available at the cutoff; not clinical interpretation.",
        "declared-similarity-metric": "A descriptive four-lab normalized distance with no identity or clinical-equivalence claim.",
        "source-deidentification": "The source declares ciphered identifiers and consistently shifted dates.",
        "analysis-scope": "Boundary preventing diagnosis, prognosis, treatment advice, causality, and Historical Load promotion."
      },
      presentation: {
        profile: "clinical-trajectories-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "phase",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Clinical trajectory evidence", searchPlaceholder: "Search patients, encounters, frames, labs, history summaries, and boundaries", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming trajectory relations", children: "Outgoing trajectory relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }],
        boundary: { title: "Snapshot / trajectory / clinical-use boundary", summary: "A bounded observation frame and its preceding records remain separate from complete patient state or clinical interpretation.", note: "Dates are shifted, prescriptions are not administrations, missing values are not normal values, temporal order is not causation, and this model provides no diagnosis, prognosis, recommendation, or treatment-effect claim." }
      },
      audit
    })
  });
}
