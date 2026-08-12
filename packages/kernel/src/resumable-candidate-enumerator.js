import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  enumerateDecoratedCandidatesWithRawCandidateObserver
} from "./candidate-enumerator.js";
import { KernelError } from "./errors.js";
import { HASH_DOMAINS, hashCanonical, isContentHash } from "./hash.js";

export const RESUMABLE_CANDIDATE_ENUMERATOR_VERSION =
  "resumable-decorated-candidate-enumerator-v1";
export const RESUMABLE_CANDIDATE_ENUMERATION_POLICY = deepFreeze({
  state: "raw-candidate-prefix-transcript-v1",
  continuation: "deterministic-prefix-replay-v1",
  terminalResult: "ordinary-decorated-candidate-enumerator-v5-v1",
  semanticBudgets: "never-bypassed-v1"
});
export const RESUMABLE_CANDIDATE_ENUMERATION_LIMITS = deepFreeze({
  maxRawCandidatesPerStep: 1_000_000
});

const RESUME_OPTION_FIELDS = new Set([
  "checkpoint",
  "maxRawCandidatesPerStep"
]);
const STOP = Symbol("resumable-candidate-step-stop");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "RESUME_CANDIDATE_ENUMERATION",
    message,
    details
  });
}

function safeClone(value, code, message) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, message, { causeCode: error.code });
  }
}

function normalizeResumeOptions(options) {
  const value = safeClone(
    options,
    "CANDIDATE_RESUME_OPTIONS_INVALID",
    "Resumable candidate options are not canonicalizable."
  );
  if (!isObject(value)) {
    fail(
      "CANDIDATE_RESUME_OPTIONS_INVALID",
      "Resumable candidate options must be an object."
    );
  }
  const unknown = Object.keys(value).filter(
    (field) => !RESUME_OPTION_FIELDS.has(field)
  );
  if (unknown.length > 0) {
    fail(
      "CANDIDATE_RESUME_OPTION_UNKNOWN",
      "Unknown resumable candidate option.",
      { unknown }
    );
  }
  const maxRawCandidatesPerStep = value.maxRawCandidatesPerStep ??
    RESUMABLE_CANDIDATE_ENUMERATION_LIMITS.maxRawCandidatesPerStep;
  if (
    !Number.isSafeInteger(maxRawCandidatesPerStep) ||
    maxRawCandidatesPerStep < 1 ||
    maxRawCandidatesPerStep >
      RESUMABLE_CANDIDATE_ENUMERATION_LIMITS.maxRawCandidatesPerStep
  ) {
    fail(
      "CANDIDATE_RESUME_STEP_LIMIT_INVALID",
      "The resumable raw-candidate step limit must be a positive bounded integer.",
      {
        value: maxRawCandidatesPerStep,
        maximum:
          RESUMABLE_CANDIDATE_ENUMERATION_LIMITS.maxRawCandidatesPerStep
      }
    );
  }
  return {
    checkpoint: value.checkpoint ?? null,
    maxRawCandidatesPerStep
  };
}

function checkpointBasis(value) {
  const { checkpointHash: _checkpointHash, ...basis } = value;
  return basis;
}

function normalizeCheckpoint(checkpoint, inputHash, optionsHash) {
  if (checkpoint === null) {
    return {
      checkpoint: null,
      startRawCandidateOrdinal: 0,
      expectedTranscriptHash: initialTranscript(inputHash, optionsHash)
    };
  }
  if (!isObject(checkpoint)) {
    fail(
      "CANDIDATE_RESUME_CHECKPOINT_INVALID",
      "A resumable candidate checkpoint must be an object or null."
    );
  }
  const required = new Set([
    "schemaVersion",
    "cursor",
    "inputHash",
    "optionsHash",
    "nextRawCandidateOrdinal",
    "transcriptHash",
    "previousCheckpointHash",
    "checkpointHash"
  ]);
  const unknown = Object.keys(checkpoint).filter((field) => !required.has(field));
  const missing = [...required].filter((field) => !Object.hasOwn(checkpoint, field));
  if (
    unknown.length > 0 ||
    missing.length > 0 ||
    checkpoint.schemaVersion !== "1" ||
    checkpoint.cursor !== "raw-candidate-prefix-v1" ||
    checkpoint.inputHash !== inputHash ||
    checkpoint.optionsHash !== optionsHash ||
    !Number.isSafeInteger(checkpoint.nextRawCandidateOrdinal) ||
    checkpoint.nextRawCandidateOrdinal < 1 ||
    !isContentHash(checkpoint.transcriptHash) ||
    !isContentHash(checkpoint.checkpointHash) ||
    !(
      checkpoint.previousCheckpointHash === null ||
      isContentHash(checkpoint.previousCheckpointHash)
    )
  ) {
    fail(
      "CANDIDATE_RESUME_CHECKPOINT_INVALID",
      "A resumable candidate checkpoint violates its closed identity contract.",
      { unknown, missing }
    );
  }
  const expectedCheckpointHash = hashCanonical(
    HASH_DOMAINS.CANDIDATE_RESUME_CHECKPOINT,
    checkpointBasis(checkpoint)
  );
  if (checkpoint.checkpointHash !== expectedCheckpointHash) {
    fail(
      "CANDIDATE_RESUME_CHECKPOINT_HASH_MISMATCH",
      "A resumable candidate checkpoint hash does not match its canonical basis.",
      {
        expectedCheckpointHash,
        actualCheckpointHash: checkpoint.checkpointHash
      }
    );
  }
  return {
    checkpoint,
    startRawCandidateOrdinal: checkpoint.nextRawCandidateOrdinal,
    expectedTranscriptHash: checkpoint.transcriptHash
  };
}

function initialTranscript(inputHash, optionsHash) {
  return hashCanonical(HASH_DOMAINS.CANDIDATE_RESUME_TRANSCRIPT, {
    schemaVersion: "1",
    inputHash,
    optionsHash,
    policy: RESUMABLE_CANDIDATE_ENUMERATION_POLICY
  });
}

function extendTranscript(previousTranscriptHash, rawCandidateOrdinal, candidateInput) {
  const rawCandidateHash = hashCanonical(
    HASH_DOMAINS.CANDIDATE_RESUME_INPUT,
    { schemaVersion: "1", candidateInput }
  );
  return hashCanonical(HASH_DOMAINS.CANDIDATE_RESUME_TRANSCRIPT, {
    schemaVersion: "1",
    previousTranscriptHash,
    rawCandidateOrdinal,
    rawCandidateHash
  });
}

function makeCheckpoint(
  inputHash,
  optionsHash,
  nextRawCandidateOrdinal,
  transcriptHash,
  previousCheckpointHash
) {
  const basis = {
    schemaVersion: "1",
    cursor: "raw-candidate-prefix-v1",
    inputHash,
    optionsHash,
    nextRawCandidateOrdinal,
    transcriptHash,
    previousCheckpointHash
  };
  return deepFreeze({
    ...basis,
    checkpointHash: hashCanonical(
      HASH_DOMAINS.CANDIDATE_RESUME_CHECKPOINT,
      basis
    )
  });
}

function compareCheckpointTranscript(actual, expected, nextRawCandidateOrdinal) {
  if (actual !== expected) {
    fail(
      "CANDIDATE_RESUME_PREFIX_MISMATCH",
      "The replayed raw-candidate prefix differs from the supplied checkpoint.",
      {
        nextRawCandidateOrdinal,
        expectedTranscriptHash: expected,
        actualTranscriptHash: actual
      }
    );
  }
}

/** Advances one bounded raw-candidate window without bypassing semantic budgets. */
export function advanceDecoratedCandidateEnumeration(
  input,
  enumerationOptions = {},
  resumeOptions = {}
) {
  const safeInput = safeClone(
    input,
    "CANDIDATE_RESUME_INPUT_INVALID",
    "Resumable candidate input is not canonicalizable."
  );
  const safeEnumerationOptions = safeClone(
    enumerationOptions,
    "CANDIDATE_RESUME_ENUMERATION_OPTIONS_INVALID",
    "Resumable enumeration options are not canonicalizable."
  );
  const normalized = normalizeResumeOptions(resumeOptions);
  const inputHash = hashCanonical(
    HASH_DOMAINS.CANDIDATE_RESUME_INPUT,
    { schemaVersion: "1", input: safeInput }
  );
  const optionsHash = hashCanonical(
    HASH_DOMAINS.CANDIDATE_RESUME_INPUT,
    { schemaVersion: "1", enumerationOptions: safeEnumerationOptions }
  );
  const resumed = normalizeCheckpoint(
    normalized.checkpoint,
    inputHash,
    optionsHash
  );
  const start = resumed.startRawCandidateOrdinal;
  const stop = start + normalized.maxRawCandidatesPerStep;
  if (!Number.isSafeInteger(stop)) {
    fail(
      "CANDIDATE_RESUME_ORDINAL_LIMIT",
      "The resumable raw-candidate ordinal exceeds the safe-integer contract.",
      { start, maximumStep: normalized.maxRawCandidatesPerStep }
    );
  }
  let transcriptHash = initialTranscript(inputHash, optionsHash);
  let observedRawCandidates = 0;
  let processedRawCandidates = 0;
  let prefixVerified = start === 0;
  let enumeration = null;
  let paused = false;

  try {
    const execution = enumerateDecoratedCandidatesWithRawCandidateObserver(
      safeInput,
      safeEnumerationOptions,
      ({ rawCandidateOrdinal, candidateInput }) => {
        if (rawCandidateOrdinal !== observedRawCandidates) {
          fail(
            "CANDIDATE_RESUME_RAW_ORDER_MISMATCH",
            "Raw-candidate observation is not a contiguous zero-based sequence.",
            { expected: observedRawCandidates, actual: rawCandidateOrdinal }
          );
        }
        if (!prefixVerified && rawCandidateOrdinal === start) {
          compareCheckpointTranscript(
            transcriptHash,
            resumed.expectedTranscriptHash,
            start
          );
          prefixVerified = true;
        }
        if (rawCandidateOrdinal === stop) throw STOP;
        transcriptHash = extendTranscript(
          transcriptHash,
          rawCandidateOrdinal,
          candidateInput
        );
        observedRawCandidates += 1;
        if (rawCandidateOrdinal >= start) processedRawCandidates += 1;
      }
    );
    enumeration = execution.enumeration;
  } catch (error) {
    if (error !== STOP) throw error;
    paused = true;
  }

  if (!prefixVerified && observedRawCandidates === start) {
    compareCheckpointTranscript(
      transcriptHash,
      resumed.expectedTranscriptHash,
      start
    );
    prefixVerified = true;
  }
  if (!prefixVerified || observedRawCandidates < start) {
    fail(
      "CANDIDATE_RESUME_CURSOR_OUT_OF_RANGE",
      "The supplied checkpoint lies beyond the deterministic raw universe.",
      { nextRawCandidateOrdinal: start, observedRawCandidates }
    );
  }

  const endRawCandidateOrdinal = start + processedRawCandidates;
  const checkpoint = paused
    ? makeCheckpoint(
        inputHash,
        optionsHash,
        endRawCandidateOrdinal,
        transcriptHash,
        resumed.checkpoint?.checkpointHash ?? null
      )
    : null;
  const status = paused ? "paused" : enumeration.status;
  const basis = {
    schemaVersion: "1",
    coordinator: RESUMABLE_CANDIDATE_ENUMERATOR_VERSION,
    policy: RESUMABLE_CANDIDATE_ENUMERATION_POLICY,
    inputHash,
    optionsHash,
    previousCheckpointHash: resumed.checkpoint?.checkpointHash ?? null,
    step: {
      startRawCandidateOrdinal: start,
      endRawCandidateOrdinal,
      maximumRawCandidates: normalized.maxRawCandidatesPerStep,
      processedRawCandidates,
      replayedRawCandidates: start
    },
    transcriptHash,
    checkpoint,
    enumeration,
    status,
    interpretation: status === "paused"
      ? { status: "paused", reasons: ["raw-candidate-step-limit-reached"] }
      : status === "complete"
        ? { status: "complete", reasons: [] }
        : {
            status: "budget-exhausted",
            reasons: ["semantic-enumeration-budget-exhausted"]
          }
  };
  return deepFreeze({
    ...basis,
    stepHash: hashCanonical(HASH_DOMAINS.CANDIDATE_RESUME_STEP, basis)
  });
}

/** Reproduces one resumable advancement from the same prior checkpoint. */
export function verifyDecoratedCandidateEnumerationStep(
  artifactInput,
  input,
  enumerationOptions = {},
  resumeOptions = {}
) {
  const supplied = safeClone(
    artifactInput,
    "CANDIDATE_RESUME_ARTIFACT_INVALID",
    "A resumable candidate step is not canonicalizable."
  );
  const reproduced = advanceDecoratedCandidateEnumeration(
    input,
    enumerationOptions,
    resumeOptions
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "CANDIDATE_RESUME_ARTIFACT_MISMATCH",
      "A resumable candidate step differs from deterministic reproduction.",
      {
        expectedStepHash: reproduced.stepHash,
        actualStepHash: isObject(supplied) ? supplied.stepHash ?? null : null
      }
    );
  }
  return reproduced;
}
