import { canonicalClone, canonicalize } from "./canonical.js";
import { KernelError, KernelValidationError, validationIssue } from "./errors.js";
import { DEFAULT_KERNEL_VERSION, loadKernelPackage } from "./package-loader.js";

const LOADED_PACKAGE_FIELDS = new Set([
  "kind",
  "schemaVersion",
  "packageId",
  "normalized",
  "predicatePlans",
  "semanticManifest"
]);

export const LOADED_PACKAGE_VERIFIER_VERSION = "loaded-package-verifier-v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(issues, message) {
  throw new KernelValidationError(issues, message, {
    code: "LOADED_PACKAGE_VERIFICATION_FAILED",
    stage: "VERIFY_LOADED_PACKAGE"
  });
}

function rawPackageFromNormalized(normalized) {
  const raw = canonicalClone(normalized);
  raw.primitives = raw.primitives.map((entry) => {
    const primitive = { ...entry };
    Reflect.deleteProperty(primitive, "elementId");
    return primitive;
  });
  return raw;
}

function expectedKernelVersion(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail([
      validationIssue(
        "LOADED_PACKAGE_VERIFIER_OPTIONS_INVALID",
        "$options",
        "Loaded package verifier options are not canonicalizable.",
        { causeCode: error.code }
      )
    ], "Loaded package verification failed.");
  }
  if (!isObject(value) || Object.keys(value).some((field) => field !== "kernelVersion")) {
    fail([
      validationIssue(
        "LOADED_PACKAGE_VERIFIER_OPTIONS_INVALID",
        "$options",
        "Loaded package verifier options must contain only an optional kernelVersion."
      )
    ], "Loaded package verification failed.");
  }
  const version = value.kernelVersion === undefined
    ? DEFAULT_KERNEL_VERSION
    : value.kernelVersion;
  if (typeof version !== "string" || version.trim().length === 0) {
    fail([
      validationIssue(
        "LOADED_PACKAGE_EXPECTED_KERNEL_VERSION_INVALID",
        "$options.kernelVersion",
        "Expected kernel version must be a non-empty string.",
        { value: version }
      )
    ], "Loaded package verification failed.");
  }
  return version.trim();
}

export function verifyLoadedPackage(input, options = {}) {
  const expectedVersion = expectedKernelVersion(options);
  let value;
  try {
    value = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail([
      validationIssue(
        "LOADED_PACKAGE_INVALID",
        "$package",
        "Loaded package is not canonicalizable.",
        { causeCode: error.code }
      )
    ], "Loaded package verification failed.");
  }
  if (!isObject(value)) {
    fail([
      validationIssue(
        "LOADED_PACKAGE_INVALID",
        "$package",
        "A loaded kernel package must be an object."
      )
    ], "Loaded package verification failed.");
  }

  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !LOADED_PACKAGE_FIELDS.has(field));
  const missing = [...LOADED_PACKAGE_FIELDS].filter((field) => !fields.includes(field));
  if (
    unknown.length > 0 ||
    missing.length > 0 ||
    value.kind !== "loaded-kernel-package" ||
    value.schemaVersion !== "1" ||
    !isObject(value.normalized) ||
    !Array.isArray(value.normalized.primitives) ||
    !Array.isArray(value.predicatePlans) ||
    !isObject(value.semanticManifest) ||
    typeof value.semanticManifest.kernelVersion !== "string" ||
    value.semanticManifest.kernelVersion.trim().length === 0
  ) {
    fail([
      validationIssue(
        "LOADED_PACKAGE_INVALID",
        "$package",
        "Loaded package fields or version do not match the supported loader contract.",
        { unknown, missing }
      )
    ], "Loaded package verification failed.");
  }
  if (value.semanticManifest.kernelVersion !== expectedVersion) {
    fail([
      validationIssue(
        "LOADED_PACKAGE_KERNEL_VERSION_MISMATCH",
        "$package.semanticManifest.kernelVersion",
        "Loaded package kernel version does not match the independently expected verifier version.",
        { expected: expectedVersion, actual: value.semanticManifest.kernelVersion }
      )
    ], "Loaded package verification failed.");
  }

  let reproduced;
  try {
    reproduced = loadKernelPackage(rawPackageFromNormalized(value.normalized), {
      kernelVersion: expectedVersion
    });
  } catch (error) {
    if (error instanceof KernelValidationError) {
      fail(error.issues.map((entry) => validationIssue(
        entry.code,
        entry.path === "$"
          ? "$package.normalized"
          : `$package.normalized${entry.path.slice(1)}`,
        entry.message,
        entry.details
      )), "Loaded package cannot be reproduced by the package loader.");
    }
    if (error instanceof KernelError) {
      fail([
        validationIssue(
          "LOADED_PACKAGE_INVALID",
          "$package",
          "Loaded package cannot be reproduced by the package loader.",
          { causeCode: error.code }
        )
      ], "Loaded package cannot be reproduced by the package loader.");
    }
    throw error;
  }

  if (canonicalize(value) !== canonicalize(reproduced)) {
    fail([
      validationIssue(
        "LOADED_PACKAGE_MISMATCH",
        "$package",
        "Loaded package does not match the deterministic output of the current package loader.",
        { expectedPackageId: reproduced.packageId, actualPackageId: value.packageId }
      )
    ], "Loaded package verification failed.");
  }
  return reproduced;
}
