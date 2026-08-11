import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  assertLocalPredicatePlanSupported,
  evaluateLocalPredicatePlan,
  localPredicateAttributeRequirements,
  localPredicateUnsupportedFeatures
} from "./local-predicate-evaluator.js";
import { bindPredicateNumericPolicy } from "./numeric-binding.js";
import { createPackageCandidateBinding } from "./package-candidate-generator.js";

export const PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION =
  "package-candidate-filter-evaluator-v9";
const FILTER_OPTION_FIELDS = new Set(["kernelVersion"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "FILTER_PACKAGE_CANDIDATE",
    message,
    details
  });
}

function failValidation(issues) {
  throw new KernelValidationError(
    issues,
    "Package candidate does not belong to the bound generation universe.",
    {
      code: "PACKAGE_CANDIDATE_FILTER_VALIDATION_FAILED",
      stage: "FILTER_PACKAGE_CANDIDATE"
    }
  );
}

function normalizeFilterOptions(options) {
  if (!isObject(options)) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_OPTIONS_INVALID",
      "Package candidate filter options must be an object."
    );
  }
  const value = canonicalClone(options);
  const unknown = Object.keys(value).filter((field) => !FILTER_OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_OPTION_UNKNOWN",
      "Unknown package candidate filter option.",
      { unknown }
    );
  }
  if (
    value.kernelVersion !== undefined &&
    (typeof value.kernelVersion !== "string" || value.kernelVersion.trim().length === 0)
  ) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_KERNEL_VERSION_INVALID",
      "Expected kernel version must be a non-empty string.",
      { value: value.kernelVersion }
    );
  }
  return {
    ...(value.kernelVersion === undefined ? {} : { kernelVersion: value.kernelVersion.trim() })
  };
}

function bindingReplayOptions(binding) {
  if (
    !isObject(binding.runConfig) ||
    !isObject(binding.enumerationOptions) ||
    !isObject(binding.enumerationOptions.canonicalizationLimits)
  ) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_BINDING_INVALID",
      "Package candidate binding does not expose reproducible run and execution options."
    );
  }
  return {
    maxRawCandidates: binding.enumerationOptions.maxRawCandidates,
    maxDecorationStates: binding.enumerationOptions.maxDecorationStates,
    maxSearchStates: binding.enumerationOptions.canonicalizationLimits.maxSearchStates
  };
}

function verifyBinding(loadedPackage, input, kernelVersion) {
  let binding;
  try {
    binding = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_CANDIDATE_FILTER_BINDING_INVALID",
      "Package candidate binding is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(binding)) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_BINDING_INVALID",
      "Package candidate binding must be an object."
    );
  }

  let reproduced;
  try {
    reproduced = createPackageCandidateBinding(
      loadedPackage,
      binding.runConfig,
      {
        ...bindingReplayOptions(binding),
        ...(kernelVersion === undefined ? {} : { kernelVersion })
      }
    );
  } catch (error) {
    if (error instanceof KernelError) {
      fail(
        "PACKAGE_CANDIDATE_FILTER_BINDING_INVALID",
        "Package candidate binding cannot be reproduced.",
        { causeCode: error.code }
      );
    }
    throw error;
  }
  if (canonicalize(binding) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_BINDING_MISMATCH",
      "Package candidate binding does not match its deterministic reproduction.",
      {
        expectedBindingHash: reproduced.bindingHash,
        actualBindingHash: binding.bindingHash
      }
    );
  }
  return reproduced;
}

function maximumCandidateEdges(candidate, binding) {
  return binding.enumerationOptions.maxEdges === "n+2"
    ? candidate.nodes.length + 2
    : binding.enumerationOptions.maxEdges;
}

function edgeVariant(edge) {
  return {
    role: edge.role,
    ...(edge.attrs === undefined ? {} : { attrs: edge.attrs })
  };
}

function validateUniverseMembership(candidate, binding) {
  const issues = [];
  const allowedNodes = new Set(
    binding.enumerationInput.nodeVariants.map((entry) => canonicalize(entry))
  );
  const allowedEdges = new Set(
    binding.enumerationInput.edgeVariants.map((entry) => canonicalize(entry))
  );
  const allowedSkeletons = new Set(
    binding.enumerationInput.skeletons.map((entry) => entry.id)
  );

  if (candidate.domain !== binding.runConfig.countingDomain) {
    issues.push(validationIssue(
      "PACKAGE_CANDIDATE_FILTER_DOMAIN_MISMATCH",
      "$candidate.domain",
      "Candidate counting domain differs from the bound run.",
      { expected: binding.runConfig.countingDomain, actual: candidate.domain }
    ));
  }
  if (candidate.nodes.length > binding.runConfig.budget.maxNodes) {
    issues.push(validationIssue(
      "PACKAGE_CANDIDATE_FILTER_NODE_BUDGET_EXCEEDED",
      "$candidate.nodes",
      "Candidate exceeds the bound semantic node budget.",
      { maximum: binding.runConfig.budget.maxNodes, actual: candidate.nodes.length }
    ));
  }
  const maxEdges = maximumCandidateEdges(candidate, binding);
  if (candidate.edges.length > maxEdges) {
    issues.push(validationIssue(
      "PACKAGE_CANDIDATE_FILTER_EDGE_BUDGET_EXCEEDED",
      "$candidate.edges",
      "Candidate exceeds the bound semantic edge budget.",
      { maximum: maxEdges, actual: candidate.edges.length }
    ));
  }
  if (!allowedSkeletons.has(candidate.skeleton)) {
    issues.push(validationIssue(
      "PACKAGE_CANDIDATE_FILTER_SKELETON_UNBOUND",
      "$candidate.skeleton",
      "Candidate skeleton is not part of the bound skeleton universe.",
      { skeletonId: candidate.skeleton }
    ));
  }
  candidate.nodes.forEach((node, index) => {
    if (!allowedNodes.has(canonicalize(node))) {
      issues.push(validationIssue(
        "PACKAGE_CANDIDATE_FILTER_NODE_VARIANT_UNBOUND",
        `$candidate.nodes[${index}]`,
        "Candidate node variant is not part of the bound source population.",
        { ref: node.ref }
      ));
    }
  });
  candidate.edges.forEach((edge, index) => {
    if (!allowedEdges.has(canonicalize(edgeVariant(edge)))) {
      issues.push(validationIssue(
        "PACKAGE_CANDIDATE_FILTER_EDGE_VARIANT_UNBOUND",
        `$candidate.edges[${index}]`,
        "Candidate edge variant is not part of the bound role/attribute alphabet.",
        { role: edge.role }
      ));
    }
  });
  if (!binding.runConfig.graphPolicy.allowParallelEdges) {
    const edgeGroups = new Map();
    candidate.edges.forEach((edge, index) => {
      const from = Math.min(edge.from, edge.to);
      const to = Math.max(edge.from, edge.to);
      const key = `${from}:${to}`;
      if (!edgeGroups.has(key)) edgeGroups.set(key, []);
      edgeGroups.get(key).push(index);
    });
    for (const [group, edgeIndexes] of edgeGroups) {
      if (edgeIndexes.length <= 1) continue;
      issues.push(validationIssue(
        "PACKAGE_CANDIDATE_FILTER_EDGE_GROUP_MULTIPLICITY_UNBOUND",
        "$candidate.edges",
        "Candidate uses more than one directed decoration for a non-parallel adjacency group.",
        { group, edgeIndexes }
      ));
    }
  }
  if (issues.length > 0) failValidation(issues);
}

function resolveConstituents(candidate, binding) {
  const elements = new Map(
    binding.sourcePopulation.population.elements.map((element) => [element.id, element])
  );
  const profileClasses = new Map(
    binding.sourcePopulation.profileClasses.map((entry) => [entry.profileHash, entry])
  );
  const classByElement = new Map();
  for (const profileClass of binding.sourcePopulation.profileClasses) {
    for (const elementId of profileClass.members) {
      classByElement.set(elementId, profileClass);
    }
  }

  return candidate.nodes.map((node, canonicalNode) => {
    const profileClass = candidate.domain === "profile-quotient"
      ? profileClasses.get(node.ref)
      : classByElement.get(node.ref);
    const elementId = candidate.domain === "profile-quotient"
      ? profileClass.representativeElementId
      : node.ref;
    const element = elements.get(elementId);
    return {
      canonicalNode,
      sourceRef: node.ref,
      elementId,
      profileHash: element.profile.hash,
      resolution: candidate.domain === "profile-quotient"
        ? "profile-representative"
        : "element-exact",
      representativePolicy: candidate.domain === "profile-quotient"
        ? binding.sourcePopulation.profileRepresentativePolicy
        : "direct-element-reference-v1",
      profileClassMembers: [...profileClass.members]
    };
  });
}

function assertLocalPredicateSupport(plans, binding) {
  const unsupported = plans.flatMap((plan) => {
    const features = localPredicateUnsupportedFeatures(plan);
    return features.length === 0 ? [] : [{ predicateId: plan.predicateId, features }];
  });
  if (unsupported.length > 0) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_PREDICATE_UNSUPPORTED",
      "Local package filtering reached a predicate feature without a frozen execution contract.",
      { unsupported }
    );
  }
  if (binding.runConfig.countingDomain !== "element-exact") {
    const invariantPredicates = plans
      .filter((plan) => plan.requirements.invariants.length > 0)
      .map((plan) => plan.predicateId);
    if (invariantPredicates.length > 0) {
      fail(
        "PACKAGE_CANDIDATE_FILTER_INVARIANT_DOMAIN_UNSUPPORTED",
        "Package invariant evaluation requires the element-exact counting domain.",
        {
          domain: binding.runConfig.countingDomain,
          predicateIds: invariantPredicates,
          reason: "profile-invariant-consensus-not-frozen"
        }
      );
    }
  }
  const availableNodeAttributes = new Set(
    binding.runConfig.graphPolicy.structuralNodeAttributes
  );
  const availableEdgeAttributes = new Set(
    binding.runConfig.graphPolicy.structuralEdgeAttributes
  );
  const unavailableAttributes = plans.flatMap((plan) => {
    const required = localPredicateAttributeRequirements(plan);
    const nodeAttributes = required.nodeAttributes
      .filter((attribute) => !availableNodeAttributes.has(attribute));
    const edgeAttributes = required.edgeAttributes
      .filter((attribute) => !availableEdgeAttributes.has(attribute));
    const attributes = [...new Set([...nodeAttributes, ...edgeAttributes])].sort();
    return attributes.length === 0
      ? []
      : [{ predicateId: plan.predicateId, attributes, nodeAttributes, edgeAttributes }];
  });
  if (unavailableAttributes.length > 0) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_ATTRIBUTES_UNAVAILABLE",
      "Local package filtering cannot evaluate predicates whose required attributes are absent from the bound decoration universe.",
      { unavailableAttributes }
    );
  }
  plans.forEach((plan) => assertLocalPredicatePlanSupported(plan));
}

function invariantContextForPlan(plan, candidate, binding) {
  if (plan.requirements.invariants.length === 0) return undefined;
  const elements = new Map(
    binding.sourcePopulation.population.elements.map((element) => [element.id, element])
  );
  const elementIds = [...new Set(candidate.nodes.map((node) => node.ref))].sort();
  return {
    sourcePopulationHash: binding.sourcePopulation.population.populationHash,
    elements: elementIds.map((elementId) => {
      const source = elements.get(elementId);
      const invariants = {};
      for (const name of plan.requirements.invariants) {
        if (Object.prototype.hasOwnProperty.call(source.invariants, name)) {
          invariants[name] = source.invariants[name];
        }
      }
      return { elementId, invariants };
    })
  };
}

function classify(evaluations) {
  const ids = (outcome) => evaluations
    .filter((entry) => entry.evaluation.outcome === outcome)
    .map((entry) => entry.predicateId);
  const passedPredicates = ids("pass");
  const failedPredicates = ids("fail");
  const indeterminatePredicates = ids("indeterminate");
  return {
    verdict: failedPredicates.length > 0
      ? "predicate-rejected"
      : indeterminatePredicates.length > 0
        ? "filter-indeterminate"
        : "eligible",
    counts: {
      evaluated: evaluations.length,
      passed: passedPredicates.length,
      failed: failedPredicates.length,
      indeterminate: indeterminatePredicates.length
    },
    passedPredicates,
    failedPredicates,
    indeterminatePredicates
  };
}

/**
 * Evaluates the complete locally executable top-level predicate set for one
 * canonical candidate after reproducing its package/run universe, numeric
 * policy, and source resolution. This establishes local eligibility only;
 * selector admission remains later.
 */
export function evaluatePackageCandidateFilter(
  loadedPackageInput,
  bindingInput,
  candidateInput,
  options = {}
) {
  const normalizedOptions = normalizeFilterOptions(options);
  const loadedPackage = verifyLoadedPackage(loadedPackageInput, normalizedOptions);
  const binding = verifyBinding(
    loadedPackage,
    bindingInput,
    normalizedOptions.kernelVersion
  );
  const canonicalization = canonicalizeCandidate(candidateInput, {
    policy: binding.runConfig.graphPolicy,
    limits: binding.enumerationOptions.canonicalizationLimits
  });
  const candidate = canonicalization.candidate;
  validateUniverseMembership(candidate, binding);
  assertLocalPredicateSupport(loadedPackage.predicatePlans, binding);

  const predicates = new Map(
    loadedPackage.normalized.predicates.map((entry) => [entry.id, entry])
  );
  const evaluations = loadedPackage.predicatePlans.map((plan) => {
    const predicate = predicates.get(plan.predicateId);
    const numericBinding = bindPredicateNumericPolicy(
      plan,
      binding.runConfig.invariantPrecision
    );
    return {
      predicateId: plan.predicateId,
      phase: plan.phase,
      claimRefs: [...predicate.claimRefs],
      evaluation: evaluateLocalPredicatePlan(plan, numericBinding, candidate, {
        policy: binding.runConfig.graphPolicy,
        limits: binding.enumerationOptions.canonicalizationLimits,
        ...(plan.requirements.invariants.length === 0
          ? {}
          : { invariantContext: invariantContextForPlan(plan, candidate, binding) })
      })
    };
  });
  const classification = classify(evaluations);
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: binding.bindingHash,
    formation: {
      targetDepth: binding.sourcePopulation.selection.targetDepth,
      depthBasis: binding.depthBasis,
      sourcePopulationHash: binding.sourcePopulation.population.populationHash,
      candidate,
      constituents: resolveConstituents(candidate, binding)
    },
    predicateEvaluations: evaluations,
    ...classification
  };
  return deepFreeze({
    ...basis,
    filterHash: hashCanonical(HASH_DOMAINS.PACKAGE_CANDIDATE_FILTER, basis)
  });
}
