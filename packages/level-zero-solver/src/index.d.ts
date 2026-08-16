import type { ScientificAdapter } from "@onto2d/scientific-adapter";

export const LEVEL_ZERO_SOLVER_STATUS: "phase-b-reference-ready";

export const LEVEL_ZERO_REFERENCE_SOLVER: Readonly<{
  id: "onto2d-level-0-reference-solver";
  version: "1.0.0";
  method: "periodic-second-order-central-difference-v1";
}>;

export const LEVEL_ZERO_SOLVER_LIMITS: Readonly<{
  maxModes: 64;
  maxGrid: 1024;
  maxGridModeCells: 5_000_000;
  maxQuantities: 8;
  maxEvidenceIds: 64;
}>;

export type LevelZeroSolverErrorCode =
  | "LEVEL_ZERO_REQUEST_INVALID"
  | "LEVEL_ZERO_SOLVER_MISMATCH"
  | "LEVEL_ZERO_QUANTITY_UNSUPPORTED"
  | "LEVEL_ZERO_PARAMETER_INVALID"
  | "LEVEL_ZERO_RESOURCE_LIMIT_EXCEEDED"
  | "LEVEL_ZERO_NUMERICAL_FAILURE";

export interface LevelZeroMode {
  readonly id?: string;
  readonly A: number;
  readonly k: number;
  readonly omega: number;
  readonly m2: number;
  readonly phase: number;
}

export interface LevelZeroSolverParameters {
  readonly modelId?: string;
  readonly modelVersion?: string;
  readonly modelHash?: string;
  readonly scenarioId?: string;
  readonly modes: readonly LevelZeroMode[];
  readonly spacePeriod: number;
  readonly timePeriod: number;
  readonly coarseGrid: number;
  readonly fineGrid: number;
  readonly roundingSignificantDigits: number;
  readonly reportedAbsoluteTolerance: number;
  readonly evidenceIds: readonly string[];
}

export interface LevelZeroQuantitySpecification {
  readonly id: string;
  readonly unit: string;
  readonly semantic: string;
  readonly toleranceTarget: Readonly<{ absolute?: number; relative?: number }>;
}

export interface LevelZeroSolverRequest {
  readonly solver: typeof LEVEL_ZERO_REFERENCE_SOLVER;
  readonly quantities: readonly LevelZeroQuantitySpecification[];
  readonly parameters: LevelZeroSolverParameters;
  readonly candidate: Readonly<{
    schemaVersion: string;
    bytesBase64: string;
    hash: string;
  }>;
  readonly toleranceTarget: Readonly<{ absolute?: number; relative?: number }>;
}

export interface LevelZeroSolverEnvelope {
  readonly requestHash: string;
  readonly request: LevelZeroSolverRequest;
}

export interface LevelZeroSolverResponse {
  readonly requestHash: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly convergence: "converged";
  readonly solver: Readonly<{
    id: typeof LEVEL_ZERO_REFERENCE_SOLVER.id;
    version: typeof LEVEL_ZERO_REFERENCE_SOLVER.version;
    method: typeof LEVEL_ZERO_REFERENCE_SOLVER.method;
    parameters: LevelZeroSolverParameters;
  }>;
  readonly wallTimeMs: 0;
}

export class LevelZeroSolverError extends Error {
  readonly code: LevelZeroSolverErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    code: LevelZeroSolverErrorCode,
    message: string,
    details?: Record<string, unknown>
  );
  toJSON(): {
    name: "LevelZeroSolverError";
    code: LevelZeroSolverErrorCode;
    message: string;
    details: Readonly<Record<string, unknown>>;
  };
}

export const levelZeroReferenceSolver: Readonly<
  ScientificAdapter<LevelZeroSolverEnvelope, LevelZeroSolverResponse>
>;
