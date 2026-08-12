import { canonicalize } from "./canonical.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import { normalizeQuantity as normalizeRuntimeQuantity } from "./quantity.js";
import { normalizeProfileSlotGuard } from "./profile-guard.js";

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCanonical(left, right) {
  return compareStrings(canonicalize(left), canonicalize(right));
}

function sortedStrings(values) {
  return [...values].sort(compareStrings);
}

function sortedRecord(record) {
  return Object.fromEntries(Object.keys(record).sort(compareStrings).map(
    (key) => [key, record[key]]
  ));
}

function normalizeProfileQuantity(quantity) {
  const normalized = normalizeRuntimeQuantity(quantity);
  return {
    value: normalized.value,
    unit: normalized.unit,
    tolerance: sortedRecord(normalized.tolerance),
    semantic: normalized.semantic,
    provenance: {
      ...normalized.provenance,
      evidence: sortedStrings(normalized.provenance.evidence)
    }
  };
}

function quantityIdentity(quantity) {
  return {
    value: quantity.value,
    unit: quantity.unit,
    tolerance: quantity.tolerance,
    semantic: quantity.semantic
  };
}

/** Builds the one canonical profile representation used by load and D5. */
export function normalizeProfileRecord(profile) {
  const slots = profile.slots.map((slot) => ({
    role: slot.role.trim(),
    polarity: slot.polarity,
    capacity: { min: slot.capacity.min, max: slot.capacity.max },
    ...(slot.guard === undefined
      ? {}
      : { guard: normalizeProfileSlotGuard(slot.guard) })
  })).sort(compareCanonical);
  const invariantVector = profile.invariantVector.map((entry) => ({
    semantic: entry.semantic.trim(),
    normalized: normalizeProfileQuantity(entry.normalized),
    quantization: normalizeProfileQuantity(entry.quantization)
  })).sort((left, right) =>
    compareStrings(left.semantic, right.semantic) ||
      compareCanonical(left, right)
  );
  const normalized = {
    slots,
    invariantVector,
    precisionPolicy: profile.precisionPolicy.trim()
  };
  const identity = {
    slots,
    invariantVector: invariantVector.map((entry) => ({
      semantic: entry.semantic,
      normalized: quantityIdentity(entry.normalized),
      quantization: quantityIdentity(entry.quantization)
    })),
    precisionPolicy: normalized.precisionPolicy
  };
  return {
    ...normalized,
    hash: hashCanonical(HASH_DOMAINS.PROFILE, identity)
  };
}
