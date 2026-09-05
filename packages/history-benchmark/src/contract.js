import { canonicalClone, deepFreeze, hashCanonical, isContentHash } from "@onto2d/kernel/canonical";

export const HISTORY_BENCHMARK_VERSION = "1";
export const HISTORY_BENCHMARK_VERDICTS = Object.freeze([
  "positive", "negative", "neutral-within-resolution", "indeterminate", "invalid", "not-evaluated"
]);
export const HISTORY_BENCHMARK_STATUSES = Object.freeze([
  "NOT_ELIGIBLE", "ILLUSTRATIVE", "CONTRACT_DRAFT", "CONTRAST_READY",
  "EVALUATION_READY", "EVALUATED", "REPLICATED", "REVIEWED"
]);

export class HistoryBenchmarkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HistoryBenchmarkError";
    this.code = code;
  }
}

export function requireValue(condition, code, message) {
  if (!condition) throw new HistoryBenchmarkError(code, message);
}

export function closed(value, keys, label) {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), "SHAPE", `${label} must be an object.`);
  requireValue(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)),
    "SHAPE", `${label} must contain exactly: ${keys.join(", ")}.`);
}

export function nonempty(value, label) {
  requireValue(typeof value === "string" && value.trim() === value && value.length > 0, "SHAPE", `${label} must be a nonempty normalized string.`);
}

export function integer(value, minimum, maximum, label) {
  requireValue(Number.isSafeInteger(value) && value >= minimum && value <= maximum, "SHAPE", `${label} must be an integer in [${minimum}, ${maximum}].`);
}

export function nullTrialBudget(input, requestedTrials) {
  const options = canonicalClone(input);
  requireValue(options !== null && typeof options === "object" && !Array.isArray(options), "SHAPE", "Execution options must be a plain object.");
  requireValue(Object.keys(options).every((key) => key === "maxNullTrials"), "SHAPE", "Unknown execution option.");
  const budget = Object.hasOwn(options, "maxNullTrials") ? options.maxNullTrials : requestedTrials;
  integer(budget, 0, 256, "maxNullTrials");
  return budget;
}

export function contentHash(kind, value) {
  return hashCanonical(`onto2d:history-benchmark-${kind}:v1`, value);
}

export function compareIds(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validateHistoryBenchmarkContract(input) {
  const c = canonicalClone(input);
  closed(c, ["schemaVersion", "benchmarkId", "caseId", "claimClass", "designClass", "historyMode", "effect",
    "population", "cutoffPolicy", "presentView", "historyView", "targetView", "selectionPolicy", "splitPolicy",
    "evaluator", "primaryMetric", "nullModel", "bindings", "sources", "interpretationBoundary"], "contract");
  requireValue(c.schemaVersion === "1", "VERSION", "Unsupported benchmark contract version.");
  for (const field of ["benchmarkId", "caseId", "population", "presentView", "historyView", "targetView", "interpretationBoundary"]) nonempty(c[field], field);
  requireValue(["synthetic", "semantic", "normative"].includes(c.claimClass), "UNSUPPORTED_CLAIM", "This pilot supports synthetic and exact semantic/normative contrasts only.");
  requireValue(c.designClass === (c.claimClass === "synthetic" ? "synthetic-control" : "exact"), "UNSUPPORTED_DESIGN", "Design does not match the claim class.");
  requireValue(["recorded", "embodied", "reconstructed"].includes(c.historyMode), "SHAPE", "Unknown history mode.");
  requireValue(["identity", "present-state", "future"].includes(c.effect), "SHAPE", "Unknown history effect.");
  requireValue(c.cutoffPolicy === "per-unit-ordinal", "UNSUPPORTED_CUTOFF", "Only explicit per-unit observation ordinals are supported.");
  closed(c.selectionPolicy, ["strategy", "targetBlind"], "selectionPolicy");
  requireValue(c.selectionPolicy.strategy === "complete-source-population" && c.selectionPolicy.targetBlind === true,
    "SELECTION_LEAKAGE", "Selection must include the complete declared source population without target access.");
  requireValue(c.splitPolicy === "complete-census", "UNSUPPORTED_SPLIT", "This evaluator uses a census, with no fitted model or held-out predictive claim.");
  closed(c.evaluator, ["id", "version", "implementationHash"], "evaluator");
  requireValue(c.evaluator.id === "identity-partition-v1" && c.evaluator.version === "1", "UNSUPPORTED_EVALUATOR", "Unsupported evaluator identity.");
  requireValue(isContentHash(c.evaluator.implementationHash), "SHAPE", "Evaluator implementation must be content-bound.");
  closed(c.primaryMetric, ["id", "direction", "resolution"], "primaryMetric");
  requireValue(c.primaryMetric.id === "pairwise-error" && c.primaryMetric.direction === "lower-is-better", "UNSUPPORTED_METRIC", "Only oriented pairwise error is supported.");
  requireValue(Number.isFinite(c.primaryMetric.resolution) && c.primaryMetric.resolution >= 0 && c.primaryMetric.resolution <= 1,
    "SHAPE", "Metric resolution must be in [0, 1].");
  closed(c.nullModel, ["id", "seed", "trials", "role"], "nullModel");
  requireValue(c.nullModel.id === "history-permutation-v1", "UNSUPPORTED_NULL", "Unsupported null model.");
  integer(c.nullModel.seed, 0, 4294967295, "nullModel.seed");
  integer(c.nullModel.trials, 1, 256, "nullModel.trials");
  requireValue(["diagnostic", "require-better-than-null-mean"].includes(c.nullModel.role), "SHAPE", "Unknown null role.");
  closed(c.bindings, ["observationsHash", "targetsHash", "builderHash"], "bindings");
  for (const hash of Object.values(c.bindings)) requireValue(isContentHash(hash), "SHAPE", "Every input/builder binding must be a content hash.");
  requireValue(Array.isArray(c.sources) && c.sources.length > 0, "SHAPE", "At least one source lock is required.");
  const paths = new Set();
  for (const source of c.sources) {
    closed(source, ["path", "sha256"], "source");
    nonempty(source.path, "source.path");
    requireValue(!source.path.startsWith("/") && !/[:\\\u0000-\u001f]/.test(source.path) && !source.path.split("/").some((part) => ["", ".", ".."].includes(part)), "SOURCE_PATH", "Source paths must be repository-relative without drive prefixes, backslashes or control characters.");
    requireValue(!paths.has(source.path) && isContentHash(source.sha256), "SOURCE_BINDING", "Source paths must be unique and hash-bound.");
    paths.add(source.path);
  }
  c.sources.sort((a, b) => compareIds(a.path, b.path));
  return deepFreeze(c);
}

export function normalizeObservations(input) {
  const observations = canonicalClone(input);
  closed(observations, ["schemaVersion", "units"], "observations");
  requireValue(observations.schemaVersion === "1" && Array.isArray(observations.units), "SHAPE", "Invalid observations envelope.");
  integer(observations.units.length, 1, 256, "population size");
  const ids = new Set();
  for (const unit of observations.units) {
    closed(unit, ["unitId", "cutoff", "present", "history"], "unit");
    nonempty(unit.unitId, "unitId");
    requireValue(!ids.has(unit.unitId), "DUPLICATE_UNIT", `Duplicate unit ${unit.unitId}.`);
    ids.add(unit.unitId);
    integer(unit.cutoff, 0, Number.MAX_SAFE_INTEGER, "cutoff");
    requireValue(Array.isArray(unit.history) && unit.history.length > 0 && unit.history.length <= 1024, "SHAPE", "History must have 1–1024 events.");
    for (const record of [unit.present, ...unit.history]) {
      closed(record, ["time", "value"], "observation");
      integer(record.time, 0, Number.MAX_SAFE_INTEGER, "observation.time");
      nonempty(record.value, "observation.value");
    }
  }
  observations.units.sort((a, b) => compareIds(a.unitId, b.unitId));
  return deepFreeze(observations);
}

export function normalizeTargets(input) {
  const targets = canonicalClone(input);
  closed(targets, ["schemaVersion", "records"], "targets");
  requireValue(targets.schemaVersion === "1" && Array.isArray(targets.records), "SHAPE", "Invalid targets envelope.");
  integer(targets.records.length, 1, 256, "target count");
  const ids = new Set();
  for (const row of targets.records) {
    closed(row, ["unitId", "time", "label"], "target");
    nonempty(row.unitId, "target.unitId");
    requireValue(!ids.has(row.unitId), "DUPLICATE_TARGET", `Duplicate target ${row.unitId}.`);
    ids.add(row.unitId);
    integer(row.time, 0, Number.MAX_SAFE_INTEGER, "target.time");
    if (row.label !== null) nonempty(row.label, "target.label");
  }
  targets.records.sort((a, b) => compareIds(a.unitId, b.unitId));
  return deepFreeze(targets);
}
