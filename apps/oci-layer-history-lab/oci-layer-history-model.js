const SHA256 = /^sha256:[0-9a-f]{64}$/;
const HISTORY_IDS = Object.freeze(["history-a", "history-b", "history-redundant", "history-grouped"]);
const REGIME_IDS = Object.freeze(["flattened-rootfs", "layer-sequence", "manifest", "history-equivalence"]);
const COST_IDS = Object.freeze(["layer-count", "operation-count", "changed-byte-count", "transferred-byte-count"]);

function fail(message) {
  throw new Error(`OCI Layer History artifact invalid: ${message}`);
}

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function array(value, label, length) {
  if (!Array.isArray(value) || value.length !== length) fail(`${label} must contain exactly ${length} records`);
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function costOf(history, id) {
  if (id === "layer-count") return history.layers.length;
  if (id === "operation-count") return history.layers.reduce((sum, layer) => sum + layer.operations.length, 0);
  if (id === "changed-byte-count") return history.layers.reduce((sum, layer) => sum + layer.operations.reduce((subtotal, operation) => subtotal + operation.changedBytes, 0), 0);
  if (id === "transferred-byte-count") return history.layers.reduce((sum, layer) => sum + layer.descriptor.size, 0);
  fail(`unknown cost function ${id}`);
}

function indexBy(records, key, label) {
  const result = new Map();
  for (const record of records) {
    if (typeof record[key] !== "string" || result.has(record[key])) fail(`${label} has a missing or repeated ${key}`);
    result.set(record[key], record);
  }
  return result;
}

function validateHistory(history, expectedId) {
  if (history.id !== expectedId || history.evidenceClass !== "native-oci-layout") fail(`native history order or evidence differs at ${expectedId}`);
  if (!SHA256.test(history.manifest?.digest) || !SHA256.test(history.config?.digest) || !SHA256.test(history.layerSequenceIdentity) || !SHA256.test(history.finalRootfs?.identity)) fail(`${history.id} has an invalid identity`);
  if (!Array.isArray(history.layers) || history.layers.length < 1 || history.layers.length > 5) fail(`${history.id} layer inventory is invalid`);
  history.layers.forEach((layer, index) => {
    if (layer.ordinal !== index || !SHA256.test(layer.descriptor?.digest) || layer.diffId !== layer.descriptor.digest || !Array.isArray(layer.entries) || !Array.isArray(layer.operations)) fail(`${history.id} layer ${index} is invalid`);
    if (!SHA256.test(layer.stateAfter?.identity) || !Array.isArray(layer.stateAfter.files)) fail(`${history.id} layer ${index} state is invalid`);
    for (const operation of layer.operations) {
      if (!['add-file', 'replace-file', 'delete-file', 'opaque-delete'].includes(operation.kind) || !Number.isInteger(operation.changedBytes) || operation.changedBytes < 0) fail(`${history.id} layer ${index} operation is invalid`);
    }
  });
  if (!same(history.layers.at(-1).stateAfter, history.finalRootfs)) fail(`${history.id} final state is detached from its layer replay`);
}

function validateComparison(comparison, historyIndex, regimeIndex) {
  const left = historyIndex.get(comparison.left);
  const right = historyIndex.get(comparison.right);
  if (!left || !right) fail(`${comparison.id} references an unknown history`);
  for (const regimeId of regimeIndex.keys()) {
    const result = object(comparison.results?.[regimeId], `${comparison.id}/${regimeId}`);
    if (typeof result.equal !== "boolean" || result.equal !== (result.left === result.right)) fail(`${comparison.id}/${regimeId} equality is inconsistent`);
  }
  if (comparison.results["flattened-rootfs"].left !== left.finalRootfs.identity || comparison.results["flattened-rootfs"].right !== right.finalRootfs.identity) fail(`${comparison.id} rootfs result is substituted`);
  if (comparison.results["layer-sequence"].left !== left.layerSequenceIdentity || comparison.results["layer-sequence"].right !== right.layerSequenceIdentity) fail(`${comparison.id} layer-sequence result is substituted`);
  if (comparison.results.manifest.left !== left.manifest.digest || comparison.results.manifest.right !== right.manifest.digest) fail(`${comparison.id} manifest result is substituted`);
  if (comparison.results["history-equivalence"].equal !== comparison.results["flattened-rootfs"].equal) fail(`${comparison.id} history equivalence is detached from flattened identity`);
}

export function createOciLayerHistoryModel(input) {
  const artifact = structuredClone(object(input, "artifact"));
  if (artifact.format !== "onto2d-oci-layer-history-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "oci-layer-history-v1") fail("unsupported artifact version");
  if (artifact.specification?.version !== "1.1.1" || !SHA256.test(artifact.caseIdentity) || !SHA256.test(artifact.source?.identity)) fail("pinned specification or artifact identity is missing");
  const histories = array(artifact.histories, "histories", HISTORY_IDS.length);
  histories.forEach((history, index) => validateHistory(history, HISTORY_IDS[index]));
  const historyIndex = indexBy(histories, "id", "histories");
  if (new Set(histories.map((history) => history.finalRootfs.identity)).size !== 1) fail("native histories do not converge to one rootfs");
  if (new Set(histories.map((history) => history.manifest.digest)).size !== histories.length || new Set(histories.map((history) => history.layerSequenceIdentity)).size !== histories.length) fail("native history identities were collapsed");

  const regimes = array(artifact.identityRegimes, "identityRegimes", REGIME_IDS.length);
  if (regimes.some((regime, index) => regime.id !== REGIME_IDS[index])) fail("identity regimes are missing or reordered");
  const regimeIndex = indexBy(regimes, "id", "identityRegimes");
  const comparisons = artifact.experiments.filter((experiment) => experiment.results);
  if (comparisons.length !== 3) fail("comparison experiment inventory is incomplete");
  comparisons.forEach((comparison) => validateComparison(comparison, historyIndex, regimeIndex));
  const comparisonIndex = indexBy(comparisons, "id", "comparisons");
  const deleted = artifact.experiments.find((experiment) => experiment.id === "deleted-history");
  if (deleted?.history !== "history-a" || deleted.hiddenPath !== "a.txt" || deleted.absentFromFinalRootfs !== true) fail("deleted-history evidence is incomplete");

  const counterfactual = array(artifact.counterfactuals, "counterfactuals", 1)[0];
  if (counterfactual.evidenceClass !== "counterfactual" || counterfactual.manifest !== null || counterfactual.differsFromNativeFinal !== true || counterfactual.finalRootfs.identity === histories[0].finalRootfs.identity) fail("reversed-order counterfactual crossed the native boundary");
  const loadRecords = array(artifact.historicalLoad?.results, "historicalLoad.results", COST_IDS.length);
  if (artifact.historicalLoad.status !== "resolved-in-declared-space") fail("Historical Load status is unsupported");
  const loadIndex = indexBy(loadRecords, "costFunction", "Historical Load results");
  for (const [index, costId] of COST_IDS.entries()) {
    const result = loadRecords[index];
    if (result.costFunction !== costId || result.observedHistory !== "history-a") fail(`Historical Load order or reference differs for ${costId}`);
    const expectedCosts = histories.map((history) => ({ historyId: history.id, cost: costOf(history, costId) }));
    const optimumCost = Math.min(...expectedCosts.map((entry) => entry.cost));
    const observedCost = costOf(histories[0], costId);
    if (!same(result.candidateCosts, expectedCosts) || result.observedCost !== observedCost || result.optimumCost !== optimumCost || result.historicalLoad !== observedCost - optimumCost) fail(`Historical Load is substituted for ${costId}`);
  }

  deepFreeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    specification: artifact.specification,
    histories,
    comparisons,
    regimes,
    deletedHistory: deleted,
    counterfactual,
    historicalLoad: artifact.historicalLoad,
    limitations: artifact.limitations,
    history(id) {
      const result = historyIndex.get(id);
      if (!result) throw new RangeError(`Unknown OCI history ${id}.`);
      return result;
    },
    comparison(id) {
      const result = comparisonIndex.get(id);
      if (!result) throw new RangeError(`Unknown OCI comparison ${id}.`);
      return result;
    },
    regime(id) {
      const result = regimeIndex.get(id);
      if (!result) throw new RangeError(`Unknown OCI identity regime ${id}.`);
      return result;
    },
    load(id) {
      const result = loadIndex.get(id);
      if (!result) throw new RangeError(`Unknown OCI cost function ${id}.`);
      return result;
    }
  });
}
