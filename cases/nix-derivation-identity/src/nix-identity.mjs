import { hashCanonical } from "@onto2d/kernel/canonical";

const CLOSURE_DOMAIN = "onto2d:nix-input-closure:v1";
const ENVIRONMENT_DOMAIN = "onto2d:nix-builder-environment:v1";
const HISTORY_CLASS_DOMAIN = "onto2d:nix-output-equivalence:v1";

function fail(message) {
  throw new Error(`Nix derivation identity invalid: ${message}`);
}

function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(record(value, label)).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export const IDENTITY_REGIMES = Object.freeze([
  Object.freeze({ id: "output-content", label: "Output content", compares: "Verified SHA-256 of materialized output bytes" }),
  Object.freeze({ id: "derivation", label: "Derivation", compares: "Native Nix .drv store path" }),
  Object.freeze({ id: "input-closure", label: "Input closure", compares: "Exact transitive inputDrvs closure and topology" }),
  Object.freeze({ id: "builder-environment", label: "Builder environment", compares: "builder-env-v1 over system, builder, arguments, and declared environment" }),
  Object.freeze({ id: "history-class", label: "History equivalence", compares: "Verified output content under output-content-v1" })
]);

export function parseDeriveAterm(input) {
  if (typeof input !== "string" || input.length === 0 || !input.isWellFormed() || input.includes("\0")) fail("ATerm source must be non-empty text without NUL");
  let offset = 0;
  const whitespace = () => {
    while (/\s/.test(input[offset] ?? "")) offset += 1;
  };
  const stringValue = () => {
    const start = offset;
    offset += 1;
    let escaped = false;
    while (offset < input.length) {
      const character = input[offset];
      offset += 1;
      if (!escaped && character === '"') {
        try {
          return JSON.parse(input.slice(start, offset));
        } catch {
          fail(`invalid ATerm string at offset ${start}`);
        }
      }
      if (!escaped && character === "\\") escaped = true;
      else escaped = false;
    }
    fail(`unterminated ATerm string at offset ${start}`);
  };
  const sequence = (closing) => {
    const values = [];
    whitespace();
    if (input[offset] === closing) {
      offset += 1;
      return values;
    }
    while (offset < input.length) {
      values.push(value());
      whitespace();
      if (input[offset] === closing) {
        offset += 1;
        return values;
      }
      if (input[offset] !== ",") fail(`expected comma or ${closing} at offset ${offset}`);
      offset += 1;
    }
    fail(`unterminated ATerm sequence ending with ${closing}`);
  };
  const value = () => {
    whitespace();
    const character = input[offset];
    if (character === '"') return stringValue();
    if (character === "[") {
      offset += 1;
      return sequence("]");
    }
    if (character === "(") {
      offset += 1;
      return Object.freeze({ tuple: sequence(")") });
    }
    const match = /^[A-Za-z][A-Za-z0-9]*/.exec(input.slice(offset));
    if (!match) fail(`unexpected ATerm token at offset ${offset}`);
    offset += match[0].length;
    whitespace();
    if (input[offset] !== "(") fail(`constructor ${match[0]} has no argument list`);
    offset += 1;
    return Object.freeze({ constructor: match[0], arguments: sequence(")") });
  };
  const parsed = value();
  whitespace();
  if (offset !== input.length) fail(`trailing ATerm data at offset ${offset}`);
  if (parsed?.constructor !== "Derive" || parsed.arguments.length !== 7) fail("top-level ATerm must be Derive with seven fields");
  return parsed;
}

function tuple(value, length, label) {
  if (!value || !Array.isArray(value.tuple) || value.tuple.length !== length) fail(`${label} must be a ${length}-field tuple`);
  return value.tuple;
}

export function verifyNativeDerivation(drvPath, nativeInput, rawText) {
  const native = structuredClone(record(nativeInput, `derivation ${drvPath}`));
  exactKeys(native, ["args", "builder", "env", "inputDrvs", "inputSrcs", "name", "outputs", "system"], `derivation ${drvPath}`);
  const parsed = parseDeriveAterm(rawText);
  const [rawOutputs, rawInputDrvs, rawInputSrcs, system, builder, args, rawEnvironment] = parsed.arguments;
  if (!Array.isArray(rawOutputs) || !Array.isArray(rawInputDrvs) || !Array.isArray(rawInputSrcs) || !Array.isArray(args) || !Array.isArray(rawEnvironment)) fail(`${drvPath} ATerm collection fields are invalid`);
  if (system !== native.system || builder !== native.builder || !sameJson(args, native.args) || !sameJson(rawInputSrcs, native.inputSrcs)) fail(`${drvPath} ATerm process fields differ from Nix JSON`);

  const outputNames = new Set();
  const outputs = Object.fromEntries(rawOutputs.map((entry, index) => {
    const [name, outputPath, hashAlgo, hash] = tuple(entry, 4, `${drvPath} outputs[${index}]`);
    if ([name, outputPath, hashAlgo, hash].some((value) => typeof value !== "string") || name.length === 0 || outputNames.has(name)) fail(`${drvPath} output ${name} is invalid or repeated`);
    outputNames.add(name);
    const captured = native.outputs[name];
    if (!captured || captured.path !== outputPath) fail(`${drvPath} output ${name} path differs from Nix JSON`);
    if (hash.length > 0) {
      exactKeys(captured, ["hash", "hashAlgo", "method", "path"], `${drvPath} fixed output ${name}`);
      if (captured.hashAlgo !== hashAlgo || captured.hash !== hash || captured.method !== "flat") fail(`${drvPath} fixed output ${name} differs from Nix JSON`);
    } else {
      exactKeys(captured, ["path"], `${drvPath} input-addressed output ${name}`);
    }
    return [name, captured];
  }));
  if (!sameJson(Object.keys(outputs).sort(), Object.keys(native.outputs).sort())) fail(`${drvPath} output set differs from Nix JSON`);

  const inputPaths = new Set();
  const inputDrvs = Object.fromEntries(rawInputDrvs.map((entry, index) => {
    const [inputPath, outputNames] = tuple(entry, 2, `${drvPath} inputDrvs[${index}]`);
    const captured = native.inputDrvs[inputPath];
    if (typeof inputPath !== "string" || inputPaths.has(inputPath) || !captured || !Array.isArray(outputNames) || outputNames.some((name) => typeof name !== "string") || !sameJson(outputNames, captured.outputs) || !sameJson(captured.dynamicOutputs, {})) fail(`${drvPath} input derivation ${inputPath} differs from Nix JSON`);
    inputPaths.add(inputPath);
    exactKeys(captured, ["dynamicOutputs", "outputs"], `${drvPath} input derivation ${inputPath}`);
    return [inputPath, captured];
  }));
  if (!sameJson(Object.keys(inputDrvs).sort(), Object.keys(native.inputDrvs).sort())) fail(`${drvPath} input derivation set differs from Nix JSON`);

  const environmentKeys = new Set();
  const environment = Object.fromEntries(rawEnvironment.map((entry, index) => {
    const [key, value] = tuple(entry, 2, `${drvPath} env[${index}]`);
    if (typeof key !== "string" || typeof value !== "string" || key.length === 0 || environmentKeys.has(key)) fail(`${drvPath} environment entry ${key} is invalid or repeated`);
    environmentKeys.add(key);
    return [key, value];
  }));
  if (!sameJson(environment, native.env)) fail(`${drvPath} ATerm environment differs from Nix JSON`);
  return Object.freeze(native);
}

function derivationIndex(derivations) {
  if (!Array.isArray(derivations) || derivations.length === 0) fail("derivations must be a non-empty array");
  const index = new Map();
  for (const derivation of derivations) {
    if (index.has(derivation.drvPath)) fail(`duplicate derivation ${derivation.drvPath}`);
    index.set(derivation.drvPath, derivation);
  }
  return index;
}

export function inputClosureProjection(headDrvPath, derivations) {
  const index = derivationIndex(derivations);
  if (!index.has(headDrvPath)) fail(`unknown closure head ${headDrvPath}`);
  const members = new Set();
  const edges = [];
  const visiting = new Set();
  const visit = (drvPath, from) => {
    const current = index.get(drvPath);
    if (!current) fail(`${from} references missing input derivation ${drvPath}`);
    edges.push({ from, to: drvPath });
    if (members.has(drvPath)) return;
    if (visiting.has(drvPath)) fail(`input closure contains a cycle at ${drvPath}`);
    visiting.add(drvPath);
    for (const inputDrv of current.directInputDrvs) visit(inputDrv.drvPath, drvPath);
    visiting.delete(drvPath);
    members.add(drvPath);
  };
  const head = index.get(headDrvPath);
  for (const inputDrv of head.directInputDrvs) visit(inputDrv.drvPath, "$head");
  const basis = {
    format: "onto2d-nix-input-closure",
    formatVersion: "1",
    members: [...members].sort(),
    edges: edges.sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to))
  };
  return Object.freeze({ ...basis, identity: hashCanonical(CLOSURE_DOMAIN, basis) });
}

export function builderEnvironmentProjection(derivation) {
  const basis = {
    format: "onto2d-nix-builder-environment",
    formatVersion: "1",
    profile: "builder-env-v1",
    system: derivation.system,
    builder: derivation.builder,
    args: derivation.args,
    env: derivation.env
  };
  return Object.freeze({ ...basis, identity: hashCanonical(ENVIRONMENT_DOMAIN, basis) });
}

function result(left, right) {
  if (left === null || right === null) return Object.freeze({ left, right, equal: null, status: "unresolved" });
  return Object.freeze({ left, right, equal: left === right, status: "resolved" });
}

export function compareDerivations(experiment, derivations) {
  exactKeys(experiment, ["id", "label", "left", "right", "claim"], `experiment ${experiment?.id ?? "unknown"}`);
  const byFixture = new Map(derivations.map((derivation) => [derivation.fixtureId, derivation]));
  const left = byFixture.get(experiment.left);
  const right = byFixture.get(experiment.right);
  if (!left || !right || left === right) fail(`experiment ${experiment.id} has invalid fixture bindings`);
  const historyClass = (derivation) => derivation.outputContentIdentity === null ? null : hashCanonical(HISTORY_CLASS_DOMAIN, {
    regime: "output-content-v1",
    outputContentIdentity: derivation.outputContentIdentity
  });
  return Object.freeze({
    id: experiment.id,
    label: experiment.label,
    claim: experiment.claim,
    leftFixtureId: left.fixtureId,
    rightFixtureId: right.fixtureId,
    sharedInputDrvs: left.inputClosure.members.filter((drvPath) => right.inputClosure.members.includes(drvPath)),
    addressing: Object.freeze({ left: left.outputAddressing, right: right.outputAddressing, equal: left.outputAddressing === right.outputAddressing }),
    results: Object.freeze({
      "output-content": result(left.outputContentIdentity, right.outputContentIdentity),
      derivation: result(left.drvPath, right.drvPath),
      "input-closure": result(left.inputClosure.identity, right.inputClosure.identity),
      "builder-environment": result(left.builderEnvironment.identity, right.builderEnvironment.identity),
      "history-class": result(historyClass(left), historyClass(right))
    })
  });
}
