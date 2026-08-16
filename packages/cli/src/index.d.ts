export const CLI_VERSION: "0.1.0";
export const CLI_OUTPUT_SCHEMA_VERSION: "1";

export const CLI_EXIT_CODES: Readonly<{
  success: 0;
  internal: 1;
  usage: 2;
  data: 3;
}>;

export type CliErrorCode =
  | "CLI_ARGUMENTS_INVALID"
  | "CLI_ARGUMENT_LIMIT_EXCEEDED"
  | "CLI_ARGUMENT_INVALID"
  | "CLI_ARGUMENT_UNEXPECTED"
  | "CLI_COMMAND_UNKNOWN"
  | "CLI_OPTION_DUPLICATE"
  | "CLI_OPTION_INVALID"
  | "CLI_OPTION_MISSING_VALUE"
  | "CLI_OPTION_UNKNOWN"
  | "CLI_POSITIONAL_MISSING";

export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(code: CliErrorCode, message: string, details?: Record<string, unknown>);
}

export interface CliWritable {
  write(chunk: string): unknown;
}

export interface RunCliOptions {
  cwd?: string;
  stdout?: CliWritable;
  stderr?: CliWritable;
}

export function runCli(
  argv: readonly string[],
  options?: RunCliOptions
): Promise<0 | 1 | 2 | 3>;
