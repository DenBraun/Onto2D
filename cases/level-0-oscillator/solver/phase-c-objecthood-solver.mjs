import { defineScientificAdapter } from "../../../packages/scientific-adapter/src/index.js";
import {
  assertPortableQuantities,
  portableMetricValue,
  validatePortableReporting
} from "./portable-reporting.mjs";

export const PHASE_C_OBJECTHOOD_SOLVER = Object.freeze({
  id: "onto2d-level-0-phase-c-objecthood",
  version: "1.0.0",
  method: "dirichlet-central-difference-newton-v1"
});

export const PHASE_C_OBJECTHOOD_SOLVER_V2 = Object.freeze({
  id: "onto2d-level-0-phase-c-objecthood",
  version: "2.0.0",
  method: "dirichlet-central-difference-newton-portable-report-v2"
});

export const PHASE_C_OBJECTHOOD_IDENTITY_EXCLUSIONS = Object.freeze([
  "antisymmetric_hessian_min_ldl_pivot",
  "symmetric_hessian_min_ldl_pivot"
]);

const OBJECTHOOD_RESIDUAL_IDS = new Set([
  "stationarity_max_residual_coarse",
  "stationarity_max_residual_fine"
]);

function finitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be positive and finite.`);
  }
  return value;
}

function positiveEvenInteger(value, name) {
  if (!Number.isInteger(value) || value < 4 || value % 2 !== 0) {
    throw new TypeError(`${name} must be an even integer of at least four.`);
  }
  return value;
}

function validateParameters(parameters, { portable = false } = {}) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("Phase-C objecthood parameters must be an object.");
  }
  finitePositive(parameters.massSquared, "massSquared");
  finitePositive(parameters.baseHalfWidth, "baseHalfWidth");
  finitePositive(parameters.extendedHalfWidth, "extendedHalfWidth");
  if (parameters.extendedHalfWidth <= parameters.baseHalfWidth) {
    throw new TypeError("extendedHalfWidth must exceed baseHalfWidth.");
  }
  positiveEvenInteger(parameters.coarseIntervals, "coarseIntervals");
  positiveEvenInteger(parameters.fineIntervals, "fineIntervals");
  positiveEvenInteger(parameters.extendedIntervals, "extendedIntervals");
  if (parameters.fineIntervals !== 2 * parameters.coarseIntervals) {
    throw new TypeError("fineIntervals must be twice coarseIntervals.");
  }
  const fineSpacing = 2 * parameters.baseHalfWidth / parameters.fineIntervals;
  const extendedSpacing = 2 * parameters.extendedHalfWidth / parameters.extendedIntervals;
  if (Math.abs(fineSpacing - extendedSpacing) > Number.EPSILON * 16) {
    throw new TypeError("The fine and extended grids must have the same spacing.");
  }
  finitePositive(parameters.newtonTolerance, "newtonTolerance");
  if (!Number.isInteger(parameters.newtonMaxIterations) || parameters.newtonMaxIterations < 1) {
    throw new TypeError("newtonMaxIterations must be a positive integer.");
  }
  if (portable) {
    validatePortableReporting(parameters, {
      identityExcludedQuantities: PHASE_C_OBJECTHOOD_IDENTITY_EXCLUSIONS
    });
  } else {
    if (
      !Number.isInteger(parameters.roundingSignificantDigits) ||
      parameters.roundingSignificantDigits < 1 ||
      parameters.roundingSignificantDigits > 15
    ) {
      throw new TypeError("roundingSignificantDigits must be an integer from one through fifteen.");
    }
    if (!Number.isFinite(parameters.reportedAbsoluteTolerance) || parameters.reportedAbsoluteTolerance < 0) {
      throw new TypeError("reportedAbsoluteTolerance must be finite and non-negative.");
    }
  }
  if (!Number.isFinite(parameters.lambda) || parameters.lambda < 0) {
    throw new TypeError("lambda must be finite and non-negative.");
  }
  finitePositive(parameters.quarticCoefficient, "quarticCoefficient");
  if (!["pulse", "plateau", "zero"].includes(parameters.initialBranch)) {
    throw new TypeError("initialBranch must be pulse, plateau, or zero.");
  }
  if (!Array.isArray(parameters.evidenceIds) || parameters.evidenceIds.length < 1) {
    throw new TypeError("evidenceIds must be a non-empty array.");
  }
  return parameters;
}

function maxAbs(values) {
  return values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
}

function residual(profile, dx, parameters) {
  const inverseDxSquared = 1 / dx ** 2;
  return profile.map((value, index) => {
    const left = index === 0 ? 0 : profile[index - 1];
    const right = index === profile.length - 1 ? 0 : profile[index + 1];
    return -(left - 2 * value + right) * inverseDxSquared +
      parameters.massSquared * value -
      2 * parameters.lambda * value ** 2 +
      3 * parameters.quarticCoefficient * value ** 3;
  });
}

function solveTridiagonal(diagonal, offDiagonal, rightHandSide) {
  const size = diagonal.length;
  const upper = new Array(Math.max(0, size - 1));
  const solved = new Array(size);
  let pivot = diagonal[0];
  if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-14) {
    throw new Error("Newton tridiagonal system has a singular first pivot.");
  }
  if (size > 1) upper[0] = offDiagonal / pivot;
  solved[0] = rightHandSide[0] / pivot;
  for (let index = 1; index < size; index += 1) {
    pivot = diagonal[index] - offDiagonal * upper[index - 1];
    if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-14) {
      throw new Error("Newton tridiagonal system has a singular pivot.");
    }
    if (index < size - 1) upper[index] = offDiagonal / pivot;
    solved[index] = (rightHandSide[index] - offDiagonal * solved[index - 1]) / pivot;
  }
  for (let index = size - 2; index >= 0; index -= 1) {
    solved[index] -= upper[index] * solved[index + 1];
  }
  return solved;
}

function initialProfile(parameters, halfWidth, intervals) {
  const dx = 2 * halfWidth / intervals;
  const count = intervals - 1;
  if (parameters.initialBranch === "zero") return new Array(count).fill(0);
  const lambdaMagnitude = Math.abs(parameters.lambda);
  const discriminant = 4 * lambdaMagnitude ** 2 -
    12 * parameters.quarticCoefficient * parameters.massSquared;
  if (discriminant <= 0) {
    throw new Error(`${parameters.initialBranch} branch requires a positive stationary-root discriminant.`);
  }
  if (parameters.initialBranch === "plateau") {
    const highRoot = (2 * lambdaMagnitude + Math.sqrt(discriminant)) /
      (6 * parameters.quarticCoefficient);
    return Array.from({ length: count }, (_, index) => {
      const x = -halfWidth + (index + 1) * dx;
      const leftDistance = x + halfWidth;
      const rightDistance = halfWidth - x;
      return highRoot * Math.tanh(leftDistance) * Math.tanh(rightDistance);
    });
  }
  const cubic = 4 * lambdaMagnitude / 3;
  const quartic = 3 * parameters.quarticCoefficient / 2;
  const pulseDiscriminant = cubic ** 2 - 4 * quartic * parameters.massSquared;
  if (pulseDiscriminant <= 0) {
    throw new Error("pulse branch requires a positive homoclinic discriminant.");
  }
  const scale = Math.sqrt(parameters.massSquared);
  return Array.from({ length: count }, (_, index) => {
    const x = -halfWidth + (index + 1) * dx;
    return 2 * parameters.massSquared /
      (cubic + Math.sqrt(pulseDiscriminant) * Math.cosh(scale * x));
  });
}

function solveProfile(parameters, halfWidth, intervals) {
  const dx = 2 * halfWidth / intervals;
  const inverseDxSquared = 1 / dx ** 2;
  const offDiagonal = -inverseDxSquared;
  let profile = initialProfile(parameters, halfWidth, intervals);
  let currentResidual = residual(profile, dx, parameters);
  let currentMaximum = maxAbs(currentResidual);
  let iterations = 0;
  while (currentMaximum > parameters.newtonTolerance && iterations < parameters.newtonMaxIterations) {
    const diagonal = profile.map((value) => (
      2 * inverseDxSquared + parameters.massSquared -
      4 * parameters.lambda * value +
      9 * parameters.quarticCoefficient * value ** 2
    ));
    const delta = solveTridiagonal(
      diagonal,
      offDiagonal,
      currentResidual.map((value) => -value)
    );
    let accepted = false;
    for (let stepPower = 0; stepPower <= 24; stepPower += 1) {
      const scale = 2 ** -stepPower;
      const proposal = profile.map((value, index) => value + scale * delta[index]);
      const proposalResidual = residual(proposal, dx, parameters);
      const proposalMaximum = maxAbs(proposalResidual);
      if (proposalMaximum < currentMaximum || proposalMaximum <= parameters.newtonTolerance) {
        profile = proposal;
        currentResidual = proposalResidual;
        currentMaximum = proposalMaximum;
        accepted = true;
        break;
      }
    }
    if (!accepted) throw new Error("Newton line search failed to reduce the residual.");
    iterations += 1;
  }
  if (currentMaximum > parameters.newtonTolerance) {
    throw new Error("Newton iteration did not converge within the declared limit.");
  }
  return { profile, dx, halfWidth, intervals, iterations, maxResidual: currentMaximum };
}

function gamma(solution) {
  return 9 * solution.dx * solution.profile.reduce((sum, value) => sum + value ** 2, 0);
}

function energy(solution, parameters) {
  const withBoundaries = [0, ...solution.profile, 0];
  let gradient = 0;
  for (let index = 0; index < withBoundaries.length - 1; index += 1) {
    gradient += (withBoundaries[index + 1] - withBoundaries[index]) ** 2 / solution.dx;
  }
  const potential = solution.dx * solution.profile.reduce((sum, value) => sum +
    1.5 * parameters.massSquared * value ** 2 -
    2 * parameters.lambda * value ** 3 +
    2.25 * parameters.quarticCoefficient * value ** 4, 0);
  return 1.5 * gradient + potential;
}

function supportRadius90(solution) {
  const weighted = solution.profile.map((value, index) => ({
    radius: Math.abs(-solution.halfWidth + (index + 1) * solution.dx),
    weight: value ** 2 * solution.dx
  })).sort((left, right) => left.radius - right.radius);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return 0;
  let accumulated = 0;
  for (const entry of weighted) {
    accumulated += entry.weight;
    if (accumulated >= 0.9 * total) return entry.radius;
  }
  return weighted.at(-1).radius;
}

function relativeChange(left, right) {
  const scale = Math.max(Math.abs(left), Math.abs(right));
  return scale === 0 ? 0 : Math.abs(left - right) / scale;
}

function profileGridRelativeL2(coarse, fine) {
  let squaredDifference = 0;
  let squaredReference = 0;
  for (let index = 0; index < coarse.profile.length; index += 1) {
    const fineValue = fine.profile[2 * index + 1];
    squaredDifference += (coarse.profile[index] - fineValue) ** 2 * coarse.dx;
    squaredReference += fineValue ** 2 * coarse.dx;
  }
  return squaredReference === 0 ? 0 : Math.sqrt(squaredDifference / squaredReference);
}

function ldlCertificate(profile, dx, parameters, sector) {
  const inverseDxSquared = 1 / dx ** 2;
  const offSquared = inverseDxSquared ** 2;
  let previousPivot;
  let minimumPivot = Infinity;
  let positiveDefinite = true;
  for (let index = 0; index < profile.length; index += 1) {
    const value = profile[index];
    const localCurvature = sector === "symmetric"
      ? parameters.massSquared - 4 * parameters.lambda * value +
        9 * parameters.quarticCoefficient * value ** 2
      : parameters.massSquared + 2 * parameters.lambda * value +
        3 * parameters.quarticCoefficient * value ** 2;
    const diagonal = 2 * inverseDxSquared + localCurvature;
    const pivot = index === 0 ? diagonal : diagonal - offSquared / previousPivot;
    if (!Number.isFinite(pivot) || pivot <= 0) positiveDefinite = false;
    minimumPivot = Math.min(minimumPivot, pivot);
    previousPivot = pivot;
  }
  return { minimumPivot, positiveDefinite };
}

function symmetricProfileRayleighQuotient(profile, dx, parameters) {
  const denominator = profile.reduce((sum, value) => sum + value ** 2, 0);
  if (denominator === 0) return 0;
  const inverseDxSquared = 1 / dx ** 2;
  const offDiagonal = -inverseDxSquared;
  let numerator = 0;
  for (let index = 0; index < profile.length; index += 1) {
    const value = profile[index];
    const diagonal = 2 * inverseDxSquared + parameters.massSquared -
      4 * parameters.lambda * value +
      9 * parameters.quarticCoefficient * value ** 2;
    numerator += diagonal * value ** 2;
    if (index < profile.length - 1) {
      numerator += 2 * offDiagonal * value * profile[index + 1];
    }
  }
  return numerator / denominator;
}

function round(value, digits) {
  if (!Number.isFinite(value)) throw new Error("Phase-C solver produced a non-finite value.");
  if (value === 0) return 0;
  return Number.parseFloat(value.toPrecision(digits));
}

function compute(parameters) {
  const coarse = solveProfile(parameters, parameters.baseHalfWidth, parameters.coarseIntervals);
  const fine = solveProfile(parameters, parameters.baseHalfWidth, parameters.fineIntervals);
  const extended = solveProfile(parameters, parameters.extendedHalfWidth, parameters.extendedIntervals);
  const gammaCoarse = gamma(coarse);
  const gammaFine = gamma(fine);
  const gammaExtended = gamma(extended);
  const radiusFine = supportRadius90(fine);
  const radiusExtended = supportRadius90(extended);
  const symmetric = ldlCertificate(fine.profile, fine.dx, parameters, "symmetric");
  const antisymmetric = ldlCertificate(fine.profile, fine.dx, parameters, "antisymmetric");
  return {
    potential_leading_coefficient: 2.25 * parameters.quarticCoefficient,
    potential_leading_degree: 4,
    stationarity_max_residual_coarse: coarse.maxResidual,
    stationarity_max_residual_fine: fine.maxResidual,
    gamma_coarse: gammaCoarse,
    gamma_fine: gammaFine,
    gamma_extended: gammaExtended,
    gamma_grid_relative_change: relativeChange(gammaCoarse, gammaFine),
    gamma_domain_relative_change: relativeChange(gammaFine, gammaExtended),
    profile_grid_relative_l2: profileGridRelativeL2(coarse, fine),
    energy_fine: energy(fine, parameters),
    peak_amplitude_fine: Math.max(...fine.profile.map(Math.abs)),
    support_radius_90_fine: radiusFine,
    support_radius_90_extended: radiusExtended,
    support_radius_relative_change: relativeChange(radiusFine, radiusExtended),
    symmetric_hessian_min_ldl_pivot: symmetric.minimumPivot,
    symmetric_profile_rayleigh_quotient: symmetricProfileRayleighQuotient(
      fine.profile,
      fine.dx,
      parameters
    ),
    antisymmetric_hessian_min_ldl_pivot: antisymmetric.minimumPivot,
    symmetric_hessian_positive_definite: symmetric.positiveDefinite ? 1 : 0,
    antisymmetric_hessian_positive_definite: antisymmetric.positiveDefinite ? 1 : 0,
    newton_iterations_coarse: coarse.iterations,
    newton_iterations_fine: fine.iterations,
    newton_iterations_extended: extended.iterations
  };
}

function createPhaseCObjecthoodSolver(identity, { portable = false } = {}) {
  return defineScientificAdapter({
  ...identity,
  async evaluate(envelope) {
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      throw new TypeError("Phase-C objecthood solver requires a request envelope.");
    }
    const { requestHash, request } = envelope;
    if (typeof requestHash !== "string" || !request || typeof request !== "object") {
      throw new TypeError("Phase-C objecthood solver envelope requires requestHash and request.");
    }
    for (const field of ["id", "version", "method"]) {
      if (request.solver?.[field] !== identity[field]) {
        throw new TypeError(`Phase-C objecthood solver ${field} does not match the request.`);
      }
    }
    const parameters = validateParameters(request.parameters, { portable });
    if (portable) assertPortableQuantities(request.quantities, parameters.reportingPolicy);
    const computed = compute(parameters);
    const values = {};
    for (const specification of request.quantities) {
      if (!Object.prototype.hasOwnProperty.call(computed, specification.id)) {
        throw new TypeError(`Unsupported Phase-C objecthood quantity: ${specification.id}`);
      }
      values[specification.id] = {
        value: portable
          ? portableMetricValue(
            specification.id,
            computed[specification.id],
            parameters,
            OBJECTHOOD_RESIDUAL_IDS
          )
          : round(computed[specification.id], parameters.roundingSignificantDigits),
        unit: specification.unit,
        tolerance: {
          absolute: portable
            ? parameters.reportingPolicy.absoluteTolerance
            : parameters.reportedAbsoluteTolerance
        },
        semantic: specification.semantic,
        provenance: {
          kind: "oracle",
          source: requestHash,
          method: identity.method,
          evidence: [...parameters.evidenceIds]
        }
      };
    }
    return {
      requestHash,
      values,
      convergence: "converged",
      solver: { ...identity, parameters: request.parameters },
      wallTimeMs: 0
    };
  }
});
}

export const phaseCObjecthoodSolver = createPhaseCObjecthoodSolver(
  PHASE_C_OBJECTHOOD_SOLVER
);

export const phaseCObjecthoodSolverV2 = createPhaseCObjecthoodSolver(
  PHASE_C_OBJECTHOOD_SOLVER_V2,
  { portable: true }
);
