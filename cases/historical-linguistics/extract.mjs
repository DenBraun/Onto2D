import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "historical-linguistics.json");
const CASE_DOMAIN = "onto2d:historical-linguistics-case:v1";
const SOURCE_DOMAIN = "onto2d:historical-linguistics-source:v1";
const GENEALOGY_DOMAIN = "onto2d:historical-linguistics-genealogy:v1";
const PROJECTION_DOMAIN = "onto2d:historical-linguistics-equivalence:v1";
const APPROVED_CASE_IDENTITY = "sha256:b63e5b30783ab82d648372730804d842e6287d9acb6ca161f30cc00e9632c823";
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const HASH = /^[0-9a-f]{64}$/;
const IDENTITY = /^sha256:[0-9a-f]{64}$/;
const GLOTTOCODE = /^[a-z]{4}[0-9]{4}$/;
const COHORT = Object.freeze(["roma1327", "lowe1385", "oldh1241", "dutc1256", "stan1293", "mana1288"]);
const BORROWINGS = Object.freeze(["5", "10030", "11349", "15734"]);
const EXPECTED_VERDICTS = Object.freeze([
  [false, true, false, false],
  [false, false, false, false],
  [false, true, false, true]
]);

function fail(message) { throw new Error(`Historical Linguistics extraction failed: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function serialize(value) { return `${JSON.stringify(value, null, 2).replace(/[\u0080-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)}\n`; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function nonEmpty(value, label) { if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`); return value; }
function exactKeys(value, keys, label) { if (!isRecord(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail(`${label} fields differ`); }
function safePath(value, label) { if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a safe relative path`); return value; }

async function load(relative, limit = 128 * 1024) {
  safePath(relative, "input path");
  const bytes = await readFile(path.join(CASE_ROOT, relative));
  if (bytes.length < 1 || bytes.length > limit) fail(`${relative} is empty or exceeds ${limit} bytes`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail(`${relative} is not valid UTF-8`); }
  let value;
  try { value = JSON.parse(text); } catch { fail(`${relative} is not valid JSON`); }
  return { path: relative, bytes, value };
}

function sourceEntry(role, input) { return Object.freeze({ role, path: input.path, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length }); }

function validateUpstream(value) {
  exactKeys(value, ["format", "formatVersion", "retrievedOn", "liveNetworkRequiredByBuild", "sources", "snapshots", "selection"], "upstream lock");
  if (value.format !== "onto2d-historical-linguistics-upstream-lock" || value.formatVersion !== "1") fail("upstream lock version differs");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.retrievedOn) || value.liveNetworkRequiredByBuild !== false) fail("retrieval boundary differs");
  if (!Array.isArray(value.sources) || !same(value.sources.map((source) => [source.id, source.release]), [["glottolog", "v5.3"], ["lexibank-wold", "v4.2"]])) fail("source releases differ");
  for (const source of value.sources) {
    if (!/^https:\/\//.test(source.releaseUrl) || !/^https:\/\//.test(source.repository) || source.license?.spdx !== "CC-BY-4.0" || !source.citation) fail(`${source.id} attribution is incomplete`);
  }
  if (!Array.isArray(value.snapshots) || value.snapshots.length !== 2) fail("snapshot inventory differs");
  for (const snapshot of value.snapshots) {
    if (!HASH.test(snapshot.sha256) || !Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < 1 || !Array.isArray(snapshot.derivedFrom) || snapshot.derivedFrom.length < 2) fail(`${snapshot.role} source lock is invalid`);
    safePath(snapshot.path, `${snapshot.role}.path`);
  }
  if (value.selection.profile !== "wold-match-six-language-v1" || value.selection.conceptId !== "1-87" || value.selection.concepticonId !== "1133" || !same(value.selection.languageGlottocodes, COHORT) || !same(value.selection.borrowingIds, BORROWINGS) || value.selection.flagshipBorrowingId !== "5") fail("selection boundary differs");
  return value;
}

function validateGlottolog(value) {
  exactKeys(value, ["format", "formatVersion", "release", "citation", "license", "sourceFiles", "languages", "pathLanguoids"], "Glottolog selection");
  if (value.format !== "onto2d-glottolog-selection" || value.formatVersion !== "1" || value.release !== "v5.3" || value.license !== "CC-BY-4.0") fail("Glottolog selection version differs");
  if (!same(value.sourceFiles, {
    languages: { path: "cldf/languages.csv", sha256: "1a50a393bc81568b656f9522be18aa4f80f38e94309ba6c863d583234adfbb89" },
    classificationValues: { path: "cldf/values.csv", sha256: "a8601cb04ccc6a310538217f772d2461853aa0ea49e3bfe24c7396570fc4ea25" }
  })) fail("Glottolog full-file locks differ");
  if (!Array.isArray(value.languages) || !same(value.languages.map((language) => language.glottocode), COHORT)) fail("Glottolog cohort differs");
  const seen = new Set();
  for (const language of value.languages) {
    if (!GLOTTOCODE.test(language.glottocode) || language.level !== "language" || !GLOTTOCODE.test(language.familyId) || language.classificationPath?.[0] !== language.familyId || new Set(language.classificationPath).size !== language.classificationPath.length) fail(`${language.glottocode} classification is invalid`);
    for (const glottocode of language.classificationPath) {
      if (!GLOTTOCODE.test(glottocode) || typeof value.pathLanguoids[glottocode] !== "string") fail(`${language.glottocode} classification label is missing`);
      seen.add(glottocode);
    }
  }
  if (!seen.has("germ1287") || !seen.has("sorb1249") || !seen.has("roma1334") || !seen.has("mana1287")) fail("required classification branches are absent");
  return value;
}

function validateWold(value) {
  exactKeys(value, ["format", "formatVersion", "release", "commit", "citation", "license", "sourceFiles", "concept", "languages", "forms", "borrowings"], "WOLD selection");
  if (value.format !== "onto2d-wold-match-selection" || value.formatVersion !== "1" || value.release !== "v4.2" || value.commit !== "1df62b9" || value.license !== "CC-BY-4.0") fail("WOLD selection version differs");
  const expectedHashes = ["b4138940684e909c1c64bfb8f680d307c97b4deedf0732ee83ab92c097413084", "2a7e5f5bd981063758a018fa5b264d3e8ac63cf3768f38c56e6b18942a59a6c7", "66d1bdc8a5ae9259bdc1f23cf09c0835eab3a57246f65c39a8c71b6e92e8a8e4", "c06348f803fc4d5a607d60e8d94d8dfe47d09afae11f623ea3083a5998251964", "65472165e2f14d8b22467cb95f4a1573abe42a6b06383a8bf25a25bf45031f0a"];
  if (!same(Object.values(value.sourceFiles).map((file) => file.sha256), expectedHashes)) fail("WOLD full-file locks differ");
  if (value.concept?.id !== "1-87" || value.concept?.concepticonId !== "1133" || value.concept?.name !== "the match" || value.concept?.coreList !== true) fail("WOLD concept differs");
  if (!Array.isArray(value.languages) || !same(value.languages.map((language) => language.glottocode), COHORT)) fail("WOLD cohort differs");
  if (!Array.isArray(value.forms) || value.forms.length !== 6 || !same(value.forms.map((form) => form.languageId), value.languages.map((language) => language.id))) fail("WOLD form inventory differs");
  const languageIds = new Set(value.languages.map((language) => language.id));
  const formIds = new Set();
  for (const form of value.forms) {
    if (!languageIds.has(form.languageId) || form.parameterId !== "1-87" || formIds.has(form.id) || !Array.isArray(form.segments) || form.segments.length < 1 || ![0, 0.5, 1].includes(form.borrowedScore) || (form.loan && form.borrowedScore !== 1)) fail(`${form.id} is invalid`);
    formIds.add(form.id);
  }
  if (!Array.isArray(value.borrowings) || !same(value.borrowings.map((borrowing) => borrowing.id), BORROWINGS)) fail("WOLD borrowing inventory differs");
  for (const borrowing of value.borrowings) if (!formIds.has(borrowing.targetFormId) || borrowing.sourceRelation !== "immediate" || borrowing.sourceCertain !== true || !GLOTTOCODE.test(borrowing.sourceGlottocode)) fail(`borrowing ${borrowing.id} is invalid`);
  const flagship = value.borrowings[0];
  if (!same(flagship, { id: "5", targetFormId: "Manange-1-87-1", sourceRelation: "immediate", sourceWord: "match", sourceMeaning: "match", sourceCertain: true, sourceLanguoid: "English", sourceGlottocode: "stan1293" })) fail("flagship WOLD borrowing differs");
  return value;
}

function validateProfile(value) {
  exactKeys(value, ["format", "formatVersion", "profileVersion", "conceptId", "flagshipBorrowingId", "comparisonPairs", "equivalenceRegimes", "historicalLoad", "nonClaims"], "analysis profile");
  if (value.format !== "onto2d-language-transmission-analysis-profile" || value.formatVersion !== "1" || value.profileVersion !== "language-transmission-v1" || value.conceptId !== "1-87" || value.flagshipBorrowingId !== "5") fail("analysis profile version differs");
  if (!same(value.comparisonPairs.map((pair) => pair.id), ["english-dutch", "english-manange", "lower-sorbian-old-high-german"])) fail("comparison pair inventory differs");
  if (!same(value.equivalenceRegimes.map((regime) => regime.id), ["language-identifier", "genealogical-family", "lexical-state", "transmission-profile"])) fail("equivalence regime inventory differs");
  if (value.historicalLoad?.status !== "not-evaluated" || value.historicalLoad.value !== null || !/undefined rather than zero/.test(value.historicalLoad.reason ?? "")) fail("Historical Load boundary differs");
  if (!Array.isArray(value.nonClaims) || value.nonClaims.length < 8 || new Set(value.nonClaims).size !== value.nonClaims.length) fail("non-claim boundary is incomplete");
  return value;
}

function buildGenealogy(glottolog) {
  const nodes = new Map();
  const edges = new Map();
  for (const language of glottolog.languages) {
    for (const code of language.classificationPath) nodes.set(code, { id: code, name: glottolog.pathLanguoids[code], kind: "classification-group", evidenceState: "published-classification", release: glottolog.release });
    nodes.set(language.glottocode, { id: language.glottocode, name: language.name, kind: "language", evidenceState: "published-classification", release: glottolog.release });
    const chain = [...language.classificationPath, language.glottocode];
    for (let index = 1; index < chain.length; index += 1) {
      const parent = chain[index - 1]; const child = chain[index]; const key = `${parent}>${child}`;
      edges.set(key, { id: `classification:${parent}:${child}`, parent, child, relation: "published-classification-parent", evidenceState: "published-classification", attribution: "Glottolog 5.3", genealogical: true });
    }
  }
  const result = { roots: ["indo1319", "sino1245"], nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)), edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)), identity: null };
  result.identity = hashCanonical(GENEALOGY_DOMAIN, { roots: result.roots, nodes: result.nodes, edges: result.edges });
  return Object.freeze(result);
}

function normalizedCharacters(value) { return [...value.normalize("NFC").toLocaleLowerCase("und")].filter((character) => /[\p{L}\p{M}]/u.test(character)); }
function editDistance(left, right) { const previous = Array.from({ length: right.length + 1 }, (_, index) => index); for (let i = 1; i <= left.length; i += 1) { let diagonal = previous[0]; previous[0] = i; for (let j = 1; j <= right.length; j += 1) { const above = previous[j]; previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1)); diagonal = above; } } return previous[right.length]; }
function surfaceComparison(targetForm, borrowing) { const left = normalizedCharacters(targetForm.form); const right = normalizedCharacters(borrowing.sourceWord); const maximum = Math.max(left.length, right.length); const distance = editDistance(left, right); return Object.freeze({ borrowingId: borrowing.id, targetFormId: targetForm.id, target: targetForm.form, source: borrowing.sourceWord, method: "NFC lowercase Unicode-letter Levenshtein v1", distance, similarity: maximum === 0 ? 1 : Number((1 - distance / maximum).toFixed(3)), interpretation: "display-only surface signal", cognacyStatus: "not-asserted", createsCognacy: false, createsGenealogy: false }); }

function transmissionProfile(language) {
  const borrowing = language.borrowingAnnotations[0] ?? null;
  return { borrowedStatus: language.lexicalForm.borrowedStatus, borrowedScore: language.lexicalForm.borrowedScore, sourceRelation: borrowing?.sourceRelation ?? null, sourceGlottocode: borrowing?.sourceGlottocode ?? null };
}

function compareLanguages(languages, pairs, regimes) {
  const byId = new Map(languages.map((language) => [language.glottocode, language]));
  return pairs.map((pair) => {
    const left = byId.get(pair.left); const right = byId.get(pair.right);
    if (!left || !right || left === right) fail(`comparison ${pair.id} endpoints are invalid`);
    const projections = {
      [left.glottocode]: { glottocode: left.glottocode, familyId: left.familyId, form: left.lexicalForm.form, ...transmissionProfile(left) },
      [right.glottocode]: { glottocode: right.glottocode, familyId: right.familyId, form: right.lexicalForm.form, ...transmissionProfile(right) }
    };
    const results = regimes.map((regime) => {
      const leftValues = Object.fromEntries(regime.fields.map((field) => [field, projections[left.glottocode][field]]));
      const rightValues = Object.fromEntries(regime.fields.map((field) => [field, projections[right.glottocode][field]]));
      const differingFields = regime.fields.filter((field) => !same(leftValues[field], rightValues[field]));
      return Object.freeze({ regimeId: regime.id, label: regime.label, question: regime.question, comparedFields: [...regime.fields], leftProjectionIdentity: hashCanonical(PROJECTION_DOMAIN, { regimeId: regime.id, values: leftValues }), rightProjectionIdentity: hashCanonical(PROJECTION_DOMAIN, { regimeId: regime.id, values: rightValues }), differingFields, equal: differingFields.length === 0 });
    });
    return Object.freeze({ id: pair.id, label: pair.label, left: pair.left, right: pair.right, historiesDistinct: true, results });
  });
}

function verifySemantics(artifact) {
  if (artifact.format !== "onto2d-historical-linguistics-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "historical-linguistics-v1") fail("artifact version differs");
  const { caseIdentity, ...basis } = artifact;
  if (!IDENTITY.test(caseIdentity ?? "") || caseIdentity !== hashCanonical(CASE_DOMAIN, basis)) fail("case identity differs");
  if (artifact.source.identity !== hashCanonical(SOURCE_DOMAIN, { authoredFiles: artifact.source.authoredFiles, snapshotFiles: artifact.source.snapshotFiles, releases: artifact.source.releases })) fail("source identity differs");
  const { identity: genealogyIdentity, ...genealogyBasis } = artifact.genealogy;
  if (!IDENTITY.test(genealogyIdentity ?? "") || genealogyIdentity !== hashCanonical(GENEALOGY_DOMAIN, genealogyBasis)) fail("genealogy identity differs");
  if (!same(artifact.languages.map((language) => language.glottocode), COHORT) || new Set(artifact.languages.map((language) => language.glottocode)).size !== COHORT.length) fail("stable Glottocode inventory differs");
  if (artifact.borrowings.length !== 4 || !same(artifact.borrowings.map((borrowing) => borrowing.id), BORROWINGS) || artifact.borrowings.some((borrowing) => borrowing.genealogicalParent !== false || borrowing.relationKind !== "lexical-borrowing")) fail("borrowing boundary differs");
  const flagship = artifact.borrowings.find((borrowing) => borrowing.id === "5");
  if (flagship.sourceGlottocode !== "stan1293" || flagship.recipientGlottocode !== "mana1288" || flagship.crossTopLevelFamily !== true || flagship.targetBorrowedStatus !== "3. perhaps borrowed" || flagship.targetBorrowedScore !== 0.5 || flagship.sourceCertain !== true) fail("flagship uncertainty was collapsed");
  if (artifact.surfaceComparisons.some((comparison) => comparison.createsCognacy || comparison.createsGenealogy || comparison.cognacyStatus !== "not-asserted")) fail("surface similarity was promoted");
  if (!same(artifact.historyEquivalence.comparisons.map((comparison) => comparison.results.map((result) => result.equal)), EXPECTED_VERDICTS)) fail("history-equivalence matrix differs");
  if (artifact.reconstruction.newPhylogenyInferred !== false || artifact.reconstruction.cognacyAssertions !== 0 || artifact.reconstruction.horizontalEdges !== artifact.borrowings.length || artifact.reconstruction.verticalEdges !== artifact.genealogy.edges.length) fail("reconstruction boundary differs");
  if (artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  if (caseIdentity !== APPROVED_CASE_IDENTITY) fail(`case identity ${caseIdentity} is not the approved historical-linguistics-v1 release`);
  return artifact;
}

export function verifyHistoricalLinguisticsCaseIdentity(input) { if (!isRecord(input)) fail("artifact must be an object"); return verifySemantics(structuredClone(input)); }

export async function buildHistoricalLinguisticsCase() {
  const [upstreamInput, profileInput, glottologInput, woldInput] = await Promise.all([load("upstream.json"), load("analysis-profile.json"), load("source/glottolog-selection.json"), load("source/wold-match-selection.json")]);
  const upstream = validateUpstream(upstreamInput.value); const profile = validateProfile(profileInput.value); const glottolog = validateGlottolog(glottologInput.value); const wold = validateWold(woldInput.value);
  for (const lock of upstream.snapshots) { const input = lock.role === "glottolog-selection" ? glottologInput : woldInput; if (lock.path !== input.path || lock.sha256 !== sha256(input.bytes) || lock.bytes !== input.bytes.length) fail(`${lock.role} projection does not match its lock`); }
  const glottologById = new Map(glottolog.languages.map((language) => [language.glottocode, language]));
  const woldById = new Map(wold.languages.map((language) => [language.id, language]));
  const formById = new Map(wold.forms.map((form) => [form.id, form]));
  const annotationsByForm = Map.groupBy(wold.borrowings, (borrowing) => borrowing.targetFormId);
  const languages = wold.forms.map((form) => {
    const woldLanguage = woldById.get(form.languageId); const classification = glottologById.get(woldLanguage.glottocode);
    if (!classification || classification.name !== woldLanguage.name && !(woldLanguage.id === "OldHighGerman" && classification.name.startsWith(woldLanguage.name))) fail(`${woldLanguage.id} Glottocode join differs`);
    const borrowingAnnotations = (annotationsByForm.get(form.id) ?? []).map((borrowing) => ({ ...borrowing, evidenceState: "expert-curated-source-record", targetBorrowedStatus: form.borrowedStatus, targetBorrowedScore: form.borrowedScore }));
    return Object.freeze({ glottocode: classification.glottocode, name: woldLanguage.name, familyId: classification.familyId, familyName: glottolog.pathLanguoids[classification.familyId], identifiers: { glottologIso639P3code: classification.iso639P3code, woldIso639P3code: woldLanguage.iso639P3code, woldLanguageId: woldLanguage.id, woldVocabularyId: woldLanguage.woldId }, identifierMapping: { status: "matched-by-glottocode", isoSourceDifference: classification.iso639P3code !== woldLanguage.iso639P3code }, classificationClaim: { release: glottolog.release, path: classification.classificationPath.map((id) => ({ id, name: glottolog.pathLanguoids[id] })), status: "published-classification", uncertain: false, attributedTo: "Glottolog 5.3", groundTruthClaim: false }, lexicalForm: { ...form, evidenceState: "expert-curated-lexical-record", contributor: woldLanguage.contributor, vocabularyUrl: `https://wold.clld.org/vocabulary/${woldLanguage.woldId}` }, borrowingAnnotations });
  });
  const languageByGlottocode = new Map(languages.map((language) => [language.glottocode, language]));
  const formToLanguage = new Map(languages.map((language) => [language.lexicalForm.id, language]));
  const borrowings = wold.borrowings.map((borrowing) => {
    const recipient = formToLanguage.get(borrowing.targetFormId); const source = languageByGlottocode.get(borrowing.sourceGlottocode) ?? null;
    return Object.freeze({ ...borrowing, recipientGlottocode: recipient.glottocode, recipientName: recipient.name, sourceInCohort: source !== null, sourceFamilyId: source?.familyId ?? null, recipientFamilyId: recipient.familyId, crossTopLevelFamily: source ? source.familyId !== recipient.familyId : null, targetForm: recipient.lexicalForm.form, targetBorrowedStatus: recipient.lexicalForm.borrowedStatus, targetBorrowedScore: recipient.lexicalForm.borrowedScore, relationKind: "lexical-borrowing", evidenceState: "expert-curated-source-record", genealogicalParent: false, generalizedBeyondTargetForm: false });
  });
  const genealogy = buildGenealogy(glottolog);
  const comparisons = compareLanguages(languages, profile.comparisonPairs, profile.equivalenceRegimes);
  const authoredFiles = [sourceEntry("upstream-lock", upstreamInput), sourceEntry("analysis-profile", profileInput)];
  const snapshotFiles = [sourceEntry("glottolog-selection", glottologInput), sourceEntry("wold-match-selection", woldInput)];
  const releases = upstream.sources.map((source) => ({ id: source.id, release: source.release, releaseCommit: source.releaseCommit, releaseUrl: source.releaseUrl, license: source.license, citation: source.citation }));
  const source = { identity: hashCanonical(SOURCE_DOMAIN, { authoredFiles, snapshotFiles, releases }), retrievedOn: upstream.retrievedOn, liveNetworkRequiredByBuild: false, authoredFiles, snapshotFiles, releases };
  const withoutIdentity = {
    format: "onto2d-historical-linguistics-case", formatVersion: "1", caseVersion: "historical-linguistics-v1", source,
    concept: { ...wold.concept, evidenceState: "expert-curated-concept-record", dataset: "Lexibank WOLD CLDF v4.2" },
    cohort: { profile: upstream.selection.profile, languageCount: languages.length, topLevelFamilyCount: new Set(languages.map((language) => language.familyId)).size, selectedFormCount: languages.length, borrowingAnnotationCount: borrowings.length, crossFamilyBorrowingCount: borrowings.filter((borrowing) => borrowing.crossTopLevelFamily).length },
    languages, genealogy, borrowings,
    surfaceComparisons: borrowings.map((borrowing) => surfaceComparison(formById.get(borrowing.targetFormId), borrowing)),
    historyEquivalence: { regimes: profile.equivalenceRegimes, comparisons },
    reconstruction: { question: "Which edges are published genealogical classification, which are borrowing, and which are merely surface similarity?", status: "source-separated", verticalEdges: genealogy.edges.length, horizontalEdges: borrowings.length, surfaceSignals: borrowings.length, cognacyAssertions: 0, newPhylogenyInferred: false, alternatives: [], ablation: { supported: true, instruction: "Hide borrowing edges or surface comparisons without changing the published classification layer." } },
    historicalLoad: profile.historicalLoad,
    evidenceBoundary: { classifications: "Glottolog 5.3 paths are versioned published classification claims.", lexicalForms: "WOLD/Lexibank 4.2 rows are expert-curated lexical records for one concept.", borrowing: "Each annotation is local to one target form; source-certain and borrowed-status remain separate fields.", similarity: "Unicode edit similarity is a display-only calculation and creates no cognacy or ancestry edge.", unresolvedMappings: [], nonClaims: profile.nonClaims }
  };
  return verifySemantics(Object.freeze({ ...withoutIdentity, caseIdentity: hashCanonical(CASE_DOMAIN, withoutIdentity) }));
}

export async function run({ verify = false } = {}) {
  const artifact = await buildHistoricalLinguisticsCase(); const expected = serialize(artifact);
  if (verify) assert.equal(await readFile(OUTPUT, "utf8"), expected, "committed Historical Linguistics artifact differs");
  else { await mkdir(path.dirname(OUTPUT), { recursive: true }); await writeFile(OUTPUT, expected); }
  console.log(`${verify ? "Verified" : "Built"} Historical Linguistics ${artifact.caseIdentity}: ${artifact.cohort.languageCount} languages, ${artifact.genealogy.edges.length} classification edges, ${artifact.borrowings.length} borrowing annotations.`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify"); if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`); run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; }); }
