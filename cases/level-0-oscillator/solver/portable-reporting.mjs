export const PORTABLE_NUMERIC_REPORTING_ID = "portable-numeric-reporting-v1";
export const CONVERGED_RESIDUAL_POLICY = "newton-tolerance-upper-bound-v1";

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizedIds(values, name) {
  if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
    throw new TypeError(`${name} must be an array of strings.`);
  }
  const normalized = [...new Set(values)].sort();
  if (normalized.length !== values.length) {
    throw new TypeError(`${name} must not contain duplicates.`);
  }
  return normalized;
}

export function validatePortableReporting(parameters, options = {}) {
  const policy = parameters?.reportingPolicy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new TypeError("reportingPolicy must be an object.");
  }
  if (policy.id !== PORTABLE_NUMERIC_REPORTING_ID) {
    throw new TypeError(`reportingPolicy.id must be ${PORTABLE_NUMERIC_REPORTING_ID}.`);
  }
  if (
    !Number.isInteger(policy.significantDigits)
    || policy.significantDigits < 1
    || policy.significantDigits > 15
  ) {
    throw new TypeError("reportingPolicy.significantDigits must be an integer from one through fifteen.");
  }
  if (
    options.requireTraceDigits === true
    && (
      !Number.isInteger(policy.traceSignificantDigits)
      || policy.traceSignificantDigits < 1
      || policy.traceSignificantDigits > 15
    )
  ) {
    throw new TypeError("reportingPolicy.traceSignificantDigits must be an integer from one through fifteen.");
  }
  if (
    options.requireTraceDigits === true
    && (!Number.isFinite(policy.traceAbsoluteTolerance) || policy.traceAbsoluteTolerance <= 0)
  ) {
    throw new TypeError("reportingPolicy.traceAbsoluteTolerance must be positive and finite.");
  }
  if (policy.convergedResidualPolicy !== CONVERGED_RESIDUAL_POLICY) {
    throw new TypeError(
      `reportingPolicy.convergedResidualPolicy must be ${CONVERGED_RESIDUAL_POLICY}.`
    );
  }
  if (!Number.isFinite(policy.absoluteTolerance) || policy.absoluteTolerance < 0) {
    throw new TypeError("reportingPolicy.absoluteTolerance must be finite and non-negative.");
  }
  const actualExcluded = normalizedIds(
    policy.identityExcludedQuantities,
    "reportingPolicy.identityExcludedQuantities"
  );
  const expectedExcluded = normalizedIds(
    options.identityExcludedQuantities ?? [],
    "identityExcludedQuantities"
  );
  if (!sameStrings(actualExcluded, expectedExcluded)) {
    throw new TypeError("reportingPolicy.identityExcludedQuantities differs from the solver contract.");
  }
  return policy;
}

export function assertPortableQuantities(quantities, policy) {
  const excluded = new Set(policy.identityExcludedQuantities);
  for (const specification of quantities) {
    if (excluded.has(specification.id)) {
      throw new TypeError(
        `Quantity ${specification.id} is excluded from portable identity reporting.`
      );
    }
  }
}

function roundSignificant(value, digits, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} produced a non-finite value.`);
  if (value === 0) return 0;
  return Number.parseFloat(value.toPrecision(digits));
}

function quantizeAbsolute(value, tolerance, digits, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} produced a non-finite value.`);
  if (value === 0) return 0;
  if (tolerance === 0) return roundSignificant(value, digits, label);
  const scaled = value / tolerance;
  if (!Number.isSafeInteger(Math.round(scaled))) {
    return roundSignificant(value, digits, label);
  }
  const quantized = Math.round(scaled) * tolerance;
  if (Object.is(quantized, -0)) return 0;
  return roundSignificant(quantized, digits, label);
}

export function portableMetricValue(id, value, parameters, residualIds = new Set()) {
  const policy = parameters.reportingPolicy;
  if (residualIds.has(id)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Residual ${id} must be finite and non-negative.`);
    }
    if (value <= parameters.newtonTolerance) return parameters.newtonTolerance;
  }
  return quantizeAbsolute(
    value,
    policy.absoluteTolerance,
    policy.significantDigits,
    "Portable reporting"
  );
}

export function portableTraceValue(value, parameters) {
  return quantizeAbsolute(
    value,
    parameters.reportingPolicy.traceAbsoluteTolerance,
    parameters.reportingPolicy.traceSignificantDigits,
    "Portable trace reporting"
  );
}
