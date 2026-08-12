import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import { verifyPackageLadderClosure } from "./package-ladder-closure.js";
import { normalizePackageLevelClosureOptions } from "./package-level-closure.js";
import { verifyPackageProfileCollapse } from "./package-profile-collapse.js";
import { normalizeRunConfig } from "./run-config.js";

export const PACKAGE_CARRIER_PROMOTION_VERSION =
  "package-carrier-promotion-materializer-v1";
export const PACKAGE_CARRIER_PROMOTION_SCOPE =
  "verified-ladder-level-to-target-package-input-v1";
export const PACKAGE_CARRIER_PROMOTION_POLICY = deepFreeze({
  sourceSelection: "verified-selected-derived-level-elements-v1",
  profileRequirement: "non-empty-deterministic-profile-v1",
  coordinateSemantics: "declared-cross-level-no-source-mutation-v1",
  collapseBasis: "verified-bounded-profile-collapse-v1",
  counterexampleHandling: "explicit-block-or-record-and-promote-v1",
  targetMaterialization: "new-primitive-package-input-v1"
});

const POLICY_FIELDS = new Set([
  "schemaVersion",
  "targetDepth",
  "sourceCoordinate",
  "targetCoordinate",
  "targetTypeTags",
  "claimRefs",
  "evidence",
  "counterexampleDisposition"
]);
const COUNTEREXAMPLE_DISPOSITIONS = new Set([
  "block",
  "record-and-promote"
]);
const ONTOLOGY_PHASE =
  /^(?:A|B|C|D|custom:[A-Za-z0-9][A-Za-z0-9._-]*)$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "MATERIALIZE_PACKAGE_CARRIER_PROMOTIONS",
    message,
    details
  });
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function normalizedIdentifier(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_IDENTIFIER_INVALID",
      "Promotion policy identifiers must be non-empty strings.",
      { path, value }
    );
  }
  return value.trim();
}

function normalizedStringSet(value, path, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_STRING_SET_INVALID",
      "Promotion policy string sets must be arrays with the required cardinality.",
      { path, nonEmpty }
    );
  }
  const normalized = value.map((entry, index) =>
    normalizedIdentifier(entry, `${path}[${index}]`)
  );
  if (new Set(normalized).size !== normalized.length) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_STRING_SET_DUPLICATE",
      "Promotion policy string sets must not contain duplicates.",
      { path }
    );
  }
  return normalized.sort(compareStrings);
}

function normalizedCoordinate(value, path) {
  if (!isObject(value)) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_COORDINATE_INVALID",
      "Promotion coordinates must be objects.",
      { path }
    );
  }
  const allowed = new Set(["level", "phase", "segment"]);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (
    unknown.length > 0 ||
    !Number.isSafeInteger(value.level) ||
    value.level < 0 ||
    (value.phase !== undefined &&
      (typeof value.phase !== "string" || !ONTOLOGY_PHASE.test(value.phase))) ||
    (value.segment !== undefined &&
      (typeof value.segment !== "string" || value.segment.trim().length === 0))
  ) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_COORDINATE_INVALID",
      "Promotion coordinates must be normalized OntologyCoordinate values.",
      { path, unknown, value }
    );
  }
  return {
    level: value.level,
    ...(value.phase === undefined ? {} : { phase: value.phase }),
    ...(value.segment === undefined
      ? {}
      : { segment: value.segment.trim() })
  };
}

export function normalizePackageCarrierPromotionPolicy(policyInput) {
  let value;
  try {
    value = canonicalClone(policyInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_CARRIER_PROMOTION_POLICY_INVALID",
      "Carrier-promotion policy is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_POLICY_INVALID",
      "Carrier-promotion policy must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !POLICY_FIELDS.has(field));
  const missing = [...POLICY_FIELDS].filter((field) =>
    !Object.hasOwn(value, field)
  );
  if (unknown.length > 0 || missing.length > 0 || value.schemaVersion !== "1") {
    fail(
      "PACKAGE_CARRIER_PROMOTION_POLICY_INVALID",
      "Carrier-promotion policy fields do not match version 1.",
      { unknown, missing, schemaVersion: value.schemaVersion }
    );
  }
  if (!Number.isSafeInteger(value.targetDepth) || value.targetDepth < 1) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_TARGET_DEPTH_INVALID",
      "Promotion targetDepth must be a positive safe integer.",
      { targetDepth: value.targetDepth }
    );
  }
  const sourceCoordinate = normalizedCoordinate(
    value.sourceCoordinate,
    "$policy.sourceCoordinate"
  );
  const targetCoordinate = normalizedCoordinate(
    value.targetCoordinate,
    "$policy.targetCoordinate"
  );
  if (targetCoordinate.level <= sourceCoordinate.level) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_LEVEL_ORDER_INVALID",
      "Carrier promotion must move to a strictly higher ontology level.",
      { sourceLevel: sourceCoordinate.level, targetLevel: targetCoordinate.level }
    );
  }
  if (!COUNTEREXAMPLE_DISPOSITIONS.has(value.counterexampleDisposition)) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_COUNTEREXAMPLE_DISPOSITION_INVALID",
      "Counterexample disposition must explicitly block or record-and-promote.",
      { value: value.counterexampleDisposition }
    );
  }
  return deepFreeze({
    schemaVersion: "1",
    targetDepth: value.targetDepth,
    sourceCoordinate,
    targetCoordinate,
    targetTypeTags: normalizedStringSet(
      value.targetTypeTags,
      "$policy.targetTypeTags",
      { nonEmpty: true }
    ),
    claimRefs: normalizedStringSet(
      value.claimRefs,
      "$policy.claimRefs",
      { nonEmpty: true }
    ),
    evidence: normalizedStringSet(
      value.evidence,
      "$policy.evidence",
      { nonEmpty: true }
    ),
    counterexampleDisposition: value.counterexampleDisposition
  });
}

function requireReferences(loadedPackage, policy) {
  const claims = new Map(loadedPackage.normalized.claims.map((entry) => [
    entry.id,
    entry
  ]));
  const evidence = new Set(loadedPackage.normalized.evidence.map((entry) =>
    entry.id
  ));
  for (const claimId of policy.claimRefs) {
    const claim = claims.get(claimId);
    if (claim === undefined) {
      fail(
        "PACKAGE_CARRIER_PROMOTION_CLAIM_MISSING",
        "Carrier-promotion policy references an unknown package claim.",
        { claimId }
      );
    }
    const omitted = claim.evidence.filter((evidenceId) =>
      !policy.evidence.includes(evidenceId)
    );
    if (omitted.length > 0) {
      fail(
        "PACKAGE_CARRIER_PROMOTION_CLAIM_EVIDENCE_OMITTED",
        "Promotion evidence must include every evidence reference of its claims.",
        { claimId, omitted }
      );
    }
  }
  for (const evidenceId of policy.evidence) {
    if (!evidence.has(evidenceId)) {
      fail(
        "PACKAGE_CARRIER_PROMOTION_EVIDENCE_MISSING",
        "Carrier-promotion policy references unknown package evidence.",
        { evidenceId }
      );
    }
  }
}

function levelAt(ladder, depth) {
  return ladder.levels.find((level) => level.depth === depth) ?? null;
}

function nonEmptyProfile(profile) {
  return profile.slots.length > 0 || profile.invariantVector.length > 0;
}

function sourceCoordinateStatus(element, policy) {
  if (element.ontologyCoordinate === undefined) return "declared-by-policy";
  if (canonicalize(element.ontologyCoordinate) !== canonicalize(
    policy.sourceCoordinate
  )) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_SOURCE_COORDINATE_MISMATCH",
      "A source element coordinate conflicts with the promotion policy.",
      {
        elementId: element.id,
        elementCoordinate: element.ontologyCoordinate,
        policyCoordinate: policy.sourceCoordinate
      }
    );
  }
  return "verified-on-element";
}

function targetAxisProvenance(coordinate) {
  return {
    ontologyLevel: "declared",
    ...(coordinate.phase === undefined
      ? {}
      : { ontologyPhase: "declared" })
  };
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareStrings);
}

function targetPrimitive(element, policy) {
  return {
    sourceId: `promotion:${element.id}`,
    kind: "primitive",
    ontologyCoordinate: policy.targetCoordinate,
    axisProvenance: targetAxisProvenance(policy.targetCoordinate),
    typeTags: policy.targetTypeTags,
    invariants: element.invariants,
    profile: element.profile,
    claimRefs: sortedUnique([...element.claimRefs, ...policy.claimRefs])
  };
}

function promotionEntry(element, policy, collapse, rulesHash) {
  const coordinateStatus = sourceCoordinateStatus(element, policy);
  const evidence = sortedUnique([
    ...policy.evidence,
    ...(element.provenance?.evidence ?? [])
  ]);
  const basis = {
    schemaVersion: "1",
    sourceElement: element.id,
    sourceDepth: element.depth,
    sourceCoordinate: policy.sourceCoordinate,
    sourceCoordinateStatus: coordinateStatus,
    targetCoordinate: policy.targetCoordinate,
    promotedProfile: element.profile.hash,
    rulesHash,
    claimRefs: sortedUnique([...element.claimRefs, ...policy.claimRefs]),
    evidence,
    collapseHash: collapse.collapseHash,
    collapseVerdict: collapse.verdict,
    targetPrimitive: targetPrimitive(element, policy)
  };
  return {
    ...basis,
    promotionHash: hashCanonical(HASH_DOMAINS.CARRIER_PROMOTION, basis)
  };
}

function terminal(level, collapse, policy) {
  if (level === null) {
    return { status: "indeterminate", reasons: ["target-depth-not-executed"] };
  }
  if (level.status === "indeterminate") {
    return { status: "indeterminate", reasons: ["source-level-indeterminate"] };
  }
  if (collapse.status !== "complete") {
    return { status: "indeterminate", reasons: ["collapse-indeterminate"] };
  }
  if (level.artifacts.population.elements.length === 0) {
    return { status: "empty", reasons: ["no-selected-source-elements"] };
  }
  if (level.artifacts.population.elements.some((element) =>
    !nonEmptyProfile(element.profile)
  )) {
    return { status: "indeterminate", reasons: ["non-empty-profile-required"] };
  }
  if (collapse.verdict === "counterexample") {
    return policy.counterexampleDisposition === "block"
      ? { status: "counterexample", reasons: ["collapse-counterexample-blocked"] }
      : {
          status: "counterexample",
          reasons: ["collapse-counterexample-recorded-and-accepted"]
        };
  }
  return { status: "complete", reasons: [] };
}

/** Emits immutable target-package primitive inputs from one verified level. */
export function materializePackageCarrierPromotions(
  loadedPackageInput,
  runConfigInput,
  ladderInput,
  collapseInput,
  requestedDepths,
  promotionPolicyInput,
  options = {}
) {
  const normalizedOptions = normalizePackageLevelClosureOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalizedOptions)
  );
  const runConfig = normalizeRunConfig(runConfigInput);
  const policy = normalizePackageCarrierPromotionPolicy(promotionPolicyInput);
  if (
    !Number.isSafeInteger(requestedDepths) ||
    requestedDepths < policy.targetDepth
  ) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_LADDER_DEPTH_INVALID",
      "The verified ladder request must include the promotion target depth.",
      { requestedDepths, targetDepth: policy.targetDepth }
    );
  }
  requireReferences(loadedPackage, policy);
  const ladder = verifyPackageLadderClosure(
    ladderInput,
    loadedPackage,
    runConfig,
    requestedDepths,
    normalizedOptions
  );
  const collapse = verifyPackageProfileCollapse(
    collapseInput,
    loadedPackage,
    runConfig,
    policy.targetDepth,
    normalizedOptions
  );
  const level = levelAt(ladder, policy.targetDepth);
  const result = terminal(level, collapse, policy);
  const mayPromote = result.status === "complete" ||
    (result.status === "counterexample" &&
      policy.counterexampleDisposition === "record-and-promote");
  const sourceElements = level?.artifacts.population.elements ?? [];
  const decisions = sourceElements.map((element) => ({
    sourceElement: element.id,
    profileHash: element.profile.hash,
    profileNonEmpty: nonEmptyProfile(element.profile),
    outcome: mayPromote && nonEmptyProfile(element.profile)
      ? "promoted"
      : result.status === "counterexample" ? "blocked" : "indeterminate"
  }));
  const promotions = mayPromote
    ? sourceElements.map((element) => promotionEntry(
        element,
        policy,
        collapse,
        loadedPackage.semanticManifest.rulesHash
      ))
    : [];
  const basis = {
    schemaVersion: "1",
    materializer: PACKAGE_CARRIER_PROMOTION_VERSION,
    scope: PACKAGE_CARRIER_PROMOTION_SCOPE,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    depthBasis: loadedPackage.semanticManifest.depthBasis,
    runConfigHash: ladder.runConfigHash,
    ladderHash: ladder.ladderHash,
    sourceLevelHash: level?.levelHash ?? null,
    sourcePopulationHash:
      level?.artifacts.population.populationHash ?? null,
    collapseBasis: {
      collapseHash: collapse.collapseHash,
      status: collapse.status,
      verdict: collapse.verdict,
      counterexample: collapse.counterexample
    },
    materializationPolicy: PACKAGE_CARRIER_PROMOTION_POLICY,
    promotionPolicyHash: hashCanonical(
      HASH_DOMAINS.CARRIER_PROMOTION_POLICY,
      policy
    ),
    promotionPolicy: policy,
    decisions,
    promotions,
    counts: {
      sourceElements: sourceElements.length,
      nonEmptyProfiles: decisions.filter((entry) => entry.profileNonEmpty).length,
      promotedCarriers: promotions.length,
      blockedCarriers: decisions.filter((entry) => entry.outcome === "blocked").length,
      indeterminateCarriers: decisions.filter(
        (entry) => entry.outcome === "indeterminate"
      ).length
    },
    status: result.status,
    interpretation: result
  };
  return deepFreeze({
    ...basis,
    promotionSetHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_CARRIER_PROMOTIONS,
      basis
    )
  });
}

/** Reproduces a stored carrier-promotion set exactly. */
export function verifyPackageCarrierPromotions(
  promotionsInput,
  loadedPackageInput,
  runConfigInput,
  ladderInput,
  collapseInput,
  requestedDepths,
  promotionPolicyInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(promotionsInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_CARRIER_PROMOTION_ARTIFACT_INVALID",
      "Carrier-promotion artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = materializePackageCarrierPromotions(
    loadedPackageInput,
    runConfigInput,
    ladderInput,
    collapseInput,
    requestedDepths,
    promotionPolicyInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_CARRIER_PROMOTION_MISMATCH",
      "Carrier-promotion artifact differs from deterministic reproduction.",
      {
        expectedPromotionSetHash: reproduced.promotionSetHash,
        actualPromotionSetHash: isObject(supplied) &&
          typeof supplied.promotionSetHash === "string"
          ? supplied.promotionSetHash
          : null
      }
    );
  }
  return reproduced;
}
