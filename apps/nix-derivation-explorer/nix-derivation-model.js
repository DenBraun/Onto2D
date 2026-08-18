const SHA256 = /^sha256:[0-9a-f]{64}$/;
const STORE_PATH = /^\/nix\/store\/[0-9a-df-np-sv-z]{32}-[^/]+$/;
const DRV_PATH = /^\/nix\/store\/[0-9a-df-np-sv-z]{32}-[^/]+\.drv$/;
const REGIME_IDS = Object.freeze([
  "output-content",
  "derivation",
  "input-closure",
  "builder-environment",
  "history-class"
]);
const LIMITS = Object.freeze({ derivations: 32, directEdges: 64, closureEdges: 128, comparisons: 16 });

function fail(message) {
  throw new Error(`Nix Derivation Identity artifact invalid: ${message}`);
}

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function array(value, label, maximum, { empty = false } = {}) {
  if (!Array.isArray(value) || (!empty && value.length === 0) || value.length > maximum) {
    fail(`${label} must contain ${empty ? "0" : "1"}-${maximum} records`);
  }
  return value;
}

function string(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameSortedStrings(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && sameJson([...left].sort(), [...right].sort());
}

function uniqueIndex(records, key, label) {
  const index = new Map();
  records.forEach((entry, position) => {
    const id = string(entry[key], `${label}[${position}].${key}`);
    if (index.has(id)) fail(`${label} repeats ${id}`);
    index.set(id, entry);
  });
  return index;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function validateDerivations(records, nativeOutput) {
  const derivations = array(records, "derivations", LIMITS.derivations);
  const fixtureIndex = uniqueIndex(derivations, "fixtureId", "derivations");
  const pathIndex = uniqueIndex(derivations, "drvPath", "derivations");
  for (const derivation of derivations) {
    if (!DRV_PATH.test(derivation.drvPath) || !STORE_PATH.test(derivation.outputPath)) fail(`${derivation.fixtureId} has an invalid Nix store path`);
    if (!SHA256.test(derivation.rawIdentity) || !SHA256.test(derivation.inputClosure?.identity) || !SHA256.test(derivation.builderEnvironment?.identity)) fail(`${derivation.fixtureId} has an invalid derived or raw identity`);
    if (!Array.isArray(derivation.directInputDrvs) || !Array.isArray(derivation.inputClosure.members)) fail(`${derivation.fixtureId} input relations are invalid`);
    if (!Number.isInteger(derivation.depth) || derivation.depth < 0) fail(`${derivation.fixtureId} depth is invalid`);
    if (derivation.system !== "aarch64-darwin" || typeof derivation.builder !== "string" || !Array.isArray(derivation.args)) fail(`${derivation.fixtureId} builder record is invalid`);
    object(derivation.env, `${derivation.fixtureId}.env`);
    const native = object(derivation.native, `${derivation.fixtureId}.native`);
    const environment = object(derivation.builderEnvironment, `${derivation.fixtureId}.builderEnvironment`);
    if (native.system !== derivation.system || native.builder !== derivation.builder || !sameJson(native.args, derivation.args) || !sameJson(native.env, derivation.env)) fail(`${derivation.fixtureId} native process record is substituted`);
    if (native.outputs?.out?.path !== derivation.outputPath) fail(`${derivation.fixtureId} native output path is substituted`);
    if (environment.system !== derivation.system || environment.builder !== derivation.builder || !sameJson(environment.args, derivation.args) || !sameJson(environment.env, derivation.env)) fail(`${derivation.fixtureId} environment projection is substituted`);
    const materialized = derivation.outputEvidence === "materialized-fixed-output";
    if (materialized !== (derivation.outputAddressing === "fixed-content:flat:sha256")) fail(`${derivation.fixtureId} addressing and evidence disagree`);
    if (materialized && (derivation.outputPath !== nativeOutput.path || derivation.outputContentIdentity !== `sha256:${nativeOutput.contentSha256}`)) fail(`${derivation.fixtureId} fixed output evidence is substituted`);
    if (!materialized && (derivation.outputContentIdentity !== null || derivation.outputEvidence !== "unrealized")) fail(`${derivation.fixtureId} unrealized output claims content evidence`);
  }
  for (const derivation of derivations) {
    const directPaths = new Set();
    for (const input of derivation.directInputDrvs) {
      const referenced = pathIndex.get(input.drvPath);
      const nativeInput = derivation.native.inputDrvs?.[input.drvPath];
      if (!referenced || referenced.fixtureId !== input.fixtureId || directPaths.has(input.drvPath) || !Array.isArray(input.outputs) || input.outputs.length === 0 || !nativeInput || !sameJson(nativeInput.outputs, input.outputs)) fail(`${derivation.fixtureId} has an unresolved or substituted direct input`);
      directPaths.add(input.drvPath);
    }
    if (!sameSortedStrings([...directPaths], Object.keys(derivation.native.inputDrvs ?? {}))) fail(`${derivation.fixtureId} direct inputs differ from its native record`);
    if (derivation.inputClosure.members.some((path) => !pathIndex.has(path))) fail(`${derivation.fixtureId} has an unresolved closure member`);
  }
  return { derivations, fixtureIndex, pathIndex };
}

function validateGraph(graphInput, pathIndex) {
  const graph = object(graphInput, "dependencyGraph");
  const directEdges = array(graph.directEdges, "dependencyGraph.directEdges", LIMITS.directEdges);
  const closureEdges = array(graph.closureEdges, "dependencyGraph.closureEdges", LIMITS.closureEdges);
  const outputMappings = array(graph.outputMappings, "dependencyGraph.outputMappings", LIMITS.derivations);
  const expectedDirect = new Set();
  const expectedClosure = new Set();
  for (const derivation of pathIndex.values()) {
    for (const input of derivation.directInputDrvs) expectedDirect.add(`${derivation.drvPath}\u0000${input.drvPath}\u0000${JSON.stringify(input.outputs)}`);
    const directPaths = new Set(derivation.directInputDrvs.map((input) => input.drvPath));
    for (const member of derivation.inputClosure.members) {
      if (!directPaths.has(member)) expectedClosure.add(`${derivation.drvPath}\u0000${member}`);
    }
  }
  const seenDirect = new Set();
  for (const edge of directEdges) {
    if (!pathIndex.has(edge.from) || !pathIndex.has(edge.to) || edge.relation !== "inputDrv" || edge.evidence !== "native") fail("direct graph contains a non-native or unresolved relation");
    const key = `${edge.from}\u0000${edge.to}\u0000${JSON.stringify(edge.outputs)}`;
    if (seenDirect.has(key) || !expectedDirect.has(key)) fail("direct graph differs from native derivation inputs");
    seenDirect.add(key);
  }
  if (seenDirect.size !== expectedDirect.size) fail("direct graph omits native derivation inputs");
  const seenClosure = new Set();
  for (const edge of closureEdges) {
    if (!pathIndex.has(edge.from) || !pathIndex.has(edge.to) || edge.relation !== "transitive-inputDrv" || edge.evidence !== "derived") fail("closure graph contains a non-derived or unresolved relation");
    if (directEdges.some((direct) => direct.from === edge.from && direct.to === edge.to)) fail("a direct relation was duplicated as transitive-only");
    const key = `${edge.from}\u0000${edge.to}`;
    if (seenClosure.has(key) || !expectedClosure.has(key)) fail("closure graph differs from derivation projections");
    seenClosure.add(key);
  }
  if (seenClosure.size !== expectedClosure.size) fail("closure graph omits derivation projections");
  if (outputMappings.length !== pathIndex.size) fail("output mapping count differs from derivation count");
  const mappedDerivations = new Set();
  for (const mapping of outputMappings) {
    const derivation = pathIndex.get(mapping.derivation);
    if (!derivation || mappedDerivations.has(mapping.derivation) || mapping.path !== derivation.outputPath || mapping.addressing !== derivation.outputAddressing || mapping.contentIdentity !== derivation.outputContentIdentity || mapping.evidence !== derivation.outputEvidence || !STORE_PATH.test(mapping.path)) fail("output mapping is not uniquely bound to its derivation");
    mappedDerivations.add(mapping.derivation);
    if (mapping.evidence === "materialized-fixed-output" && !SHA256.test(mapping.contentIdentity)) fail("materialized output lacks a content identity");
    if (mapping.evidence === "unrealized" && mapping.contentIdentity !== null) fail("unrealized output claims a content identity");
  }
  return graph;
}

function validateComparisons(records, fixtureIndex, regimeIndex) {
  const comparisons = array(records, "comparisons", LIMITS.comparisons);
  const comparisonIndex = uniqueIndex(comparisons, "id", "comparisons");
  for (const comparison of comparisons) {
    const left = fixtureIndex.get(comparison.leftFixtureId);
    const right = fixtureIndex.get(comparison.rightFixtureId);
    if (!left || !right) fail(`${comparison.id} references an unknown derivation`);
    if (comparison.addressing?.left !== left.outputAddressing || comparison.addressing?.right !== right.outputAddressing || comparison.addressing?.equal !== (left.outputAddressing === right.outputAddressing)) fail(`${comparison.id} addressing result is substituted`);
    const expectedShared = left.inputClosure.members.filter((path) => right.inputClosure.members.includes(path));
    if (!sameSortedStrings(comparison.sharedInputDrvs, expectedShared)) fail(`${comparison.id} shared closure is substituted`);
    for (const regimeId of regimeIndex.keys()) {
      const result = object(comparison.results?.[regimeId], `${comparison.id}.${regimeId}`);
      if (!['resolved', 'unresolved'].includes(result.status)) fail(`${comparison.id}/${regimeId} status is invalid`);
      if (result.status === "unresolved") {
        if (result.equal !== null || (result.left !== null && result.right !== null)) fail(`${comparison.id}/${regimeId} unresolved result is contradictory`);
      } else if (typeof result.equal !== "boolean" || result.equal !== (result.left === result.right)) {
        fail(`${comparison.id}/${regimeId} equality is inconsistent`);
      }
    }
    if (comparison.results.derivation.left !== left.drvPath || comparison.results.derivation.right !== right.drvPath) fail(`${comparison.id} derivation result is substituted`);
    if (comparison.results["output-content"].left !== left.outputContentIdentity || comparison.results["output-content"].right !== right.outputContentIdentity) fail(`${comparison.id} output-content result is substituted`);
    if (comparison.results["input-closure"].left !== left.inputClosure.identity || comparison.results["input-closure"].right !== right.inputClosure.identity) fail(`${comparison.id} closure result is substituted`);
    if (comparison.results["builder-environment"].left !== left.builderEnvironment.identity || comparison.results["builder-environment"].right !== right.builderEnvironment.identity) fail(`${comparison.id} environment result is substituted`);
    if (comparison.results["history-class"].status !== comparison.results["output-content"].status || comparison.results["history-class"].equal !== comparison.results["output-content"].equal) fail(`${comparison.id} history class is not bound to output-content-v1`);
  }
  return { comparisons, comparisonIndex };
}

export function createNixDerivationModel(input) {
  const artifact = structuredClone(input);
  object(artifact, "artifact");
  if (artifact.format !== "onto2d-nix-derivation-identity-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "nix-derivation-identity-v1") fail("unsupported format or case version");
  if (!SHA256.test(artifact.caseIdentity) || !SHA256.test(artifact.source?.identity)) fail("case or source identity is invalid");
  if (artifact.nix?.version !== "2.31.0" || artifact.nix?.platform !== "aarch64-darwin") fail("pinned Nix runtime is missing");
  if (artifact.captureBoundary?.derivationsInstantiatedByNix !== true || artifact.captureBoundary?.derivationBuildersExecuted !== false || artifact.captureBoundary?.fixedOutputAddedByNix !== true || artifact.captureBoundary?.inputAddressedOutputRealized !== false) fail("capture boundary is missing or widened");
  if (!SHA256.test(`sha256:${artifact.nativeOutput?.contentSha256}`) || artifact.nativeOutput?.contentBytes !== new TextEncoder().encode(artifact.nativeOutput?.contentUtf8 ?? "").length) fail("native output evidence is inconsistent");

  const { derivations, fixtureIndex, pathIndex } = validateDerivations(artifact.derivations, artifact.nativeOutput);
  const graph = validateGraph(artifact.dependencyGraph, pathIndex);
  const regimes = array(artifact.regimes, "regimes", REGIME_IDS.length);
  if (regimes.length !== REGIME_IDS.length || regimes.some((regime, index) => regime.id !== REGIME_IDS[index])) fail("identity regimes are incomplete or reordered");
  const regimeIndex = uniqueIndex(regimes, "id", "regimes");
  const { comparisons, comparisonIndex } = validateComparisons(artifact.comparisons, fixtureIndex, regimeIndex);

  deepFreeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.identity,
    nix: artifact.nix,
    boundary: artifact.captureBoundary,
    nativeOutput: artifact.nativeOutput,
    regimes,
    comparisons,
    derivations,
    graph,
    limitations: artifact.limitations,
    statistics: Object.freeze({
      derivationCount: derivations.length,
      directEdgeCount: graph.directEdges.length,
      closureEdgeCount: graph.closureEdges.length,
      comparisonCount: comparisons.length
    }),
    comparison(id) {
      const result = comparisonIndex.get(id);
      if (!result) throw new RangeError(`Unknown comparison ${id}.`);
      return result;
    },
    regime(id) {
      const result = regimeIndex.get(id);
      if (!result) throw new RangeError(`Unknown identity regime ${id}.`);
      return result;
    },
    derivation(id) {
      const result = fixtureIndex.get(id);
      if (!result) throw new RangeError(`Unknown derivation ${id}.`);
      return result;
    }
  });
}
