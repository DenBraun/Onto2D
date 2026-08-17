import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashCanonical } from "@onto2d/kernel/canonical";
import { extractCase } from "./extract.mjs";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const ANALYSIS_ROOT = path.join(CASE_ROOT, "analysis");
const CONSTRUCTION_FILE = path.join(ANALYSIS_ROOT, "construction-space.json");
const REGIMES_FILE = path.join(ANALYSIS_ROOT, "regimes.json");
const OUTPUT_FILE = path.join(ANALYSIS_ROOT, "historical-load.json");
const PATH_SPACE_DOMAIN = "onto2d:live-bootstrap-path-space:v1";
const REGIMES_DOMAIN = "onto2d:live-bootstrap-regimes:v1";
const RESULT_DOMAIN = "onto2d:live-bootstrap-historical-load-result:v1";
const BUNDLE_DOMAIN = "onto2d:live-bootstrap-historical-load-bundle:v1";
const PROFILE_DOMAIN = "onto2d:live-bootstrap-analysis-profile:v1";
const PROPERTY_FIELDS = new Set([
  "actual",
  "sourceDerived",
  "bootstrapAncestry",
  "auditableBootstrap"
]);
const COST_FUNCTIONS = new Set([
  "event-count",
  "build-event-count",
  "distinct-tool-count",
  "trust-root-count"
]);

function fail(message) {
  throw new Error(`live-bootstrap analysis failed: ${message}`);
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    fail(`${label} must be a normalized non-empty string`);
  }
  return value;
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateProperties(properties, label) {
  exactKeys(properties, PROPERTY_FIELDS, label);
  for (const [name, value] of Object.entries(properties)) {
    if (typeof value !== "boolean") fail(`${label}.${name} must be boolean`);
  }
}

function validateStep(step, label, counterfactual) {
  exactKeys(step, [
    "stepId",
    "edgeId",
    "kind",
    "label",
    "toolId",
    "trustRoots",
    "cost"
  ], label);
  nonEmpty(step.stepId, `${label}.stepId`);
  if (counterfactual) nonEmpty(step.edgeId, `${label}.edgeId`);
  if (!counterfactual && step.edgeId !== null) fail(`${label}.edgeId must be null for an actual step`);
  nonEmpty(step.kind, `${label}.kind`);
  nonEmpty(step.label, `${label}.label`);
  if (step.toolId !== null) nonEmpty(step.toolId, `${label}.toolId`);
  if (!Array.isArray(step.trustRoots)
      || step.trustRoots.some((root) => typeof root !== "string" || root.length === 0)
      || new Set(step.trustRoots).size !== step.trustRoots.length) {
    fail(`${label}.trustRoots must contain unique non-empty strings`);
  }
  exactKeys(step.cost, ["event", "build"], `${label}.cost`);
  for (const [name, value] of Object.entries(step.cost)) {
    if (!Number.isSafeInteger(value) || value < 0) fail(`${label}.cost.${name} must be a non-negative integer`);
  }
}

function validateConstructionConfiguration(configuration) {
  exactKeys(configuration, [
    "format",
    "formatVersion",
    "analysisVersion",
    "bounded",
    "target",
    "actualPath",
    "counterfactualEdges",
    "counterfactualPaths",
    "costFunctions"
  ], "construction space");
  if (configuration.format !== "onto2d-live-bootstrap-construction-space"
      || configuration.formatVersion !== "1"
      || configuration.bounded !== true) {
    fail("construction space must use the supported bounded v1 format");
  }
  nonEmpty(configuration.analysisVersion, "analysisVersion");
  exactKeys(configuration.target, ["id", "label", "selector"], "target");
  nonEmpty(configuration.target.id, "target.id");
  nonEmpty(configuration.target.label, "target.label");
  exactKeys(configuration.target.selector, ["directive", "target", "occurrence"], "target.selector");
  if (configuration.target.selector.directive !== "build") fail("the first analysis target must select a build event");
  nonEmpty(configuration.target.selector.target, "target.selector.target");
  if (!Number.isSafeInteger(configuration.target.selector.occurrence)
      || configuration.target.selector.occurrence < 1) {
    fail("target.selector.occurrence must be a positive safe integer");
  }

  exactKeys(
    configuration.actualPath,
    ["id", "label", "initialTrustRoot", "properties", "interpretationNote"],
    "actualPath"
  );
  nonEmpty(configuration.actualPath.id, "actualPath.id");
  nonEmpty(configuration.actualPath.label, "actualPath.label");
  nonEmpty(configuration.actualPath.initialTrustRoot, "actualPath.initialTrustRoot");
  nonEmpty(configuration.actualPath.interpretationNote, "actualPath.interpretationNote");
  validateProperties(configuration.actualPath.properties, "actualPath.properties");
  if (!configuration.actualPath.properties.actual) fail("actualPath.properties.actual must be true");

  if (!Array.isArray(configuration.counterfactualEdges)
      || configuration.counterfactualEdges.length === 0) {
    fail("construction space must declare counterfactual edges");
  }
  const edgeIds = new Set();
  for (const [index, edge] of configuration.counterfactualEdges.entries()) {
    const label = `counterfactualEdges[${index}]`;
    exactKeys(edge, ["id", "from", "to", "label", "introducedBy", "upstreamFact"], label);
    for (const field of ["id", "from", "to", "label"]) nonEmpty(edge[field], `${label}.${field}`);
    if (edge.introducedBy !== "Onto2D" || edge.upstreamFact !== false) {
      fail(`${label} must be explicitly introduced by Onto2D and not marked as an upstream fact`);
    }
    if (edgeIds.has(edge.id)) fail(`duplicate counterfactual edge ${edge.id}`);
    edgeIds.add(edge.id);
  }

  if (!Array.isArray(configuration.counterfactualPaths)
      || configuration.counterfactualPaths.length === 0) {
    fail("construction space must declare counterfactual paths");
  }
  const pathIds = new Set([configuration.actualPath.id]);
  const referencedEdges = new Set();
  for (const [index, declaredPath] of configuration.counterfactualPaths.entries()) {
    const label = `counterfactualPaths[${index}]`;
    exactKeys(declaredPath, ["id", "label", "target", "properties", "steps"], label);
    nonEmpty(declaredPath.id, `${label}.id`);
    nonEmpty(declaredPath.label, `${label}.label`);
    if (declaredPath.target !== configuration.target.id) fail(`${label} has the wrong target`);
    if (pathIds.has(declaredPath.id)) fail(`duplicate path ${declaredPath.id}`);
    pathIds.add(declaredPath.id);
    validateProperties(declaredPath.properties, `${label}.properties`);
    if (declaredPath.properties.actual) fail(`${label} cannot be marked actual`);
    if (!Array.isArray(declaredPath.steps) || declaredPath.steps.length === 0) {
      fail(`${label}.steps must be non-empty`);
    }
    const stepIds = new Set();
    for (const [stepIndex, step] of declaredPath.steps.entries()) {
      validateStep(step, `${label}.steps[${stepIndex}]`, true);
      if (!edgeIds.has(step.edgeId)) fail(`${label} references unknown edge ${step.edgeId}`);
      if (stepIds.has(step.stepId)) fail(`${label} has duplicate step ${step.stepId}`);
      stepIds.add(step.stepId);
      referencedEdges.add(step.edgeId);
    }
  }
  if (referencedEdges.size !== edgeIds.size) fail("every counterfactual edge must occur in a declared path");

  if (!Array.isArray(configuration.costFunctions) || configuration.costFunctions.length !== 4) {
    fail("construction space must declare exactly four cost functions");
  }
  const costIds = new Set();
  for (const [index, cost] of configuration.costFunctions.entries()) {
    exactKeys(cost, ["id", "label", "description"], `costFunctions[${index}]`);
    if (!COST_FUNCTIONS.has(cost.id) || costIds.has(cost.id)) fail(`invalid or duplicate cost function ${cost.id}`);
    costIds.add(cost.id);
    nonEmpty(cost.label, `costFunctions[${index}].label`);
    nonEmpty(cost.description, `costFunctions[${index}].description`);
  }
  return configuration;
}

function validateRegimes(regimes, analysisVersion) {
  exactKeys(regimes, ["format", "formatVersion", "analysisVersion", "constraints", "regimes"], "regimes");
  if (regimes.format !== "onto2d-live-bootstrap-admissibility-regimes"
      || regimes.formatVersion !== "1"
      || regimes.analysisVersion !== analysisVersion) {
    fail("regimes must use the matching supported v1 format");
  }
  if (!Array.isArray(regimes.constraints) || regimes.constraints.length === 0) fail("constraints must be non-empty");
  const constraintsById = new Map();
  for (const [index, constraint] of regimes.constraints.entries()) {
    const label = `constraints[${index}]`;
    exactKeys(constraint, ["id", "description", "origin", "predicate"], label);
    nonEmpty(constraint.id, `${label}.id`);
    nonEmpty(constraint.description, `${label}.description`);
    if (constraint.origin !== "onto2d-defined") fail(`${label}.origin must disclose Onto2D ownership`);
    exactKeys(constraint.predicate, ["field", "equals"], `${label}.predicate`);
    if (!PROPERTY_FIELDS.has(constraint.predicate.field) || typeof constraint.predicate.equals !== "boolean") {
      fail(`${label}.predicate is unsupported`);
    }
    if (constraintsById.has(constraint.id)) fail(`duplicate constraint ${constraint.id}`);
    constraintsById.set(constraint.id, constraint);
  }
  if (!Array.isArray(regimes.regimes) || regimes.regimes.length === 0) fail("regimes list must be non-empty");
  const regimesById = new Map();
  for (const [index, regime] of regimes.regimes.entries()) {
    const label = `regimes[${index}]`;
    exactKeys(regime, ["id", "label", "description", "optimization", "constraints"], label);
    for (const field of ["id", "label", "description"]) nonEmpty(regime[field], `${label}.${field}`);
    if (typeof regime.optimization !== "boolean") fail(`${label}.optimization must be boolean`);
    if (!Array.isArray(regime.constraints) || new Set(regime.constraints).size !== regime.constraints.length) {
      fail(`${label}.constraints must contain unique IDs`);
    }
    for (const constraintId of regime.constraints) {
      if (!constraintsById.has(constraintId)) fail(`${label} references unknown constraint ${constraintId}`);
    }
    if (regimesById.has(regime.id)) fail(`duplicate regime ${regime.id}`);
    regimesById.set(regime.id, regime);
  }
  const free = regimesById.get("free");
  const observed = regimesById.get("observed");
  if (free?.optimization !== true || free.constraints.length !== 0) fail("free must be an unconstrained optimization regime");
  if (observed?.optimization !== false) fail("observed must remain a non-optimization reference regime");
  return { regimes, constraintsById, regimesById };
}

function resolveTargetEvent(trace, selector) {
  const matches = trace.events.filter((event) =>
    event.directive === selector.directive && event.target === selector.target
  );
  const event = matches[selector.occurrence - 1];
  if (event === undefined) fail("construction target selector does not resolve in the pinned trace");
  if (!event.profileStatus.active) fail("construction target resolves to an inactive event");
  return event;
}

function buildActualPath(trace, configuration) {
  const targetEvent = resolveTargetEvent(trace, configuration.target.selector);
  const steps = [{
    stepId: "step:pre-manifest-environment",
    edgeId: null,
    kind: "external-root-marker",
    label: "Pre-manifest environment boundary",
    toolId: null,
    trustRoots: [configuration.actualPath.initialTrustRoot],
    cost: { event: 0, build: 0 }
  }];
  for (const event of trace.events.slice(0, targetEvent.ordinal + 1)) {
    const active = event.profileStatus.active;
    steps.push({
      stepId: `step:${event.eventId}`,
      edgeId: null,
      kind: active ? "manifest-event-active" : "manifest-event-inactive",
      label: event.directive === "uninstall"
        ? `uninstall ${event.targets.join(" ")}`
        : event.directive === "define"
          ? `define ${event.definition.name}`
          : `${event.directive} ${event.target}`,
      toolId: active && event.directive === "build" ? `tool:${event.target}` : null,
      trustRoots: [],
      cost: {
        event: active ? 1 : 0,
        build: active && event.directive === "build" ? 1 : 0
      }
    });
  }
  return {
    id: configuration.actualPath.id,
    label: configuration.actualPath.label,
    target: configuration.target.id,
    properties: configuration.actualPath.properties,
    steps,
    provenance: {
      layer: "onto2d-analysis",
      basis: "pinned-manifest-prefix",
      targetEvent: targetEvent.eventId,
      interpretationNote: configuration.actualPath.interpretationNote
    }
  };
}

function buildPathSpace(trace, configuration, regimesInput) {
  const actualPath = buildActualPath(trace, configuration);
  const paths = [
    actualPath,
    ...configuration.counterfactualPaths.map((declaredPath) => ({
      ...structuredClone(declaredPath),
      provenance: {
        layer: "onto2d-analysis",
        basis: "explicit-counterfactual-declaration",
        targetEvent: null,
        interpretationNote: "This path is declared by Onto2D and is not an upstream execution trace."
      }
    }))
  ];
  for (const [pathIndex, candidate] of paths.entries()) {
    for (const [stepIndex, step] of candidate.steps.entries()) {
      validateStep(step, `paths[${pathIndex}].steps[${stepIndex}]`, candidate !== actualPath);
    }
  }
  const regimesIdentity = hashCanonical(REGIMES_DOMAIN, regimesInput);
  const basis = {
    format: "onto2d-live-bootstrap-finite-path-space",
    formatVersion: "1",
    analysisVersion: configuration.analysisVersion,
    upstreamRevision: trace.source.revision,
    traceIdentity: trace.traceIdentity,
    bounded: true,
    target: configuration.target,
    counterfactualEdges: configuration.counterfactualEdges,
    paths,
    costFunctions: configuration.costFunctions
  };
  return {
    ...basis,
    pathSpaceIdentity: hashCanonical(PATH_SPACE_DOMAIN, basis),
    regimesIdentity
  };
}

function pathCost(candidate, costFunctionId) {
  if (costFunctionId === "event-count") {
    return candidate.steps.reduce((total, step) => total + step.cost.event, 0);
  }
  if (costFunctionId === "build-event-count") {
    return candidate.steps.reduce((total, step) => total + step.cost.build, 0);
  }
  if (costFunctionId === "distinct-tool-count") {
    return new Set(candidate.steps.map((step) => step.toolId).filter((value) => value !== null)).size;
  }
  if (costFunctionId === "trust-root-count") {
    return new Set(candidate.steps.flatMap((step) => step.trustRoots)).size;
  }
  fail(`unknown cost function ${costFunctionId}`);
}

function satisfies(candidate, constraint) {
  return candidate.properties[constraint.predicate.field] === constraint.predicate.equals;
}

function admittedPaths(pathSpace, constraintIds, constraintsById) {
  return pathSpace.paths.filter((candidate) => constraintIds.every((constraintId) =>
    satisfies(candidate, constraintsById.get(constraintId))
  ));
}

function minimumPaths(candidates, costFunctionId) {
  const ordered = [...candidates].sort((left, right) =>
    pathCost(left, costFunctionId) - pathCost(right, costFunctionId)
    || compareCodePoints(left.id, right.id)
  );
  if (ordered.length === 0) return { cost: null, paths: [] };
  const cost = pathCost(ordered[0], costFunctionId);
  return {
    cost,
    paths: ordered.filter((candidate) => pathCost(candidate, costFunctionId) === cost)
  };
}

function firstDivergence(freePath, admissiblePath) {
  const maximum = Math.max(freePath.steps.length, admissiblePath.steps.length);
  for (let index = 0; index < maximum; index += 1) {
    const freeStep = freePath.steps[index]?.stepId ?? null;
    const admissibleStep = admissiblePath.steps[index]?.stepId ?? null;
    if (freeStep !== admissibleStep) return { index, freeStep, admissibleStep };
  }
  return null;
}

export function analyzeHistoricalLoad(pathSpace, regimeSet, request) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    fail("Historical Load requires an explicit request");
  }
  exactKeys(request, ["targetId", "costFunctionId", "regimeId"], "Historical Load request");
  for (const field of ["targetId", "costFunctionId", "regimeId"]) nonEmpty(request[field], `request.${field}`);
  if (pathSpace.bounded !== true || !Array.isArray(pathSpace.paths)) {
    fail("Historical Load requires an explicitly bounded finite path space");
  }
  if (request.targetId !== pathSpace.target.id) fail(`unknown target ${request.targetId}`);
  const costFunction = pathSpace.costFunctions.find((entry) => entry.id === request.costFunctionId);
  if (costFunction === undefined || !COST_FUNCTIONS.has(request.costFunctionId)) {
    fail(`unknown cost function ${request.costFunctionId}`);
  }
  const regime = regimeSet.regimesById.get(request.regimeId);
  if (regime === undefined) fail(`unknown regime ${request.regimeId}`);
  if (!regime.optimization) fail(`regime ${request.regimeId} is a reference regime, not an optimization regime`);

  const freeRegime = regimeSet.regimesById.get("free");
  const freeCandidates = admittedPaths(pathSpace, freeRegime.constraints, regimeSet.constraintsById);
  const selectedCandidates = admittedPaths(pathSpace, regime.constraints, regimeSet.constraintsById);
  const freeMinimum = minimumPaths(freeCandidates, request.costFunctionId);
  const admissibleMinimum = minimumPaths(selectedCandidates, request.costFunctionId);
  const context = {
    target: pathSpace.target,
    pathSpace: {
      identity: pathSpace.pathSpaceIdentity,
      size: pathSpace.paths.length,
      bounded: pathSpace.bounded
    },
    costFunction,
    regime: {
      id: regime.id,
      label: regime.label,
      constraints: regime.constraints,
      regimesIdentity: pathSpace.regimesIdentity
    },
    upstreamRevision: pathSpace.upstreamRevision,
    traceIdentity: pathSpace.traceIdentity,
    analysisVersion: pathSpace.analysisVersion,
    interpretation: {
      layer: "onto2d-analysis",
      disclaimer: "live-bootstrap does not define or claim this metric. Onto2D applies Historical Load to a pinned and explicitly bounded construction model."
    }
  };
  if (freeMinimum.paths.length === 0 || admissibleMinimum.paths.length === 0) {
    const basis = {
      ...context,
      status: "unresolved",
      reason: freeMinimum.paths.length === 0 ? "no-free-path" : "no-admissible-declared-path",
      a0: null,
      aF: null,
      dH: null,
      freePath: freeMinimum.paths[0]?.id ?? null,
      freeOptima: freeMinimum.paths.map((candidate) => candidate.id),
      admissiblePath: null,
      admissibleOptima: [],
      eliminatedFreeOptima: [],
      eliminatedFreeOptimumBy: [],
      firstDivergence: null,
      constraintAblation: []
    };
    return { ...basis, resultIdentity: hashCanonical(RESULT_DOMAIN, basis) };
  }

  const a0 = freeMinimum.cost;
  const aF = admissibleMinimum.cost;
  if (aF < a0) fail("an admissible optimum cannot be cheaper than the declared free optimum");
  const eliminatedFreeOptima = freeMinimum.paths.map((candidate) => ({
    pathId: candidate.id,
    constraintIds: regime.constraints.filter((constraintId) =>
      !satisfies(candidate, regimeSet.constraintsById.get(constraintId))
    )
  })).filter((entry) => entry.constraintIds.length > 0);
  const eliminatedFreeOptimumBy = [...new Set(
    eliminatedFreeOptima.flatMap((entry) => entry.constraintIds)
  )].sort(compareCodePoints);
  const constraintAblation = regime.constraints.map((constraintId) => {
    const remaining = regime.constraints.filter((candidate) => candidate !== constraintId);
    const ablatedMinimum = minimumPaths(
      admittedPaths(pathSpace, remaining, regimeSet.constraintsById),
      request.costFunctionId
    );
    const ablatedPath = ablatedMinimum.paths[0] ?? null;
    const ablatedCost = ablatedMinimum.cost;
    return {
      constraintId,
      ablatedPath: ablatedPath?.id ?? null,
      ablatedCost,
      costReduction: ablatedCost === null ? null : aF - ablatedCost
    };
  });
  const freeComparisonPath = freeMinimum.paths.find((candidate) =>
    !selectedCandidates.includes(candidate)
  ) ?? freeMinimum.paths[0];
  const admissiblePath = admissibleMinimum.paths[0];
  const basis = {
    ...context,
    status: "resolved",
    reason: null,
    a0,
    aF,
    dH: aF - a0,
    freePath: freeComparisonPath.id,
    freeOptima: freeMinimum.paths.map((candidate) => candidate.id),
    admissiblePath: admissiblePath.id,
    admissibleOptima: admissibleMinimum.paths.map((candidate) => candidate.id),
    eliminatedFreeOptima,
    eliminatedFreeOptimumBy,
    firstDivergence: firstDivergence(freeComparisonPath, admissiblePath),
    constraintAblation
  };
  return { ...basis, resultIdentity: hashCanonical(RESULT_DOMAIN, basis) };
}

export async function buildAnalysis() {
  const [{ trace }, configurationInput, regimesInput] = await Promise.all([
    extractCase(),
    readFile(CONSTRUCTION_FILE, "utf8").then(JSON.parse),
    readFile(REGIMES_FILE, "utf8").then(JSON.parse)
  ]);
  const configuration = validateConstructionConfiguration(configurationInput);
  const regimeSet = validateRegimes(regimesInput, configuration.analysisVersion);
  const pathSpace = buildPathSpace(trace, configuration, regimesInput);
  const analysisProfile = {
    format: "onto2d-live-bootstrap-analysis-profile",
    formatVersion: "1",
    analysisVersion: configuration.analysisVersion,
    upstreamRevision: trace.source.revision,
    traceIdentity: trace.traceIdentity,
    pathSpaceId: pathSpace.pathSpaceIdentity,
    bounded: true,
    targets: [configuration.target],
    costFunctions: configuration.costFunctions.map((entry) => entry.id),
    regimes: regimesInput.regimes,
    counterfactualEdges: configuration.counterfactualEdges
  };
  const results = [];
  for (const costFunction of configuration.costFunctions) {
    for (const regime of regimesInput.regimes.filter((entry) => entry.optimization)) {
      results.push(analyzeHistoricalLoad(pathSpace, regimeSet, {
        targetId: configuration.target.id,
        costFunctionId: costFunction.id,
        regimeId: regime.id
      }));
    }
  }
  const basis = {
    format: "onto2d-live-bootstrap-historical-load-bundle",
    formatVersion: "1",
    analysisVersion: configuration.analysisVersion,
    upstreamRevision: trace.source.revision,
    traceIdentity: trace.traceIdentity,
    sourceIdentity: trace.source.sourceIdentity,
    pathSpaceIdentity: pathSpace.pathSpaceIdentity,
    regimesIdentity: pathSpace.regimesIdentity,
    analysisProfile,
    analysisProfileIdentity: hashCanonical(PROFILE_DOMAIN, analysisProfile),
    pathSpace,
    results,
    disclaimer: "live-bootstrap does not define or claim Historical Load. Every value below belongs to Onto2D's finite declared construction model."
  };
  return Object.freeze({ ...basis, analysisIdentity: hashCanonical(BUNDLE_DOMAIN, basis) });
}

function serialized(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function materializeAnalysis(options = {}) {
  const analysis = await buildAnalysis();
  const expected = serialized(analysis);
  if (options.verify === true) {
    assert.equal(await readFile(OUTPUT_FILE, "utf8"), expected, "historical-load.json differs from exact replay");
  } else {
    await writeFile(OUTPUT_FILE, expected, "utf8");
  }
  return analysis;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--verify");
  if (unknown.length > 0) fail(`unknown argument ${unknown[0]}`);
  const verify = process.argv.includes("--verify");
  materializeAnalysis({ verify }).then((analysis) => {
    console.log(
      `Live-bootstrap Historical Load ${verify ? "verified" : "materialized"}: `
      + `${analysis.pathSpace.paths.length} declared paths, ${analysis.results.length} explicit results, `
      + `${analysis.analysisIdentity}.`
    );
  }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
