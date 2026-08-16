import { defineScientificAdapter } from "@onto2d/scientific-adapter";

export const LEVEL_ZERO_SOLVER_STATUS = "phase-b-reference-ready";

export const LEVEL_ZERO_REFERENCE_SOLVER = Object.freeze({
  id: "onto2d-level-0-reference-solver",
  version: "1.0.0",
  method: "periodic-second-order-central-difference-v1"
});

export const LEVEL_ZERO_SOLVER_LIMITS = Object.freeze({
  maxModes: 64,
  maxGrid: 1024,
  maxGridModeCells: 5_000_000,
  maxQuantities: 8,
  maxEvidenceIds: 64
});

const CONTENT_HASH = /^sha256:[a-f0-9]{64}$/;
const ERROR_CODE = /^LEVEL_ZERO_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
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

export class LevelZeroSolverError extends Error {
  constructor(code, message, details = {}) {
    if (!ERROR_CODE.test(code)) throw new TypeError(`Invalid Level-0 solver error code: ${code}`);
    super(message);
    this.name = "LevelZeroSolverError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

function fail(code, message, details = {}) {
  throw new LevelZeroSolverError(code, message, details);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFinite(value, path) {
  if (!Number.isFinite(value)) {
    fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 solver parameter must be finite.", { path });
  }
  return value;
}

function validateEnvelope(envelope) {
  if (!isObject(envelope)) {
    fail("LEVEL_ZERO_REQUEST_INVALID", "Level-0 solver requires a request envelope.");
  }
  const { requestHash, request } = envelope;
  if (!CONTENT_HASH.test(requestHash) || !isObject(request)) {
    fail(
      "LEVEL_ZERO_REQUEST_INVALID",
      "Level-0 solver envelope requires a content-hash requestHash and request object."
    );
  }
  for (const field of ["id", "version", "method"]) {
    if (request.solver?.[field] !== LEVEL_ZERO_REFERENCE_SOLVER[field]) {
      fail("LEVEL_ZERO_SOLVER_MISMATCH", "Level-0 solver identity does not match the request.", {
        field,
        expected: LEVEL_ZERO_REFERENCE_SOLVER[field],
        actual: request.solver?.[field]
      });
    }
  }
  if (!Array.isArray(request.quantities) || request.quantities.length === 0) {
    fail("LEVEL_ZERO_REQUEST_INVALID", "Level-0 solver requires at least one requested quantity.");
  }
  if (request.quantities.length > LEVEL_ZERO_SOLVER_LIMITS.maxQuantities) {
    fail("LEVEL_ZERO_RESOURCE_LIMIT_EXCEEDED", "Level-0 quantity count exceeds the solver limit.", {
      count: request.quantities.length,
      maximum: LEVEL_ZERO_SOLVER_LIMITS.maxQuantities
    });
  }
  const quantityIds = new Set();
  for (const [index, specification] of request.quantities.entries()) {
    if (!isObject(specification) || typeof specification.id !== "string") {
      fail("LEVEL_ZERO_REQUEST_INVALID", "Level-0 quantity specification is invalid.", { index });
    }
    if (!OUTPUT_IDS.has(specification.id)) {
      fail("LEVEL_ZERO_QUANTITY_UNSUPPORTED", "Level-0 quantity is not supported.", {
        id: specification.id
      });
    }
    if (quantityIds.has(specification.id)) {
      fail("LEVEL_ZERO_REQUEST_INVALID", "Level-0 quantity identifiers must be unique.", {
        id: specification.id
      });
    }
    quantityIds.add(specification.id);
  }
  return { requestHash, request };
}

function validateParameters(parameters) {
  if (!isObject(parameters)) {
    fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 solver parameters must be an object.");
  }
  if (!Array.isArray(parameters.modes) || parameters.modes.length < 1) {
    fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 solver requires at least one mode.");
  }
  if (parameters.modes.length > LEVEL_ZERO_SOLVER_LIMITS.maxModes) {
    fail("LEVEL_ZERO_RESOURCE_LIMIT_EXCEEDED", "Level-0 mode count exceeds the solver limit.", {
      count: parameters.modes.length,
      maximum: LEVEL_ZERO_SOLVER_LIMITS.maxModes
    });
  }
  for (const [index, mode] of parameters.modes.entries()) {
    if (!isObject(mode)) {
      fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 mode must be an object.", { index });
    }
    for (const field of ["A", "k", "omega", "m2", "phase"]) {
      assertFinite(mode[field], `modes[${index}].${field}`);
    }
  }
  for (const field of ["spacePeriod", "timePeriod"]) {
    if (!(assertFinite(parameters[field], field) > 0)) {
      fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 period must be positive.", { path: field });
    }
  }
  for (const [index, mode] of parameters.modes.entries()) {
    const spatialTurns = mode.k * parameters.spacePeriod / (2 * Math.PI);
    const temporalTurns = mode.omega * parameters.timePeriod / (2 * Math.PI);
    if (
      Math.abs(spatialTurns - Math.round(spatialTurns)) > 1e-12 ||
      Math.abs(temporalTurns - Math.round(temporalTurns)) > 1e-12
    ) {
      fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 mode is incompatible with the periodic domain.", {
        index
      });
    }
  }
  for (const field of ["coarseGrid", "fineGrid"]) {
    if (!Number.isInteger(parameters[field]) || parameters[field] < 8) {
      fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 grid must be an integer of at least eight.", {
        path: field
      });
    }
    if (parameters[field] > LEVEL_ZERO_SOLVER_LIMITS.maxGrid) {
      fail("LEVEL_ZERO_RESOURCE_LIMIT_EXCEEDED", "Level-0 grid exceeds the solver limit.", {
        path: field,
        value: parameters[field],
        maximum: LEVEL_ZERO_SOLVER_LIMITS.maxGrid
      });
    }
  }
  if (parameters.fineGrid !== parameters.coarseGrid * 2) {
    fail(
      "LEVEL_ZERO_PARAMETER_INVALID",
      "Level-0 fineGrid must be exactly twice coarseGrid."
    );
  }
  const gridModeCells = parameters.modes.length * (
    parameters.coarseGrid ** 2 + parameters.fineGrid ** 2
  );
  if (gridModeCells > LEVEL_ZERO_SOLVER_LIMITS.maxGridModeCells) {
    fail("LEVEL_ZERO_RESOURCE_LIMIT_EXCEEDED", "Level-0 grid work exceeds the solver limit.", {
      gridModeCells,
      maximum: LEVEL_ZERO_SOLVER_LIMITS.maxGridModeCells
    });
  }
  if (
    !Number.isInteger(parameters.roundingSignificantDigits) ||
    parameters.roundingSignificantDigits < 6 ||
    parameters.roundingSignificantDigits > 15
  ) {
    fail(
      "LEVEL_ZERO_PARAMETER_INVALID",
      "Level-0 roundingSignificantDigits must be an integer from 6 through 15."
    );
  }
  if (!(assertFinite(parameters.reportedAbsoluteTolerance, "reportedAbsoluteTolerance") >= 0)) {
    fail(
      "LEVEL_ZERO_PARAMETER_INVALID",
      "Level-0 reportedAbsoluteTolerance must be non-negative."
    );
  }
  if (!Array.isArray(parameters.evidenceIds) || parameters.evidenceIds.length < 1) {
    fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 evidenceIds must be a non-empty array.");
  }
  if (parameters.evidenceIds.length > LEVEL_ZERO_SOLVER_LIMITS.maxEvidenceIds) {
    fail("LEVEL_ZERO_RESOURCE_LIMIT_EXCEEDED", "Level-0 evidence count exceeds the solver limit.", {
      count: parameters.evidenceIds.length,
      maximum: LEVEL_ZERO_SOLVER_LIMITS.maxEvidenceIds
    });
  }
  for (const [index, evidenceId] of parameters.evidenceIds.entries()) {
    if (!CONTENT_HASH.test(evidenceId)) {
      fail("LEVEL_ZERO_PARAMETER_INVALID", "Level-0 evidence identifier must be a content hash.", {
        index
      });
    }
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
  if (!Number.isFinite(value)) {
    fail("LEVEL_ZERO_NUMERICAL_FAILURE", "Level-0 solver produced a non-finite value.");
  }
  const rounded = Number(value.toPrecision(digits));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function computeValues(parameters) {
  const dispersion = Math.max(...parameters.modes.map((mode) =>
    Math.abs(mode.omega ** 2 - mode.k ** 2 - mode.m2)
  ));
  const waveNumberBalance = Math.abs(parameters.modes.reduce((sum, mode) => sum + mode.k, 0));
  const frequencyBalance = Math.abs(
    parameters.modes.reduce((sum, mode) => sum + mode.omega, 0)
  );
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
    const { requestHash, request } = validateEnvelope(envelope);
    const parameters = validateParameters(request.parameters);
    let computed;
    try {
      computed = computeValues(parameters);
    } catch (error) {
      if (error instanceof LevelZeroSolverError) throw error;
      fail("LEVEL_ZERO_NUMERICAL_FAILURE", "Level-0 numerical evaluation failed.", {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
    const values = {};
    for (const specification of request.quantities) {
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
