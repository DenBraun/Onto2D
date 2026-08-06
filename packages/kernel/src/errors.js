const ERROR_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

export class KernelError extends Error {
  constructor({ code, stage, message, details = {}, cause }) {
    if (!ERROR_CODE.test(code)) {
      throw new TypeError(`Invalid kernel error code: ${code}`);
    }
    if (typeof stage !== "string" || stage.length === 0) {
      throw new TypeError("Kernel error stage must be a non-empty string.");
    }
    super(message, cause === undefined ? undefined : { cause });
    this.name = "KernelError";
    this.code = code;
    this.stage = stage;
    this.details = Object.freeze({ ...details });
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      stage: this.stage,
      message: this.message,
      details: this.details
    };
  }
}

export class KernelValidationError extends KernelError {
  constructor(issues, message = "Kernel package validation failed.", options = {}) {
    super({
      code: options.code || "PACKAGE_VALIDATION_FAILED",
      stage: options.stage || "LOAD",
      message,
      details: { issues: Object.freeze([...issues]) }
    });
    this.name = "KernelValidationError";
    this.issues = this.details.issues;
  }
}

export class KernelNotImplementedError extends KernelError {
  constructor(capability) {
    super({
      code: "KERNEL_NOT_IMPLEMENTED",
      stage: "API",
      message: `Onto2D kernel capability is not implemented yet: ${capability}`,
      details: { capability }
    });
    this.name = "KernelNotImplementedError";
    this.capability = capability;
  }
}

export function validationIssue(code, path, message, details = {}) {
  return Object.freeze({
    code,
    path,
    message,
    details: Object.freeze({ ...details })
  });
}
