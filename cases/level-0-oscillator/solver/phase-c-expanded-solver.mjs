import { defineScientificAdapter } from "../../../packages/scientific-adapter/src/index.js";
import {
  assertPortableQuantities,
  portableMetricValue,
  portableTraceValue,
  validatePortableReporting
} from "./portable-reporting.mjs";

export const PHASE_C_EXPANDED_SOLVER = Object.freeze({
  id: "onto2d-level-0-phase-c-expanded",
  version: "1.0.0",
  method: "three-component-block-newton-complex-verlet-v1"
});

export const PHASE_C_EXPANDED_SOLVER_V2 = Object.freeze({
  id: "onto2d-level-0-phase-c-expanded",
  version: "2.0.0",
  method: "three-component-block-newton-complex-verlet-portable-report-v2"
});

const EXPANDED_RESIDUAL_IDS = new Set([
  "stationarity_max_residual_coarse",
  "stationarity_max_residual_fine",
  "stationarity_max_residual_extended"
]);

const COMPONENTS = 3;

function finitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be positive and finite.`);
  }
  return value;
}

function evenInteger(value, name, minimum = 8) {
  if (!Number.isInteger(value) || value < minimum || value % 2 !== 0) {
    throw new TypeError(`${name} must be an even integer of at least ${minimum}.`);
  }
  return value;
}

function finiteTriple(value, name, { positive = false } = {}) {
  if (!Array.isArray(value) || value.length !== COMPONENTS || !value.every(Number.isFinite)) {
    throw new TypeError(`${name} must contain three finite values.`);
  }
  if (positive && value.some((entry) => entry <= 0)) {
    throw new TypeError(`${name} values must be positive.`);
  }
  return value.slice();
}

function validateParameters(parameters, { portable = false } = {}) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("Expanded Phase-C parameters must be an object.");
  }
  finitePositive(parameters.baseHalfWidth, "baseHalfWidth");
  finitePositive(parameters.extendedHalfWidth, "extendedHalfWidth");
  if (parameters.extendedHalfWidth <= parameters.baseHalfWidth) {
    throw new TypeError("extendedHalfWidth must exceed baseHalfWidth.");
  }
  evenInteger(parameters.coarseIntervals, "coarseIntervals");
  evenInteger(parameters.fineIntervals, "fineIntervals");
  evenInteger(parameters.extendedIntervals, "extendedIntervals");
  evenInteger(parameters.dynamicRefinedIntervals, "dynamicRefinedIntervals");
  if (parameters.fineIntervals !== 2 * parameters.coarseIntervals) {
    throw new TypeError("fineIntervals must be twice coarseIntervals.");
  }
  if (parameters.dynamicRefinedIntervals !== 2 * parameters.fineIntervals) {
    throw new TypeError("dynamicRefinedIntervals must be twice fineIntervals.");
  }
  const fineDx = 2 * parameters.baseHalfWidth / parameters.fineIntervals;
  const extendedDx = 2 * parameters.extendedHalfWidth / parameters.extendedIntervals;
  if (Math.abs(fineDx - extendedDx) > Number.EPSILON * 32) {
    throw new TypeError("Fine and extended grids must share a spacing.");
  }
  finitePositive(parameters.newtonTolerance, "newtonTolerance");
  if (!Number.isInteger(parameters.newtonMaxIterations) || parameters.newtonMaxIterations < 1) {
    throw new TypeError("newtonMaxIterations must be a positive integer.");
  }
  finitePositive(parameters.dynamicDuration, "dynamicDuration");
  finitePositive(parameters.dynamicCfl, "dynamicCfl");
  if (parameters.dynamicCfl >= 0.5) throw new TypeError("dynamicCfl must be below 0.5.");
  if (parameters.timeRefinementFactor !== 2) {
    throw new TypeError("timeRefinementFactor must equal two.");
  }
  finitePositive(parameters.perturbationFraction, "perturbationFraction");
  if (parameters.perturbationFraction >= 0.1) {
    throw new TypeError("perturbationFraction must remain below 0.1.");
  }
  finitePositive(parameters.departureAmplificationThreshold, "departureAmplificationThreshold");
  if (!Number.isInteger(parameters.traceCount) || parameters.traceCount < 3 || parameters.traceCount > 101) {
    throw new TypeError("traceCount must be an integer from three through 101.");
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
  finiteTriple(parameters.massSquared, "massSquared", { positive: true });
  finiteTriple(parameters.seedScale, "seedScale", { positive: true });
  finitePositive(parameters.lambda, "lambda");
  finitePositive(parameters.quarticCoefficient, "quarticCoefficient");
  if (!Array.isArray(parameters.perturbations) || parameters.perturbations.length !== 4) {
    throw new TypeError("Exactly four perturbations are required.");
  }
  const identifiers = new Set();
  for (const perturbation of parameters.perturbations) {
    if (!perturbation || typeof perturbation.id !== "string" || identifiers.has(perturbation.id)) {
      throw new TypeError("Perturbations require unique string identifiers.");
    }
    identifiers.add(perturbation.id);
    if (!['real', 'imaginary'].includes(perturbation.field)) {
      throw new TypeError("Perturbation field must be real or imaginary.");
    }
    finiteTriple(perturbation.componentDirection, "componentDirection");
    if (![
      "stationary-envelope",
      "unit-gaussian-centered-at-1.5",
      "unit-gaussian-times-first-cosine-centered-at-minus-1.5"
    ].includes(perturbation.spatialProfile)) {
      throw new TypeError("Unsupported perturbation spatial profile.");
    }
  }
  if (!Array.isArray(parameters.evidenceIds) || parameters.evidenceIds.length < 1) {
    throw new TypeError("evidenceIds must be a non-empty array.");
  }
  return parameters;
}

function zeroMatrix() {
  return Array.from({ length: COMPONENTS }, () => new Array(COMPONENTS).fill(0));
}

function identityMatrix(scale = 1) {
  return Array.from({ length: COMPONENTS }, (_, row) => (
    Array.from({ length: COMPONENTS }, (_, column) => row === column ? scale : 0)
  ));
}

function subtractMatrices(left, right) {
  return left.map((row, rowIndex) => row.map(
    (value, columnIndex) => value - right[rowIndex][columnIndex]
  ));
}

function multiplyMatrices(left, right) {
  const output = zeroMatrix();
  for (let row = 0; row < COMPONENTS; row += 1) {
    for (let column = 0; column < COMPONENTS; column += 1) {
      for (let inner = 0; inner < COMPONENTS; inner += 1) {
        output[row][column] += left[row][inner] * right[inner][column];
      }
    }
  }
  return output;
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => row.reduce(
    (sum, value, index) => sum + value * vector[index],
    0
  ));
}

function subtractVectors(left, right) {
  return left.map((value, index) => value - right[index]);
}

function solve3(matrix, vector) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < COMPONENTS; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < COMPONENTS; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivotRow][column])) pivotRow = row;
    }
    if (!Number.isFinite(rows[pivotRow][column]) || Math.abs(rows[pivotRow][column]) < 1e-13) {
      throw new Error("Three-component block system is singular.");
    }
    [rows[column], rows[pivotRow]] = [rows[pivotRow], rows[column]];
    const pivot = rows[column][column];
    for (let entry = column; entry <= COMPONENTS; entry += 1) rows[column][entry] /= pivot;
    for (let row = 0; row < COMPONENTS; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let entry = column; entry <= COMPONENTS; entry += 1) {
        rows[row][entry] -= factor * rows[column][entry];
      }
    }
  }
  return rows.map((row) => row[COMPONENTS]);
}

function inverse3(matrix) {
  const columns = Array.from({ length: COMPONENTS }, (_, column) => (
    solve3(matrix, Array.from({ length: COMPONENTS }, (_, row) => row === column ? 1 : 0))
  ));
  return Array.from({ length: COMPONENTS }, (_, row) => (
    Array.from({ length: COMPONENTS }, (_, column) => columns[column][row])
  ));
}

function solveBlockTridiagonal(diagonalBlocks, rightHandSide, offDiagonal) {
  const blockCount = diagonalBlocks.length;
  const offBlock = identityMatrix(offDiagonal);
  const upper = new Array(Math.max(0, blockCount - 1));
  const forward = new Array(blockCount);
  let reduced = diagonalBlocks[0];
  let inverse = inverse3(reduced);
  if (blockCount > 1) upper[0] = multiplyMatrices(inverse, offBlock);
  forward[0] = multiplyMatrixVector(inverse, rightHandSide[0]);
  for (let index = 1; index < blockCount; index += 1) {
    reduced = subtractMatrices(
      diagonalBlocks[index],
      multiplyMatrices(offBlock, upper[index - 1])
    );
    const adjusted = subtractVectors(
      rightHandSide[index],
      multiplyMatrixVector(offBlock, forward[index - 1])
    );
    inverse = inverse3(reduced);
    if (index < blockCount - 1) upper[index] = multiplyMatrices(inverse, offBlock);
    forward[index] = multiplyMatrixVector(inverse, adjusted);
  }
  const solved = new Array(blockCount);
  solved[blockCount - 1] = forward[blockCount - 1];
  for (let index = blockCount - 2; index >= 0; index -= 1) {
    solved[index] = subtractVectors(
      forward[index],
      multiplyMatrixVector(upper[index], solved[index + 1])
    );
  }
  return solved;
}

function symmetricEigenvalues3(matrix) {
  const work = matrix.map((row) => row.slice());
  for (let sweep = 0; sweep < 32; sweep += 1) {
    let p = 0;
    let q = 1;
    for (const pair of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(work[pair[0]][pair[1]]) > Math.abs(work[p][q])) [p, q] = pair;
    }
    if (Math.abs(work[p][q]) < 1e-13) break;
    const angle = 0.5 * Math.atan2(2 * work[p][q], work[q][q] - work[p][p]);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const rotation = identityMatrix();
    rotation[p][p] = cosine;
    rotation[q][q] = cosine;
    rotation[p][q] = sine;
    rotation[q][p] = -sine;
    const transpose = rotation[0].map((_, column) => rotation.map((row) => row[column]));
    const rotated = multiplyMatrices(multiplyMatrices(transpose, work), rotation);
    for (let row = 0; row < COMPONENTS; row += 1) {
      for (let column = 0; column < COMPONENTS; column += 1) work[row][column] = rotated[row][column];
    }
  }
  return [work[0][0], work[1][1], work[2][2]].sort((left, right) => left - right);
}

function localMatrix(values, inverseDxSquared, parameters, sector) {
  const sumSquared = values.reduce((sum, value) => sum + value ** 2, 0);
  const matrix = zeroMatrix();
  for (let component = 0; component < COMPONENTS; component += 1) {
    matrix[component][component] = 2 * inverseDxSquared + parameters.massSquared[component] +
      parameters.quarticCoefficient * (
        sector === "real" ? sumSquared + 2 * values[component] ** 2 : sumSquared
      );
  }
  for (let left = 0; left < COMPONENTS; left += 1) {
    for (let right = left + 1; right < COMPONENTS; right += 1) {
      const other = 3 - left - right;
      const coupling = sector === "real"
        ? -2 * parameters.lambda * values[other] +
          2 * parameters.quarticCoefficient * values[left] * values[right]
        : 2 * parameters.lambda * values[other];
      matrix[left][right] = coupling;
      matrix[right][left] = coupling;
    }
  }
  return matrix;
}

function stationaryResidual(fields, dx, parameters) {
  const size = fields[0].length;
  const inverseDxSquared = 1 / dx ** 2;
  return Array.from({ length: size }, (_, index) => {
    const values = fields.map((field) => field[index]);
    const sumSquared = values.reduce((sum, value) => sum + value ** 2, 0);
    return values.map((value, component) => {
      const field = fields[component];
      const left = index === 0 ? 0 : field[index - 1];
      const right = index === size - 1 ? 0 : field[index + 1];
      const others = [0, 1, 2].filter((entry) => entry !== component);
      return -(left - 2 * value + right) * inverseDxSquared +
        parameters.massSquared[component] * value -
        2 * parameters.lambda * values[others[0]] * values[others[1]] +
        parameters.quarticCoefficient * sumSquared * value;
    });
  });
}

function maximumAbsolute(blocks) {
  let maximum = 0;
  for (const block of blocks) for (const value of block) maximum = Math.max(maximum, Math.abs(value));
  return maximum;
}

function initialFields(parameters, halfWidth, intervals) {
  const dx = 2 * halfWidth / intervals;
  const averageMassSquared = parameters.massSquared.reduce((sum, value) => sum + value, 0) /
    COMPONENTS;
  const cubic = 4 * parameters.lambda / 3;
  const quartic = 3 * parameters.quarticCoefficient / 2;
  const discriminant = cubic ** 2 - 4 * quartic * averageMassSquared;
  if (discriminant <= 0) throw new Error("Expanded pulse seed requires a positive discriminant.");
  const base = Array.from({ length: intervals - 1 }, (_, index) => {
    const x = -halfWidth + (index + 1) * dx;
    return 2 * averageMassSquared / (
      cubic + Math.sqrt(discriminant) * Math.cosh(Math.sqrt(averageMassSquared) * x)
    );
  });
  return parameters.seedScale.map((scale) => base.map((value) => scale * value));
}

function solveStationary(parameters, halfWidth, intervals) {
  const dx = 2 * halfWidth / intervals;
  const inverseDxSquared = 1 / dx ** 2;
  const offDiagonal = -inverseDxSquared;
  let fields = initialFields(parameters, halfWidth, intervals);
  let residual = stationaryResidual(fields, dx, parameters);
  let maximum = maximumAbsolute(residual);
  let iterations = 0;
  while (maximum > parameters.newtonTolerance && iterations < parameters.newtonMaxIterations) {
    const diagonal = residual.map((_, index) => localMatrix(
      fields.map((field) => field[index]),
      inverseDxSquared,
      parameters,
      "real"
    ));
    const deltaBlocks = solveBlockTridiagonal(
      diagonal,
      residual.map((block) => block.map((value) => -value)),
      offDiagonal
    );
    let accepted = false;
    for (let power = 0; power <= 28; power += 1) {
      const scale = 2 ** -power;
      const proposal = fields.map((field, component) => field.map(
        (value, index) => value + scale * deltaBlocks[index][component]
      ));
      const proposalResidual = stationaryResidual(proposal, dx, parameters);
      const proposalMaximum = maximumAbsolute(proposalResidual);
      if (proposalMaximum < maximum || proposalMaximum <= parameters.newtonTolerance) {
        fields = proposal;
        residual = proposalResidual;
        maximum = proposalMaximum;
        accepted = true;
        break;
      }
    }
    if (!accepted) throw new Error("Expanded block-Newton line search failed.");
    iterations += 1;
  }
  if (maximum > parameters.newtonTolerance) {
    throw new Error("Expanded block-Newton solve did not converge.");
  }
  return { fields, dx, halfWidth, intervals, maxResidual: maximum, iterations };
}

function relativeChange(left, right) {
  const scale = Math.max(Math.abs(left), Math.abs(right));
  return scale === 0 ? 0 : Math.abs(left - right) / scale;
}

function gamma(solution) {
  let total = 0;
  for (let index = 0; index < solution.fields[0].length; index += 1) {
    const composite = solution.fields.reduce((sum, field) => sum + field[index], 0);
    total += composite ** 2;
  }
  return solution.dx * total;
}

function stationaryEnergy(solution, parameters) {
  let gradient = 0;
  for (const field of solution.fields) {
    const bounded = [0, ...field, 0];
    for (let index = 0; index < bounded.length - 1; index += 1) {
      gradient += 0.5 * (bounded[index + 1] - bounded[index]) ** 2 / solution.dx;
    }
  }
  let potential = 0;
  for (let index = 0; index < solution.fields[0].length; index += 1) {
    const values = solution.fields.map((field) => field[index]);
    const sumSquared = values.reduce((sum, value) => sum + value ** 2, 0);
    const mass = values.reduce((sum, value, component) => (
      sum + 0.5 * parameters.massSquared[component] * value ** 2
    ), 0);
    potential += solution.dx * (
      mass - 2 * parameters.lambda * values[0] * values[1] * values[2] +
      0.25 * parameters.quarticCoefficient * sumSquared ** 2
    );
  }
  return gradient + potential;
}

function supportRadius90(solution) {
  const weighted = Array.from({ length: solution.fields[0].length }, (_, index) => {
    const composite = solution.fields.reduce((sum, field) => sum + field[index], 0);
    return {
      radius: Math.abs(-solution.halfWidth + (index + 1) * solution.dx),
      weight: composite ** 2 * solution.dx
    };
  }).sort((left, right) => left.radius - right.radius);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return 0;
  let accumulated = 0;
  for (const entry of weighted) {
    accumulated += entry.weight;
    if (accumulated >= 0.9 * total) return entry.radius;
  }
  return weighted.at(-1).radius;
}

function profileGridRelativeL2(coarse, fine) {
  let difference = 0;
  let reference = 0;
  for (let component = 0; component < COMPONENTS; component += 1) {
    for (let index = 0; index < coarse.fields[component].length; index += 1) {
      const fineValue = fine.fields[component][2 * index + 1];
      difference += (coarse.fields[component][index] - fineValue) ** 2 * coarse.dx;
      reference += fineValue ** 2 * coarse.dx;
    }
  }
  return reference === 0 ? 0 : Math.sqrt(difference / reference);
}

function asymmetryIndex(solution) {
  let difference = 0;
  let reference = 0;
  for (let index = 0; index < solution.fields[0].length; index += 1) {
    const values = solution.fields.map((field) => field[index]);
    const mean = values.reduce((sum, value) => sum + value, 0) / COMPONENTS;
    for (const value of values) {
      difference += (value - mean) ** 2 * solution.dx;
      reference += value ** 2 * solution.dx;
    }
  }
  return reference === 0 ? 0 : Math.sqrt(difference / reference);
}

function hessianCertificate(solution, parameters, sector) {
  const inverseDxSquared = 1 / solution.dx ** 2;
  const offSquared = inverseDxSquared ** 2;
  let reduced;
  let minimum = Infinity;
  let positiveDefinite = true;
  for (let index = 0; index < solution.fields[0].length; index += 1) {
    const local = localMatrix(
      solution.fields.map((field) => field[index]),
      inverseDxSquared,
      parameters,
      sector
    );
    reduced = index === 0
      ? local
      : subtractMatrices(local, inverse3(reduced).map(
        (row) => row.map((value) => offSquared * value)
      ));
    const eigenvalue = symmetricEigenvalues3(reduced)[0];
    minimum = Math.min(minimum, eigenvalue);
    if (!Number.isFinite(eigenvalue) || eigenvalue <= 0) positiveDefinite = false;
  }
  return { minimum, positiveDefinite };
}

function zeroComponents(size) {
  return Array.from({ length: COMPONENTS }, () => new Array(size).fill(0));
}

function cloneComponents(components) {
  return components.map((component) => component.slice());
}

function stationaryState(solution) {
  const size = solution.fields[0].length;
  return {
    real: cloneComponents(solution.fields),
    imaginary: zeroComponents(size),
    realVelocity: zeroComponents(size),
    imaginaryVelocity: zeroComponents(size)
  };
}

function cloneState(state) {
  return {
    real: cloneComponents(state.real),
    imaginary: cloneComponents(state.imaginary),
    realVelocity: cloneComponents(state.realVelocity),
    imaginaryVelocity: cloneComponents(state.imaginaryVelocity)
  };
}

function accelerations(state, dx, parameters) {
  const size = state.real[0].length;
  const inverseDxSquared = 1 / dx ** 2;
  const real = zeroComponents(size);
  const imaginary = zeroComponents(size);
  for (let index = 0; index < size; index += 1) {
    const r = state.real.map((field) => field[index]);
    const im = state.imaginary.map((field) => field[index]);
    const sumSquared = r.reduce((sum, value, component) => (
      sum + value ** 2 + im[component] ** 2
    ), 0);
    for (let component = 0; component < COMPONENTS; component += 1) {
      const others = [0, 1, 2].filter((entry) => entry !== component);
      const left = others[0];
      const right = others[1];
      const productReal = r[left] * r[right] - im[left] * im[right];
      const productImaginary = -(r[left] * im[right] + im[left] * r[right]);
      const realField = state.real[component];
      const imaginaryField = state.imaginary[component];
      const realLaplacian = (
        (index === 0 ? 0 : realField[index - 1]) - 2 * r[component] +
        (index === size - 1 ? 0 : realField[index + 1])
      ) * inverseDxSquared;
      const imaginaryLaplacian = (
        (index === 0 ? 0 : imaginaryField[index - 1]) - 2 * im[component] +
        (index === size - 1 ? 0 : imaginaryField[index + 1])
      ) * inverseDxSquared;
      real[component][index] = realLaplacian - parameters.massSquared[component] * r[component] +
        2 * parameters.lambda * productReal -
        parameters.quarticCoefficient * sumSquared * r[component];
      imaginary[component][index] = imaginaryLaplacian -
        parameters.massSquared[component] * im[component] +
        2 * parameters.lambda * productImaginary -
        parameters.quarticCoefficient * sumSquared * im[component];
    }
  }
  return { real, imaginary };
}

function verletStep(state, dx, dt, parameters) {
  const current = accelerations(state, dx, parameters);
  const halfRealVelocity = state.realVelocity.map((field, component) => field.map(
    (value, index) => value + 0.5 * dt * current.real[component][index]
  ));
  const halfImaginaryVelocity = state.imaginaryVelocity.map((field, component) => field.map(
    (value, index) => value + 0.5 * dt * current.imaginary[component][index]
  ));
  const real = state.real.map((field, component) => field.map(
    (value, index) => value + dt * halfRealVelocity[component][index]
  ));
  const imaginary = state.imaginary.map((field, component) => field.map(
    (value, index) => value + dt * halfImaginaryVelocity[component][index]
  ));
  const next = accelerations({ ...state, real, imaginary }, dx, parameters);
  return {
    real,
    imaginary,
    realVelocity: halfRealVelocity.map((field, component) => field.map(
      (value, index) => value + 0.5 * dt * next.real[component][index]
    )),
    imaginaryVelocity: halfImaginaryVelocity.map((field, component) => field.map(
      (value, index) => value + 0.5 * dt * next.imaginary[component][index]
    ))
  };
}

function stateFieldNorm(state, dx) {
  let squared = 0;
  for (let component = 0; component < COMPONENTS; component += 1) {
    for (let index = 0; index < state.real[component].length; index += 1) {
      squared += state.real[component][index] ** 2 + state.imaginary[component][index] ** 2;
    }
  }
  return Math.sqrt(dx * squared);
}

function stateDifferenceNorm(left, right, dx) {
  let squared = 0;
  for (let component = 0; component < COMPONENTS; component += 1) {
    for (let index = 0; index < left.real[component].length; index += 1) {
      squared += (left.real[component][index] - right.real[component][index]) ** 2;
      squared += (left.imaginary[component][index] - right.imaginary[component][index]) ** 2;
    }
  }
  return Math.sqrt(dx * squared);
}

function complexEnergy(state, dx, parameters) {
  let kinetic = 0;
  let gradient = 0;
  for (let component = 0; component < COMPONENTS; component += 1) {
    for (let index = 0; index < state.real[component].length; index += 1) {
      kinetic += 0.5 * dx * (
        state.realVelocity[component][index] ** 2 +
        state.imaginaryVelocity[component][index] ** 2
      );
    }
    for (const field of [state.real[component], state.imaginary[component]]) {
      const bounded = [0, ...field, 0];
      for (let index = 0; index < bounded.length - 1; index += 1) {
        gradient += 0.5 * (bounded[index + 1] - bounded[index]) ** 2 / dx;
      }
    }
  }
  let potential = 0;
  for (let index = 0; index < state.real[0].length; index += 1) {
    const r = state.real.map((field) => field[index]);
    const im = state.imaginary.map((field) => field[index]);
    const sumSquared = r.reduce((sum, value, component) => (
      sum + value ** 2 + im[component] ** 2
    ), 0);
    const mass = r.reduce((sum, value, component) => (
      sum + 0.5 * parameters.massSquared[component] *
        (value ** 2 + im[component] ** 2)
    ), 0);
    const productReal = r[0] * r[1] * r[2] -
      r[0] * im[1] * im[2] -
      im[0] * r[1] * im[2] -
      im[0] * im[1] * r[2];
    potential += dx * (
      mass - 2 * parameters.lambda * productReal +
      0.25 * parameters.quarticCoefficient * sumSquared ** 2
    );
  }
  return kinetic + gradient + potential;
}

function perturbationState(solution, perturbation, parameters) {
  const state = stationaryState(solution);
  const delta = zeroComponents(solution.fields[0].length);
  for (let component = 0; component < COMPONENTS; component += 1) {
    for (let index = 0; index < delta[component].length; index += 1) {
      const x = -solution.halfWidth + (index + 1) * solution.dx;
      let spatial;
      if (perturbation.spatialProfile === "stationary-envelope") {
        spatial = solution.fields[component][index];
      } else if (perturbation.spatialProfile === "unit-gaussian-centered-at-1.5") {
        spatial = Math.exp(-0.5 * ((x - 1.5) / 0.8) ** 2);
      } else {
        spatial = Math.exp(-0.5 * ((x + 1.5) / 1) ** 2) *
          Math.cos(Math.PI * (x + solution.halfWidth) / (2 * solution.halfWidth));
      }
      delta[component][index] = perturbation.componentDirection[component] * spatial;
    }
  }
  const deltaState = {
    real: perturbation.field === "real" ? delta : zeroComponents(delta[0].length),
    imaginary: perturbation.field === "imaginary" ? delta : zeroComponents(delta[0].length),
    realVelocity: zeroComponents(delta[0].length),
    imaginaryVelocity: zeroComponents(delta[0].length)
  };
  const deltaNorm = stateFieldNorm(deltaState, solution.dx);
  const backgroundNorm = stateFieldNorm(state, solution.dx);
  if (deltaNorm === 0 || backgroundNorm === 0) {
    throw new Error("Dynamic perturbation requires nonzero background and direction norms.");
  }
  const scale = parameters.perturbationFraction * backgroundNorm / deltaNorm;
  for (let component = 0; component < COMPONENTS; component += 1) {
    for (let index = 0; index < delta[component].length; index += 1) {
      state.real[component][index] += scale * deltaState.real[component][index];
      state.imaginary[component][index] += scale * deltaState.imaginary[component][index];
    }
  }
  return state;
}

function rounded(value, digits) {
  if (!Number.isFinite(value)) throw new Error("Expanded solver produced a non-finite value.");
  if (value === 0) return 0;
  return Number.parseFloat(value.toPrecision(digits));
}

function traceValue(value, parameters, portable) {
  return portable
    ? portableTraceValue(value, parameters)
    : rounded(value, parameters.traceSignificantDigits);
}

function runDynamicPair(solution, perturbation, parameters, cfl, includeTrace, portable) {
  const stationary = stationaryState(solution);
  let control = cloneState(stationary);
  let perturbed = perturbationState(solution, perturbation, parameters);
  const initialPerturbed = cloneState(perturbed);
  const initialDeviation = stateDifferenceNorm(perturbed, control, solution.dx);
  const stationaryNorm = stateFieldNorm(stationary, solution.dx);
  const controlEnergy = complexEnergy(control, solution.dx, parameters);
  const perturbedEnergy = complexEnergy(perturbed, solution.dx, parameters);
  const steps = Math.ceil(parameters.dynamicDuration / (cfl * solution.dx));
  const dt = parameters.dynamicDuration / steps;
  const traceSteps = new Set(Array.from({ length: parameters.traceCount }, (_, index) => (
    Math.round(index * steps / (parameters.traceCount - 1))
  )));
  let maximumAmplification = 1;
  let maximumControlDeparture = 0;
  let maximumEnergyDrift = 0;
  let departureTime = -1;
  const trace = [];
  for (let step = 0; step <= steps; step += 1) {
    const amplification = stateDifferenceNorm(perturbed, control, solution.dx) / initialDeviation;
    const controlDeparture = stateDifferenceNorm(control, stationary, solution.dx) / stationaryNorm;
    const controlDrift = relativeChange(complexEnergy(control, solution.dx, parameters), controlEnergy);
    const perturbedDrift = relativeChange(
      complexEnergy(perturbed, solution.dx, parameters),
      perturbedEnergy
    );
    maximumAmplification = Math.max(maximumAmplification, amplification);
    maximumControlDeparture = Math.max(maximumControlDeparture, controlDeparture);
    maximumEnergyDrift = Math.max(maximumEnergyDrift, controlDrift, perturbedDrift);
    if (departureTime < 0 && amplification >= parameters.departureAmplificationThreshold) {
      departureTime = step * dt;
    }
    if (includeTrace && traceSteps.has(step)) {
      trace.push({
        time: traceValue(step * dt, parameters, portable),
        amplification: traceValue(amplification, parameters, portable)
      });
    }
    if (step === steps) break;
    control = verletStep(control, solution.dx, dt, parameters);
    perturbed = verletStep(perturbed, solution.dx, dt, parameters);
  }
  return {
    dt,
    steps,
    initialDeviation,
    maximumAmplification,
    finalAmplification: stateDifferenceNorm(perturbed, control, solution.dx) / initialDeviation,
    maximumControlDeparture,
    maximumEnergyDrift,
    departureTime,
    initialStateDifference: stateDifferenceNorm(initialPerturbed, stationary, solution.dx),
    trace
  };
}

function runBank(solution, parameters, cfl, includeTrace, portable) {
  return parameters.perturbations.map((perturbation) => ({
    id: perturbation.id,
    ...runDynamicPair(solution, perturbation, parameters, cfl, includeTrace, portable)
  }));
}

function maximum(bank, field) {
  return Math.max(...bank.map((entry) => entry[field]));
}

function requiredProbe(bank, id) {
  const probe = bank.find((entry) => entry.id === id);
  if (!probe) throw new Error(`Missing dynamic probe ${id}.`);
  return probe;
}

export function runPhaseCExpandedNumerics(rawParameters, options = {}) {
  const portable = options.portable ?? Boolean(rawParameters?.reportingPolicy);
  const parameters = validateParameters(rawParameters, { portable });
  const coarse = solveStationary(
    parameters,
    parameters.baseHalfWidth,
    parameters.coarseIntervals
  );
  const fine = solveStationary(
    parameters,
    parameters.baseHalfWidth,
    parameters.fineIntervals
  );
  const extended = solveStationary(
    parameters,
    parameters.extendedHalfWidth,
    parameters.extendedIntervals
  );
  const dynamicRefined = solveStationary(
    parameters,
    parameters.baseHalfWidth,
    parameters.dynamicRefinedIntervals
  );
  const gammaCoarse = gamma(coarse);
  const gammaFine = gamma(fine);
  const gammaExtended = gamma(extended);
  const radiusFine = supportRadius90(fine);
  const radiusExtended = supportRadius90(extended);
  const realHessian = hessianCertificate(fine, parameters, "real");
  const phaseHessian = hessianCertificate(fine, parameters, "phase");
  const baseBank = runBank(fine, parameters, parameters.dynamicCfl, false, portable);
  const timeBank = runBank(
    fine,
    parameters,
    parameters.dynamicCfl / parameters.timeRefinementFactor,
    false,
    portable
  );
  const refinedBank = runBank(
    dynamicRefined,
    parameters,
    parameters.dynamicCfl,
    true,
    portable
  );
  const worstBase = maximum(baseBank, "maximumAmplification");
  const worstTime = maximum(timeBank, "maximumAmplification");
  const worstRefined = maximum(refinedBank, "maximumAmplification");
  const metrics = {
    stationarity_max_residual_coarse: coarse.maxResidual,
    stationarity_max_residual_fine: fine.maxResidual,
    stationarity_max_residual_extended: extended.maxResidual,
    gamma_coarse: gammaCoarse,
    gamma_fine: gammaFine,
    gamma_extended: gammaExtended,
    gamma_grid_relative_change: relativeChange(gammaCoarse, gammaFine),
    gamma_domain_relative_change: relativeChange(gammaFine, gammaExtended),
    profile_grid_relative_l2: profileGridRelativeL2(coarse, fine),
    support_radius_90_fine: radiusFine,
    support_radius_90_extended: radiusExtended,
    support_radius_relative_change: relativeChange(radiusFine, radiusExtended),
    component_asymmetry_index_fine: asymmetryIndex(fine),
    energy_fine: stationaryEnergy(fine, parameters),
    real_hessian_min_block_schur_eigenvalue: realHessian.minimum,
    phase_hessian_min_block_schur_eigenvalue: phaseHessian.minimum,
    real_hessian_positive_definite: realHessian.positiveDefinite ? 1 : 0,
    phase_hessian_positive_definite: phaseHessian.positiveDefinite ? 1 : 0,
    newton_iterations_coarse: coarse.iterations,
    newton_iterations_fine: fine.iterations,
    newton_iterations_extended: extended.iterations,
    control_max_profile_relative_departure_base: maximum(baseBank, "maximumControlDeparture"),
    control_max_profile_relative_departure_refined: maximum(
      refinedBank,
      "maximumControlDeparture"
    ),
    dynamic_max_energy_relative_drift_base: maximum(baseBank, "maximumEnergyDrift"),
    dynamic_max_energy_relative_drift_refined: maximum(refinedBank, "maximumEnergyDrift"),
    dynamic_worst_amplification_base: worstBase,
    dynamic_worst_amplification_time_refined: worstTime,
    dynamic_worst_amplification_space_refined: worstRefined,
    dynamic_time_relative_change: relativeChange(worstBase, worstTime),
    dynamic_space_relative_change: relativeChange(worstTime, worstRefined),
    complex_common_phase_max_amplification_refined: requiredProbe(
      refinedBank,
      "complex-common-phase"
    ).maximumAmplification,
    complex_relative_phase_max_amplification_refined: requiredProbe(
      refinedBank,
      "complex-relative-phase"
    ).maximumAmplification,
    real_off_center_max_amplification_refined: requiredProbe(
      refinedBank,
      "real-off-center"
    ).maximumAmplification,
    complex_wave_packet_max_amplification_refined: requiredProbe(
      refinedBank,
      "complex-wave-packet"
    ).maximumAmplification
  };
  return {
    metrics,
    visualization: {
      schemaVersion: "1",
      scenarioId: parameters.scenarioId,
      stationary: {
        halfWidth: fine.halfWidth,
        intervals: fine.intervals,
        dx: traceValue(fine.dx, parameters, portable),
        x: Array.from({ length: fine.fields[0].length }, (_, index) => traceValue(
          -fine.halfWidth + (index + 1) * fine.dx,
          parameters,
          portable
        )),
        components: fine.fields.map((field) => field.map(
          (value) => traceValue(value, parameters, portable)
        ))
      },
      dynamics: refinedBank.map((probe) => ({
        id: probe.id,
        dt: traceValue(probe.dt, parameters, portable),
        steps: probe.steps,
        maximumAmplification: traceValue(probe.maximumAmplification, parameters, portable),
        departureTime: traceValue(probe.departureTime, parameters, portable),
        trace: probe.trace
      }))
    }
  };
}

function createPhaseCExpandedSolver(identity, { portable = false } = {}) {
  return defineScientificAdapter({
  ...identity,
  async evaluate(envelope) {
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      throw new TypeError("Expanded Phase-C solver requires a request envelope.");
    }
    const { requestHash, request } = envelope;
    if (typeof requestHash !== "string" || !request || typeof request !== "object") {
      throw new TypeError("Expanded Phase-C solver envelope requires requestHash and request.");
    }
    for (const field of ["id", "version", "method"]) {
      if (request.solver?.[field] !== identity[field]) {
        throw new TypeError(`Expanded Phase-C solver ${field} does not match the request.`);
      }
    }
    const parameters = validateParameters(request.parameters, { portable });
    if (portable) assertPortableQuantities(request.quantities, parameters.reportingPolicy);
    const { metrics } = runPhaseCExpandedNumerics(parameters, { portable });
    const values = {};
    for (const specification of request.quantities) {
      if (!Object.prototype.hasOwnProperty.call(metrics, specification.id)) {
        throw new TypeError(`Unsupported expanded Phase-C quantity: ${specification.id}`);
      }
      values[specification.id] = {
        value: portable
          ? portableMetricValue(
            specification.id,
            metrics[specification.id],
            parameters,
            EXPANDED_RESIDUAL_IDS
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

export const phaseCExpandedSolver = createPhaseCExpandedSolver(PHASE_C_EXPANDED_SOLVER);

export const phaseCExpandedSolverV2 = createPhaseCExpandedSolver(
  PHASE_C_EXPANDED_SOLVER_V2,
  { portable: true }
);
