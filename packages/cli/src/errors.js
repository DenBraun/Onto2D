const ERROR_CODE = /^CLI_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

export class CliError extends Error {
  constructor(code, message, details = {}) {
    if (!ERROR_CODE.test(code)) throw new TypeError(`Invalid CLI error code: ${code}`);
    super(message);
    this.name = "CliError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function cliFail(code, message, details) {
  throw new CliError(code, message, details);
}
