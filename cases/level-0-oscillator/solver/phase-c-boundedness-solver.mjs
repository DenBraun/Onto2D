import { defineScientificAdapter } from "../../../packages/scientific-adapter/src/index.js";

export const PHASE_C_BOUNDEDNESS_SOLVER = Object.freeze({
  id: "onto2d-level-0-phase-c-preflight",
  version: "1.0.0",
  method: "cubic-amplitude-ray-v1"
});

function validateParameters(parameters) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("Phase-C preflight parameters must be an object.");
  }
  if (
    !Array.isArray(parameters.massSquared) ||
    parameters.massSquared.length !== 3 ||
    parameters.massSquared.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new TypeError("Phase-C preflight requires three positive finite massSquared values.");
  }
  if (!Number.isFinite(parameters.lambda)) {
    throw new TypeError("Phase-C preflight lambda must be finite.");
  }
  if (
    !Array.isArray(parameters.radii) ||
    parameters.radii.length < 3 ||
    parameters.radii.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new TypeError("Phase-C preflight radii must be positive finite values.");
  }
  for (let index = 1; index < parameters.radii.length; index += 1) {
    if (parameters.radii[index] <= parameters.radii[index - 1]) {
      throw new TypeError("Phase-C preflight radii must be strictly increasing.");
    }
  }
  if (!Number.isFinite(parameters.reportedAbsoluteTolerance) || parameters.reportedAbsoluteTolerance < 0) {
    throw new TypeError("Phase-C reportedAbsoluteTolerance must be finite and non-negative.");
  }
  if (!Array.isArray(parameters.evidenceIds) || parameters.evidenceIds.length < 1) {
    throw new TypeError("Phase-C evidenceIds must be a non-empty array.");
  }
  return parameters;
}

function potential(parameters, radius) {
  const quadratic = parameters.massSquared.reduce((sum, value) => sum + value, 0) * radius ** 2;
  const cubic = -2 * Math.abs(parameters.lambda) * radius ** 3;
  return quadratic + cubic;
}

function derivative(parameters, radius) {
  const quadraticCoefficient = parameters.massSquared.reduce((sum, value) => sum + value, 0);
  return 2 * quadraticCoefficient * radius - 6 * Math.abs(parameters.lambda) * radius ** 2;
}

function compute(parameters) {
  const quadraticCoefficient = parameters.massSquared.reduce((sum, value) => sum + value, 0);
  const coupled = parameters.lambda !== 0;
  const result = {
    asymptotic_leading_coefficient: coupled ? -2 * Math.abs(parameters.lambda) : quadraticCoefficient,
    asymptotic_leading_degree: coupled ? 3 : 2,
    terminal_derivative: derivative(parameters, parameters.radii.at(-1)),
    turning_radius: coupled ? quadraticCoefficient / (3 * Math.abs(parameters.lambda)) : 0
  };
  for (const radius of parameters.radii) {
    result[`potential_at_radius_${radius}`] = potential(parameters, radius);
  }
  return result;
}

export const phaseCBoundednessSolver = defineScientificAdapter({
  ...PHASE_C_BOUNDEDNESS_SOLVER,
  async evaluate(envelope) {
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      throw new TypeError("Phase-C solver requires a request envelope.");
    }
    const { requestHash, request } = envelope;
    if (typeof requestHash !== "string" || !request || typeof request !== "object") {
      throw new TypeError("Phase-C solver envelope requires requestHash and request.");
    }
    for (const field of ["id", "version", "method"]) {
      if (request.solver?.[field] !== PHASE_C_BOUNDEDNESS_SOLVER[field]) {
        throw new TypeError(`Phase-C solver ${field} does not match the request.`);
      }
    }
    const parameters = validateParameters(request.parameters);
    const computed = compute(parameters);
    const values = {};
    for (const specification of request.quantities) {
      if (!Object.prototype.hasOwnProperty.call(computed, specification.id)) {
        throw new TypeError(`Unsupported Phase-C quantity: ${specification.id}`);
      }
      values[specification.id] = {
        value: computed[specification.id],
        unit: specification.unit,
        tolerance: { absolute: parameters.reportedAbsoluteTolerance },
        semantic: specification.semantic,
        provenance: {
          kind: "oracle",
          source: requestHash,
          method: PHASE_C_BOUNDEDNESS_SOLVER.method,
          evidence: [...parameters.evidenceIds]
        }
      };
    }
    return {
      requestHash,
      values,
      convergence: "converged",
      solver: { ...PHASE_C_BOUNDEDNESS_SOLVER, parameters: request.parameters },
      wallTimeMs: 0
    };
  }
});
