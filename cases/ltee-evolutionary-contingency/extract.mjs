import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, "artifacts", "ltee-evolutionary-contingency.json");
const CASE_DOMAIN = "onto2d:ltee-evolutionary-contingency-case:v1";
const SOURCE_DOMAIN = "onto2d:ltee-evolutionary-contingency-source:v1";
const BACKGROUND_DOMAIN = "onto2d:ltee-source-background:v1";
const PROTOCOL_DOMAIN = "onto2d:ltee-replay-protocol:v1";
const OBSERVATION_DOMAIN = "onto2d:ltee-replay-observation:v1";
const STATISTIC_DOMAIN = "onto2d:ltee-published-statistic:v1";
const APPROVED_CASE_IDENTITY = "sha256:e0024fee2f319158b5fc1dc0e30da1a7d641f0763b4f29ad7cc548c46e13d691";
const GENERATIONS = Object.freeze([0, 5000, 10000, 15000, 20000, 25000, 27000, 27500, 28000, 29000, 30000, 30500, 31000, 31500, 32000, 32500]);
const PROTOCOL_IDS = Object.freeze(["replay-1", "replay-2", "replay-3"]);
const HASH = /^[0-9a-f]{64}$/;

function fail(message) { throw new Error(`LTEE Evolutionary Contingency extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, expected, label) { if (!object(value) || !same(Object.keys(value).sort(), [...expected].sort())) fail(`${label} fields differ`); }
function serialize(value) { return `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function roundedRatio(numerator, denominator) { if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator < 1) fail("invalid exact ratio"); return Math.floor(numerator / denominator + 0.5); }

async function loadBytes(relative, maximumBytes = 256 * 1024) {
  const bytes = await readFile(path.join(ROOT, relative));
  if (bytes.length < 1 || bytes.length > maximumBytes) fail(`${relative} is empty or exceeds ${maximumBytes} bytes`);
  return { relative, bytes };
}

async function loadJson(relative, maximumBytes = 256 * 1024) {
  const input = await loadBytes(relative, maximumBytes);
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)); } catch { fail(`${relative} is not valid UTF-8 JSON`); }
  return { ...input, value };
}

function validateUpstream(upstream, sourceInput, generatorInput) {
  exactKeys(upstream, ["format", "formatVersion", "retrievedAt", "liveNetworkRequiredByBuild", "source", "retrievedArticle", "projectionGenerator", "snapshot", "selection"], "upstream lock");
  if (upstream.format !== "onto2d-ltee-evolutionary-contingency-upstream-lock" || upstream.formatVersion !== "1" || upstream.retrievedAt !== "2026-08-19T09:03:00Z" || upstream.liveNetworkRequiredByBuild !== false) fail("upstream release boundary differs");
  if (upstream.source?.doi !== "10.1073/pnas.0803151105" || upstream.source.pmid !== "18524956" || upstream.source.pmcid !== "PMC2430337" || upstream.source.publicationDate !== "2008-06-04") fail("article identity differs");
  if (upstream.retrievedArticle?.sha256 !== "7e271d52f2fba0e4c40c3c7491b654a56482763639b255fb77930583a4cc10f9" || upstream.retrievedArticle.bytes !== 225210 || upstream.retrievedArticle.redistributedInRepository !== false) fail("retrieved article lock differs");
  if (upstream.snapshot?.path !== sourceInput.relative || upstream.snapshot.sha256 !== sha256(sourceInput.bytes) || upstream.snapshot.bytes !== sourceInput.bytes.length) fail("source snapshot byte lock differs");
  if (upstream.projectionGenerator?.path !== generatorInput.relative || upstream.projectionGenerator.sha256 !== sha256(generatorInput.bytes) || upstream.projectionGenerator.bytes !== generatorInput.bytes.length) fail("projection generator byte lock differs");
  if (!same(upstream.selection?.tableIds, ["T1", "T2"]) || upstream.selection.sourceGenerationCount !== 16 || upstream.selection.protocolCount !== 3 || upstream.selection.observationCount !== 38 || upstream.selection.independentCitPlusMutantCount !== 17 || upstream.selection.completeMutationPathSpaceClaim !== false) fail("selection lock differs");
  return upstream;
}

function validateSource(source, upstream) {
  exactKeys(source, ["format", "formatVersion", "profileVersion", "source", "selection", "inputFiles", "backgrounds", "protocols", "observations", "publishedStatistics", "historyConditionedReachability", "publishedInterpretationBoundary", "evidenceBoundary"], "source projection");
  if (source.format !== "onto2d-ltee-replay-projection" || source.formatVersion !== "1" || source.profileVersion !== upstream.selection.projectionProfile) fail("source projection version differs");
  if (source.source?.doi !== upstream.source.doi || source.source.pmid !== upstream.source.pmid || source.source.pmcid !== upstream.source.pmcid || source.source.publicationDate !== upstream.source.publicationDate) fail("projection article authority differs");
  if (source.selection?.populationId !== "Ara-3" || source.selection.targetOutcomeId !== "phenotype:aerobic-citrate-use" || !same(source.selection.tableIds, ["T1", "T2"]) || !same(source.selection.experimentIds, PROTOCOL_IDS)) fail("projection selection differs");
  if (!Array.isArray(source.inputFiles) || source.inputFiles.length !== 1 || source.inputFiles[0].sha256 !== upstream.retrievedArticle.sha256 || source.inputFiles[0].bytes !== upstream.retrievedArticle.bytes) fail("projection input inventory differs");
  if (!Array.isArray(source.backgrounds) || source.backgrounds.length !== 16 || !same(source.backgrounds.map(({ sourceGeneration }) => sourceGeneration), GENERATIONS)) fail("background inventory differs");
  const backgroundIds = new Set();
  for (const background of source.backgrounds) {
    if (backgroundIds.has(background.id) || background.populationId !== "Ara-3" || background.recordKind !== "published-generation-sample" || background.cloneIdentityAvailableInTable !== false || background.completeGenotypeAvailableInTable !== false || background.potentiationStatusFromGenerationAlone !== "unresolved") fail(`background ${background.id} differs`);
    backgroundIds.add(background.id);
  }
  if (!Array.isArray(source.protocols) || source.protocols.length !== 3 || !same(source.protocols.map(({ id }) => id), PROTOCOL_IDS)) fail("protocol inventory differs");
  const expectedTotals = [[72, 4], [340, 5], [2800, 8]];
  for (const [index, protocol] of source.protocols.entries()) if (protocol.replicates !== expectedTotals[index][0] || protocol.independentCitPlusMutants !== expectedTotals[index][1]) fail(`${protocol.id} totals differ`);
  if (!Array.isArray(source.observations) || source.observations.length !== 38) fail("observation inventory differs");
  const observationIds = new Set();
  for (const observation of source.observations) {
    if (observationIds.has(observation.id) || !PROTOCOL_IDS.includes(observation.experimentId) || !backgroundIds.has(observation.backgroundId) || !GENERATIONS.includes(observation.sourceGeneration) || !Number.isInteger(observation.replicates) || observation.replicates < 1 || !Number.isInteger(observation.independentCitPlusMutants) || observation.independentCitPlusMutants < 0 || observation.independentCitPlusMutants > observation.replicates || observation.outcomeStatus !== (observation.independentCitPlusMutants ? "observed" : "not-observed") || observation.absenceMeansImpossible !== false) fail(`observation ${observation.id} differs`);
    observationIds.add(observation.id);
  }
  for (const [index, protocolId] of PROTOCOL_IDS.entries()) {
    const selected = source.observations.filter(({ experimentId }) => experimentId === protocolId);
    if (selected.reduce((sum, item) => sum + item.replicates, 0) !== expectedTotals[index][0] || selected.reduce((sum, item) => sum + item.independentCitPlusMutants, 0) !== expectedTotals[index][1]) fail(`${protocolId} observation totals differ`);
  }
  if (!Array.isArray(source.publishedStatistics) || source.publishedStatistics.length !== 3) fail("published statistic inventory differs");
  const expectedMeans = [[24917, 31750, 6833, 0.0085, true, 24917], [28382, 32100, 3718, 0.0007, false, 26382], [22571, 27563, 4992, 0.0823, true, 22571]];
  for (const [index, statistic] of source.publishedStatistics.entries()) {
    const [expectedMean, observedMean, shift, pValue, matches, tableOneMean] = expectedMeans[index];
    const selected = source.observations.filter(({ experimentId }) => experimentId === PROTOCOL_IDS[index]);
    const observedNumerator = selected.reduce((sum, item) => sum + item.sourceGeneration * item.independentCitPlusMutants, 0);
    const observedDenominator = selected.reduce((sum, item) => sum + item.independentCitPlusMutants, 0);
    if (statistic.experimentId !== PROTOCOL_IDS[index] || statistic.expectedMeanGeneration !== expectedMean || statistic.observedMeanGeneration !== observedMean || statistic.meanShiftGenerations !== shift || statistic.publishedMonteCarloPValue !== pValue || statistic.monteCarloIterations !== 1000000 || statistic.pValueRecomputed !== false || statistic.publishedExpectedMeanRecomputed !== false || statistic.tableOneMeanMatchesPublishedExpected !== matches || statistic.tableOneReplicateWeightedMean?.rounded !== tableOneMean || roundedRatio(observedNumerator, observedDenominator) !== observedMean) fail(`${statistic.experimentId} statistic differs`);
  }
  const assessments = source.historyConditionedReachability?.backgroundAssessments;
  if (!Array.isArray(assessments) || assessments.length !== 16 || source.historyConditionedReachability.protocolPoolingAllowed !== false || source.historyConditionedReachability.completeMutationPathSpaceClaim !== false || source.historyConditionedReachability.combinedPValueRecomputed !== false) fail("reachability boundary differs");
  const positive = assessments.filter(({ boundedOutcomeStatus }) => boundedOutcomeStatus === "observed").map(({ sourceGeneration }) => sourceGeneration);
  if (!same(positive, [20000, 27000, 30500, 31000, 31500, 32000, 32500]) || assessments.some((item) => item.protocolsPooled || item.impossibilityClaim || !["observed", "not-observed"].includes(item.boundedOutcomeStatus))) fail("background assessment differs");
  const evidence = { replayHistoryEqualsOriginalLteeHistory: false, notObservedMeansImpossible: false, generationLabelEqualsCompleteGenotype: false, generationLabelUniquelyIdentifiesClone: false, protocolCountsMayBePooledIntoOneRate: false, publishedMonteCarloPValuesRecomputed: false, publishedInterpretationBecomesUniversalLaw: false, sourceRowsRetained: true };
  if (!same(source.evidenceBoundary, evidence) || source.publishedInterpretationBoundary?.potentiatingMutationIdentifiedBySelectedTables !== false || source.publishedInterpretationBoundary.generationUniquelyDeterminesPotentiation !== false) fail("source evidence boundary differs");
  return source;
}

function validateProfile(profile) {
  exactKeys(profile, ["format", "formatVersion", "profileVersion", "question", "evidenceLayers", "reachabilityRegimes", "historicalLoad", "interpretationPolicy", "nonClaims"], "analysis profile");
  if (profile.format !== "onto2d-ltee-evolutionary-contingency-analysis-profile" || profile.formatVersion !== "1" || profile.profileVersion !== "ltee-ara3-citrate-replay-interpretation-v1") fail("analysis profile version differs");
  if (!same(profile.evidenceLayers.map(({ id }) => id), ["article-metadata", "source-table", "protocol-description", "published-interpretation", "onto2d-analysis"])) fail("evidence layer order differs");
  if (!same(profile.reachabilityRegimes.map(({ id, expectedClassCount }) => [id, expectedClassCount]), [["population-record", 1], ["source-generation", 16], ["bounded-observed-accessibility", 2], ["protocol-conditioned-observation", 38]]) || profile.reachabilityRegimes[2].observedBackgroundCount !== 7 || profile.reachabilityRegimes[2].unresolvedBackgroundCount !== 9) fail("reachability regime contract differs");
  if (profile.historicalLoad?.status !== "not-evaluated" || profile.historicalLoad.value !== null || !/undefined must not be displayed as zero/.test(profile.historicalLoad.reason ?? "")) fail("Historical Load boundary differs");
  if (profile.interpretationPolicy?.status !== "descriptive-history-conditioned-reachability" || Object.entries(profile.interpretationPolicy).some(([key, value]) => key !== "status" && value !== false)) fail("interpretation policy differs");
  if (!Array.isArray(profile.nonClaims) || profile.nonClaims.length !== 13 || new Set(profile.nonClaims).size !== 13) fail("non-claim inventory differs");
  return profile;
}

export async function buildLteeEvolutionaryContingencyCase() {
  const [sourceInput, upstreamInput, profileInput, generatorInput] = await Promise.all([
    loadJson("source/ltee-ara3-citrate-replay.json"),
    loadJson("upstream.json", 64 * 1024),
    loadJson("analysis-profile.json", 64 * 1024),
    loadBytes("prepare-source.py", 64 * 1024)
  ]);
  const upstream = validateUpstream(upstreamInput.value, sourceInput, generatorInput);
  const source = validateSource(sourceInput.value, upstream);
  const profile = validateProfile(profileInput.value);
  const protocols = source.protocols.map((protocol) => ({ ...protocol, identity: hashCanonical(PROTOCOL_DOMAIN, protocol) }));
  const backgrounds = source.backgrounds.map((background) => ({ ...background, identity: hashCanonical(BACKGROUND_DOMAIN, background) }));
  const observations = source.observations.map((observation) => ({ ...observation, identity: hashCanonical(OBSERVATION_DOMAIN, observation) }));
  const publishedStatistics = source.publishedStatistics.map((statistic) => ({ ...statistic, identity: hashCanonical(STATISTIC_DOMAIN, statistic) }));
  const sourceBasis = { snapshotIdentity: `sha256:${sha256(sourceInput.bytes)}`, upstream, provider: source.source };
  const discrepancy = publishedStatistics.filter(({ tableOneMeanMatchesPublishedExpected }) => !tableOneMeanMatchesPublishedExpected).map((statistic) => ({
    id: `published-expected-mean:${statistic.experimentId}`,
    status: "visible-not-resolved",
    publishedExpectedMeanGeneration: statistic.expectedMeanGeneration,
    tableOneReplicateWeightedMeanGeneration: statistic.tableOneReplicateWeightedMean.rounded,
    interpretation: "The published value is retained as source evidence; the simpler Table 1 arithmetic is retained as a diagnostic and is not substituted."
  }));
  const artifactBasis = {
    format: "onto2d-ltee-evolutionary-contingency-case",
    formatVersion: "1",
    caseVersion: profile.profileVersion,
    source: {
      identity: hashCanonical(SOURCE_DOMAIN, sourceBasis),
      snapshotIdentity: sourceBasis.snapshotIdentity,
      snapshotBytes: sourceInput.bytes.length,
      retrievedAt: upstream.retrievedAt,
      doi: source.source.doi,
      pmid: source.source.pmid,
      pmcid: source.source.pmcid,
      articleUrl: source.source.articleUrl,
      liveNetworkRequiredByBuild: false,
      authoredFiles: [
        { path: upstreamInput.relative, identity: `sha256:${sha256(upstreamInput.bytes)}`, bytes: upstreamInput.bytes.length },
        { path: profileInput.relative, identity: `sha256:${sha256(profileInput.bytes)}`, bytes: profileInput.bytes.length },
        { path: generatorInput.relative, identity: `sha256:${sha256(generatorInput.bytes)}`, bytes: generatorInput.bytes.length }
      ],
      snapshotFiles: [{ path: sourceInput.relative, identity: `sha256:${sha256(sourceInput.bytes)}`, bytes: sourceInput.bytes.length }],
      upstreamInputFiles: source.inputFiles
    },
    methodology: {
      question: profile.question,
      selectionProfile: source.profileVersion,
      analysisProfile: profile.profileVersion,
      selectionRule: source.selection.rule,
      evidenceLayers: profile.evidenceLayers,
      interpretationPolicy: profile.interpretationPolicy
    },
    cohort: {
      populationId: "Ara-3",
      targetOutcomeId: "phenotype:aerobic-citrate-use",
      sourceGenerationCount: 16,
      protocolCount: 3,
      observationCount: 38,
      replicateCountByProtocol: [72, 340, 2800],
      independentCitPlusMutantCountByProtocol: [4, 5, 8],
      independentCitPlusMutantCount: 17,
      observedBackgroundCount: 7,
      unresolvedBackgroundCount: 9,
      protocolsPooled: false
    },
    protocols,
    backgrounds,
    observations,
    publishedStatistics,
    reachability: {
      status: "descriptive-published-evidence",
      targetOutcomeId: source.historyConditionedReachability.targetOutcomeId,
      conditionedOn: source.historyConditionedReachability.conditionedOn,
      backgroundAssessments: source.historyConditionedReachability.backgroundAssessments,
      combinedPublishedPValueUpperBound: source.historyConditionedReachability.combinedPublishedPValueUpperBound,
      combinedPValueRecomputed: false,
      protocolsPooled: false,
      completeMutationPathSpaceClaim: false
    },
    reachabilityRegimes: profile.reachabilityRegimes,
    experiments: [
      { id: "protocol-separation", result: "The three replay designs remain three evidence contexts; their replicate counts are not pooled into one rate.", sourceMutation: false },
      { id: "bounded-accessibility", result: "Cit+ was observed from seven generation labels in at least one selected replay; nine labels remain unresolved rather than inaccessible.", sourceMutation: false },
      { id: "published-shift", result: "All three published observed mean generations are later than their reported null expectations; their P values remain published statistics.", sourceMutation: false },
      { id: "identity-boundary", result: "A generation sample remains distinct from a complete genotype, a unique clone, and a replayed evolutionary history.", sourceMutation: false }
    ],
    publishedInterpretation: source.publishedInterpretationBoundary,
    sourceDiscrepancies: discrepancy,
    historicalLoad: profile.historicalLoad,
    nonClaims: profile.nonClaims,
    audit: {
      sourceRowsRetained: 38,
      sourceGenerationLabelsRetained: 16,
      protocolsRetainedSeparately: 3,
      publishedStatisticsRetained: 3,
      publishedPValuesRecomputed: 0,
      missingCellsConvertedToZero: 0,
      impossibilityClaims: 0,
      completeGenotypesInvented: 0,
      uniqueCloneIdentitiesInvented: 0,
      replayHistoriesPromotedToOriginalHistory: 0,
      protocolsPooled: 0,
      causalMutationEdges: 0,
      completeMutationPathSpaceClaims: 0,
      liveQueriesDuringBuild: 0
    }
  };
  return Object.freeze({ ...artifactBasis, caseIdentity: hashCanonical(CASE_DOMAIN, artifactBasis) });
}

export function verifyLteeEvolutionaryContingencyCaseIdentity(artifact) {
  if (!object(artifact)) fail("artifact must be an object");
  const { caseIdentity, ...basis } = artifact;
  const computed = hashCanonical(CASE_DOMAIN, basis);
  if (caseIdentity !== computed) fail(`case identity mismatch: expected ${computed}, received ${caseIdentity}`);
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved release`);
  if (artifact.format !== "onto2d-ltee-evolutionary-contingency-case" || artifact.caseVersion !== "ltee-ara3-citrate-replay-interpretation-v1" || artifact.source?.liveNetworkRequiredByBuild !== false) fail("artifact release boundary differs");
  if (!same([artifact.backgrounds?.length, artifact.protocols?.length, artifact.observations?.length, artifact.publishedStatistics?.length], [16, 3, 38, 3])) fail("artifact inventory differs");
  for (const background of artifact.backgrounds) { const { identity, ...record } = background; if (identity !== hashCanonical(BACKGROUND_DOMAIN, record)) fail(`${background.id} identity differs`); }
  for (const protocol of artifact.protocols) { const { identity, ...record } = protocol; if (identity !== hashCanonical(PROTOCOL_DOMAIN, record)) fail(`${protocol.id} identity differs`); }
  for (const observation of artifact.observations) { const { identity, ...record } = observation; if (identity !== hashCanonical(OBSERVATION_DOMAIN, record)) fail(`${observation.id} identity differs`); }
  for (const statistic of artifact.publishedStatistics) { const { identity, ...record } = statistic; if (identity !== hashCanonical(STATISTIC_DOMAIN, record)) fail(`${statistic.experimentId} statistic identity differs`); }
  if (artifact.cohort?.observedBackgroundCount !== 7 || artifact.cohort.unresolvedBackgroundCount !== 9 || artifact.cohort.protocolsPooled !== false || !same(artifact.cohort.independentCitPlusMutantCountByProtocol, [4, 5, 8])) fail("artifact cohort boundary differs");
  if (artifact.sourceDiscrepancies?.length !== 1 || artifact.sourceDiscrepancies[0].id !== "published-expected-mean:replay-2" || artifact.sourceDiscrepancies[0].status !== "visible-not-resolved") fail("artifact discrepancy boundary differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null || artifact.nonClaims?.length !== 13 || artifact.experiments?.length !== 4) fail("artifact interpretation boundary differs");
  if (Object.entries(artifact.audit ?? {}).some(([key, value]) => !["sourceRowsRetained", "sourceGenerationLabelsRetained", "protocolsRetainedSeparately", "publishedStatisticsRetained"].includes(key) && value !== 0)) fail("artifact epistemic audit differs");
  return artifact;
}

export async function run({ verify = false } = {}) {
  const artifact = await buildLteeEvolutionaryContingencyCase();
  if (!verify) { await mkdir(path.dirname(OUTPUT), { recursive: true }); await writeFile(OUTPUT, serialize(artifact)); }
  const stored = JSON.parse(await readFile(OUTPUT, "utf8"));
  verifyLteeEvolutionaryContingencyCaseIdentity(stored);
  assert.equal(serialize(stored), serialize(artifact));
  console.log(`${verify ? "Verified" : "Built"} LTEE Evolutionary Contingency ${artifact.caseIdentity}: ${artifact.cohort.observationCount} observations, ${artifact.cohort.independentCitPlusMutantCount} independent Cit+ mutants`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
