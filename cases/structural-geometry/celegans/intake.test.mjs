import assert from "node:assert/strict";
import test from "node:test";
import { mapNeuronLabels } from "../datasets/task-profile.mjs";
import { prepareFunctionalPopulation } from "../protocol/populations.mjs";
import { planWindows, extractResponses, matchedPopulation } from "./intake.mjs";

function control(rawLabels = [" S ", "T", "U", "V", "Z", "unidentified"]) {
  const parent = ["S", "T", "U", "V", "Z"], scopes = parent.map(source => ({ anatomyId: "Dataset7", source,
    nodeIds: source === "S" ? ["S", "T", "U", "V"] : [source], eligible: true, reason: null }));
  const recordings = [0, 1].map(index => ({ recording_id: `r${index}`, recording_index: index,
    labels: [...rawLabels.map((raw_label, column_index) => ({ raw_label, column_index })), { raw_label: " ", column_index: null }],
    traces: { columns: rawLabels.length, rows: 300 }, time_coordinates: Array.from({ length: 300 }, (_, i) => i / 2),
    stimulations: [{ trial_index: 0, native_stimulation_row_index: 0, volume_index: 120, native_neuron_index: 0, column_index: 0 }] }));
  const mappings = recordings.map(record => ({ recordingId: record.recording_id, labels: mapNeuronLabels(rawLabels, parent) }));
  return { parent, scopes, recordings, mappings };
}
const plan = value => planWindows(value.recordings, value.parent, value.scopes, value.mappings);
const windows = value => value.requests.map((request, i) => ({ id: request.id, baseline: Array(60).fill(10), post: Array(60).fill(10 + i % 3) }));

test("intake accounts for every event, trace column and absent anatomical receiver", () => {
  const value = control(), original = structuredClone(value), prepared = plan(value);
  assert.deepEqual(value, original);
  assert.equal(prepared.events.length, 2); assert.equal(prepared.summary.eligibleEvents, 2);
  assert.equal(prepared.summary.unboundLabelSlots, 2);
  assert.equal(prepared.requests.length, 6);
  assert.equal(prepared.receivers.length, 12);
  assert.equal(prepared.receivers.filter(row => row.reason === "directly-stimulated-receiver").length, 2);
  assert.equal(prepared.receivers.filter(row => row.reason === "receiver-outside-rooted-scope").length, 2);
  assert.ok(Object.isFrozen(prepared.requests[0]));
});

test("ambiguous receiver labels have no accepted column and never produce a measured zero", () => {
  const value = control(["S", "T", "U", "U", "V"]), prepared = plan(value);
  assert.equal(prepared.requests.length, 4);
  assert.equal(prepared.receivers.filter(row => row.reason === "receiver-mapping:ambiguous-within-recording").length, 4);
  const response = extractResponses(prepared, windows(prepared));
  const missing = response.trials.filter(row => row.target === "U");
  assert.equal(missing.length, 2);
  assert.ok(missing.every(row => row.state === "unobserved" && row.magnitude === null));
  const population = prepareFunctionalPopulation(response.trials, value.scopes);
  assert.equal(population.status, "unavailable");
  assert.equal(population.groups.find(group => group.id === "S").eligibleReceiverCount, 2);
});

test("negative-index events still contaminate accepted mapped stimulation windows", () => {
  const value = control();
  value.recordings[0].stimulations.push({ trial_index: 1, native_stimulation_row_index: 1,
    volume_index: 130, native_neuron_index: -1, column_index: null });
  const prepared = plan(value);
  assert.equal(prepared.summary.nativeEvents, 3);
  assert.equal(prepared.summary.eligibleEvents, 1);
  assert.equal(prepared.events[0].reason, "window-ineligible");
  assert.ok(prepared.events[0].window.reasons.includes("another-stimulation-in-window"));
  assert.equal(prepared.events[1].reason, "negative-native-target-index");
  assert.ok(prepared.requests.every(row => row.recordingId === "r1"));
});

test("mapping and scope changes cannot silently change the accepted source population", () => {
  const value = control(); value.mappings[0].labels[1].anatomyNodeId = "Z";
  assert.throws(() => plan(value));
  const missingRoot = control(); missingRoot.scopes.pop();
  assert.throws(() => plan(missingRoot));
  const excluded = control(); Object.assign(excluded.scopes[0], { eligible: false, reason: "provider-bound" });
  const prepared = plan(excluded);
  assert.equal(prepared.requests.length, 0);
  assert.ok(prepared.events.every(row => row.reason === "root-scope-ineligible"));
});

test("sample missingness, measured zero and nonpositive baselines retain different states", () => {
  const prepared = plan(control()), returned = windows(prepared);
  returned[1].post[17] = null;
  returned[2].baseline.fill(0);
  const result = extractResponses(prepared, returned);
  assert.equal(result.contrasts[0].state, "observed-zero"); assert.equal(result.contrasts[0].magnitude, 0);
  assert.equal(result.contrasts[1].state, "unobserved"); assert.equal(result.contrasts[1].magnitude, null);
  assert.equal(result.contrasts[2].state, "not-applicable"); assert.equal(result.contrasts[2].reason, "nonpositive-baseline");
  assert.throws(() => extractResponses(prepared, returned.slice(1)));
  assert.throws(() => extractResponses(prepared, [returned[0], ...returned.slice(0, -1)]));
});

test("insufficient source groups and failed required geometry retain null eligibility", () => {
  const value = control(), prepared = plan(value), response = extractResponses(prepared, windows(prepared));
  const geometry = value.scopes.map(scope => ({ source: scope.source, status: "unavailable", reason: "test-bound" }));
  const result = matchedPopulation(response.trials, value.scopes, geometry);
  assert.equal(result.population.coverage.eligibleGroups, 1);
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "required-geometry-computation-failed");
  assert.equal(result.rows.length, 3);
  assert.ok(result.rows.every(row => row.x === null));
});
