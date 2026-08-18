const HISTORY_IDS = Object.freeze(["baseline-node24", "baseline-node22", "ambient-variation-node24", "relevant-input-node24"]);
const PAIR_IDS = Object.freeze(["cross-toolchain-rebuild", "irrelevant-environment-variation", "relevant-input-mutation"]);
const REGIME_IDS = Object.freeze(["byte-output", "declared-input", "toolchain", "environment", "provenance"]);
const HASH = /^sha256:[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(`History Equivalence artifact invalid: ${message}`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function indexBy(values, key, label) {
  const result = new Map();
  for (const value of values) {
    if (typeof value[key] !== "string" || result.has(value[key])) fail(`${label} has a missing or repeated ${key}`);
    result.set(value[key], value);
  }
  return result;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export function createHistoryEquivalenceModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-reproducible-build-equivalence-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "reproducible-build-equivalence-v1") fail("unsupported artifact version");
  if (!HASH.test(artifact.caseIdentity ?? "") || !HASH.test(artifact.source?.identity ?? "")) fail("case or source identity is invalid");
  if (!Array.isArray(artifact.histories) || !same(artifact.histories.map((history) => history.executionId), HISTORY_IDS)) fail("history inventory is incomplete or reordered");
  if (new Set(artifact.histories.map((history) => history.historyIdentity)).size !== HISTORY_IDS.length) fail("distinct histories collapsed");
  for (const history of artifact.histories) {
    if (!HASH.test(history.historyIdentity) || !HASH.test(history.artifact?.sha256) || !HASH.test(history.declaredInputs?.identity)) fail(`${history.executionId} identity is invalid`);
    if (history.artifact.bytes !== new TextEncoder().encode(history.artifact.utf8).length) fail(`${history.executionId} artifact length differs`);
  }
  if (!Array.isArray(artifact.regimes) || !same(artifact.regimes.map((regime) => regime.id), REGIME_IDS)) fail("regime inventory is incomplete or reordered");
  if (!Array.isArray(artifact.comparisons) || !same(artifact.comparisons.map((comparison) => comparison.id), PAIR_IDS)) fail("comparison inventory is incomplete or reordered");
  const historyIndex = indexBy(artifact.histories, "executionId", "histories");
  const comparisonIndex = indexBy(artifact.comparisons, "id", "comparisons");
  const expected = {
    "cross-toolchain-rebuild": [true, true, false, true, false],
    "irrelevant-environment-variation": [true, true, true, true, false],
    "relevant-input-mutation": [false, false, true, true, false]
  };
  for (const comparison of artifact.comparisons) {
    if (!historyIndex.has(comparison.leftHistory) || !historyIndex.has(comparison.rightHistory) || !comparison.historiesDistinct) fail(`${comparison.id} history references are invalid`);
    if (!same(comparison.regimes.map((result) => result.regimeId), REGIME_IDS) || !same(comparison.regimes.map((result) => result.equal), expected[comparison.id])) fail(`${comparison.id} result matrix differs`);
    for (const result of comparison.regimes) {
      if (!HASH.test(result.leftProjectionIdentity) || !HASH.test(result.rightProjectionIdentity)) fail(`${comparison.id}/${result.regimeId} projection identity is invalid`);
      if (result.equal !== (result.leftProjectionIdentity === result.rightProjectionIdentity) || result.equal !== (result.differingFields.length === 0)) fail(`${comparison.id}/${result.regimeId} verdict is inconsistent`);
    }
  }
  if (artifact.historicalLoad?.status !== "not-evaluated" || artifact.historicalLoad.value !== null) fail("Historical Load boundary differs");
  deepFreeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    build: artifact.build,
    histories: artifact.histories,
    regimes: artifact.regimes,
    comparisons: artifact.comparisons,
    conclusion: artifact.conclusion,
    historicalLoad: artifact.historicalLoad,
    evidenceBoundary: artifact.evidenceBoundary,
    history(id) { const value = historyIndex.get(id); if (!value) throw new RangeError(`Unknown build history ${id}.`); return value; },
    comparison(id) { const value = comparisonIndex.get(id); if (!value) throw new RangeError(`Unknown comparison ${id}.`); return value; },
    verdict(pairId, regimeId) {
      const comparison = comparisonIndex.get(pairId);
      if (!comparison) throw new RangeError(`Unknown comparison ${pairId}.`);
      const result = comparison.regimes.find((entry) => entry.regimeId === regimeId);
      if (!result) throw new RangeError(`Unknown equivalence regime ${regimeId}.`);
      return result;
    }
  });
}
