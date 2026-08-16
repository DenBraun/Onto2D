import process from "node:process";
import { EngineError } from "@onto2d/engine";
import { ModelPackError } from "@onto2d/model-pack";
import { executeCommand } from "./commands.js";
import { CliError } from "./errors.js";
import { parseCliArguments } from "./parser.js";

export { CliError } from "./errors.js";

export const CLI_VERSION = "0.1.0";
export const CLI_OUTPUT_SCHEMA_VERSION = "1";
export const CLI_EXIT_CODES = Object.freeze({
  success: 0,
  internal: 1,
  usage: 2,
  data: 3
});

function output(stream, value) {
  stream.write(value);
}

function jsonLine(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeOptions(options) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("CLI options must be a plain object.");
  }
  const prototype = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("CLI options must be a plain object.");
  }
  const unknown = Object.keys(options).filter((key) => !["cwd", "stdout", "stderr"].includes(key));
  if (unknown.length > 0) throw new TypeError("CLI options contain unknown fields.");
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  if (!stdout || typeof stdout.write !== "function" || !stderr || typeof stderr.write !== "function") {
    throw new TypeError("CLI output streams require write(chunk).");
  }
  const cwd = options.cwd ?? process.cwd();
  if (typeof cwd !== "string" || cwd.length === 0 || cwd.includes("\0")) {
    throw new TypeError("CLI cwd must be a non-empty path string.");
  }
  return { stdout, stderr, cwd };
}

function failureFor(error) {
  if (error instanceof CliError) {
    return {
      exitCode: CLI_EXIT_CODES.usage,
      error: { code: error.code, message: error.message, details: error.details }
    };
  }
  if (error instanceof ModelPackError || error instanceof EngineError) {
    return {
      exitCode: CLI_EXIT_CODES.data,
      error: { code: error.code, message: error.message, details: error.details }
    };
  }
  return {
    exitCode: CLI_EXIT_CODES.internal,
    error: {
      code: "CLI_INTERNAL_ERROR",
      message: "The CLI encountered an unexpected internal failure.",
      details: { cause: error instanceof Error ? error.name : typeof error }
    }
  };
}

export async function runCli(argv, options = {}) {
  let io;
  try {
    io = normalizeOptions(options);
  } catch (error) {
    const fallback = failureFor(error);
    process.stderr.write(jsonLine({
      schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
      cliVersion: CLI_VERSION,
      ok: false,
      command: null,
      error: fallback.error
    }));
    return fallback.exitCode;
  }

  let command = Array.isArray(argv) && typeof argv[0] === "string" && !argv[0].startsWith("--")
    ? argv[0]
    : null;
  try {
    const parsed = parseCliArguments(argv);
    command = parsed.command ?? null;
    if (parsed.kind === "help") {
      output(io.stdout, parsed.text);
      return CLI_EXIT_CODES.success;
    }
    if (parsed.kind === "version") {
      output(io.stdout, `${CLI_VERSION}\n`);
      return CLI_EXIT_CODES.success;
    }
    const result = await executeCommand(parsed, io.cwd);
    output(io.stdout, jsonLine({
      schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
      cliVersion: CLI_VERSION,
      ok: true,
      command: parsed.command,
      result
    }));
    return CLI_EXIT_CODES.success;
  } catch (error) {
    const failure = failureFor(error);
    output(io.stderr, jsonLine({
      schemaVersion: CLI_OUTPUT_SCHEMA_VERSION,
      cliVersion: CLI_VERSION,
      ok: false,
      command,
      error: failure.error
    }));
    return failure.exitCode;
  }
}
