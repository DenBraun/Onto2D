import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  evaluateVerifiedPackageFunctional
} from "./package-functional-evaluator.js";
import { verifyPackageCandidateCensus } from "./package-candidate-census.js";
import { verifyPackageSelectedFormations } from "./package-selected-formations.js";
import { normalizeProfileRecord } from "./profile.js";
import { evaluateProfileSlotGuard } from "./profile-guard.js";
import { compareQuantities } from "./quantity.js";

export const PACKAGE_DERIVED_PROFILE_EXTRACTOR_VERSION =
  "package-derived-profile-extractor-v3";
export const PACKAGE_DERIVED_PROFILE_SCOPE =
  "all-selected-formations-residual-slot-functional-invariants-and-types-v3";
export const PACKAGE_DERIVED_PROFILE_POLICY = deepFreeze({
  edgeOrder: "canonical-edge-index-v1",
  endpointOrder: "source-then-target-v1",
  slotPreference: "exact-polarity-before-symmetric-then-slot-index-v1",
  capacityConsumption: "one-unit-per-directed-edge-endpoint-v1",
  guardDisposition: "typed-partner-guards-with-legacy-fail-closed-v1",
  baseComposition: "base-profile-plus-residual-constituent-slots-v1",
  invariantDerivation: "complete-declared-functional-evaluation-v1",
  invariantComposition: "base-plus-formation-derived-invariants-v1",
  invariantFailure: "all-or-nothing-profile-indeterminate-v1",
  typeDerivation: "tolerance-aware-derived-invariant-thresholds-v1",
  typeComposition: "static-plus-matched-rule-tags-v1",
  typeFailure: "source-invariant-all-or-nothing-v1"
});

const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxFunctionalEvaluations",
  "maxSensitivityFunctionalEvaluations"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "EXTRACT_PACKAGE_DERIVED_PROFILES",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareStrings);
}

export function normalizePackageDerivedProfileOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DERIVED_PROFILE_OPTIONS_INVALID",
      "Derived-profile options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_DERIVED_PROFILE_OPTIONS_INVALID",
      "Derived-profile options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_DERIVED_PROFILE_OPTION_UNKNOWN",
      "Unknown derived-profile option.",
      { unknown }
    );
  }
  return value;
}

function selectOptions(options, fields) {
  const result = {};
  for (const field of fields) {
    if (options[field] !== undefined) result[field] = options[field];
  }
  return result;
}

function loadedOptions(options) {
  return selectOptions(options, ["kernelVersion"]);
}

function candidateOptions(options) {
  return selectOptions(options, [
    "kernelVersion",
    "maxRawCandidates",
    "maxDecorationStates",
    "maxSearchStates"
  ]);
}

function claimEvidence(claimRefs, loadedPackage) {
  const claims = new Map(loadedPackage.normalized.claims.map((entry) => [
    entry.id,
    entry
  ]));
  return claimRefs.flatMap((claimId) => claims.get(claimId)?.evidence ?? []);
}

function baseProfileEvidence(profile) {
  return profile.invariantVector.flatMap((entry) => [
    ...entry.normalized.provenance.evidence,
    ...entry.quantization.provenance.evidence
  ]);
}

function functionalClaimRefs(evaluations) {
  return evaluations.flatMap((evaluation) => evaluation.claimRefs);
}

function functionalEvidence(evaluations) {
  return evaluations.flatMap((evaluation) =>
    evaluation.score === null
      ? []
      : evaluation.score.provenance.evidence
  );
}

function derivedInvariantEvidence(definition) {
  return !new Set(["residual-slots-v2", "residual-slots-v3"]).has(
    definition.kind
  )
    ? []
    : definition.derivedInvariants.flatMap(
      (entry) => entry.quantization.provenance.evidence
    );
}

function derivedTypeEvidence(definition) {
  return definition.kind !== "residual-slots-v3"
    ? []
    : definition.derivedTypeRules.flatMap(
      (entry) => entry.threshold.provenance.evidence
    );
}

function evaluateDerivedInvariants(
  formation,
  definition,
  loadedPackage,
  binding,
  filtersByCandidate
) {
  if (!new Set(["residual-slots-v2", "residual-slots-v3"]).has(
    definition.kind
  )) {
    return {
      status: "complete",
      evaluations: [],
      invariantVector: [...definition.baseProfile.invariantVector]
    };
  }
  const filter = filtersByCandidate.get(formation.candidateId);
  if (filter === undefined || filter.verdict !== "eligible") {
    fail(
      "PACKAGE_DERIVED_PROFILE_FILTER_MISSING",
      "A selected formation has no eligible filter in the reproduced census.",
      { candidateId: formation.candidateId }
    );
  }
  const evaluations = definition.derivedInvariants.map((entry) => ({
    definition: entry,
    evaluation: evaluateVerifiedPackageFunctional(
      loadedPackage,
      binding,
      filter,
      entry.functional
    )
  }));
  const indeterminate = evaluations.filter(
    (entry) => entry.evaluation.status === "indeterminate"
  );
  if (indeterminate.length > 0) {
    return {
      status: "indeterminate",
      evaluations: evaluations.map((entry) => entry.evaluation),
      details: {
        indeterminateDerivedInvariants: indeterminate.map((entry) => ({
          semantic: entry.definition.semantic,
          functionalId: entry.definition.functional,
          evaluationHash: entry.evaluation.evaluationHash,
          reason: entry.evaluation.reason
        }))
      }
    };
  }
  return {
    status: "complete",
    evaluations: evaluations.map((entry) => entry.evaluation),
    invariantVector: [
      ...definition.baseProfile.invariantVector,
      ...evaluations.map((entry) => ({
        semantic: entry.definition.semantic,
        normalized: entry.evaluation.score,
        quantization: entry.definition.quantization
      }))
    ]
  };
}

function evaluateDerivedTypes(definition, invariantVector, evaluations) {
  if (definition.kind !== "residual-slots-v3") {
    return {
      evaluations: [],
      typeTags: [...definition.derivedTypeTags]
    };
  }
  const invariants = new Map(invariantVector.map((entry) => [
    entry.semantic,
    entry.normalized
  ]));
  const sourceEvaluations = new Map(definition.derivedInvariants.map(
    (entry, index) => [entry.semantic, evaluations[index]]
  ));
  const typeTags = new Set(definition.derivedTypeTags);
  const typeEvaluations = definition.derivedTypeRules.map((rule) => {
    const invariant = invariants.get(rule.invariant);
    const sourceEvaluation = sourceEvaluations.get(rule.invariant);
    if (invariant === undefined || sourceEvaluation?.status !== "scored") {
      fail(
        "PACKAGE_DERIVED_PROFILE_TYPE_SOURCE_MISSING",
        "A formation-derived type rule lacks its reproduced scored invariant.",
        { typeTag: rule.typeTag, invariant: rule.invariant }
      );
    }
    const comparison = compareQuantities(
      invariant,
      rule.comparator,
      rule.threshold,
      { semanticPolicy: "require-equal" }
    );
    const outcome = comparison.pass ? "assigned" : "not-assigned";
    if (outcome === "assigned") typeTags.add(rule.typeTag);
    return {
      schemaVersion: "1",
      evaluator: "formation-derived-type-rule-v1",
      rule,
      sourceFunctionalEvaluationHash: sourceEvaluation.evaluationHash,
      comparison,
      outcome
    };
  });
  return {
    evaluations: typeEvaluations,
    typeTags: sortedUnique([...typeTags])
  };
}

function nodeSlotStates(formation, elementsById) {
  return formation.constituents.map((constituent) => {
    const element = elementsById.get(constituent.elementId);
    if (
      element === undefined ||
      element.profile.hash !== constituent.profileHash
    ) {
      fail(
        "PACKAGE_DERIVED_PROFILE_CONSTITUENT_MISMATCH",
        "A formation constituent profile is absent from the reproduced source population.",
        {
          candidateId: formation.candidateId,
          canonicalNode: constituent.canonicalNode,
          elementId: constituent.elementId,
          profileHash: constituent.profileHash
        }
      );
    }
    return {
      canonicalNode: constituent.canonicalNode,
      elementId: element.id,
      profileHash: element.profile.hash,
      memberElementIds: [...constituent.profileClassMembers],
      slots: element.profile.slots.map((slot, slotIndex) => ({
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

function chooseSlot(
  node,
  partner,
  role,
  requiredPolarity,
  guardContext,
  elementsById
) {
  const matching = node.slots.filter((state) =>
    state.slot.role === role &&
    polarityMatches(state.slot.polarity, requiredPolarity) &&
    capacityAvailable(state)
  ).sort((left, right) => slotPreference(left, right, requiredPolarity));
  if (matching.length === 0) {
    return {
      status: "indeterminate",
      reason: "profile-slot-capacity-unavailable",
      guardEvaluations: []
    };
  }
  const partnerElements = partner.memberElementIds.map((elementId) => {
    const element = elementsById.get(elementId);
    if (element === undefined) {
      fail(
        "PACKAGE_DERIVED_PROFILE_CONSTITUENT_MISMATCH",
        "A profile-class member is absent from the reproduced source population.",
        { elementId, partnerCanonicalNode: partner.canonicalNode }
      );
    }
    return element;
  });
  const guardEvaluations = [];
  let sawFailedGuard = false;
  for (const state of matching) {
    if (state.slot.guard === undefined) {
      return { status: "selected", state, guardEvaluation: null, guardEvaluations };
    }
    const evaluation = evaluateProfileSlotGuard(
      state.slot.guard,
      partnerElements,
      {
        ...guardContext,
        slotIndex: state.slotIndex,
        partnerCanonicalNode: partner.canonicalNode,
        partnerProfileHash: partner.profileHash
      }
    );
    guardEvaluations.push(evaluation);
    if (evaluation.outcome === "pass") {
      return { status: "selected", state, guardEvaluation: evaluation, guardEvaluations };
    }
    if (evaluation.outcome === "indeterminate") {
      return {
        status: "indeterminate",
        reason: evaluation.reason === "profile-slot-guard-unsupported"
          ? evaluation.reason
          : "profile-slot-guard-indeterminate",
        guardEvaluation: evaluation,
        guardEvaluations
      };
    }
    sawFailedGuard = true;
  }
  return {
    status: "indeterminate",
    reason: sawFailedGuard
      ? "profile-slot-guard-unsatisfied"
      : "profile-slot-capacity-unavailable",
    guardEvaluation: guardEvaluations.at(-1) ?? null,
    guardEvaluations
  };
}

function allocateEndpoint(
  nodes,
  canonicalNode,
  role,
  requiredPolarity,
  canonicalEdge,
  endpoint,
  partnerCanonicalNode,
  elementsById,
  guardEvaluations
) {
  const node = nodes[canonicalNode];
  if (node === undefined || node.canonicalNode !== canonicalNode) {
    fail(
      "PACKAGE_DERIVED_PROFILE_NODE_MISSING",
      "A canonical candidate node has no reproduced formation constituent.",
      { canonicalNode, canonicalEdge, endpoint }
    );
  }
  const partner = nodes[partnerCanonicalNode];
  if (partner === undefined || partner.canonicalNode !== partnerCanonicalNode) {
    fail(
      "PACKAGE_DERIVED_PROFILE_NODE_MISSING",
      "A profile guard partner has no reproduced formation constituent.",
      { partnerCanonicalNode, canonicalEdge, endpoint }
    );
  }
  const selected = chooseSlot(
    node,
    partner,
    role,
    requiredPolarity,
    {
      candidateId: guardEvaluations.candidateId,
      canonicalEdge,
      endpoint,
      canonicalNode,
      role,
      requiredPolarity,
      profileHash: node.profileHash
    },
    elementsById
  );
  guardEvaluations.values.push(...selected.guardEvaluations);
  if (selected.status === "indeterminate") {
    return {
      status: "indeterminate",
      reason: selected.reason,
      details: {
        canonicalEdge,
        endpoint,
        canonicalNode,
        role,
        requiredPolarity,
        profileHash: node.profileHash,
        ...(selected.guardEvaluation === undefined || selected.guardEvaluation === null
          ? {}
          : { guardEvaluationHash: selected.guardEvaluation.evaluationHash })
      }
    };
  }
  selected.state.used += 1;
  return {
    status: "selected",
    witness: {
      canonicalNode,
      elementId: node.elementId,
      profileHash: node.profileHash,
      slotIndex: selected.state.slotIndex,
      polarity: selected.state.slot.polarity,
      guardEvaluationHash: selected.guardEvaluation?.evaluationHash ?? null
    }
  };
}

function residualSlots(nodes) {
  return nodes.flatMap((node) => node.slots.flatMap((state) => {
    const min = Math.max(0, state.slot.capacity.min - state.used);
    const max = state.slot.capacity.max === null
      ? null
      : state.slot.capacity.max - state.used;
    if (max === 0) return [];
    return [{
      role: state.slot.role,
      polarity: state.slot.polarity,
      capacity: { min, max },
      ...(state.slot.guard === undefined ? {} : { guard: state.slot.guard })
    }];
  }));
}

function extractResidualProfile(
  formation,
  definition,
  elementsById,
  invariantVector
) {
  const nodes = nodeSlotStates(formation, elementsById);
  const consumptions = [];
  const guardEvaluations = {
    candidateId: formation.candidateId,
    values: []
  };
  for (
    let canonicalEdge = 0;
    canonicalEdge < formation.candidate.edges.length;
    canonicalEdge += 1
  ) {
    const edge = formation.candidate.edges[canonicalEdge];
    const source = allocateEndpoint(
      nodes,
      edge.from,
      edge.role,
      "out",
      canonicalEdge,
      "source",
      edge.to,
      elementsById,
      guardEvaluations
    );
    if (source.status === "indeterminate") {
      return { ...source, guardEvaluations: guardEvaluations.values };
    }
    const target = allocateEndpoint(
      nodes,
      edge.to,
      edge.role,
      "in",
      canonicalEdge,
      "target",
      edge.from,
      elementsById,
      guardEvaluations
    );
    if (target.status === "indeterminate") {
      return { ...target, guardEvaluations: guardEvaluations.values };
    }
    consumptions.push({
      canonicalEdge,
      role: edge.role,
      source: source.witness,
      target: target.witness
    });
  }
  return {
    status: "materialized",
    consumptions,
    guardEvaluations: guardEvaluations.values,
    profile: normalizeProfileRecord({
      slots: [
        ...definition.baseProfile.slots,
        ...residualSlots(nodes)
      ],
      invariantVector,
      precisionPolicy: definition.baseProfile.precisionPolicy
    })
  };
}

function hashResult(basis) {
  return {
    ...basis,
    profileResultHash: hashCanonical(
      HASH_DOMAINS.DERIVED_PROFILE_EXTRACTION,
      basis
    )
  };
}

function extractFormationProfile(
  formation,
  definition,
  elementsById,
  loaded,
  binding,
  filtersByCandidate
) {
  if (definition.kind === "explicit-only") {
    return hashResult({
      candidateId: formation.candidateId,
      formationHash: formation.formationHash,
      status: "indeterminate",
      reason: "derived-profile-policy-unavailable",
      details: { profileDefinitionKind: definition.kind },
      consumptions: [],
      guardEvaluations: [],
      derivedInvariantEvaluations: [],
      derivedTypeEvaluations: [],
      derivedTypeTags: [],
      profile: null,
      claimRefs: [...formation.claimRefs],
      evidence: [...formation.evidence]
    });
  }
  const invariants = evaluateDerivedInvariants(
    formation,
    definition,
    loaded,
    binding,
    filtersByCandidate
  );
  const invariantEvaluations = invariants.evaluations;
  const claimRefs = sortedUnique([
    ...formation.claimRefs,
    ...definition.claimRefs,
    ...functionalClaimRefs(invariantEvaluations)
  ]);
  const evidence = sortedUnique([
    ...formation.evidence,
    ...claimEvidence(definition.claimRefs, loaded),
    ...claimEvidence(functionalClaimRefs(invariantEvaluations), loaded),
    ...baseProfileEvidence(definition.baseProfile),
    ...derivedInvariantEvidence(definition),
    ...derivedTypeEvidence(definition),
    ...functionalEvidence(invariantEvaluations)
  ]);
  if (invariants.status === "indeterminate") {
    return hashResult({
      candidateId: formation.candidateId,
      formationHash: formation.formationHash,
      status: "indeterminate",
      reason: "profile-derived-invariant-indeterminate",
      details: invariants.details,
      consumptions: [],
      guardEvaluations: [],
      derivedInvariantEvaluations: invariantEvaluations,
      derivedTypeEvaluations: [],
      derivedTypeTags: [],
      profile: null,
      claimRefs,
      evidence
    });
  }
  const types = evaluateDerivedTypes(
    definition,
    invariants.invariantVector,
    invariantEvaluations
  );
  const extracted = extractResidualProfile(
    formation,
    definition,
    elementsById,
    invariants.invariantVector
  );
  if (extracted.status === "indeterminate") {
    return hashResult({
      candidateId: formation.candidateId,
      formationHash: formation.formationHash,
      status: "indeterminate",
      reason: extracted.reason,
      details: extracted.details,
      consumptions: [],
      guardEvaluations: extracted.guardEvaluations,
      derivedInvariantEvaluations: invariantEvaluations,
      derivedTypeEvaluations: types.evaluations,
      derivedTypeTags: types.typeTags,
      profile: null,
      claimRefs,
      evidence
    });
  }
  return hashResult({
    candidateId: formation.candidateId,
    formationHash: formation.formationHash,
    status: "materialized",
    consumptions: extracted.consumptions,
    guardEvaluations: extracted.guardEvaluations,
    derivedInvariantEvaluations: invariantEvaluations,
    derivedTypeEvaluations: types.evaluations,
    derivedTypeTags: types.typeTags,
    profile: extracted.profile,
    claimRefs,
    evidence
  });
}

function interpretation(counts) {
  if (counts.selectedFormations === 0) {
    return { status: "empty", reasons: ["no-selected-formations"] };
  }
  if (counts.indeterminateProfiles > 0) {
    return { status: "indeterminate", reasons: ["derived-profile-indeterminate"] };
  }
  return { status: "complete", reasons: [] };
}

/** Extracts one deterministic residual-slot profile per selected formation. */
export function extractVerifiedPackageDerivedProfiles(
  loadedPackage,
  census,
  formations
) {
  const selectedSource = new Set([
    "package-depth-candidate-binding-v2",
    "package-current-level-candidate-binding-v2"
  ]).has(census.generation.binding.binder);
  const sourceElements = selectedSource
    ? census.generation.binding.sourcePopulation.elements
    : census.generation.binding.sourcePopulation.population.elements;
  const elementsById = new Map(
    sourceElements.map((element) => [element.id, element])
  );
  const filtersByCandidate = new Map(
    census.candidateEvaluations.map((entry) => [
      entry.formation.candidate.id,
      entry
    ])
  );
  const definition = loadedPackage.normalized.profileDefinition;
  const results = formations.formations.map((formation) =>
    extractFormationProfile(
      formation,
      definition,
      elementsById,
      loadedPackage,
      census.generation.binding,
      filtersByCandidate
    )
  );
  const counts = {
    selectedFormations: formations.counts.selectedFormations,
    materializedProfiles: results.filter(
      (entry) => entry.status === "materialized"
    ).length,
    indeterminateProfiles: results.filter(
      (entry) => entry.status === "indeterminate"
    ).length
  };
  const resultInterpretation = interpretation(counts);
  const basis = {
    schemaVersion: "1",
    extractor: PACKAGE_DERIVED_PROFILE_EXTRACTOR_VERSION,
    scope: PACKAGE_DERIVED_PROFILE_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: census.bindingHash,
    censusHash: census.censusHash,
    admissionHash: formations.admissionHash,
    formationSetHash: formations.formationSetHash,
    countingDomain: formations.countingDomain,
    sourcePopulationHash: formations.sourcePopulationHash,
    targetDepth: formations.targetDepth,
    depthBasis: formations.depthBasis,
    extractionPolicy: PACKAGE_DERIVED_PROFILE_POLICY,
    profileDefinition: definition,
    results,
    counts,
    status: resultInterpretation.status,
    interpretation: resultInterpretation
  };
  return deepFreeze({
    ...basis,
    profileSetHash: hashCanonical(HASH_DOMAINS.PACKAGE_DERIVED_PROFILES, basis)
  });
}

/** Extracts derived profiles from primitive-source selected formations. */
export function extractPackageDerivedProfiles(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  formationsInput,
  options = {}
) {
  const normalizedOptions = normalizePackageDerivedProfileOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    candidateOptions(normalizedOptions)
  );
  const formations = verifyPackageSelectedFormations(
    formationsInput,
    loadedPackage,
    runConfigInput,
    census,
    admissionInput,
    normalizedOptions
  );
  return extractVerifiedPackageDerivedProfiles(
    loadedPackage,
    census,
    formations
  );
}

/** Verifies derived profiles after their selected formations were replayed. */
export function verifyVerifiedPackageDerivedProfiles(
  profilesInput,
  loadedPackage,
  census,
  formations
) {
  let supplied;
  try {
    supplied = canonicalClone(profilesInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DERIVED_PROFILE_ARTIFACT_INVALID",
      "Derived-profile artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = extractVerifiedPackageDerivedProfiles(
    loadedPackage,
    census,
    formations
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DERIVED_PROFILE_MISMATCH",
      "Derived profiles differ from deterministic reproduction.",
      {
        expectedProfileSetHash: reproduced.profileSetHash,
        actualProfileSetHash:
          isObject(supplied) && typeof supplied.profileSetHash === "string"
            ? supplied.profileSetHash
            : null
      }
    );
  }
  return reproduced;
}

/** Reproduces a stored package-derived-profile artifact exactly. */
export function verifyPackageDerivedProfiles(
  profilesInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  admissionInput,
  formationsInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(profilesInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DERIVED_PROFILE_ARTIFACT_INVALID",
      "Derived-profile artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = extractPackageDerivedProfiles(
    loadedPackageInput,
    runConfigInput,
    censusInput,
    admissionInput,
    formationsInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DERIVED_PROFILE_MISMATCH",
      "Derived profiles differ from deterministic reproduction.",
      {
        expectedProfileSetHash: reproduced.profileSetHash,
        actualProfileSetHash:
          isObject(supplied) && typeof supplied.profileSetHash === "string"
            ? supplied.profileSetHash
            : null
      }
    );
  }
  return reproduced;
}
