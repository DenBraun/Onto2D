import assert from "node:assert/strict";
import test from "node:test";
import { aggregateResponses, eventEligibility, FUNCTIONAL_PROFILE, median, trialContrast } from "./functional.mjs";

const window = value => Array(60).fill(value);
const recording = (volumes = [120], neurons = volumes.map(() => 0), length = 300) => ({
  time_coordinates: Array.from({ length }, (_, index) => index * 0.5),
  stimulations: volumes.map((volume, index) => ({ volume_index: volume,
    native_neuron_index: neurons[index], time_coordinate: volume * 0.5 }))
});
const row = (recordingId, trialIndex, magnitude, changes = {}) => ({ recordingId, source: "AVAL", target: "AVAR",
  trialIndex, magnitude, state: magnitude === null ? "unobserved" : magnitude === 0 ? "observed-zero" : "observed",
  reason: magnitude === null ? "missing-window" : null, ...changes });

test("functional profile freezes adapted windows, source versions and missing-quality limits", () => {
  assert.equal(FUNCTIONAL_PROFILE.timeStep, 0.5);
  assert.equal(FUNCTIONAL_PROFILE.samplesPerWindow, 60);
  assert.equal(FUNCTIONAL_PROFILE.sources.pumpprobe.commit, "5ca97c72a3be2582c25a1ce307da7fc0c57ad7db");
  assert.ok(FUNCTIONAL_PROFILE.limits.includes("original-acquisition-missing-mask-not-exported"));
  assert.ok(FUNCTIONAL_PROFILE.limits.includes("animal-disjointness-not-established"));
  assert.ok(Object.isFrozen(FUNCTIONAL_PROFILE.sources));
  assert.ok(Object.isFrozen(FUNCTIONAL_PROFILE.limits));
});

test("event windows have exact half-open index boundaries and preserve native metadata", () => {
  const record = recording(), before = structuredClone(record);
  const result = eventEligibility(record, 0);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.timeSeconds, 60);
  assert.deepEqual(result.baseline, { startIndex: 60, endIndexExclusive: 120 });
  assert.deepEqual(result.post, { startIndex: 120, endIndexExclusive: 180 });
  assert.deepEqual(record, before);
  assert.ok(Object.isFrozen(result.baseline));
  assert.equal(eventEligibility(recording([60], [0], 120), 0).eligible, true);
});

test("event eligibility reports incomplete windows and unresolved target without coercion", () => {
  const early = eventEligibility(recording([59], [-2], 118), 0);
  assert.deepEqual(early.reasons, ["negative-native-target-index", "incomplete-baseline-window", "incomplete-post-window"]);
  assert.equal(early.baseline, null);
  assert.equal(early.post, null);
  for (const sentinel of [-1, -2, -3]) assert.equal(eventEligibility(recording([120], [sentinel]), 0).eligible, false);
});

test("all stimulation rows block overlapping windows including negative targets and out-of-order rows", () => {
  const result = eventEligibility(recording([150, 120], [-2, 0]), 1);
  assert.equal(result.eligible, false);
  assert.deepEqual(result.interferingEventIndices, [0]);
  assert.deepEqual(result.reasons, ["another-stimulation-in-window"]);
  assert.equal(eventEligibility(recording([59, 120, 180]), 1).eligible, true);
  const leftBoundary = eventEligibility(recording([60, 120, 180]), 1);
  assert.deepEqual(leftBoundary.interferingEventIndices, [0]);
});

test("every row sharing a stimulation volume is rejected and native rows are not deduplicated", () => {
  const record = recording([120, 200, 120], [0, 1, -2]);
  assert.deepEqual(eventEligibility(record, 0).duplicateEventIndices, [2]);
  assert.deepEqual(eventEligibility(record, 2).duplicateEventIndices, [0]);
  assert.ok(eventEligibility(record, 0).reasons.includes("duplicate-stimulation-volume"));
  assert.ok(eventEligibility(record, 2).reasons.includes("negative-native-target-index"));
  assert.equal(eventEligibility(record, 1).eligible, true);
});

test("malformed grids and inconsistent native coordinates never qualify", () => {
  for (const replacement of [NaN, Infinity, 1.25]) {
    const record = recording(); record.time_coordinates[2] = replacement;
    assert.ok(eventEligibility(record, 0).reasons.includes("invalid-time-grid"));
  }
  const mismatch = recording(); mismatch.stimulations[0].time_coordinate = 61;
  assert.ok(eventEligibility(mismatch, 0).reasons.includes("stimulation-time-mismatch"));
  assert.ok(eventEligibility(recording([300]), 0).reasons.includes("stimulation-volume-outside-recording"));
  assert.throws(() => eventEligibility(recording(), -1));
  assert.throws(() => eventEligibility(recording([120.5]), 0));
  const sparse = recording(); delete sparse.time_coordinates[1];
  assert.throws(() => eventEligibility(sparse, 0), /dense/);
});

test("fixed contrast preserves signed inhibition, magnitudes and exact observed zero", () => {
  for (const [baseline, post, signed] of [[2, 3, 0.5], [2, 1, -0.5], [2, 2, 0], [2, 0, -1]]) {
    const result = trialContrast(window(baseline), window(post));
    assert.equal(result.signed, signed);
    assert.equal(result.magnitude, Math.abs(signed));
    assert.equal(result.state, signed === 0 ? "observed-zero" : "observed");
    assert.equal(result.reason, null);
    assert.deepEqual(result.missingCounts, { baseline: 0, post: 0 });
    assert.ok(Object.isFrozen(result));
  }
  // The quantity is abs(mean response), not mean(abs response).
  assert.equal(trialContrast(window(2), [...Array(30).fill(1), ...Array(30).fill(3)]).magnitude, 0);
});

test("residual null/NaN/infinity windows are unobserved and never measured zero", () => {
  for (const missing of [null, NaN, Infinity, -Infinity]) {
    const pre = window(2), post = window(3); pre[0] = missing; post[59] = missing;
    const result = trialContrast(pre, post);
    assert.equal(result.state, "unobserved");
    assert.equal(result.signed, null);
    assert.equal(result.magnitude, null);
    assert.equal(result.reason, "nonfinite-or-missing-window-samples");
    assert.deepEqual(result.missingCounts, { baseline: 1, post: 1 });
  }
});

test("nonpositive baseline and numerical overflow remain explicit unavailable states", () => {
  for (const baseline of [0, -2]) {
    const result = trialContrast(window(baseline), window(3));
    assert.equal(result.state, "not-applicable");
    assert.equal(result.reason, "nonpositive-baseline");
    assert.equal(result.magnitude, null);
  }
  assert.equal(trialContrast(window(Number.MIN_VALUE), window(Number.MAX_VALUE)).reason, "nonfinite-relative-contrast");
  assert.equal(trialContrast(window(Number.MAX_VALUE), window(-Number.MAX_VALUE)).signed, -2);
  assert.equal(trialContrast(window(Number.MIN_VALUE), window(Number.MIN_VALUE)).state, "observed-zero");
});

test("window normalization cannot erase a finite residual and manufacture observed zero", () => {
  const post = [Number.MAX_VALUE, -Number.MAX_VALUE, 1e-100, ...Array(57).fill(0)];
  const result = trialContrast(window(1e-102), post);
  assert.equal(result.state, "unobserved");
  assert.equal(result.reason, "window-mean-underflow");
  assert.equal(result.magnitude, null);
  assert.equal(result.postMean, null);
  // A nonzero mean below binary64 range must also stay unavailable.
  assert.equal(trialContrast(window(1), [Number.MIN_VALUE, ...Array(59).fill(0)]).reason, "window-mean-underflow");
  assert.equal(trialContrast(window(1), window(0)).magnitude, 1);
});

test("contrast rejects sparse, wrong-length and coerced numeric windows", () => {
  const sparse = window(1); delete sparse[2];
  for (const bad of [[], Array(59).fill(1), Array(61).fill(1), sparse,
    [...Array(59).fill(1), "1"], [...Array(59).fill(1), undefined]]) {
    assert.throws(() => trialContrast(bad, window(1)));
  }
});

test("median uses finite dense inputs without mutating order or overflowing large middle values", () => {
  const input = [9, 1, 3]; assert.equal(median(input), 3); assert.deepEqual(input, [9, 1, 3]);
  assert.equal(median([4, 2]), 3);
  assert.equal(median([Number.MAX_VALUE, Number.MAX_VALUE]), Number.MAX_VALUE);
  assert.equal(median([-Number.MAX_VALUE, Number.MAX_VALUE]), 0);
  assert.equal(median([Number.MIN_VALUE, 2 * Number.MIN_VALUE]), 2 * Number.MIN_VALUE);
  for (const values of [[-Number.MIN_VALUE, 0], [0, Number.MIN_VALUE]]) {
    assert.throws(() => median(values), { code: "FUNCTIONAL_MEDIAN_UNDERFLOW" });
  }
  for (const bad of [[], [null], [NaN], [Infinity], ["1"], new Array(1)]) assert.throws(() => median(bad));
});

test("aggregation gives recordings equal weight despite unequal trial counts", () => {
  const rows = [...Array.from({ length: 9 }, (_, index) => row("recording-a", index, 0)), row("recording-b", 0, 1)];
  const before = structuredClone(rows), result = aggregateResponses(rows);
  assert.equal(result.responses[0].magnitude, 0.5);
  assert.equal(result.responses[0].measuredRecordings, 2);
  assert.equal(result.responses[0].measuredTrials, 10);
  assert.equal(result.recordingResponses[0].magnitude, 0);
  assert.equal(result.recordingResponses[1].magnitude, 1);
  assert.deepEqual(aggregateResponses([...rows].reverse()), result);
  assert.deepEqual(rows, before);
  assert.ok(Object.isFrozen(result.responses[0]));
});

test("aggregation retains unavailable-only populations and distinguishes zeros from missing rows", () => {
  const result = aggregateResponses([row("a", 0, null), row("b", 0, 0), row("c", 0, null, { target: "AVEL" }),
    row("c", 1, null, { target: "AVEL", state: "not-applicable", reason: "nonpositive-baseline" })]);
  assert.equal(result.responses[0].state, "observed-zero");
  assert.equal(result.responses[0].recordings, 2);
  assert.equal(result.responses[0].measuredRecordings, 1);
  assert.equal(result.responses[1].magnitude, null);
  assert.equal(result.responses[1].reason, "no-eligible-recording-medians");
  assert.deepEqual(result.counts, { observed: 0, "observed-zero": 1, unobserved: 2, "not-applicable": 1 });
  assert.deepEqual(result.reasonCounts, { "missing-window": 2, "nonpositive-baseline": 1 });
  assert.deepEqual(aggregateResponses([]).responses, []);
});

test("median underflow stays unavailable at both recording and cross-recording aggregation levels", () => {
  const withinRecording = aggregateResponses([row("a", 0, 0), row("a", 1, Number.MIN_VALUE)]);
  assert.equal(withinRecording.recordingResponses[0].state, "unobserved");
  assert.equal(withinRecording.recordingResponses[0].magnitude, null);
  assert.equal(withinRecording.recordingResponses[0].reason, "median-underflow");
  assert.equal(withinRecording.recordingResponses[0].measuredTrials, 2);
  assert.equal(withinRecording.responses[0].measuredRecordings, 0);
  assert.equal(withinRecording.responses[0].magnitude, null);
  const rows = [row("a", 0, 0), row("b", 0, Number.MIN_VALUE)];
  const acrossRecordings = aggregateResponses(rows);
  assert.equal(acrossRecordings.responses[0].state, "unobserved");
  assert.equal(acrossRecordings.responses[0].magnitude, null);
  assert.equal(acrossRecordings.responses[0].reason, "median-underflow");
  assert.equal(acrossRecordings.responses[0].measuredRecordings, 2);
  assert.equal(acrossRecordings.responses[0].measuredTrials, 2);
  assert.deepEqual(aggregateResponses([...rows].reverse()), acrossRecordings);
});

test("aggregation rejects duplicate trial identities, invalid states and contradictory values", () => {
  assert.throws(() => aggregateResponses([row("a", 0, 1), row("a", 0, 2)]), /Duplicate/);
  assert.throws(() => aggregateResponses([row("a", 0, 1), row("a", 0, 1, { source: "AVEL" })]), /different sources/);
  for (const changes of [{ state: "observed-zero" }, { magnitude: NaN }, { magnitude: -1 }, { reason: "missing" },
    { trialIndex: -1 }, { source: "AVAR" }, { state: "unknown" }, { extra: true }]) {
    assert.throws(() => aggregateResponses([row("a", 0, 1, changes)]));
  }
  assert.throws(() => aggregateResponses([row("a", 0, null, { state: "observed" })]));
});
