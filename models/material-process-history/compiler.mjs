import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyMaterialProcessHistoryCaseIdentity } from "../../cases/material-process-history/extract.mjs";

export const MATERIAL_PROCESS_HISTORY_MAPPING_VERSION = "material-process-history-mapping-v1";
const RELEASE_DOMAIN = "onto2d:material-process-history-model-release:v1";
const AUDIT_DOMAIN = "onto2d:material-process-history-model-audit:v1";
const EDGE_DOMAIN = "onto2d:material-process-history-model-edge:v1";

function fail(message) { throw new TypeError(`material-process-history Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }

export function compileMaterialProcessHistoryModelPack(input) {
  let artifact;
  try { artifact = verifyMaterialProcessHistoryCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.cohort.buildCount !== 3 || artifact.cohort.comparisonPartCount !== 3 || artifact.cohort.residualStrainPointCount !== 2248 || artifact.cohort.residualStrainHeightSliceCount !== 24) fail("case inventory differs");
  if (artifact.audit.causalEdges || artifact.audit.missingSiblingMeasurementsCopied || artifact.audit.sourceFilenameCorrectionsInvented || artifact.audit.completeProcessSpaceClaims || artifact.audit.liveQueriesDuringBuild) fail("epistemic boundary differs");

  const sourceNode = {
    id: "source:ambench-2022-01-bounded-cohort",
    name: "AMB2022-01 frozen cohort",
    description: "Three native NIST AM-Bench build records, their P3 part records, P1 thermography metadata, and the exact B7-P3 CHESS residual-strain field.",
    shortDescription: "3 builds / 3 P3 parts / 2,248 B7-P3 strain coordinates.",
    entityKind: "source-cohort",
    typeRole: "source-locked-projection",
    phase: "source",
    evidenceStatus: "source-locked",
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    completeProcessSpaceClaim: false
  };
  const recipeNode = {
    id: "recipe:ambench-2022-01-p3-nominal",
    name: "Shared nominal P3 recipe",
    description: "The exact common projection of prescribed IN718 feedstock, AMMT environment, laser, layer, hatch, and scan-file fields for B6, B7, and B8 P3 components.",
    shortDescription: "IN718 / 285 W / 960 mm/s / 312 layers / 0.04 mm.",
    entityKind: "nominal-recipe",
    typeRole: "prescribed-process",
    phase: "process",
    evidenceStatus: "source-declared",
    recipeIdentity: artifact.recipe.identity,
    recipe: canonicalClone(artifact.recipe),
    observedMachineTrajectory: false
  };
  const buildNodes = artifact.builds.map((build) => ({
    id: `build:${build.id}`,
    name: build.id,
    description: `${build.purpose}. Native build identity is retained even though the bounded P3 nominal recipe matches B6, B7, and B8.`,
    shortDescription: `${build.recordedCreationDate.slice(0, 10)} / ${build.status}`,
    entityKind: "am-build",
    typeRole: build.id.slice(-2),
    phase: "build-record",
    evidenceStatus: "source-declared",
    nativeId: build.id,
    nativePid: build.pid,
    buildIdentity: build.identity,
    recordedCreationDate: build.recordedCreationDate
  }));
  const processNodes = artifact.builds.map((build) => ({
    id: `process:${build.process.id}`,
    name: `${build.id.slice(-2)} prescribed LPBF process`,
    description: "A native PBFLBAMBuildProcess record linked to one AMBuild output. Recipe equality is represented separately from process-record identity.",
    shortDescription: `${artifact.recipe.nominalLaserPower.value} W / ${artifact.recipe.nominalScanSpeed.value} mm/s / ${artifact.recipe.totalLayers} layers.`,
    entityKind: "build-process",
    typeRole: "prescribed-process",
    phase: "process",
    evidenceStatus: "source-declared",
    nativeId: build.process.id,
    nativePid: build.process.pid,
    processIdentity: build.process.identity,
    recipeIdentity: build.process.recipeIdentity,
    recordedStartDate: build.process.recordedStartDate,
    recordedCompleteDate: build.process.recordedCompleteDate,
    exactPhysicalChronologyClaim: false
  }));
  const partNodes = artifact.builds.map((build) => ({
    id: `part:${build.comparisonPart.id}`,
    name: `${build.id.slice(-2)}-P3 bridge part`,
    description: `${build.comparisonPart.purpose}. This native P3 record remains distinct from the same nominal material and recipe classes.`,
    shortDescription: `${build.comparisonPart.id} / ${build.comparisonPart.purpose}.`,
    entityKind: "am-part",
    typeRole: build.id.slice(-2),
    phase: "part-record",
    evidenceStatus: build.comparisonPart.id === artifact.residualStrain.targetPartId ? "measured-target" : "measurement-unresolved",
    nativeId: build.comparisonPart.id,
    nativePid: build.comparisonPart.pid,
    partIdentity: build.comparisonPart.identity,
    materialClass: build.comparisonPart.materialClass,
    residualStrainMeasurementAvailable: build.comparisonPart.id === artifact.residualStrain.targetPartId
  }));
  const thermographyNodes = artifact.builds.map((build) => ({
    id: `thermography:${build.id.slice(-2).toLowerCase()}-p1-signal`,
    name: `${build.id.slice(-2)} P1 thermography signal`,
    description: "A P1 in-situ staring-camera record linked to the build process; it is not the P3 CHESS residual-strain measurement.",
    shortDescription: `${build.thermography.frameRate.value} Hz / ${build.thermography.imageWidthPixels}×${build.thermography.imageHeightPixels} / ${build.thermography.bitDepth} bit.`,
    entityKind: "thermography-record",
    typeRole: "in-situ-raw-signal",
    phase: "in-situ",
    evidenceStatus: "source-declared",
    nativeId: build.thermography.id,
    measurementIdentity: build.thermography.identity,
    componentProcessId: build.thermography.componentProcessId,
    residualStrainMeasurement: false
  }));
  const thermalProductNodes = artifact.builds.flatMap((build) => {
    const key = build.id.slice(-2).toLowerCase();
    return [
      {
        id: `thermal-product:${key}-tam`, name: `${build.id.slice(-2)} time-above-temperature artifact`,
        description: "A source-declared derived thermography artifact reference with its emissivity and threshold retained.",
        shortDescription: `${build.thermography.tam.filename} / ${build.thermography.tam.dataDoi}.`, entityKind: "derived-thermal-product", typeRole: "time-above-temperature", phase: "in-situ-derived", evidenceStatus: "source-declared-derived",
        filename: build.thermography.tam.filename, doi: build.thermography.tam.dataDoi, emissivity: build.thermography.tam.emissivity, thresholdTemperature: canonicalClone(build.thermography.tam.thresholdTemperature)
      },
      {
        id: `thermal-product:${key}-scr`, name: `${build.id.slice(-2)} solid-cooling-rate artifact`,
        description: "A source-declared derived thermography artifact reference. The literal filename is retained even where surrounding B7/B8 identifiers differ.",
        shortDescription: `${build.thermography.solidCoolingRate.filename} / ${build.thermography.solidCoolingRate.dataDoi}.`, entityKind: "derived-thermal-product", typeRole: "solid-cooling-rate", phase: "in-situ-derived", evidenceStatus: key === "b6" ? "source-declared-derived" : "source-literal-warning",
        filename: build.thermography.solidCoolingRate.filename, doi: build.thermography.solidCoolingRate.dataDoi, unit: build.thermography.solidCoolingRate.unit, sourceLiteralCorrected: false
      }
    ];
  });
  const measurementNode = {
    id: "measurement:b7-p3-residual-strain",
    name: "B7-P3 residual elastic strain field",
    description: "The CHESS energy-dispersive-diffraction result: 2,248 native coordinates with separate XX and ZZ strain components and the published uncertainty estimate.",
    shortDescription: "2,248 points / XX + ZZ / Y = 2.5 mm / uncertainty ≈ 1×10⁻⁴.",
    entityKind: "residual-strain-measurement",
    typeRole: "ex-situ-measured-field",
    phase: "ex-situ",
    evidenceStatus: "direct-measurement",
    measurementIdentity: artifact.residualStrain.identity,
    targetPartId: artifact.residualStrain.targetPartId,
    technique: artifact.residualStrain.technique,
    uncertainty: canonicalClone(artifact.residualStrain.estimatedMeasurementUncertainty),
    coordinateCount: artifact.residualStrain.summary.pointCount,
    componentCount: 2,
    causalEffectClaim: false
  };
  const sliceNodes = artifact.residualStrain.summary.heightSlices.map((slice) => ({
    id: `strain-slice:z-${slice.zMm.toFixed(2)}`,
    name: `Residual strain at Z ${slice.zMm.toFixed(2)} mm`,
    description: `Coordinate-preserving summary over ${slice.pointCount} published sample locations at one Z height; the full source points remain in the case artifact.`,
    shortDescription: `n ${slice.pointCount} / mean XX ${slice.meanXX.toExponential(2)} / mean ZZ ${slice.meanZZ.toExponential(2)}.`,
    entityKind: "strain-height-slice",
    typeRole: "spatial-summary",
    phase: "ex-situ-summary",
    evidenceStatus: "derived-from-exact-points",
    zMm: slice.zMm,
    pointCount: slice.pointCount,
    meanXX: slice.meanXX,
    meanZZ: slice.meanZZ,
    sourcePointMutation: false
  }));
  const regimeNodes = artifact.identityRegimes.map((regime) => ({
    id: `identity-regime:${regime.id}`,
    name: regime.id.replaceAll("-", " "),
    description: regime.meaning,
    shortDescription: `${regime.classes.length} resolved class${regime.classes.length === 1 ? "" : "es"} / ${regime.unresolved.length} unresolved.`,
    entityKind: "identity-regime",
    typeRole: regime.id,
    phase: "onto2d-analysis",
    evidenceStatus: "declared-analysis",
    equivalenceKey: regime.equivalenceKey,
    classes: canonicalClone(regime.classes),
    unresolved: canonicalClone(regime.unresolved)
  }));
  const boundaryNodes = [
    { id: "boundary:no-causal-promotion", name: "Association is not causality", description: "Process, thermography, and residual-strain records are linked by native specimen/process provenance without a generated causal-effect relation.", typeRole: "causal-boundary" },
    { id: "boundary:missing-stays-missing", name: "Sibling state remains unknown", description: "The B7-P3 field is never copied to B6-P3 or B8-P3; one measured target does not supply a three-part comparison of present state.", typeRole: "missingness-boundary" },
    { id: "boundary:source-literal", name: "Source anomaly stays visible", description: artifact.sourceAnomalies[0].description, typeRole: "source-anomaly-boundary" },
    { id: "boundary:historical-load", name: "Historical Load is undefined", description: artifact.historicalLoad.reason, typeRole: "historical-load-boundary", value: null }
  ].map((node) => ({ ...node, shortDescription: "Explicit interpretation boundary.", entityKind: "analysis-boundary", phase: "boundary", evidenceStatus: "explicit-non-claim" }));

  const nodes = [sourceNode, recipeNode, ...buildNodes, ...processNodes, ...partNodes, ...thermographyNodes, ...thermalProductNodes, measurementNode, ...sliceNodes, ...regimeNodes, ...boundaryNodes];
  const edges = [];
  const add = (relation, source, target, fields = {}) => edges.push({ id: edgeId(relation, source, target, fields.key ?? ""), source, target, relation, genealogical: false, causal: false, ...fields });
  const measuredStateMembers = new Set(artifact.identityRegimes.find(({ id }) => id === "measured-state").classes.flatMap(({ members }) => members));
  add("declares-recipe", sourceNode.id, recipeNode.id, { relationLayer: "source", evidenceClass: "source-locked-projection", evidenceStatus: "source-declared" });
  for (const build of artifact.builds) {
    const key = build.id.slice(-2).toLowerCase();
    const buildNode = `build:${build.id}`;
    const processNode = `process:${build.process.id}`;
    const partNode = `part:${build.comparisonPart.id}`;
    const thermoNode = `thermography:${key}-p1-signal`;
    add("contains-build", sourceNode.id, buildNode, { relationLayer: "source", evidenceClass: "native-build-record", evidenceStatus: "source-declared", key });
    add("prescribed-by", processNode, recipeNode.id, { relationLayer: "prescribed-process", evidenceClass: "nominal-recipe-equality", evidenceStatus: "source-declared", key });
    add("produces-build-record", processNode, buildNode, { relationLayer: "process", evidenceClass: "native-output-link", evidenceStatus: "source-declared", causal: false, key });
    add("contains-part-record", buildNode, partNode, { relationLayer: "part", evidenceClass: "native-parent-link", evidenceStatus: "source-declared", key });
    add("observed-during", thermoNode, processNode, { relationLayer: "in-situ", evidenceClass: "native-process-link", evidenceStatus: "source-declared", causal: false, key });
    add("derives-thermal-product", thermoNode, `thermal-product:${key}-tam`, { relationLayer: "in-situ-derived", evidenceClass: "source-declared-derivation", evidenceStatus: "source-declared-derived", key: `${key}:tam` });
    add("derives-thermal-product", thermoNode, `thermal-product:${key}-scr`, { relationLayer: "in-situ-derived", evidenceClass: "source-declared-derivation", evidenceStatus: key === "b6" ? "source-declared-derived" : "source-literal-warning", key: `${key}:scr` });
    for (const regime of artifact.identityRegimes) {
      const classEntry = regime.classes.find(({ members }) => members.includes(build.comparisonPart.id));
      add("evaluated-under", partNode, `identity-regime:${regime.id}`, { relationLayer: "onto2d-analysis", evidenceClass: classEntry ? "resolved-identity-class" : "unresolved-measured-state", evidenceStatus: classEntry ? "resolved" : "unknown", classId: classEntry?.id ?? null, key: `${key}:${regime.id}` });
    }
    if (!measuredStateMembers.has(build.comparisonPart.id)) add("bounded-by", partNode, "boundary:missing-stays-missing", { relationLayer: "boundary", evidenceClass: "explicit-missingness", evidenceStatus: "unknown", key });
  }
  add("measures", measurementNode.id, "part:AMB2022-718-AMMT-B7-P3", { relationLayer: "ex-situ-measured", evidenceClass: "native-target-attribution", evidenceStatus: "direct-measurement", causal: false });
  for (const slice of sliceNodes) add("summarizes-height-slice", measurementNode.id, slice.id, { relationLayer: "ex-situ-summary", evidenceClass: "deterministic-coordinate-summary", evidenceStatus: "derived-from-exact-points", key: slice.id });
  add("bounded-by", measurementNode.id, "boundary:no-causal-promotion", { relationLayer: "boundary", evidenceClass: "explicit-non-claim", evidenceStatus: "declared" });
  add("bounded-by", "thermal-product:b7-scr", "boundary:source-literal", { relationLayer: "boundary", evidenceClass: "source-literal-warning", evidenceStatus: "declared", key: "b7" });
  add("bounded-by", "thermal-product:b8-scr", "boundary:source-literal", { relationLayer: "boundary", evidenceClass: "source-literal-warning", evidenceStatus: "declared", key: "b8" });
  add("bounded-by", sourceNode.id, "boundary:historical-load", { relationLayer: "boundary", evidenceClass: "explicitly-not-evaluated", evidenceStatus: "declared" });

  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs repeat");
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edgeIds.has(edge.id)) fail(`edge ${edge.id} is repeated or unresolved`);
    edgeIds.add(edge.id);
  }
  if (edges.some((edge) => edge.causal !== false || ["causes", "caused-by", "inherits-state-from"].includes(edge.relation))) fail("compiled edge exceeds the causal boundary");
  if (nodes.some((node) => node.sourceLiteralCorrected === true || node.completeProcessSpaceClaim === true || node.observedMachineTrajectory === true)) fail("compiled node exceeds the evidence boundary");

  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: MATERIAL_PROCESS_HISTORY_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = {
    mappingVersion: MATERIAL_PROCESS_HISTORY_MAPPING_VERSION,
    releaseIdentity,
    sourceIdentity: artifact.source.identity,
    caseIdentity: artifact.caseIdentity,
    inventory: { builds: buildNodes.length, processes: processNodes.length, parts: partNodes.length, thermographyRecords: thermographyNodes.length, thermalProducts: thermalProductNodes.length, strainMeasurements: 1, strainHeightSlices: sliceNodes.length, identityRegimes: regimeNodes.length, boundaries: boundaryNodes.length },
    fullSourceStrainPoints: artifact.cohort.residualStrainPointCount,
    representedStrainHeightSlices: sliceNodes.length,
    missingSiblingMeasurementsCopied: 0,
    sourceFilenameCorrectionsInvented: 0,
    causalEdges: 0,
    completeProcessSpaceClaims: 0,
    liveQueriesDuringBuild: 0,
    historicalLoadStatus: artifact.historicalLoad.status
  };
  return buildModelPack({
    model: { id: "material-process-history", name: "Material Process History", version, description: "A source-locked NIST AM-Bench case preserving nominal recipe, native build and part identities, in-situ thermal products, ex-situ residual strain, and analysis boundaries as separate layers.", status: "external-source-locked-material-history-case" },
    source: { id: `material-process-history-${artifact.source.identity.slice(7, 23)}`, files: [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/material-process-history/${file.path}`, hash: file.identity })), auditHash: hashCanonical(AUDIT_DOMAIN, audit) },
    nodes,
    edges,
    dictionaries: canonicalClone({
      provenance: { benchmarkId: artifact.source.benchmarkId, challengeDescriptionDoi: artifact.source.challengeDescriptionDoi, measurementResultsDoi: artifact.source.measurementResultsDoi, measurementResultsVersion: artifact.source.measurementResultsVersion, metadataRelease: artifact.source.metadataRelease, metadataRepositoryCommit: artifact.source.metadataRepositoryCommit, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: MATERIAL_PROCESS_HISTORY_MAPPING_VERSION },
      evidenceClasses: {
        "source-locked-projection": "A deterministic projection from exact NIST metadata and measurement-result files.",
        "native-build-record": "A native NIST AMBuild identifier and PID.",
        "nominal-recipe-equality": "Equality only across the selected prescribed P3 recipe fields.",
        "native-output-link": "A source-declared process-to-build output link, without generated causality.",
        "native-parent-link": "A source-declared build-to-part parent link.",
        "native-process-link": "A source-declared thermography-to-build-process association.",
        "source-declared-derivation": "A source-declared TAM or SCR artifact reference derived from thermography.",
        "native-target-attribution": "The published measurement description names B7-P3 as the residual-strain target.",
        "deterministic-coordinate-summary": "A reproducible height summary over exact retained source coordinates.",
        "resolved-identity-class": "The selected part has a resolved class under this explicit equivalence key.",
        "unresolved-measured-state": "No selected residual-strain measurement resolves this sibling part.",
        "explicit-non-claim": "A boundary preventing causal, completeness, correction, or Historical Load promotion."
      },
      presentation: {
        profile: "material-process-history-presentation-v1",
        nodeKindField: "entityKind",
        relationField: "relation",
        layerField: "phase",
        evidenceClassField: "evidenceClass",
        labels: { catalogTitle: "Material process evidence", searchPlaceholder: "Search builds, parts, process records, measurements, and boundaries", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming evidence relations", children: "Outgoing evidence relations" },
        coordinates: [{ field: "typeRole", label: "Kind" }, { field: "evidenceStatus", label: "Evidence" }],
        boundary: { title: "Nominal recipe / specimen / measured-state boundary", summary: "Recipe equality does not merge build or part identity, and one measured B7-P3 field does not supply sibling states.", note: "Thermography and residual strain stay separate; association is not causality; source anomalies stay literal; Historical Load remains undefined." }
      },
      audit
    })
  });
}
