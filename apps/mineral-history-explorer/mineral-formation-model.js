const SAMPLE_IDS = Object.freeze(["79990", "HP8-319.8", "RI08-24-477.67", "CD13829", "DD86WRL1-681", "DD86WRL1-729.91", "176898", "V3-651", "PETR14", "DLR7_146.5m"]);
const CLAIMED = Object.freeze(["DD86WRL1-681", "PETR14", "79990"]);
const REGIMES = Object.freeze(["conventional-species", "sample-record", "published-formation-profile"]);
const ELEMENT_COLUMNS = Object.freeze({ Co: "J", Ni: "K", Cu: "L", As: "N", Se: "O", Ag: "Q", Sb: "S" });

function fail(message) { throw new Error(`Mineral Formation artifact invalid: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

export function createMineralFormationModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-mineral-formation-history-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "gregory-2019-pyrite-formation-interpretation-v1") fail("unsupported artifact version");
  if (artifact.caseIdentity !== "sha256:10b59cb71e26bb07e7a88139f639d5a416d20674b63ff5165a75d03d1b23cf9c" || !/^sha256:[0-9a-f]{64}$/.test(artifact.source?.identity ?? "")) fail("case or source identity differs");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.dataset?.doi !== "10.17632/h2n4b8cczy.1" || artifact.source.article?.doi !== "10.1016/j.gca.2019.05.035") fail("source boundary differs");
  if (artifact.species?.name !== "Pyrite" || artifact.species.formula !== "FeS2" || !same(artifact.samples?.map(({ sampleId }) => sampleId), SAMPLE_IDS)) fail("sample cohort differs");
  if (artifact.analyses?.length !== 95 || new Set(artifact.analyses.map(({ analysisId }) => analysisId)).size !== 95) fail("analysis inventory differs");
  if (new Set(artifact.analyses.map(({ identity }) => identity)).size !== 95 || new Set(artifact.samples.map(({ identity }) => identity)).size !== 10) fail("artifact identities repeat");
  if (!same(artifact.formationClaims?.map(({ sampleId }) => sampleId), CLAIMED) || artifact.formationClaims.some(({ qualifier }) => !["predominantly", "interpreted"].includes(qualifier))) fail("published claim boundary differs");
  if (!same(artifact.identityRegimes?.map(({ id, classes, unresolved }) => [id, classes.length, unresolved.length]), [[REGIMES[0], 1, 0], [REGIMES[1], 10, 0], [REGIMES[2], 3, 7]])) fail("identity regime boundary differs");
  if (artifact.measurementColumns?.X !== "Pb_Py" || artifact.measurementColumns?.Y !== "Pb_Py" || artifact.measurementColumns?.Z !== "Pb_Py") fail("duplicate source columns were rewritten");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  if (artifact.audit?.automaticFormationClassifications || artifact.audit.localityToFormationInferences || artifact.audit.ageToFormationInferences || artifact.audit.onto2dGeneratedCausalEdges || artifact.audit.liveQueriesDuringBuild) fail("epistemic audit differs");

  const sampleById = new Map(artifact.samples.map((sample) => [sample.sampleId, sample]));
  const sampleByIdentity = new Map(artifact.samples.map((sample) => [sample.identity, sample]));
  const analysesBySample = new Map(SAMPLE_IDS.map((sampleId) => [sampleId, Object.freeze(artifact.analyses.filter((analysis) => analysis.sampleId === sampleId))]));
  const claimBySample = new Map(artifact.formationClaims.map((claim) => [claim.sampleId, claim]));
  const regimeById = new Map(artifact.identityRegimes.map((regime) => [regime.id, regime]));
  for (const analysis of artifact.analyses) if (!sampleById.has(analysis.sampleId)) fail(`analysis ${analysis.analysisId} has an unresolved sample`);
  for (const sample of artifact.samples) {
    const analyses = analysesBySample.get(sample.sampleId);
    if (!same(analyses.map(({ identity }) => identity), sample.analysisIdentities) || analyses.length !== sample.measurementSummary.analysisCount || sample.measurementSummary.sampleId !== sample.sampleId) fail(`sample ${sample.sampleId} analysis membership differs`);
    const hasClaim = claimBySample.has(sample.sampleId);
    if (hasClaim !== (sample.formationMappingStatus === "reviewed-published-interpretation")) fail(`sample ${sample.sampleId} formation status differs`);
  }
  for (const claim of artifact.formationClaims) if (sampleById.get(claim.sampleId)?.identity !== claim.sampleIdentity) fail(`claim ${claim.id} has an unresolved sample identity`);
  for (const regime of artifact.identityRegimes) {
    const members = regime.classes.flatMap(({ members: classMembers }) => classMembers);
    const represented = [...members, ...regime.unresolved];
    if (new Set(represented).size !== represented.length || represented.some((identity) => !sampleByIdentity.has(identity)) || !same([...represented].sort(), [...sampleByIdentity.keys()].sort())) fail(`regime ${regime.id} membership differs`);
  }
  freeze(artifact);

  function analysesForSample(sampleId) { if (!analysesBySample.has(sampleId)) throw new RangeError(`Unknown sample ${sampleId}.`); return analysesBySample.get(sampleId); }

  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    source: artifact.source,
    cohort: artifact.cohort,
    species: artifact.species,
    samples: artifact.samples,
    formationClaims: artifact.formationClaims,
    identityRegimes: artifact.identityRegimes,
    historicalLoad: artifact.historicalLoad,
    nonClaims: artifact.nonClaims,
    sample(sampleId) { const sample = sampleById.get(sampleId); if (!sample) throw new RangeError(`Unknown sample ${sampleId}.`); return sample; },
    claim(sampleId) { return claimBySample.get(sampleId) ?? null; },
    analyses: analysesForSample,
    regime(regimeId) { const regime = regimeById.get(regimeId); if (!regime) throw new RangeError(`Unknown regime ${regimeId}.`); return regime; },
    traceSeries(sampleId, element) {
      const sourceColumn = ELEMENT_COLUMNS[element];
      if (!sourceColumn) throw new RangeError(`Unknown trace element ${element}.`);
      return Object.freeze(analysesForSample(sampleId).map((analysis) => Object.freeze({ analysisId: analysis.analysisId, sequence: analysis.sequence, value: typeof analysis.valuesBySourceColumn[sourceColumn] === "number" ? analysis.valuesBySourceColumn[sourceColumn] : null })));
    }
  });
}

export { ELEMENT_COLUMNS, REGIMES, SAMPLE_IDS };
