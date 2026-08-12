import { canonicalize, deepFreeze } from "./canonical.js";
import {
  enumerateDecoratedCandidates,
  enumerateDecoratedCandidatesWithCompositionGate
} from "./candidate-enumerator.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { evaluateProfileSlotGuard } from "./profile-guard.js";

export const PACKAGE_PROFILE_COMPOSITION_VERSION =
  "package-profile-composition-gate-v1";
export const PACKAGE_PROFILE_COMPOSITION_POLICY = deepFreeze({
  edgeOrder: "canonical-edge-index-v1",
  endpointOrder: "source-then-target-v1",
  slotPreference: "exact-polarity-before-symmetric-then-slot-index-v1",
  capacityConsumption: "one-unit-per-directed-edge-endpoint-v1",
  partnerDomain: "complete-profile-class-v1",
  incompatibleDisposition: "exclude-before-candidate-store-v1",
  indeterminateDisposition: "fail-closed-whole-generation-v1"
});

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "GATE_PACKAGE_PROFILE_COMPOSITION",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourceElements(binding) {
  const elements = binding.sourcePopulation.elements ??
    binding.sourcePopulation.population?.elements;
  if (!Array.isArray(elements) || elements.length === 0) {
    fail(
      "PACKAGE_PROFILE_COMPOSITION_SOURCE_INVALID",
      "Profile composition requires a non-empty bound source population."
    );
  }
  return elements;
}

function sourcePopulationHash(binding) {
  return binding.sourcePopulation.selectionHash ??
    binding.sourcePopulation.populationHash ??
    binding.sourcePopulation.population?.populationHash;
}

function indexes(binding) {
  const elements = sourceElements(binding);
  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const classesByProfile = new Map(
    binding.sourcePopulation.profileClasses.map((entry) => [
      entry.profileHash,
      entry
    ])
  );
  const classesByElement = new Map();
  for (const profileClass of binding.sourcePopulation.profileClasses) {
    for (const elementId of profileClass.members) {
      if (classesByElement.has(elementId)) {
        fail(
          "PACKAGE_PROFILE_COMPOSITION_CLASS_OVERLAP",
          "A source element appears in more than one bound profile class.",
          { elementId }
        );
      }
      classesByElement.set(elementId, profileClass);
    }
  }
  return { elementsById, classesByProfile, classesByElement };
}

function nodeStates(binding, candidate, resolved) {
  return candidate.nodes.map((node, canonicalNode) => {
    const profileClass = candidate.domain === "profile-quotient"
      ? resolved.classesByProfile.get(node.ref)
      : resolved.classesByElement.get(node.ref);
    if (profileClass === undefined) {
      fail(
        "PACKAGE_PROFILE_COMPOSITION_NODE_UNBOUND",
        "A candidate node is absent from the binding's profile-class index.",
        { canonicalNode, ref: node.ref }
      );
    }
    const representativeId = profileClass.representativeElementId;
    const representative = resolved.elementsById.get(representativeId);
    if (
      representative === undefined ||
      representative.profile.hash !== profileClass.profileHash
    ) {
      fail(
        "PACKAGE_PROFILE_COMPOSITION_REPRESENTATIVE_INVALID",
        "A bound profile class has no matching representative element.",
        { canonicalNode, profileHash: profileClass.profileHash, representativeId }
      );
    }
    return {
      canonicalNode,
      sourceRef: node.ref,
      profileHash: profileClass.profileHash,
      memberElementIds: [...profileClass.members],
      slots: representative.profile.slots.map((slot, slotIndex) => ({
        slot,
        slotIndex,
        used: 0
      }))
    };
  });
}

function polarityMatches(actual, required) {
  return actual === required || actual === "sym";
}

function capacityAvailable(state) {
  return state.slot.capacity.max === null ||
    state.used < state.slot.capacity.max;
}

function slotPreference(left, right, requiredPolarity) {
  const leftExact = left.slot.polarity === requiredPolarity ? 0 : 1;
  const rightExact = right.slot.polarity === requiredPolarity ? 0 : 1;
  return leftExact - rightExact || left.slotIndex - right.slotIndex;
}

function partnerElements(partner, resolved) {
  return partner.memberElementIds.map((elementId) => {
    const element = resolved.elementsById.get(elementId);
    if (element === undefined) {
      fail(
        "PACKAGE_PROFILE_COMPOSITION_MEMBER_MISSING",
        "A profile-class member is absent from the bound source population.",
        { elementId, partnerCanonicalNode: partner.canonicalNode }
      );
    }
    return element;
  });
}

function allocateEndpoint(
  binding,
  candidate,
  nodes,
  resolved,
  canonicalNode,
  partnerCanonicalNode,
  role,
  requiredPolarity,
  canonicalEdge,
  endpoint,
  guardEvaluations
) {
  const node = nodes[canonicalNode];
  const partner = nodes[partnerCanonicalNode];
  if (node === undefined || partner === undefined) {
    fail(
      "PACKAGE_PROFILE_COMPOSITION_ENDPOINT_INVALID",
      "A canonical edge endpoint has no bound node state.",
      { canonicalEdge, canonicalNode, partnerCanonicalNode }
    );
  }
  const matching = node.slots.filter((state) =>
    state.slot.role === role &&
    polarityMatches(state.slot.polarity, requiredPolarity) &&
    capacityAvailable(state)
  ).sort((left, right) => slotPreference(left, right, requiredPolarity));
  if (matching.length === 0) {
    return {
      outcome: "exclude",
      reason: "profile-slot-capacity-unavailable",
      details: {
        canonicalEdge,
        endpoint,
        canonicalNode,
        partnerCanonicalNode,
        role,
        requiredPolarity,
        profileHash: node.profileHash
      }
    };
  }
  let sawFailedGuard = false;
  for (const state of matching) {
    let guardEvaluation = null;
    if (state.slot.guard !== undefined) {
      guardEvaluation = evaluateProfileSlotGuard(
        state.slot.guard,
        partnerElements(partner, resolved),
        {
          bindingHash: binding.bindingHash,
          candidateId: candidate.id,
          canonicalEdge,
          endpoint,
          canonicalNode,
          partnerCanonicalNode,
          role,
          requiredPolarity,
          profileHash: node.profileHash,
          partnerProfileHash: partner.profileHash,
          slotIndex: state.slotIndex,
          phase: "candidate-generation"
        }
      );
      guardEvaluations.push(guardEvaluation);
      if (guardEvaluation.outcome === "indeterminate") {
        return {
          outcome: "indeterminate",
          reason: guardEvaluation.reason === "profile-slot-guard-unsupported"
            ? guardEvaluation.reason
            : "profile-slot-guard-indeterminate",
          details: {
            canonicalEdge,
            endpoint,
            canonicalNode,
            partnerCanonicalNode,
            role,
            requiredPolarity,
            profileHash: node.profileHash,
            guardEvaluationHash: guardEvaluation.evaluationHash
          }
        };
      }
      if (guardEvaluation.outcome === "fail") {
        sawFailedGuard = true;
        continue;
      }
    }
    state.used += 1;
    return {
      outcome: "pass",
      witness: {
        canonicalNode,
        sourceRef: node.sourceRef,
        profileHash: node.profileHash,
        slotIndex: state.slotIndex,
        polarity: state.slot.polarity,
        guardEvaluationHash: guardEvaluation?.evaluationHash ?? null
      }
    };
  }
  return {
    outcome: "exclude",
    reason: sawFailedGuard
      ? "profile-slot-guard-unsatisfied"
      : "profile-slot-capacity-unavailable",
    details: {
      canonicalEdge,
      endpoint,
      canonicalNode,
      partnerCanonicalNode,
      role,
      requiredPolarity,
      profileHash: node.profileHash
    }
  };
}

function decisionHash(basis) {
  return {
    ...basis,
    decisionHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_PROFILE_COMPOSITION_DECISION,
      basis
    )
  };
}

/** Evaluates exact slot capacity and typed guards on one canonical candidate. */
export function evaluateVerifiedPackageProfileComposition(
  binding,
  candidate,
  resolvedIndexes = indexes(binding)
) {
  if (candidate.id === undefined || candidate.canonicalForm === undefined) {
    fail(
      "PACKAGE_PROFILE_COMPOSITION_CANDIDATE_INVALID",
      "Profile composition requires a canonical candidate record."
    );
  }
  const nodes = nodeStates(binding, candidate, resolvedIndexes);
  const consumptions = [];
  const guardEvaluations = [];
  let terminal = null;
  for (
    let canonicalEdge = 0;
    canonicalEdge < candidate.edges.length && terminal === null;
    canonicalEdge += 1
  ) {
    const edge = candidate.edges[canonicalEdge];
    const source = allocateEndpoint(
      binding,
      candidate,
      nodes,
      resolvedIndexes,
      edge.from,
      edge.to,
      edge.role,
      "out",
      canonicalEdge,
      "source",
      guardEvaluations
    );
    if (source.outcome !== "pass") {
      terminal = source;
      break;
    }
    const target = allocateEndpoint(
      binding,
      candidate,
      nodes,
      resolvedIndexes,
      edge.to,
      edge.from,
      edge.role,
      "in",
      canonicalEdge,
      "target",
      guardEvaluations
    );
    if (target.outcome !== "pass") {
      terminal = target;
      break;
    }
    consumptions.push({
      canonicalEdge,
      role: edge.role,
      source: source.witness,
      target: target.witness
    });
  }
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_PROFILE_COMPOSITION_VERSION,
    bindingHash: binding.bindingHash,
    runConfigHash: binding.runConfigHash,
    sourcePopulationHash: sourcePopulationHash(binding),
    candidateId: candidate.id,
    candidateCanonicalHash: candidate.canonicalForm.hash,
    policy: PACKAGE_PROFILE_COMPOSITION_POLICY,
    outcome: terminal?.outcome ?? "pass",
    reason: terminal?.reason ?? null,
    details: terminal?.details ?? null,
    consumptions,
    guardEvaluations
  };
  return deepFreeze(decisionHash(basis));
}

function summarize(status, policy, decisions, enumeration) {
  const ordered = [...decisions].sort((left, right) =>
    compareStrings(left.candidateId, right.candidateId)
  );
  const counts = {
    evaluatedCanonicalCandidates: ordered.length,
    compatibleCandidates: ordered.filter((entry) => entry.outcome === "pass").length,
    incompatibleCandidates: ordered.filter((entry) => entry.outcome === "exclude").length,
    indeterminateCandidates: ordered.filter(
      (entry) => entry.outcome === "indeterminate"
    ).length,
    excludedRawCandidates:
      enumeration?.counts.compositionExcludedCandidates ?? 0
  };
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_PROFILE_COMPOSITION_VERSION,
    policy,
    status,
    reasons: policy === "post-admission-v1"
      ? ["profile-composition-gate-disabled"]
      : status === "complete"
        ? []
        : ["candidate-generation-truncated"],
    decisions: ordered,
    counts
  };
  return deepFreeze({
    ...basis,
    compositionHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_PROFILE_COMPOSITION,
      basis
    )
  });
}

export function createDisabledPackageProfileComposition() {
  return summarize("not-run", "post-admission-v1", [], null);
}

export function createPackageProfileCompositionSession(binding) {
  const resolved = indexes(binding);
  const decisions = new Map();
  return Object.freeze({
    evaluate(canonicalizationResult) {
      const decision = evaluateVerifiedPackageProfileComposition(
        binding,
        canonicalizationResult.candidate,
        resolved
      );
      const prior = decisions.get(decision.candidateId);
      if (prior !== undefined && canonicalize(prior) !== canonicalize(decision)) {
        fail(
          "PACKAGE_PROFILE_COMPOSITION_DECISION_MISMATCH",
          "Repeated canonical candidate evaluation changed its composition decision.",
          { candidateId: decision.candidateId }
        );
      }
      decisions.set(decision.candidateId, decision);
      if (decision.outcome === "indeterminate") {
        fail(
          "PACKAGE_PROFILE_COMPOSITION_INDETERMINATE",
          "Guard-aware candidate generation cannot reduce an indeterminate composition universe.",
          {
            candidateId: decision.candidateId,
            decisionHash: decision.decisionHash,
            reason: decision.reason
          }
        );
      }
      return { outcome: decision.outcome };
    },
    finalize(enumeration) {
      return summarize(
        enumeration.status === "complete" ? "complete" : "truncated",
        "profile-slot-gate-v1",
        decisions.values(),
        enumeration
      );
    }
  });
}

/** Executes a bound candidate enumeration under its frozen composition policy. */
export function enumerateBoundCandidatesWithProfileComposition(binding) {
  if (binding.runConfig.profileCompositionPolicy === "post-admission-v1") {
    return {
      enumeration: enumerateDecoratedCandidates(
        binding.enumerationInput,
        binding.enumerationOptions
      ),
      profileComposition: createDisabledPackageProfileComposition()
    };
  }
  if (binding.runConfig.profileCompositionPolicy !== "profile-slot-gate-v1") {
    fail(
      "PACKAGE_PROFILE_COMPOSITION_POLICY_INVALID",
      "The bound profile composition policy is unknown.",
      { policy: binding.runConfig.profileCompositionPolicy }
    );
  }
  const session = createPackageProfileCompositionSession(binding);
  const enumeration = enumerateDecoratedCandidatesWithCompositionGate(
    binding.enumerationInput,
    binding.enumerationOptions,
    (canonicalizationResult) => session.evaluate(canonicalizationResult)
  );
  return {
    enumeration,
    profileComposition: session.finalize(enumeration)
  };
}
