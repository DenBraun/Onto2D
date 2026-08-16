import { cliFail } from "./errors.js";

const MAX_ARGUMENTS = 32;
const MAX_ARGUMENT_LENGTH = 65_536;
const MAX_SELECTOR_DEPTH = 64;
const MAX_SELECTOR_VALUES = 10_000;
const DIRECTIONS = new Set(["parents", "children", "both"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const GENERAL_HELP = `Onto2D CLI

Usage:
  onto2d verify <source>
  onto2d node <source> <node-id>
  onto2d neighborhood <source> <node-id> [options]
  onto2d paths <source> <from-id> <to-id> [options]
  onto2d --help
  onto2d --version

Source:
  <source> is a local split Model Pack directory or bounded ZIP archive.

Neighborhood options:
  --depth <0..64>
  --direction <parents|children|both>
  --selector <json-object>

Path options:
  --maximum-paths <1..10000>
  --selector <json-object>
`;

const COMMAND_HELP = Object.freeze({
  verify: "Usage: onto2d verify <source>\n",
  node: "Usage: onto2d node <source> <node-id>\n",
  neighborhood: `Usage: onto2d neighborhood <source> <node-id> [options]

Options:
  --depth <0..64>
  --direction <parents|children|both>
  --selector <json-object>
`,
  paths: `Usage: onto2d paths <source> <from-id> <to-id> [options]

Options:
  --maximum-paths <1..10000>
  --selector <json-object>
`
});

function validateArgv(argv) {
  if (!Array.isArray(argv)) {
    cliFail("CLI_ARGUMENTS_INVALID", "CLI arguments must be an array.");
  }
  if (argv.length > MAX_ARGUMENTS) {
    cliFail("CLI_ARGUMENT_LIMIT_EXCEEDED", "CLI argument count exceeds the supported limit.", {
      maximum: MAX_ARGUMENTS
    });
  }
  for (const [index, argument] of argv.entries()) {
    if (
      typeof argument !== "string" ||
      argument.length === 0 ||
      argument.length > MAX_ARGUMENT_LENGTH ||
      argument.includes("\0")
    ) {
      cliFail("CLI_ARGUMENT_INVALID", "CLI argument must be a non-empty bounded string.", {
        index
      });
    }
  }
}

function parseInteger(value, flag, minimum, maximum) {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) {
    cliFail("CLI_OPTION_INVALID", `${flag} requires a base-10 integer.`, { flag });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    cliFail("CLI_OPTION_INVALID", `${flag} is outside the supported range.`, {
      flag,
      minimum,
      maximum
    });
  }
  return parsed;
}

function sortJson(value, depth = 0, budget = { count: 0 }) {
  budget.count += 1;
  if (depth > MAX_SELECTOR_DEPTH || budget.count > MAX_SELECTOR_VALUES) {
    cliFail("CLI_OPTION_INVALID", "--selector exceeds the supported structure limits.", {
      flag: "--selector",
      maximumDepth: MAX_SELECTOR_DEPTH,
      maximumValues: MAX_SELECTOR_VALUES
    });
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    cliFail("CLI_OPTION_INVALID", "--selector numbers must be finite.", { flag: "--selector" });
  }
  if (Array.isArray(value)) return value.map((entry) => sortJson(entry, depth + 1, budget));
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const forbidden = keys.find((key) => FORBIDDEN_KEYS.has(key));
    if (forbidden !== undefined) {
      cliFail("CLI_OPTION_INVALID", "--selector contains a prototype-sensitive key.", {
        flag: "--selector",
        key: forbidden
      });
    }
    return Object.fromEntries(keys.map((key) => [key, sortJson(value[key], depth + 1, budget)]));
  }
  return value;
}

function parseSelector(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    cliFail("CLI_OPTION_INVALID", "--selector must contain valid JSON.", { flag: "--selector" });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    cliFail("CLI_OPTION_INVALID", "--selector must contain a JSON object.", {
      flag: "--selector"
    });
  }
  return sortJson(parsed);
}

function parseOptions(tokens, definitions) {
  const options = {};
  const seen = new Set();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const definition = definitions[flag];
    if (!definition) {
      cliFail("CLI_OPTION_UNKNOWN", "Unknown CLI option.", { flag });
    }
    if (seen.has(flag)) {
      cliFail("CLI_OPTION_DUPLICATE", "CLI options must not be repeated.", { flag });
    }
    if (tokens[index + 1] === undefined) {
      cliFail("CLI_OPTION_MISSING_VALUE", "CLI option requires a value.", { flag });
    }
    seen.add(flag);
    options[definition.name] = definition.parse(tokens[index + 1]);
  }
  return Object.freeze(options);
}

function requireCount(command, argv, positionalCount) {
  if (argv.length < positionalCount + 1) {
    cliFail("CLI_POSITIONAL_MISSING", "CLI command is missing a required positional argument.", {
      command
    });
  }
}

export function parseCliArguments(argv) {
  validateArgv(argv);
  if (argv.length === 0) {
    return Object.freeze({ kind: "help", text: GENERAL_HELP });
  }
  if (argv[0] === "--help") {
    if (argv.length !== 1) {
      cliFail("CLI_ARGUMENT_UNEXPECTED", "--help does not accept additional arguments.");
    }
    return Object.freeze({ kind: "help", text: GENERAL_HELP });
  }
  if (argv[0] === "--version") {
    if (argv.length !== 1) {
      cliFail("CLI_ARGUMENT_UNEXPECTED", "--version does not accept additional arguments.");
    }
    return Object.freeze({ kind: "version" });
  }
  const command = argv[0];
  if (!Object.hasOwn(COMMAND_HELP, command)) {
    cliFail("CLI_COMMAND_UNKNOWN", "Unknown CLI command.", { command });
  }
  if (argv.length === 2 && argv[1] === "--help") {
    return Object.freeze({ kind: "help", command, text: COMMAND_HELP[command] });
  }

  if (command === "verify") {
    requireCount(command, argv, 1);
    if (argv.length !== 2) {
      cliFail("CLI_ARGUMENT_UNEXPECTED", "verify accepts exactly one Model Pack source.", { command });
    }
    return Object.freeze({ kind: "command", command, source: argv[1], options: Object.freeze({}) });
  }

  if (command === "node") {
    requireCount(command, argv, 2);
    if (argv.length !== 3) {
      cliFail("CLI_ARGUMENT_UNEXPECTED", "node accepts exactly a Model Pack source and node identifier.", {
        command
      });
    }
    return Object.freeze({
      kind: "command",
      command,
      source: argv[1],
      nodeId: argv[2],
      options: Object.freeze({})
    });
  }

  if (command === "neighborhood") {
    requireCount(command, argv, 2);
    const options = parseOptions(argv.slice(3), {
      "--depth": { name: "depth", parse: (value) => parseInteger(value, "--depth", 0, 64) },
      "--direction": {
        name: "direction",
        parse(value) {
          if (!DIRECTIONS.has(value)) {
            cliFail("CLI_OPTION_INVALID", "--direction is not supported.", {
              flag: "--direction",
              value
            });
          }
          return value;
        }
      },
      "--selector": { name: "selector", parse: parseSelector }
    });
    return Object.freeze({
      kind: "command",
      command,
      source: argv[1],
      nodeId: argv[2],
      options
    });
  }

  requireCount(command, argv, 3);
  const options = parseOptions(argv.slice(4), {
    "--maximum-paths": {
      name: "maximumPaths",
      parse: (value) => parseInteger(value, "--maximum-paths", 1, 10_000)
    },
    "--selector": { name: "selector", parse: parseSelector }
  });
  return Object.freeze({
    kind: "command",
    command,
    source: argv[1],
    from: argv[2],
    to: argv[3],
    options
  });
}
