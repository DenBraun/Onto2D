export const SCIENTIFIC_ADAPTER_STATUS: "interface-defined/external-reference-available";

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

export function defineScientificAdapter<Request = unknown, Response = unknown>(
  adapter: ScientificAdapter<Request, Response>
): Readonly<ScientificAdapter<Request, Response>>;
