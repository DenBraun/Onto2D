export const SCIENTIFIC_ADAPTER_STATUS: "interface-defined/implementations-pending";

export class InvalidScientificAdapterError extends TypeError {
  readonly code: "SCIENTIFIC_ADAPTER_INVALID";
  constructor(message: string);
}

export interface ScientificAdapter<Request = unknown, Response = unknown> {
  readonly id: string;
  readonly version: string;
  readonly method: string;
  evaluate(request: Request): Response | Promise<Response>;
}

export function defineScientificAdapter<T extends ScientificAdapter>(
  adapter: T
): Readonly<T>;
