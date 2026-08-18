const SHA256 = /^[0-9a-f]{64}$/;
const EXECUTION_IDS = Object.freeze(["valid", "shortcut", "material-break", "unauthorized-actor", "command-deviation"]);
const COST_IDS = Object.freeze(["step-count", "distinct-actor-count", "attestation-count", "material-transition-count"]);

function fail(message) { throw new Error(`in-toto Admissibility artifact invalid: ${message}`); }
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

export function createInTotoAdmissibilityModel(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail("artifact must be an object");
  const artifact = structuredClone(input);
  if (artifact.format !== "onto2d-in-toto-admissibility-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "in-toto-admissibility-v1") fail("unsupported artifact version");
  if (artifact.specification?.version !== "1.0.0" || artifact.specification.commandMismatchSemantics !== "warning-only") fail("pinned specification semantics are missing");
  if (!/^sha256:[0-9a-f]{64}$/.test(artifact.caseIdentity ?? "") || !SHA256.test(artifact.artifacts?.final?.sha256 ?? "")) fail("case or final identity is invalid");
  if (!Array.isArray(artifact.executions) || !same(artifact.executions.map((execution) => execution.id), EXECUTION_IDS)) fail("execution inventory is incomplete or reordered");
  const executionIndex = indexBy(artifact.executions, "id", "executions");
  if (new Set(artifact.executions.map((execution) => execution.finalArtifact?.sha256)).size !== 1 || artifact.executions[0].finalArtifact.sha256 !== artifact.artifacts.final.sha256) fail("actual executions do not share the exact final artifact");
  const expectedStatus = { valid: ["accepted", "accepted"], shortcut: ["rejected", "rejected"], "material-break": ["rejected", "rejected"], "unauthorized-actor": ["rejected", "rejected"], "command-deviation": ["accepted", "rejected"] };
  for (const execution of artifact.executions) {
    if (!Array.isArray(execution.links) || !execution.links.length || !execution.actual) fail(`${execution.id} is not a bounded actual link set`);
    if (!Array.isArray(execution.verification?.native?.checks) || !Array.isArray(execution.verification.native.warnings)) fail(`${execution.id} verification records are incomplete`);
    if (!same([execution.verification.native.status, execution.verification.strictCommand.status], expectedStatus[execution.id])) fail(`${execution.id} verdict differs from the reviewed contract`);
  }
  const routes = artifact.pathSpace?.routes;
  if (!Array.isArray(routes) || routes.length !== 4 || routes.some((route) => route.counterfactual && route.actual)) fail("declared route boundary is invalid");
  const routeIndex = indexBy(routes, "id", "routes");
  const results = artifact.historicalLoad?.results;
  if (!Array.isArray(results) || !same(results.map((result) => result.costFunction), COST_IDS)) fail("Historical Load inventory is invalid");
  const loadIndex = indexBy(results, "costFunction", "Historical Load");
  for (const result of results) if (result.historicalLoad !== result.admissibleOptimumCost - result.freeOptimumCost) fail(`${result.costFunction} load equation is inconsistent`);
  deepFreeze(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    specification: artifact.specification,
    layout: artifact.layout,
    finalArtifact: artifact.artifacts.final,
    executions: artifact.executions,
    routes,
    historicalLoad: artifact.historicalLoad,
    evidenceBoundary: artifact.evidenceBoundary,
    execution(id) { const value = executionIndex.get(id); if (!value) throw new RangeError(`Unknown execution ${id}.`); return value; },
    route(id) { const value = routeIndex.get(id); if (!value) throw new RangeError(`Unknown route ${id}.`); return value; },
    load(id) { const value = loadIndex.get(id); if (!value) throw new RangeError(`Unknown Historical Load cost ${id}.`); return value; }
  });
}
