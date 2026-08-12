import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  assertLocalPredicatePlanSupported,
  assertLocalPredicatePerturbationContext,
  assertLocalPredicateSubstructurePolicy,
  evaluateLocalPredicatePlan,
  localPredicateAttributeRequirements,
  localPredicateUnsupportedFeatures
} from "./local-predicate-evaluator.js";
import { bindPredicateNumericPolicy } from "./numeric-binding.js";
import { createPackageCandidateBinding } from "./package-candidate-generator.js";

export const PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION =
  "package-candidate-filter-evaluator-v20";
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

function usesSelectedSourcePopulation(binding) {
  return new Set([
    "package-depth-candidate-binding-v2",
    "package-current-level-candidate-binding-v2"
  ]).has(binding.binder);
}

function sourceElements(binding) {
  return usesSelectedSourcePopulation(binding)
    ? binding.sourcePopulation.elements
    : binding.sourcePopulation.population.elements;
}

function sourcePopulationHash(binding) {
  return usesSelectedSourcePopulation(binding)
    ? binding.sourcePopulation.selectionHash
    : binding.sourcePopulation.population.populationHash;
}

function targetDepth(binding) {
  return usesSelectedSourcePopulation(binding)
    ? binding.targetDepth
    : binding.sourcePopulation.selection.targetDepth;
}

function profileRepresentativePolicy(binding) {
  return usesSelectedSourcePopulation(binding)
    ? binding.sourcePopulation.policy.profileRepresentative
    : binding.sourcePopulation.profileRepresentativePolicy;
}

function createFilterSessionIndexes(binding) {
  const elements = new Map(
    sourceElements(binding).map((element) => [element.id, element])
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
  return Object.freeze({
    allowedNodes: new Set(
      binding.enumerationInput.nodeVariants.map((entry) => canonicalize(entry))
    ),
    allowedEdges: new Set(
      binding.enumerationInput.edgeVariants.map((entry) => canonicalize(entry))
    ),
    allowedSkeletons: new Set(
      binding.enumerationInput.skeletons.map((entry) => entry.id)
    ),
    elements,
    profileClasses,
    classByElement
  });
}

function validateUniverseMembership(candidate, binding, indexes) {
  const issues = [];

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
  if (!indexes.allowedSkeletons.has(candidate.skeleton)) {
    issues.push(validationIssue(
      "PACKAGE_CANDIDATE_FILTER_SKELETON_UNBOUND",
      "$candidate.skeleton",
      "Candidate skeleton is not part of the bound skeleton universe.",
      { skeletonId: candidate.skeleton }
    ));
  }
  candidate.nodes.forEach((node, index) => {
    if (!indexes.allowedNodes.has(canonicalize(node))) {
      issues.push(validationIssue(
        "PACKAGE_CANDIDATE_FILTER_NODE_VARIANT_UNBOUND",
        `$candidate.nodes[${index}]`,
        "Candidate node variant is not part of the bound source population.",
        { ref: node.ref }
      ));
    }
  });
  candidate.edges.forEach((edge, index) => {
    if (!indexes.allowedEdges.has(canonicalize(edgeVariant(edge)))) {
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

function resolveConstituents(candidate, binding, indexes) {
  return candidate.nodes.map((node, canonicalNode) => {
    const profileClass = candidate.domain === "profile-quotient"
      ? indexes.profileClasses.get(node.ref)
      : indexes.classByElement.get(node.ref);
    const elementId = candidate.domain === "profile-quotient"
      ? profileClass.representativeElementId
      : node.ref;
    const element = indexes.elements.get(elementId);
    return {
      canonicalNode,
      sourceRef: node.ref,
      elementId,
      profileHash: element.profile.hash,
      resolution: candidate.domain === "profile-quotient"
        ? "profile-representative"
        : "element-exact",
      representativePolicy: candidate.domain === "profile-quotient"
        ? profileRepresentativePolicy(binding)
        : "direct-element-reference-v1",
      profileClassMembers: [...profileClass.members]
    };
  });
}

function perturbationContextForPlan(plan, perturbations, binding) {
  if (plan.requirements.perturbations.length === 0) return undefined;
  const byId = new Map(perturbations.map((entry) => [
    typeof entry === "string" ? entry : entry.id,
    entry
  ]));
  const definitions = plan.requirements.perturbations.map((id) => byId.get(id));
  const unavailable = plan.requirements.perturbations.filter((_, index) =>
    typeof definitions[index] === "string" || definitions[index] === undefined
  );
  if (unavailable.length > 0) {
    fail(
      "PACKAGE_CANDIDATE_FILTER_PERTURBATION_DEFINITION_UNAVAILABLE",
      "stableUnder requires executable typed perturbation definitions, not registry-only identifiers.",
      { predicateId: plan.predicateId, unavailable }
    );
  }
  const sampled = definitions.some((definition) =>
    definition.enumeration === "sampled-valid-single-edits-v1"
  );
  return {
    definitions,
    ...(sampled
      ? {
          sampling: {
            algorithm: "sha256-rejection-counter-v1",
            frame: "applicable-single-edit-attempts-v1",
            replacement: "with-replacement",
            uncertainty: "chebyshev-union-95-v1",
            sampleSize: binding.runConfig.budget.perturbationSamples,
            streamKey: binding.runConfigHash
          }
        }
      : {})
  };
}

function assertLocalPredicateSupport(plans, binding, perturbations) {
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
  plans.forEach((plan) => {
    assertLocalPredicatePlanSupported(plan);
    if (
      plan.requirements.operators.includes("minimal") ||
      plan.requirements.operators.includes("irreducibleRemoval")
    ) {
      assertLocalPredicateSubstructurePolicy(
        plan,
        binding.runConfig.substructurePolicy
      );
    }
    if (plan.requirements.perturbations.length > 0) {
      const perturbationContext = perturbationContextForPlan(
        plan,
        perturbations,
        binding
      );
      assertLocalPredicatePerturbationContext(
        plan,
        perturbationContext
      );
      const unavailablePerturbationAttributes =
        perturbationContext.definitions.flatMap((definition) => {
          if (definition.kind !== "numeric-attribute-displacement") return [];
          const available = definition.target === "nodes"
            ? availableNodeAttributes
            : availableEdgeAttributes;
          return available.has(definition.attribute)
            ? []
            : [{
                perturbationId: definition.id,
                target: definition.target,
                attribute: definition.attribute
              }];
        });
      if (unavailablePerturbationAttributes.length > 0) {
        fail(
          "PACKAGE_CANDIDATE_FILTER_PERTURBATION_ATTRIBUTES_UNAVAILABLE",
          "Numeric perturbation attributes must be structural in the bound candidate universe.",
          {
            predicateId: plan.predicateId,
            unavailablePerturbationAttributes
          }
        );
      }
    }
  });
}

function invariantContextForPlan(plan, candidate, binding, indexes) {
  if (plan.requirements.invariants.length === 0) return undefined;
  const selectedProfileClasses = candidate.domain === "profile-quotient"
    ? [...new Set(candidate.nodes.map((node) => node.ref))]
      .sort()
      .map((profileHash) => indexes.profileClasses.get(profileHash))
    : [];
  const elementIds = candidate.domain === "profile-quotient"
    ? [...new Set(selectedProfileClasses.flatMap((entry) => entry.members))].sort()
    : [...new Set(candidate.nodes.map((node) => node.ref))].sort();
  return {
    sourcePopulationHash: sourcePopulationHash(binding),
    elements: elementIds.map((elementId) => {
      const source = indexes.elements.get(elementId);
      const invariants = {};
      for (const name of plan.requirements.invariants) {
        if (Object.prototype.hasOwnProperty.call(source.invariants, name)) {
          invariants[name] = source.invariants[name];
        }
      }
      return { elementId, invariants };
    }),
    ...(candidate.domain === "profile-quotient"
      ? {
          profileClasses: selectedProfileClasses.map((entry) => ({
            profileHash: entry.profileHash,
            members: [...entry.members]
          }))
        }
      : {})
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
 * Prepares one verified package/binding pair for repeated candidate filtering.
 * This is an internal batching boundary; every evaluated candidate still
 * undergoes canonicalization and complete universe-membership validation.
 */
export function createPackageCandidateFilterSession(
  loadedPackageInput,
  bindingInput,
  options = {}
) {
  const normalizedOptions = normalizeFilterOptions(options);
  const loadedPackage = verifyLoadedPackage(loadedPackageInput, normalizedOptions);
  const binding = verifyBinding(
    loadedPackage,
    bindingInput,
    normalizedOptions.kernelVersion
  );
  return createPreparedPackageCandidateFilterSession(loadedPackage, binding);
}

/**
 * Internal shared evaluator for an already reproduced primitive or depth-aware
 * binding. Public callers must use a wrapper that verifies that binding first.
 */
export function createPreparedPackageCandidateFilterSession(
  loadedPackage,
  binding,
  {
    evaluator = PACKAGE_CANDIDATE_FILTER_EVALUATOR_VERSION,
    hashDomain = HASH_DOMAINS.PACKAGE_CANDIDATE_FILTER
  } = {}
) {
  assertLocalPredicateSupport(
    loadedPackage.predicatePlans,
    binding,
    loadedPackage.normalized.perturbations
  );
  const indexes = createFilterSessionIndexes(binding);
  const predicates = new Map(
    loadedPackage.normalized.predicates.map((entry) => [entry.id, entry])
  );
  const preparedPlans = loadedPackage.predicatePlans.map((plan) => ({
    plan,
    predicate: predicates.get(plan.predicateId),
    numericBinding: bindPredicateNumericPolicy(
      plan,
      binding.runConfig.invariantPrecision
    ),
    perturbationContext: perturbationContextForPlan(
      plan,
      loadedPackage.normalized.perturbations,
      binding
    )
  }));
  return Object.freeze({
    binding,
    evaluate(candidateInput) {
      const canonicalization = canonicalizeCandidate(candidateInput, {
        policy: binding.runConfig.graphPolicy,
        limits: binding.enumerationOptions.canonicalizationLimits
      });
      const candidate = canonicalization.candidate;
      validateUniverseMembership(candidate, binding, indexes);
      const evaluations = preparedPlans.map(({
        plan,
        predicate,
        numericBinding,
        perturbationContext
      }) => {
        return {
          predicateId: plan.predicateId,
          phase: plan.phase,
          claimRefs: [...predicate.claimRefs],
          evaluation: evaluateLocalPredicatePlan(plan, numericBinding, candidate, {
            policy: binding.runConfig.graphPolicy,
            limits: binding.enumerationOptions.canonicalizationLimits,
            ...(plan.requirements.operators.includes("minimal") ||
              plan.requirements.operators.includes("irreducibleRemoval")
              ? { substructurePolicy: binding.runConfig.substructurePolicy }
              : {}),
            ...(plan.requirements.invariants.length === 0
              ? {}
              : {
                  invariantContext: invariantContextForPlan(
                    plan,
                    candidate,
                    binding,
                    indexes
                  )
                }),
            ...(perturbationContext === undefined
              ? {}
              : { perturbationContext })
          })
        };
      });
      const classification = classify(evaluations);
      const basis = {
        schemaVersion: "1",
        evaluator,
        packageId: loadedPackage.packageId,
        rulesHash: loadedPackage.semanticManifest.rulesHash,
        bindingHash: binding.bindingHash,
        formation: {
          targetDepth: targetDepth(binding),
          depthBasis: binding.depthBasis,
          sourcePopulationHash: sourcePopulationHash(binding),
          candidate,
          constituents: resolveConstituents(candidate, binding, indexes)
        },
        predicateEvaluations: evaluations,
        ...classification
      };
      return deepFreeze({
        ...basis,
        filterHash: hashCanonical(hashDomain, basis)
      });
    }
  });
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
  return createPackageCandidateFilterSession(
    loadedPackageInput,
    bindingInput,
    options
  ).evaluate(candidateInput);
}
