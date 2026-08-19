const WITNESSES = Object.freeze(["Cx1", "Cx2", "Pn", "Wy", "Hg", "Ch", "El"]);
const SITES = Object.freeze(["mi-65-silk-grene", "mi-511-cogheth-knocketh"]);
const RELATIONS = Object.freeze(["base-text:Cx1:Cx2", "correction-source:better-copy:Cx2", "copy:Cx2:Pn", "copy:Cx2:Wy"]);
const VERDICTS = Object.freeze([[false, true, true, false], [false, true, true, true], [false, false, true, false]]);
const ABLATIONS = Object.freeze(["full-evidence", "without-correction-profile", "without-published-correction-claim", "without-example-sites"]);

function fail(message) { throw new Error(`Manuscript Stemmatics artifact invalid: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

export function createManuscriptTransmissionModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-manuscript-stemmatics-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "manuscript-stemmatics-v1") fail("unsupported artifact version");
  if (!/^sha256:[0-9a-f]{64}$/.test(artifact.caseIdentity ?? "") || !/^sha256:[0-9a-f]{64}$/.test(artifact.source?.identity ?? "")) fail("case or source identity is invalid");
  if (artifact.source.liveNetworkRequiredByBuild !== false || artifact.source.upstreamFiles?.length !== 3) fail("source lock differs");
  if (artifact.corpus?.id !== "new-stemmatics-millers-tale-link-1" || artifact.corpus.witnessCount !== 58 || artifact.corpus.variantCharacterCount !== 4032 || artifact.corpus.nexusTaxa !== 59 || artifact.corpus.collationBaseCount !== 1) fail("corpus census differs");
  if (!same(artifact.selection?.witnessIds, WITNESSES) || !same(artifact.selection?.readingSiteIds, SITES) || artifact.selection.representativeSampleClaim !== false || artifact.selection.fullCollationReconstructionClaim !== false) fail("bounded selection differs");
  if (artifact.missingData?.substantiallyIncompleteWitnessCount !== 4 || artifact.missingData.exactMissingRates !== null || artifact.missingData.selectedCellMissingnessClaim !== "not-evaluated") fail("missing-data boundary differs");
  if (!same(artifact.witnesses?.map((witness) => witness.id), WITNESSES) || new Set(artifact.witnesses.map((witness) => witness.identity)).size !== 7) fail("witness inventory differs");
  if (!same(artifact.readingSites?.map((site) => site.id), SITES) || artifact.readingSites.some((site) => site.createsAncestry !== false)) fail("reading-site boundary differs");
  if (artifact.quantitativeProfiles?.correctionProfile?.count !== 207 || artifact.quantitativeProfiles.bGroupVariantTotal !== 222) fail("published quantitative profile differs");
  if (!same(artifact.transmission?.relations?.map((relation) => relation.id), RELATIONS)) fail("transmission inventory differs");
  if (artifact.transmission.relations.some((relation) => relation.origin !== "published-analysis" || relation.directObservation !== false || relation.physicalExemplarIdentityResolved !== false)) fail("transmission evidence status differs");
  const contamination = artifact.transmission.relations.filter((relation) => relation.contamination);
  if (contamination.length !== 1 || contamination[0].source !== "better-copy" || contamination[0].target !== "Cx2" || contamination[0].treeCompatible !== false || contamination[0].relationLayer !== "attributed-contamination") fail("contamination boundary differs");
  const exemplar = artifact.transmission.unresolvedExemplars?.[0];
  if (exemplar?.id !== "better-copy" || exemplar.extantWitness !== false || exemplar.exactIdentity !== null || exemplar.inventedByOnto2D !== false) fail("unresolved exemplar differs");
  if (artifact.agreementComparisons?.length !== 3 || artifact.agreementComparisons.some((comparison) => comparison.selectionBiased !== true || comparison.representativeOfFullCollation !== false || comparison.createsTransmissionRelation !== false || comparison.createsAncestry !== false)) fail("agreement boundary differs");
  if (!same(artifact.evidenceAblation?.map((ablation) => ablation.id), ABLATIONS) || artifact.evidenceAblation.some((ablation) => ablation.removedEvidenceRetained !== false)) fail("ablation inventory differs");
  const verdicts = artifact.historyEquivalence?.comparisons?.map((comparison) => comparison.results.map((result) => result.equal));
  if (!same(verdicts, VERDICTS)) fail("history-equivalence matrix differs");
  if (artifact.reconstruction?.status !== "partial" || artifact.reconstruction.actualPastClaim !== false || artifact.reconstruction.centralRootingResolved !== false || artifact.reconstruction.candidateHistories?.length !== 0) fail("reconstruction boundary differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  const witnessIndex = new Map(artifact.witnesses.map((witness) => [witness.id, witness]));
  const agreementIndex = new Map(artifact.agreementComparisons.map((comparison) => [comparison.id, comparison]));
  const comparisonIndex = new Map(artifact.historyEquivalence.comparisons.map((comparison) => [comparison.id, comparison]));
  const ablationIndex = new Map(artifact.evidenceAblation.map((ablation) => [ablation.id, ablation]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    retrievedAt: artifact.source.retrievedAt,
    source: artifact.source,
    corpus: artifact.corpus,
    selection: artifact.selection,
    missingData: artifact.missingData,
    witnesses: artifact.witnesses,
    sites: artifact.readingSites,
    profiles: artifact.quantitativeProfiles,
    claims: artifact.scholarlyClaims,
    transmission: artifact.transmission,
    agreements: artifact.agreementComparisons,
    reconstruction: artifact.reconstruction,
    ablations: artifact.evidenceAblation,
    regimes: artifact.historyEquivalence.regimes,
    comparisons: artifact.historyEquivalence.comparisons,
    historicalLoad: artifact.historicalLoad,
    boundary: artifact.evidenceBoundary,
    witness(id) { const value = witnessIndex.get(id); if (!value) throw new RangeError(`Unknown witness ${id}.`); return value; },
    agreement(id) { const value = agreementIndex.get(id); if (!value) throw new RangeError(`Unknown agreement ${id}.`); return value; },
    comparison(id) { const value = comparisonIndex.get(id); if (!value) throw new RangeError(`Unknown comparison ${id}.`); return value; },
    ablation(id) { const value = ablationIndex.get(id); if (!value) throw new RangeError(`Unknown ablation ${id}.`); return value; }
  });
}
