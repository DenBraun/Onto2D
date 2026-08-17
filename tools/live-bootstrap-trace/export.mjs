import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SUPPORTED_DIRECTIVES = new Set(["build", "improve", "define", "jump", "uninstall"]);
const SIMPLE_TOKEN = /^[A-Za-z0-9_+./-]+$/;
const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*$/;

export class ManifestTraceSyntaxError extends Error {
  constructor(line, message) {
    super(`manifest:${line}: ${message}`);
    this.name = "ManifestTraceSyntaxError";
    this.line = line;
  }
}

function syntax(line, condition, message) {
  if (!condition) throw new ManifestTraceSyntaxError(line, message);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, sortJson(value[key])]));
}

function hashJson(value) {
  return sha256(Buffer.from(JSON.stringify(sortJson(value)), "utf8"));
}

function exactKeys(value, expected, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  const actual = Object.keys(value).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${name} has an invalid field set.`);
  }
}

function normalizeConfiguration(input) {
  exactKeys(input, ["format", "formatVersion", "id", "variables"], "configuration");
  if (input.format !== "live-bootstrap-trace-configuration" || input.formatVersion !== "1") {
    throw new TypeError("The trace configuration format is unsupported.");
  }
  if (typeof input.id !== "string" || input.id === "" || input.id.length > 128) {
    throw new TypeError("configuration.id must be a bounded non-empty string.");
  }
  if (input.variables === null || typeof input.variables !== "object" || Array.isArray(input.variables)) {
    throw new TypeError("configuration.variables must be an object.");
  }
  const variables = {};
  for (const name of Object.keys(input.variables).sort(compareText)) {
    const value = input.variables[name];
    if (!VARIABLE_NAME.test(name) || typeof value !== "string" || value.length > 4096) {
      throw new TypeError(`Invalid configuration variable ${name}.`);
    }
    variables[name] = value;
  }
  return Object.freeze({
    format: input.format,
    formatVersion: input.formatVersion,
    id: input.id,
    variables: Object.freeze(variables)
  });
}

function validateToken(token, line, label) {
  syntax(line, typeof token === "string" && SIMPLE_TOKEN.test(token), `invalid ${label} token ${JSON.stringify(token)}`);
  return token;
}

function parseLogic(tokens, start, line) {
  let left;
  let cursor = start;
  const token = tokens[cursor];
  syntax(line, token !== undefined && token !== ")", "expected predicate expression");
  if (token === "(") {
    ({ expression: left, next: cursor } = parseWrappedExpression(tokens, cursor, line));
  } else if (tokens[cursor + 1] === "==" || tokens[cursor + 1] === "!=") {
    const name = validateToken(token, line, "predicate variable");
    syntax(line, VARIABLE_NAME.test(name), `predicate variable must be uppercase: ${name}`);
    const value = validateToken(tokens[cursor + 2], line, "predicate value");
    left = { kind: "comparison", name, operator: tokens[cursor + 1], value };
    cursor += 3;
  } else {
    left = { kind: "literal", value: validateToken(token, line, "predicate literal") };
    cursor += 1;
  }
  if (tokens[cursor] === "&&" || tokens[cursor] === "||") {
    const operator = tokens[cursor];
    const right = parseLogic(tokens, cursor + 1, line);
    return { expression: { kind: "logical", operator, left, right: right.expression }, next: right.next };
  }
  return { expression: left, next: cursor };
}

function parseWrappedExpression(tokens, start, line) {
  syntax(line, tokens[start] === "(", "predicate must begin with a standalone '('");
  const parsed = parseLogic(tokens, start + 1, line);
  syntax(line, tokens[parsed.next] === ")", "predicate must end with a matching standalone ')'");
  return { expression: parsed.expression, next: parsed.next + 1 };
}

function parseOptionalPredicate(tokens, start, line) {
  if (start === tokens.length) return null;
  const parsed = parseWrappedExpression(tokens, start, line);
  syntax(line, parsed.next === tokens.length, "unexpected tokens after predicate");
  return parsed.expression;
}

function parseDefinition(tokens, line) {
  syntax(line, tokens.length >= 3, "define requires NAME = VALUE");
  const name = tokens[0];
  syntax(line, VARIABLE_NAME.test(name), `invalid definition name ${JSON.stringify(name)}`);
  syntax(line, tokens[1] === "=", "define requires a standalone '='");
  let value;
  let cursor;
  if (tokens[2] === "(") {
    const parsed = parseWrappedExpression(tokens, 2, line);
    value = { kind: "predicate", expression: parsed.expression };
    cursor = parsed.next;
  } else {
    value = { kind: "constant", value: validateToken(tokens[2], line, "definition value") };
    cursor = 3;
  }
  return {
    target: null,
    targets: [],
    definition: { name, value },
    predicate: parseOptionalPredicate(tokens, cursor, line)
  };
}

function parseAction(directive, tokens, line) {
  const predicateStart = tokens.indexOf("(");
  const argumentEnd = predicateStart === -1 ? tokens.length : predicateStart;
  const argumentsList = tokens.slice(0, argumentEnd);
  syntax(line, argumentsList.length > 0, `${directive} requires an argument`);
  argumentsList.forEach((token) => validateToken(token, line, `${directive} argument`));
  if (directive !== "uninstall") {
    syntax(line, argumentsList.length === 1, `${directive} requires exactly one argument`);
  }
  const predicate = predicateStart === -1
    ? null
    : parseOptionalPredicate(tokens, predicateStart, line);
  return directive === "uninstall"
    ? { target: null, targets: argumentsList, definition: null, predicate }
    : { target: argumentsList[0], targets: [], definition: null, predicate };
}

function variableValue(name, environment, inputs) {
  const entry = environment.get(name) ?? { value: "", origin: "unset" };
  if (!inputs.has(name)) inputs.set(name, { name, value: entry.value, origin: entry.origin });
  return entry.value;
}

function evaluateExpression(expression, environment, inputs) {
  if (expression.kind === "literal") return expression.value;
  if (expression.kind === "comparison") {
    const equal = variableValue(expression.name, environment, inputs) === expression.value;
    return (expression.operator === "==" ? equal : !equal) ? "True" : "False";
  }
  const left = evaluateExpression(expression.left, environment, inputs);
  const right = evaluateExpression(expression.right, environment, inputs);
  const result = expression.operator === "||"
    ? left === "True" || right === "True"
    : left === "True" && right === "True";
  return result ? "True" : "False";
}

function definitionValue(definition, environment, inputs) {
  return definition.value.kind === "constant"
    ? definition.value.value
    : evaluateExpression(definition.value.expression, environment, inputs);
}

function decodeManifest(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("manifestBytes must be Uint8Array.");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ManifestTraceSyntaxError(1, "manifest is not valid UTF-8");
  }
  if (text.startsWith("\uFEFF")) throw new ManifestTraceSyntaxError(1, "UTF-8 BOM is not permitted");
  return text;
}

export function exportResolvedTrace({
  manifestBytes,
  configuration: configurationInput,
  repository,
  revision,
  manifestPath = "steps/manifest"
}) {
  const configuration = normalizeConfiguration(configurationInput);
  for (const [name, value, maximum] of [
    ["repository", repository, 2048],
    ["revision", revision, 256],
    ["manifestPath", manifestPath, 2048]
  ]) {
    if (typeof value !== "string" || value === "" || value !== value.trim() || value.length > maximum) {
      throw new TypeError(`${name} must be a bounded normalized string.`);
    }
  }
  if (path.posix.isAbsolute(manifestPath) || manifestPath.includes("\\") || manifestPath.split("/").includes("..")) {
    throw new TypeError("manifestPath must be a safe relative POSIX path.");
  }
  const text = decodeManifest(manifestBytes);
  const environment = new Map(Object.entries(configuration.variables).map(([name, value]) => (
    [name, { value, origin: "configuration" }]
  )));
  const events = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = index + 1;
    const raw = lines[index];
    syntax(line, !raw.endsWith("\r"), "CRLF input is not accepted");
    if (raw.trim().length === 0 || raw.trimStart().startsWith("#")) continue;
    const commentIndex = raw.indexOf("#");
    const statement = (commentIndex === -1 ? raw : raw.slice(0, commentIndex)).trimEnd();
    const comment = commentIndex === -1 ? null : raw.slice(commentIndex + 1).trim();
    syntax(line, statement === statement.trimStart(), "directives must start in column 1");
    const match = /^([a-z]+):[ \t]+(.+)$/.exec(statement);
    syntax(line, match !== null, "expected '<directive>: <arguments>'");
    const directive = match[1];
    syntax(line, SUPPORTED_DIRECTIVES.has(directive), `unknown directive ${JSON.stringify(directive)}`);
    const tokens = match[2].split(/[ \t]+/);
    syntax(line, tokens.every((token) => token.length > 0), "empty manifest token");
    syntax(
      line,
      tokens.every((token) => token === "(" || token === ")" || (!token.includes("(") && !token.includes(")"))),
      "parentheses must be standalone tokens"
    );
    const parsed = directive === "define"
      ? parseDefinition(tokens, line)
      : parseAction(directive, tokens, line);
    const inputs = new Map();
    const pendingDefinitionValue = parsed.definition === null
      ? null
      : definitionValue(parsed.definition, environment, inputs);
    const active = parsed.predicate === null
      ? true
      : evaluateExpression(parsed.predicate, environment, inputs) === "True";
    if (active && parsed.definition !== null) {
      environment.set(parsed.definition.name, {
        value: pendingDefinitionValue,
        origin: "manifest-define"
      });
    }
    const ordinal = events.length;
    events.push({
      eventId: `event:${String(ordinal).padStart(6, "0")}`,
      ordinal,
      directive,
      target: parsed.target,
      targets: parsed.targets,
      definition: parsed.definition,
      predicate: parsed.predicate,
      source: { path: manifestPath, line, raw, comment },
      resolution: {
        active,
        reason: parsed.predicate === null ? "no-predicate" : active ? "predicate-true" : "predicate-false",
        inputs: [...inputs.values()].sort((left, right) => compareText(left.name, right.name))
      }
    });
  }
  const directiveCounts = Object.fromEntries([...SUPPORTED_DIRECTIVES].map((directive) => [
    directive,
    events.filter((event) => event.directive === directive).length
  ]));
  const activeEventCount = events.filter((event) => event.resolution.active).length;
  const basis = {
    format: "live-bootstrap-resolved-trace",
    formatVersion: "1",
    source: {
      repository,
      revision,
      manifestPath,
      manifestSha256: sha256(manifestBytes)
    },
    configuration,
    events,
    statistics: {
      eventCount: events.length,
      activeEventCount,
      inactiveEventCount: events.length - activeEventCount,
      directiveCounts
    }
  };
  return Object.freeze({ ...basis, traceIdentity: hashJson(basis) });
}

function parseArguments(argv) {
  const fields = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new TypeError("Arguments must be --name value pairs.");
    }
    if (fields.has(flag)) throw new TypeError(`Duplicate argument ${flag}.`);
    fields.set(flag, value);
  }
  const allowed = new Set(["--manifest", "--config", "--repository", "--revision", "--output", "--manifest-path"]);
  for (const flag of fields.keys()) if (!allowed.has(flag)) throw new TypeError(`Unknown argument ${flag}.`);
  for (const flag of ["--manifest", "--config", "--repository", "--revision", "--output"]) {
    if (!fields.has(flag)) throw new TypeError(`Missing argument ${flag}.`);
  }
  return fields;
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  const [manifestBytes, configurationText] = await Promise.all([
    readFile(path.resolve(args.get("--manifest"))),
    readFile(path.resolve(args.get("--config")), "utf8")
  ]);
  let configuration;
  try {
    configuration = JSON.parse(configurationText);
  } catch {
    throw new TypeError("Configuration is not valid JSON.");
  }
  const trace = exportResolvedTrace({
    manifestBytes,
    configuration,
    repository: args.get("--repository"),
    revision: args.get("--revision"),
    manifestPath: args.get("--manifest-path") ?? "steps/manifest"
  });
  const output = path.resolve(args.get("--output"));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(trace, null, 2)}\n`);
  return trace;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().then((trace) => {
    console.log(`Exported ${trace.statistics.eventCount} events: ${trace.traceIdentity}`);
  }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
