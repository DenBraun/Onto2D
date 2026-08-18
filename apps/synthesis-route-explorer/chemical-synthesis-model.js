const TARGET_IDS = Object.freeze(["target-ethyl-aryl", "target-methoxy-aryl", "target-trifluoromethyl-aryl", "target-2-pyridyl", "target-3-pyridyl"]);
const ROUTE_IDS = Object.freeze(["direct-unrecorded-shortcut", "two-record-shortcut", "three-records-without-continuity", "ord-cross-referenced-cascade"]);
const COST_IDS = Object.freeze(["reaction-record-count", "recorded-intermediate-count"]);

function fail(message) { throw new Error(`Chemical Synthesis History artifact invalid: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function indexBy(records, key, label) {
  const result = new Map();
  for (const record of records) {
    if (typeof record[key] !== "string" || result.has(record[key])) fail(`${label} has a missing or repeated ${key}`);
    result.set(record[key], record);
  }
  return result;
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}

export function createChemicalSynthesisModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-chemical-synthesis-history-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "chemical-synthesis-history-v1") fail("unsupported artifact version");
  if (!/^sha256:[0-9a-f]{64}$/.test(artifact.caseIdentity ?? "") || !/^sha256:[0-9a-f]{64}$/.test(artifact.source?.identity ?? "")) fail("case or source identity is invalid");
  if (artifact.ord?.release !== "v0.1.0" || artifact.ord.schemaVersion !== "v0.3.10" || artifact.ord.datasets?.length !== 2) fail("pinned ORD metadata is incomplete");
  const targets = artifact.cohorts?.conditionSweep?.targets;
  if (!Array.isArray(targets) || !same(targets.map((target) => target.id), TARGET_IDS)) fail("target inventory is incomplete or reordered");
  const targetIndex = indexBy(targets, "id", "targets");
  for (const target of targets) {
    if (target.productIdentifier?.type !== "SMILES" || target.routes?.length !== 2) fail(`${target.id} is incomplete`);
    const [minimum, maximum] = target.routes;
    if (minimum.selectionReason !== "minimum-recorded-yield" || maximum.selectionReason !== "maximum-recorded-yield") fail(`${target.id} extrema are reordered`);
    if (minimum.outcome.productSmiles !== maximum.outcome.productSmiles || minimum.outcome.productSmiles !== target.productIdentifier.value) fail(`${target.id} does not retain one exact product identifier`);
    if (minimum.reactionId === maximum.reactionId || minimum.routeIdentity === maximum.routeIdentity) fail(`${target.id} collapsed distinct histories`);
  }
  const cascade = artifact.cohorts?.linkedCascade?.records;
  if (!Array.isArray(cascade) || cascade.length !== 3 || !same(cascade.map((record) => record.ordinal), [0, 1, 2])) fail("linked cascade is incomplete");
  if (!same(cascade[1].crossReferencedReactionIds, [cascade[0].reactionId, cascade[0].reactionId]) || !same(cascade[2].crossReferencedReactionIds, [cascade[1].reactionId])) fail("native cascade continuity is missing");
  const routes = artifact.pathSpace?.routes;
  if (!Array.isArray(routes) || !same(routes.map((route) => route.id), ROUTE_IDS) || routes.some((route) => route.counterfactual && route.actual)) fail("declared route boundary is invalid");
  const routeIndex = indexBy(routes, "id", "routes");
  const results = artifact.historicalLoad?.results;
  if (!Array.isArray(results) || !same(results.map((result) => result.costFunction), COST_IDS)) fail("Historical Load inventory is invalid");
  const loadIndex = indexBy(results, "costFunction", "Historical Load");
  for (const result of results) if (result.historicalLoad !== 2 || result.historicalLoad !== result.admissibleOptimumCost - result.freeOptimumCost) fail(`${result.costFunction} result differs from the reviewed contract`);
  deepFreeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    ord: artifact.ord,
    identityProfiles: artifact.identityProfiles,
    targets,
    cascade,
    routes,
    historicalLoad: artifact.historicalLoad,
    evidenceBoundary: artifact.evidenceBoundary,
    target(id) { const value = targetIndex.get(id); if (!value) throw new RangeError(`Unknown target ${id}.`); return value; },
    route(id) { const value = routeIndex.get(id); if (!value) throw new RangeError(`Unknown route ${id}.`); return value; },
    load(id) { const value = loadIndex.get(id); if (!value) throw new RangeError(`Unknown Historical Load cost ${id}.`); return value; }
  });
}
