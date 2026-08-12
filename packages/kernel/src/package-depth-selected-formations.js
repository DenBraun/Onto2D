import { canonicalClone, canonicalize } from "./canonical.js";
import { KernelError } from "./errors.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";
import {
  verifyPackageDepthCandidateCensus
} from "./package-depth-candidate-census.js";
import {
  verifyPackageDepthSelectorAdmission
} from "./package-depth-selector-admission.js";
import {
  materializeVerifiedPackageSelectedFormations,
  normalizePackageSelectedFormationsOptions
} from "./package-selected-formations.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "MATERIALIZE_PACKAGE_DEPTH_SELECTED_FORMATIONS",
    message,
    details
  });
}

function loadedOptions(options) {
  return options.kernelVersion === undefined
    ? {}
    : { kernelVersion: options.kernelVersion };
}

/** Materializes every definitely selected target-depth formation. */
export function materializePackageDepthSelectedFormations(
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  options = {}
) {
  const normalized = normalizePackageSelectedFormationsOptions(options);
  const loadedPackage = verifyLoadedPackage(
    loadedPackageInput,
    loadedOptions(normalized)
  );
  const census = verifyPackageDepthCandidateCensus(
    censusInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    normalized
  );
  if (!isObject(admissionInput) || !Array.isArray(admissionInput.selectorExecutions)) {
    fail(
      "PACKAGE_DEPTH_SELECTED_FORMATIONS_ADMISSION_INVALID",
      "Depth-selected formations require embedded selector executions."
    );
  }
  const admission = verifyPackageDepthSelectorAdmission(
    admissionInput,
    loadedPackage,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    census,
    admissionInput.selectorExecutions,
    normalized
  );
  return materializeVerifiedPackageSelectedFormations(
    loadedPackage,
    census,
    admission
  );
}

/** Reproduces target-depth selected formations exactly. */
export function verifyPackageDepthSelectedFormations(
  formationsInput,
  loadedPackageInput,
  runConfigInput,
  levelClosuresInput,
  targetDepth,
  censusInput,
  admissionInput,
  options = {}
) {
  let supplied;
  try {
    supplied = canonicalClone(formationsInput);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_DEPTH_SELECTED_FORMATIONS_INVALID",
      "Depth-selected formations are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  const reproduced = materializePackageDepthSelectedFormations(
    loadedPackageInput,
    runConfigInput,
    levelClosuresInput,
    targetDepth,
    censusInput,
    admissionInput,
    options
  );
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_DEPTH_SELECTED_FORMATIONS_MISMATCH",
      "Depth-selected formations differ from deterministic reproduction.",
      {
        expectedFormationSetHash: reproduced.formationSetHash,
        actualFormationSetHash:
          isObject(supplied) && typeof supplied.formationSetHash === "string"
            ? supplied.formationSetHash
            : null
      }
    );
  }
  return reproduced;
}
