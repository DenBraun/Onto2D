import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEVEL_ZERO_REFERENCE_SOLVER,
  LEVEL_ZERO_SOLVER_LIMITS,
  LEVEL_ZERO_SOLVER_STATUS,
  LevelZeroSolverError,
  levelZeroReferenceSolver
} from "../src/index.js";

const REQUEST_HASH = `sha256:${"a".repeat(64)}`;
const EVIDENCE_HASH = `sha256:${"b".repeat(64)}`;

function parameters(coarseGrid = 32) {
  return {
    modes: [{ id: "manufactured-mode", A: 0.75, k: 1, omega: 2, m2: 3, phase: 0.4 }],
    spacePeriod: 2 * Math.PI,
    timePeriod: Math.PI,
    coarseGrid,
    fineGrid: coarseGrid * 2,
    roundingSignificantDigits: 15,
    reportedAbsoluteTolerance: 1e-10,
    evidenceIds: [EVIDENCE_HASH]
  };
}

function envelope(overrides = {}) {
  return {
    requestHash: REQUEST_HASH,
    request: {
      candidate: {},
      quantities: [
        {
          id: "stationarity_l2_residual_coarse",
          unit: "1",
          semantic: "manufactured-coarse-residual"
        },
        {
          id: "stationarity_l2_residual_fine",
          unit: "1",
          semantic: "manufactured-fine-residual"
        },
        {
          id: "stationarity_observed_order",
          unit: "1",
          semantic: "manufactured-observed-order"
        }
      ],
      parameters: parameters(),
      toleranceTarget: { absolute: 1e-10 },
      solver: LEVEL_ZERO_REFERENCE_SOLVER,
      ...overrides
    }
  };
}

function analyticResidual(mode, grid, spacePeriod, timePeriod) {
  const dx = spacePeriod / grid;
  const dt = timePeriod / grid;
  const coefficient =
    -4 * Math.sin(mode.omega * dt / 2) ** 2 / dt ** 2 +
    4 * Math.sin(mode.k * dx / 2) ** 2 / dx ** 2 +
    mode.m2;
  return Math.abs(mode.A * coefficient);
}

test("the published solver exposes a stable bounded adapter identity", () => {
  assert.equal(LEVEL_ZERO_SOLVER_STATUS, "phase-b-reference-ready");
  assert.deepEqual(LEVEL_ZERO_SOLVER_LIMITS, {
    maxModes: 64,
    maxGrid: 1024,
    maxGridModeCells: 5_000_000,
    maxQuantities: 8,
    maxEvidenceIds: 64
  });
  assert.deepEqual(
    {
      id: levelZeroReferenceSolver.id,
      version: levelZeroReferenceSolver.version,
      method: levelZeroReferenceSolver.method
    },
    LEVEL_ZERO_REFERENCE_SOLVER
  );
  assert.ok(Object.isFrozen(levelZeroReferenceSolver));
});

test("a manufactured periodic mode agrees with the analytic discrete operator", async () => {
  for (const coarseGrid of [32, 64]) {
    const requestEnvelope = envelope({ parameters: parameters(coarseGrid) });
    const response = await levelZeroReferenceSolver.evaluate(requestEnvelope);
    const mode = requestEnvelope.request.parameters.modes[0];
    const expectedCoarse = analyticResidual(
      mode,
      coarseGrid,
      requestEnvelope.request.parameters.spacePeriod,
      requestEnvelope.request.parameters.timePeriod
    );
    const expectedFine = analyticResidual(
      mode,
      coarseGrid * 2,
      requestEnvelope.request.parameters.spacePeriod,
      requestEnvelope.request.parameters.timePeriod
    );
    assert.ok(
      Math.abs(response.values.stationarity_l2_residual_coarse.value - expectedCoarse) < 1e-11
    );
    assert.ok(
      Math.abs(response.values.stationarity_l2_residual_fine.value - expectedFine) < 1e-11
    );
    assert.ok(response.values.stationarity_observed_order.value > 1.99);
  }
});

test("the solver is deterministic and preserves exact request evidence", async () => {
  const requestEnvelope = envelope();
  const first = await levelZeroReferenceSolver.evaluate(requestEnvelope);
  const second = await levelZeroReferenceSolver.evaluate(structuredClone(requestEnvelope));
  assert.deepEqual(first, second);
  assert.equal(first.requestHash, REQUEST_HASH);
  for (const quantity of Object.values(first.values)) {
    assert.deepEqual(quantity.provenance.evidence, [EVIDENCE_HASH]);
    assert.equal(quantity.provenance.source, REQUEST_HASH);
  }
});

test("invalid, mismatched, unsupported, and over-limit requests remain distinct", async () => {
  await assert.rejects(
    levelZeroReferenceSolver.evaluate(null),
    (error) => error instanceof LevelZeroSolverError && error.code === "LEVEL_ZERO_REQUEST_INVALID"
  );
  await assert.rejects(
    levelZeroReferenceSolver.evaluate(envelope({
      solver: { ...LEVEL_ZERO_REFERENCE_SOLVER, version: "stale" }
    })),
    (error) => error instanceof LevelZeroSolverError && error.code === "LEVEL_ZERO_SOLVER_MISMATCH"
  );
  await assert.rejects(
    levelZeroReferenceSolver.evaluate(envelope({
      quantities: [{ id: "unknown", unit: "1", semantic: "unknown" }]
    })),
    (error) => error instanceof LevelZeroSolverError && error.code === "LEVEL_ZERO_QUANTITY_UNSUPPORTED"
  );
  await assert.rejects(
    levelZeroReferenceSolver.evaluate(envelope({ parameters: parameters(1024) })),
    (error) =>
      error instanceof LevelZeroSolverError && error.code === "LEVEL_ZERO_RESOURCE_LIMIT_EXCEEDED"
  );
});

test("the external solver package does not import the kernel", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /@onto2d\/kernel|packages\/kernel/);
});
