import type { ContentHash, DeepReadonly, HistoryBenchmarkOptions, BenchmarkVerdict } from "./index.js";
export interface RegressionSample {
  sampleId: string; unitId: string; split: "train" | "test"; cutoff: number;
  presentTime: number; historyStart: number; historyEnd: number;
  present: number[]; history: number[]; recordHash: ContentHash;
}
export interface RegressionDataset {
  schemaVersion: "1"; presentFeatures: string[]; historyFeatures: string[]; samples: RegressionSample[];
}
export interface RegressionTargets {
  schemaVersion: "1"; records: { sampleId: string; value: number | null }[];
}
export interface HistoryRegressionContract {
  schemaVersion: "1"; benchmarkId: string; caseId: string; claimClass: "synthetic" | "empirical";
  designClass: "predictive"; historyMode: "recorded" | "embodied" | "reconstructed"; effect: "future";
  population: string; presentView: string; historyView: string; targetView: string;
  splitPolicy: "unit-disjoint"; preprocessing: "training-min-max-no-clipping";
  evaluator: { id: "unit-nearest-neighbor-regression-v1"; neighbors: number; tieBreak: "sample-id"; implementationHash: ContentHash };
  primaryMetric: { id: "mae"; resolution: number; units: "cycles" }; secondaryMetrics: ["rmse"];
  nullModel: { id: "test-history-permutation-v1"; seed: number; trials: number; stratum: "one-declared-population" };
  bindings: { datasetHash: ContentHash; trainingTargetsHash: ContentHash; heldOutTargetSourceHash: ContentHash; builderHash: ContentHash; protocolHash: ContentHash };
  interpretationBoundary: string;
}
export interface RegressionRange { minimum: number; maximum: number; active: boolean }
export interface RegressionPrediction {
  sampleId: string; value: number;
  neighbors: { sampleId: string; unitId: string; distance: number; value: number }[];
}
export interface HistoryRegressionPreparation {
  schemaVersion: "1"; benchmarkId: string; contractHash: ContentHash; status: "prepared" | "incomplete";
  counts: { trainingSamples: number; trainingUnits: number; testSamples: number; testUnits: number };
  normalization: { present: RegressionRange[]; history: RegressionRange[]; age: RegressionRange[] };
  views: { P0: RegressionPrediction[]; P1: RegressionPrediction[]; P0Age: RegressionPrediction[]; P1Age: RegressionPrediction[] };
  nulls: { status: "complete" | "exhausted"; requestedTrials: number;
    trials: { trial: number; donorSampleIds: string[]; predictions: RegressionPrediction[] }[] };
  hash: ContentHash;
}
export interface RegressionMetric { count: number; mae: number; rmse: number }
export interface HistoryRegressionResult {
  schemaVersion: "1"; benchmarkId: string; claimClass: "synthetic" | "empirical";
  preparationHash: ContentHash; targetHash: ContentHash;
  primary: null | { metric: "mae"; units: "cycles"; presentOnly: RegressionMetric; presentPlusHistory: RegressionMetric; orientedGain: number; resolution: number };
  ageSensitivity: null | { presentWithAge: RegressionMetric; presentWithAgeAndHistory: RegressionMetric; orientedGain: number };
  nulls: { status: "complete" | "exhausted"; trialMae: number[]; meanMae: number | null; trueHistoryBeatsNullMean: boolean | null };
  verdict: BenchmarkVerdict; interpretationBoundary: string; hash: ContentHash;
}
export function normalizeRegressionDataset(input: unknown): DeepReadonly<RegressionDataset>;
export function normalizeRegressionTargets(input: unknown): DeepReadonly<RegressionTargets>;
export function validateHistoryRegressionContract(input: unknown): DeepReadonly<HistoryRegressionContract>;
export function prepareHistoryRegression(contract: DeepReadonly<HistoryRegressionContract>, data: DeepReadonly<RegressionDataset>, trainingTargets: DeepReadonly<RegressionTargets>, options?: HistoryBenchmarkOptions): DeepReadonly<HistoryRegressionPreparation>;
export function verifyHistoryRegressionPreparation(value: unknown, contract: DeepReadonly<HistoryRegressionContract>, data: DeepReadonly<RegressionDataset>, trainingTargets: DeepReadonly<RegressionTargets>, options?: HistoryBenchmarkOptions): DeepReadonly<HistoryRegressionPreparation>;
export function scoreHistoryRegression(contract: DeepReadonly<HistoryRegressionContract>, data: DeepReadonly<RegressionDataset>, trainingTargets: DeepReadonly<RegressionTargets>, heldOutTargets: DeepReadonly<RegressionTargets>, options?: HistoryBenchmarkOptions): DeepReadonly<HistoryRegressionResult>;
