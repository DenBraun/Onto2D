import type {
  ArtifactRef,
  ContentHash,
  PackageRunArtifactBundle,
  PackageRunArtifactEntry
} from "@onto2d/kernel";

export type PackageRunArtifactDirectoryStatus =
  | "written"
  | "already-present"
  | "verified";

export interface PackageRunArtifactDirectoryOptions {
  expectedKernelVersion?: string;
  maxBundleBytes?: number;
  maxExecutionRecordBytes?: number;
  maxExecutionRecords?: number;
}

export type PackageRunExecutionTerminalStatus =
  | "complete"
  | "failed"
  | "cancelled";

export type PackageRunExhaustedBudget =
  | "maxNodes"
  | "maxEdges"
  | "maxCandidates"
  | "perturbationSamples"
  | "nullModelRuns"
  | "maxWallTimeMs"
  | "maxResidentBytes";

export interface PackageRunResourceUsage {
  generatedCandidates: number;
  perturbations: number;
  nullTrials: number;
  wallTimeMs: number;
  peakResidentBytes?: number;
  exhausted: PackageRunExhaustedBudget | null;
}

export interface PackageRunExecutionRecordInput {
  runHash: ContentHash;
  startedAt: string;
  completedAt: string | null;
  engineBuild: string;
  platform?: string;
  resourceUsage: PackageRunResourceUsage;
  terminalStatus: PackageRunExecutionTerminalStatus;
}

export interface PackageRunExecutionRecord
  extends PackageRunExecutionRecordInput {
  schemaVersion: "1";
  recorder: "package-run-execution-record-v1";
  executionId: ContentHash;
}

export interface PackageRunExecutionRecordReceipt {
  schemaVersion: "1";
  writer: "package-run-execution-record-v1";
  status: "written" | "already-present";
  directory: string;
  runHash: ContentHash;
  executionId: ContentHash;
  recordRef: ArtifactRef;
}

export interface PackageRunArtifactDirectoryReceipt {
  schemaVersion: "1";
  writer: "package-run-artifact-directory-v1";
  status: PackageRunArtifactDirectoryStatus;
  directory: string;
  bundleHash: ContentHash;
  runHash: ContentHash;
  targetDepth: number;
  bundleRef: ArtifactRef;
  artifacts: PackageRunArtifactEntry[];
  counts: {
    files: number;
    artifacts: number;
    bytes: number;
  };
}

export interface ReadPackageRunArtifactBundleResult {
  bundle: PackageRunArtifactBundle;
  receipt: PackageRunArtifactDirectoryReceipt & { status: "verified" };
}

export const PACKAGE_RUN_ARTIFACT_DIRECTORY_VERSION:
  "package-run-artifact-directory-v1";
export const PACKAGE_RUN_ARTIFACT_ENVELOPE_PATH: "artifact-bundle.json";
export const PACKAGE_RUN_EXECUTION_RECORD_VERSION:
  "package-run-execution-record-v1";
export const PACKAGE_RUN_EXECUTION_DIRECTORY: "execution";
export const PACKAGE_RUN_ARTIFACT_DIRECTORY_LIMITS: Readonly<{
  maxBundleBytes: 536870912;
  maxExecutionRecordBytes: 1048576;
  maxExecutionRecords: 10000;
}>;
export const RUN_STORE_STATUS:
  "verified-directory-persistence-active/execution-records-active";
export const RUN_STORE_CAPABILITIES: Readonly<{
  implemented: readonly string[];
  pending: readonly string[];
}>;

export function writePackageRunArtifactBundle(
  bundle: PackageRunArtifactBundle,
  runsDirectory: string,
  options?: PackageRunArtifactDirectoryOptions
): Promise<PackageRunArtifactDirectoryReceipt>;

export function readPackageRunArtifactBundle(
  directory: string,
  options?: PackageRunArtifactDirectoryOptions
): Promise<ReadPackageRunArtifactBundleResult>;

export function createPackageRunExecutionRecord(
  input: PackageRunExecutionRecordInput
): PackageRunExecutionRecord;

export function verifyPackageRunExecutionRecord(
  record: PackageRunExecutionRecord,
  expectedRunHash?: ContentHash
): PackageRunExecutionRecord;

export function writePackageRunExecutionRecord(
  record: PackageRunExecutionRecord,
  directory: string,
  options?: PackageRunArtifactDirectoryOptions
): Promise<PackageRunExecutionRecordReceipt>;

export function readPackageRunExecutionRecords(
  directory: string,
  options?: PackageRunArtifactDirectoryOptions
): Promise<readonly PackageRunExecutionRecord[]>;
