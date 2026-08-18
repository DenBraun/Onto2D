import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(CASE_ROOT, "artifacts", "getty-artwork-provenance.json");
const CASE_DOMAIN = "onto2d:getty-artwork-provenance-case:v1";
const SOURCE_DOMAIN = "onto2d:getty-artwork-provenance-source:v1";
const OBJECT_DOMAIN = "onto2d:getty-artwork-object-record:v1";
const HISTORY_DOMAIN = "onto2d:getty-artwork-history-view:v1";
const PROJECTION_DOMAIN = "onto2d:getty-artwork-history-projection:v1";
const HASH = /^[0-9a-f]{64}$/;
const IDENTITY = /^sha256:[0-9a-f]{64}$/;
const GETTY_ID = /^https:\/\/data\.getty\.edu\/provenance\/[0-9a-f-]{36}$/;
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const EXPECTED_STOCK = Object.freeze(["A1981", "A1982", "A1983", "A1984"]);
const EXPECTED_ACTORS = Object.freeze({
  colnaghi: "https://data.getty.edu/provenance/e58f4290-9160-3b64-9006-ed136dbd8d2a",
  getty: "https://data.getty.edu/provenance/7bb5fa98-782e-35c6-a107-888780023622",
  knoedler: "https://data.getty.edu/provenance/29246664-db2b-3f62-8ba6-5e82ad675c77",
  losAngeles: "https://data.getty.edu/provenance/d480c3e8-4b42-3bc9-af1b-621d57a40608"
});

const INPUTS = Object.freeze({ upstream: "upstream.json", analysis: "analysis-profile.json" });

function fail(message) {
  throw new Error(`Getty Artwork Provenance extraction failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${label} fields must be exactly ${wanted.join(", ")}`);
}

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function safePath(value, label) {
  if (typeof value !== "string" || !SAFE_PATH.test(value) || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a safe relative path`);
  return value;
}

async function file(relative, limit = 256 * 1024) {
  safePath(relative, "input path");
  const bytes = await readFile(path.join(CASE_ROOT, relative));
  if (bytes.length < 1 || bytes.length > limit) fail(`${relative} is empty or exceeds ${limit} bytes`);
  return { path: relative, bytes };
}

function parseJson(input, label) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes); } catch { fail(`${label} is not valid UTF-8`); }
  try { return { ...input, value: JSON.parse(text) }; } catch { fail(`${label} is not valid JSON`); }
}

function rootGettyReferences(values) {
  return [...new Set((values ?? []).map((value) => value?.id).filter((id) => GETTY_ID.test(id ?? "")))].sort();
}

function sourceIdentityEntry(role, input, extra = {}) {
  return Object.freeze({ role, path: input.path, identity: `sha256:${sha256(input.bytes)}`, bytes: input.bytes.length, ...extra });
}

function validateUpstream(input) {
  exactKeys(input, ["format", "formatVersion", "source", "retrieval", "records", "querySnapshots", "selection"], "upstream lock");
  if (input.format !== "onto2d-getty-artwork-provenance-upstream-lock" || input.formatVersion !== "1") fail("upstream lock version is unsupported");
  exactKeys(input.source, ["name", "publisher", "apiBase", "documentation", "userGuide", "dataModel", "license"], "source");
  if (input.source.name !== "Getty Provenance Index" || input.source.publisher !== "J. Paul Getty Trust" || input.source.dataModel !== "Linked.Art JSON-LD / CIDOC CRM") fail("source identity differs");
  if (input.source.license?.spdx !== "CC0-1.0" || !input.source.license.url.startsWith("https://data.getty.edu/provenance/docs/")) fail("Getty license declaration differs");
  exactKeys(input.retrieval, ["retrievedAt", "restMethod", "restAccept", "restMediaType", "sparqlMethod", "sparqlEndpoint", "sparqlAccept", "liveNetworkRequiredByBuild"], "retrieval");
  if (!Number.isFinite(Date.parse(input.retrieval.retrievedAt)) || input.retrieval.liveNetworkRequiredByBuild !== false || input.retrieval.restMethod !== "GET" || input.retrieval.sparqlMethod !== "GET") fail("retrieval boundary differs");
  if (!Array.isArray(input.records) || input.records.length !== 8 || !Array.isArray(input.querySnapshots) || input.querySnapshots.length !== 1) fail("source inventory differs");
  for (const [index, record] of input.records.entries()) {
    exactKeys(record, ["role", "entityId", "entityType", "path", "sha256", "bytes"], `records[${index}]`);
    if (!GETTY_ID.test(record.entityId) || !HASH.test(record.sha256) || !Number.isSafeInteger(record.bytes) || record.bytes < 1 || record.bytes > 64 * 1024) fail(`${record.role} source lock is invalid`);
    safePath(record.path, `${record.role}.path`);
  }
  const query = input.querySnapshots[0];
  exactKeys(query, ["role", "queryPath", "querySha256", "queryBytes", "responsePath", "responseSha256", "responseBytes", "transportResponseSha256", "transportResponseBytes", "snapshotNormalization"], "query snapshot");
  if (query.role !== "actor-place-labels" || ![query.querySha256, query.responseSha256, query.transportResponseSha256].every((value) => HASH.test(value))) fail("query snapshot identities are invalid");
  if (query.snapshotNormalization !== "append-one-LF" || query.responseBytes !== query.transportResponseBytes + 1 || query.responseSha256 === query.transportResponseSha256) fail("query snapshot normalization is invalid");
  if (input.selection.profile !== "getty-knoedler-a1981-a1984-v1" || input.selection.cohortSize !== 4 || input.selection.flagshipObjectStockNumber !== "A1983") fail("selection boundary differs");
  return input;
}

function validateAnalysisProfile(input) {
  exactKeys(input, ["format", "formatVersion", "profileVersion", "flagshipObjectId", "historyViews", "regimes", "expectedVerdicts", "historicalLoad", "nonClaims"], "analysis profile");
  if (input.format !== "onto2d-artwork-provenance-analysis-profile" || input.formatVersion !== "1" || input.profileVersion !== "artwork-provenance-identity-v1") fail("analysis profile version is unsupported");
  if (!GETTY_ID.test(input.flagshipObjectId) || !Array.isArray(input.historyViews) || input.historyViews.length !== 2) fail("history view inventory differs");
  if (!same(input.historyViews.map((view) => view.id), ["evidence-only", "gap-explicit"]) || input.historyViews.some((view) => view.complete !== false)) fail("history view boundary differs");
  const expectedRegimes = ["physical-object", "direct-records", "actors-unordered", "gap-explicit-chain", "complete-evidence-chain"];
  if (!Array.isArray(input.regimes) || !same(input.regimes.map((regime) => regime.id), expectedRegimes)) fail("equivalence regime inventory differs");
  for (const regime of input.regimes) {
    exactKeys(regime, ["id", "label", "question", "kind", "fields", "normalization"], `regime ${regime.id}`);
    if (![regime.label, regime.question, regime.normalization].every((value) => typeof value === "string" && value.length > 0)) fail(`${regime.id} explanatory fields are invalid`);
    if (!Array.isArray(regime.fields) || regime.fields.length !== 1 || typeof regime.fields[0] !== "string") fail(`${regime.id} field selection is invalid`);
    if (!(["projection", "completeness-guard"].includes(regime.kind))) fail(`${regime.id} kind is invalid`);
  }
  if (!same(input.expectedVerdicts, ["equal", "equal", "equal", "distinct", "unresolved"])) fail("expected verdicts differ");
  if (input.historicalLoad?.status !== "not-evaluated" || input.historicalLoad.value !== null || !/undefined rather than zero/.test(input.historicalLoad.reason ?? "")) fail("Historical Load boundary differs");
  if (!Array.isArray(input.nonClaims) || input.nonClaims.length < 8 || new Set(input.nonClaims).size !== input.nonClaims.length) fail("non-claim boundary is incomplete");
  return input;
}

function parseLabels(response) {
  if (!same(response.head?.vars, ["entity", "label"]) || !Array.isArray(response.results?.bindings) || response.results.bindings.length !== 4) fail("SPARQL label response shape differs");
  const labels = {};
  for (const [index, binding] of response.results.bindings.entries()) {
    exactKeys(binding, ["entity", "label"], `SPARQL binding ${index}`);
    if (binding.entity?.type !== "uri" || binding.label?.type !== "literal" || !GETTY_ID.test(binding.entity.value) || typeof binding.label.value !== "string") fail(`SPARQL binding ${index} is invalid`);
    if (Object.hasOwn(labels, binding.entity.value)) fail(`SPARQL entity ${binding.entity.value} repeats`);
    labels[binding.entity.value] = binding.label.value;
  }
  const expected = {
    [EXPECTED_ACTORS.knoedler]: "M. Knoedler & Co.",
    [EXPECTED_ACTORS.getty]: "J. Paul Getty Museum (Los Angeles, CA, USA)",
    [EXPECTED_ACTORS.losAngeles]: "Los Angeles",
    [EXPECTED_ACTORS.colnaghi]: "Colnaghi's"
  };
  if (!same(labels, expected)) fail("SPARQL actor/place labels differ from the frozen response");
  return labels;
}

function extractObject(record, lock, stockNumber) {
  if (record.id !== lock.entityId || record.type !== "HumanMadeObject" || record.type !== lock.entityType) fail(`${stockNumber} object identity differs`);
  nonEmpty(record._label, `${stockNumber} label`);
  const identifiers = (record.identified_by ?? []).filter((value) => value?.type === "Identifier").map((value) => ({
    content: nonEmpty(value.content, `${stockNumber} identifier`),
    classificationIds: [...new Set((value.classified_as ?? []).map((entry) => entry?.id).filter(Boolean))].sort()
  }));
  if (!identifiers.some((identifier) => identifier.content === stockNumber)) fail(`${stockNumber} stock identifier is absent`);
  const currentOwnerIds = rootGettyReferences(record.current_owner);
  const currentLocationId = record.current_location?.id ?? null;
  if (currentLocationId !== null && !GETTY_ID.test(currentLocationId)) fail(`${stockNumber} current location is invalid`);
  const sourceRecordIds = rootGettyReferences(record.referred_to_by);
  return Object.freeze({
    id: record.id,
    label: record._label,
    nativeType: record.type,
    stockNumber,
    identifiers,
    currentOwnerIds,
    currentLocationId,
    sourceRecordIds,
    artworkRecordIdentity: hashCanonical(OBJECT_DOMAIN, { gettyHumanMadeObjectId: record.id }),
    evidenceState: "direct-record"
  });
}

function eventTime(record, id) {
  const time = record.timespan;
  if (!isRecord(time) || time.type !== "TimeSpan") fail(`${id} timespan is invalid`);
  const begin = nonEmpty(time.begin_of_the_begin, `${id} begin`);
  const end = nonEmpty(time.end_of_the_end, `${id} end`);
  if (!Number.isFinite(Date.parse(begin)) || !Number.isFinite(Date.parse(end)) || Date.parse(begin) > Date.parse(end)) fail(`${id} time bounds are invalid`);
  return Object.freeze({ label: nonEmpty(time._label, `${id} time label`), begin, end, precision: time._label.includes("-00") ? "month-bounded" : "day-bounded", exact: false });
}

function extractEvent(record, lock, expectedObjectIds, kind) {
  if (record.id !== lock.entityId || record.type !== "Activity" || record.type !== lock.entityType) fail(`${kind} activity identity differs`);
  const acquisitions = (record.part ?? []).filter((part) => Array.isArray(part.transferred_title_of));
  const transfers = acquisitions.map((part, sourceOrdinal) => {
    if (part.type !== "Acquisition" || part.transferred_title_of.length !== 1) fail(`${kind} acquisition part is invalid`);
    const objectId = part.transferred_title_of[0]?.id;
    const fromActorIds = rootGettyReferences(part.transferred_title_from);
    const toActorIds = rootGettyReferences(part.transferred_title_to);
    if (!GETTY_ID.test(objectId ?? "") || !fromActorIds.length || !toActorIds.length) fail(`${kind} transfer endpoints are invalid`);
    return { sourceOrdinal, objectId, label: nonEmpty(part._label, `${kind} transfer label`), nativeType: part.type, fromActorIds, toActorIds, evidenceState: "upstream-declared", legalTitleDetermination: false };
  }).sort((left, right) => expectedObjectIds.indexOf(left.objectId) - expectedObjectIds.indexOf(right.objectId));
  if (!same(transfers.map((transfer) => transfer.objectId), expectedObjectIds)) fail(`${kind} transferred object inventory differs`);
  return Object.freeze({
    id: record.id,
    label: nonEmpty(record._label, `${kind} label`),
    nativeType: record.type,
    kind,
    classifications: (record.classified_as ?? []).map((value) => ({ id: value.id, label: value._label ?? null })),
    time: eventTime(record, kind),
    transfers,
    includedSourceRecordIds: rootGettyReferences(record.referred_to_by).filter((id) => id === "https://data.getty.edu/provenance/06193496-4836-32c4-b212-ba6e04ee184c"),
    evidenceState: "direct-record"
  });
}

function extractSourceRecord(record, lock, expectedAboutLabel) {
  if (record.id !== lock.entityId || record.type !== "LinguisticObject" || record.type !== lock.entityType) fail(`${lock.role} identity differs`);
  const transcription = (record.features_are_also_found_on ?? []).find((value) => value?.type === "LinguisticObject" && typeof value.content === "string")?.content;
  if (typeof transcription !== "string" || transcription.length < 100 || !transcription.includes("knoedler_number:")) fail(`${lock.role} transcription is missing`);
  const about = (record.about ?? []).map((value) => ({ id: value.id, label: value._label ?? null }));
  if (!about.some((value) => value.label === expectedAboutLabel)) fail(`${lock.role} source-record classification differs`);
  const creation = record.created_by;
  if (!isRecord(creation) || creation.type !== "Creation") fail(`${lock.role} creation record is absent`);
  const time = eventTime({ timespan: creation.timespan }, `${lock.role} creation`);
  return Object.freeze({
    id: record.id,
    label: nonEmpty(record._label, `${lock.role} label`),
    nativeType: record.type,
    about,
    createdByActorIds: rootGettyReferences(creation.carried_out_by),
    creationTime: time,
    transcription: { identity: `sha256:${sha256(Buffer.from(transcription, "utf8"))}`, bytes: Buffer.byteLength(transcription, "utf8") },
    evidenceState: "direct-record",
    ownershipInference: null
  });
}

function buildHistoryView(profile, context) {
  const directEventIds = context.events.map((event) => event.id);
  const actorIds = [...new Set(context.events.flatMap((event) => event.transfers.flatMap((transfer) => [...transfer.fromActorIds, ...transfer.toActorIds])).concat(context.currentOwnerIds))].sort();
  const basis = {
    id: profile.id,
    label: profile.label,
    objectId: context.objectId,
    directEventIds,
    actorIds,
    segments: [...profile.segments],
    includesUnknownInterval: profile.includesUnknownInterval,
    complete: profile.complete,
    evidenceState: profile.includesUnknownInterval ? "reconstructed" : "derived"
  };
  return Object.freeze({ ...basis, historyIdentity: hashCanonical(HISTORY_DOMAIN, basis) });
}

function readOwnPath(value, field) {
  let current = value;
  for (const part of field.split(".")) {
    if (!isRecord(current) || !Object.hasOwn(current, part)) fail(`missing projection field ${field}`);
    current = current[part];
  }
  return structuredClone(current);
}

export function compareArtworkHistoryViews(left, right, regimes) {
  if (left.id === right.id || left.historyIdentity === right.historyIdentity) fail("history views must remain distinct");
  return regimes.map((regime) => {
    const leftValues = Object.fromEntries(regime.fields.map((field) => [field, readOwnPath(left, field)]));
    const rightValues = Object.fromEntries(regime.fields.map((field) => [field, readOwnPath(right, field)]));
    const leftProjectionIdentity = hashCanonical(PROJECTION_DOMAIN, { regimeId: regime.id, values: leftValues });
    const rightProjectionIdentity = hashCanonical(PROJECTION_DOMAIN, { regimeId: regime.id, values: rightValues });
    const differingFields = regime.fields.filter((field) => !same(readOwnPath(left, field), readOwnPath(right, field)));
    const verdict = regime.kind === "completeness-guard" && (!left.complete || !right.complete)
      ? "unresolved"
      : leftProjectionIdentity === rightProjectionIdentity ? "equal" : "distinct";
    if (regime.kind === "projection" && ((verdict === "equal") !== (differingFields.length === 0))) fail(`${regime.id} projection verdict is inconsistent`);
    return Object.freeze({ regimeId: regime.id, label: regime.label, question: regime.question, kind: regime.kind, comparedFields: [...regime.fields], normalization: regime.normalization, leftProjectionIdentity, rightProjectionIdentity, differingFields, verdict });
  });
}

function verifyCaseSemantics(artifact) {
  if (artifact.source.identity !== hashCanonical(SOURCE_DOMAIN, { authoredFiles: artifact.source.authoredFiles, externalFiles: artifact.source.externalFiles, queryFiles: artifact.source.queryFiles })) fail("source identity was substituted");
  if (artifact.cohort.objects.length !== 4 || !same(artifact.cohort.objects.map((object) => object.stockNumber), EXPECTED_STOCK)) fail("cohort inventory differs");
  if (new Set(artifact.cohort.objects.map((object) => object.id)).size !== 4 || artifact.cohort.objects.some((object) => object.artworkRecordIdentity !== hashCanonical(OBJECT_DOMAIN, { gettyHumanMadeObjectId: object.id }))) fail("artwork record identity was substituted");
  if (artifact.events.length !== 2 || artifact.events[0].transfers.length !== 4 || artifact.events[1].transfers.length !== 1) fail("event inventory differs");
  if (artifact.events[1].time.precision !== "month-bounded" || artifact.events.some((event) => event.time.exact)) fail("approximate Getty time was upgraded to exact");
  if (artifact.sourceRecords.length !== 2 || artifact.sourceRecords.some((record) => record.ownershipInference !== null || record.creationTime.exact !== false)) fail("source-record evidence boundary differs");
  if (!same(artifact.flagship.currentContext.ownerIds, [EXPECTED_ACTORS.getty]) || artifact.flagship.currentContext.locationId !== EXPECTED_ACTORS.losAngeles || artifact.flagship.currentContext.relationStart !== null || artifact.flagship.currentContext.legalTitleDetermination !== false) fail("current-context evidence boundary differs");
  if (artifact.flagship.gap.evidenceState !== "unknown" || artifact.flagship.gap.contents !== null || artifact.flagship.gap.assertedTransfer !== false) fail("unknown interval acquired invented content");
  if (artifact.flagship.alternativeChains.status !== "not-observed-in-bounded-snapshot" || artifact.flagship.alternativeChains.candidates.length !== 0) fail("unsupported alternative chain was invented");
  if (artifact.historyEquivalence.histories.some((history) => history.complete !== false) || !same(artifact.historyEquivalence.comparison.results.map((result) => result.verdict), ["equal", "equal", "equal", "distinct", "unresolved"])) fail("history equivalence result differs");
  if (artifact.historyEquivalence.histories.some((history) => {
    const { historyIdentity, ...basis } = history;
    return historyIdentity !== hashCanonical(HISTORY_DOMAIN, basis);
  })) fail("history-view identity was substituted");
  if (artifact.historicalLoad.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  if (artifact.events.some((event) => event.transfers.some((transfer) => transfer.legalTitleDetermination !== false))) fail("source relation was promoted to legal title determination");
}

export function verifyGettyArtworkProvenanceCaseIdentity(input) {
  const artifact = structuredClone(input);
  if (!isRecord(artifact) || artifact.format !== "onto2d-getty-artwork-provenance-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "getty-artwork-provenance-v1") fail("case artifact version is unsupported");
  if (artifact.generatedBy !== "cases/getty-artwork-provenance/extract.mjs" || !IDENTITY.test(artifact.caseIdentity ?? "")) fail("case artifact identity header is invalid");
  verifyCaseSemantics(artifact);
  const recomputed = compareArtworkHistoryViews(artifact.historyEquivalence.histories[0], artifact.historyEquivalence.histories[1], artifact.historyEquivalence.regimes);
  if (!same(recomputed, artifact.historyEquivalence.comparison.results)) fail("history-equivalence results were substituted");
  const { caseIdentity, ...basis } = artifact;
  if (hashCanonical(CASE_DOMAIN, basis) !== caseIdentity) fail("case identity does not match its exact basis");
  return artifact;
}

export async function buildGettyArtworkProvenanceCase() {
  const [upstreamFile, analysisFile] = await Promise.all([file(INPUTS.upstream, 64 * 1024), file(INPUTS.analysis, 64 * 1024)]);
  const upstream = validateUpstream(parseJson(upstreamFile, INPUTS.upstream).value);
  const analysis = validateAnalysisProfile(parseJson(analysisFile, INPUTS.analysis).value);
  const sourceLocks = new Map(upstream.records.map((record) => [record.role, record]));
  const loadedRecords = new Map();
  for (const lock of upstream.records) {
    const input = await file(lock.path, 64 * 1024);
    if (input.bytes.length !== lock.bytes || sha256(input.bytes) !== lock.sha256) fail(`${lock.path} differs from its exact source lock`);
    loadedRecords.set(lock.role, { lock, ...parseJson(input, lock.path) });
  }
  const queryLock = upstream.querySnapshots[0];
  const [queryInput, responseInput] = await Promise.all([file(queryLock.queryPath, 16 * 1024), file(queryLock.responsePath, 16 * 1024)]);
  if (queryInput.bytes.length !== queryLock.queryBytes || sha256(queryInput.bytes) !== queryLock.querySha256) fail("SPARQL query differs from its lock");
  if (responseInput.bytes.length !== queryLock.responseBytes || sha256(responseInput.bytes) !== queryLock.responseSha256 || responseInput.bytes.at(-1) !== 10) fail("SPARQL response differs from its normalized snapshot lock");
  const labels = parseLabels(parseJson(responseInput, queryLock.responsePath).value);

  const objects = EXPECTED_STOCK.map((stockNumber) => {
    const source = loadedRecords.get(`cohort-object-${stockNumber.toLowerCase()}`);
    if (!source) fail(`${stockNumber} source record is absent`);
    return extractObject(source.value, source.lock, stockNumber);
  });
  const objectIds = objects.map((object) => object.id);
  if (new Set(objectIds).size !== objects.length) fail("cohort object identities repeat");
  const purchaseSource = loadedRecords.get("cohort-purchase-activity");
  const saleSource = loadedRecords.get("flagship-sale-activity");
  const purchase = extractEvent(purchaseSource.value, purchaseSource.lock, objectIds, "purchase-1938");
  const sale = extractEvent(saleSource.value, saleSource.lock, [analysis.flagshipObjectId], "sale-1938");
  if (!same(purchaseSource.value.before, [{ id: sale.id, type: "Activity" }]) || !same(saleSource.value.after, [{ id: purchase.id, type: "Activity" }])) fail("native before/after event relation differs");
  const events = [purchase, sale];
  const sourceRecords = [
    extractSourceRecord(loadedRecords.get("flagship-stock-record-1927").value, loadedRecords.get("flagship-stock-record-1927").lock, "inventorying"),
    extractSourceRecord(loadedRecords.get("flagship-stock-record-1938").value, loadedRecords.get("flagship-stock-record-1938").lock, "purchase (method of acquisition)")
  ];
  const flagshipObject = objects.find((object) => object.id === analysis.flagshipObjectId);
  if (!flagshipObject || !same(flagshipObject.currentOwnerIds, [EXPECTED_ACTORS.getty]) || flagshipObject.currentLocationId !== EXPECTED_ACTORS.losAngeles) fail("flagship current context differs");
  if (!sourceRecords.every((record) => flagshipObject.sourceRecordIds.includes(record.id))) fail("flagship source-record references differ");
  const actors = [EXPECTED_ACTORS.colnaghi, EXPECTED_ACTORS.knoedler, EXPECTED_ACTORS.getty].map((id) => ({ id, label: labels[id], nativeType: "Group", evidenceState: "direct-record" }));
  const places = [{ id: EXPECTED_ACTORS.losAngeles, label: labels[EXPECTED_ACTORS.losAngeles], nativeType: "Place", evidenceState: "direct-record" }];
  const histories = analysis.historyViews.map((view) => buildHistoryView(view, { objectId: flagshipObject.id, events, currentOwnerIds: flagshipObject.currentOwnerIds }));
  const results = compareArtworkHistoryViews(histories[0], histories[1], analysis.regimes);
  if (!same(results.map((result) => result.verdict), analysis.expectedVerdicts)) fail("computed equivalence verdicts differ from the reviewed profile");

  const authoredFiles = [
    sourceIdentityEntry("upstream-lock", upstreamFile),
    sourceIdentityEntry("analysis-profile", analysisFile)
  ];
  const externalFiles = upstream.records.map((lock) => sourceIdentityEntry(lock.role, loadedRecords.get(lock.role), { sourceEntityId: lock.entityId, sourceEntityType: lock.entityType }));
  const queryFiles = [
    sourceIdentityEntry("actor-place-labels-query", queryInput),
    sourceIdentityEntry("actor-place-labels-response", responseInput, { transportResponseIdentity: `sha256:${queryLock.transportResponseSha256}`, transportResponseBytes: queryLock.transportResponseBytes, snapshotNormalization: queryLock.snapshotNormalization })
  ];
  const source = {
    identity: hashCanonical(SOURCE_DOMAIN, { authoredFiles, externalFiles, queryFiles }),
    authoredFiles,
    externalFiles,
    queryFiles,
    retrievedAt: upstream.retrieval.retrievedAt,
    liveNetworkRequiredByBuild: false
  };
  const gap = {
    id: "post-sale-to-current-context",
    label: "Unrecorded transition interval",
    afterEventId: sale.id,
    earliestAfter: sale.time.end,
    beforeContext: "current-owner-relation-observed-in-object-snapshot",
    latestBefore: null,
    observedAt: upstream.retrieval.retrievedAt,
    contents: null,
    evidenceState: "unknown",
    assertedTransfer: false,
    legalTitleDetermination: false,
    interpretation: "The bounded snapshot contains a later current-owner relation but no included acquisition event connecting it to the 1938 sale. This is missing transition evidence, not evidence for a particular hidden transaction."
  };
  const basis = {
    format: "onto2d-getty-artwork-provenance-case",
    formatVersion: "1",
    caseVersion: "getty-artwork-provenance-v1",
    generatedBy: "cases/getty-artwork-provenance/extract.mjs",
    getty: { name: upstream.source.name, publisher: upstream.source.publisher, dataModel: upstream.source.dataModel, documentation: upstream.source.documentation, license: upstream.source.license, selection: upstream.selection },
    source,
    cohort: { id: upstream.selection.profile, objects },
    actors,
    places,
    sourceRecords,
    events,
    eventOrder: [{ earlierEventId: purchase.id, laterEventId: sale.id, nativeForwardField: "before", nativeReverseField: "after", evidenceState: "upstream-declared" }],
    flagship: {
      objectId: flagshipObject.id,
      stockNumber: flagshipObject.stockNumber,
      currentContext: { ownerIds: flagshipObject.currentOwnerIds, locationId: flagshipObject.currentLocationId, observedAt: upstream.retrieval.retrievedAt, relationStart: null, evidenceState: "upstream-declared", legalTitleDetermination: false },
      gap,
      alternativeChains: { status: "not-observed-in-bounded-snapshot", candidates: [], reason: "The selected records do not support multiple candidate object mappings or alternative event chains, so none is manufactured." }
    },
    historyEquivalence: {
      profileVersion: analysis.profileVersion,
      regimes: analysis.regimes,
      histories,
      comparison: { id: "evidence-only-vs-gap-explicit", leftHistoryId: histories[0].id, rightHistoryId: histories[1].id, historiesDistinct: true, results }
    },
    historicalLoad: analysis.historicalLoad,
    evidenceBoundary: {
      directRecords: ["eight exact Getty Linked.Art JSON-LD entity responses", "one exact SPARQL query and normalized response snapshot", "four HumanMadeObject URIs and native identifiers", "two Activity records and their Acquisition parts", "native before/after relation", "two stock-book LinguisticObject records", "current_owner and current_location relations"],
      derived: ["source, object-record, history-view, and regime-projection identities", "bounded cohort projection", "missing-transition gap marker", "regime-relative equivalence verdicts"],
      reconstructed: ["gap-explicit history view; it represents known missingness and asserts no hidden event"],
      unknown: ["events between the 1938 sale and current-owner context", "start date of the current-owner relation", "complete ownership chain", "relations outside the bounded snapshot", "authenticity", "legal title", "transaction validity"],
      contested: [],
      nonClaims: analysis.nonClaims,
      attribution: "Getty Provenance Index, J. Paul Getty Trust. Getty does not endorse Onto2D or this bounded interpretation."
    }
  };
  const artifact = Object.freeze({ ...basis, caseIdentity: hashCanonical(CASE_DOMAIN, basis) });
  return verifyGettyArtworkProvenanceCaseIdentity(artifact);
}

export async function run({ verify = false } = {}) {
  const artifact = await buildGettyArtworkProvenanceCase();
  if (!verify) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(artifact));
  }
  assert.equal(await readFile(OUTPUT, "utf8"), serialize(artifact), "Committed Getty Artwork Provenance artifact differs from deterministic extraction.");
  console.log(`${verify ? "Verified" : "Extracted"} Getty Artwork Provenance ${artifact.caseIdentity}: ${artifact.cohort.objects.length} objects, ${artifact.events.length} events, ${artifact.historyEquivalence.regimes.length} regimes.`);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length) throw new Error(`Unknown argument ${unknown[0]}`);
  run({ verify: process.argv.includes("--verify") }).catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
