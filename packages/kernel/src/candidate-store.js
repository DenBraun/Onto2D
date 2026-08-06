import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import {
  canonicalizeCandidate,
  normalizeGraphCanonicalizationOptions
} from "./graph-canonicalizer.js";

const DOMAINS = new Set(["profile-quotient", "element-exact", "single-candidate"]);
const OPTION_FIELDS = new Set(["domain", "maxCandidates", "canonicalization"]);

export const DEFAULT_CANDIDATE_STORE_LIMITS = Object.freeze({ maxCandidates: 1_000_000 });

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "CANDIDATE_STORE", message, details });
}

function validateOptions(options) {
  const issues = [];
  if (!isObject(options)) {
    issues.push(validationIssue("CANDIDATE_STORE_OPTIONS_INVALID", "$options", "Candidate store options must be an object."));
    return { issues, normalized: null };
  }
  for (const key of Object.keys(options)) {
    if (!OPTION_FIELDS.has(key)) {
      issues.push(validationIssue("CANDIDATE_STORE_OPTION_UNKNOWN", `$options.${key}`, "Unknown candidate store option.", { key }));
    }
  }
  if (!DOMAINS.has(options.domain)) {
    issues.push(validationIssue("CANDIDATE_STORE_DOMAIN_INVALID", "$options.domain", "Candidate store requires a valid fixed counting domain.", {
      value: options.domain
    }));
  }
  const maxCandidates = options.maxCandidates === undefined
    ? DEFAULT_CANDIDATE_STORE_LIMITS.maxCandidates
    : options.maxCandidates;
  if (!Number.isSafeInteger(maxCandidates) || maxCandidates < 1) {
    issues.push(validationIssue("CANDIDATE_STORE_BUDGET_INVALID", "$options.maxCandidates", "Candidate-store budget must be a positive safe integer.", {
      value: maxCandidates
    }));
  }
  const canonicalization = options.canonicalization === undefined ? {} : options.canonicalization;
  if (!isObject(canonicalization)) {
    issues.push(validationIssue(
      "CANDIDATE_STORE_CANONICALIZATION_INVALID",
      "$options.canonicalization",
      "Candidate-store canonicalization options must be an object."
    ));
  }
  return {
    issues,
    normalized: {
      domain: options.domain,
      maxCandidates,
      canonicalization: isObject(canonicalization) ? canonicalization : {}
    }
  };
}

export function createCandidateStore(options) {
  const safeOptions = canonicalClone(options === undefined ? null : options);
  const { issues, normalized } = validateOptions(safeOptions);
  if (issues.length > 0) {
    throw new KernelValidationError(issues, "Candidate store configuration failed validation.", {
      code: "CANDIDATE_STORE_VALIDATION_FAILED",
      stage: "CANDIDATE_STORE"
    });
  }
  normalized.canonicalization = normalizeGraphCanonicalizationOptions(normalized.canonicalization);

  const records = new Map();
  let state = "open";
  let attemptedCandidates = 0;
  let duplicateCandidates = 0;
  let exhaustion = null;

  function snapshot() {
    const candidates = [...records.values()]
      .sort((left, right) => compareStrings(left.candidateId, right.candidateId))
      .map((record) => deepFreeze({
        candidateId: record.candidateId,
        skeletonId: record.skeletonId,
        candidate: record.candidate,
        canonicalForm: record.canonicalForm,
        duplicateCount: record.duplicateCount
      }));
    return deepFreeze({
      schemaVersion: "1",
      status: state,
      interpretable: state === "complete",
      domain: normalized.domain,
      canonicalization: normalized.canonicalization,
      candidates,
      counts: {
        attemptedCandidates,
        uniqueCandidates: records.size,
        duplicateCandidates,
        excludedCandidates: exhaustion === null ? 0 : 1
      },
      budget: {
        maxCandidates: normalized.maxCandidates,
        exhausted: exhaustion
      }
    });
  }

  function add(input) {
    if (state === "complete") fail("CANDIDATE_STORE_CLOSED", "Cannot add a candidate after the store is finalized.");
    if (state === "budget-exhausted") {
      return deepFreeze({ status: "budget-exhausted", exhaustion });
    }

    const result = canonicalizeCandidate(input, normalized.canonicalization);
    if (result.canonical.domain !== normalized.domain) {
      fail("CANDIDATE_STORE_DOMAIN_MISMATCH", "Candidate domain does not match the store counting domain.", {
        storeDomain: normalized.domain,
        candidateDomain: result.canonical.domain,
        candidateId: result.candidateId
      });
    }
    attemptedCandidates += 1;
    const existing = records.get(result.candidateId);
    if (existing) {
      if (canonicalize(existing.canonicalForm) !== canonicalize(result.canonicalForm)) {
        fail("CANONICALIZATION_HASH_COLLISION", "Distinct canonical candidate bytes produced the same content identifier.", {
          candidateId: result.candidateId
        });
      }
      existing.duplicateCount += 1;
      duplicateCandidates += 1;
      return deepFreeze({
        status: "duplicate",
        candidateId: result.candidateId,
        duplicateCount: existing.duplicateCount,
        canonicalization: result
      });
    }

    if (records.size >= normalized.maxCandidates) {
      exhaustion = deepFreeze({
        budget: "maxCandidates",
        used: records.size,
        maximum: normalized.maxCandidates,
        firstExcludedCandidateId: result.candidateId,
        attemptedCandidates
      });
      state = "budget-exhausted";
      return deepFreeze({ status: "budget-exhausted", candidateId: result.candidateId, exhaustion });
    }

    records.set(result.candidateId, {
      candidateId: result.candidateId,
      skeletonId: result.skeletonId,
      candidate: result.candidate,
      canonicalForm: result.canonicalForm,
      duplicateCount: 0
    });
    return deepFreeze({
      status: "admitted",
      candidateId: result.candidateId,
      duplicateCount: 0,
      canonicalization: result
    });
  }

  function finalize() {
    if (state === "open") state = "complete";
    return snapshot();
  }

  function get(candidateId) {
    const record = records.get(candidateId);
    if (!record) return undefined;
    return deepFreeze({
      candidateId: record.candidateId,
      skeletonId: record.skeletonId,
      candidate: record.candidate,
      canonicalForm: record.canonicalForm,
      duplicateCount: record.duplicateCount
    });
  }

  return Object.freeze({
    add,
    finalize,
    get,
    snapshot,
    get domain() { return normalized.domain; },
    get size() { return records.size; },
    get status() { return state; }
  });
}
