const CASE_IDENTITY = "sha256:3a56371445a7b1b9e18da9fbff2dbe0d8ace1d289ef519998a4cf90aa4dd5889";
const SOURCE_IDENTITY = "sha256:a481e70fe9ee95c0f11cd3fb3d7caf27c6675ccb4a0d21c664aa17fe9c27e6af";
const SNAPSHOT_IDENTITY = "sha256:9b8bcc4ce6d3afa5598e0239150b230857811a72d6886e6bbddfb45d51b2a580";
const BUILD_IDS = Object.freeze(["AMB2022-718-AMMT-B6", "AMB2022-718-AMMT-B7", "AMB2022-718-AMMT-B8"]);
const COMPONENTS = Object.freeze(["XX", "ZZ"]);
const REGIMES = Object.freeze(["nominal-material", "nominal-recipe", "build-record", "part-record", "measured-state"]);

function fail(message) { throw new TypeError(`Material Process History model rejected the artifact: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; }
function heightKey(value) {
  const height = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(height)) fail(`unknown height slice ${value}`);
  return height;
}

export function createMaterialProcessHistoryModel(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) fail("artifact must be an object");
  if (artifact.format !== "onto2d-material-process-history-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "ambench-2022-01-material-process-interpretation-v1") fail("format or version differs");
  if (artifact.caseIdentity !== CASE_IDENTITY || artifact.source?.identity !== SOURCE_IDENTITY || artifact.source.snapshotIdentity !== SNAPSHOT_IDENTITY) fail("case or source release differs");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.metadataRelease !== "3.0.0" || artifact.source.metadataRepositoryCommit !== "77adb06c6de95b9b97e1dd26d46561f29db927af" || artifact.source.measurementResultsDoi !== "10.18434/mds2-2711") fail("source lock differs");
  if (!same([artifact.cohort?.buildCount, artifact.cohort?.comparisonPartCount, artifact.cohort?.thermographyRecordCount, artifact.cohort?.measuredPartCount, artifact.cohort?.unresolvedMeasuredStateCount], [3, 3, 3, 1, 2]) || artifact.cohort.completeProcessSpaceClaim !== false) fail("cohort boundary differs");
  if (!Array.isArray(artifact.builds) || !same(artifact.builds.map(({ id }) => id), BUILD_IDS) || new Set(artifact.builds.map(({ identity }) => identity)).size !== 3 || new Set(artifact.builds.map(({ comparisonPart }) => comparisonPart.identity)).size !== 3 || new Set(artifact.builds.map(({ process }) => process.recipeIdentity)).size !== 1) fail("build, part, or recipe identity differs");
  const { identity: recipeIdentity, ...recipe } = artifact.recipe ?? {};
  const expectedScrDois = ["10.18434/mds2-2720", "10.18434/mds2-2721", "10.18434/mds2-2722"];
  for (const [index, build] of artifact.builds.entries()) {
    const shortId = build.id.slice(-2);
    if (build.process?.outputBuildId !== build.id || build.process.p3ComponentProcessId !== `${build.id}-P3_PBF-LB_Component` || build.process.recipeIdentity !== recipeIdentity || !same(build.process.recipe, recipe) || build.comparisonPart?.id !== `${build.id}-P3` || build.comparisonPart.componentId !== `${build.id}-P3_Component` || build.comparisonPart.parentPid !== build.pid || build.thermography?.id !== `AMB2022_Thermography_718-AMMT-${shortId}-P1-StaringCamera_Signal` || build.thermography.buildProcessId !== build.process.id || build.thermography.componentProcessId !== `${build.id}-P1_PBF-LB_Component`) fail(`${build.id} provenance link differs`);
    if (build.thermography.frameRate?.value !== 8333 || build.thermography.frameRate.unit !== "Hz" || build.thermography.bitDepth !== 12 || build.thermography.tam?.filename !== `AMB2022-01-718-AMMT-${shortId}-P1-StaringCamera_TAM.h5` || build.thermography.tam.dataDoi !== "10.18434/mds2-2715" || build.thermography.solidCoolingRate?.filename !== "AMB2022-01-718-AMMT-B6-P1-StaringCamera_SCR.h5" || build.thermography.solidCoolingRate.dataDoi !== expectedScrDois[index]) fail(`${build.id} thermography boundary differs`);
  }
  const measurement = artifact.residualStrain;
  if (measurement?.targetPartId !== "AMB2022-718-AMMT-B7-P3" || measurement.technique !== "synchrotron X-ray energy dispersive diffraction" || !same(measurement.components, COMPONENTS) || measurement.strainUnit !== "unitless" || measurement.estimatedMeasurementUncertainty?.value !== 0.0001) fail("residual-strain authority differs");
  if (!Array.isArray(measurement.points) || measurement.points.length !== 2248 || measurement.summary?.pointCount !== 2248 || measurement.summary.uniqueXCount !== 136 || measurement.summary.uniqueYCount !== 1 || measurement.summary.uniqueZCount !== 24 || measurement.summary.heightSlices?.length !== 24) fail("residual-strain inventory differs");
  const coordinates = new Set();
  const sliceCounts = new Map();
  for (const [index, point] of measurement.points.entries()) {
    if (point.sourceRow !== index + 2 || point.yMm !== 2.5 || ![point.xMm, point.zMm, point.xxStrain, point.zzStrain].every(finite)) fail(`strain point ${index} differs`);
    const key = `${point.xMm}|${point.yMm}|${point.zMm}`;
    if (coordinates.has(key)) fail(`strain point ${index} coordinate repeats`);
    coordinates.add(key);
    sliceCounts.set(point.zMm, (sliceCounts.get(point.zMm) ?? 0) + 1);
  }
  if (!same([measurement.summary.xx.minimum.value, measurement.summary.xx.maximum.value, measurement.summary.zz.minimum.value, measurement.summary.zz.maximum.value], [-0.003471, 0.003146, -0.004296, 0.004087])) fail("strain extrema differ");
  if (!same(measurement.summary.heightSlices.map(({ zMm, pointCount }) => [zMm, pointCount]), [...sliceCounts.entries()].sort(([left], [right]) => left - right))) fail("strain height slices differ");
  if (!same(artifact.identityRegimes?.map(({ id, classes, unresolved }) => [id, classes.length, unresolved.length]), [["nominal-material", 1, 0], ["nominal-recipe", 1, 0], ["build-record", 3, 0], ["part-record", 3, 0], ["measured-state", 1, 2]])) fail("identity regimes differ");
  const partIds = artifact.builds.map(({ comparisonPart }) => comparisonPart.id);
  const expectedMembers = [[partIds], [partIds], partIds.map((id) => [id]), partIds.map((id) => [id]), [[partIds[1]]]];
  for (const [index, regime] of artifact.identityRegimes.entries()) {
    if (!same(regime.classes.map(({ members }) => members), expectedMembers[index]) || !same(regime.unresolved, index === 4 ? [partIds[0], partIds[2]] : [])) fail(`${regime.id} membership differs`);
  }
  if (!same(artifact.sourceAnomalies?.map(({ id }) => id), ["repeated-scr-filename", "recorded-date-semantics"]) || artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("analysis boundary differs");
  if (artifact.audit?.missingSiblingMeasurementsCopied !== 0 || artifact.audit.sourceFilenameCorrectionsInvented !== 0 || artifact.audit.causalEdges !== 0 || artifact.audit.completeProcessSpaceClaims !== 0 || artifact.audit.liveQueriesDuringBuild !== 0) fail("epistemic audit differs");

  const builds = new Map(artifact.builds.map((build) => [build.id, build]));
  const regimes = new Map(artifact.identityRegimes.map((regime) => [regime.id, regime]));
  const slices = new Map(measurement.summary.heightSlices.map((slice) => [slice.zMm, slice]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    source: artifact.source,
    methodology: artifact.methodology,
    cohort: artifact.cohort,
    recipe: artifact.recipe,
    builds: artifact.builds,
    buildIds: BUILD_IDS,
    components: COMPONENTS,
    residualStrain: measurement,
    identityRegimes: artifact.identityRegimes,
    experiments: artifact.experiments,
    sourceAnomalies: artifact.sourceAnomalies,
    historicalLoad: artifact.historicalLoad,
    nonClaims: artifact.nonClaims,
    audit: artifact.audit,
    build(buildId) { const value = builds.get(buildId); if (!value) fail(`unknown build ${buildId}`); return value; },
    regime(regimeId) { const value = regimes.get(regimeId); if (!value) fail(`unknown identity regime ${regimeId}`); return value; },
    slice(zMm) { const value = slices.get(heightKey(zMm)); if (!value) fail(`unknown height slice ${zMm}`); return value; },
    points(component = "XX", zMm = null) {
      if (!COMPONENTS.includes(component)) fail(`unknown strain component ${component}`);
      const field = component === "XX" ? "xxStrain" : "zzStrain";
      const height = zMm === null ? null : heightKey(zMm);
      const selected = height === null ? measurement.points : measurement.points.filter((point) => point.zMm === height);
      if (height !== null && !slices.has(height)) fail(`unknown height slice ${zMm}`);
      return freeze(selected.map((point) => ({ sourceRow: point.sourceRow, xMm: point.xMm, yMm: point.yMm, zMm: point.zMm, value: point[field] })));
    }
  });
}
