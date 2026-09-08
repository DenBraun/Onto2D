import { deepFreeze } from "@onto2d/kernel/canonical";

export const TASK_PROFILE = deepFreeze({
  id: "biological-task-availability-v1", version: "1",
  purpose: "source-availability-before-freezing-an-outcome-transform",
  states: ["observed", "observed-zero", "not-applicable", "unobserved", "rejected-transformation", "budget-failure"],
  measurement: "finite-native-scalar-in-explicit-domain-and-units",
  zero: "explicit-numeric-zero-only", missingness: "null-value-with-explicit-reason",
  comparison: "only-observed-values-in-the-same-domain-quantity-and-unit",
  pooling: "retain-network-recording-and-source-neuron-dependence",
  dream4: "directly-intervened-gene-excluded-from-primary-outcome",
  celegans: "trace-availability-does-not-certify-a-functional-response",
  graphProbes: "graph-edits-are-not-biological-interventions",
  flow: "retain-certified-stop-no-invented-tail",
  responseSignatureV0: "unchanged", scoring: "not-defined-by-this-profile"
});

export function observation(input) {
  const fields = ["domain", "quantity", "unit", "subject", "state", "value", "reason"];
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== fields.length ||
      fields.some(key => !Object.hasOwn(input, key)) || Object.keys(input).some(key => !fields.includes(key))) throw new Error("Expected a closed biological observation.");
  if (["domain", "quantity", "unit", "subject"].some(key => typeof input[key] !== "string" || !input[key].length) ||
      !TASK_PROFILE.states.includes(input.state)) throw new Error("Unknown observation domain or state.");
  const measured = input.state === "observed" || input.state === "observed-zero";
  if (measured) {
    if (typeof input.value !== "number" || !Number.isFinite(input.value) || input.reason !== null ||
        (input.value === 0) !== (input.state === "observed-zero")) throw new Error("Observed values require an exact zero state or a finite nonzero scalar.");
  } else if (input.value !== null || typeof input.reason !== "string" || !input.reason.length) throw new Error("Unavailable states require null and a reason.");
  return deepFreeze({ profileId: TASK_PROFILE.id, ...input });
}

export function availability(rows) {
  if (!Array.isArray(rows)) throw new Error("Coverage requires an explicit observation array.");
  const counts = Object.fromEntries(TASK_PROFILE.states.map(state => [state, 0])), subjects = new Set();
  for (const row of rows) {
    const { profileId, ...value } = row;
    if (profileId !== TASK_PROFILE.id) throw new Error("Observation profile mismatch.");
    observation(value);
    const key = JSON.stringify([row.domain, row.quantity, row.unit, row.subject]);
    if (subjects.has(key)) throw new Error("Duplicate observation in coverage population.");
    subjects.add(key); counts[row.state] += 1;
  }
  return { population: rows.length, applicable: rows.length - counts["not-applicable"],
    observed: counts.observed + counts["observed-zero"], counts };
}

export function comparable(left, right) {
  for (const row of [left, right]) {
    const { profileId, ...value } = row;
    if (profileId !== TASK_PROFILE.id) throw new Error("Observation profile mismatch.");
    observation(value);
  }
  return [left, right].every(row => ["observed", "observed-zero"].includes(row.state)) &&
    ["domain", "quantity", "unit"].every(key => left[key] === right[key]);
}

// Exact-label matches are cross-source candidates, never proof of same animal
// or an accepted functional outcome. No L/R expansion, typo correction or alias.
export function mapNeuronLabels(rawLabels, anatomyNodeIds) {
  if (!Array.isArray(rawLabels) || rawLabels.some(label => typeof label !== "string") ||
      !Array.isArray(anatomyNodeIds) || anatomyNodeIds.some(id => typeof id !== "string") ||
      new Set(anatomyNodeIds).size !== anatomyNodeIds.length) throw new Error("Expected explicit label and anatomy populations.");
  for (const values of [rawLabels, anatomyNodeIds]) {
    if (Object.keys(values).length !== values.length || Object.keys(values).some((key, index) => key !== String(index)) ||
        Object.getOwnPropertySymbols(values).length) throw new Error("Label and anatomy populations must be dense arrays without extra fields.");
  }
  const anatomy = new Set(anatomyNodeIds), labels = rawLabels.map(label => label.trim());
  const frequencies = new Map(); labels.forEach(label => frequencies.set(label, (frequencies.get(label) ?? 0) + 1));
  return rawLabels.map((rawLabel, columnIndex) => {
    const label = labels[columnIndex];
    const state = !/^[A-Z][A-Z0-9]*$/.test(label) ? "unidentified-or-marked" :
      frequencies.get(label) > 1 ? "ambiguous-within-recording" : anatomy.has(label) ? "exact-label-candidate" : "absent-from-anatomy";
    return { columnIndex, rawLabel, normalizedLabel: label, normalization: "outer-whitespace-only",
      state, anatomyNodeId: state === "exact-label-candidate" ? label : null };
  });
}
