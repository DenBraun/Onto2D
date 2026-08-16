export const SCIENTIFIC_ADAPTER_STATUS = "interface-defined/external-reference-available";

export class InvalidScientificAdapterError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "InvalidScientificAdapterError";
    this.code = "SCIENTIFIC_ADAPTER_INVALID";
  }
}

const ADAPTER_FIELDS = new Set(["id", "version", "method", "evaluate"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function adapterEntries(adapter) {
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    throw new InvalidScientificAdapterError("Scientific adapter must be a plain object.");
  }
  const prototype = Object.getPrototypeOf(adapter);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new InvalidScientificAdapterError("Scientific adapter must be a plain object.");
  }
  if (Object.getOwnPropertySymbols(adapter).length > 0) {
    throw new InvalidScientificAdapterError("Scientific adapter must not contain symbol fields.");
  }
  const descriptors = Object.getOwnPropertyDescriptors(adapter);
  const fields = Object.keys(descriptors);
  if (fields.length !== ADAPTER_FIELDS.size || fields.some((field) => !ADAPTER_FIELDS.has(field))) {
    throw new InvalidScientificAdapterError("Scientific adapter fields must be exact.");
  }
  const entries = new Map();
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (!("value" in descriptor) || !descriptor.enumerable || FORBIDDEN_KEYS.has(field)) {
      throw new InvalidScientificAdapterError(
        "Scientific adapter must contain enumerable safe data fields only."
      );
    }
    entries.set(field, descriptor.value);
  }
  return entries;
}

export function defineScientificAdapter(adapter) {
  const entries = adapterEntries(adapter);
  for (const field of ["id", "version", "method"]) {
    const value = entries.get(field);
    if (
      typeof value !== "string" ||
      value.trim().length === 0 ||
      value !== value.trim()
    ) {
      throw new InvalidScientificAdapterError(`Scientific adapter requires normalized non-empty ${field}.`);
    }
  }
  if (typeof entries.get("evaluate") !== "function") {
    throw new InvalidScientificAdapterError("Scientific adapter requires evaluate(request).");
  }
  return Object.freeze(Object.fromEntries(entries));
}
