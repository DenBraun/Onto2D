import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  verifyPackageCandidateCensus
} from "./package-candidate-census.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  verifyPackageDepthNullModelPlan,
  verifyPackageNullModelPlan
} from "./package-null-model-plan.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";

export const PACKAGE_NULL_MODEL_PROPOSALS_VERSION =
  "package-null-model-proposals-v1";
export const PACKAGE_NULL_MODEL_PROPOSAL_LIMITS = deepFreeze({
  maxProposalOccurrences: 1_000_000,
  maxProposalOperations: 1_000_000,
  maxRejectionDraws: 1_024
});
export const PACKAGE_NULL_MODEL_PROPOSAL_POLICY = deepFreeze({
  occurrencePopulation: "carrier-size-per-trial-v1",
  occurrenceIdentity: "source-ordinal-and-proposed-candidate-v1",
  membership: "verified-complete-carrier-v1",
  canonicalization: "bound-run-graph-policy-v1",
  roleShuffle: "candidate-wise-fisher-yates-v1",
  degreeRewire: "ten-directed-target-swaps-per-edge-v1",
  uniform: "independent-carrier-index-with-replacement-v1"
});

const SHA256_RANGE = 1n << 256n;
const OPTION_FIELDS = new Set([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxNullTrials",
  "maxProposalOccurrences",
  "maxProposalOperations"
]);
const PLAN_OPTION_FIELDS = Object.freeze([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates",
  "maxNullTrials"
]);
const CANDIDATE_OPTION_FIELDS = Object.freeze([
  "kernelVersion",
  "maxRawCandidates",
  "maxDecorationStates",
  "maxSearchStates"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "PROPOSE_PACKAGE_NULL_MODELS",
    message,
    details
  });
}

function selectedOptions(options, fields) {
  return Object.fromEntries(fields.flatMap((field) =>
    options[field] === undefined ? [] : [[field, options[field]]]
  ));
}

function normalizeOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_PROPOSAL_OPTIONS_INVALID",
      "Null-model proposal options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_NULL_MODEL_PROPOSAL_OPTIONS_INVALID",
      "Null-model proposal options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_NULL_MODEL_PROPOSAL_OPTION_UNKNOWN",
      "Unknown null-model proposal option.",
      { unknown }
    );
  }
  const normalized = {
    ...value,
    maxProposalOccurrences: value.maxProposalOccurrences ??
      PACKAGE_NULL_MODEL_PROPOSAL_LIMITS.maxProposalOccurrences,
    maxProposalOperations: value.maxProposalOperations ??
      PACKAGE_NULL_MODEL_PROPOSAL_LIMITS.maxProposalOperations
  };
  for (const field of ["maxProposalOccurrences", "maxProposalOperations"]) {
    if (
      !Number.isSafeInteger(normalized[field]) ||
      normalized[field] < 1 ||
      normalized[field] > PACKAGE_NULL_MODEL_PROPOSAL_LIMITS[field]
    ) {
      fail(
        "PACKAGE_NULL_MODEL_PROPOSAL_LIMIT_INVALID",
        "Null-model proposal limits must be positive integers within hard limits.",
        {
          field,
          value: normalized[field],
          maximum: PACKAGE_NULL_MODEL_PROPOSAL_LIMITS[field]
        }
      );
    }
  }
  return normalized;
}

function drawIndex(streamHash, coordinate, frameSize) {
  if (!Number.isSafeInteger(frameSize) || frameSize < 1) {
    fail(
      "PACKAGE_NULL_MODEL_DRAW_FRAME_INVALID",
      "A null-model random draw requires a non-empty finite frame.",
      { frameSize }
    );
  }
  const modulus = BigInt(frameSize);
  const rejectionLimit = SHA256_RANGE - (SHA256_RANGE % modulus);
  for (
    let counter = 0;
    counter < PACKAGE_NULL_MODEL_PROPOSAL_LIMITS.maxRejectionDraws;
    counter += 1
  ) {
    const digest = hashCanonical(HASH_DOMAINS.PACKAGE_NULL_MODEL_DRAW, {
      schemaVersion: "1",
      streamHash,
      coordinate,
      counter
    });
    const value = BigInt(`0x${digest.slice("sha256:".length)}`);
    if (value < rejectionLimit) {
      return {
        index: Number(value % modulus),
        draws: counter + 1
      };
    }
  }
  fail(
    "PACKAGE_NULL_MODEL_DRAW_STREAM_EXHAUSTED",
    "Null-model rejection sampling exceeded its bounded draw window.",
    { streamHash, coordinate, frameSize }
  );
}

function candidateInput(candidate) {
  return {
    domain: candidate.domain,
    nodes: candidate.nodes,
    edges: candidate.edges
  };
}

function canonicalizationOptions(binding) {
  return {
    policy: binding.runConfig.graphPolicy,
    limits: binding.enumerationOptions.canonicalizationLimits
  };
}

function canonicalProposal(input, binding) {
  return canonicalizeCandidate(
    candidateInput(input),
    canonicalizationOptions(binding)
  ).candidate;
}

function roleShuffle(candidate, streamHash, occurrenceIndex, binding) {
  const input = canonicalClone(candidateInput(candidate));
  const roles = input.edges.map((edge) => edge.role);
  let randomDraws = 0;
  for (let index = roles.length - 1; index > 0; index -= 1) {
    const selection = drawIndex(
      streamHash,
      {
        operation: "role-shuffle",
        occurrenceIndex,
        step: roles.length - 1 - index
      },
      index + 1
    );
    randomDraws += selection.draws;
    [roles[index], roles[selection.index]] = [
      roles[selection.index],
      roles[index]
    ];
  }
  roles.forEach((role, index) => {
    input.edges[index].role = role;
  });
  const proposed = canonicalProposal(input, binding);
  return {
    proposed,
    operation: {
      kind: "role-shuffle",
      algorithm: "fisher-yates-uniform-v1",
      randomDraws,
      edgeRoles: roles.length,
      changed: proposed.id !== candidate.id
    }
  };
}

function sameRolePairs(edges) {
  const pairs = [];
  for (let left = 0; left < edges.length; left += 1) {
    for (let right = left + 1; right < edges.length; right += 1) {
      if (edges[left].role === edges[right].role) pairs.push([left, right]);
    }
  }
  return pairs;
}

function degreeRewire(
  candidate,
  streamHash,
  occurrenceIndex,
  binding,
  carrierIds
) {
  const current = canonicalClone(candidateInput(candidate));
  const pairs = sameRolePairs(current.edges);
  const attempts = pairs.length === 0
    ? 0
    : Math.max(1, current.edges.length * 10);
  let accepted = 0;
  let rejected = 0;
  let randomDraws = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const selection = drawIndex(
      streamHash,
      { operation: "degree-rewire", occurrenceIndex, attempt },
      pairs.length
    );
    randomDraws += selection.draws;
    const [left, right] = pairs[selection.index];
    const next = canonicalClone(current);
    [next.edges[left].to, next.edges[right].to] = [
      next.edges[right].to,
      next.edges[left].to
    ];
    try {
      const canonical = canonicalProposal(next, binding);
      if (!carrierIds.has(canonical.id)) {
        rejected += 1;
        continue;
      }
      current.edges = next.edges;
      accepted += 1;
    } catch (error) {
      if (!(error instanceof KernelValidationError)) throw error;
      rejected += 1;
    }
  }
  const proposed = canonicalProposal(current, binding);
  return {
    proposed,
    operation: {
      kind: "degree-rewire",
      algorithm: "role-wise-directed-target-swap-v1",
      randomDraws,
      eligibleEdgePairs: pairs.length,
      attemptedSwaps: attempts,
      acceptedSwaps: accepted,
      rejectedSwaps: rejected,
      acceptanceRatio: attempts === 0 ? null : accepted / attempts,
      mixingStatus: attempts === 0
        ? "not-applicable"
        : accepted === 0 ? "unmixed" : "mixed",
      changed: proposed.id !== candidate.id
    }
  };
}

function uniformProposal(
  carrierCandidates,
  sourceCandidate,
  streamHash,
  occurrenceIndex
) {
  const selection = drawIndex(
    streamHash,
    { operation: "uniform", occurrenceIndex },
    carrierCandidates.length
  );
  const proposed = carrierCandidates[selection.index];
  return {
    proposed,
    operation: {
      kind: "uniform",
      algorithm: "exact-uniform-carrier-index-v1",
      replacement: "with-replacement",
      frameSize: carrierCandidates.length,
      frameIndex: selection.index,
      randomDraws: selection.draws,
      changed: proposed.id !== sourceCandidate.id
    }
  };
}

function requiredWork(plan, carrierCandidates) {
  const edges = carrierCandidates.map((candidate) => candidate.edges);
  const roleShuffleOperations = edges.reduce(
    (total, candidateEdges) => total + Math.max(0, candidateEdges.length - 1),
    0
  );
  const degreeRewireOperations = edges.reduce((total, candidateEdges) => {
    const eligible = sameRolePairs(candidateEdges).length > 0;
    return total + (eligible ? Math.max(1, candidateEdges.length * 10) : 0);
  }, 0);
  let operations = 0n;
  for (const trial of plan.trials) {
    operations += BigInt(
      trial.model === "uniform"
        ? carrierCandidates.length
        : trial.model === "role-shuffle"
          ? roleShuffleOperations
          : degreeRewireOperations
    );
  }
  return {
    occurrences: BigInt(plan.trials.length) * BigInt(carrierCandidates.length),
    operations
  };
}

function assertWorkLimits(work, options) {
  if (work.occurrences > BigInt(options.maxProposalOccurrences)) {
    fail(
      "PACKAGE_NULL_MODEL_PROPOSAL_OCCURRENCE_LIMIT",
      "Null-model proposal occurrences exceed the configured limit.",
      {
        required: work.occurrences.toString(),
        maximum: options.maxProposalOccurrences
      }
    );
  }
  if (work.operations > BigInt(options.maxProposalOperations)) {
    fail(
      "PACKAGE_NULL_MODEL_PROPOSAL_OPERATION_LIMIT",
      "Null-model random operations exceed the configured limit.",
      {
        required: work.operations.toString(),
        maximum: options.maxProposalOperations
      }
    );
  }
}

function proposalOccurrence(
  trial,
  sourceCandidate,
  carrierCandidates,
  occurrenceIndex,
  binding,
  carrierIds
) {
  const generated = trial.model === "role-shuffle"
    ? roleShuffle(sourceCandidate, trial.streamHash, occurrenceIndex, binding)
    : trial.model === "degree-rewire"
      ? degreeRewire(
          sourceCandidate,
          trial.streamHash,
          occurrenceIndex,
          binding,
          carrierIds
        )
      : uniformProposal(
          carrierCandidates,
          sourceCandidate,
          trial.streamHash,
          occurrenceIndex
        );
  if (!carrierIds.has(generated.proposed.id)) {
    fail(
      "PACKAGE_NULL_MODEL_PROPOSAL_OUTSIDE_CARRIER",
      "A null-model proposal left the verified complete carrier universe.",
      {
        trialId: trial.trialId,
        model: trial.model,
        occurrenceIndex,
        candidateId: generated.proposed.id
      }
    );
  }
  return {
    occurrenceIndex,
    sourceCandidateId: sourceCandidate.id,
    candidateId: generated.proposed.id,
    candidate: generated.proposed,
    operation: generated.operation
  };
}

function proposalTrial(trial, carrierCandidates, binding, carrierIds) {
  const occurrences = carrierCandidates.map((sourceCandidate, occurrenceIndex) =>
    proposalOccurrence(
      trial,
      sourceCandidate,
      carrierCandidates,
      occurrenceIndex,
      binding,
      carrierIds
    ));
  const attemptedSwaps = occurrences.reduce(
    (total, entry) => total + (entry.operation.attemptedSwaps ?? 0),
    0
  );
  const acceptedSwaps = occurrences.reduce(
    (total, entry) => total + (entry.operation.acceptedSwaps ?? 0),
    0
  );
  const basis = {
    trialId: trial.trialId,
    model: trial.model,
    streamHash: trial.streamHash,
    occurrences,
    counts: {
      occurrences: occurrences.length,
      changed: occurrences.filter((entry) => entry.operation.changed).length,
      randomDraws: occurrences.reduce(
        (total, entry) => total + entry.operation.randomDraws,
        0
      ),
      attemptedSwaps,
      acceptedSwaps,
      rejectedSwaps: attemptedSwaps - acceptedSwaps
    }
  };
  return {
    ...basis,
    trialProposalHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_TRIAL_PROPOSAL,
      basis
    )
  };
}

function createVerifiedProposals(census, plan, options) {
  const carrierCandidates = census.candidateEvaluations.map(
    (entry) => entry.formation.candidate
  );
  const carrierIds = carrierCandidates.map((candidate) => candidate.id);
  if (canonicalize(carrierIds) !== canonicalize(plan.carrierPopulation.candidateIds)) {
    fail(
      "PACKAGE_NULL_MODEL_PROPOSAL_CARRIER_MISMATCH",
      "Verified plan carrier differs from the verified census candidates."
    );
  }
  const work = requiredWork(plan, carrierCandidates);
  assertWorkLimits(work, options);
  const carrierIdsSet = new Set(carrierIds);
  const trials = plan.trials.map((trial) =>
    proposalTrial(
      trial,
      carrierCandidates,
      census.generation.binding,
      carrierIdsSet
    ));
  const notRun = plan.status === "not-run";
  const basis = {
    schemaVersion: "1",
    proposer: PACKAGE_NULL_MODEL_PROPOSALS_VERSION,
    planHash: plan.planHash,
    packageId: plan.packageId,
    rulesHash: plan.rulesHash,
    runConfigHash: plan.runConfigHash,
    bindingHash: plan.bindingHash,
    censusHash: plan.censusHash,
    carrierHash: plan.carrierPopulation.carrierHash,
    policy: PACKAGE_NULL_MODEL_PROPOSAL_POLICY,
    trials,
    counts: {
      trials: trials.length,
      occurrences: trials.reduce(
        (total, trial) => total + trial.counts.occurrences,
        0
      ),
      changed: trials.reduce((total, trial) => total + trial.counts.changed, 0),
      randomDraws: trials.reduce(
        (total, trial) => total + trial.counts.randomDraws,
        0
      ),
      attemptedSwaps: trials.reduce(
        (total, trial) => total + trial.counts.attemptedSwaps,
        0
      ),
      acceptedSwaps: trials.reduce(
        (total, trial) => total + trial.counts.acceptedSwaps,
        0
      ),
      rejectedSwaps: trials.reduce(
        (total, trial) => total + trial.counts.rejectedSwaps,
        0
      )
    },
    status: notRun ? "not-run" : "complete",
    interpretation: notRun
      ? { status: "not-run", reasons: ["null-models-disabled"] }
      : {
          status: "proposal-complete",
          reasons: ["trial-evaluation-and-distributions-pending"]
        }
  };
  return deepFreeze({
    ...basis,
    proposalsHash: hashCanonical(
      HASH_DOMAINS.PACKAGE_NULL_MODEL_PROPOSALS,
      basis
    )
  });
}

/** Builds deterministic null-model proposals from an already verified carrier. */
export function createVerifiedPackageNullModelProposals(
  census,
  plan,
  options = {}
) {
  return createVerifiedProposals(census, plan, normalizeOptions(options));
}

function verifyArtifact(input, reproduced) {
  let supplied;
  try {
    supplied = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_NULL_MODEL_PROPOSALS_INVALID",
      "Null-model proposals are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_NULL_MODEL_PROPOSALS_MISMATCH",
      "Null-model proposals differ from deterministic reproduction.",
      {
        expectedProposalsHash: reproduced.proposalsHash,
        actualProposalsHash: isObject(supplied) &&
          typeof supplied.proposalsHash === "string"
          ? supplied.proposalsHash
          : null
      }
    );
  }
  return reproduced;
}

export function createPackageNullModelProposals(
  loadedPackageInput,
  runConfigInput,
  censusInput,
  planInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    selectedOptions(normalized, ["kernelVersion"])
  );
  const census = verifyPackageCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    selectedOptions(normalized, CANDIDATE_OPTION_FIELDS)
  );
  const plan = verifyPackageNullModelPlan(
    planInput,
    loadedPackage,
    runConfigInput,
    census,
    selectedOptions(normalized, PLAN_OPTION_FIELDS)
  );
  return createVerifiedPackageNullModelProposals(census, plan, normalized);
}

export function createPackageDepthNullModelProposals(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  planInput,
  options = {}
) {
  const normalized = normalizeOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    selectedOptions(normalized, ["kernelVersion"])
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    selectedOptions(normalized, CANDIDATE_OPTION_FIELDS)
  );
  const plan = verifyPackageDepthNullModelPlan(
    planInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    census,
    selectedOptions(normalized, PLAN_OPTION_FIELDS)
  );
  return createVerifiedPackageNullModelProposals(census, plan, normalized);
}

export function verifyPackageNullModelProposals(
  proposalsInput,
  loadedPackageInput,
  runConfigInput,
  censusInput,
  planInput,
  options = {}
) {
  return verifyArtifact(
    proposalsInput,
    createPackageNullModelProposals(
      loadedPackageInput,
      runConfigInput,
      censusInput,
      planInput,
      options
    )
  );
}

export function verifyPackageDepthNullModelProposals(
  proposalsInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  planInput,
  options = {}
) {
  return verifyArtifact(
    proposalsInput,
    createPackageDepthNullModelProposals(
      loadedPackageInput,
      runConfigInput,
      levelClosuresInput,
      targetDepth,
      censusInput,
      planInput,
      options
    )
  );
}
