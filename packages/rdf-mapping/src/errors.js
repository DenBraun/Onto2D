export class RdfMappingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RdfMappingError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function fail(code, message, details = {}) {
  throw new RdfMappingError(code, message, details);
}
