import { canonicalize } from "@onto2d/kernel/canonical";
import { compareIds, contentHash } from "./contract.js";

// Unit IDs and absolute observation ordinals never enter an identity feature.
// Temporal order of history values does; P is identical in P0, P1 and N0.
export function partitionKeys(units, donors = units) {
  return {
    presentOnly: units.map((unit) => canonicalize(unit.present.value)),
    presentPlusHistory: units.map((unit, index) => canonicalize([
      unit.present.value, donors[index].history.map((event) => event.value)
    ]))
  };
}

export function pairwiseError(keys, labels) {
  let errors = 0;
  let pairs = 0;
  for (let left = 0; left < keys.length; left += 1) {
    for (let right = left + 1; right < keys.length; right += 1) {
      pairs += 1;
      if ((keys[left] === keys[right]) !== (labels[left] === labels[right])) errors += 1;
    }
  }
  return { errors, pairs, value: pairs === 0 ? null : errors / pairs };
}

// A deterministic diagnostic ensemble, not uniform random sampling or a p-value.
// Sort hash priorities for each frozen seed/trial; ties use code-point unit IDs.
export function permuteHistories(units, seed, trial) {
  return units.map((unit) => ({
    unit,
    priority: contentHash("null-priority", { seed, trial, unitId: unit.unitId })
  })).sort((a, b) => compareIds(a.priority, b.priority) || compareIds(a.unit.unitId, b.unit.unitId))
    .map(({ unit }) => unit);
}
