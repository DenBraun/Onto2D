import { canonicalClone } from "./canonical.js";
import { KernelError } from "./errors.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  extractVerifiedPackageDerivedProfiles,
  normalizePackageDerivedProfileOptions,
  verifyVerifiedPackageDerivedProfiles
} from "./package-derived-profiles.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  verifyPackageDepthSelectedFormations
} from "./package-depth-selected-formations.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "EXTRACT_PACKAGE_DEPTH_DERIVED_PROFILES",
    message,
    details
  });
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

function reproduceInputs(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  formationsInput,
  options
) {
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(options)
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    options
  );
  const formations = verifyPackageDepthSelectedFormations(
    formationsInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    census,
    admissionInput,
    options
  );
  return { loadedPackage, census, formations };
}

/** Extracts one residual-slot profile per target-depth selected formation. */
export function extractPackageDepthDerivedProfiles(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  formationsInput,
  options = {}
) {
  const normalized = normalizePackageDerivedProfileOptions(options);
  const { loadedPackage, census, formations } = reproduceInputs(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    censusInput,
    admissionInput,
    formationsInput,
    normalized
  );
  return extractVerifiedPackageDerivedProfiles(
    loadedPackage,
    census,
    formations
  );
}

/** Reproduces target-depth derived profiles exactly. */
export function verifyPackageDepthDerivedProfiles(
  profilesInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  formationsInput,
  options = {}
) {
  if (!isObject(profilesInput)) {
    fail(
      "PACKAGE_DEPTH_DERIVED_PROFILES_INVALID",
      "Depth-derived profiles must be an object."
    );
  }
  const normalized = normalizePackageDerivedProfileOptions(options);
  const { loadedPackage, census, formations } = reproduceInputs(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    censusInput,
    admissionInput,
    formationsInput,
    normalized
  );
  return verifyVerifiedPackageDerivedProfiles(
    canonicalClone(profilesInput),
    loadedPackage,
    census,
    formations
  );
}
