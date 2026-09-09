import assert from "node:assert/strict";
import { deepFreeze } from "@onto2d/kernel/canonical";
import { eventEligibility, trialContrast, FUNCTIONAL_PROFILE } from "../protocol/functional.mjs";
import { prepareFunctionalPopulation } from "../protocol/populations.mjs";
import { mapNeuronLabels } from "../datasets/task-profile.mjs";
import { GEOMETRY_FEATURE_NAMES, PROFILE_ID } from "../dream4/geometry.mjs";

export const INTAKE_ID = "celegans-source-bound-window-intake-v1";
const count = (rows, key) => Object.fromEntries([...new Set(rows.map(row => row[key]))].sort()
  .map(value => [value, rows.filter(row => row[key] === value).length]));
const key = (recordingId, trialIndex, target) => JSON.stringify([recordingId, trialIndex, target]);

/** All events receive a primary exclusion; receiver ledgers are conditional on
 * eligible metadata events. No trace value enters this topology/mapping plan. */
export function planWindows(recordings, parentNodes, scopes, mappings) {
  assert.ok(recordings.length > 0 && recordings.length <= 113);
  assert.ok(parentNodes.length > 0 && parentNodes.length <= 512);
  assert.ok(recordings.every(record => record.labels.length <= 20000 && record.traces.columns <= 1024));
  assert.ok(recordings.reduce((sum, record) => sum + record.stimulations.length, 0) <= 20000);
  assert.equal(new Set(recordings.map(row => row.recording_id)).size, recordings.length);
  assert.deepEqual(scopes.map(scope => scope.source).sort(), [...parentNodes].sort());
  assert.equal(new Set(scopes.map(scope => scope.source)).size, parentNodes.length);
  const roots = new Map(scopes.map(scope => [scope.source, scope]));
  const mappingById = new Map(mappings.map(row => [row.recordingId, row]));
  assert.equal(mappingById.size, recordings.length); assert.equal(mappings.length, recordings.length);
  const events = [], receivers = [], requests = [], labels = [];
  for (const record of recordings) {
    const columns = record.labels.filter(row => row.column_index !== null);
    assert.equal(columns.length, record.traces.columns);
    assert.ok(columns.every((row, i) => row.column_index === i));
    const mapped = mapNeuronLabels(columns.map(row => row.raw_label), parentNodes);
    assert.deepEqual(mapped, mappingById.get(record.recording_id)?.labels, "D2 label mapping differs from native source columns.");
    const byNeuron = new Map(mapped.filter(row => row.state === "exact-label-candidate").map(row => [row.anatomyNodeId, row.columnIndex]));
    labels.push({ recordingId: record.recording_id, columns: mapped,
      unboundLabelSlots: record.labels.filter(row => row.column_index === null) });
    for (const [index, native] of record.stimulations.entries()) {
      assert.equal(native.trial_index, index); assert.equal(native.native_stimulation_row_index, index);
      assert.equal(native.column_index, native.native_neuron_index < 0 ? null : native.native_neuron_index);
      if (native.column_index !== null) assert.ok(native.column_index < mapped.length);
      const sourceMapping = native.column_index === null ? null : mapped[native.column_index];
      const source = sourceMapping?.anatomyNodeId ?? null, scope = roots.get(source);
      const window = eventEligibility(record, index);
      const reason = native.native_neuron_index < 0 ? "negative-native-target-index" :
        sourceMapping?.state !== "exact-label-candidate" ? `source-mapping:${sourceMapping?.state ?? "missing-column"}` :
          !scope?.eligible ? "root-scope-ineligible" : !window.eligible ? "window-ineligible" : null;
      events.push({ recordingId: record.recording_id, trialIndex: index, source, volumeIndex: native.volume_index,
        nativeNeuronIndex: native.native_neuron_index, sourceMappingState: sourceMapping?.state ?? "native-negative-sentinel",
        eligible: reason === null, reason, window });
      if (reason !== null) continue;
      if (receivers.length + mapped.length + scope.nodeIds.length > 100000 ||
          (requests.length + scope.nodeIds.length - 1) * 120 > 2000000) throw new Error("Complete functional intake exceeds its bounded ledger.");
      // Account for every real trace column, including direct, ambiguous and
      // outside-scope receivers. Unbound trailing slots remain in labels above.
      for (const label of mapped) {
        const target = label.anatomyNodeId;
        const receiverReason = label.state !== "exact-label-candidate" ? `receiver-mapping:${label.state}` :
          target === source ? "directly-stimulated-receiver" : !scope.nodeIds.includes(target) ? "receiver-outside-rooted-scope" : null;
        receivers.push({ recordingId: record.recording_id, trialIndex: index, columnIndex: label.columnIndex,
          source, target, state: receiverReason === null ? "window-requested" : "excluded", reason: receiverReason });
      }
      // Retain each anatomical receiver even when this recording has no
      // operationally accepted column for it; such absence is not measured zero.
      for (const target of scope.nodeIds.filter(node => node !== source).sort()) {
        const columnIndex = byNeuron.get(target) ?? null, id = key(record.recording_id, index, target);
        if (columnIndex === null) {
          receivers.push({ recordingId: record.recording_id, trialIndex: index, columnIndex: null,
            source, target, state: "unobserved", reason: "no-accepted-receiver-column" });
        } else requests.push({ id, recordingId: record.recording_id, recordingIndex: record.recording_index,
          trialIndex: index, source, target, columnIndex, baseline: window.baseline, post: window.post });
      }
    }
  }
  if (events.length > 20000 || receivers.length > 100000 || requests.length * 120 > 2000000) throw new Error("Complete functional intake exceeds its bounded ledger.");
  return deepFreeze({ id: INTAKE_ID, targetProfileId: FUNCTIONAL_PROFILE.id, events, receivers, requests, labels,
    summary: { recordings: recordings.length, nativeEvents: events.length, eligibleEvents: events.filter(row => row.eligible).length,
      eventExclusions: count(events.filter(row => !row.eligible), "reason"), receiverRows: receivers.length,
      receiverStates: count(receivers, "state"), receiverReasons: count(receivers.filter(row => row.reason !== null), "reason"),
      requestedWindows: requests.length, requestedSamples: requests.length * 120,
      unboundLabelSlots: labels.reduce((sum, row) => sum + row.unboundLabelSlots.length, 0) } });
}

export function extractResponses(plan, windows) {
  assert.equal(plan.id, INTAKE_ID);
  assert.equal(windows.length, plan.requests.length, "Every requested window must be returned.");
  const byId = new Map(windows.map(row => [row.id, row]));
  assert.equal(byId.size, windows.length, "Duplicate returned window.");
  const trials = [], contrasts = [];
  for (const request of plan.requests) {
    const window = byId.get(request.id);
    assert.ok(window, "A requested window is absent.");
    assert.deepEqual(Object.keys(window).sort(), ["baseline", "id", "post"]);
    const contrast = trialContrast(window.baseline, window.post);
    contrasts.push({ id: request.id, ...contrast });
    trials.push({ recordingId: request.recordingId, trialIndex: request.trialIndex, source: request.source,
      target: request.target, state: contrast.state, magnitude: contrast.magnitude, reason: contrast.reason });
  }
  for (const receiver of plan.receivers.filter(row => row.columnIndex === null)) {
    trials.push({ recordingId: receiver.recordingId, trialIndex: receiver.trialIndex, source: receiver.source,
      target: receiver.target, state: "unobserved", magnitude: null, reason: receiver.reason });
  }
  trials.sort((a, b) => key(a.recordingId, a.trialIndex, a.target) < key(b.recordingId, b.trialIndex, b.target) ? -1 : 1);
  return { trials, contrasts };
}

export function matchedPopulation(trials, scopes, geometry) {
  // Preparation is source-only; target eligibility is then fixed across every
  // ablation. A failed required numerical computation invalidates the primary,
  // rather than removing its source after observing a model's score.
  const population = prepareFunctionalPopulation(trials, scopes);
  const bySource = new Map(geometry.map(row => [row.source, row]));
  assert.equal(bySource.size, geometry.length);
  assert.deepEqual([...bySource.keys()].sort(), scopes.filter(scope => scope.eligible).map(scope => scope.source).sort());
  const failures = geometry.filter(row => row.status !== "complete").map(row => ({ source: row.source, reason: row.reason }));
  const rows = population.rows.filter(row => row.eligible).map(row => {
    const evidence = bySource.get(row.source);
    if (evidence.status !== "complete") return { ...row, x: null };
    assert.equal(evidence.geometry.profileId, PROFILE_ID);
    assert.deepEqual(evidence.geometry.featureNames, GEOMETRY_FEATURE_NAMES);
    const pairs = evidence.geometry.pairs.filter(pair => pair.source === row.source && pair.target === row.target);
    assert.equal(pairs.length, 1, "Expected one verified source/receiver geometry pair.");
    return { ...row, x: [...pairs[0].baseline, ...pairs[0].geometry] };
  });
  return { population, rows, failures, status: failures.length ? "unavailable" : population.status,
    reason: failures.length ? "required-geometry-computation-failed" : population.reason };
}
