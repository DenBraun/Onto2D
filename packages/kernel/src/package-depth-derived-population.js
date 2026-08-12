import { canonicalClone } from "./canonical.js";
import { KernelError } from "./errors.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  materializeVerifiedPackageDerivedDepthPopulation,
  normalizePackageDerivedDepthPopulationOptions,
  verifyVerifiedPackageDerivedDepthPopulation
} from "./package-derived-depth-population.js";
import {
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
    stage: "MATERIALIZE_PACKAGE_DEPTH_DERIVED_POPULATION",
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
  profilesInput,
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
  const profiles = verifyVerifiedPackageDerivedProfiles(
    profilesInput,
    loadedPackage,
    census,
    formations
  );
  return { loadedPackage, census, formations, profiles };
}

/** Materializes and reconciles one complete target-depth population. */
export function materializePackageDepthDerivedPopulation(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  formationsInput,
  profilesInput,
  options = {}
) {
  const normalized = normalizePackageDerivedDepthPopulationOptions(options);
  const inputs = reproduceInputs(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    censusInput,
    admissionInput,
    formationsInput,
    profilesInput,
    normalized
  );
  return materializeVerifiedPackageDerivedDepthPopulation(
    inputs.loadedPackage,
    inputs.census,
    inputs.formations,
    inputs.profiles
  );
}

/** Reproduces a target-depth population exactly. */
export function verifyPackageDepthDerivedPopulation(
  populationInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  formationsInput,
  profilesInput,
  options = {}
) {
  if (!isObject(populationInput)) {
    fail(
      "PACKAGE_DEPTH_DERIVED_POPULATION_INVALID",
      "Depth-derived population must be an object."
    );
  }
  const normalized = normalizePackageDerivedDepthPopulationOptions(options);
  const inputs = reproduceInputs(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    censusInput,
    admissionInput,
    formationsInput,
    profilesInput,
    normalized
  );
  return verifyVerifiedPackageDerivedDepthPopulation(
    canonicalClone(populationInput),
    inputs.loadedPackage,
    inputs.census,
    inputs.formations,
    inputs.profiles
  );
}
