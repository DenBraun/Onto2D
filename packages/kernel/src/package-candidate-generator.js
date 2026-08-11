import { canonicalClone, deepFreeze } from "./canonical.js";
import {
  DEFAULT_CANDIDATE_ENUMERATION_LIMITS,
  enumerateDecoratedCandidates
} from "./candidate-enumerator.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { DEFAULT_GRAPH_CANONICALIZATION_LIMITS } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { materializePrimitiveDepthPopulation } from "./primitive-depth-population.js";
import { normalizeRunConfig } from "./run-config.js";
import { enumerateConnectedSkeletons } from "./skeleton-enumerator.js";

const EXECUTION_BUDGET_FIELDS = new Set([
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates"
]);
const OPTION_FIELDS = new Set([...EXECUTION_BUDGET_FIELDS, "kernelVersion"]);

export const PACKAGE_CANDIDATE_BINDER_VERSION = "package-candidate-binding-v1";
export const PACKAGE_CANDIDATE_GENERATOR_VERSION = "package-candidate-generator-v1";

export const DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS = deepFreeze({
  maxRawCandidates: DEFAULT_CANDIDATE_ENUMERATION_LIMITS.maxRawCandidates,
  maxDecorationStates: DEFAULT_CANDIDATE_ENUMERATION_LIMITS.maxDecorationStates,
  maxSearchStates: DEFAULT_GRAPH_CANONICALIZATION_LIMITS.maxSearchStates
});

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, code, path, message, details) {
  issues.push(validationIssue(code, path, message, details));
}

function throwValidation(issues, message = "Package candidate binding failed validation.") {
  throw new KernelValidationError(issues, message, {
    code: "PACKAGE_CANDIDATE_BINDING_VALIDATION_FAILED",
    stage: "BIND_PACKAGE_CANDIDATES"
  });
}

function normalizeExecutionOptions(options) {
  if (!isObject(options)) {
    throwValidation([
      validationIssue(
        "PACKAGE_CANDIDATE_OPTIONS_INVALID",
        "$options",
        "Package candidate execution options must be an object."
      )
    ]);
  }
  const value = canonicalClone(options);
  const issues = [];
  for (const key of Object.keys(value)) {
    if (!OPTION_FIELDS.has(key)) {
      addIssue(
        issues,
        "PACKAGE_CANDIDATE_OPTION_UNKNOWN",
        `$options.${key}`,
        "Unknown package candidate execution option.",
        { key }
      );
    }
  }
  const normalized = { ...DEFAULT_PACKAGE_CANDIDATE_EXECUTION_LIMITS, ...value };
  for (const field of EXECUTION_BUDGET_FIELDS) {
    if (!Number.isSafeInteger(normalized[field]) || normalized[field] < 1) {
      addIssue(
        issues,
        "PACKAGE_CANDIDATE_EXECUTION_BUDGET_INVALID",
        `$options.${field}`,
        "Package candidate execution budgets must be positive safe integers.",
        { value: normalized[field] }
      );
    }
  }
  if (
    normalized.kernelVersion !== undefined &&
    (typeof normalized.kernelVersion !== "string" || normalized.kernelVersion.trim().length === 0)
  ) {
    addIssue(
      issues,
      "PACKAGE_CANDIDATE_KERNEL_VERSION_INVALID",
      "$options.kernelVersion",
      "Expected kernel version must be a non-empty string.",
      { value: normalized.kernelVersion }
    );
  }
  if (typeof normalized.kernelVersion === "string") {
    normalized.kernelVersion = normalized.kernelVersion.trim();
  }
  if (issues.length > 0) throwValidation(issues);
  return normalized;
}

function materializeSourcePopulation(input, kernelVersion) {
  try {
    return materializePrimitiveDepthPopulation(input, {
      ...(kernelVersion === undefined ? {} : { kernelVersion })
    });
  } catch (error) {
    if (error instanceof KernelValidationError) {
      const issues = error.issues.map((entry) => validationIssue(
        entry.code === "LOADED_PACKAGE_INVALID"
          ? "PACKAGE_CANDIDATE_LOADED_PACKAGE_INVALID"
          : entry.code === "LOADED_PACKAGE_MISMATCH"
            ? "PACKAGE_CANDIDATE_LOADED_PACKAGE_MISMATCH"
            : entry.code,
        entry.path,
        entry.message,
        entry.details
      ));
      throwValidation(issues, "Loaded package cannot be reproduced by the package loader.");
    }
    if (error instanceof KernelError) {
      throwValidation([
        validationIssue(
          "PACKAGE_CANDIDATE_LOADED_PACKAGE_INVALID",
          "$package",
          "Loaded package cannot be reproduced by the package loader.",
          { causeCode: error.code }
        )
      ]);
    }
    throw error;
  }
}

function validateSupportedGenerationConfig(depthPopulation, config) {
  const issues = [];
  if (config.countingDomain === "single-candidate") {
    addIssue(
      issues,
      "PACKAGE_CANDIDATE_SINGLE_CANDIDATE_UNSUPPORTED",
      "$config.countingDomain",
      "single-candidate requires a caller-supplied candidate and cannot define an enumerated package universe."
    );
  }
  if (!config.graphPolicy.connected) {
    addIssue(
      issues,
      "PACKAGE_CANDIDATE_CONNECTED_POLICY_REQUIRED",
      "$config.graphPolicy.connected",
      "Package-driven enumeration currently defines only the connected-skeleton universe."
    );
  }
  if (config.graphPolicy.structuralNodeAttributes.length > 0) {
    addIssue(
      issues,
      "PACKAGE_CANDIDATE_NODE_ATTRIBUTES_UNAVAILABLE",
      "$config.graphPolicy.structuralNodeAttributes",
      "No package-to-candidate structural node-attribute derivation policy is implemented.",
      { attributes: config.graphPolicy.structuralNodeAttributes }
    );
  }
  if (config.graphPolicy.structuralEdgeAttributes.length > 0) {
    addIssue(
      issues,
      "PACKAGE_CANDIDATE_EDGE_ATTRIBUTES_UNAVAILABLE",
      "$config.graphPolicy.structuralEdgeAttributes",
      "No package-to-candidate structural edge-attribute derivation policy is implemented.",
      { attributes: config.graphPolicy.structuralEdgeAttributes }
    );
  }
  for (const field of ["maxWallTimeMs", "maxResidentBytes"]) {
    if (config.budget[field] !== undefined) {
      addIssue(
        issues,
        "PACKAGE_CANDIDATE_RESOURCE_BUDGET_UNSUPPORTED",
        `$config.budget.${field}`,
        "This synchronous deterministic enumerator does not implement wall-time or resident-memory enforcement.",
        { field, value: config.budget[field] }
      );
    }
  }
  if (depthPopulation.elements.length === 0) {
    addIssue(
      issues,
      "PACKAGE_CANDIDATE_PRIMITIVES_REQUIRED",
      "$package.normalized.primitives",
      "Package-driven enumeration requires at least one normalized primitive."
    );
  }
  if (issues.length > 0) throwValidation(issues);
}

function factorial(value) {
  let result = 1;
  for (let factor = 2; factor <= value; factor += 1) result *= factor;
  return result;
}

function validateCanonicalizationPreflight(config, execution) {
  const minimum = Math.max(2, factorial(config.budget.maxNodes));
  if (execution.maxSearchStates < minimum) {
    throwValidation([
      validationIssue(
        "PACKAGE_CANDIDATE_SEARCH_BUDGET_TOO_SMALL",
        "$options.maxSearchStates",
        "Canonicalization search budget must cover binding-input skeleton and edge-variant verification.",
        { value: execution.maxSearchStates, minimum, maxNodes: config.budget.maxNodes }
      )
    ]);
  }
}

function deriveProfileClasses(elements) {
  const classes = new Map();
  for (const element of elements) {
    const profileHash = element.profile.hash;
    if (!classes.has(profileHash)) classes.set(profileHash, []);
    classes.get(profileHash).push(element.id);
  }
  return [...classes.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([profileHash, unsortedMembers]) => {
      const members = [...unsortedMembers].sort(compareStrings);
      return {
        profileHash,
        members,
        representativeElementId: members[0]
      };
    });
}

function enumeratePackageSkeletons(maxNodes) {
  const skeletons = [];
  for (let nodeCount = 1; nodeCount <= maxNodes; nodeCount += 1) {
    const result = enumerateConnectedSkeletons(nodeCount);
    if (result.status !== "complete") {
      throw new KernelError({
        code: "PACKAGE_CANDIDATE_SKELETON_BASELINE_INCOMPLETE",
        stage: "BIND_PACKAGE_CANDIDATES",
        message: "Reviewed connected-skeleton limits did not cover the configured node count.",
        details: { nodeCount, exhausted: result.budget.exhausted }
      });
    }
    skeletons.push(...result.skeletons);
  }
  return skeletons.sort((left, right) => compareStrings(left.id, right.id));
}

function maximumGeneratedEdges(config) {
  const requested = config.budget.maxEdges === "n+2"
    ? config.budget.maxNodes + 2
    : config.budget.maxEdges;
  if (config.graphPolicy.allowParallelEdges) return requested;
  const nodeCount = config.budget.maxNodes;
  const groups = nodeCount * (nodeCount - 1) / 2 +
    (config.graphPolicy.allowSelfLoops ? nodeCount : 0);
  return Math.min(requested, groups);
}

/**
 * Freezes the finite, package-derived decoration alphabet and every execution
 * budget consumed by the current connected candidate generator.
 */
export function createPackageCandidateBinding(loadedPackage, runConfig, options = {}) {
  const execution = normalizeExecutionOptions(options);
  const depthPopulation = materializeSourcePopulation(loadedPackage, execution.kernelVersion);
  const config = normalizeRunConfig(runConfig);
  validateSupportedGenerationConfig(depthPopulation, config);
  validateCanonicalizationPreflight(config, execution);

  const elements = depthPopulation.elements;
  const profileClasses = deriveProfileClasses(elements);
  const nodeVariants = config.countingDomain === "profile-quotient"
    ? profileClasses.map((entry) => ({ ref: entry.profileHash }))
    : elements.map((entry) => ({ ref: entry.id }))
      .sort((left, right) => compareStrings(left.ref, right.ref));
  const edgeVariants = config.roleAlphabet.map((role) => ({ role }));
  const skeletons = enumeratePackageSkeletons(config.budget.maxNodes);
  const runConfigHash = hashCanonical(HASH_DOMAINS.RUN_CONFIG, config);
  const canonicalizationLimits = {
    maxNodes: DEFAULT_GRAPH_CANONICALIZATION_LIMITS.maxNodes,
    maxEdges: Math.max(
      DEFAULT_GRAPH_CANONICALIZATION_LIMITS.maxEdges,
      maximumGeneratedEdges(config),
      1
    ),
    maxSearchStates: execution.maxSearchStates
  };
  const basis = {
    schemaVersion: "1",
    binder: PACKAGE_CANDIDATE_BINDER_VERSION,
    packageId: depthPopulation.packageId,
    depthBasis: depthPopulation.depthBasis,
    runConfigHash,
    runConfig: config,
    sourcePopulation: {
      kind: "primitive-depth-population-selection-v1",
      population: depthPopulation,
      selection: {
        sourceDepths: config.sourceDepths,
        targetDepth: 1,
        availableDepths: [0],
        selectedDepths: [0]
      },
      elementIds: elements.map((entry) => entry.id).sort(compareStrings),
      profileRepresentativePolicy: "lexicographically-smallest-element-id-v1",
      profileClasses
    },
    enumerationInput: {
      domain: config.countingDomain,
      skeletons,
      nodeVariants,
      edgeVariants,
      graphPolicy: config.graphPolicy
    },
    enumerationOptions: {
      maxEdges: config.budget.maxEdges,
      maxRawCandidates: execution.maxRawCandidates,
      maxCandidates: config.budget.maxCandidates,
      maxDecorationStates: execution.maxDecorationStates,
      canonicalizationLimits
    }
  };
  return deepFreeze({
    ...basis,
    bindingHash: hashCanonical(HASH_DOMAINS.PACKAGE_CANDIDATE_BINDING, basis)
  });
}

export function enumeratePackageCandidates(loadedPackage, runConfig, options = {}) {
  const binding = createPackageCandidateBinding(loadedPackage, runConfig, options);
  const enumeration = enumerateDecoratedCandidates(
    binding.enumerationInput,
    binding.enumerationOptions
  );
  return deepFreeze({
    schemaVersion: "1",
    generator: PACKAGE_CANDIDATE_GENERATOR_VERSION,
    binding,
    enumeration
  });
}
