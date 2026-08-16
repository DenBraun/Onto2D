import { defineScientificAdapter } from "../../../packages/scientific-adapter/src/index.js";
import {
  assertPortableQuantities,
  portableMetricValue,
  portableTraceValue,
  validatePortableReporting
} from "./portable-reporting.mjs";

export const PHASE_C_DYNAMICS_SOLVER = Object.freeze({
  id: "onto2d-level-0-phase-c-dynamics",
  version: "1.0.0",
  method: "three-envelope-dirichlet-velocity-verlet-v1"
});

export const PHASE_C_DYNAMICS_SOLVER_V2 = Object.freeze({
  id: "onto2d-level-0-phase-c-dynamics",
  version: "2.0.0",
  method: "three-envelope-dirichlet-velocity-verlet-portable-report-v2"
});

const DYNAMICS_RESIDUAL_IDS = new Set([
  "stationarity_max_residual_base",
  "stationarity_max_residual_refined"
]);

function finitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be positive and finite.`);
  }
  return value;
}

function positiveEvenInteger(value, name) {
  if (!Number.isInteger(value) || value < 8 || value % 2 !== 0) {
    throw new TypeError(`${name} must be an even integer of at least eight.`);
  }
  return value;
}

function validateDirection(direction, name) {
  if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite)) {
    throw new TypeError(`${name} must contain three finite components.`);
  }
  const norm = Math.sqrt(direction.reduce((sum, value) => sum + value ** 2, 0));
  if (norm === 0) throw new TypeError(`${name} must be nonzero.`);
  return direction.map((value) => value / norm);
}

function validateParameters(parameters, { portable = false } = {}) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("Phase-C dynamics parameters must be an object.");
  }
  finitePositive(parameters.massSquared, "massSquared");
  finitePositive(parameters.lambda, "lambda");
  finitePositive(parameters.quarticCoefficient, "quarticCoefficient");
  finitePositive(parameters.halfWidth, "halfWidth");
  positiveEvenInteger(parameters.baseIntervals, "baseIntervals");
  positiveEvenInteger(parameters.refinedIntervals, "refinedIntervals");
  if (parameters.refinedIntervals !== 2 * parameters.baseIntervals) {
    throw new TypeError("refinedIntervals must be twice baseIntervals.");
  }
  finitePositive(parameters.duration, "duration");
  finitePositive(parameters.cfl, "cfl");
  if (parameters.cfl >= 0.5) throw new TypeError("cfl must be below 0.5 for this dynamics probe.");
  if (!Number.isInteger(parameters.timeRefinementFactor) || parameters.timeRefinementFactor !== 2) {
    throw new TypeError("timeRefinementFactor must equal two for this solver version.");
  }
  finitePositive(parameters.perturbationFraction, "perturbationFraction");
  if (parameters.perturbationFraction >= 0.1) {
    throw new TypeError("perturbationFraction must remain below 0.1.");
  }
  const symmetricDirection = validateDirection(parameters.symmetricDirection, "symmetricDirection");
  const antisymmetricDirection = validateDirection(
    parameters.antisymmetricDirection,
    "antisymmetricDirection"
  );
  if (Math.max(...symmetricDirection) - Math.min(...symmetricDirection) > 1e-12) {
    throw new TypeError("symmetricDirection must perturb all three components equally.");
  }
  if (Math.abs(antisymmetricDirection.reduce((sum, value) => sum + value, 0)) > 1e-12) {
    throw new TypeError("antisymmetricDirection must have zero component sum.");
  }
  finitePositive(parameters.departureAmplificationThreshold, "departureAmplificationThreshold");
  if (!Number.isInteger(parameters.snapshotCount) || parameters.snapshotCount < 3 || parameters.snapshotCount > 101) {
    throw new TypeError("snapshotCount must be an integer from three through 101.");
  }
  if (!Number.isInteger(parameters.spatialSampleStride) || parameters.spatialSampleStride < 1) {
    throw new TypeError("spatialSampleStride must be a positive integer.");
  }
  finitePositive(parameters.newtonTolerance, "newtonTolerance");
  if (!Number.isInteger(parameters.newtonMaxIterations) || parameters.newtonMaxIterations < 1) {
    throw new TypeError("newtonMaxIterations must be a positive integer.");
  }
  if (portable) {
    validatePortableReporting(parameters, { requireTraceDigits: true });
  } else {
    for (const field of ["roundingSignificantDigits", "traceSignificantDigits"]) {
      if (!Number.isInteger(parameters[field]) || parameters[field] < 1 || parameters[field] > 15) {
        throw new TypeError(`${field} must be an integer from one through fifteen.`);
      }
    }
    if (!Number.isFinite(parameters.reportedAbsoluteTolerance) || parameters.reportedAbsoluteTolerance < 0) {
      throw new TypeError("reportedAbsoluteTolerance must be finite and non-negative.");
    }
  }
  if (!Array.isArray(parameters.evidenceIds) || parameters.evidenceIds.length < 1) {
    throw new TypeError("evidenceIds must be a non-empty array.");
  }
  return { ...parameters, symmetricDirection, antisymmetricDirection };
}

function maxAbs(values) {
  return values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
}

function solveTridiagonal(diagonal, offDiagonal, rightHandSide) {
  const size = diagonal.length;
  const upper = new Array(Math.max(0, size - 1));
  const solved = new Array(size);
  let pivot = diagonal[0];
  if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-14) {
    throw new Error("Dynamics Newton system has a singular first pivot.");
  }
  if (size > 1) upper[0] = offDiagonal / pivot;
  solved[0] = rightHandSide[0] / pivot;
  for (let index = 1; index < size; index += 1) {
    pivot = diagonal[index] - offDiagonal * upper[index - 1];
    if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-14) {
      throw new Error("Dynamics Newton system has a singular pivot.");
    }
    if (index < size - 1) upper[index] = offDiagonal / pivot;
    solved[index] = (rightHandSide[index] - offDiagonal * solved[index - 1]) / pivot;
  }
  for (let index = size - 2; index >= 0; index -= 1) {
    solved[index] -= upper[index] * solved[index + 1];
  }
  return solved;
}

function stationaryResidual(profile, dx, parameters) {
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

function solveStationaryPulse(parameters, intervals) {
  const dx = 2 * parameters.halfWidth / intervals;
  const cubic = 4 * parameters.lambda / 3;
  const quartic = 3 * parameters.quarticCoefficient / 2;
  const discriminant = cubic ** 2 - 4 * quartic * parameters.massSquared;
  if (discriminant <= 0) throw new Error("Dynamics pulse requires a positive discriminant.");
  let profile = Array.from({ length: intervals - 1 }, (_, index) => {
    const x = -parameters.halfWidth + (index + 1) * dx;
    return 2 * parameters.massSquared /
      (cubic + Math.sqrt(discriminant) * Math.cosh(Math.sqrt(parameters.massSquared) * x));
  });
  const inverseDxSquared = 1 / dx ** 2;
  const offDiagonal = -inverseDxSquared;
  let residual = stationaryResidual(profile, dx, parameters);
  let maximum = maxAbs(residual);
  let iterations = 0;
  while (maximum > parameters.newtonTolerance && iterations < parameters.newtonMaxIterations) {
    const diagonal = profile.map((value) => (
      2 * inverseDxSquared + parameters.massSquared -
      4 * parameters.lambda * value +
      9 * parameters.quarticCoefficient * value ** 2
    ));
    const delta = solveTridiagonal(
      diagonal,
      offDiagonal,
      residual.map((value) => -value)
    );
    let accepted = false;
    for (let power = 0; power <= 24; power += 1) {
      const scale = 2 ** -power;
      const proposal = profile.map((value, index) => value + scale * delta[index]);
      const proposalResidual = stationaryResidual(proposal, dx, parameters);
      const proposalMaximum = maxAbs(proposalResidual);
      if (proposalMaximum < maximum || proposalMaximum <= parameters.newtonTolerance) {
        profile = proposal;
        residual = proposalResidual;
        maximum = proposalMaximum;
        accepted = true;
        break;
      }
    }
    if (!accepted) throw new Error("Dynamics Newton line search failed.");
    iterations += 1;
  }
  if (maximum > parameters.newtonTolerance) {
    throw new Error("Dynamics stationary pulse did not converge.");
  }
  return { profile, dx, intervals, maxResidual: maximum, iterations };
}

function cloneFields(fields) {
  return fields.map((field) => field.slice());
}

function zeroFields(size) {
  return Array.from({ length: 3 }, () => new Array(size).fill(0));
}

function initialFields(profile, direction, fraction) {
  return direction.map((component) => profile.map(
    (value) => value * (1 + fraction * component)
  ));
}

function accelerations(fields, dx, parameters) {
  const size = fields[0].length;
  const output = zeroFields(size);
  const inverseDxSquared = 1 / dx ** 2;
  for (let index = 0; index < size; index += 1) {
    const values = fields.map((field) => field[index]);
    const sumSquared = values.reduce((sum, value) => sum + value ** 2, 0);
    for (let component = 0; component < 3; component += 1) {
      const field = fields[component];
      const left = index === 0 ? 0 : field[index - 1];
      const right = index === size - 1 ? 0 : field[index + 1];
      const other = [0, 1, 2].filter((entry) => entry !== component);
      output[component][index] =
        (left - 2 * field[index] + right) * inverseDxSquared -
        parameters.massSquared * field[index] +
        2 * parameters.lambda * values[other[0]] * values[other[1]] -
        parameters.quarticCoefficient * sumSquared * field[index];
    }
  }
  return output;
}

function verletStep(state, dx, dt, parameters) {
  const currentAcceleration = accelerations(state.fields, dx, parameters);
  const halfVelocity = state.velocities.map((velocity, component) => velocity.map(
    (value, index) => value + 0.5 * dt * currentAcceleration[component][index]
  ));
  const fields = state.fields.map((field, component) => field.map(
    (value, index) => value + dt * halfVelocity[component][index]
  ));
  const nextAcceleration = accelerations(fields, dx, parameters);
  const velocities = halfVelocity.map((velocity, component) => velocity.map(
    (value, index) => value + 0.5 * dt * nextAcceleration[component][index]
  ));
  return { fields, velocities };
}

function fieldNorm(fields, dx) {
  let squared = 0;
  for (const field of fields) {
    for (const value of field) squared += value ** 2;
  }
  return Math.sqrt(dx * squared);
}

function fieldDifferenceNorm(left, right, dx) {
  let squared = 0;
  for (let component = 0; component < 3; component += 1) {
    for (let index = 0; index < left[component].length; index += 1) {
      squared += (left[component][index] - right[component][index]) ** 2;
    }
  }
  return Math.sqrt(dx * squared);
}

function energy(state, dx, parameters) {
  const size = state.fields[0].length;
  let kinetic = 0;
  let gradient = 0;
  let potential = 0;
  for (let component = 0; component < 3; component += 1) {
    for (const velocity of state.velocities[component]) kinetic += 0.5 * velocity ** 2 * dx;
    const withBoundaries = [0, ...state.fields[component], 0];
    for (let index = 0; index < withBoundaries.length - 1; index += 1) {
      gradient += 0.5 * (withBoundaries[index + 1] - withBoundaries[index]) ** 2 / dx;
    }
  }
  for (let index = 0; index < size; index += 1) {
    const values = state.fields.map((field) => field[index]);
    const sumSquared = values.reduce((sum, value) => sum + value ** 2, 0);
    potential += dx * (
      0.5 * parameters.massSquared * sumSquared -
      2 * parameters.lambda * values[0] * values[1] * values[2] +
      0.25 * parameters.quarticCoefficient * sumSquared ** 2
    );
  }
  return kinetic + gradient + potential;
}

function gamma(fields, dx) {
  let total = 0;
  for (let index = 0; index < fields[0].length; index += 1) {
    const composite = fields[0][index] + fields[1][index] + fields[2][index];
    total += composite ** 2;
  }
  return dx * total;
}

function relativeChange(left, right) {
  const scale = Math.max(Math.abs(left), Math.abs(right));
  return scale === 0 ? 0 : Math.abs(left - right) / scale;
}

function rounded(value, digits) {
  if (!Number.isFinite(value)) throw new Error("Dynamics solver produced a non-finite value.");
  if (value === 0) return 0;
  return Number.parseFloat(value.toPrecision(digits));
}

function traceValue(value, parameters, portable) {
  return portable
    ? portableTraceValue(value, parameters)
    : rounded(value, parameters.traceSignificantDigits);
}

function sampledProfile(fields, parameters, dx, portable) {
  const values = [];
  for (let boundaryIndex = 0; boundaryIndex <= fields[0].length + 1; boundaryIndex += 1) {
    if (
      boundaryIndex !== 0 &&
      boundaryIndex !== fields[0].length + 1 &&
      boundaryIndex % parameters.spatialSampleStride !== 0
    ) continue;
    const internalIndex = boundaryIndex - 1;
    const components = internalIndex < 0 || internalIndex >= fields[0].length
      ? [0, 0, 0]
      : fields.map((field) => field[internalIndex]);
    values.push({
      x: traceValue(-parameters.halfWidth + boundaryIndex * dx, parameters, portable),
      composite: traceValue(components.reduce((sum, value) => sum + value, 0), parameters, portable)
    });
  }
  return values;
}

function runPair(stationary, direction, parameters, includeProfiles, portable) {
  const stationaryFields = Array.from({ length: 3 }, () => stationary.profile.slice());
  const controlInitial = {
    fields: cloneFields(stationaryFields),
    velocities: zeroFields(stationary.profile.length)
  };
  const perturbedInitial = {
    fields: initialFields(stationary.profile, direction, parameters.perturbationFraction),
    velocities: zeroFields(stationary.profile.length)
  };
  let control = { fields: cloneFields(controlInitial.fields), velocities: zeroFields(stationary.profile.length) };
  let perturbed = { fields: cloneFields(perturbedInitial.fields), velocities: zeroFields(stationary.profile.length) };
  const steps = Math.ceil(parameters.duration / (parameters.cfl * stationary.dx));
  const dt = parameters.duration / steps;
  const initialDeviation = fieldDifferenceNorm(perturbed.fields, control.fields, stationary.dx);
  const stationaryNorm = fieldNorm(stationaryFields, stationary.dx);
  const initialControlEnergy = energy(control, stationary.dx, parameters);
  const initialPerturbedEnergy = energy(perturbed, stationary.dx, parameters);
  const initialGamma = gamma(perturbed.fields, stationary.dx);
  const snapshotSteps = new Set(Array.from({ length: parameters.snapshotCount }, (_, index) => (
    Math.round(index * steps / (parameters.snapshotCount - 1))
  )));
  const frames = [];
  let maxAmplification = 1;
  let maxControlDeparture = 0;
  let maxControlEnergyDrift = 0;
  let maxPerturbedEnergyDrift = 0;
  let departureTime = -1;
  let finalAmplification = 1;

  for (let step = 0; step <= steps; step += 1) {
    const time = step * dt;
    const deviation = fieldDifferenceNorm(perturbed.fields, control.fields, stationary.dx);
    const amplification = deviation / initialDeviation;
    const controlDeparture = fieldDifferenceNorm(control.fields, stationaryFields, stationary.dx) /
      stationaryNorm;
    const controlEnergyDrift = relativeChange(
      energy(control, stationary.dx, parameters),
      initialControlEnergy
    );
    const perturbedEnergyDrift = relativeChange(
      energy(perturbed, stationary.dx, parameters),
      initialPerturbedEnergy
    );
    maxAmplification = Math.max(maxAmplification, amplification);
    maxControlDeparture = Math.max(maxControlDeparture, controlDeparture);
    maxControlEnergyDrift = Math.max(maxControlEnergyDrift, controlEnergyDrift);
    maxPerturbedEnergyDrift = Math.max(maxPerturbedEnergyDrift, perturbedEnergyDrift);
    finalAmplification = amplification;
    if (departureTime < 0 && amplification >= parameters.departureAmplificationThreshold) {
      departureTime = time;
    }
    if (snapshotSteps.has(step)) {
      const frame = {
        time: traceValue(time, parameters, portable),
        amplification: traceValue(amplification, parameters, portable),
        gammaRelativeChange: traceValue(
          relativeChange(gamma(perturbed.fields, stationary.dx), initialGamma),
          parameters,
          portable
        )
      };
      if (includeProfiles) {
        const controlProfile = sampledProfile(control.fields, parameters, stationary.dx, portable);
        const perturbedProfile = sampledProfile(
          perturbed.fields,
          parameters,
          stationary.dx,
          portable
        );
        frame.x = controlProfile.map((entry) => entry.x);
        frame.controlComposite = controlProfile.map((entry) => entry.composite);
        frame.perturbedComposite = perturbedProfile.map((entry) => entry.composite);
      }
      frames.push(frame);
    }
    if (step === steps) break;
    control = verletStep(control, stationary.dx, dt, parameters);
    perturbed = verletStep(perturbed, stationary.dx, dt, parameters);
  }

  return {
    dt,
    steps,
    initialDeviation,
    maxAmplification,
    finalAmplification,
    departureTime,
    maxControlDeparture,
    maxControlEnergyDrift,
    maxPerturbedEnergyDrift,
    gammaFinalRelativeChange: relativeChange(gamma(perturbed.fields, stationary.dx), initialGamma),
    frames
  };
}

export function runPhaseCDynamicsNumerics(rawParameters, options = {}) {
  const portable = options.portable ?? Boolean(rawParameters?.reportingPolicy);
  const parameters = validateParameters(rawParameters, { portable });
  const baseStationary = solveStationaryPulse(parameters, parameters.baseIntervals);
  const refinedStationary = solveStationaryPulse(parameters, parameters.refinedIntervals);
  const timeRefinedParameters = {
    ...parameters,
    cfl: parameters.cfl / parameters.timeRefinementFactor
  };
  const symmetricBase = runPair(
    baseStationary,
    parameters.symmetricDirection,
    parameters,
    false,
    portable
  );
  const symmetricTimeRefined = runPair(
    baseStationary,
    parameters.symmetricDirection,
    timeRefinedParameters,
    false,
    portable
  );
  const symmetricRefined = runPair(
    refinedStationary,
    parameters.symmetricDirection,
    parameters,
    true,
    portable
  );
  const antisymmetricBase = runPair(
    baseStationary,
    parameters.antisymmetricDirection,
    parameters,
    false,
    portable
  );
  const antisymmetricTimeRefined = runPair(
    baseStationary,
    parameters.antisymmetricDirection,
    timeRefinedParameters,
    false,
    portable
  );
  const antisymmetricRefined = runPair(
    refinedStationary,
    parameters.antisymmetricDirection,
    parameters,
    false,
    portable
  );
  const metrics = {
    stationarity_max_residual_base: baseStationary.maxResidual,
    stationarity_max_residual_refined: refinedStationary.maxResidual,
    control_max_profile_relative_departure_base: Math.max(
      symmetricBase.maxControlDeparture,
      antisymmetricBase.maxControlDeparture
    ),
    control_max_profile_relative_departure_refined: Math.max(
      symmetricRefined.maxControlDeparture,
      antisymmetricRefined.maxControlDeparture
    ),
    control_max_energy_relative_drift_base: Math.max(
      symmetricBase.maxControlEnergyDrift,
      antisymmetricBase.maxControlEnergyDrift
    ),
    control_max_energy_relative_drift_refined: Math.max(
      symmetricRefined.maxControlEnergyDrift,
      antisymmetricRefined.maxControlEnergyDrift
    ),
    symmetric_initial_deviation_norm_base: symmetricBase.initialDeviation,
    symmetric_initial_deviation_norm_refined: symmetricRefined.initialDeviation,
    symmetric_max_deviation_amplification_base: symmetricBase.maxAmplification,
    symmetric_max_deviation_amplification_time_refined: symmetricTimeRefined.maxAmplification,
    symmetric_max_deviation_amplification_refined: symmetricRefined.maxAmplification,
    symmetric_final_deviation_amplification_base: symmetricBase.finalAmplification,
    symmetric_final_deviation_amplification_refined: symmetricRefined.finalAmplification,
    symmetric_departure_time_base: symmetricBase.departureTime,
    symmetric_departure_time_refined: symmetricRefined.departureTime,
    symmetric_max_energy_relative_drift_base: symmetricBase.maxPerturbedEnergyDrift,
    symmetric_max_energy_relative_drift_refined: symmetricRefined.maxPerturbedEnergyDrift,
    symmetric_gamma_final_relative_change_base: symmetricBase.gammaFinalRelativeChange,
    symmetric_gamma_final_relative_change_refined: symmetricRefined.gammaFinalRelativeChange,
    antisymmetric_initial_deviation_norm_base: antisymmetricBase.initialDeviation,
    antisymmetric_initial_deviation_norm_refined: antisymmetricRefined.initialDeviation,
    antisymmetric_max_deviation_amplification_base: antisymmetricBase.maxAmplification,
    antisymmetric_max_deviation_amplification_time_refined:
      antisymmetricTimeRefined.maxAmplification,
    antisymmetric_max_deviation_amplification_refined: antisymmetricRefined.maxAmplification,
    antisymmetric_final_deviation_amplification_base: antisymmetricBase.finalAmplification,
    antisymmetric_final_deviation_amplification_refined: antisymmetricRefined.finalAmplification,
    antisymmetric_max_energy_relative_drift_base: antisymmetricBase.maxPerturbedEnergyDrift,
    antisymmetric_max_energy_relative_drift_refined: antisymmetricRefined.maxPerturbedEnergyDrift,
    symmetric_amplification_time_relative_change: relativeChange(
      symmetricBase.maxAmplification,
      symmetricTimeRefined.maxAmplification
    ),
    symmetric_amplification_space_relative_change: relativeChange(
      symmetricTimeRefined.maxAmplification,
      symmetricRefined.maxAmplification
    ),
    antisymmetric_amplification_time_relative_change: relativeChange(
      antisymmetricBase.maxAmplification,
      antisymmetricTimeRefined.maxAmplification
    ),
    antisymmetric_amplification_space_relative_change: relativeChange(
      antisymmetricTimeRefined.maxAmplification,
      antisymmetricRefined.maxAmplification
    )
  };
  return {
    metrics,
    visualization: {
      schemaVersion: "1",
      branchId: "localized-pulse",
      probeId: "symmetric-profile-perturbation",
      intervals: refinedStationary.intervals,
      dx: traceValue(refinedStationary.dx, parameters, portable),
      dt: traceValue(symmetricRefined.dt, parameters, portable),
      steps: symmetricRefined.steps,
      componentCount: 3,
      perturbationFraction: parameters.perturbationFraction,
      frames: symmetricRefined.frames,
      antisymmetricAmplificationFrames: antisymmetricRefined.frames.map((frame) => ({
        time: frame.time,
        amplification: frame.amplification
      }))
    }
  };
}

function createPhaseCDynamicsSolver(identity, { portable = false } = {}) {
  return defineScientificAdapter({
  ...identity,
  async evaluate(envelope) {
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      throw new TypeError("Phase-C dynamics solver requires a request envelope.");
    }
    const { requestHash, request } = envelope;
    if (typeof requestHash !== "string" || !request || typeof request !== "object") {
      throw new TypeError("Phase-C dynamics solver envelope requires requestHash and request.");
    }
    for (const field of ["id", "version", "method"]) {
      if (request.solver?.[field] !== identity[field]) {
        throw new TypeError(`Phase-C dynamics solver ${field} does not match the request.`);
      }
    }
    const parameters = validateParameters(request.parameters, { portable });
    if (portable) assertPortableQuantities(request.quantities, parameters.reportingPolicy);
    const { metrics } = runPhaseCDynamicsNumerics(parameters, { portable });
    const values = {};
    for (const specification of request.quantities) {
      if (!Object.prototype.hasOwnProperty.call(metrics, specification.id)) {
        throw new TypeError(`Unsupported Phase-C dynamics quantity: ${specification.id}`);
      }
      values[specification.id] = {
        value: portable
          ? portableMetricValue(
            specification.id,
            metrics[specification.id],
            parameters,
            DYNAMICS_RESIDUAL_IDS
          )
          : rounded(metrics[specification.id], parameters.roundingSignificantDigits),
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

export const phaseCDynamicsSolver = createPhaseCDynamicsSolver(PHASE_C_DYNAMICS_SOLVER);

export const phaseCDynamicsSolverV2 = createPhaseCDynamicsSolver(
  PHASE_C_DYNAMICS_SOLVER_V2,
  { portable: true }
);
