export class EngineError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function engineFail(code, message, details) {
  throw new EngineError(code, message, details);
}
