import type { StructuralFlowAdapter } from "./flow.js";
export interface PythonStructuralFlowAdapterOptions {
  readonly pythonExecutable?: string;
  readonly timeoutMs?: number;
}
/** Runs the packaged exact reference with isolated Python, bounded pipes and a deadline. */
export function createPythonStructuralFlowAdapter(options?: PythonStructuralFlowAdapterOptions): StructuralFlowAdapter;
