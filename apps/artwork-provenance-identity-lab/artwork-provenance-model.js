const STOCK = Object.freeze(["A1981", "A1982", "A1983", "A1984"]);
const REGIMES = Object.freeze(["physical-object", "direct-records", "actors-unordered", "gap-explicit-chain", "complete-evidence-chain"]);
const VERDICTS = Object.freeze(["equal", "equal", "equal", "distinct", "unresolved"]);
function fail(message) { throw new Error(`Artwork Provenance artifact invalid: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

export function createArtworkProvenanceModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-getty-artwork-provenance-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "getty-artwork-provenance-v1") fail("unsupported artifact version");
  if (!/^sha256:[0-9a-f]{64}$/.test(artifact.caseIdentity ?? "") || !/^sha256:[0-9a-f]{64}$/.test(artifact.source?.identity ?? "")) fail("case or source identity is invalid");
  if (artifact.getty?.name !== "Getty Provenance Index" || artifact.source.liveNetworkRequiredByBuild !== false) fail("source boundary differs");
  if (!Array.isArray(artifact.cohort?.objects) || !same(artifact.cohort.objects.map((object) => object.stockNumber), STOCK) || new Set(artifact.cohort.objects.map((object) => object.id)).size !== 4) fail("cohort identity differs");
  if (artifact.events?.length !== 2 || !same(artifact.events.map((event) => [event.kind, event.transfers.length]), [["purchase-1938", 4], ["sale-1938", 1]])) fail("event inventory differs");
  if (artifact.events.some((event) => event.time.exact || event.transfers.some((transfer) => transfer.legalTitleDetermination !== false))) fail("bounded date or legal-title boundary differs");
  if (artifact.sourceRecords?.length !== 2 || artifact.sourceRecords.some((record) => record.ownershipInference !== null)) fail("source-record boundary differs");
  const gap = artifact.flagship?.gap;
  if (gap?.evidenceState !== "unknown" || gap.contents !== null || gap.assertedTransfer !== false || gap.legalTitleDetermination !== false) fail("unknown interval was promoted");
  if (artifact.flagship.alternativeChains?.status !== "not-observed-in-bounded-snapshot" || artifact.flagship.alternativeChains.candidates?.length !== 0) fail("alternative-chain boundary differs");
  const results = artifact.historyEquivalence?.comparison?.results;
  if (!same(results?.map((result) => result.regimeId), REGIMES) || !same(results.map((result) => result.verdict), VERDICTS)) fail("equivalence results differ");
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  const byStock = new Map(artifact.cohort.objects.map((object) => [object.stockNumber, object]));
  const actors = new Map(artifact.actors.map((actor) => [actor.id, actor.label]));
  freeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity, sourceIdentity: artifact.source.identity, retrievedAt: artifact.source.retrievedAt, getty: artifact.getty,
    objects: artifact.cohort.objects, events: artifact.events, sourceRecords: artifact.sourceRecords, flagship: artifact.flagship,
    histories: artifact.historyEquivalence.histories, results, historicalLoad: artifact.historicalLoad, boundary: artifact.evidenceBoundary,
    object(stock) { const object = byStock.get(stock); if (!object) throw new RangeError(`Unknown stock number ${stock}.`); return object; },
    actor(id) { return actors.get(id) ?? id; }
  });
}
