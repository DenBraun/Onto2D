import type { ContentHash, ModelPack } from "@onto2d/model-pack";
import type { Model } from "@onto2d/engine";
import type { StructuralContractReference, StructuralRegimeInput, StructuralRegimePreparation } from "./regimes.js";
import type { StructuralEdgeTypes } from "./typed.js";

export type StructuralSandboxTransformation = { readonly kind: "identity" } |
  { readonly kind: "remove-edges" | "reverse-edges"; readonly targets: "all-scoped-edges" | "each-scoped-edge" };
export interface StructuralProbeSandboxInput extends StructuralRegimeInput { readonly transformation: StructuralSandboxTransformation }
export interface StructuralProbeSandboxPolicy extends StructuralContractReference {
  readonly id: "immutable-structural-probe-sandbox-v1";
  readonly source: "verified-full-model-with-unchanged-regime-preparation";
  readonly derivedGraph: "separate-source-bound-shadow-graph";
  readonly operations: readonly ["identity", "remove-edges", "reverse-edges"];
  readonly targets: "whole-scope-or-exhaustive-all-each-internal-edge";
  readonly ordering: "source-id-serialization-only-no-tie-selection";
  readonly copies: "every-target-starts-from-baseline"; readonly nodes: "retain-all-scoped-nodes";
  readonly annotations: "untyped-excludes-typed-preserves-five-present-fields";
  readonly reversalTypes: "carried-without-semantic-recoding";
  readonly parallelEdges: "reject-target-without-merging"; readonly emptyTargets: "unavailable-zero-runs";
  readonly invalidInput: "error-no-partial-result"; readonly observations: "not-run";
  readonly codeExecution: "closed-data-operations-only";
  readonly work: "baseline-edges-examined-once-per-target-excludes-source-validation-and-serialization";
  readonly limits: { readonly maxTargets: 32; readonly maxTransformationEdgeVisits: 1024;
    readonly maxCanonicalEntries: 500000; readonly maxArtifactBytes: 4194304 };
}
export interface StructuralShadowGraph {
  readonly schemaVersion: "1"; readonly kind: "structural-shadow-graph";
  readonly regime: StructuralContractReference;
  readonly source: { readonly contextHash: ContentHash; readonly scopeHash: ContentHash };
  readonly nodes: readonly { readonly id: string }[];
  readonly edges: readonly { readonly id: string; readonly source: string; readonly target: string;
    readonly types?: Readonly<Partial<StructuralEdgeTypes>> }[];
  readonly graphHash: ContentHash;
}
export interface StructuralSandboxTarget {
  readonly kind: "whole-scope" | "all-scoped-edges" | "single-scoped-edge";
  readonly sourceEdgeIds: readonly string[]; readonly shadowEdgeIds: readonly string[];
}
export type StructuralSandboxEdgeMapping =
  { readonly sourceEdgeId: string; readonly beforeEdgeId: string; readonly afterEdgeId: string; readonly action: "preserved" | "reversed" } |
  { readonly sourceEdgeId: string; readonly beforeEdgeId: string; readonly afterEdgeId: null; readonly action: "removed" };
interface StructuralSandboxRunBody {
  readonly target: StructuralSandboxTarget; readonly transformation: StructuralSandboxTransformation;
  readonly beforeGraphHash: ContentHash; readonly runHash: ContentHash;
}
export type StructuralSandboxRun = StructuralSandboxRunBody & (
  { readonly execution: "applied"; readonly rejection: null; readonly graph: StructuralShadowGraph;
    readonly edgeMapping: readonly StructuralSandboxEdgeMapping[];
    readonly changes: { readonly removedSourceEdgeIds: readonly string[]; readonly reversedSourceEdgeIds: readonly string[] } } |
  { readonly execution: "rejected";
    readonly rejection: { readonly code: "parallel-edge-after-reversal"; readonly sourceEdgeIds: readonly [string, string] };
    readonly graph: null; readonly edgeMapping: null; readonly changes: null }
);
export interface StructuralProbeSandboxArtifact {
  readonly schemaVersion: "1";
  readonly analysis: { readonly id: "structural-probe-sandbox"; readonly version: "1" };
  readonly policy: StructuralProbeSandboxPolicy;
  readonly request: StructuralRegimePreparation["request"] & { readonly transformation: StructuralSandboxTransformation };
  readonly preparation: StructuralRegimePreparation;
  readonly baseline: { readonly graph: StructuralShadowGraph; readonly mapping: {
    readonly nodes: readonly { readonly sourceNodeId: string; readonly shadowNodeId: string }[];
    readonly edges: readonly { readonly sourceEdgeId: string; readonly shadowEdgeId: string }[];
  } };
  readonly selection: { readonly kind: "whole-scope" | "all-scoped-edges" | "each-scoped-edge";
    readonly eligibleSourceEdgeIds: readonly string[]; readonly eligibleShadowEdgeIds: readonly string[] };
  readonly observationEvaluation: "not-run";
  readonly execution:
    { readonly state: "completed"; readonly reason: null; readonly targetCount: number; readonly appliedCount: number; readonly rejectedCount: number } |
    { readonly state: "unavailable"; readonly reason: "empty-target-set"; readonly targetCount: 0; readonly appliedCount: 0; readonly rejectedCount: 0 };
  readonly work: { readonly transformationEdgeVisits: number; readonly outputGraphCount: number };
  readonly runs: readonly StructuralSandboxRun[];
  readonly artifactHash: ContentHash;
}
export const STRUCTURAL_PROBE_SANDBOX_POLICY: StructuralProbeSandboxPolicy;
export const STRUCTURAL_PROBE_SANDBOX_INPUT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-probe-sandbox-input.schema.json";
export const STRUCTURAL_PROBE_SANDBOX_ARTIFACT_SCHEMA: "https://onto2d.dev/schemas/v1/structural-probe-sandbox-artifact.schema.json";
export function runStructuralProbeSandbox(pack: ModelPack, input: StructuralProbeSandboxInput): StructuralProbeSandboxArtifact;
export function verifyStructuralProbeSandbox(value: unknown, pack: ModelPack, input: StructuralProbeSandboxInput): StructuralProbeSandboxArtifact;
export interface StructuralProbeSandboxAnalysisDefinition {
  readonly id: "structural-probe-sandbox"; readonly version: "1";
  readonly requiredModelCapabilities: readonly []; readonly requiredAdapterCapabilities: readonly [];
  readonly inputSchema: typeof STRUCTURAL_PROBE_SANDBOX_INPUT_SCHEMA;
  readonly outputArtifacts: readonly [typeof STRUCTURAL_PROBE_SANDBOX_ARTIFACT_SCHEMA];
  run(context: { readonly model: Model }, input: StructuralProbeSandboxInput): StructuralProbeSandboxArtifact;
}
export function createStructuralProbeSandboxAnalysis(): StructuralProbeSandboxAnalysisDefinition;
