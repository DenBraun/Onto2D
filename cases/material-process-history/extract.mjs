import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, "artifacts", "material-process-history.json");
const CASE_DOMAIN = "onto2d:material-process-history-case:v1";
const SOURCE_DOMAIN = "onto2d:material-process-history-source:v1";
const BUILD_DOMAIN = "onto2d:material-process-history-build:v1";
const PROCESS_DOMAIN = "onto2d:material-process-history-process:v1";
const PART_DOMAIN = "onto2d:material-process-history-part:v1";
const MEASUREMENT_DOMAIN = "onto2d:material-process-history-measurement:v1";
const APPROVED_CASE_IDENTITY = "sha256:3a56371445a7b1b9e18da9fbff2dbe0d8ace1d289ef519998a4cf90aa4dd5889";
const BUILD_IDS = Object.freeze(["AMB2022-718-AMMT-B6", "AMB2022-718-AMMT-B7", "AMB2022-718-AMMT-B8"]);
const HASH = /^[0-9a-f]{64}$/;

function fail(message) { throw new Error(`Material Process History extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) {
  return `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`;
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function finite(value, label) { if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be finite`); return value; }
function exactKeys(value, expected, label) { if (!isObject(value) || !same(Object.keys(value).sort(), [...expected].sort())) fail(`${label} fields differ`); }

async function loadBytes(relative, maximumBytes = 1024 * 1024) {
  const bytes = await readFile(path.join(ROOT, relative));
  if (bytes.length < 1 || bytes.length > maximumBytes) fail(`${relative} is empty or exceeds ${maximumBytes} bytes`);
  return { relative, bytes };
}

async function loadJson(relative, maximumBytes = 1024 * 1024) {
  const input = await loadBytes(relative, maximumBytes);
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)); } catch { fail(`${relative} is not valid UTF-8 JSON`); }
  return { ...input, value };
}

function validateQuantity(value, expectedUnit, label) {
  exactKeys(value, ["value", "unit"], label);
  finite(value.value, `${label}.value`);
  if (value.unit !== expectedUnit) fail(`${label}.unit differs`);
  return value;
}

function validateUpstream(upstream, sourceInput, generatorInput) {
  exactKeys(upstream, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "source", "metadataRelease", "measurementDescription", "projectionGenerator", "snapshot", "selection"], "upstream lock");
  if (upstream.format !== "onto2d-material-process-history-upstream-lock" || upstream.formatVersion !== "1" || upstream.retrievedAt !== "2026-08-19T08:27:00Z" || upstream.liveNetworkRequiredByBuild !== false) fail("upstream release boundary differs");
  if (upstream.source?.publisher !== "National Institute of Standards and Technology" || upstream.source.benchmarkId !== "AMB2022-01" || upstream.source.challengeDescriptionDoi !== "10.18434/mds2-2607" || upstream.source.measurementResultsDoi !== "10.18434/mds2-2711" || upstream.source.measurementResultsVersion !== "1.1.1") fail("NIST source lock differs");
  if (upstream.metadataRelease?.repository !== "https://github.com/usnistgov/ambench" || upstream.metadataRelease.commit !== "77adb06c6de95b9b97e1dd26d46561f29db927af" || upstream.metadataRelease.version !== "3.0.0" || upstream.metadataRelease.archiveBytes !== 19411844 || upstream.metadataRelease.archiveSha256 !== "0e2f673d6be7b700a9e14e461fab78a6372b9472ba230ff22c638dadee822d8c") fail("metadata release lock differs");
  if (upstream.measurementDescription?.targetPartId !== "AMB2022-718-AMMT-B7-P3" || upstream.measurementDescription.pointCount !== 2248 || upstream.measurementDescription.uncertainty !== 0.0001 || upstream.measurementDescription.sha256 !== "57f5ff84f22eecc30e8caceaa2a341e74375072305dd0ff010c68c4f506ad0d3") fail("measurement description lock differs");
  if (upstream.snapshot?.path !== sourceInput.relative || upstream.snapshot.sha256 !== sha256(sourceInput.bytes) || upstream.snapshot.bytes !== sourceInput.bytes.length) fail("source snapshot byte lock differs");
  if (upstream.projectionGenerator?.path !== generatorInput.relative || upstream.projectionGenerator.sha256 !== sha256(generatorInput.bytes) || upstream.projectionGenerator.bytes !== generatorInput.bytes.length) fail("projection generator byte lock differs");
  if (!same(upstream.selection?.buildIds, BUILD_IDS) || upstream.selection.residualStrainPointCount !== 2248 || upstream.selection.completeProcessSpaceClaim !== false) fail("selection lock differs");
  return upstream;
}

function validateRecipe(recipe, label = "shared nominal recipe") {
  const expected = {
    processType: "LaserPowderBedFusion", facility: "NIST", machine: "AMMT", feedstockId: "K201801_Virgin", feedstockCondition: "Virgin",
    atmosphere: "argon", gasFlowDirection: "-Y", recoatingDirection: "+X", totalLayers: 312,
    scanDataUrl: "https://data.nist.gov/od/ds/ark:/88434/mds2-2607/Scan_Strategy/AMB2022-01-AMMT-XYPT_v1.h5"
  };
  for (const [key, value] of Object.entries(expected)) if (recipe?.[key] !== value) fail(`${label}.${key} differs`);
  if (!/IN718$/.test(recipe.materialClass ?? "")) fail(`${label}.materialClass differs`);
  const quantities = [
    ["substrateTemperature", "Centigrade", 20], ["oxygenContentLimit", "ppm", 500], ["buildChamberPressure", "kPa", 95],
    ["gasFlowSpeed", "m/s", 4.3], ["recoatingSpeed", "mm/s", 75], ["nominalLaserPower", "W", 285],
    ["nominalScanSpeed", "mm/s", 960], ["beamSpotSize", "mm", 0.077], ["nominalLayerThickness", "mm", 0.04], ["hatchSpacing", "mm", 0.11]
  ];
  for (const [key, unit, point] of quantities) if (validateQuantity(recipe[key], unit, `${label}.${key}`).value !== point) fail(`${label}.${key}.value differs`);
  return recipe;
}

function validateThermography(record, buildId) {
  const short = buildId.slice(-2);
  if (record?.id !== `AMB2022_Thermography_718-AMMT-${short}-P1-StaringCamera_Signal` || record.buildProcessId !== `${buildId}_PBF-LB` || record.componentProcessId !== `${buildId}-P1_PBF-LB_Component` || record.technique !== "staring-camera thermography") fail(`${buildId} thermography identity differs`);
  if (validateQuantity(record.frameRate, "Hz", `${buildId}.frameRate`).value !== 8333 || validateQuantity(record.shutterSpeed, "ns", `${buildId}.shutterSpeed`).value !== 20000 || record.bitDepth !== 12 || record.imageWidthPixels !== 640 || record.imageHeightPixels !== 304) fail(`${buildId} thermography configuration differs`);
  validateQuantity(record.pixelScaleX, "mm/pixel", `${buildId}.pixelScaleX`);
  validateQuantity(record.pixelScaleY, "mm/pixel", `${buildId}.pixelScaleY`);
  if (record.tam?.filename !== `AMB2022-01-718-AMMT-${short}-P1-StaringCamera_TAM.h5` || record.tam.dataDoi !== "10.18434/mds2-2715" || record.tam.emissivity !== 0.5 || validateQuantity(record.tam.thresholdTemperature, "°C", `${buildId}.tam.threshold`).value !== 1298) fail(`${buildId} TAM metadata differs`);
  const expectedDoi = { B6: "10.18434/mds2-2720", B7: "10.18434/mds2-2721", B8: "10.18434/mds2-2722" }[short];
  if (record.solidCoolingRate?.filename !== "AMB2022-01-718-AMMT-B6-P1-StaringCamera_SCR.h5" || record.solidCoolingRate.dataDoi !== expectedDoi || record.solidCoolingRate.unit !== "°C/s" || record.solidCoolingRate.emissivity !== 0.5) fail(`${buildId} source-literal SCR metadata differs`);
  if (validateQuantity(record.solidCoolingRate.solidusTemperature, "°C", `${buildId}.scr.solidus`).value !== 1260 || validateQuantity(record.solidCoolingRate.temperatureInterval, "°C", `${buildId}.scr.delta`).value !== 110) fail(`${buildId} SCR derivation metadata differs`);
}

function validateSource(source, upstream) {
  exactKeys(source, ["format", "formatVersion", "profileVersion", "source", "selection", "inputFiles", "sharedNominalRecipe", "builds", "residualStrain", "sourceAnomalies", "evidenceBoundary"], "source projection");
  if (source.format !== "onto2d-ambench-material-process-projection" || source.formatVersion !== "1" || source.profileVersion !== upstream.selection.profile) fail("source projection version differs");
  if (source.source?.metadataRepositoryCommit !== upstream.metadataRelease.commit || source.source.metadataArchiveSha256 !== upstream.metadataRelease.archiveSha256 || source.source.measurementResultsDoi !== upstream.source.measurementResultsDoi || source.source.measurementResultsVersion !== upstream.source.measurementResultsVersion) fail("projection authority differs");
  if (!same(source.selection?.buildIds, BUILD_IDS) || source.selection.residualStrainTarget !== "AMB2022-718-AMMT-B7-P3" || source.selection.completeProcessSpaceClaim !== false || source.selection.causalEffectClaim !== false) fail("projection selection differs");
  if (!Array.isArray(source.inputFiles) || source.inputFiles.length !== 14 || source.inputFiles.some((file) => typeof file.path !== "string" || !HASH.test(file.sha256 ?? "") || !Number.isInteger(file.bytes) || file.bytes < 1)) fail("source input-file inventory differs");
  validateRecipe(source.sharedNominalRecipe);
  if (!Array.isArray(source.builds) || source.builds.length !== 3) fail("build inventory differs");
  const pids = new Set();
  for (const [index, build] of source.builds.entries()) {
    const buildId = BUILD_IDS[index];
    if (build.id !== buildId || pids.has(build.pid) || build.benchmarkId !== "AMB2022-01" || !/IN718$/.test(build.materialClass ?? "") || build.componentIds?.length !== 6) fail(`${buildId} record differs`);
    pids.add(build.pid);
    if (build.process?.id !== `${buildId}_PBF-LB` || build.process.outputBuildId !== buildId || build.process.p3ComponentProcessId !== `${buildId}-P3_PBF-LB_Component` || !same(build.process.recipe, source.sharedNominalRecipe)) fail(`${buildId} process link or recipe differs`);
    if (build.comparisonPart?.id !== `${buildId}-P3` || build.comparisonPart.componentId !== `${buildId}-P3_Component` || build.comparisonPart.parentPid !== build.pid || !/IN718$/.test(build.comparisonPart.materialClass ?? "") || build.comparisonPart.condition !== null) fail(`${buildId} P3 record differs`);
    validateThermography(build.thermography, buildId);
  }
  const measurement = source.residualStrain;
  if (measurement?.targetPartId !== "AMB2022-718-AMMT-B7-P3" || measurement.technique !== "synchrotron X-ray energy dispersive diffraction" || measurement.strainUnit !== "unitless" || !same(measurement.components, ["XX", "ZZ"]) || measurement.estimatedMeasurementUncertainty?.value !== 0.0001) fail("residual-strain authority differs");
  if (!Array.isArray(measurement.points) || measurement.points.length !== 2248 || measurement.summary?.pointCount !== 2248 || measurement.summary.uniqueXCount !== 136 || measurement.summary.uniqueYCount !== 1 || measurement.summary.uniqueZCount !== 24 || measurement.summary.heightSlices?.length !== 24) fail("residual-strain census differs");
  const coordinates = new Set();
  for (const [index, point] of measurement.points.entries()) {
    exactKeys(point, ["sourceRow", "xMm", "yMm", "zMm", "xxStrain", "zzStrain"], `strain point ${index}`);
    if (point.sourceRow !== index + 2 || point.yMm !== 2.5) fail(`strain point ${index} source location differs`);
    for (const key of ["xMm", "yMm", "zMm", "xxStrain", "zzStrain"]) finite(point[key], `strain point ${index}.${key}`);
    const key = `${point.xMm}|${point.yMm}|${point.zMm}`;
    if (coordinates.has(key)) fail(`strain point ${index} coordinate repeats`);
    coordinates.add(key);
  }
  if (measurement.summary.xx.minimum.value !== -0.003471 || measurement.summary.xx.maximum.value !== 0.003146 || measurement.summary.zz.minimum.value !== -0.004296 || measurement.summary.zz.maximum.value !== 0.004087) fail("residual-strain extrema differ");
  if (!same(source.sourceAnomalies?.map(({ id }) => id), ["repeated-scr-filename", "recorded-date-semantics"])) fail("source anomaly inventory differs");
  if (!same(source.evidenceBoundary, { sameNominalRecipeMergesBuildIdentity: false, sameMaterialClassMergesPartIdentity: false, thermographyPromotedToResidualStrain: false, residualStrainPromotedToCausalEffect: false, missingMeasurementCopiedAcrossSiblingParts: false, sourceFilenameCorrectedWithoutAuthority: false, measurementCoordinatesRetained: true, measurementUncertaintyRetained: true })) fail("source evidence boundary differs");
  return source;
}

function validateProfile(profile) {
  exactKeys(profile, ["format", "formatVersion", "profileVersion", "question", "evidenceLayers", "identityRegimes", "historicalLoad", "interpretationPolicy", "nonClaims"], "analysis profile");
  if (profile.format !== "onto2d-material-process-history-analysis-profile" || profile.formatVersion !== "1" || profile.profileVersion !== "ambench-2022-01-material-process-interpretation-v1") fail("analysis profile version differs");
  if (!same(profile.evidenceLayers.map(({ id }) => id), ["source-record", "prescribed-process", "in-situ-derived", "ex-situ-measured", "onto2d-analysis"])) fail("evidence layer order differs");
  if (!same(profile.identityRegimes.map(({ id }) => id), ["nominal-material", "nominal-recipe", "build-record", "part-record", "measured-state"]) || !same(profile.identityRegimes.map(({ expectedClassCount }) => expectedClassCount), [1, 1, 3, 3, 1]) || profile.identityRegimes.at(-1).unresolvedCount !== 2) fail("identity regime contract differs");
  if (profile.historicalLoad?.status !== "not-evaluated" || profile.historicalLoad.value !== null || !/undefined must not be displayed as zero/.test(profile.historicalLoad.reason ?? "")) fail("Historical Load boundary differs");
  if (profile.interpretationPolicy?.status !== "measured-association-only" || Object.entries(profile.interpretationPolicy).some(([key, value]) => key !== "status" && value !== false)) fail("interpretation policy differs");
  if (!Array.isArray(profile.nonClaims) || profile.nonClaims.length !== 12 || new Set(profile.nonClaims).size !== 12) fail("non-claim inventory differs");
  return profile;
}

function identityRegimes(source, profile, recipeIdentity, measurementIdentity) {
  const parts = source.builds.map((build) => build.comparisonPart.id);
  return profile.identityRegimes.map((regime) => {
    if (regime.id === "nominal-material") return { ...regime, classes: [{ id: "class:in718", members: parts, basis: source.sharedNominalRecipe.materialClass }], unresolved: [] };
    if (regime.id === "nominal-recipe") return { ...regime, classes: [{ id: `class:${recipeIdentity.slice(7, 23)}`, members: parts, basis: recipeIdentity }], unresolved: [] };
    if (regime.id === "build-record") return { ...regime, classes: source.builds.map((build) => ({ id: `class:${build.id}`, members: [build.comparisonPart.id], basis: build.id })), unresolved: [] };
    if (regime.id === "part-record") return { ...regime, classes: parts.map((id) => ({ id: `class:${id}`, members: [id], basis: id })), unresolved: [] };
    return { ...regime, classes: [{ id: `class:${measurementIdentity.slice(7, 23)}`, members: [source.residualStrain.targetPartId], basis: measurementIdentity }], unresolved: parts.filter((id) => id !== source.residualStrain.targetPartId) };
  });
}

export async function buildMaterialProcessHistoryCase() {
  const [sourceInput, upstreamInput, profileInput, generatorInput] = await Promise.all([
    loadJson("source/ambench-2022-01-material-process.json"),
    loadJson("upstream.json", 128 * 1024),
    loadJson("analysis-profile.json", 128 * 1024),
    loadBytes("prepare-source.py", 128 * 1024)
  ]);
  const upstream = validateUpstream(upstreamInput.value, sourceInput, generatorInput);
  const source = validateSource(sourceInput.value, upstream);
  const profile = validateProfile(profileInput.value);
  const sourceBasis = { snapshotIdentity: `sha256:${sha256(sourceInput.bytes)}`, upstream, provider: source.source };
  const recipeIdentity = hashCanonical(PROCESS_DOMAIN, source.sharedNominalRecipe);
  const builds = source.builds.map((build) => {
    const buildIdentity = hashCanonical(BUILD_DOMAIN, { id: build.id, pid: build.pid, recordedCreationDate: build.recordedCreationDate, status: build.status });
    const processIdentity = hashCanonical(PROCESS_DOMAIN, { id: build.process.id, pid: build.process.pid, outputBuildId: build.process.outputBuildId, recipeIdentity });
    const partIdentity = hashCanonical(PART_DOMAIN, { id: build.comparisonPart.id, pid: build.comparisonPart.pid, parentPid: build.comparisonPart.parentPid, componentId: build.comparisonPart.componentId });
    const thermographyIdentity = hashCanonical(MEASUREMENT_DOMAIN, build.thermography);
    return { ...build, identity: buildIdentity, process: { ...build.process, identity: processIdentity, recipeIdentity }, comparisonPart: { ...build.comparisonPart, identity: partIdentity }, thermography: { ...build.thermography, identity: thermographyIdentity } };
  });
  const measurementIdentity = hashCanonical(MEASUREMENT_DOMAIN, source.residualStrain);
  const regimes = identityRegimes(source, profile, recipeIdentity, measurementIdentity);
  const artifactBasis = {
    format: "onto2d-material-process-history-case",
    formatVersion: "1",
    caseVersion: profile.profileVersion,
    source: {
      identity: hashCanonical(SOURCE_DOMAIN, sourceBasis),
      snapshotIdentity: sourceBasis.snapshotIdentity,
      snapshotBytes: sourceInput.bytes.length,
      retrievedAt: upstream.retrievedAt,
      benchmarkId: source.source.benchmarkId,
      challengeDescriptionDoi: source.source.challengeDescriptionDoi,
      measurementResultsDoi: source.source.measurementResultsDoi,
      measurementResultsVersion: source.source.measurementResultsVersion,
      metadataRelease: source.source.metadataRelease,
      metadataRepositoryCommit: source.source.metadataRepositoryCommit,
      metadataArchiveSha256: source.source.metadataArchiveSha256,
      liveNetworkRequiredByBuild: false,
      authoredFiles: [
        { path: upstreamInput.relative, identity: `sha256:${sha256(upstreamInput.bytes)}`, bytes: upstreamInput.bytes.length },
        { path: profileInput.relative, identity: `sha256:${sha256(profileInput.bytes)}`, bytes: profileInput.bytes.length },
        { path: generatorInput.relative, identity: `sha256:${sha256(generatorInput.bytes)}`, bytes: generatorInput.bytes.length }
      ],
      snapshotFiles: [{ path: sourceInput.relative, identity: `sha256:${sha256(sourceInput.bytes)}`, bytes: sourceInput.bytes.length }],
      inputFiles: source.inputFiles
    },
    methodology: {
      question: profile.question,
      selectionProfile: source.profileVersion,
      analysisProfile: profile.profileVersion,
      selectionRule: source.selection.rule,
      evidenceLayers: profile.evidenceLayers,
      interpretationPolicy: profile.interpretationPolicy
    },
    cohort: { buildCount: 3, comparisonPartCount: 3, thermographyRecordCount: 3, measuredPartCount: 1, unresolvedMeasuredStateCount: 2, residualStrainPointCount: 2248, residualStrainHeightSliceCount: 24, sharedNominalMaterialClass: true, sharedNominalRecipe: true, completeProcessSpaceClaim: false },
    recipe: { identity: recipeIdentity, ...source.sharedNominalRecipe },
    builds,
    residualStrain: { ...source.residualStrain, identity: measurementIdentity },
    identityRegimes: regimes,
    experiments: [
      { id: "same-recipe-distinct-builds", result: "The three P3 parts occupy one nominal-material class and one nominal-recipe class, but three build-record and three part-record classes.", sourceMutation: false, causalClaim: false },
      { id: "measurement-coverage", result: "The selected residual-strain field resolves measured-state evidence for B7-P3 only; B6-P3 and B8-P3 remain unresolved.", sourceMutation: false, copiedMeasurementCount: 0 },
      { id: "spatial-field", result: "The B7-P3 XX and ZZ components vary across 2,248 retained coordinates; the present measurement is a spatial field, not one scalar state label.", sourceMutation: false, coordinateCount: 2248 },
      { id: "source-anomaly", result: "The repeated B6 SCR filename in B7/B8 metadata remains visible and is not silently repaired from surrounding identifiers.", sourceMutation: false, inventedCorrectionCount: 0 }
    ],
    historicalLoad: profile.historicalLoad,
    sourceAnomalies: source.sourceAnomalies,
    nonClaims: profile.nonClaims,
    audit: { nativeBuildIdsRetained: 3, nativePartIdsRetained: 3, nativeProcessIdsRetained: 3, thermographyRecordsRetained: 3, strainCoordinatesRetained: 2248, strainComponentsRetained: 4496, measurementUncertaintyRetained: true, missingSiblingMeasurementsCopied: 0, sourceFilenameCorrectionsInvented: 0, causalEdges: 0, completeProcessSpaceClaims: 0, liveQueriesDuringBuild: 0 }
  };
  return Object.freeze({ ...artifactBasis, caseIdentity: hashCanonical(CASE_DOMAIN, artifactBasis) });
}

export function verifyMaterialProcessHistoryCaseIdentity(artifact) {
  if (!isObject(artifact)) fail("artifact must be an object");
  const { caseIdentity, ...basis } = artifact;
  const computed = hashCanonical(CASE_DOMAIN, basis);
  if (caseIdentity !== computed) fail(`case identity mismatch: expected ${computed}, received ${caseIdentity}`);
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved release`);
  if (artifact.format !== "onto2d-material-process-history-case" || artifact.caseVersion !== "ambench-2022-01-material-process-interpretation-v1" || artifact.source?.liveNetworkRequiredByBuild !== false || artifact.cohort?.residualStrainPointCount !== 2248 || artifact.builds?.length !== 3) fail("artifact release boundary differs");
  const { identity: recipeIdentity, ...recipe } = artifact.recipe ?? {};
  validateRecipe(recipe, "artifact recipe");
  if (recipeIdentity !== hashCanonical(PROCESS_DOMAIN, recipe)) fail("artifact recipe identity differs");
  const buildIdentities = new Set();
  const partIdentities = new Set();
  for (const [index, build] of artifact.builds.entries()) {
    const expectedId = BUILD_IDS[index];
    if (build.id !== expectedId || build.identity !== hashCanonical(BUILD_DOMAIN, { id: build.id, pid: build.pid, recordedCreationDate: build.recordedCreationDate, status: build.status })) fail(`${expectedId} artifact build identity differs`);
    if (build.process?.recipeIdentity !== recipeIdentity || build.process.identity !== hashCanonical(PROCESS_DOMAIN, { id: build.process.id, pid: build.process.pid, outputBuildId: build.process.outputBuildId, recipeIdentity })) fail(`${expectedId} artifact process identity differs`);
    if (build.comparisonPart?.id !== `${expectedId}-P3` || build.comparisonPart.identity !== hashCanonical(PART_DOMAIN, { id: build.comparisonPart.id, pid: build.comparisonPart.pid, parentPid: build.comparisonPart.parentPid, componentId: build.comparisonPart.componentId })) fail(`${expectedId} artifact part identity differs`);
    const { identity: thermographyIdentity, ...thermography } = build.thermography ?? {};
    validateThermography(thermography, expectedId);
    if (thermographyIdentity !== hashCanonical(MEASUREMENT_DOMAIN, thermography)) fail(`${expectedId} artifact thermography identity differs`);
    buildIdentities.add(build.identity);
    partIdentities.add(build.comparisonPart.identity);
  }
  if (buildIdentities.size !== 3 || partIdentities.size !== 3) fail("artifact build or part identities were merged");
  const { identity: measurementIdentity, ...measurement } = artifact.residualStrain ?? {};
  if (measurementIdentity !== hashCanonical(MEASUREMENT_DOMAIN, measurement) || measurement.targetPartId !== "AMB2022-718-AMMT-B7-P3" || measurement.points?.length !== 2248 || measurement.summary?.uniqueZCount !== 24 || measurement.estimatedMeasurementUncertainty?.value !== 0.0001) fail("artifact residual-strain identity or boundary differs");
  if (!same(artifact.identityRegimes?.map(({ id, classes, unresolved }) => [id, classes.length, unresolved.length]), [["nominal-material", 1, 0], ["nominal-recipe", 1, 0], ["build-record", 3, 0], ["part-record", 3, 0], ["measured-state", 1, 2]])) fail("artifact identity regimes differ");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null || artifact.experiments?.length !== 4 || artifact.nonClaims?.length !== 12 || !same(artifact.sourceAnomalies?.map(({ id }) => id), ["repeated-scr-filename", "recorded-date-semantics"])) fail("artifact analysis boundary differs");
  if (artifact.audit?.causalEdges || artifact.audit?.missingSiblingMeasurementsCopied || artifact.audit?.sourceFilenameCorrectionsInvented || artifact.audit?.liveQueriesDuringBuild) fail("artifact epistemic audit differs");
  return artifact;
}

export async function run({ verify = false } = {}) {
  const artifact = await buildMaterialProcessHistoryCase();
  if (!verify) { await mkdir(path.dirname(OUTPUT), { recursive: true }); await writeFile(OUTPUT, serialize(artifact)); }
  const stored = JSON.parse(await readFile(OUTPUT, "utf8"));
  verifyMaterialProcessHistoryCaseIdentity(stored);
  assert.equal(serialize(stored), serialize(artifact));
  console.log(`${verify ? "Verified" : "Built"} Material Process History ${artifact.caseIdentity}: ${artifact.cohort.buildCount} builds, ${artifact.cohort.residualStrainPointCount} strain points`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
