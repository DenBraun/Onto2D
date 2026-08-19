const CASE_IDENTITY = "sha256:e0024fee2f319158b5fc1dc0e30da1a7d641f0763b4f29ad7cc548c46e13d691";
const SOURCE_IDENTITY = "sha256:edf18c3b63b7a430e0d8febb0708c411e6808a5a2dd9603f47fae3234baa80f1";
const SNAPSHOT_IDENTITY = "sha256:d4574e9bf6e34979b3a1a3cb6002a1a6f97da85180ef44da1d8e841dcf257a3d";
const GENERATIONS = Object.freeze([0, 5000, 10000, 15000, 20000, 25000, 27000, 27500, 28000, 29000, 30000, 30500, 31000, 31500, 32000, 32500]);
const PROTOCOLS = Object.freeze(["replay-1", "replay-2", "replay-3"]);

function fail(message) { throw new TypeError(`Evolutionary Contingency model rejected the artifact: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; }
function generationKey(value) {
  const generation = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(generation)) fail(`unknown generation ${value}`);
  return generation;
}
function generationId(generation) { return `g-${String(generation).padStart(5, "0")}`; }

export function createEvolutionaryContingencyModel(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) fail("artifact must be an object");
  if (artifact.format !== "onto2d-ltee-evolutionary-contingency-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "ltee-ara3-citrate-replay-interpretation-v1") fail("format or version differs");
  if (artifact.caseIdentity !== CASE_IDENTITY || artifact.source?.identity !== SOURCE_IDENTITY || artifact.source.snapshotIdentity !== SNAPSHOT_IDENTITY) fail("case or source release differs");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.doi !== "10.1073/pnas.0803151105" || artifact.source.pmid !== "18524956" || artifact.source.pmcid !== "PMC2430337") fail("source lock differs");
  if (!same([artifact.cohort?.sourceGenerationCount, artifact.cohort?.protocolCount, artifact.cohort?.observationCount, artifact.cohort?.independentCitPlusMutantCount, artifact.cohort?.observedBackgroundCount, artifact.cohort?.unresolvedBackgroundCount], [16, 3, 38, 17, 7, 9]) || artifact.cohort.protocolsPooled !== false) fail("cohort boundary differs");
  if (!Array.isArray(artifact.backgrounds) || !same(artifact.backgrounds.map(({ sourceGeneration }) => sourceGeneration), GENERATIONS)) fail("background inventory differs");
  if (!Array.isArray(artifact.protocols) || !same(artifact.protocols.map(({ id }) => id), PROTOCOLS) || !same(artifact.protocols.map(({ replicates, independentCitPlusMutants }) => [replicates, independentCitPlusMutants]), [[72, 4], [340, 5], [2800, 8]])) fail("protocol inventory differs");
  const backgroundIds = new Set(artifact.backgrounds.map(({ id }) => id));
  const backgroundByGeneration = new Map(artifact.backgrounds.map((item) => [item.sourceGeneration, item]));
  for (const background of artifact.backgrounds) {
    const expectedId = `background:ara-3:${generationId(background.sourceGeneration)}`;
    const expectedLabel = background.sourceGeneration === 0 ? "Ancestor" : background.sourceGeneration.toLocaleString("en-US");
    if (background.id !== expectedId || background.nativeGenerationLabel !== expectedLabel || background.completeGenotypeAvailableInTable !== false || background.cloneIdentityAvailableInTable !== false || background.potentiationStatusFromGenerationAlone !== "unresolved") fail(`${background.id} identity boundary differs`);
  }
  if (!Array.isArray(artifact.observations) || artifact.observations.length !== 38 || new Set(artifact.observations.map(({ id }) => id)).size !== 38) fail("observation inventory differs");
  const observationKeys = new Set();
  for (const observation of artifact.observations) {
    const background = backgroundByGeneration.get(observation.sourceGeneration);
    const key = `${observation.experimentId}:${observation.sourceGeneration}`;
    const expectedId = `observation:${observation.experimentId}:${generationId(observation.sourceGeneration)}`;
    if (!PROTOCOLS.includes(observation.experimentId) || !background || !backgroundIds.has(observation.backgroundId) || observation.backgroundId !== background.id || observation.nativeGenerationLabel !== background.nativeGenerationLabel || observation.id !== expectedId || observationKeys.has(key) || !Number.isInteger(observation.replicates) || observation.replicates < 1 || !Number.isInteger(observation.independentCitPlusMutants) || observation.independentCitPlusMutants < 0 || observation.independentCitPlusMutants > observation.replicates || observation.outcomeStatus !== (observation.independentCitPlusMutants ? "observed" : "not-observed") || observation.absenceMeansImpossible !== false) fail(`${observation.id} differs`);
    observationKeys.add(key);
  }
  if (!same(PROTOCOLS.map((protocolId) => artifact.observations.filter(({ experimentId }) => experimentId === protocolId).reduce((totals, item) => [totals[0] + item.replicates, totals[1] + item.independentCitPlusMutants], [0, 0])), [[72, 4], [340, 5], [2800, 8]])) fail("observation totals differ");
  if (!Array.isArray(artifact.publishedStatistics) || artifact.publishedStatistics.length !== 3 || !same(artifact.publishedStatistics.map(({ experimentId, expectedMeanGeneration, observedMeanGeneration, meanShiftGenerations, publishedMonteCarloPValue, tableOneMeanMatchesPublishedExpected }) => [experimentId, expectedMeanGeneration, observedMeanGeneration, meanShiftGenerations, publishedMonteCarloPValue, tableOneMeanMatchesPublishedExpected]), [["replay-1", 24917, 31750, 6833, 0.0085, true], ["replay-2", 28382, 32100, 3718, 0.0007, false], ["replay-3", 22571, 27563, 4992, 0.0823, true]])) fail("published statistics differ");
  const assessments = artifact.reachability?.backgroundAssessments;
  if (!Array.isArray(assessments) || !same(assessments.map(({ sourceGeneration }) => sourceGeneration), GENERATIONS) || artifact.reachability.protocolsPooled !== false || artifact.reachability.completeMutationPathSpaceClaim !== false || artifact.reachability.combinedPValueRecomputed !== false || assessments.some(({ impossibilityClaim, protocolsPooled }) => impossibilityClaim || protocolsPooled)) fail("reachability boundary differs");
  for (const assessment of assessments) {
    const background = backgroundByGeneration.get(assessment.sourceGeneration);
    const selected = artifact.observations.filter(({ sourceGeneration }) => sourceGeneration === assessment.sourceGeneration);
    const observedExperimentIds = PROTOCOLS.filter((protocolId) => selected.some(({ experimentId }) => experimentId === protocolId));
    const citPlusObservedExperimentIds = PROTOCOLS.filter((protocolId) => selected.some(({ experimentId, independentCitPlusMutants }) => experimentId === protocolId && independentCitPlusMutants > 0));
    const observed = citPlusObservedExperimentIds.length > 0;
    if (!background || assessment.backgroundId !== background.id || !same(assessment.observedExperimentIds, observedExperimentIds) || !same(assessment.citPlusObservedExperimentIds, citPlusObservedExperimentIds) || assessment.boundedOutcomeStatus !== (observed ? "observed" : "not-observed") || assessment.accessibilityStatus !== (observed ? "supported-in-at-least-one-bounded-replay" : "unresolved")) fail(`${assessment.backgroundId} assessment differs`);
  }
  if (!same(assessments.filter(({ boundedOutcomeStatus }) => boundedOutcomeStatus === "observed").map(({ sourceGeneration }) => sourceGeneration), [20000, 27000, 30500, 31000, 31500, 32000, 32500])) fail("bounded observed-background set differs");
  if (artifact.sourceDiscrepancies?.length !== 1 || !same([artifact.sourceDiscrepancies[0].id, artifact.sourceDiscrepancies[0].publishedExpectedMeanGeneration, artifact.sourceDiscrepancies[0].tableOneReplicateWeightedMeanGeneration], ["published-expected-mean:replay-2", 28382, 26382])) fail("source discrepancy differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null || artifact.audit?.impossibilityClaims !== 0 || artifact.audit.protocolsPooled !== 0 || artifact.audit.causalMutationEdges !== 0 || artifact.audit.completeGenotypesInvented !== 0 || artifact.audit.replayHistoriesPromotedToOriginalHistory !== 0 || artifact.audit.liveQueriesDuringBuild !== 0) fail("epistemic boundary differs");

  const protocols = new Map(artifact.protocols.map((item) => [item.id, item]));
  const backgrounds = new Map(artifact.backgrounds.map((item) => [item.sourceGeneration, item]));
  const observations = new Map(artifact.observations.map((item) => [`${item.experimentId}:${item.sourceGeneration}`, item]));
  const statistics = new Map(artifact.publishedStatistics.map((item) => [item.experimentId, item]));
  const assessmentMap = new Map(assessments.map((item) => [item.sourceGeneration, item]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    source: artifact.source,
    methodology: artifact.methodology,
    cohort: artifact.cohort,
    generations: GENERATIONS,
    protocolIds: PROTOCOLS,
    protocols: artifact.protocols,
    backgrounds: artifact.backgrounds,
    observations: artifact.observations,
    publishedStatistics: artifact.publishedStatistics,
    reachability: artifact.reachability,
    publishedInterpretation: artifact.publishedInterpretation,
    sourceDiscrepancies: artifact.sourceDiscrepancies,
    historicalLoad: artifact.historicalLoad,
    nonClaims: artifact.nonClaims,
    audit: artifact.audit,
    protocol(id) { const value = protocols.get(id); if (!value) fail(`unknown protocol ${id}`); return value; },
    background(value) { const generation = generationKey(value); const item = backgrounds.get(generation); if (!item) fail(`unknown generation ${value}`); return item; },
    observation(protocolId, value) { if (!protocols.has(protocolId)) fail(`unknown protocol ${protocolId}`); const generation = generationKey(value); if (!backgrounds.has(generation)) fail(`unknown generation ${value}`); return observations.get(`${protocolId}:${generation}`) ?? null; },
    statistic(id) { const value = statistics.get(id); if (!value) fail(`unknown protocol ${id}`); return value; },
    assessment(value) { const generation = generationKey(value); const item = assessmentMap.get(generation); if (!item) fail(`unknown generation ${value}`); return item; }
  });
}
