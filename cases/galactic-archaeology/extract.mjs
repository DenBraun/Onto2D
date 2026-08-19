import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, "artifacts", "galactic-archaeology.json");
const CASE_DOMAIN = "onto2d:galactic-archaeology-case:v1";
const SOURCE_DOMAIN = "onto2d:galactic-archaeology-source:v1";
const RECORD_DOMAIN = "onto2d:galactic-archaeology-record:v1";
const APPROVED_CASE_IDENTITY = "sha256:6aa7196a4aa160eecf1938e829ee92342ac4c09263e9a0570d3699f157b64bf0";
const HASH = /^[0-9a-f]{64}$/;
const PROFILE_IDS = Object.freeze([
  "cold-rotating-metal-rich",
  "alpha-raised-intermediate",
  "radial-metal-poor",
  "counter-rotating-metal-poor"
]);
const INTERVALS = Object.freeze([
  ["teff_gspspec", "teff_gspspec_lower", "teff_gspspec_upper"],
  ["logg_gspspec", "logg_gspspec_lower", "logg_gspspec_upper"],
  ["mh_gspspec", "mh_gspspec_lower", "mh_gspspec_upper"],
  ["alphafe_gspspec", "alphafe_gspspec_lower", "alphafe_gspspec_upper"]
]);
const ORBIT_INTERVALS = Object.freeze(["rplane", "vrplane", "vz", "vphi", "zmax", "ecc", "jr", "jz", "jphi"]);

function fail(message) { throw new Error(`Galactic Archaeology extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function finite(value, label) { if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be finite`); return value; }
function round(value, places = 6) { return Number(value.toFixed(places)); }
function median(values) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function exactKeys(value, expected, label) { if (!isObject(value) || !same(Object.keys(value).sort(), [...expected].sort())) fail(`${label} fields differ`); }

async function loadJson(relative, maximumBytes = 1024 * 1024) {
  const input = await loadBytes(relative, maximumBytes);
  const { bytes } = input;
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { fail(`${relative} is not valid UTF-8 JSON`); }
  return { ...input, value };
}

async function loadBytes(relative, maximumBytes = 1024 * 1024) {
  const bytes = await readFile(path.join(ROOT, relative));
  if (bytes.length < 1 || bytes.length > maximumBytes) fail(`${relative} is empty or exceeds ${maximumBytes} bytes`);
  return { relative, bytes };
}

function validateUpstream(upstream, sourceInput, generatorInput) {
  exactKeys(upstream, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "source", "tables", "paper", "projectionGenerator", "snapshot", "selection"], "upstream lock");
  if (upstream.format !== "onto2d-galactic-archaeology-upstream-lock" || upstream.formatVersion !== "1" || upstream.liveNetworkRequiredByBuild !== false || upstream.retrievedAt !== "2026-08-19T07:20:00Z") fail("upstream release boundary differs");
  if (upstream.source?.name !== "Gaia Data Release 3" || upstream.source.publisher !== "European Space Agency" || upstream.source.tapEndpoint !== "https://gaia.aip.de/tap/sync" || upstream.source.license !== "CC BY-NC 3.0 IGO") fail("Gaia source attribution differs");
  if (!same(upstream.tables.map(({ name, doi }) => [name, doi]), [["gaiadr3.gaia_source", "10.17876/gaia/dr.3/1"], ["gaiadr3.astrophysical_parameters", "10.17876/gaia/dr.3/43"], ["gaiadr3.chemical_cartography", "10.17876/gaia/dr.3/99"]])) fail("Gaia table locks differ");
  if (upstream.paper?.doi !== "10.1051/0004-6361/202243511" || !HASH.test(upstream.paper.pdfSha256 ?? "") || upstream.paper.qualityProfileLocator !== "Appendix B") fail("paper lock differs");
  if (upstream.snapshot?.path !== sourceInput.relative || upstream.snapshot.sha256 !== sha256(sourceInput.bytes) || upstream.snapshot.bytes !== sourceInput.bytes.length) fail("source snapshot byte lock differs");
  if (upstream.projectionGenerator?.path !== generatorInput.relative || upstream.projectionGenerator.sha256 !== sha256(generatorInput.bytes) || upstream.projectionGenerator.bytes !== generatorInput.bytes.length) fail("projection generator byte lock differs");
  if (!same(upstream.selection, { profile: "gaia-dr3-chemical-cartography-balanced-v1", sourceCount: 64, ruleProfileCount: 4, selectedHighPerProfile: 8, selectedMediumOnlyPerProfile: 8, queryCount: 33, completePopulationClaim: false })) fail("selection lock differs");
  return upstream;
}

function parseFlags(value) {
  if (typeof value !== "string" || !/^\d{13,}$/.test(value)) fail("GSP-Spec quality flags differ");
  return [...value.slice(0, 13)].map(Number);
}

function isMedium(parameter) {
  const f = parseFlags(parameter.flags_gspspec);
  const teff = parameter.teff_gspspec;
  const logg = parameter.logg_gspspec;
  return teff > 3500 && logg > 0 && logg < 5
    && (teff >= 3800 || logg <= 3.5)
    && (teff >= 4150 || logg >= 3.6 || logg <= 2.4)
    && parameter.teff_gspspec_upper - parameter.teff_gspspec_lower < 750
    && parameter.logg_gspspec_upper - parameter.logg_gspspec_lower < 1
    && parameter.mh_gspspec_upper - parameter.mh_gspspec_lower < 0.5
    && f.slice(0, 6).every((value) => value <= 1) && f[6] <= 3 && f[7] <= 2 && f[12] <= 1;
}

function isHigh(parameter) {
  const f = parseFlags(parameter.flags_gspspec);
  return parameter.teff_gspspec > 3500 && parameter.logg_gspspec > 0 && parameter.logg_gspspec < 5
    && f.slice(0, 7).every((value) => value === 0) && f[7] <= 2
    && f.slice(8, 12).every((value) => value === 0) && f[12] <= 1;
}

function profileMatches(id, parameter, orbit) {
  const mh = parameter.mh_gspspec;
  if (id === PROFILE_IDS[0]) return orbit.vphi_med >= 180 && orbit.ecc_med <= 0.2 && orbit.zmax_med <= 0.5 && mh >= -0.5;
  if (id === PROFILE_IDS[1]) return orbit.vphi_med >= 100 && orbit.vphi_med < 200 && orbit.ecc_med > 0.2 && orbit.ecc_med < 0.6 && orbit.zmax_med > 0.5 && orbit.zmax_med < 3 && mh >= -1 && mh < -0.3 && parameter.alphafe_gspspec >= 0.15;
  if (id === PROFILE_IDS[2]) return orbit.vphi_med >= 0 && orbit.ecc_med >= 0.7 && orbit.zmax_med >= 3 && mh <= -0.8;
  return orbit.vphi_med < 0 && orbit.zmax_med >= 1 && mh <= -0.8;
}

function validateInterval(object, medianName, lowerName, upperName, label) {
  const middle = finite(object[medianName], `${label}.${medianName}`);
  const lower = finite(object[lowerName], `${label}.${lowerName}`);
  const upper = finite(object[upperName], `${label}.${upperName}`);
  if (lower > middle || middle > upper) fail(`${label}.${medianName} interval order differs`);
}

function validateSource(source, upstream) {
  exactKeys(source, ["format", "formatVersion", "profileVersion", "source", "selection", "queries", "records", "evidenceBoundary"], "source projection");
  if (source.format !== "onto2d-gaia-dr3-galactic-archaeology-projection" || source.formatVersion !== "1" || source.profileVersion !== upstream.selection.profile || source.source?.release !== "Gaia DR3" || source.source.retrievedAt !== upstream.retrievedAt) fail("source projection version differs");
  if (!same(source.source.tables.map(({ name, doi }) => [name, doi]), upstream.tables.map(({ name, doi }) => [name, doi])) || source.source.paper?.doi !== upstream.paper.doi || source.source.paper.sha256 !== upstream.paper.pdfSha256) fail("projection authority differs");
  if (source.selection?.sourceCount !== 64 || source.selection.selectedPerQualityAndProfile !== 8 || !same(source.selection.profiles.map(({ id }) => id), PROFILE_IDS) || source.selection.audit?.length !== 4) fail("projection selection differs");
  if (!Array.isArray(source.queries) || source.queries.length !== 33 || source.queries.some((query) => !query.role || !/^SELECT /.test(query.adql) || query.adql.includes(";"))) fail("executed ADQL inventory differs");
  if (!Array.isArray(source.records) || source.records.length !== 64) fail("source record census differs");
  const ids = new Set();
  const counts = new Map();
  for (const record of source.records) {
    if (!/^\d{10,19}$/.test(record.sourceId ?? "") || ids.has(record.sourceId) || !PROFILE_IDS.includes(record.ruleProfileId) || !["high", "medium-only"].includes(record.qualityProfile)) fail("source identity, profile, or quality differs");
    ids.add(record.sourceId);
    counts.set(`${record.ruleProfileId}:${record.qualityProfile}`, (counts.get(`${record.ruleProfileId}:${record.qualityProfile}`) ?? 0) + 1);
    if (!isObject(record.observation) || !isObject(record.gaiaParameters) || !isObject(record.publishedOrbit)) fail(`${record.sourceId} layer structure differs`);
    for (const [middle, lower, upper] of INTERVALS) validateInterval(record.gaiaParameters, middle, lower, upper, `${record.sourceId}.gaiaParameters`);
    for (const name of ORBIT_INTERVALS) validateInterval(record.publishedOrbit, `${name}_med`, `${name}_lo`, `${name}_hi`, `${record.sourceId}.publishedOrbit`);
    for (const pair of [["ra", "ra_error"], ["dec", "dec_error"], ["parallax", "parallax_error"], ["pmra", "pmra_error"], ["pmdec", "pmdec_error"], ["radial_velocity", "radial_velocity_error"]]) {
      const [valueName, errorName] = pair;
      if ((record.observation[valueName] === null) !== (record.observation[errorName] === null)) fail(`${record.sourceId}.${valueName} missingness differs`);
      if (record.observation[valueName] !== null) { finite(record.observation[valueName], `${record.sourceId}.${valueName}`); if (finite(record.observation[errorName], `${record.sourceId}.${errorName}`) < 0) fail(`${record.sourceId}.${errorName} is negative`); }
    }
    if (!isMedium(record.gaiaParameters) || isHigh(record.gaiaParameters) !== (record.qualityProfile === "high") || !profileMatches(record.ruleProfileId, record.gaiaParameters, record.publishedOrbit)) fail(`${record.sourceId} quality or rule assignment differs`);
  }
  for (const id of PROFILE_IDS) for (const quality of ["high", "medium-only"]) if (counts.get(`${id}:${quality}`) !== 8) fail(`${id}/${quality} balance differs`);
  if (!same(source.evidenceBoundary, { observationIsOrbit: false, parameterEstimateIsObservation: false, ruleProfileIsPublishedPopulationLabel: false, ruleProfileIsBirthOrigin: false, chemicalSimilarityIsCommonAncestry: false, sampleIsCompleteMilkyWayPopulation: false, uncertaintyIntervalsRetained: true })) fail("source evidence boundary differs");
  return source;
}

function validateProfile(profile) {
  exactKeys(profile, ["format", "formatVersion", "profileVersion", "question", "evidenceLayers", "qualityAblation", "interpretationPolicy", "historicalLoad", "nonClaims"], "analysis profile");
  if (profile.format !== "onto2d-galactic-archaeology-analysis-profile" || profile.formatVersion !== "1" || profile.profileVersion !== "gaia-dr3-chemical-cartography-interpretation-v1") fail("analysis profile version differs");
  if (!same(profile.evidenceLayers.map(({ id }) => id), ["observed", "gaia-derived", "published-derived", "onto2d-classified", "publication-context"])) fail("evidence layer order differs");
  if (!same(profile.qualityAblation, { baseline: "medium", strict: "high", baselineSourceCount: 64, strictSourceCount: 32, expectedPerProfile: { medium: 16, high: 8 }, interpretationSurvivalRule: "A declared rule-profile pattern survives only when at least one source remains after the selected quality regime." })) fail("quality ablation profile differs");
  if (profile.interpretationPolicy?.status !== "candidate-compatibility-only" || profile.interpretationPolicy.birthOriginAllowed || profile.interpretationPolicy.commonAncestryAllowed || profile.interpretationPolicy.singleTrueFormationHistoryAllowed || !profile.interpretationPolicy.alternativeInterpretationsAllowed) fail("interpretation boundary differs");
  if (profile.historicalLoad?.status !== "not-evaluated" || profile.historicalLoad.value !== null || !/undefined must not be displayed as zero/.test(profile.historicalLoad.reason ?? "") || profile.nonClaims?.length !== 12 || new Set(profile.nonClaims).size !== 12) fail("non-claim or Historical Load boundary differs");
  return profile;
}

function interval(point, lower, upper, unit) { return Object.freeze({ point, lower, upper, unit }); }
function measurement(value, uncertainty, unit) { return Object.freeze({ value, uncertainty, unit, missing: value === null }); }

function projectRecord(record) {
  const o = record.observation;
  const p = record.gaiaParameters;
  const r = record.publishedOrbit;
  const basis = {
    sourceId: record.sourceId,
    ruleProfileId: record.ruleProfileId,
    qualityProfile: record.qualityProfile,
    observation: {
      designation: o.designation,
      skyPosition: { ra: measurement(o.ra, o.ra_error, "deg"), dec: measurement(o.dec, o.dec_error, "deg") },
      parallax: measurement(o.parallax, o.parallax_error, "mas"),
      properMotion: { ra: measurement(o.pmra, o.pmra_error, "mas/yr"), dec: measurement(o.pmdec, o.pmdec_error, "mas/yr") },
      radialVelocity: measurement(o.radial_velocity, o.radial_velocity_error, "km/s"),
      photometry: { gMeanMagnitude: o.phot_g_mean_mag, bpMinusRp: o.bp_rp },
      ruwe: o.ruwe,
      evidenceState: "gaia-catalogue-observation"
    },
    gaiaEstimate: {
      effectiveTemperature: interval(p.teff_gspspec, p.teff_gspspec_lower, p.teff_gspspec_upper, "K"),
      surfaceGravity: interval(p.logg_gspspec, p.logg_gspspec_lower, p.logg_gspspec_upper, "dex"),
      metallicity: interval(p.mh_gspspec, p.mh_gspspec_lower, p.mh_gspspec_upper, "dex"),
      alphaToIron: interval(p.alphafe_gspspec, p.alphafe_gspspec_lower, p.alphafe_gspspec_upper, "dex"),
      flags: p.flags_gspspec,
      evidenceState: "gaia-apsis-estimate"
    },
    publishedOrbit: {
      rplane: interval(r.rplane_med, r.rplane_lo, r.rplane_hi, "kpc"),
      radialVelocity: interval(r.vrplane_med, r.vrplane_lo, r.vrplane_hi, "km/s"),
      verticalVelocity: interval(r.vz_med, r.vz_lo, r.vz_hi, "km/s"),
      azimuthalVelocity: interval(r.vphi_med, r.vphi_lo, r.vphi_hi, "km/s"),
      maximumHeight: interval(r.zmax_med, r.zmax_lo, r.zmax_hi, "kpc"),
      eccentricity: interval(r.ecc_med, r.ecc_lo, r.ecc_hi, "unitless"),
      radialAction: interval(r.jr_med, r.jr_lo, r.jr_hi, "published-normalized"),
      verticalAction: interval(r.jz_med, r.jz_lo, r.jz_hi, "published-normalized"),
      azimuthalAction: interval(r.jphi_med, r.jphi_lo, r.jphi_hi, "published-normalized"),
      energy: { point: r.energy_med, unit: "km2/s2" },
      evidenceState: "published-companion-derived"
    },
    assignment: {
      ruleProfileId: record.ruleProfileId,
      authority: "Onto2D deterministic rule profile",
      nativeGaiaLabel: false,
      birthOriginClaim: false,
      commonAncestryClaim: false,
      evidenceState: "onto2d-classified"
    }
  };
  return Object.freeze({ ...basis, identity: hashCanonical(RECORD_DOMAIN, basis) });
}

function summary(records, profileId, regime) {
  const selected = records.filter((record) => record.ruleProfileId === profileId && (regime === "medium" || record.qualityProfile === "high"));
  const med = (selector) => round(median(selected.map(selector)));
  return Object.freeze({
    ruleProfileId: profileId,
    qualityRegime: regime,
    sourceCount: selected.length,
    medianMetallicity: med((record) => record.gaiaEstimate.metallicity.point),
    medianAlphaToIron: med((record) => record.gaiaEstimate.alphaToIron.point),
    medianAzimuthalVelocity: med((record) => record.publishedOrbit.azimuthalVelocity.point),
    medianEccentricity: med((record) => record.publishedOrbit.eccentricity.point),
    medianMaximumHeight: med((record) => record.publishedOrbit.maximumHeight.point),
    patternSurvives: selected.length > 0
  });
}

export async function buildGalacticArchaeologyCase() {
  const [sourceInput, upstreamInput, profileInput, generatorInput] = await Promise.all([
    loadJson("source/gaia-dr3-chemical-cartography.json"),
    loadJson("upstream.json", 128 * 1024),
    loadJson("analysis-profile.json", 128 * 1024),
    loadBytes("prepare-source.py", 128 * 1024)
  ]);
  const upstream = validateUpstream(upstreamInput.value, sourceInput, generatorInput);
  const source = validateSource(sourceInput.value, upstream);
  const profile = validateProfile(profileInput.value);
  const records = source.records.map(projectRecord);
  const profileById = new Map(source.selection.profiles.map((item) => [item.id, item]));
  const qualityAblation = {
    baseline: { id: "medium", sourceCount: 64, summaries: PROFILE_IDS.map((id) => summary(records, id, "medium")) },
    strict: { id: "high", sourceCount: 32, excludedSourceCount: 32, summaries: PROFILE_IDS.map((id) => summary(records, id, "high")) },
    sourceMutation: false,
    interpretationResult: "All four rule-profile patterns remain represented; estimates shift and half of the bounded cohort is excluded."
  };
  const historicalInterpretations = PROFILE_IDS.map((id) => ({
    ruleProfileId: id,
    statements: profileById.get(id).interpretations,
    status: "compatible-pattern-only",
    supportingSourceCount: 16,
    survivesHighQualityAblation: true,
    recoveredBirthOrigin: false,
    commonAncestryClaim: false,
    singleFormationHistoryClaim: false
  }));
  const sourceBasis = { snapshotIdentity: `sha256:${sha256(sourceInput.bytes)}`, upstream, provider: source.source };
  const artifactBasis = {
    format: "onto2d-galactic-archaeology-case",
    formatVersion: "1",
    caseVersion: profile.profileVersion,
    source: {
      identity: hashCanonical(SOURCE_DOMAIN, sourceBasis),
      snapshotIdentity: sourceBasis.snapshotIdentity,
      snapshotBytes: sourceInput.bytes.length,
      release: "Gaia DR3",
      retrievedAt: source.source.retrievedAt,
      liveNetworkRequiredByBuild: false,
      tableLocks: upstream.tables,
      paper: upstream.paper,
      executedQueryCount: source.queries.length,
      authoredFiles: [
        { path: upstreamInput.relative, identity: `sha256:${sha256(upstreamInput.bytes)}`, bytes: upstreamInput.bytes.length },
        { path: profileInput.relative, identity: `sha256:${sha256(profileInput.bytes)}`, bytes: profileInput.bytes.length },
        { path: generatorInput.relative, identity: `sha256:${sha256(generatorInput.bytes)}`, bytes: generatorInput.bytes.length }
      ],
      snapshotFiles: [
        { path: sourceInput.relative, identity: `sha256:${sha256(sourceInput.bytes)}`, bytes: sourceInput.bytes.length }
      ]
    },
    methodology: {
      question: profile.question,
      selectionProfile: source.profileVersion,
      analysisProfile: profile.profileVersion,
      selectionRule: source.selection.rule,
      qualityDefinitions: source.selection.qualityDefinitions,
      evidenceLayers: profile.evidenceLayers,
      interpretationPolicy: profile.interpretationPolicy
    },
    cohort: {
      sourceCount: records.length,
      ruleProfileCount: PROFILE_IDS.length,
      highQualityCount: records.filter((record) => record.qualityProfile === "high").length,
      mediumOnlyCount: records.filter((record) => record.qualityProfile === "medium-only").length,
      missingRadialVelocityCount: records.filter((record) => record.observation.radialVelocity.missing).length,
      completePopulationClaim: false,
      candidateAudit: source.selection.audit,
      ruleProfiles: source.selection.profiles
    },
    records,
    qualityAblation,
    evidenceAblation: [
      { regime: "observed-only", visibleLayers: ["observed"], classificationStatus: "unresolved", historicalInterpretationStatus: "unresolved", reason: "The declared profiles require chemistry and published orbit estimates." },
      { regime: "observed-plus-gaia-derived", visibleLayers: ["observed", "gaia-derived"], classificationStatus: "unresolved", historicalInterpretationStatus: "unresolved", reason: "Chemistry alone does not satisfy the declared chemo-kinematic rules." },
      { regime: "through-published-derived", visibleLayers: ["observed", "gaia-derived", "published-derived", "onto2d-classified"], classificationStatus: "rule-supported", historicalInterpretationStatus: "withheld", reason: "The values support deterministic rule membership, not a formation history." },
      { regime: "full-bounded-context", visibleLayers: profile.evidenceLayers.map(({ id }) => id), classificationStatus: "rule-supported", historicalInterpretationStatus: "candidate-compatibility-only", reason: "Publication context permits bounded compatibility statements while alternative histories remain possible." }
    ],
    historicalInterpretations,
    reconstruction: {
      status: "candidate-interpretations-only",
      trueFormationHistoryRecovered: false,
      alternativeInterpretationsAllowed: true,
      result: "Present-day chemo-kinematic patterns support inspectable candidate historical interpretations; they do not identify a unique origin for any star."
    },
    historicalLoad: profile.historicalLoad,
    audit: {
      sourceRecords: 64,
      recordsWithAllFourParameterIntervals: records.filter((record) => Object.values(record.gaiaEstimate).filter((value) => isObject(value) && "lower" in value).length === 4).length,
      recordsWithAllNineOrbitIntervals: records.filter((record) => Object.values(record.publishedOrbit).filter((value) => isObject(value) && "lower" in value).length === 9).length,
      missingRadialVelocitiesPreserved: records.filter((record) => record.observation.radialVelocity.missing).length,
      missingRadialVelocitiesConvertedToZero: 0,
      directObservationOrbitPromotions: 0,
      nativeGaiaPopulationLabelsInvented: 0,
      birthOriginClaims: 0,
      commonAncestryClaims: 0,
      liveQueriesDuringBuild: 0
    },
    evidenceBoundary: source.evidenceBoundary,
    nonClaims: profile.nonClaims,
    disclaimer: "Research demonstration only. Candidate Galactic-history compatibility is not a recovered birth origin, unique formation history, or ancestry determination."
  };
  return Object.freeze({ ...artifactBasis, caseIdentity: hashCanonical(CASE_DOMAIN, artifactBasis) });
}

export function verifyGalacticArchaeologyCaseIdentity(artifact) {
  if (!isObject(artifact)) fail("artifact must be an object");
  const { caseIdentity, ...basis } = artifact;
  if (!/^sha256:[0-9a-f]{64}$/.test(caseIdentity ?? "") || hashCanonical(CASE_DOMAIN, basis) !== caseIdentity) fail("case identity differs from content");
  if (APPROVED_CASE_IDENTITY !== null && caseIdentity !== APPROVED_CASE_IDENTITY) fail("case is not the approved Gaia DR3 release");
  if (artifact.format !== "onto2d-galactic-archaeology-case" || artifact.caseVersion !== "gaia-dr3-chemical-cartography-interpretation-v1" || artifact.source?.liveNetworkRequiredByBuild !== false || artifact.cohort?.sourceCount !== 64 || artifact.records?.length !== 64) fail("artifact release boundary differs");
  if (artifact.cohort.missingRadialVelocityCount !== 0 || artifact.audit?.missingRadialVelocitiesPreserved !== 0 || artifact.audit.missingRadialVelocitiesConvertedToZero !== 0) fail("missing radial velocity boundary differs");
  if (artifact.audit.recordsWithAllFourParameterIntervals !== 64 || artifact.audit.recordsWithAllNineOrbitIntervals !== 64 || artifact.audit.directObservationOrbitPromotions !== 0 || artifact.audit.nativeGaiaPopulationLabelsInvented !== 0 || artifact.audit.birthOriginClaims !== 0 || artifact.audit.commonAncestryClaims !== 0 || artifact.audit.liveQueriesDuringBuild !== 0) fail("epistemic audit differs");
  if (!same(artifact.qualityAblation?.strict?.summaries.map(({ sourceCount, patternSurvives }) => [sourceCount, patternSurvives]), [[8, true], [8, true], [8, true], [8, true]]) || artifact.qualityAblation.sourceMutation) fail("quality ablation result differs");
  if (!same(artifact.evidenceAblation?.map(({ regime, historicalInterpretationStatus }) => [regime, historicalInterpretationStatus]), [["observed-only", "unresolved"], ["observed-plus-gaia-derived", "unresolved"], ["through-published-derived", "withheld"], ["full-bounded-context", "candidate-compatibility-only"]])) fail("evidence ablation result differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null || artifact.reconstruction?.trueFormationHistoryRecovered || !artifact.reconstruction.alternativeInterpretationsAllowed) fail("reconstruction or Historical Load boundary differs");
  return artifact;
}

export async function run({ verify = false } = {}) {
  const artifact = verifyGalacticArchaeologyCaseIdentity(await buildGalacticArchaeologyCase());
  if (verify) {
    const committed = JSON.parse(await readFile(OUTPUT, "utf8"));
    assert.deepEqual(committed, artifact);
  } else {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(artifact));
  }
  console.log(`${verify ? "Verified" : "Built"} Galactic Archaeology ${artifact.caseIdentity}: ${artifact.cohort.sourceCount} sources, ${artifact.qualityAblation.strict.sourceCount} survive High quality`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
