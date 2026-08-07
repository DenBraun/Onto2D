export const SCIENTIFIC_ADAPTER_STATUS = "interface-defined/implementations-pending";

export class InvalidScientificAdapterError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "InvalidScientificAdapterError";
    this.code = "SCIENTIFIC_ADAPTER_INVALID";
  }
}

export function defineScientificAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new InvalidScientificAdapterError("Scientific adapter must be an object.");
  }
  for (const field of ["id", "version", "method"]) {
    if (
      typeof adapter[field] !== "string" ||
      adapter[field].trim().length === 0 ||
      adapter[field] !== adapter[field].trim()
    ) {
      throw new InvalidScientificAdapterError(`Scientific adapter requires normalized non-empty ${field}.`);
    }
  }
  if (typeof adapter.evaluate !== "function") {
    throw new InvalidScientificAdapterError("Scientific adapter requires evaluate(request).");
  }
  return Object.freeze({ ...adapter });
}
