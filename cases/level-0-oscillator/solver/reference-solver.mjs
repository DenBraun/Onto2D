import { defineScientificAdapter } from "../../../packages/scientific-adapter/src/index.js";

export const LEVEL_ZERO_REFERENCE_SOLVER = Object.freeze({
  id: "onto2d-level-0-reference-solver",
  version: "1.0.0",
  method: "periodic-second-order-central-difference-v1"
});

const OUTPUT_IDS = new Set([
  "dispersion_max_abs_residual",
  "frequency_balance_abs_residual",
  "periodic_norm_mean",
  "periodic_norm_relative_drift",
  "stationarity_l2_residual_coarse",
  "stationarity_l2_residual_fine",
  "stationarity_observed_order",
  "wave_number_balance_abs_residual"
]);

function assertFinite(value, path) {
  if (!Number.isFinite(value)) throw new TypeError(`${path} must be finite.`);
  return value;
}

function validateParameters(parameters) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("Level-0 solver parameters must be an object.");
  }
  if (!Array.isArray(parameters.modes) || parameters.modes.length < 1) {
    throw new TypeError("Level-0 solver requires at least one mode.");
  }
  for (const [index, mode] of parameters.modes.entries()) {
    if (!mode || typeof mode !== "object" || Array.isArray(mode)) {
      throw new TypeError(`modes[${index}] must be an object.`);
    }
    for (const field of ["A", "k", "omega", "m2", "phase"]) {
      assertFinite(mode[field], `modes[${index}].${field}`);
    }
  }
  for (const field of ["spacePeriod", "timePeriod"]) {
    if (!(assertFinite(parameters[field], field) > 0)) {
      throw new TypeError(`${field} must be positive.`);
    }
  }
  for (const [index, mode] of parameters.modes.entries()) {
    const spatialTurns = mode.k * parameters.spacePeriod / (2 * Math.PI);
    const temporalTurns = mode.omega * parameters.timePeriod / (2 * Math.PI);
    if (
      Math.abs(spatialTurns - Math.round(spatialTurns)) > 1e-12 ||
      Math.abs(temporalTurns - Math.round(temporalTurns)) > 1e-12
    ) {
      throw new TypeError(`modes[${index}] is incompatible with the periodic domain.`);
    }
  }
  for (const field of ["coarseGrid", "fineGrid"]) {
    if (!Number.isInteger(parameters[field]) || parameters[field] < 8) {
      throw new TypeError(`${field} must be an integer of at least eight.`);
    }
  }
  if (parameters.fineGrid !== parameters.coarseGrid * 2) {
    throw new TypeError("fineGrid must be exactly twice coarseGrid.");
  }
  if (
    !Number.isInteger(parameters.roundingSignificantDigits) ||
    parameters.roundingSignificantDigits < 6 ||
    parameters.roundingSignificantDigits > 15
  ) {
    throw new TypeError("roundingSignificantDigits must be an integer from 6 through 15.");
  }
  if (!(assertFinite(parameters.reportedAbsoluteTolerance, "reportedAbsoluteTolerance") >= 0)) {
    throw new TypeError("reportedAbsoluteTolerance must be non-negative.");
  }
  if (!Array.isArray(parameters.evidenceIds) || parameters.evidenceIds.length < 1) {
    throw new TypeError("evidenceIds must be a non-empty array.");
  }
  return parameters;
}

function addWave(target, mode, x, t) {
  const angle = mode.k * x - mode.omega * t + mode.phase;
  target.re += mode.A * Math.cos(angle);
  target.im += mode.A * Math.sin(angle);
}

function fieldAt(modes, x, t) {
  const value = { re: 0, im: 0 };
  for (const mode of modes) addWave(value, mode, x, t);
  return value;
}

function operatorAt(modes, x, t, dx, dt) {
  const result = { re: 0, im: 0 };
  for (const mode of modes) {
    const center = fieldAt([mode], x, t);
    const beforeT = fieldAt([mode], x, t - dt);
    const afterT = fieldAt([mode], x, t + dt);
    const beforeX = fieldAt([mode], x - dx, t);
    const afterX = fieldAt([mode], x + dx, t);
    result.re +=
      (afterT.re - 2 * center.re + beforeT.re) / (dt * dt) -
      (afterX.re - 2 * center.re + beforeX.re) / (dx * dx) +
      mode.m2 * center.re;
    result.im +=
      (afterT.im - 2 * center.im + beforeT.im) / (dt * dt) -
      (afterX.im - 2 * center.im + beforeX.im) / (dx * dx) +
      mode.m2 * center.im;
  }
  return result;
}

function stationarityL2(modes, grid, spacePeriod, timePeriod) {
  const dx = spacePeriod / grid;
  const dt = timePeriod / grid;
  let sumSquares = 0;
  for (let tIndex = 0; tIndex < grid; tIndex += 1) {
    const t = tIndex * dt;
    for (let xIndex = 0; xIndex < grid; xIndex += 1) {
      const residual = operatorAt(modes, xIndex * dx, t, dx, dt);
      sumSquares += residual.re * residual.re + residual.im * residual.im;
    }
  }
  return Math.sqrt(sumSquares / (grid * grid));
}

function periodicNorm(modes, grid, spacePeriod, timePeriod) {
  const dx = spacePeriod / grid;
  const dt = timePeriod / grid;
  let sum = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let tIndex = 0; tIndex < grid; tIndex += 1) {
    const t = tIndex * dt;
    let atTime = 0;
    for (let xIndex = 0; xIndex < grid; xIndex += 1) {
      const value = fieldAt(modes, xIndex * dx, t);
      atTime += (value.re * value.re + value.im * value.im) * dx;
    }
    sum += atTime;
    minimum = Math.min(minimum, atTime);
    maximum = Math.max(maximum, atTime);
  }
  const mean = sum / grid;
  return {
    mean,
    relativeDrift: mean === 0 ? 0 : (maximum - minimum) / Math.abs(mean)
  };
}

function roundForTransport(value, digits) {
  if (!Number.isFinite(value)) throw new TypeError("Solver produced a non-finite value.");
  const rounded = Number(value.toPrecision(digits));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function computeValues(parameters) {
  const dispersion = Math.max(...parameters.modes.map((mode) =>
    Math.abs(mode.omega ** 2 - mode.k ** 2 - mode.m2)
  ));
  const waveNumberBalance = Math.abs(parameters.modes.reduce((sum, mode) => sum + mode.k, 0));
  const frequencyBalance = Math.abs(parameters.modes.reduce((sum, mode) => sum + mode.omega, 0));
  const coarse = stationarityL2(
    parameters.modes,
    parameters.coarseGrid,
    parameters.spacePeriod,
    parameters.timePeriod
  );
  const fine = stationarityL2(
    parameters.modes,
    parameters.fineGrid,
    parameters.spacePeriod,
    parameters.timePeriod
  );
  const observedOrder = coarse > 0 && fine > 0 ? Math.log2(coarse / fine) : 0;
  const norm = periodicNorm(
    parameters.modes,
    parameters.fineGrid,
    parameters.spacePeriod,
    parameters.timePeriod
  );
  const values = {
    dispersion_max_abs_residual: dispersion,
    frequency_balance_abs_residual: frequencyBalance,
    periodic_norm_mean: norm.mean,
    periodic_norm_relative_drift: norm.relativeDrift,
    stationarity_l2_residual_coarse: coarse,
    stationarity_l2_residual_fine: fine,
    stationarity_observed_order: observedOrder,
    wave_number_balance_abs_residual: waveNumberBalance
  };
  return Object.fromEntries(Object.entries(values).map(([id, value]) => [
    id,
    roundForTransport(value, parameters.roundingSignificantDigits)
  ]));
}

export const levelZeroReferenceSolver = defineScientificAdapter({
  ...LEVEL_ZERO_REFERENCE_SOLVER,
  async evaluate(envelope) {
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      throw new TypeError("Level-0 solver requires a request envelope.");
    }
    const { requestHash, request } = envelope;
    if (typeof requestHash !== "string" || !request || typeof request !== "object") {
      throw new TypeError("Level-0 solver envelope requires requestHash and request.");
    }
    for (const field of ["id", "version", "method"]) {
      if (request.solver?.[field] !== LEVEL_ZERO_REFERENCE_SOLVER[field]) {
        throw new TypeError(`Level-0 solver ${field} does not match the request.`);
      }
    }
    const parameters = validateParameters(request.parameters);
    const computed = computeValues(parameters);
    const values = {};
    for (const specification of request.quantities) {
      if (!OUTPUT_IDS.has(specification.id)) {
        throw new TypeError(`Unsupported Level-0 quantity: ${specification.id}`);
      }
      values[specification.id] = {
        value: computed[specification.id],
        unit: specification.unit,
        tolerance: { absolute: parameters.reportedAbsoluteTolerance },
        semantic: specification.semantic,
        provenance: {
          kind: "oracle",
          source: requestHash,
          method: LEVEL_ZERO_REFERENCE_SOLVER.method,
          evidence: [...parameters.evidenceIds]
        }
      };
    }
    return {
      requestHash,
      values,
      convergence: "converged",
      solver: {
        ...LEVEL_ZERO_REFERENCE_SOLVER,
        parameters: request.parameters
      },
      wallTimeMs: 0
    };
  }
});
