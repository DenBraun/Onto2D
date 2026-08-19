const APPROVED_CASE_IDENTITY = "sha256:6aa7196a4aa160eecf1938e829ee92342ac4c09263e9a0570d3699f157b64bf0";
const APPROVED_SOURCE_IDENTITY = "sha256:2016f4af212355295dbf99be714e9aafaffc6bd248bdb55c5ac440e260ae6a97";
const PROFILE_IDS = Object.freeze(["cold-rotating-metal-rich", "alpha-raised-intermediate", "radial-metal-poor", "counter-rotating-metal-poor"]);
const QUALITY_IDS = Object.freeze(["medium", "high"]);

function fail(message) { throw new TypeError(`Galactic Archaeology artifact rejected: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function validInterval(value) { return object(value) && Number.isFinite(value.point) && Number.isFinite(value.lower) && Number.isFinite(value.upper) && value.lower <= value.point && value.point <= value.upper && typeof value.unit === "string"; }
function validMeasurement(value) { return object(value) && (Number.isFinite(value.value) || value.value === null) && (Number.isFinite(value.uncertainty) || value.uncertainty === null) && (value.uncertainty === null || value.uncertainty >= 0) && value.missing === (value.value === null) && (value.value === null) === (value.uncertainty === null) && typeof value.unit === "string" && value.unit.length > 0; }

export function createGalacticArchaeologyModel(input) {
  if (!object(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-galactic-archaeology-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "gaia-dr3-chemical-cartography-interpretation-v1") fail("format or version differs");
  if (artifact.caseIdentity !== APPROVED_CASE_IDENTITY || artifact.source?.identity !== APPROVED_SOURCE_IDENTITY || artifact.source.snapshotIdentity !== "sha256:3f4edace497de66c40116e42c7257b23765c568aaf8448ab38ff5d0580a8b546") fail("case or source release differs");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.executedQueryCount !== 33 || artifact.source.tableLocks?.length !== 3) fail("source lock differs");
  if (artifact.cohort?.sourceCount !== 64 || artifact.cohort.highQualityCount !== 32 || artifact.cohort.mediumOnlyCount !== 32 || artifact.cohort.completePopulationClaim !== false || !same(artifact.cohort.ruleProfiles?.map(({ id }) => id), PROFILE_IDS)) fail("cohort boundary differs");
  if (!Array.isArray(artifact.records) || artifact.records.length !== 64 || new Set(artifact.records.map(({ sourceId }) => sourceId)).size !== 64) fail("stellar-source inventory differs");
  const counts = new Map();
  for (const record of artifact.records) {
    if (!/^\d{10,19}$/.test(record.sourceId ?? "") || !/^sha256:[0-9a-f]{64}$/.test(record.identity ?? "") || !PROFILE_IDS.includes(record.ruleProfileId) || !["high", "medium-only"].includes(record.qualityProfile) || record.assignment?.ruleProfileId !== record.ruleProfileId || record.assignment.nativeGaiaLabel !== false || record.assignment.birthOriginClaim !== false || record.assignment.commonAncestryClaim !== false) fail(`${record.sourceId} assignment boundary differs`);
    const key = `${record.ruleProfileId}:${record.qualityProfile}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (record.observation?.evidenceState !== "gaia-catalogue-observation" || record.gaiaEstimate?.evidenceState !== "gaia-apsis-estimate" || record.publishedOrbit?.evidenceState !== "published-companion-derived") fail(`${record.sourceId} evidence layer differs`);
    for (const field of ["effectiveTemperature", "surfaceGravity", "metallicity", "alphaToIron"]) if (!validInterval(record.gaiaEstimate[field])) fail(`${record.sourceId}.${field} interval differs`);
    for (const field of ["rplane", "radialVelocity", "verticalVelocity", "azimuthalVelocity", "maximumHeight", "eccentricity", "radialAction", "verticalAction", "azimuthalAction"]) if (!validInterval(record.publishedOrbit[field])) fail(`${record.sourceId}.${field} interval differs`);
    for (const measurement of [record.observation?.skyPosition?.ra, record.observation?.skyPosition?.dec, record.observation?.parallax, record.observation?.properMotion?.ra, record.observation?.properMotion?.dec, record.observation?.radialVelocity]) if (!validMeasurement(measurement)) fail(`${record.sourceId} observation measurement differs`);
    if (!Number.isFinite(record.observation?.photometry?.gMeanMagnitude) || !Number.isFinite(record.observation?.photometry?.bpMinusRp) || !Number.isFinite(record.observation?.ruwe) || !Number.isFinite(record.publishedOrbit?.energy?.point) || record.publishedOrbit.energy.unit !== "km2/s2" || !/^\d{13,}$/.test(record.gaiaEstimate?.flags ?? "")) fail(`${record.sourceId} scalar estimate differs`);
  }
  if ([...counts.values()].some((count) => count !== 8) || counts.size !== 8) fail("quality/profile balance differs");
  if (!same(artifact.qualityAblation?.strict?.summaries.map(({ sourceCount, patternSurvives }) => [sourceCount, patternSurvives]), Array(4).fill([8, true])) || artifact.qualityAblation.baseline.sourceCount !== 64 || artifact.qualityAblation.strict.sourceCount !== 32 || artifact.qualityAblation.sourceMutation !== false) fail("quality ablation differs");
  if (!same(artifact.evidenceAblation?.map(({ regime, historicalInterpretationStatus }) => [regime, historicalInterpretationStatus]), [["observed-only", "unresolved"], ["observed-plus-gaia-derived", "unresolved"], ["through-published-derived", "withheld"], ["full-bounded-context", "candidate-compatibility-only"]])) fail("evidence ablation differs");
  if (artifact.historicalInterpretations?.some((item) => item.status !== "compatible-pattern-only" || item.recoveredBirthOrigin || item.commonAncestryClaim || item.singleFormationHistoryClaim) || artifact.reconstruction?.trueFormationHistoryRecovered || artifact.reconstruction?.alternativeInterpretationsAllowed !== true) fail("historical interpretation boundary differs");
  if (artifact.audit?.directObservationOrbitPromotions !== 0 || artifact.audit.nativeGaiaPopulationLabelsInvented !== 0 || artifact.audit.birthOriginClaims !== 0 || artifact.audit.commonAncestryClaims !== 0 || artifact.audit.liveQueriesDuringBuild !== 0) fail("epistemic audit differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");

  const records = new Map(artifact.records.map((record) => [record.sourceId, record]));
  const profiles = new Map(artifact.cohort.ruleProfiles.map((profile) => [profile.id, profile]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    retrievedAt: artifact.source.retrievedAt,
    source: artifact.source,
    methodology: artifact.methodology,
    cohort: artifact.cohort,
    profileIds: PROFILE_IDS,
    qualityIds: QUALITY_IDS,
    records: artifact.records,
    qualityAblation: artifact.qualityAblation,
    evidenceAblation: artifact.evidenceAblation,
    interpretations: artifact.historicalInterpretations,
    reconstruction: artifact.reconstruction,
    historicalLoad: artifact.historicalLoad,
    audit: artifact.audit,
    record(sourceId) { const value = records.get(String(sourceId)); if (!value) fail(`unknown source ${sourceId}`); return value; },
    profile(profileId) { const value = profiles.get(profileId); if (!value) fail(`unknown profile ${profileId}`); return value; },
    select({ quality = "medium", profile = "all" } = {}) {
      if (!QUALITY_IDS.includes(quality)) fail(`unknown quality ${quality}`);
      if (profile !== "all" && !PROFILE_IDS.includes(profile)) fail(`unknown profile ${profile}`);
      return freeze(artifact.records.filter((record) => (quality === "medium" || record.qualityProfile === "high") && (profile === "all" || record.ruleProfileId === profile)));
    },
    summaries(quality = "medium") { if (!QUALITY_IDS.includes(quality)) fail(`unknown quality ${quality}`); return quality === "medium" ? artifact.qualityAblation.baseline.summaries : artifact.qualityAblation.strict.summaries; }
  });
}
