import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  PREDICATE_EXPRESSION_ANALYZER_VERSION,
  PREDICATE_PLAN_COMPILER_VERSION,
  analyzePredicateExpression
} from "./predicate-analyzer.js";

const PLAN_FIELDS = new Set([
  "schemaVersion",
  "compiler",
  "planHash",
  "predicateId",
  "phase",
  "referencesDepth",
  "monotoneViolation",
  "expressionAnalysisHash",
  "pruning",
  "expressionHash",
  "expression",
  "requirements",
  "symbols",
  "truthPersistence",
  "partialDetectability",
  "statistics"
]);

export const PREDICATE_PLAN_VERIFIER_VERSION = "predicate-plan-verifier-v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "VERIFY_PREDICATE_PLAN", message, details });
}

function simplifiedSymbol(descriptor) {
  if (!isObject(descriptor) || typeof descriptor.kind !== "string") {
    fail("PREDICATE_PLAN_INVALID", "Predicate plan contains invalid symbol metadata.", {
      descriptor
    });
  }
  if (descriptor.kind === "quantity") {
    return {
      kind: "quantity",
      unit: descriptor.unit,
      ...(descriptor.semantic === undefined ? {} : { semantic: descriptor.semantic })
    };
  }
  return { kind: descriptor.kind };
}

function simplifiedRegistry(registry) {
  if (!isObject(registry)) {
    fail("PREDICATE_PLAN_INVALID", "Predicate plan symbol registry must be an object.");
  }
  return Object.fromEntries(
    Object.keys(registry).sort().map((name) => [name, simplifiedSymbol(registry[name])])
  );
}

function analysisEnvironment(plan) {
  return {
    invariants: simplifiedRegistry(plan.symbols?.invariants),
    attributes: simplifiedRegistry(plan.symbols?.attributes),
    perturbations: plan.requirements?.perturbations,
    substructurePolicies: plan.requirements?.substructurePolicies
  };
}

export function verifyPredicatePlan(input) {
  let plan;
  try {
    plan = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("PREDICATE_PLAN_INVALID", "Predicate plan is not canonicalizable.", {
      causeCode: error.code
    });
  }
  if (!isObject(plan)) {
    fail("PREDICATE_PLAN_INVALID", "A compiled predicate plan must be an object.");
  }
  const fields = Object.keys(plan);
  const unknown = fields.filter((field) => !PLAN_FIELDS.has(field));
  const missing = [...PLAN_FIELDS].filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail("PREDICATE_PLAN_INVALID", "Predicate plan fields do not match the supported compiler contract.", {
      unknown,
      missing
    });
  }
  if (plan.schemaVersion !== "1" || plan.compiler !== PREDICATE_PLAN_COMPILER_VERSION) {
    fail("PREDICATE_PLAN_INVALID", "Predicate plan version is not supported by the verifier.", {
      schemaVersion: plan.schemaVersion,
      compiler: plan.compiler
    });
  }
  if (
    typeof plan.predicateId !== "string" ||
    plan.predicateId.length === 0 ||
    plan.predicateId !== plan.predicateId.trim() ||
    !new Set(["formation", "maintenance", "termination"]).has(plan.phase) ||
    !new Set(["below", "self"]).has(plan.referencesDepth) ||
    typeof plan.monotoneViolation !== "boolean"
  ) {
    fail("PREDICATE_PLAN_INVALID", "Predicate plan metadata is not a valid compiler output.");
  }

  const expressionHash = hashCanonical(HASH_DOMAINS.PREDICATE_EXPRESSION, plan.expression);
  if (expressionHash !== plan.expressionHash) {
    fail("PREDICATE_PLAN_HASH_MISMATCH", "Predicate expression does not match its declared hash.", {
      expected: expressionHash,
      actual: plan.expressionHash
    });
  }

  const environment = analysisEnvironment(plan);
  let analysis;
  try {
    analysis = analyzePredicateExpression(plan.expression, { environment });
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("PREDICATE_PLAN_INVALID", "Predicate plan cannot be reproduced by the supported analyzer.", {
      causeCode: error.code
    });
  }
  if (
    analysis.analyzer !== PREDICATE_EXPRESSION_ANALYZER_VERSION ||
    analysis.analysisHash !== plan.expressionAnalysisHash ||
    analysis.expressionHash !== plan.expressionHash
  ) {
    fail("PREDICATE_PLAN_HASH_MISMATCH", "Predicate analysis does not match the compiled plan.", {
      expected: analysis.analysisHash,
      actual: plan.expressionAnalysisHash
    });
  }

  for (const [field, expected, actual] of [
    ["expression", analysis.expression, plan.expression],
    ["requirements", analysis.requirements, plan.requirements],
    ["symbols", analysis.symbols, plan.symbols],
    ["truthPersistence", analysis.truthPersistence, plan.truthPersistence],
    ["partialDetectability", analysis.partialDetectability, plan.partialDetectability],
    ["statistics", analysis.statistics, plan.statistics]
  ]) {
    if (canonicalize(expected) !== canonicalize(actual)) {
      fail("PREDICATE_PLAN_INVALID", "Predicate plan analysis witness is internally inconsistent.", {
        field
      });
    }
  }

  const staticFailurePersistence = analysis.truthPersistence.fail;
  const partialFailureDetectable = analysis.partialDetectability.fail;
  const eligibility = plan.monotoneViolation === false
    ? "disabled"
    : staticFailurePersistence !== "proven"
      ? "blocked-unproven"
      : partialFailureDetectable
        ? "static-proven"
        : "blocked-partial-data";
  const expectedPruning = {
    declared: plan.monotoneViolation,
    staticFailurePersistence,
    partialFailureDetectable,
    auditRequired: plan.monotoneViolation,
    eligibility
  };
  if (canonicalize(expectedPruning) !== canonicalize(plan.pruning)) {
    fail("PREDICATE_PLAN_INVALID", "Predicate pruning metadata cannot be reproduced from its analysis.");
  }

  const planBasis = {
    schemaVersion: plan.schemaVersion,
    compiler: plan.compiler,
    predicateId: plan.predicateId,
    phase: plan.phase,
    referencesDepth: plan.referencesDepth,
    monotoneViolation: plan.monotoneViolation,
    expressionAnalysisHash: plan.expressionAnalysisHash,
    pruning: plan.pruning
  };
  const planHash = hashCanonical(HASH_DOMAINS.PREDICATE_PLAN, planBasis);
  if (planHash !== plan.planHash) {
    fail("PREDICATE_PLAN_HASH_MISMATCH", "Predicate plan metadata does not match its declared hash.", {
      expected: planHash,
      actual: plan.planHash
    });
  }
  return deepFreeze({
    verifier: PREDICATE_PLAN_VERIFIER_VERSION,
    plan,
    analysis,
    environment
  });
}
