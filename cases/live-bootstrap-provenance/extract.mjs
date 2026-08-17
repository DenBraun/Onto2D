import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  hashArtifactBytes,
  hashCanonical
} from "@onto2d/kernel/canonical";

const CASE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_ROOT = path.join(CASE_ROOT, "generated");
const SOURCE_DOMAIN = "onto2d:live-bootstrap-source:v1";
const TRACE_DOMAIN = "onto2d:live-bootstrap-trace:v1";
const STATE_DOMAIN = "onto2d:live-bootstrap-state-history:v1";
const EVIDENCE_DOMAIN = "onto2d:live-bootstrap-evidence:v1";
const GRAPH_DOMAIN = "onto2d:live-bootstrap-graph:v1";
const EVIDENCE_PROFILE_DOMAIN = "onto2d:live-bootstrap-evidence-profile:v1";
const SUPPORTED_DIRECTIVES = new Set(["build", "improve", "define", "jump", "uninstall"]);
const EVIDENCE_CLASSES = new Set([
  "observed-order",
  "declared-input",
  "script-reference",
  "produced-artifact",
  "derived-state",
  "inferred-dependency",
  "external-root",
  "unknown"
]);
const SIMPLE_TOKEN = /^[A-Za-z0-9_+./-]+$/;
const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*$/;

const OUTPUTS = Object.freeze({
  trace: "upstream-trace.json",
  stateHistory: "state-transitions.json",
  evidence: "evidence.json",
  graph: "graph.json"
});

export class ManifestSyntaxError extends Error {
  constructor(line, message) {
    super(`steps/manifest:${line}: ${message}`);
    this.name = "ManifestSyntaxError";
    this.line = line;
  }
}

function fail(message) {
  throw new Error(`live-bootstrap provenance extraction failed: ${message}`);
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function normalizedNonEmpty(value, label) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    fail(`${label} must be a normalized non-empty string`);
  }
  return value;
}

function safeRelativePath(value, label) {
  normalizedNonEmpty(value, label);
  if (path.posix.isAbsolute(value) || value.includes("\\") || value.split("/").includes("..")) {
    fail(`${label} must be a safe POSIX relative path`);
  }
  return value;
}

function validateSourceLock(lock) {
  exactKeys(lock, [
    "format",
    "formatVersion",
    "repository",
    "revision",
    "revisionTree",
    "extractionProfile",
    "submodules",
    "profile",
    "files",
    "trustBoundary"
  ], "upstream source lock");
  if (lock.format !== "onto2d-live-bootstrap-source" || lock.formatVersion !== "1") {
    fail("unsupported upstream source-lock format");
  }
  if (lock.extractionProfile !== "live-bootstrap-provenance-v1") {
    fail("unsupported extraction profile");
  }
  normalizedNonEmpty(lock.repository, "repository");
  if (!/^[0-9a-f]{40}$/.test(lock.revision)) fail("revision must be a full lowercase Git SHA");
  if (!/^[0-9a-f]{40}$/.test(lock.revisionTree)) fail("revisionTree must be a full lowercase Git SHA");

  if (!Array.isArray(lock.submodules)) fail("submodules must be an array");
  const seenSubmodulePaths = new Set();
  for (const [index, submodule] of lock.submodules.entries()) {
    exactKeys(
      submodule,
      ["path", "repository", "revision", "contentStatus"],
      `submodules[${index}]`
    );
    safeRelativePath(submodule.path, `submodules[${index}].path`);
    normalizedNonEmpty(submodule.repository, `submodules[${index}].repository`);
    if (!/^[0-9a-f]{40}$/.test(submodule.revision)) {
      fail(`submodules[${index}].revision must be a full lowercase Git SHA`);
    }
    if (submodule.contentStatus !== "not-consumed") {
      fail(`submodules[${index}].contentStatus must be not-consumed in extraction profile v1`);
    }
    if (seenSubmodulePaths.has(submodule.path)) fail(`duplicate submodule path ${submodule.path}`);
    seenSubmodulePaths.add(submodule.path);
  }

  exactKeys(lock.profile, [
    "id",
    "description",
    "upstreamSupportStatus",
    "upstreamSupportNote",
    "variables"
  ], "profile");
  normalizedNonEmpty(lock.profile.id, "profile.id");
  normalizedNonEmpty(lock.profile.description, "profile.description");
  normalizedNonEmpty(lock.profile.upstreamSupportStatus, "profile.upstreamSupportStatus");
  normalizedNonEmpty(lock.profile.upstreamSupportNote, "profile.upstreamSupportNote");
  if (lock.profile.variables === null || typeof lock.profile.variables !== "object"
      || Array.isArray(lock.profile.variables)) {
    fail("profile.variables must be an object");
  }
  for (const [name, value] of Object.entries(lock.profile.variables)) {
    if (!VARIABLE_NAME.test(name) || typeof value !== "string") {
      fail(`invalid profile variable ${name}`);
    }
  }

  if (!Array.isArray(lock.files) || lock.files.length === 0) {
    fail("source lock must contain at least one consumed file");
  }
  const seenPaths = new Set();
  for (const [index, file] of lock.files.entries()) {
    exactKeys(file, ["path", "fixturePath", "role", "sha256"], `files[${index}]`);
    safeRelativePath(file.path, `files[${index}].path`);
    safeRelativePath(file.fixturePath, `files[${index}].fixturePath`);
    normalizedNonEmpty(file.role, `files[${index}].role`);
    if (!/^sha256:[0-9a-f]{64}$/.test(file.sha256)) {
      fail(`files[${index}].sha256 must be a raw SHA-256 content hash`);
    }
    if (seenPaths.has(file.path)) fail(`duplicate consumed path ${file.path}`);
    seenPaths.add(file.path);
  }
  if (!seenPaths.has("steps/manifest")) fail("source lock must consume steps/manifest");

  exactKeys(lock.trustBoundary, ["modeled", "outside"], "trustBoundary");
  for (const key of ["modeled", "outside"]) {
    if (!Array.isArray(lock.trustBoundary[key]) || lock.trustBoundary[key].length === 0
        || lock.trustBoundary[key].some((entry) => typeof entry !== "string" || entry.length === 0)) {
      fail(`trustBoundary.${key} must be a non-empty string array`);
    }
  }
  return lock;
}

function resolveBelow(root, relativePath, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail(`${label} resolves outside its declared root`);
  }
  return resolved;
}

export async function verifySourceInputs(lockInput, options = {}) {
  const lock = validateSourceLock(structuredClone(lockInput));
  const upstreamRoot = options.upstreamRoot === undefined
    ? null
    : path.resolve(options.upstreamRoot);
  const inputs = new Map();
  for (const file of lock.files) {
    const inputPath = upstreamRoot === null
      ? resolveBelow(CASE_ROOT, file.fixturePath, `${file.path} fixture`)
      : resolveBelow(upstreamRoot, file.path, file.path);
    const bytes = await readFile(inputPath);
    const actual = hashArtifactBytes(bytes);
    if (actual !== file.sha256) {
      fail(`${file.path} hash mismatch; expected ${file.sha256}, received ${actual}`);
    }
    inputs.set(file.path, bytes);
  }

  const identityBasis = {
    format: lock.format,
    formatVersion: lock.formatVersion,
    repository: lock.repository,
    revision: lock.revision,
    revisionTree: lock.revisionTree,
    extractionProfile: lock.extractionProfile,
    submodules: lock.submodules,
    profile: lock.profile,
    files: lock.files.map(({ path: filePath, role, sha256 }) => ({ path: filePath, role, sha256 }))
  };
  return Object.freeze({
    lock,
    inputs,
    sourceIdentity: hashCanonical(SOURCE_DOMAIN, identityBasis)
  });
}

function syntax(line, condition, message) {
  if (!condition) throw new ManifestSyntaxError(line, message);
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
    return {
      expression: { kind: "logical", operator, left, right: right.expression },
      next: right.next
    };
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
  if (start === tokens.length) return { predicate: null, next: start };
  const parsed = parseWrappedExpression(tokens, start, line);
  syntax(line, parsed.next === tokens.length, "unexpected tokens after predicate");
  return { predicate: parsed.expression, next: parsed.next };
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
  const parsedPredicate = parseOptionalPredicate(tokens, cursor, line);
  return {
    target: null,
    targets: [],
    definition: { name, value },
    predicate: parsedPredicate.predicate
  };
}

function parseAction(directive, tokens, line) {
  const predicateStart = tokens.indexOf("(");
  const argumentEnd = predicateStart === -1 ? tokens.length : predicateStart;
  const argumentsList = tokens.slice(0, argumentEnd);
  syntax(line, argumentsList.length > 0, `${directive} requires an argument`);
  for (const token of argumentsList) validateToken(token, line, `${directive} argument`);
  if (directive !== "uninstall") {
    syntax(line, argumentsList.length === 1, `${directive} requires exactly one argument`);
  }
  const predicate = predicateStart === -1
    ? null
    : parseOptionalPredicate(tokens, predicateStart, line).predicate;
  return directive === "uninstall"
    ? { target: null, targets: argumentsList, definition: null, predicate }
    : { target: argumentsList[0], targets: [], definition: null, predicate };
}

function variableValue(name, environment, inputMap) {
  const entry = environment.get(name) ?? { value: "", origin: "unset" };
  if (!inputMap.has(name)) inputMap.set(name, { name, value: entry.value, origin: entry.origin });
  return entry.value;
}

function evaluateExpression(expression, environment, inputMap) {
  if (expression.kind === "literal") return expression.value;
  if (expression.kind === "comparison") {
    const equal = variableValue(expression.name, environment, inputMap) === expression.value;
    return (expression.operator === "==" ? equal : !equal) ? "True" : "False";
  }
  const left = evaluateExpression(expression.left, environment, inputMap);
  const right = evaluateExpression(expression.right, environment, inputMap);
  const result = expression.operator === "||"
    ? left === "True" || right === "True"
    : left === "True" && right === "True";
  return result ? "True" : "False";
}

function definitionValue(definition, environment, inputMap) {
  if (definition.value.kind === "constant") return definition.value.value;
  return evaluateExpression(definition.value.expression, environment, inputMap);
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function parseManifestBytes(bytes, context) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("parseManifestBytes requires Uint8Array bytes");
  if (context === null || typeof context !== "object") throw new TypeError("parseManifestBytes requires context");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ManifestSyntaxError(1, "manifest is not valid UTF-8");
  }
  if (text.startsWith("\uFEFF")) throw new ManifestSyntaxError(1, "UTF-8 BOM is not permitted");

  const environment = new Map(Object.entries(context.profile.variables).map(([name, value]) => [
    name,
    { value, origin: "profile" }
  ]));
  const events = [];
  const prefix = context.sourceIdentity.slice("sha256:".length, "sha256:".length + 12);
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = index + 1;
    const raw = lines[index];
    syntax(line, !raw.endsWith("\r"), "CRLF input is not accepted by extraction profile v1");
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
      eventId: `event:${prefix}:${String(ordinal).padStart(6, "0")}`,
      ordinal,
      directive,
      target: parsed.target,
      targets: parsed.targets,
      definition: parsed.definition,
      predicate: parsed.predicate,
      source: {
        path: "steps/manifest",
        line,
        raw,
        comment
      },
      provenance: {
        layer: "upstream-fact",
        method: "deterministic-parse"
      },
      profileStatus: {
        layer: "derived-fact",
        active,
        reason: parsed.predicate === null
          ? "no-predicate"
          : active ? "predicate-true" : "predicate-false",
        inputs: [...inputs.values()].sort((left, right) => compareCodePoints(left.name, right.name))
      }
    });
  }

  const directiveCounts = Object.fromEntries(
    [...SUPPORTED_DIRECTIVES].map((directive) => [
      directive,
      events.filter((event) => event.directive === directive).length
    ])
  );
  const activeEventCount = events.filter((event) => event.profileStatus.active).length;
  const basis = {
    format: "onto2d-live-bootstrap-upstream-trace",
    formatVersion: "1",
    extractionProfile: context.extractionProfile,
    source: context.source,
    profile: context.profile,
    events,
    statistics: {
      eventCount: events.length,
      activeEventCount,
      inactiveEventCount: events.length - activeEventCount,
      directiveCounts
    }
  };
  return Object.freeze({
    ...basis,
    traceIdentity: hashCanonical(TRACE_DOMAIN, basis)
  });
}

function sortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => compareCodePoints(left, right)));
}

export function buildStateHistory(trace) {
  const prefix = trace.source.sourceIdentity.slice("sha256:".length, "sha256:".length + 12);
  const installed = new Set();
  const removed = new Set();
  const definitions = new Map();
  let kernelContext = null;
  const states = [];
  const transitions = [];

  function snapshot(index, afterEvent) {
    return {
      stateId: `state:${prefix}:${String(index).padStart(6, "0")}`,
      afterEvent,
      installedTargets: [...installed].sort(compareCodePoints),
      removedTargets: [...removed].sort(compareCodePoints),
      activeDefinitions: sortedObject(definitions),
      kernelContext,
      provenance: { layer: "derived-fact", method: "manifest-state-projection-v1" }
    };
  }

  states.push(snapshot(0, null));
  for (const event of trace.events) {
    const fromState = states.at(-1).stateId;
    const operations = [];
    if (!event.profileStatus.active) {
      operations.push({ kind: "no-op", reason: "predicate-inactive" });
    } else if (event.directive === "build") {
      installed.add(event.target);
      removed.delete(event.target);
      operations.push({ kind: "build", target: event.target });
    } else if (event.directive === "uninstall") {
      for (const target of event.targets) {
        const wasInstalled = installed.delete(target);
        removed.add(target);
        operations.push({ kind: "uninstall", target, wasInstalled });
      }
    } else if (event.directive === "define") {
      const environment = new Map(Object.entries(trace.profile.variables).map(([name, value]) => [
        name,
        { value, origin: "profile" }
      ]));
      for (const [name, value] of definitions) {
        environment.set(name, { value, origin: "manifest-define" });
      }
      const value = definitionValue(event.definition, environment, new Map());
      definitions.set(event.definition.name, value);
      operations.push({ kind: "define", name: event.definition.name, value });
    } else if (event.directive === "jump") {
      const previousKernelContext = kernelContext;
      kernelContext = event.target;
      operations.push({
        kind: "environment-jump",
        target: event.target,
        previousKernelContext
      });
    } else {
      operations.push({ kind: "improve", target: event.target });
    }

    const nextState = snapshot(states.length, event.eventId);
    states.push(nextState);
    transitions.push({
      transitionId: `transition:${prefix}:${String(event.ordinal).padStart(6, "0")}`,
      eventId: event.eventId,
      fromState,
      toState: nextState.stateId,
      active: event.profileStatus.active,
      operations,
      provenance: { layer: "derived-fact", method: "manifest-state-projection-v1" }
    });
  }

  const basis = {
    format: "onto2d-live-bootstrap-state-history",
    formatVersion: "1",
    traceIdentity: trace.traceIdentity,
    initialState: states[0].stateId,
    states,
    transitions
  };
  return Object.freeze({ ...basis, stateHistoryIdentity: hashCanonical(STATE_DOMAIN, basis) });
}

function validateEvidenceProfile(profile) {
  exactKeys(
    profile,
    ["format", "formatVersion", "profileId", "method", "scope", "assertions"],
    "evidence profile"
  );
  if (profile.format !== "onto2d-live-bootstrap-evidence-profile"
      || profile.formatVersion !== "1"
      || profile.method !== "reviewed-line-assertion-v1") {
    fail("unsupported evidence profile");
  }
  normalizedNonEmpty(profile.profileId, "evidence profile ID");
  exactKeys(profile.scope, ["description", "doesNotClaim"], "evidence profile scope");
  normalizedNonEmpty(profile.scope.description, "evidence profile scope description");
  if (!Array.isArray(profile.scope.doesNotClaim) || profile.scope.doesNotClaim.length === 0
      || profile.scope.doesNotClaim.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    fail("evidence profile scope doesNotClaim must be a non-empty string array");
  }
  if (!Array.isArray(profile.assertions) || profile.assertions.length === 0) {
    fail("evidence profile must contain assertions");
  }
  const ids = new Set();
  for (const [index, assertion] of profile.assertions.entries()) {
    const label = `evidence profile assertions[${index}]`;
    exactKeys(assertion, [
      "id",
      "subject",
      "relation",
      "object",
      "evidenceClass",
      "layer",
      "status",
      "claim",
      "source"
    ], label);
    normalizedNonEmpty(assertion.id, `${label}.id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assertion.id) || ids.has(assertion.id)) {
      fail(`${label}.id must be a unique kebab-case identifier`);
    }
    ids.add(assertion.id);
    normalizedNonEmpty(assertion.relation, `${label}.relation`);
    normalizedNonEmpty(assertion.object, `${label}.object`);
    normalizedNonEmpty(assertion.claim, `${label}.claim`);
    if (!EVIDENCE_CLASSES.has(assertion.evidenceClass)) fail(`${label} has an unknown evidence class`);
    if (!["upstream-fact", "derived-fact", "onto2d-analysis"].includes(assertion.layer)) {
      fail(`${label} has an unknown layer`);
    }
    if (!["observed", "derived", "inferred", "unknown"].includes(assertion.status)) {
      fail(`${label} has an unknown status`);
    }
    exactKeys(assertion.source, ["path", "line", "expected"], `${label}.source`);
    safeRelativePath(assertion.source.path, `${label}.source.path`);
    if (!Number.isSafeInteger(assertion.source.line) || assertion.source.line < 1) {
      fail(`${label}.source.line must be a positive safe integer`);
    }
    if (typeof assertion.source.expected !== "string") {
      fail(`${label}.source.expected must be a string`);
    }
    if (assertion.subject?.type === "entity") {
      exactKeys(assertion.subject, ["type", "id"], `${label}.subject`);
      normalizedNonEmpty(assertion.subject.id, `${label}.subject.id`);
    } else if (assertion.subject?.type === "event") {
      exactKeys(
        assertion.subject,
        ["type", "directive", "target", "occurrence"],
        `${label}.subject`
      );
      if (!SUPPORTED_DIRECTIVES.has(assertion.subject.directive)) {
        fail(`${label}.subject has an unknown directive`);
      }
      normalizedNonEmpty(assertion.subject.target, `${label}.subject.target`);
      if (!Number.isSafeInteger(assertion.subject.occurrence) || assertion.subject.occurrence < 1) {
        fail(`${label}.subject.occurrence must be a positive safe integer`);
      }
    } else {
      fail(`${label}.subject has an unknown type`);
    }
  }
  verifyEvidenceBoundary({ records: profile.assertions });
  return profile;
}

function resolveAssertionSubject(assertion, trace) {
  if (assertion.subject.type === "entity") return assertion.subject.id;
  const matches = trace.events.filter((event) =>
    event.directive === assertion.subject.directive && event.target === assertion.subject.target
  );
  const event = matches[assertion.subject.occurrence - 1];
  if (event === undefined) {
    fail(
      `evidence assertion ${assertion.id} selects missing occurrence `
      + `${assertion.subject.occurrence} of ${assertion.subject.directive}:${assertion.subject.target}`
    );
  }
  return event.eventId;
}

function verifiedSourceLine(assertion, inputs) {
  const bytes = inputs.get(assertion.source.path);
  if (bytes === undefined) {
    fail(`evidence assertion ${assertion.id} references an unconsumed source file`);
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`evidence assertion ${assertion.id} source is not valid UTF-8`);
  }
  const actual = text.split("\n")[assertion.source.line - 1];
  if (actual === undefined) {
    fail(`evidence assertion ${assertion.id} source line is outside the file`);
  }
  if (actual !== assertion.source.expected) {
    fail(
      `evidence assertion ${assertion.id} line mismatch; expected `
      + `${JSON.stringify(assertion.source.expected)}, received ${JSON.stringify(actual)}`
    );
  }
  return { path: assertion.source.path, line: assertion.source.line };
}

export function buildEvidence(trace, stateHistory, options = {}) {
  const prefix = trace.source.sourceIdentity.slice("sha256:".length, "sha256:".length + 12);
  const records = [];
  function add(record, stableSuffix = null) {
    records.push({
      evidenceId: stableSuffix === null
        ? `evidence:${prefix}:${String(records.length).padStart(6, "0")}`
        : `evidence:${prefix}:${stableSuffix}`,
      ...record
    });
  }

  for (let index = 1; index < trace.events.length; index += 1) {
    const event = trace.events[index];
    add({
      subject: event.eventId,
      relation: "observed-after",
      object: trace.events[index - 1].eventId,
      claim: `${event.eventId} occurs immediately after ${trace.events[index - 1].eventId} in steps/manifest.`,
      evidenceClass: "observed-order",
      layer: "upstream-fact",
      source: { path: event.source.path, line: event.source.line },
      status: "observed",
      method: "manifest-order-v1"
    });
  }
  const eventsById = new Map(trace.events.map((event) => [event.eventId, event]));
  for (const transition of stateHistory.transitions) {
    const event = eventsById.get(transition.eventId);
    add({
      subject: transition.eventId,
      relation: "results-in",
      object: transition.toState,
      claim: `${transition.eventId} deterministically projects to ${transition.toState} under the selected profile.`,
      evidenceClass: "derived-state",
      layer: "derived-fact",
      source: { path: event.source.path, line: event.source.line },
      status: "derived",
      method: "manifest-state-projection-v1"
    });
  }

  let evidenceProfile = null;
  if (options.profile !== undefined) {
    if (!(options.inputs instanceof Map)) fail("reviewed evidence requires verified source inputs");
    const profile = validateEvidenceProfile(structuredClone(options.profile));
    evidenceProfile = {
      id: profile.profileId,
      method: profile.method,
      scope: profile.scope,
      profileIdentity: hashCanonical(EVIDENCE_PROFILE_DOMAIN, profile)
    };
    for (const assertion of profile.assertions) {
      add({
        subject: resolveAssertionSubject(assertion, trace),
        relation: assertion.relation,
        object: assertion.object,
        claim: assertion.claim,
        evidenceClass: assertion.evidenceClass,
        layer: assertion.layer,
        source: verifiedSourceLine(assertion, options.inputs),
        status: assertion.status,
        method: profile.method
      }, `assertion:${assertion.id}`);
    }
  }
  const basis = {
    format: "onto2d-live-bootstrap-provenance-evidence",
    formatVersion: "1",
    traceIdentity: trace.traceIdentity,
    evidenceProfile,
    records
  };
  verifyEvidenceBoundary(basis);
  return Object.freeze({ ...basis, evidenceIdentity: hashCanonical(EVIDENCE_DOMAIN, basis) });
}

const DEMONSTRATED_DEPENDENCY_CLASSES = new Set([
  "declared-input",
  "script-reference",
  "produced-artifact"
]);

export function verifyEvidenceBoundary(evidence) {
  if (evidence === null || typeof evidence !== "object" || !Array.isArray(evidence.records)) {
    fail("evidence artifact must contain records");
  }
  for (const record of evidence.records) {
    if (record.relation.includes("counterfactual")) {
      fail(`counterfactual relation ${record.evidenceId ?? "<unknown>"} entered extracted evidence`);
    }
    if (record.evidenceClass === "observed-order" && record.relation !== "observed-after") {
      fail(`observed-order evidence ${record.evidenceId ?? "<unknown>"} has a non-order relation`);
    }
    if (record.evidenceClass === "inferred-dependency"
        && (record.layer !== "onto2d-analysis" || record.status !== "inferred")) {
      fail(`inferred dependency ${record.evidenceId ?? "<unknown>"} is mislabeled as a fact`);
    }
  }
  return evidence;
}

export function requireDemonstratedDependency(records, subject, object) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  const evidence = records.find((record) =>
    record.subject === subject
    && record.object === object
    && DEMONSTRATED_DEPENDENCY_CLASSES.has(record.evidenceClass)
  );
  if (evidence === undefined) {
    fail(`no demonstrated dependency from ${subject} to ${object}`);
  }
  return evidence;
}

export function buildGraph(trace, stateHistory, evidence) {
  const nodes = [
    ...trace.events.map((event) => ({
      id: event.eventId,
      kind: "event",
      label: event.directive === "uninstall"
        ? `uninstall ${event.targets.join(" ")}`
        : event.directive === "define"
          ? `define ${event.definition.name}`
          : `${event.directive} ${event.target}`,
      layer: "upstream-fact",
      active: event.profileStatus.active,
      source: { path: event.source.path, line: event.source.line }
    })),
    ...stateHistory.states.map((state) => ({
      id: state.stateId,
      kind: "state",
      label: state.stateId,
      layer: "derived-fact",
      active: true,
      source: null
    }))
  ];
  const knownNodeIds = new Set(nodes.map((node) => node.id));
  for (const record of evidence.records) {
    for (const id of [record.subject, record.object]) {
      if (knownNodeIds.has(id)) continue;
      knownNodeIds.add(id);
      nodes.push({
        id,
        kind: "evidence-entity",
        label: id,
        layer: record.layer,
        active: true,
        source: record.source
      });
    }
  }
  const edges = evidence.records.map((record) => ({
    id: record.evidenceId,
    source: record.subject,
    target: record.object,
    relation: record.relation,
    evidenceClass: record.evidenceClass,
    layer: record.layer,
    status: record.status
  }));
  const basis = {
    format: "onto2d-live-bootstrap-provenance-graph",
    formatVersion: "1",
    traceIdentity: trace.traceIdentity,
    evidenceIdentity: evidence.evidenceIdentity,
    nodes,
    edges
  };
  return Object.freeze({ ...basis, graphIdentity: hashCanonical(GRAPH_DOMAIN, basis) });
}

export async function extractCase(options = {}) {
  const lock = options.lockInput ?? JSON.parse(
    await readFile(path.join(CASE_ROOT, "upstream.json"), "utf8")
  );
  const evidenceProfile = options.evidenceProfileInput ?? JSON.parse(
    await readFile(path.join(CASE_ROOT, "evidence-profile.json"), "utf8")
  );
  const verified = await verifySourceInputs(lock, { upstreamRoot: options.upstreamRoot });
  const source = {
    repository: verified.lock.repository,
    revision: verified.lock.revision,
    revisionTree: verified.lock.revisionTree,
    submodules: verified.lock.submodules,
    files: verified.lock.files.map(({ path: filePath, role, sha256 }) => ({ path: filePath, role, sha256 })),
    sourceIdentity: verified.sourceIdentity
  };
  const trace = parseManifestBytes(verified.inputs.get("steps/manifest"), {
    extractionProfile: verified.lock.extractionProfile,
    sourceIdentity: verified.sourceIdentity,
    source,
    profile: verified.lock.profile
  });
  const stateHistory = buildStateHistory(trace);
  const evidence = buildEvidence(trace, stateHistory, {
    profile: evidenceProfile,
    inputs: verified.inputs
  });
  const graph = buildGraph(trace, stateHistory, evidence);
  return Object.freeze({ trace, stateHistory, evidence, graph });
}

function serialized(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function materializeCase(options = {}) {
  const artifacts = await extractCase(options);
  if (options.verify === true) {
    for (const [key, filename] of Object.entries(OUTPUTS)) {
      assert.equal(
        await readFile(path.join(GENERATED_ROOT, filename), "utf8"),
        serialized(artifacts[key]),
        `${filename} differs from exact replay`
      );
    }
    return artifacts;
  }
  await mkdir(GENERATED_ROOT, { recursive: true });
  await Promise.all(Object.entries(OUTPUTS).map(([key, filename]) =>
    writeFile(path.join(GENERATED_ROOT, filename), serialized(artifacts[key]), "utf8")
  ));
  return artifacts;
}

function parseArguments(argv) {
  const options = { verify: false, upstreamRoot: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--verify") {
      options.verify = true;
    } else if (argument === "--upstream-root") {
      const value = argv[index + 1];
      if (value === undefined) fail("--upstream-root requires a path");
      options.upstreamRoot = value;
      index += 1;
    } else {
      fail(`unknown argument ${argument}`);
    }
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArguments(process.argv.slice(2));
  materializeCase(options).then(({ trace, stateHistory, evidence }) => {
    console.log(
      `Live-bootstrap case ${options.verify ? "verified" : "materialized"}: `
      + `${trace.statistics.eventCount} events, ${stateHistory.states.length} states, `
      + `${evidence.records.length} evidence records, ${trace.traceIdentity}.`
    );
  }).catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
