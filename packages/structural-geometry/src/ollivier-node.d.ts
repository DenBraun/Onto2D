import type { OllivierAdapter } from "./ollivier.js";

export interface PythonOllivierAdapterOptions {
  readonly pythonExecutable?: string;
  readonly timeoutMs?: number;
}
/** Starts the packaged standard-library Python reference with bounded pipes and deadline. */
export function createPythonOllivierAdapter(options?: PythonOllivierAdapterOptions): OllivierAdapter;
