import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, "artifacts", "mineral-formation-history.json");
const CASE_DOMAIN = "onto2d:mineral-formation-history-case:v1";
const SOURCE_DOMAIN = "onto2d:mineral-formation-history-source:v1";
const SPECIES_DOMAIN = "onto2d:mineral-species:v1";
const SAMPLE_DOMAIN = "onto2d:mineral-sample:v1";
const ANALYSIS_DOMAIN = "onto2d:mineral-analysis:v1";
const CLAIM_DOMAIN = "onto2d:mineral-formation-claim:v1";
const APPROVED_CASE_IDENTITY = "sha256:10b59cb71e26bb07e7a88139f639d5a416d20674b63ff5165a75d03d1b23cf9c";
const SAMPLE_IDS = Object.freeze(["79990", "HP8-319.8", "RI08-24-477.67", "CD13829", "DD86WRL1-681", "DD86WRL1-729.91", "176898", "V3-651", "PETR14", "DLR7_146.5m"]);
const CLAIMED_SAMPLE_IDS = Object.freeze(["DD86WRL1-681", "PETR14", "79990"]);
const HASH = /^[0-9a-f]{64}$/;

function fail(message) { throw new Error(`Mineral Formation History extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) { return `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function requiredString(value, label) { if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`); return value; }
function finite(value, label) { if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be finite`); return value; }
function unique(values, label) { if (new Set(values).size !== values.length) fail(`${label} must be unique`); return values; }

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

function validateUpstream(upstream, sourceInput, generatorInput) {
  if (upstream?.format !== "onto2d-mineral-formation-history-upstream-lock" || upstream.formatVersion !== "1" || upstream.retrievedAt !== "2026-08-19T10:40:00Z" || upstream.liveNetworkRequiredByBuild !== false) fail("upstream release boundary differs");
  if (upstream.dataset?.doi !== "10.17632/h2n4b8cczy.1" || upstream.dataset.version !== 1 || upstream.dataset.license !== "CC BY 4.0") fail("dataset lock differs");
  if (upstream.article?.doi !== "10.1016/j.gca.2019.05.035" || upstream.article.acceptedManuscriptBytes !== 783712 || upstream.article.acceptedManuscriptSha256 !== "4c3e40b01a5f319bbb367258663589bd0b52ae2495d9a86820b764f88ebd5118") fail("article lock differs");
  if (upstream.conceptualAuthority?.doi !== "10.2138/am-2022-8099") fail("conceptual authority differs");
  if (upstream.snapshot?.path !== sourceInput.relative || upstream.snapshot.sha256 !== sha256(sourceInput.bytes) || upstream.snapshot.bytes !== sourceInput.bytes.length) fail("source snapshot byte lock differs");
  if (upstream.projectionGenerator?.path !== generatorInput.relative || upstream.projectionGenerator.sha256 !== sha256(generatorInput.bytes) || upstream.projectionGenerator.bytes !== generatorInput.bytes.length) fail("projection generator byte lock differs");
  if (!same(upstream.selection?.reviewedFormationClaimSampleIds, CLAIMED_SAMPLE_IDS) || upstream.selection.sampleCount !== 10 || upstream.selection.analysisCount !== 95 || upstream.selection.unmappedWithinCaseCount !== 7 || upstream.selection.completeMineralOrFormationSpaceClaim !== false) fail("source selection differs");
  return upstream;
}

function validateSource(source) {
  if (source?.format !== "onto2d-gregory-2019-pyrite-nodule-projection" || source.formatVersion !== "1" || source.profileVersion !== "gregory-2019-pyrite-nodule-projection-v1") fail("source projection format differs");
  if (source.source?.datasetDoi !== "10.17632/h2n4b8cczy.1" || source.source.articleDoi !== "10.1016/j.gca.2019.05.035" || source.source.speciesName !== "pyrite" || source.source.formula !== "FeS2") fail("source authority differs");
  if (!Array.isArray(source.samples) || !same(source.samples.map(({ sampleId }) => sampleId), SAMPLE_IDS)) fail("source sample inventory differs");
  if (!Array.isArray(source.analyses) || source.analyses.length !== 95) fail("source analysis inventory differs");
  unique(source.analyses.map(({ analysisId }) => requiredString(analysisId, "analysisId")), "analysis ids");
  const counts = Object.fromEntries(SAMPLE_IDS.map((id) => [id, source.analyses.filter(({ sampleId }) => sampleId === id).length]));
  if (!same(counts, { "79990": 10, "HP8-319.8": 13, "RI08-24-477.67": 10, CD13829: 10, "DD86WRL1-681": 5, "DD86WRL1-729.91": 8, "176898": 9, "V3-651": 11, PETR14: 9, "DLR7_146.5m": 10 })) fail("per-sample analysis census differs");
  for (const sample of source.samples) {
    finite(sample.ageMa, `${sample.sampleId}.ageMa`);
    requiredString(sample.location, `${sample.sampleId}.location`);
    requiredString(sample.country, `${sample.sampleId}.country`);
    requiredString(sample.description, `${sample.sampleId}.description`);
  }
  for (const analysis of source.analyses) {
    if (!SAMPLE_IDS.includes(analysis.sampleId) || !isObject(analysis.valuesBySourceColumn) || Object.keys(analysis.valuesBySourceColumn).length < 20 || !isObject(analysis.uncertaintiesBySourceColumn)) fail(`${analysis.analysisId} evidence row differs`);
  }
  if (source.measurementColumns?.X !== "Pb_Py" || source.measurementColumns?.Y !== "Pb_Py" || source.measurementColumns?.Z !== "Pb_Py" || source.audit?.duplicateLeadHeadingsRenamed !== 0 || source.audit?.formationMechanismsInferred !== 0) fail("source-column preservation policy differs");
  return source;
}

function validateProfile(profile) {
  if (profile?.format !== "onto2d-mineral-formation-history-analysis-profile" || profile.formatVersion !== "1" || profile.profileVersion !== "gregory-2019-pyrite-formation-interpretation-v1") fail("analysis profile differs");
  if (!same(profile.identityRegimes?.map(({ id, expectedClassCount, unresolvedCount }) => [id, expectedClassCount, unresolvedCount]), [["conventional-species", 1, 0], ["sample-record", 10, 0], ["published-formation-profile", 3, 7]])) fail("identity regimes differ");
  if (!same(profile.formationClaims?.map(({ sampleId }) => sampleId), CLAIMED_SAMPLE_IDS)) fail("formation-claim boundary differs");
  if (profile.interpretationPolicy?.status !== "published-interpretations-only" || profile.interpretationPolicy.localityMayImplyFormation !== false || profile.interpretationPolicy.ageMayImplyFormation !== false || profile.interpretationPolicy.traceElementsMayBeAutoClassified !== false || profile.interpretationPolicy.causalEdgesGeneratedByOnto2D !== false) fail("interpretation policy differs");
  if (profile.historicalLoad?.status !== "not-evaluated" || profile.historicalLoad.value !== null || profile.nonClaims?.length !== 11) fail("non-claim boundary differs");
  return profile;
}

function identityRegimes(samples, profile, speciesIdentity, claims) {
  const sampleIdentities = samples.map(({ identity }) => identity);
  const claimBySample = new Map(claims.map((claim) => [claim.sampleId, claim]));
  return profile.identityRegimes.map((regime) => {
    if (regime.id === "conventional-species") return { ...regime, classes: [{ key: speciesIdentity, label: "Pyrite / FeS2", members: sampleIdentities }], unresolved: [] };
    if (regime.id === "sample-record") return { ...regime, classes: samples.map((sample) => ({ key: sample.identity, label: sample.sampleId, members: [sample.identity] })), unresolved: [] };
    return {
      ...regime,
      classes: claims.map((claim) => ({ key: claim.identity, label: claim.shortLabel, members: [samples.find(({ sampleId }) => sampleId === claim.sampleId)?.identity].filter(Boolean) })),
      unresolved: samples.filter(({ sampleId }) => !claimBySample.has(sampleId)).map(({ identity }) => identity)
    };
  });
}

export async function buildMineralFormationHistoryCase() {
  const [upstreamInput, profileInput, sourceInput, generatorInput] = await Promise.all([
    loadJson("upstream.json"), loadJson("analysis-profile.json"), loadJson("source/gregory-2019-pyrite-nodules.json"), loadBytes("prepare-source.py")
  ]);
  const upstream = validateUpstream(upstreamInput.value, sourceInput, generatorInput);
  const profile = validateProfile(profileInput.value);
  const source = validateSource(sourceInput.value);
  const sourceIdentity = hashCanonical(SOURCE_DOMAIN, { snapshotIdentity: `sha256:${sha256(sourceInput.bytes)}`, datasetDoi: upstream.dataset.doi, articleDoi: upstream.article.doi });
  const species = { name: "Pyrite", formula: "FeS2", identity: hashCanonical(SPECIES_DOMAIN, { name: "Pyrite", formula: "FeS2", cohort: sourceIdentity }) };
  const analyses = source.analyses.map((analysis) => ({ ...analysis, identity: hashCanonical(ANALYSIS_DOMAIN, analysis) }));
  const analysisBySample = new Map(SAMPLE_IDS.map((sampleId) => [sampleId, analyses.filter((analysis) => analysis.sampleId === sampleId)]));
  const summaryBySample = new Map(source.sampleSummaries.map((summary) => [summary.sampleId, summary]));
  const claimed = new Set(CLAIMED_SAMPLE_IDS);
  const samples = source.samples.map((sample) => {
    const identity = hashCanonical(SAMPLE_DOMAIN, { sourceIdentity, sampleId: sample.sampleId, sourceRow: sample.sourceRow });
    return {
      ...sample,
      identity,
      speciesIdentity: species.identity,
      formationMappingStatus: claimed.has(sample.sampleId) ? "reviewed-published-interpretation" : "unmapped-within-bounded-case",
      analysisIdentities: analysisBySample.get(sample.sampleId).map(({ identity: analysisIdentity }) => analysisIdentity),
      measurementSummary: summaryBySample.get(sample.sampleId)
    };
  });
  const formationClaims = profile.formationClaims.map((claim) => ({
    ...claim,
    identity: hashCanonical(CLAIM_DOMAIN, { ...claim, articleDoi: upstream.article.doi }),
    articleDoi: upstream.article.doi,
    evidenceLayer: "published-interpretation",
    sampleIdentity: samples.find(({ sampleId }) => sampleId === claim.sampleId)?.identity
  }));
  const regimes = identityRegimes(samples, profile, species.identity, formationClaims);
  const artifactBasis = {
    format: "onto2d-mineral-formation-history-case",
    formatVersion: "1",
    caseVersion: profile.profileVersion,
    source: {
      identity: sourceIdentity,
      snapshotIdentity: `sha256:${sha256(sourceInput.bytes)}`,
      snapshotBytes: sourceInput.bytes.length,
      retrievedAt: upstream.retrievedAt,
      dataset: upstream.dataset,
      article: upstream.article,
      conceptualAuthority: upstream.conceptualAuthority,
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
      evidenceLayers: profile.evidenceLayers,
      interpretationPolicy: profile.interpretationPolicy,
      measurementColumnPolicy: source.measurementColumnPolicy
    },
    cohort: {
      speciesCount: 1,
      sampleCount: samples.length,
      analysisCount: analyses.length,
      reviewedFormationClaimCount: formationClaims.length,
      unmappedWithinCaseCount: samples.length - formationClaims.length,
      ageRangeMa: { minimum: Math.min(...samples.map(({ ageMa }) => ageMa)), maximum: Math.max(...samples.map(({ ageMa }) => ageMa)) },
      countryCount: new Set(samples.map(({ country }) => country)).size,
      completeMineralOrFormationSpaceClaim: false
    },
    species,
    measurementColumns: source.measurementColumns,
    samples,
    analyses,
    formationClaims,
    identityRegimes: regimes,
    experiments: [
      { id: "same-species-distinct-formations", result: "Ten pyrite records form one conventional-species class; three reviewed representatives occupy three distinct published formation-profile classes.", sourceMutation: false, claimCount: 3 },
      { id: "evidence-trace", result: "Every reviewed formation profile links one native sample, its retained LA-ICP-MS rows, one qualified article interpretation, and an exact locator.", sourceMutation: false, autoClassifiedAnalysisCount: 0 },
      { id: "unknown-boundary", result: "Seven source samples remain unmapped in this release; their age and locality never generate a replacement formation claim.", sourceMutation: false, unresolvedCount: 7 },
      { id: "classification-toggle", result: "The same cohort yields 1 conventional-species class, 10 sample-record classes, or 3 supported formation-profile classes plus 7 unresolved records.", sourceMutation: false }
    ],
    historicalLoad: profile.historicalLoad,
    nonClaims: profile.nonClaims,
    audit: {
      sampleRowsRetained: source.audit.sampleRowsRetained,
      analysisRowsRetained: source.audit.analysisRowsRetained,
      populatedMeasurementValuesRetained: source.audit.populatedMeasurementValuesRetained,
      populatedUncertaintyValuesRetained: source.audit.populatedUncertaintyValuesRetained,
      reviewedPublishedInterpretationsRetained: formationClaims.length,
      unmappedSamplesPreserved: samples.length - formationClaims.length,
      duplicateLeadHeadingsRenamed: 0,
      automaticFormationClassifications: 0,
      localityToFormationInferences: 0,
      ageToFormationInferences: 0,
      onto2dGeneratedCausalEdges: 0,
      liveQueriesDuringBuild: 0
    }
  };
  return Object.freeze({ ...artifactBasis, caseIdentity: hashCanonical(CASE_DOMAIN, artifactBasis) });
}

export function verifyMineralFormationHistoryCaseIdentity(artifact, { enforceApproved = true } = {}) {
  if (!isObject(artifact)) fail("artifact must be an object");
  const { caseIdentity, ...basis } = artifact;
  const computed = hashCanonical(CASE_DOMAIN, basis);
  if (caseIdentity !== computed) fail(`case identity mismatch: expected ${computed}, received ${caseIdentity}`);
  if (enforceApproved && caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved release`);
  if (artifact.format !== "onto2d-mineral-formation-history-case" || artifact.caseVersion !== "gregory-2019-pyrite-formation-interpretation-v1" || artifact.source?.liveNetworkRequiredByBuild !== false) fail("artifact release boundary differs");
  if (artifact.cohort?.sampleCount !== 10 || artifact.cohort.analysisCount !== 95 || artifact.cohort.reviewedFormationClaimCount !== 3 || artifact.cohort.unmappedWithinCaseCount !== 7 || artifact.cohort.completeMineralOrFormationSpaceClaim !== false) fail("artifact cohort differs");
  if (artifact.species?.name !== "Pyrite" || artifact.species.formula !== "FeS2" || artifact.samples?.length !== 10 || artifact.analyses?.length !== 95 || artifact.formationClaims?.length !== 3) fail("artifact evidence inventory differs");
  if (!same(artifact.identityRegimes?.map(({ id, classes, unresolved }) => [id, classes.length, unresolved.length]), [["conventional-species", 1, 0], ["sample-record", 10, 0], ["published-formation-profile", 3, 7]])) fail("artifact identity regimes differ");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null || artifact.experiments?.length !== 4 || artifact.nonClaims?.length !== 11) fail("artifact interpretation boundary differs");
  if (artifact.audit?.duplicateLeadHeadingsRenamed || artifact.audit?.automaticFormationClassifications || artifact.audit?.localityToFormationInferences || artifact.audit?.ageToFormationInferences || artifact.audit?.onto2dGeneratedCausalEdges || artifact.audit?.liveQueriesDuringBuild) fail("artifact epistemic audit differs");
  return artifact;
}

export async function run({ verify = false, enforceApproved = true } = {}) {
  const artifact = await buildMineralFormationHistoryCase();
  if (!verify) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(artifact));
  }
  const stored = JSON.parse(await readFile(OUTPUT, "utf8"));
  verifyMineralFormationHistoryCaseIdentity(stored, { enforceApproved });
  assert.equal(serialize(stored), serialize(artifact));
  console.log(`${verify ? "Verified" : "Built"} Mineral Formation History ${artifact.caseIdentity}: ${artifact.cohort.sampleCount} samples, ${artifact.cohort.analysisCount} analyses, ${artifact.cohort.reviewedFormationClaimCount} reviewed claims`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => !["--verify", "--print-identity"].includes(argument));
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify"), enforceApproved: !process.argv.includes("--print-identity") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
