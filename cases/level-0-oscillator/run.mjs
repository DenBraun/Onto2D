import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  canonicalize,
  canonicalizeCandidate,
  compilePredicate,
  evaluateGraphPredicatePlan,
  hashCanonical,
  validateOracleResponse,
  createOracleRequestBinding
} from "../../packages/kernel/src/index.js";
import {
  LEVEL_ZERO_REFERENCE_SOLVER,
  levelZeroReferenceSolver
} from "./solver/reference-solver.mjs";

const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(caseRoot, "../..");
const MODEL_DOMAIN = "onto2d:level-zero-model:v1";
const MODE_DOMAIN = "onto2d:level-zero-mode:v1";
const ANALYSIS_DOMAIN = "onto2d:level-zero-validation:v1";

function predicate(id, expr) {
  return {
    id,
    phase: "formation",
    monotoneViolation: false,
    referencesDepth: "below",
    expr,
    explain: { pass: "passes", fail: "fails", indeterminate: "unknown" },
    claimRefs: []
  };
}

const TRIAD_PLAN = compilePredicate(predicate("level-0-triadic-support-v1", {
  op: "all",
  args: [
    { op: "countRole", role: "resonant-support", min: 3, max: 3 },
    {
      op: "cycleExists",
      roles: ["resonant-support"],
      projection: "undirected-simple",
      minLength: 3,
      maxLength: 3
    },
    {
      op: "degree",
      node: { kind: "all" },
      role: "resonant-support",
      min: 2,
      max: 2
    }
  ]
}));

const CYCLE_PLAN = compilePredicate(predicate("level-0-simple-cycle-v1", {
  op: "cycleExists",
  roles: ["resonant-support"],
  projection: "undirected-simple",
  minLength: 3,
  maxLength: 3
}));

function validateModel(model) {
  if (
    !model ||
    model.schemaVersion !== "1" ||
    model.caseId !== "level-0-oscillator" ||
    !Array.isArray(model.scenarios) ||
    model.scenarios.length < 1
  ) {
    throw new TypeError("Unsupported Level-0 reference model.");
  }
  if (canonicalize(model.oracle.solver) !== canonicalize(LEVEL_ZERO_REFERENCE_SOLVER)) {
    throw new TypeError("Level-0 model solver identity does not match the implementation.");
  }
  const scenarioIds = model.scenarios.map((scenario) => scenario.id);
  if (new Set(scenarioIds).size !== scenarioIds.length) {
    throw new TypeError("Level-0 scenario identifiers must be unique.");
  }
  return model;
}

export async function verifyLevelZeroSource(model) {
  const lock = JSON.parse(await readFile(new URL("./source-lock.json", import.meta.url), "utf8"));
  const locked = lock.sources.find((source) => source.name === model.source.name);
  if (!locked) throw new TypeError("Level-0 model source is absent from source-lock.json.");
  for (const field of ["repositoryPath", "doi", "version", "sha256", "bytes"]) {
    if (model.source[field] !== locked[field]) {
      throw new TypeError(`Level-0 model source ${field} differs from source-lock.json.`);
    }
  }
  if (
    !model.source.pageRange ||
    !Number.isInteger(model.source.pageRange.start) ||
    !Number.isInteger(model.source.pageRange.end) ||
    model.source.pageRange.start < 1 ||
    model.source.pageRange.end < model.source.pageRange.start ||
    model.source.pageRange.end > locked.pages
  ) {
    throw new TypeError("Level-0 model source page range is invalid.");
  }
  const sourcePath = path.resolve(repositoryRoot, model.source.repositoryPath);
  if (!sourcePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new TypeError("Level-0 model source path leaves the repository.");
  }
  const bytes = await readFile(sourcePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== model.source.bytes || sha256 !== model.source.sha256) {
    throw new TypeError("Level-0 model source does not match its frozen bytes and SHA-256.");
  }
  return {
    name: locked.name,
    repositoryPath: locked.repositoryPath,
    bytes: locked.bytes,
    pages: locked.pages,
    doi: locked.doi,
    conceptDoi: locked.conceptDoi,
    version: locked.version,
    publicationDate: locked.publicationDate,
    license: locked.license,
    sourceUrl: locked.sourceUrl,
    sha256: `sha256:${locked.sha256}`,
    reviewStatus: locked.reviewStatus,
    modelPageRange: model.source.pageRange
  };
}

function candidateFor(modelHash, scenario) {
  const nodeIndex = new Map(scenario.modes.map((mode, index) => [mode.id, index]));
  if (nodeIndex.size !== scenario.modes.length) {
    throw new TypeError(`Scenario ${scenario.id} mode identifiers must be unique.`);
  }
  const nodes = scenario.modes.map((mode) => ({
    ref: hashCanonical(MODE_DOMAIN, { modelHash, scenarioId: scenario.id, mode })
  }));
  const edges = scenario.edges.map((edge, index) => {
    if (!nodeIndex.has(edge.from) || !nodeIndex.has(edge.to)) {
      throw new TypeError(`Scenario ${scenario.id} edge ${index} references an unknown mode.`);
    }
    return {
      from: nodeIndex.get(edge.from),
      to: nodeIndex.get(edge.to),
      role: edge.role
    };
  });
  return { domain: "single-candidate", nodes, edges };
}

function removeNode(candidate, removedIndex) {
  const oldToNew = new Map();
  const nodes = [];
  candidate.nodes.forEach((node, index) => {
    if (index === removedIndex) return;
    oldToNew.set(index, nodes.length);
    nodes.push(node);
  });
  const edges = candidate.edges
    .filter((edge) => edge.from !== removedIndex && edge.to !== removedIndex)
    .map((edge) => ({
      ...edge,
      from: oldToNew.get(edge.from),
      to: oldToNew.get(edge.to)
    }));
  return { ...candidate, nodes, edges };
}

function simpleCycleRank(candidate) {
  const parents = candidate.nodes.map((_, index) => index);
  const find = (node) => {
    let current = node;
    while (parents[current] !== current) current = parents[current];
    while (parents[node] !== node) {
      const next = parents[node];
      parents[node] = current;
      node = next;
    }
    return current;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  const uniqueEdges = new Set();
  for (const edge of candidate.edges) {
    if (edge.from === edge.to) continue;
    const low = Math.min(edge.from, edge.to);
    const high = Math.max(edge.from, edge.to);
    uniqueEdges.add(`${low}:${high}`);
    union(low, high);
  }
  const components = new Set(candidate.nodes.map((_, index) => find(index))).size;
  return uniqueEdges.size - candidate.nodes.length + components;
}

function structuralResult(candidate, requiredRank) {
  const triad = evaluateGraphPredicatePlan(TRIAD_PLAN, candidate, {
    policy: { allowParallelEdges: true }
  });
  const cycleRank = simpleCycleRank(candidate);
  const removals = candidate.nodes.map((_, removedIndex) => {
    const reduced = removeNode(candidate, removedIndex);
    const evaluation = evaluateGraphPredicatePlan(CYCLE_PLAN, reduced, {
      policy: { connected: false, allowParallelEdges: true }
    });
    return {
      removedInputIndex: removedIndex,
      remainingCandidateId: evaluation.candidateId,
      cycleOutcome: evaluation.outcome
    };
  });
  const removalIrreducible = removals.every((removal) => removal.cycleOutcome === "fail");
  return {
    triadEvaluation: triad,
    simpleCycleRank: cycleRank,
    requiredSimpleCycleRank: requiredRank,
    rankPassed: cycleRank >= requiredRank,
    removalIrreducible,
    removals,
    passed: triad.outcome === "pass" && cycleRank >= requiredRank && removalIrreducible
  };
}

function quantityValues(validation) {
  return Object.fromEntries(Object.entries(validation.acceptedValues).map(([id, quantity]) => [
    id,
    quantity.value
  ]));
}

function numericalResult(values, acceptance) {
  const dispersionPassed =
    values.dispersion_max_abs_residual <= acceptance.dispersionMaxAbsResidual;
  const stationarityPassed =
    values.stationarity_l2_residual_fine <= acceptance.stationarityFineL2Residual &&
    values.stationarity_observed_order >= acceptance.stationarityObservedOrderMin;
  const balancePassed =
    values.wave_number_balance_abs_residual <= acceptance.waveNumberBalanceAbsResidual &&
    values.frequency_balance_abs_residual <= acceptance.frequencyBalanceAbsResidual;
  const periodicNormDiagnosticPassed =
    values.periodic_norm_relative_drift <= acceptance.periodicNormRelativeDrift;
  return {
    values,
    dispersionPassed,
    stationarityPassed,
    balancePassed,
    periodicNormDiagnosticPassed,
    passed: dispersionPassed && stationarityPassed && balancePassed && periodicNormDiagnosticPassed
  };
}

function requestFor(model, modelHash, scenario, canonicalForm) {
  const sourceHash = `sha256:${model.source.sha256}`;
  return createOracleRequestBinding({
    candidate: canonicalForm,
    quantities: model.oracle.quantities,
    parameters: {
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      modelHash,
      scenarioId: scenario.id,
      modes: scenario.modes,
      spacePeriod: model.normalization.spacePeriod,
      timePeriod: model.normalization.timePeriod,
      coarseGrid: model.numericalMethod.coarseGrid,
      fineGrid: model.numericalMethod.fineGrid,
      roundingSignificantDigits: model.numericalMethod.roundingSignificantDigits,
      reportedAbsoluteTolerance: model.numericalMethod.reportedAbsoluteTolerance,
      evidenceIds: [sourceHash, modelHash]
    },
    toleranceTarget: model.oracle.toleranceTarget,
    solver: model.oracle.solver
  });
}

export async function runLevelZeroValidation({ model: suppliedModel } = {}) {
  const model = validateModel(suppliedModel ?? JSON.parse(await readFile(
    new URL("./model-v1.json", import.meta.url),
    "utf8"
  )));
  const source = await verifyLevelZeroSource(model);
  const modelHash = hashCanonical(MODEL_DOMAIN, model);
  const sourceHash = source.sha256;
  const scenarios = [];

  for (const scenario of model.scenarios) {
    const candidate = candidateFor(modelHash, scenario);
    const canonical = canonicalizeCandidate(candidate);
    const requestBinding = requestFor(model, modelHash, scenario, canonical.canonicalForm);
    const oracleResponse = await levelZeroReferenceSolver.evaluate({
      requestHash: requestBinding.requestHash,
      request: requestBinding.request
    });
    const oracleValidation = validateOracleResponse(requestBinding, oracleResponse, {
      evidenceIds: [sourceHash, modelHash]
    });
    const numerical = numericalResult(quantityValues(oracleValidation), model.acceptance);
    const structural = structuralResult(candidate, model.acceptance.requiredSimpleCycleRank);
    const admitted = oracleValidation.status === "accepted" && numerical.passed && structural.passed;
    scenarios.push({
      id: scenario.id,
      control: scenario.control,
      description: scenario.description,
      candidateId: canonical.candidateId,
      skeletonId: canonical.skeletonId,
      requestBinding,
      oracleResponse,
      oracleValidation,
      numerical,
      structural,
      admitted,
      expectedAdmitted: scenario.expectedAdmitted,
      expectationMatched: admitted === scenario.expectedAdmitted
    });
  }

  const basis = {
    schemaVersion: "1",
    caseId: model.caseId,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    modelHash,
    sourceHash,
    source,
    status: "computational-conformance-only",
    scope: model.scope,
    solver: LEVEL_ZERO_REFERENCE_SOLVER,
    scenarios,
    summary: {
      scenarioCount: scenarios.length,
      admittedScenarioIds: scenarios.filter((scenario) => scenario.admitted).map((scenario) => scenario.id),
      rejectedScenarioIds: scenarios.filter((scenario) => !scenario.admitted).map((scenario) => scenario.id),
      allExpectationsMatched: scenarios.every((scenario) => scenario.expectationMatched),
      fullLevelZeroValidated: false,
      empiricalValidationClaimed: false
    }
  };
  return {
    ...basis,
    analysisHash: hashCanonical(ANALYSIS_DOMAIN, basis)
  };
}

function parseArguments(argv) {
  const options = {
    output: path.join(caseRoot, "artifacts", "reference-validation-v1.json"),
    verify: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--verify") options.verify = true;
    else if (flag === "--output" && argv[index + 1]) {
      options.output = path.resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${flag}`);
    }
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const result = await runLevelZeroValidation();
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (options.verify) {
    const frozen = await readFile(options.output, "utf8");
    if (frozen !== serialized) throw new Error("Frozen Level-0 validation artifact differs from reproduction.");
    process.stdout.write(`Verified ${options.output}\n`);
  } else {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, serialized, "utf8");
    process.stdout.write(`Wrote ${options.output}\n`);
  }
}
