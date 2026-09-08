// Prospective processed-export contrast. These helpers do not read biological
// traces, identify successful stimulations or reproduce the paper's classifier.
import { deepFreeze } from "@onto2d/kernel/canonical";

export const FUNCTIONAL_PROFILE = deepFreeze({
  id: "randi-processed-export-window-rank-v1", version: "1",
  input: "locked-randi-txt-exported-fluorescence",
  timeUnit: "second", timeStep: 0.5, baselineSeconds: 30, postSeconds: 30, samplesPerWindow: 60,
  baselineWindow: "[stimulus-time-30,stimulus-time)", postWindow: "[stimulus-time,stimulus-time+30)",
  baseline: "arithmetic-mean-strictly-positive", signed: "(mean(post)-mean(baseline))/mean(baseline)",
  magnitude: "absolute-signed-mean-contrast", interpolation: "none-added",
  zero: "exact-computed-zero-retained", residualMissing: "any-nonfinite-or-null-window-value-is-unobserved",
  nonpositiveBaseline: "not-applicable-with-nonpositive-baseline-reason",
  contamination: "any-other-native-stimulation-in-combined-half-open-window-including-negative-targets",
  duplicates: "exclude-every-row-sharing-a-stimulation-volume",
  stimulus: "nonnegative-native-target-index-not-proof-of-autoresponse",
  receiver: "distinct-from-source-with-accepted-exact-label-scope-mapping",
  aggregation: "median-trial-magnitude-within-recording-source-target-then-median-across-recordings",
  aggregationWeight: "one-recording-median-per-source-target-without-trial-count-weighting",
  evaluationGroup: "stimulated-source-neuron-across-all-recordings",
  claim: "held-out-source-neuron-processed-fluorescence-contrast-after-recorded-stimulation",
  limits: ["original-acquisition-missing-mask-not-exported", "finite-export-values-may-be-interpolated-upstream",
    "autoresponse-and-target-hit-flags-not-exported", "per-trace-matchless-provenance-not-exported",
    "label-confidence-and-negative-target-complementary-labels-not-exported",
    "unsmoothed-traces-and-unstimulated-control-distributions-not-exported",
    "paper-quality-filter-q-values-and-decay-correction-not-reproduced",
    "earlier-stimulation-carryover-not-eliminated", "animal-disjointness-not-established"],
  bounds: { timeRows: 20_000, stimulationRows: 20_000, aggregationRows: 100_000 },
  sources: {
    paper: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10632145/",
    paperSections: ["Calcium pre-processing", "Calcium imaging", "Inclusion criteria"],
    pumpprobe: { release: "v1.1", commit: "5ca97c72a3be2582c25a1ce307da7fc0c57ad7db",
      doi: "https://doi.org/10.5281/zenodo.8312985",
      export: "pumpprobe/Funatlas.py:279-309", contrast: "pumpprobe/Funatlas.py:1313-1404",
      exportBranch: "scripts/fconnectivity/funatlas_plot_intensity_map.py:73-102" },
    wormdatamodel: { release: "v1.0.1", commit: "8da607ce94d6fea90bf463db2482cbe6e14d5c5f",
      doi: "https://doi.org/10.5281/zenodo.8247252", preprocessing: "wormdatamodel/signal/signal.py:104-125,290-327,507-539" }
  }
});

const finite = value => typeof value === "number" && Number.isFinite(value);
const text = value => typeof value === "string" && value.length > 0;
const STATES = ["observed", "observed-zero", "unobserved", "not-applicable"];

function dense(values, name, maximum) {
  if (!Array.isArray(values) || values.length > maximum || Object.getOwnPropertySymbols(values).length ||
      Object.keys(values).length !== values.length || Object.keys(values).some((key, index) => key !== String(index))) {
    throw new Error(`${name} must be a bounded dense array without extra fields.`);
  }
}

/** Metadata eligibility only; receiver identity and signal quality are separate. */
export function eventEligibility(record, eventIndex) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Expected a native recording.");
  const times = record.time_coordinates, events = record.stimulations;
  dense(times, "Time coordinates", FUNCTIONAL_PROFILE.bounds.timeRows);
  dense(events, "Stimulation rows", FUNCTIONAL_PROFILE.bounds.stimulationRows);
  if (!Number.isSafeInteger(eventIndex) || eventIndex < 0 || eventIndex >= events.length ||
      events.some(event => !event || typeof event !== "object" || Array.isArray(event) ||
        !Number.isSafeInteger(event.volume_index) || !Number.isSafeInteger(event.native_neuron_index))) {
    throw new Error("Expected a native event index and integral stimulation coordinates.");
  }
  const event = events[eventIndex], volume = event.volume_index, reasons = [];
  if (!times.length || times.some((time, index) => !finite(time) || time !== index * FUNCTIONAL_PROFILE.timeStep)) {
    reasons.push("invalid-time-grid");
  }
  if (events.some(item => item.volume_index < 0 || item.volume_index >= times.length)) reasons.push("stimulation-volume-outside-recording");
  if (events.some(item => Object.hasOwn(item, "time_coordinate") && item.time_coordinate !== times[item.volume_index])) {
    reasons.push("stimulation-time-mismatch");
  }
  if (event.native_neuron_index < 0) reasons.push("negative-native-target-index");
  const duplicateEventIndices = events.flatMap((item, index) => index !== eventIndex && item.volume_index === volume ? [index] : []);
  if (duplicateEventIndices.length) reasons.push("duplicate-stimulation-volume");
  const samples = FUNCTIONAL_PROFILE.samplesPerWindow;
  if (volume < samples) reasons.push("incomplete-baseline-window");
  if (volume + samples > times.length) reasons.push("incomplete-post-window");
  // Use timestamp coordinates, including unidentified/failed-target source rows.
  // Incidental native row ordering must not hide an intervening stimulation.
  const timeSeconds = finite(times[volume]) ? times[volume] : null;
  const interferingEventIndices = timeSeconds === null ? [] : events.flatMap((item, index) => {
    const otherTime = times[item.volume_index];
    return index !== eventIndex && finite(otherTime) && otherTime >= timeSeconds - 30 && otherTime < timeSeconds + 30 ? [index] : [];
  });
  if (interferingEventIndices.length) reasons.push("another-stimulation-in-window");
  return deepFreeze({ profileId: FUNCTIONAL_PROFILE.id, eventIndex, volumeIndex: volume, timeSeconds,
    eligible: reasons.length === 0, reasons, duplicateEventIndices, interferingEventIndices,
    baseline: volume >= samples && volume <= times.length ? { startIndex: volume - samples, endIndexExclusive: volume } : null,
    post: volume >= 0 && volume + samples <= times.length ? { startIndex: volume, endIndexExclusive: volume + samples } : null });
}

function mean(values) {
  const scale = Math.max(...values.map(Math.abs));
  if (scale === 0) return 0;
  let sum = 0, compensation = 0;
  for (const value of values) {
    const normalized = value / scale, next = sum + normalized;
    if (value !== 0 && normalized === 0) return null;
    compensation += Math.abs(sum) >= Math.abs(normalized) ? (sum - next) + normalized : (normalized - next) + sum;
    sum = next;
  }
  const total = (sum + compensation) * scale;
  // Rescale a finite residual before division: dividing a subnormal normalized
  // residual first can erase a mean that is representable on the native scale.
  const result = finite(total) ? total / values.length : ((sum + compensation) / values.length) * scale;
  return result === 0 && sum + compensation !== 0 ? null : result;
}

/** Fixed 60+60 sample contrast; missingness never becomes measured zero. */
export function trialContrast(baselineValues, postValues) {
  for (const values of [baselineValues, postValues]) {
    dense(values, "Contrast window", FUNCTIONAL_PROFILE.samplesPerWindow);
    if (values.length !== FUNCTIONAL_PROFILE.samplesPerWindow || values.some(value => value !== null && typeof value !== "number")) {
      throw new Error("Contrast windows require exactly 60 numeric-or-null samples.");
    }
  }
  const missingCounts = { baseline: baselineValues.filter(value => !finite(value)).length,
    post: postValues.filter(value => !finite(value)).length };
  const unavailable = (state, reason, baselineMean = null, postMean = null) => deepFreeze({
    profileId: FUNCTIONAL_PROFILE.id, state, signed: null, magnitude: null,
    baselineMean, postMean, reason, missingCounts });
  if (missingCounts.baseline || missingCounts.post) return unavailable("unobserved", "nonfinite-or-missing-window-samples");
  const baselineMean = mean(baselineValues), postMean = mean(postValues);
  if (baselineMean === null || postMean === null) return unavailable("unobserved", "window-mean-underflow");
  if (!finite(baselineMean) || !finite(postMean)) return unavailable("unobserved", "nonfinite-window-mean");
  if (baselineMean <= 0) return unavailable("not-applicable", "nonpositive-baseline", baselineMean, postMean);
  const difference = postMean - baselineMean;
  const signed = finite(difference) ? difference / baselineMean : postMean / baselineMean - 1;
  if (!finite(signed)) return unavailable("unobserved", "nonfinite-relative-contrast", baselineMean, postMean);
  if (signed === 0 && postMean !== baselineMean) return unavailable("unobserved", "relative-contrast-underflow", baselineMean, postMean);
  return deepFreeze({ profileId: FUNCTIONAL_PROFILE.id, state: signed === 0 ? "observed-zero" : "observed",
    signed: signed === 0 ? 0 : signed, magnitude: Math.abs(signed), baselineMean, postMean, reason: null, missingCounts });
}

/** Numeric median; the caller handles empty/unavailable populations explicitly. */
export function median(values) {
  dense(values, "Median values", FUNCTIONAL_PROFILE.bounds.aggregationRows);
  if (!values.length || values.some(value => !finite(value))) throw new Error("Median requires nonempty finite numeric observations.");
  const sorted = [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0), middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 || sorted[middle - 1] === sorted[middle]) return sorted[middle] === 0 ? 0 : sorted[middle];
  const low = sorted[middle - 1], high = sorted[middle];
  const sum = low + high;
  const value = finite(sum) ? sum / 2 : low / 2 + high / 2;
  if (value === 0 && sum !== 0) {
    const error = new Error("Median underflow would erase a nonzero observation.");
    error.code = "FUNCTIONAL_MEDIAN_UNDERFLOW";
    throw error;
  }
  return value === 0 ? 0 : value;
}

function measuredMedian(values, emptyReason) {
  if (!values.length) return { magnitude: null, reason: emptyReason };
  try { return { magnitude: median(values), reason: null }; }
  catch (error) {
    if (error.code !== "FUNCTIONAL_MEDIAN_UNDERFLOW") throw error;
    return { magnitude: null, reason: "median-underflow" };
  }
}

function counts(rows) {
  const result = Object.fromEntries(STATES.map(state => [state, 0]));
  for (const row of rows) result[row.state] += 1;
  return result;
}

function reasonCounts(rows) {
  const result = new Map();
  for (const row of rows) if (row.reason !== null) result.set(row.reason, (result.get(row.reason) ?? 0) + 1);
  return Object.fromEntries([...result.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Closed rows: {recordingId, source, target, trialIndex, state, magnitude, reason}.
 * Retain unavailable coverage at each level; only measured magnitudes enter medians.
 * Scope/neuron mapping and eventEligibility are mandatory upstream responsibilities.
 */
export function aggregateResponses(rows) {
  dense(rows, "Functional response rows", FUNCTIONAL_PROFILE.bounds.aggregationRows);
  const fields = ["recordingId", "source", "target", "trialIndex", "state", "magnitude", "reason"];
  const seen = new Set(), recordingGroups = new Map(), eventSources = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.getOwnPropertySymbols(row).length ||
        Object.keys(row).length !== fields.length || fields.some(field => !Object.hasOwn(row, field)) ||
        ![row.recordingId, row.source, row.target].every(text) || row.source === row.target ||
        !Number.isSafeInteger(row.trialIndex) || row.trialIndex < 0 || !STATES.includes(row.state)) {
      throw new Error("Expected a closed off-target functional trial row.");
    }
    const observed = row.state === "observed" || row.state === "observed-zero";
    if (observed ? !finite(row.magnitude) || row.magnitude < 0 || row.reason !== null ||
        (row.magnitude === 0) !== (row.state === "observed-zero") : row.magnitude !== null || !text(row.reason)) {
      throw new Error("Functional trial state, magnitude and reason disagree.");
    }
    const trialKey = JSON.stringify([row.recordingId, row.source, row.target, row.trialIndex]);
    if (seen.has(trialKey)) throw new Error("Duplicate functional trial identity.");
    seen.add(trialKey);
    const eventKey = JSON.stringify([row.recordingId, row.trialIndex]);
    if (eventSources.has(eventKey) && eventSources.get(eventKey) !== row.source) throw new Error("One native stimulation row cannot have different sources.");
    eventSources.set(eventKey, row.source);
    const groupKey = JSON.stringify([row.recordingId, row.source, row.target]);
    if (!recordingGroups.has(groupKey)) recordingGroups.set(groupKey, []);
    recordingGroups.get(groupKey).push(row);
  }
  const recordingResponses = [...recordingGroups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, trials]) => {
    const values = trials.filter(row => row.magnitude !== null).map(row => row.magnitude);
    const { magnitude, reason } = measuredMedian(values, "no-eligible-measured-trials");
    return { recordingId: trials[0].recordingId, source: trials[0].source, target: trials[0].target,
      state: magnitude === null ? "unobserved" : magnitude === 0 ? "observed-zero" : "observed", magnitude,
      reason,
      trials: trials.length, measuredTrials: values.length, counts: counts(trials), reasonCounts: reasonCounts(trials),
      trialIndices: trials.map(row => row.trialIndex).sort((a, b) => a - b) };
  });
  const pairGroups = new Map();
  for (const row of recordingResponses) {
    const key = JSON.stringify([row.source, row.target]);
    if (!pairGroups.has(key)) pairGroups.set(key, []);
    pairGroups.get(key).push(row);
  }
  const responses = [...pairGroups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, recordings]) => {
    const values = recordings.filter(row => row.magnitude !== null).map(row => row.magnitude);
    const { magnitude, reason } = measuredMedian(values, "no-eligible-recording-medians");
    return { source: recordings[0].source, target: recordings[0].target,
      state: magnitude === null ? "unobserved" : magnitude === 0 ? "observed-zero" : "observed", magnitude,
      reason,
      recordings: recordings.length, measuredRecordings: values.length,
      trials: recordings.reduce((sum, row) => sum + row.trials, 0),
      measuredTrials: recordings.reduce((sum, row) => sum + row.measuredTrials, 0),
      recordingIds: recordings.map(row => row.recordingId).sort() };
  });
  return deepFreeze({ profileId: FUNCTIONAL_PROFILE.id, trialRows: rows.length, counts: counts(rows), reasonCounts: reasonCounts(rows),
    recordingResponses, responses });
}
