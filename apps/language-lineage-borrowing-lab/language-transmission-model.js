const COHORT = Object.freeze(["roma1327", "lowe1385", "oldh1241", "dutc1256", "stan1293", "mana1288"]);
const BORROWINGS = Object.freeze(["5", "10030", "11349", "15734"]);
const VERDICTS = Object.freeze([[false, true, false, false], [false, false, false, false], [false, true, false, true]]);
function fail(message) { throw new Error(`Language Transmission artifact invalid: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

export function createLanguageTransmissionModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-historical-linguistics-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "historical-linguistics-v1") fail("unsupported artifact version");
  if (!/^sha256:[0-9a-f]{64}$/.test(artifact.caseIdentity ?? "") || !/^sha256:[0-9a-f]{64}$/.test(artifact.source?.identity ?? "")) fail("case or source identity is invalid");
  if (artifact.source.liveNetworkRequiredByBuild !== false || !same(artifact.source.releases.map((release) => [release.id, release.release]), [["glottolog", "v5.3"], ["lexibank-wold", "v4.2"]])) fail("source release boundary differs");
  if (!same(artifact.languages?.map((language) => language.glottocode), COHORT) || new Set(artifact.languages.map((language) => language.glottocode)).size !== 6) fail("cohort identity differs");
  if (artifact.languages.some((language) => language.identifierMapping.status !== "matched-by-glottocode" || language.classificationClaim.groundTruthClaim !== false)) fail("identifier or classification boundary differs");
  if (!same(artifact.borrowings?.map((borrowing) => borrowing.id), BORROWINGS) || artifact.borrowings.some((borrowing) => borrowing.genealogicalParent !== false || borrowing.generalizedBeyondTargetForm !== false)) fail("borrowing boundary differs");
  const flagship = artifact.borrowings[0];
  if (flagship.sourceGlottocode !== "stan1293" || flagship.recipientGlottocode !== "mana1288" || flagship.crossTopLevelFamily !== true || flagship.sourceCertain !== true || flagship.targetBorrowedScore !== 0.5) fail("flagship uncertainty differs");
  if (artifact.genealogy?.edges?.length !== 40 || artifact.genealogy.edges.some((edge) => edge.genealogical !== true)) fail("classification layer differs");
  if (artifact.surfaceComparisons?.length !== 4 || artifact.surfaceComparisons.some((comparison) => comparison.createsCognacy || comparison.createsGenealogy || comparison.cognacyStatus !== "not-asserted")) fail("surface-similarity boundary differs");
  const verdicts = artifact.historyEquivalence?.comparisons?.map((comparison) => comparison.results.map((result) => result.equal));
  if (!same(verdicts, VERDICTS)) fail("equivalence matrix differs");
  if (artifact.reconstruction.newPhylogenyInferred !== false || artifact.reconstruction.cognacyAssertions !== 0 || artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("analysis boundary differs");
  const languages = new Map(artifact.languages.map((language) => [language.glottocode, language]));
  const borrowings = new Map(artifact.borrowings.map((borrowing) => [borrowing.id, borrowing]));
  const similarities = new Map(artifact.surfaceComparisons.map((comparison) => [comparison.borrowingId, comparison]));
  const comparisons = new Map(artifact.historyEquivalence.comparisons.map((comparison) => [comparison.id, comparison]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity, sourceIdentity: artifact.source.identity, retrievedOn: artifact.source.retrievedOn, releases: artifact.source.releases,
    concept: artifact.concept, cohort: artifact.cohort, languages: artifact.languages, genealogy: artifact.genealogy, borrowings: artifact.borrowings,
    surfaceComparisons: artifact.surfaceComparisons, regimes: artifact.historyEquivalence.regimes, comparisons: artifact.historyEquivalence.comparisons,
    reconstruction: artifact.reconstruction, historicalLoad: artifact.historicalLoad, boundary: artifact.evidenceBoundary,
    language(glottocode) { const value = languages.get(glottocode); if (!value) throw new RangeError(`Unknown Glottocode ${glottocode}.`); return value; },
    borrowing(id) { const value = borrowings.get(id); if (!value) throw new RangeError(`Unknown borrowing ${id}.`); return value; },
    similarity(id) { const value = similarities.get(id); if (!value) throw new RangeError(`Unknown borrowing comparison ${id}.`); return value; },
    comparison(id) { const value = comparisons.get(id); if (!value) throw new RangeError(`Unknown language comparison ${id}.`); return value; }
  });
}
