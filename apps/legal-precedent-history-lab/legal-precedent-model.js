const CASE_IDENTITY = "sha256:158c1bb5be38b6f9e9f2cd4f32ad3a90f2d3ff20b55369067c86b590c3024691";
const SOURCE_IDENTITY = "sha256:c00fb2bfaa39431c5903b8f195d543f9a8f3e7e26a70910b4ac1a5e2cc8f0915";
const CONTEXT_IDENTITY = "sha256:1890b577ed7d60532c3262156ff8539bd401e20792dcd1dbf82330694331150a";
const OPINION_IDS = ["brown-i", "brown-ii", "cooper", "griffin", "green", "alexander", "swann"];
const PRIOR_IDS = ["brown-i", "brown-ii", "cooper", "griffin"];
const FUTURE_IDS = ["alexander", "swann"];

function fail(message) { throw new TypeError(`Legal Precedent artifact rejected: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

export function createLegalPrecedentModel(input) {
  if (!isRecord(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-legal-precedent-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "scotus-school-desegregation-green-v1") fail("format or version differs");
  if (artifact.caseIdentity !== CASE_IDENTITY || artifact.source?.identity !== SOURCE_IDENTITY || artifact.availability?.identity !== CONTEXT_IDENTITY) fail("case, source, or context release differs");
  if (!Array.isArray(artifact.opinions) || !same(artifact.opinions.map((opinion) => opinion.id), OPINION_IDS) || artifact.cohort?.opinionCount !== 7 || artifact.cohort?.completeDoctrinalCorpus !== false) fail("opinion cohort differs");
  if (!Array.isArray(artifact.citations) || artifact.citations.length !== 16 || new Set(artifact.citations.map((edge) => edge.id)).size !== 16) fail("citation inventory differs");
  const byId = new Map(artifact.opinions.map((opinion) => [opinion.id, opinion]));
  if (artifact.opinions.some((opinion) => opinion.courtId !== "scotus" || !/^\d{4}-\d{2}-\d{2}$/.test(opinion.officialDecisionDate))) fail("opinion court or date differs");
  for (const edge of artifact.citations) {
    const citing = byId.get(edge.citingOpinionId); const cited = byId.get(edge.citedOpinionId);
    if (!citing || !cited || cited.officialDecisionDate >= citing.officialDecisionDate || edge.relation !== "cites" || edge.bindingStatus !== "unknown" || edge.createsAuthority !== false) fail("citation chronology or semantics differ");
  }
  if (!same(artifact.availability.priorOpinionIds, PRIOR_IDS) || !same(artifact.availability.futureOpinionIds, FUTURE_IDS) || artifact.availability.targetOpinionId !== "green" || artifact.availability.cutoffDate !== "1968-05-27" || artifact.availability.futureInputEdgeCount !== 0 || artifact.availability.legalPredictionIncluded !== false) fail("Green time slice differs");
  if (!Array.isArray(artifact.normativeClaims) || artifact.normativeClaims.length !== 4 || artifact.normativeClaims.some((claim) => claim.citingOpinionId !== "green" || !PRIOR_IDS.includes(claim.citedOpinionId) || claim.bindingStatus !== "not-classified" || claim.inferredFromCitationCount !== false)) fail("attributed treatment layer differs");
  if (!same(artifact.dateDisagreements?.map((item) => item.opinionId), ["cooper", "swann"])) fail("provider date disagreements differ");
  if (artifact.counterfactual?.removedOpinionId !== "brown-ii" || artifact.counterfactual?.baseDerivedEdgeCount !== 10 || artifact.counterfactual?.remainingDerivedEdgeCount !== 6 || artifact.counterfactual?.sourceGraphMutated !== false || artifact.counterfactual?.legalConclusionAllowed !== false) fail("counterfactual boundary differs");
  if (artifact.audit?.bindingClaims !== 0 || artifact.audit?.citationCountsUsedInDerivation !== false || artifact.audit?.courtHierarchyGuessed !== false || artifact.audit?.legalAdviceGenerated !== false) fail("legal safety boundary differs");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad?.value !== null) fail("Historical Load boundary differs");

  freeze(artifact);
  const claimByCitation = new Map(artifact.normativeClaims.map((claim) => [claim.citationId, claim]));
  const contextIds = [...PRIOR_IDS, "green"];
  const baseContextEdges = freeze(artifact.citations.filter((edge) => contextIds.includes(edge.citingOpinionId) && contextIds.includes(edge.citedOpinionId)));
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    contextIdentity: artifact.availability.identity,
    retrievedAt: artifact.cohort.retrievedAt,
    cohort: artifact.cohort,
    opinions: artifact.opinions,
    citations: artifact.citations,
    claims: artifact.normativeClaims,
    dateDisagreements: artifact.dateDisagreements,
    availability: artifact.availability,
    counterfactual: artifact.counterfactual,
    historicalLoad: artifact.historicalLoad,
    legalDisclaimer: artifact.legalDisclaimer,
    nonClaims: artifact.nonClaims,
    opinion(id) { const opinion = byId.get(id); if (!opinion) fail(`unknown opinion ${id}`); return opinion; },
    claimForCitation(id) { return claimByCitation.get(id) ?? null; },
    graph({ fullRecord = false, withholdBrownII = false } = {}) {
      const selectedIds = fullRecord ? [...OPINION_IDS] : [...contextIds];
      const visibleIds = withholdBrownII ? selectedIds.filter((id) => id !== "brown-ii") : selectedIds;
      const visible = new Set(visibleIds);
      const edges = artifact.citations.filter((edge) => visible.has(edge.citingOpinionId) && visible.has(edge.citedOpinionId));
      return freeze({ opinions: visibleIds.map((id) => byId.get(id)), citations: edges, withheldOpinionIds: withholdBrownII ? ["brown-ii"] : [], excludedFutureOpinionIds: fullRecord ? [] : [...FUTURE_IDS], sourceOpinionCount: artifact.opinions.length, sourceCitationCount: artifact.citations.length, sourceGraphMutated: false });
    },
    greenMatrix() {
      return freeze(artifact.citationVsNormativeStatus.map((row) => ({ ...row, opinion: byId.get(row.citedOpinionId), claim: claimByCitation.get(row.citationId) ?? null })));
    },
    sourceContextEdges: baseContextEdges
  });
}
