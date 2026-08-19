import { canonicalClone, hashCanonical } from "@onto2d/kernel";
import { buildModelPack } from "@onto2d/model-pack";
import { verifyHistoricalLinguisticsCaseIdentity } from "../../cases/historical-linguistics/extract.mjs";

export const LANGUAGE_TRANSMISSION_MAPPING_VERSION = "language-transmission-mapping-v1";
const RELEASE_DOMAIN = "onto2d:language-transmission-model-release:v1";
const AUDIT_DOMAIN = "onto2d:language-transmission-model-audit:v1";
const EDGE_DOMAIN = "onto2d:language-transmission-model-edge:v1";
const EXPECTED_MATRIX = [[false, true, false, false], [false, false, false, false], [false, true, false, true]];
function fail(message) { throw new TypeError(`language-transmission Model Pack compilation failed: ${message}`); }
function edgeId(relation, source, target, key = "") { return `${relation}:${hashCanonical(EDGE_DOMAIN, { relation, source, target, key }).slice(7, 27)}`; }

export function compileLanguageTransmissionModelPack(input) {
  let artifact;
  try { artifact = verifyHistoricalLinguisticsCaseIdentity(input); } catch (error) { fail(error.message); }
  if (artifact.languages.length !== 6 || artifact.borrowings.length !== 4 || artifact.genealogy.edges.length !== 40) fail("case inventory differs");
  if (artifact.borrowings.some((borrowing) => borrowing.genealogicalParent !== false)) fail("a borrowing relation was promoted to genealogy");
  if (JSON.stringify(artifact.historyEquivalence.comparisons.map((comparison) => comparison.results.map((result) => result.equal))) !== JSON.stringify(EXPECTED_MATRIX)) fail("equivalence matrix differs");

  const languageNodes = artifact.languages.map((language) => ({
    id: `language:${language.glottocode}`, name: language.name,
    description: `${language.name} as the stable Glottocode-joined language record shared by Glottolog 5.3 and WOLD/Lexibank 4.2.`,
    shortDescription: `${language.glottocode}; ${language.familyName}.`, entityKind: "language", typeRole: "language", phase: "source-record", scientificStatus: "source-joined",
    glottocode: language.glottocode, familyId: language.familyId, identifiers: language.identifiers, identifierMapping: language.identifierMapping, classificationClaim: language.classificationClaim
  }));
  const classificationNodes = artifact.genealogy.nodes.filter((node) => node.kind === "classification-group").map((node) => ({
    id: `classification:${node.id}`, name: node.name,
    description: "A versioned group on at least one selected Glottolog 5.3 classification path; preserved as an attributed classification claim.",
    shortDescription: `${node.id}; Glottolog 5.3.`, entityKind: "classification-group", typeRole: "genealogical-classification", phase: "published-classification", scientificStatus: "attributed-claim", glottocode: node.id, release: node.release, groundTruthClaim: false
  }));
  const conceptNode = { id: `concept:${artifact.concept.id}`, name: artifact.concept.name, description: "The single WOLD/LWT core meaning selected so lexical histories can be compared without changing concepts.", shortDescription: `LWT ${artifact.concept.id}; Concepticon ${artifact.concept.concepticonId}.`, entityKind: "concept", typeRole: "lexical-concept", phase: "source-record", scientificStatus: "expert-curated", concepticonId: artifact.concept.concepticonId };
  const formNodes = artifact.languages.map((language) => ({
    id: `form:${language.lexicalForm.id}`, name: language.lexicalForm.form,
    description: `${language.name} form for ${artifact.concept.name}, retained with the WOLD borrowed-status label and score.`,
    shortDescription: `${language.lexicalForm.borrowedStatus}; score ${language.lexicalForm.borrowedScore}.`, entityKind: "lexical-form", typeRole: "lexical-form", phase: "source-record", scientificStatus: "expert-curated",
    formId: language.lexicalForm.id, languageGlottocode: language.glottocode, form: language.lexicalForm.form, segments: language.lexicalForm.segments, borrowedStatus: language.lexicalForm.borrowedStatus, borrowedScore: language.lexicalForm.borrowedScore, contributor: language.lexicalForm.contributor, reference: language.lexicalForm.reference, contactSituation: language.lexicalForm.contactSituation
  }));
  const cohortCodes = new Set(artifact.languages.map((language) => language.glottocode));
  const externalDonorNodes = [...new Map(artifact.borrowings.filter((borrowing) => !cohortCodes.has(borrowing.sourceGlottocode)).map((borrowing) => [borrowing.sourceGlottocode, borrowing])).values()].map((borrowing) => ({
    id: `donor:${borrowing.sourceGlottocode}`, name: borrowing.sourceLanguoid,
    description: "A WOLD source languoid referenced by the selected borrowing row but outside the six-language recipient cohort; no family path is added here.",
    shortDescription: `${borrowing.sourceGlottocode}; donor reference only.`, entityKind: "external-donor-languoid", typeRole: "external-donor", phase: "source-record", scientificStatus: "bounded-reference", glottocode: borrowing.sourceGlottocode, classificationInCohort: null
  }));
  const borrowingNodes = artifact.borrowings.map((borrowing) => ({
    id: `borrowing:${borrowing.id}`, name: `${borrowing.sourceLanguoid} → ${borrowing.recipientName}: ${borrowing.targetForm}`,
    description: "One expert-curated WOLD source relation for one target form. Source certainty and target borrowed-status uncertainty remain separate.",
    shortDescription: `${borrowing.sourceRelation}; target ${borrowing.targetBorrowedStatus}.`, entityKind: "borrowing-record", typeRole: "horizontal-transmission", phase: "expert-interpretation", scientificStatus: borrowing.targetBorrowedScore === 1 ? "clearly-borrowed" : "perhaps-borrowed",
    borrowingId: borrowing.id, sourceGlottocode: borrowing.sourceGlottocode, recipientGlottocode: borrowing.recipientGlottocode, sourceWord: borrowing.sourceWord, targetForm: borrowing.targetForm, sourceCertain: borrowing.sourceCertain, targetBorrowedStatus: borrowing.targetBorrowedStatus, targetBorrowedScore: borrowing.targetBorrowedScore, crossTopLevelFamily: borrowing.crossTopLevelFamily, genealogicalParent: false, generalizedBeyondTargetForm: false
  }));
  const similarityNodes = artifact.surfaceComparisons.map((comparison) => ({
    id: `similarity:${comparison.borrowingId}`, name: `${comparison.source} / ${comparison.target}`,
    description: "A display-only Unicode edit comparison. It is neither phonological analysis nor a cognacy assertion.",
    shortDescription: `similarity ${comparison.similarity}; cognacy not asserted.`, entityKind: "surface-comparison", typeRole: "similarity-signal", phase: "derived-analysis", scientificStatus: "non-evidentiary-signal", ...comparison
  }));
  const regimeNodes = artifact.historyEquivalence.regimes.map((regime) => ({ id: `regime:${regime.id}`, name: regime.label, description: regime.question, shortDescription: `${regime.fields.length} exact field(s).`, entityKind: "equivalence-regime", typeRole: "equivalence-regime", phase: "derived-analysis", scientificStatus: "declared-profile", regimeId: regime.id, comparedFields: regime.fields }));
  const comparisonNodes = artifact.historyEquivalence.comparisons.map((comparison) => ({ id: `comparison:${comparison.id}`, name: comparison.label, description: "Two distinct language records compared under four independent equivalence regimes.", shortDescription: `${comparison.results.filter((result) => result.equal).length}/4 regimes equal.`, entityKind: "language-comparison", typeRole: "history-comparison", phase: "derived-analysis", scientificStatus: "deterministically-derived", comparisonId: comparison.id, left: comparison.left, right: comparison.right }));
  const verdictNodes = artifact.historyEquivalence.comparisons.flatMap((comparison) => comparison.results.map((result) => ({ id: `verdict:${comparison.id}:${result.regimeId}`, name: `${comparison.label} / ${result.label}`, description: result.equal ? "The exact projections are equal under this regime." : `The exact projections differ in ${result.differingFields.join(", ")}.`, shortDescription: result.equal ? "EQUIVALENT in this regime." : "DISTINCT in this regime.", entityKind: "equivalence-verdict", typeRole: "regime-verdict", phase: "derived-analysis", scientificStatus: "deterministically-derived", comparisonId: comparison.id, regimeId: result.regimeId, equal: result.equal, differingFields: result.differingFields })));
  const loadBoundary = { id: "boundary:historical-load-not-evaluated", name: "Historical Load is undefined", description: artifact.historicalLoad.reason, shortDescription: "No route space, admissibility rule, or cost functional.", entityKind: "analysis-boundary", typeRole: "historical-load-boundary", phase: "evidence-boundary", scientificStatus: "explicitly-not-evaluated", value: null };
  const nodes = [...classificationNodes, ...languageNodes, conceptNode, ...formNodes, ...externalDonorNodes, ...borrowingNodes, ...similarityNodes, ...regimeNodes, ...comparisonNodes, ...verdictNodes, loadBoundary];
  const edges = [];
  for (const edge of artifact.genealogy.edges) edges.push({ id: edgeId("published-classification-parent", edge.parent, edge.child), source: artifact.languages.some((language) => language.glottocode === edge.parent) ? `language:${edge.parent}` : `classification:${edge.parent}`, target: artifact.languages.some((language) => language.glottocode === edge.child) ? `language:${edge.child}` : `classification:${edge.child}`, relation: "published-classification-parent", relationLayer: "genealogical-classification", evidenceClass: "glottolog-classification-path", evidenceStatus: "attributed-claim", genealogical: true });
  for (const language of artifact.languages) {
    const formId = `form:${language.lexicalForm.id}`;
    edges.push({ id: edgeId("records-form", `language:${language.glottocode}`, formId), source: `language:${language.glottocode}`, target: formId, relation: "records-form", relationLayer: "lexical-record", evidenceClass: "wold-form-row", evidenceStatus: "expert-curated" });
    edges.push({ id: edgeId("expresses-concept", formId, conceptNode.id), source: formId, target: conceptNode.id, relation: "expresses-concept", relationLayer: "lexical-record", evidenceClass: "wold-parameter-row", evidenceStatus: "expert-curated" });
  }
  for (const borrowing of artifact.borrowings) {
    const recordId = `borrowing:${borrowing.id}`; const donorId = cohortCodes.has(borrowing.sourceGlottocode) ? `language:${borrowing.sourceGlottocode}` : `donor:${borrowing.sourceGlottocode}`;
    edges.push({ id: edgeId("records-donor", recordId, donorId), source: recordId, target: donorId, relation: "records-donor", relationLayer: "horizontal-transmission", evidenceClass: "wold-borrowing-row", evidenceStatus: borrowing.targetBorrowedStatus, genealogical: false });
    edges.push({ id: edgeId("targets-form", recordId, `form:${borrowing.targetFormId}`), source: recordId, target: `form:${borrowing.targetFormId}`, relation: "targets-form", relationLayer: "horizontal-transmission", evidenceClass: "wold-borrowing-row", evidenceStatus: borrowing.targetBorrowedStatus, genealogical: false });
    edges.push({ id: edgeId("compares-surface", `similarity:${borrowing.id}`, recordId), source: `similarity:${borrowing.id}`, target: recordId, relation: "compares-surface", relationLayer: "similarity", evidenceClass: "unicode-edit-distance", evidenceStatus: "non-evidentiary", genealogical: false });
  }
  for (const comparison of artifact.historyEquivalence.comparisons) {
    const id = `comparison:${comparison.id}`;
    edges.push({ id: edgeId("compares-left", id, `language:${comparison.left}`), source: id, target: `language:${comparison.left}`, relation: "compares-left", relationLayer: "analysis", evidenceClass: "declared-pair", evidenceStatus: "derived" });
    edges.push({ id: edgeId("compares-right", id, `language:${comparison.right}`), source: id, target: `language:${comparison.right}`, relation: "compares-right", relationLayer: "analysis", evidenceClass: "declared-pair", evidenceStatus: "derived" });
    for (const result of comparison.results) { const verdict = `verdict:${comparison.id}:${result.regimeId}`; edges.push({ id: edgeId("has-verdict", id, verdict), source: id, target: verdict, relation: "has-verdict", relationLayer: "analysis", evidenceClass: "exact-projection-comparison", evidenceStatus: "derived", equal: result.equal }); edges.push({ id: edgeId("evaluated-under", verdict, `regime:${result.regimeId}`), source: verdict, target: `regime:${result.regimeId}`, relation: "evaluated-under", relationLayer: "analysis", evidenceClass: "declared-equivalence-regime", evidenceStatus: "derived" }); }
    edges.push({ id: edgeId("bounded-by", id, loadBoundary.id), source: id, target: loadBoundary.id, relation: "bounded-by", relationLayer: "boundary", evidenceClass: "analysis-scope", evidenceStatus: "declared" });
  }
  const nodeIds = new Set(nodes.map((node) => node.id)); const edgeIds = new Set();
  if (nodeIds.size !== nodes.length) fail("compiled node IDs are not unique");
  for (const edge of edges) { if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) fail(`edge ${edge.id} has an unresolved endpoint`); if (edgeIds.has(edge.id)) fail(`edge ${edge.id} repeats`); edgeIds.add(edge.id); }
  const releaseIdentity = hashCanonical(RELEASE_DOMAIN, { mappingVersion: LANGUAGE_TRANSMISSION_MAPPING_VERSION, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity });
  const version = `v1-${releaseIdentity.slice(7, 23)}`;
  const audit = { mappingVersion: LANGUAGE_TRANSMISSION_MAPPING_VERSION, releaseIdentity, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, inventory: { languages: languageNodes.length, classificationGroups: classificationNodes.length, classificationEdges: artifact.genealogy.edges.length, forms: formNodes.length, borrowingRecords: borrowingNodes.length, surfaceSignals: similarityNodes.length, comparisons: comparisonNodes.length, verdicts: verdictNodes.length }, genealogicalBorrowingEdges: 0, cognacyAssertions: 0, historicalLoadStatus: artifact.historicalLoad.status };
  const sourceFiles = [...artifact.source.authoredFiles, ...artifact.source.snapshotFiles].map((file) => ({ path: `cases/historical-linguistics/${file.path}`, hash: file.identity }));
  return buildModelPack({ model: { id: "language-transmission", name: "Language Transmission", version, description: "Source-locked Glottolog genealogy and WOLD lexical borrowing kept as independent vertical, horizontal, and similarity layers.", status: "external-source-locked-historical-linguistics-case" }, source: { id: `historical-linguistics-${artifact.source.identity.slice(7, 23)}`, files: sourceFiles, auditHash: hashCanonical(AUDIT_DOMAIN, audit) }, nodes, edges, dictionaries: canonicalClone({
    provenance: { releases: artifact.source.releases, sourceIdentity: artifact.source.identity, caseIdentity: artifact.caseIdentity, releaseIdentity, mappingVersion: LANGUAGE_TRANSMISSION_MAPPING_VERSION },
    evidenceClasses: { "glottolog-classification-path": "Published Glottolog 5.3 path; attributed classification, not ground truth.", "wold-form-row": "Expert-curated WOLD/Lexibank lexical form row.", "wold-parameter-row": "WOLD/LWT selected meaning record.", "wold-borrowing-row": "One WOLD source relation local to one target form.", "unicode-edit-distance": "Display-only surface signal that creates neither cognacy nor genealogy.", "exact-projection-comparison": "Exact equality under one declared regime.", "analysis-scope": "Boundary making Historical Load undefined rather than zero." },
    identityRegimes: Object.fromEntries(artifact.historyEquivalence.regimes.map((regime) => [regime.id, regime.question])),
    presentation: { profile: "language-transmission-presentation-v1", nodeKindField: "entityKind", relationField: "relation", layerField: "phase", evidenceClassField: "evidenceClass", labels: { catalogTitle: "Language transmission evidence", searchPlaceholder: "Search languages, forms, families, borrowing records, and regimes", typeFilter: "Record kind", phaseFilter: "Evidence layer", statusFilter: "Evidence status", parents: "Incoming language or evidence relations", children: "Outgoing language or evidence relations" }, coordinates: [{ field: "typeRole", label: "Kind" }, { field: "scientificStatus", label: "Evidence" }], boundary: { title: "Genealogy / borrowing boundary", summary: "Published classification, lexical borrowing, and surface similarity remain separate relation layers.", note: "A loanword cannot create genealogical parentage; similarity cannot create cognacy; source certainty cannot erase target-status uncertainty; Historical Load is not evaluated." } }, audit
  }) });
}
