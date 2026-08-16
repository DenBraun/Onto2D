export class ShaclValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ShaclValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function fail(code, message, details = {}) {
  throw new ShaclValidationError(code, message, details);
}
