export type ContentHash = `sha256:${string}`;
export type BenchmarkClaimClass = "synthetic" | "semantic" | "normative";
export type BenchmarkDesignClass = "synthetic-control" | "exact";
export type BenchmarkVerdict = "positive" | "negative" | "neutral-within-resolution" | "indeterminate" | "invalid" | "not-evaluated";
export type BenchmarkStatus = "NOT_ELIGIBLE" | "ILLUSTRATIVE" | "CONTRACT_DRAFT" | "CONTRAST_READY" | "EVALUATION_READY" | "EVALUATED" | "REPLICATED" | "REVIEWED";
export type NullRole = "diagnostic" | "require-better-than-null-mean";
export type DeepReadonly<T> = T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } : T;
export interface HistoryBenchmarkContract {
  schemaVersion: "1";
  benchmarkId: string;
  caseId: string;
  claimClass: BenchmarkClaimClass;
  designClass: BenchmarkDesignClass;
  historyMode: "recorded" | "embodied" | "reconstructed";
  effect: "identity" | "present-state" | "future";
  population: string;
  cutoffPolicy: "per-unit-ordinal";
  presentView: string;
  historyView: string;
  targetView: string;
  selectionPolicy: { strategy: "complete-source-population"; targetBlind: true };
  splitPolicy: "complete-census";
  evaluator: { id: "identity-partition-v1"; version: "1"; implementationHash: ContentHash };
  primaryMetric: { id: "pairwise-error"; direction: "lower-is-better"; resolution: number };
  nullModel: { id: "history-permutation-v1"; seed: number; trials: number; role: NullRole };
  bindings: { observationsHash: ContentHash; targetsHash: ContentHash; builderHash: ContentHash };
  sources: { path: string; sha256: ContentHash }[];
  interpretationBoundary: string;
}
export interface HistoryObservation { time: number; value: string }
export interface HistoryObservations {
  schemaVersion: "1";
  units: { unitId: string; cutoff: number; present: HistoryObservation; history: HistoryObservation[] }[];
}
export interface HistoryTargets {
  schemaVersion: "1";
  records: { unitId: string; time: number; label: string | null }[];
}
export interface HistoryBenchmarkInputs { observations: HistoryObservations; targets: HistoryTargets }
export interface HistoryBenchmarkOptions { maxNullTrials?: number }
export interface HistoryBenchmarkView {
  schemaVersion: "1";
  observationsHash: ContentHash;
  builderHash: ContentHash;
  role: "present" | "history";
  records: { unitId: string; cutoff: number; events: HistoryObservation[] }[];
  hash: ContentHash;
}
export interface HistoryBenchmarkSplit { schemaVersion: "1"; strategy: "complete-census"; unitIds: string[]; hash: ContentHash }
export interface PairwiseScore { errors: number; pairs: number; value: number | null }
export interface HistoryBenchmarkResult {
  schemaVersion: "1";
  benchmarkId: string;
  caseId: string;
  claimClass: BenchmarkClaimClass;
  designClass: BenchmarkDesignClass;
  contractHash: ContentHash;
  inputs: {
    observationsHash: ContentHash; targetHash: ContentHash; presentViewHash: ContentHash | null;
    historyViewHash: ContentHash | null; splitHash: ContentHash | null; evaluatorHash: ContentHash;
  };
  primary: null | {
    metric: "pairwise-error"; direction: "lower-is-better"; presentOnly: PairwiseScore; presentPlusHistory: PairwiseScore;
    orientedGain: number; resolution: number;
  };
  nulls: {
    id: "history-permutation-v1"; role: NullRole; status: "not-evaluated" | "complete" | "exhausted";
    requestedTrials: number; trials: (PairwiseScore & { trial: number; donorUnitIds: string[] })[];
    meanError: number | null; trueHistoryBeatsNullMean: boolean | null;
  };
  verdict: BenchmarkVerdict;
  issues: { code: string; message: string }[];
  interpretationBoundary: string;
  hash: ContentHash;
}
export interface HistoryBenchmarkSuite {
  schemaVersion: "1"; suiteId: "history-matters-pilot";
  results: { benchmarkId: string; claimClass: BenchmarkClaimClass; designClass: BenchmarkDesignClass; verdict: BenchmarkVerdict; resultHash: ContentHash }[];
  hash: ContentHash;
}
export const HISTORY_BENCHMARK_VERSION: "1";
export const HISTORY_BENCHMARK_VERDICTS: readonly BenchmarkVerdict[];
export const HISTORY_BENCHMARK_STATUSES: readonly BenchmarkStatus[];
export class HistoryBenchmarkError extends Error { readonly code: string; constructor(code: string, message: string) }
export function contentHash(kind: string, value: unknown): ContentHash;
export function validateHistoryBenchmarkContract(input: unknown): DeepReadonly<HistoryBenchmarkContract>;
export function normalizeObservations(input: unknown): DeepReadonly<HistoryObservations>;
export function normalizeTargets(input: unknown): DeepReadonly<HistoryTargets>;
export function buildHistoryBenchmarkViews(contract: DeepReadonly<HistoryBenchmarkContract>, observations: DeepReadonly<HistoryObservations>): DeepReadonly<{ present: HistoryBenchmarkView; history: HistoryBenchmarkView; split: HistoryBenchmarkSplit }>;
export function runHistoryBenchmark(contract: DeepReadonly<HistoryBenchmarkContract>, inputs: DeepReadonly<HistoryBenchmarkInputs>, options?: HistoryBenchmarkOptions): DeepReadonly<HistoryBenchmarkResult>;
export function verifyHistoryBenchmarkResult(result: unknown, contract: DeepReadonly<HistoryBenchmarkContract>, inputs: DeepReadonly<HistoryBenchmarkInputs>, options?: HistoryBenchmarkOptions): DeepReadonly<HistoryBenchmarkResult>;
export function buildHistoryBenchmarkSuite(entries: readonly DeepReadonly<{ contract: HistoryBenchmarkContract; inputs: HistoryBenchmarkInputs; result: HistoryBenchmarkResult }>[]): DeepReadonly<HistoryBenchmarkSuite>;
