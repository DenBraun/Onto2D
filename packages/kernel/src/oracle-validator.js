import { Buffer } from "node:buffer";
import { canonicalBytes, canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import { decimalToNumber, multiplyDecimals } from "./decimal.js";
import { KernelError } from "./errors.js";
import { canonicalizeCandidate } from "./graph-canonicalizer.js";
import { HASH_DOMAINS, hashBytes, hashCanonical } from "./hash.js";
import { compareQuantities, normalizeQuantity } from "./quantity.js";

export const ORACLE_PROTOCOL_VERSION = "oracle-protocol-v1";
export const ORACLE_RESPONSE_VALIDATOR_VERSION = "oracle-response-validator-v1";

export const ORACLE_VALIDATION_LIMITS = deepFreeze({
  maxQuantities: 10_000,
  maxParameters: 10_000,
  maxEvidenceIds: 10_000,
  maxIdentifierLength: 1_024
});

const REQUEST_FIELDS = new Set(["candidate", "quantities", "parameters", "toleranceTarget", "solver"]);
const CANDIDATE_FORM_FIELDS = new Set(["schemaVersion", "bytesBase64", "hash"]);
const QUANTITY_SPEC_FIELDS = new Set(["id", "unit", "semantic", "toleranceTarget"]);
const SOLVER_IDENTITY_FIELDS = new Set(["id", "version", "method"]);
const RESPONSE_FIELDS = new Set(["requestHash", "values", "convergence", "residual", "solver", "wallTimeMs"]);
const RESPONSE_SOLVER_FIELDS = new Set(["id", "version", "method", "parameters"]);
const PARTIAL_POLICY_MODES = new Set(["indeterminate", "accept-expanded-tolerance"]);
const CONVERGENCE_STATES = new Set(["converged", "partial", "failed"]);
const CONTENT_HASH = /^sha256:[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({ code, stage: "ORACLE", message, details });
}

function assertFields(value, allowed, required, path, code) {
  if (!isObject(value)) fail(code, "Oracle contract value must be an object.", { path });
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Oracle contract fields do not match the supported version.", {
      path,
      unknown,
      missing
    });
  }
}

function identifier(value, path, code) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > ORACLE_VALIDATION_LIMITS.maxIdentifierLength
  ) {
    fail(code, "Oracle identifier must be normalized, non-empty, and within the length limit.", {
      path,
      maximumLength: ORACLE_VALIDATION_LIMITS.maxIdentifierLength
    });
  }
  return value;
}

function cloneInput(value, label) {
  try {
    return canonicalClone(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("ORACLE_INPUT_INVALID", `${label} is not canonicalizable.`, {
      causeCode: error.code,
      ...error.details
    });
  }
}

function normalizeTolerance(tolerance, path, code) {
  try {
    return normalizeQuantity({
      value: 0,
      unit: "1",
      tolerance,
      semantic: "oracle-tolerance-target-v1",
      provenance: { kind: "declared", evidence: [] }
    }).tolerance;
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, "Oracle tolerance is invalid.", {
      path,
      causeCode: error.code,
      ...error.details
    });
  }
}

function validateCanonicalCandidatePayload(candidate) {
  assertFields(
    candidate,
    new Set(["domain", "nodes", "edges", "skeleton"]),
    ["domain", "nodes", "edges", "skeleton"],
    "$.candidate.bytes",
    "ORACLE_REQUEST_CANDIDATE_INVALID"
  );
  if (!new Set(["profile-quotient", "element-exact", "single-candidate"]).has(candidate.domain)) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate uses an invalid counting domain.", {
      domain: candidate.domain
    });
  }
  if (!CONTENT_HASH.test(candidate.skeleton)) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate skeleton identity is invalid.", {
      skeleton: candidate.skeleton
    });
  }
  if (!Array.isArray(candidate.nodes) || candidate.nodes.length === 0 || !Array.isArray(candidate.edges)) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate requires non-empty nodes and an edge array.");
  }
  candidate.nodes.forEach((node, index) => {
    assertFields(
      node,
      new Set(["ref", "attrs"]),
      ["ref"],
      `$.candidate.bytes.nodes[${index}]`,
      "ORACLE_REQUEST_CANDIDATE_INVALID"
    );
    if (!CONTENT_HASH.test(node.ref) || (node.attrs !== undefined && !isObject(node.attrs))) {
      fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate node is invalid.", { index });
    }
  });
  candidate.edges.forEach((edge, index) => {
    assertFields(
      edge,
      new Set(["from", "to", "role", "attrs"]),
      ["from", "to", "role"],
      `$.candidate.bytes.edges[${index}]`,
      "ORACLE_REQUEST_CANDIDATE_INVALID"
    );
    if (
      !Number.isSafeInteger(edge.from) ||
      !Number.isSafeInteger(edge.to) ||
      edge.from < 0 ||
      edge.to < 0 ||
      edge.from >= candidate.nodes.length ||
      edge.to >= candidate.nodes.length ||
      typeof edge.role !== "string" ||
      edge.role.length === 0 ||
      edge.role !== edge.role.trim() ||
      (edge.attrs !== undefined && !isObject(edge.attrs))
    ) {
      fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate edge is invalid.", { index });
    }
  });
  const structuralNodeAttributes = [...new Set(candidate.nodes.flatMap((node) =>
    node.attrs === undefined ? [] : Object.keys(node.attrs)
  ))].sort();
  const structuralEdgeAttributes = [...new Set(candidate.edges.flatMap((edge) =>
    edge.attrs === undefined ? [] : Object.keys(edge.attrs)
  ))].sort();
  let reproduced;
  try {
    reproduced = canonicalizeCandidate({
      domain: candidate.domain,
      nodes: candidate.nodes,
      edges: candidate.edges
    }, {
      policy: {
        connected: false,
        allowParallelEdges: true,
        allowSelfLoops: true,
        structuralNodeAttributes,
        structuralEdgeAttributes
      },
      limits: { maxEdges: candidate.edges.length }
    });
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate graph cannot be reproduced by the canonicalizer.", {
      causeCode: error.code
    });
  }
  if (canonicalize(reproduced.canonical) !== canonicalize(candidate)) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate bytes are not a canonical graph representation.", {
      expectedCandidateHash: reproduced.candidateId,
      expectedSkeleton: reproduced.skeletonId,
      actualSkeleton: candidate.skeleton
    });
  }
}

function normalizeQuantityAt(quantity, path, code) {
  try {
    return normalizeQuantity(quantity);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(code, "Oracle quantity is invalid.", {
      path,
      causeCode: error.code,
      ...error.details
    });
  }
}

function normalizeCandidateForm(form) {
  assertFields(
    form,
    CANDIDATE_FORM_FIELDS,
    [...CANDIDATE_FORM_FIELDS],
    "$.candidate",
    "ORACLE_REQUEST_CANDIDATE_INVALID"
  );
  if (form.schemaVersion !== "1") {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate canonical form uses an unsupported schema version.", {
      schemaVersion: form.schemaVersion
    });
  }
  if (
    typeof form.bytesBase64 !== "string" ||
    form.bytesBase64.length === 0 ||
    !BASE64.test(form.bytesBase64)
  ) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate bytes must use canonical base64 encoding.");
  }
  const bytes = Buffer.from(form.bytesBase64, "base64");
  if (bytes.toString("base64") !== form.bytesBase64) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate bytes use non-canonical base64 encoding.");
  }
  let parsed;
  try {
    parsed = JSON.parse(textDecoder.decode(bytes));
  } catch (error) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate bytes are not valid UTF-8 canonical JSON.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  let reproduced;
  try {
    reproduced = Buffer.from(canonicalBytes(parsed));
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate bytes are not valid canonical JSON.", {
      causeCode: error.code
    });
  }
  if (!reproduced.equals(bytes)) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate bytes are not in canonical form.");
  }
  validateCanonicalCandidatePayload(parsed);
  if (!CONTENT_HASH.test(form.hash)) {
    fail("ORACLE_REQUEST_CANDIDATE_INVALID", "Oracle candidate form hash is invalid.", { hash: form.hash });
  }
  const expectedHash = hashBytes(HASH_DOMAINS.CANDIDATE, bytes);
  if (form.hash !== expectedHash) {
    fail("ORACLE_REQUEST_CANDIDATE_HASH_MISMATCH", "Oracle candidate bytes do not match the candidate hash.", {
      expected: expectedHash,
      actual: form.hash
    });
  }
  return {
    schemaVersion: "1",
    bytesBase64: form.bytesBase64,
    hash: form.hash
  };
}

function normalizeQuantitySpec(spec, index) {
  const path = `$.quantities[${index}]`;
  assertFields(spec, QUANTITY_SPEC_FIELDS, [...QUANTITY_SPEC_FIELDS], path, "ORACLE_REQUEST_QUANTITY_INVALID");
  const id = identifier(spec.id, `${path}.id`, "ORACLE_REQUEST_QUANTITY_INVALID");
  const normalized = normalizeQuantityAt({
    value: 0,
    unit: spec.unit,
    tolerance: spec.toleranceTarget,
    semantic: spec.semantic,
    provenance: { kind: "declared", evidence: [] }
  }, path, "ORACLE_REQUEST_QUANTITY_INVALID");
  return {
    id,
    unit: normalized.unit,
    semantic: normalized.semantic,
    toleranceTarget: normalized.tolerance
  };
}

function normalizeSolverIdentity(solver, path, response = false) {
  const allowed = response ? RESPONSE_SOLVER_FIELDS : SOLVER_IDENTITY_FIELDS;
  assertFields(
    solver,
    allowed,
    [...allowed],
    path,
    response ? "ORACLE_RESPONSE_SOLVER_INVALID" : "ORACLE_REQUEST_SOLVER_INVALID"
  );
  return {
    id: identifier(solver.id, `${path}.id`, response ? "ORACLE_RESPONSE_SOLVER_INVALID" : "ORACLE_REQUEST_SOLVER_INVALID"),
    version: identifier(solver.version, `${path}.version`, response ? "ORACLE_RESPONSE_SOLVER_INVALID" : "ORACLE_REQUEST_SOLVER_INVALID"),
    method: identifier(solver.method, `${path}.method`, response ? "ORACLE_RESPONSE_SOLVER_INVALID" : "ORACLE_REQUEST_SOLVER_INVALID")
  };
}

function looksLikeQuantity(value) {
  if (!isObject(value)) return false;
  const fields = Object.keys(value);
  return fields.length === 5 && ["value", "unit", "tolerance", "semantic", "provenance"]
    .every((field) => fields.includes(field));
}

function normalizeParameters(parameters, path, code) {
  if (!isObject(parameters)) fail(code, "Oracle parameters must be an object.", { path });
  const names = Object.keys(parameters).sort();
  if (names.length > ORACLE_VALIDATION_LIMITS.maxParameters) {
    fail(code, "Oracle parameter count exceeds the protocol limit.", {
      path,
      count: names.length,
      maximum: ORACLE_VALIDATION_LIMITS.maxParameters
    });
  }
  return Object.fromEntries(names.map((name) => {
    identifier(name, `${path}.${name}`, code);
    const value = parameters[name];
    return [
      name,
      looksLikeQuantity(value)
        ? normalizeQuantityAt(value, `${path}.${name}`, code)
        : value
    ];
  }));
}

function normalizePartialPolicy(policy) {
  if (!isObject(policy) || !PARTIAL_POLICY_MODES.has(policy.mode)) {
    fail("ORACLE_PARTIAL_POLICY_INVALID", "Unknown partial-Oracle policy.", { policy });
  }
  if (policy.mode === "indeterminate") {
    assertFields(policy, new Set(["mode"]), ["mode"], "$.options.partialPolicy", "ORACLE_PARTIAL_POLICY_INVALID");
    return { mode: "indeterminate" };
  }
  assertFields(
    policy,
    new Set(["mode", "toleranceMultiplier", "maximumResidual"]),
    ["mode", "toleranceMultiplier"],
    "$.options.partialPolicy",
    "ORACLE_PARTIAL_POLICY_INVALID"
  );
  if (!Number.isFinite(policy.toleranceMultiplier) || policy.toleranceMultiplier < 1) {
    fail("ORACLE_PARTIAL_POLICY_INVALID", "Partial-Oracle tolerance multiplier must be finite and at least one.", {
      toleranceMultiplier: policy.toleranceMultiplier
    });
  }
  const maximumResidual = policy.maximumResidual === undefined
    ? undefined
    : normalizeQuantityAt(
      policy.maximumResidual,
      "$.options.partialPolicy.maximumResidual",
      "ORACLE_PARTIAL_POLICY_INVALID"
    );
  if (maximumResidual !== undefined && maximumResidual.value < 0) {
    fail("ORACLE_PARTIAL_POLICY_INVALID", "Maximum residual must be non-negative.", {
      value: maximumResidual.value
    });
  }
  return {
    mode: "accept-expanded-tolerance",
    toleranceMultiplier: Object.is(policy.toleranceMultiplier, -0) ? 0 : policy.toleranceMultiplier,
    ...(maximumResidual === undefined ? {} : { maximumResidual })
  };
}

function normalizeEvidenceRegistry(evidenceIds) {
  if (evidenceIds === undefined) return null;
  if (!Array.isArray(evidenceIds) || evidenceIds.length > ORACLE_VALIDATION_LIMITS.maxEvidenceIds) {
    fail("ORACLE_EVIDENCE_REGISTRY_INVALID", "Oracle evidence registry must be a bounded array.", {
      maximum: ORACLE_VALIDATION_LIMITS.maxEvidenceIds
    });
  }
  const normalized = evidenceIds.map((entry, index) =>
    identifier(entry, `$.options.evidenceIds[${index}]`, "ORACLE_EVIDENCE_REGISTRY_INVALID")
  );
  if (new Set(normalized).size !== normalized.length) {
    fail("ORACLE_EVIDENCE_REGISTRY_INVALID", "Oracle evidence registry entries must be unique.");
  }
  return new Set(normalized);
}

function assertOracleProvenance(quantity, request, path, evidenceRegistry) {
  const provenance = quantity.provenance;
  if (
    provenance.kind !== "oracle" ||
    provenance.source !== request.requestHash ||
    provenance.method !== request.request.solver.method
  ) {
    fail("ORACLE_EVIDENCE_BINDING_INVALID", "Oracle quantity provenance is not bound to the request and solver method.", {
      path,
      expectedSource: request.requestHash,
      actualSource: provenance.source,
      expectedMethod: request.request.solver.method,
      actualMethod: provenance.method
    });
  }
  if (provenance.evidence.length === 0) {
    fail("ORACLE_EVIDENCE_BINDING_INVALID", "Oracle quantity provenance requires at least one evidence identifier.", {
      path
    });
  }
  if (evidenceRegistry !== null) {
    const missing = provenance.evidence.filter((entry) => !evidenceRegistry.has(entry));
    if (missing.length > 0) {
      fail("ORACLE_EVIDENCE_REFERENCE_MISSING", "Oracle quantity references unknown evidence.", {
        path,
        missing
      });
    }
  }
}

function toleranceBound(tolerance, magnitude, path) {
  const absolute = tolerance.absolute || 0;
  const relative = tolerance.relative || 0;
  const relativeBound = relative * Math.abs(magnitude);
  if (!Number.isFinite(relativeBound)) {
    fail("ORACLE_TOLERANCE_INVALID", "Oracle tolerance bound overflowed.", { path });
  }
  if (relative !== 0 && magnitude !== 0 && relativeBound === 0) {
    fail("ORACLE_TOLERANCE_INVALID", "Oracle tolerance bound underflowed.", { path });
  }
  return Math.max(absolute, relativeBound);
}

function meetsToleranceTarget(quantity, target, path) {
  return toleranceBound(quantity.tolerance, quantity.value, `${path}.tolerance`) <=
    toleranceBound(target, quantity.value, `${path}.toleranceTarget`);
}

function expandTolerance(tolerance, multiplier, path) {
  const result = {};
  for (const field of ["absolute", "relative"]) {
    if (tolerance[field] === undefined) continue;
    try {
      result[field] = decimalToNumber(multiplyDecimals(tolerance[field], multiplier));
    } catch (error) {
      if (!(error instanceof KernelError)) throw error;
      fail("ORACLE_TOLERANCE_EXPANSION_INVALID", "Partial-Oracle tolerance expansion failed.", {
        path: `${path}.${field}`,
        causeCode: error.code
      });
    }
  }
  return result;
}

function assertRequestBinding(binding) {
  if (!isObject(binding)) {
    fail("ORACLE_REQUEST_BINDING_INVALID", "Oracle response validation requires a supported request binding.");
  }
  assertFields(
    binding,
    new Set(["schemaVersion", "protocol", "requestHash", "request"]),
    ["schemaVersion", "protocol", "requestHash", "request"],
    "$requestBinding",
    "ORACLE_REQUEST_BINDING_INVALID"
  );
  if (
    binding.schemaVersion !== "1" ||
    binding.protocol !== ORACLE_PROTOCOL_VERSION ||
    !CONTENT_HASH.test(binding.requestHash)
  ) {
    fail("ORACLE_REQUEST_BINDING_INVALID", "Oracle response validation requires a supported request binding.");
  }
  const reproduced = createOracleRequestBinding(binding.request);
  const expected = reproduced.requestHash;
  if (binding.requestHash !== expected) {
    fail("ORACLE_REQUEST_HASH_MISMATCH", "Oracle request binding does not match its declared hash.", {
      expected,
      actual: binding.requestHash
    });
  }
}

export function createOracleRequestBinding(request) {
  const input = cloneInput(request, "Oracle request");
  assertFields(input, REQUEST_FIELDS, [...REQUEST_FIELDS], "$", "ORACLE_REQUEST_INVALID");
  if (!Array.isArray(input.quantities) || input.quantities.length === 0) {
    fail("ORACLE_REQUEST_QUANTITY_INVALID", "Oracle request requires at least one quantity specification.");
  }
  if (input.quantities.length > ORACLE_VALIDATION_LIMITS.maxQuantities) {
    fail("ORACLE_REQUEST_QUANTITY_INVALID", "Oracle quantity count exceeds the protocol limit.", {
      count: input.quantities.length,
      maximum: ORACLE_VALIDATION_LIMITS.maxQuantities
    });
  }
  const quantities = input.quantities.map(normalizeQuantitySpec).sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  );
  for (let index = 1; index < quantities.length; index += 1) {
    if (quantities[index - 1].id === quantities[index].id) {
      fail("ORACLE_REQUEST_QUANTITY_DUPLICATE", "Oracle quantity identifiers must be unique.", {
        id: quantities[index].id
      });
    }
  }
  const normalized = {
    candidate: normalizeCandidateForm(input.candidate),
    quantities,
    parameters: normalizeParameters(input.parameters, "$.parameters", "ORACLE_REQUEST_PARAMETER_INVALID"),
    toleranceTarget: normalizeTolerance(input.toleranceTarget, "$.toleranceTarget", "ORACLE_REQUEST_TOLERANCE_INVALID"),
    solver: normalizeSolverIdentity(input.solver, "$.solver")
  };
  const basis = {
    schemaVersion: "1",
    protocol: ORACLE_PROTOCOL_VERSION,
    request: normalized
  };
  return deepFreeze({
    ...basis,
    requestHash: hashCanonical(HASH_DOMAINS.ORACLE_REQUEST, basis)
  });
}

export function validateOracleResponse(requestBinding, response, options = {}) {
  const binding = cloneInput(requestBinding, "Oracle request binding");
  const input = cloneInput(response, "Oracle response");
  const clonedOptions = cloneInput(options, "Oracle validation options");
  if (!isObject(clonedOptions)) throw new TypeError("Oracle validation options must be an object.");
  const optionFields = Object.keys(clonedOptions);
  if (optionFields.some((field) => field !== "partialPolicy" && field !== "evidenceIds")) {
    throw new TypeError("Unknown Oracle validation option.");
  }
  assertRequestBinding(binding);
  const partialPolicy = normalizePartialPolicy(
    clonedOptions.partialPolicy === undefined ? { mode: "indeterminate" } : clonedOptions.partialPolicy
  );
  const evidenceRegistry = normalizeEvidenceRegistry(clonedOptions.evidenceIds);

  assertFields(input, RESPONSE_FIELDS, ["requestHash", "values", "convergence", "solver", "wallTimeMs"], "$", "ORACLE_RESPONSE_INVALID");
  if (input.requestHash !== binding.requestHash) {
    fail("ORACLE_REQUEST_HASH_MISMATCH", "Oracle response is bound to a different request.", {
      expected: binding.requestHash,
      actual: input.requestHash
    });
  }
  if (!CONVERGENCE_STATES.has(input.convergence)) {
    fail("ORACLE_CONVERGENCE_INVALID", "Oracle response convergence state is invalid.", {
      convergence: input.convergence
    });
  }
  if (!Number.isFinite(input.wallTimeMs) || input.wallTimeMs < 0) {
    fail("ORACLE_RESPONSE_INVALID", "Oracle wall time must be finite and non-negative.", {
      wallTimeMs: input.wallTimeMs
    });
  }
  const solverIdentity = normalizeSolverIdentity(input.solver, "$.solver", true);
  const solver = {
    ...solverIdentity,
    parameters: normalizeParameters(input.solver.parameters, "$.solver.parameters", "ORACLE_RESPONSE_SOLVER_INVALID")
  };
  if (
    solver.id !== binding.request.solver.id ||
    solver.version !== binding.request.solver.version ||
    solver.method !== binding.request.solver.method
  ) {
    fail("ORACLE_SOLVER_MISMATCH", "Oracle response solver identity does not match the request.", {
      expected: binding.request.solver,
      actual: solverIdentity
    });
  }
  if (canonicalize(solver.parameters) !== canonicalize(binding.request.parameters)) {
    fail("ORACLE_SOLVER_PARAMETER_MISMATCH", "Oracle response solver parameters do not match the request.");
  }

  if (!isObject(input.values)) {
    fail("ORACLE_RESPONSE_VALUE_INVALID", "Oracle response values must be an object.");
  }
  const specifications = new Map(binding.request.quantities.map((entry) => [entry.id, entry]));
  const valueIds = Object.keys(input.values).sort();
  if (valueIds.length > ORACLE_VALIDATION_LIMITS.maxQuantities) {
    fail("ORACLE_RESPONSE_VALUE_INVALID", "Oracle response quantity count exceeds the protocol limit.", {
      count: valueIds.length,
      maximum: ORACLE_VALIDATION_LIMITS.maxQuantities
    });
  }
  const unexpected = valueIds.filter((id) => !specifications.has(id));
  if (unexpected.length > 0) {
    fail("ORACLE_RESPONSE_VALUE_SET_INVALID", "Oracle response contains unrequested quantities.", { unexpected });
  }
  const returnedValues = {};
  for (const id of valueIds) {
    identifier(id, `$.values.${id}`, "ORACLE_RESPONSE_VALUE_INVALID");
    const normalized = normalizeQuantityAt(input.values[id], `$.values.${id}`, "ORACLE_RESPONSE_VALUE_INVALID");
    const specification = specifications.get(id);
    if (normalized.unit !== specification.unit) {
      fail("ORACLE_RESPONSE_UNIT_MISMATCH", "Oracle quantity unit does not match the request.", {
        id,
        expected: specification.unit,
        actual: normalized.unit
      });
    }
    if (normalized.semantic !== specification.semantic) {
      fail("ORACLE_RESPONSE_SEMANTIC_MISMATCH", "Oracle quantity semantic does not match the request.", {
        id,
        expected: specification.semantic,
        actual: normalized.semantic
      });
    }
    assertOracleProvenance(normalized, binding, `$.values.${id}.provenance`, evidenceRegistry);
    returnedValues[id] = normalized;
  }

  const residual = input.residual === undefined
    ? undefined
    : normalizeQuantityAt(input.residual, "$.residual", "ORACLE_RESIDUAL_INVALID");
  if (input.convergence === "partial" && residual === undefined) {
    fail("ORACLE_RESIDUAL_REQUIRED", "A partial Oracle response requires a residual quantity.");
  }
  if (residual !== undefined) {
    if (residual.value < 0) {
      fail("ORACLE_RESIDUAL_INVALID", "Oracle residual must be non-negative.", { value: residual.value });
    }
    assertOracleProvenance(residual, binding, "$.residual.provenance", evidenceRegistry);
  }

  const requestedIds = binding.request.quantities.map((entry) => entry.id);
  const missing = requestedIds.filter((id) => returnedValues[id] === undefined);
  let status = "accepted";
  let acceptedValues = {};
  let toleranceAdjustments = [];
  const reasons = [];

  if (input.convergence === "failed") {
    status = "indeterminate";
    reasons.push("oracle-failed");
  } else if (input.convergence === "converged") {
    if (missing.length > 0) {
      fail("ORACLE_RESPONSE_VALUE_SET_INVALID", "Converged Oracle response is missing requested quantities.", { missing });
    }
    for (const specification of binding.request.quantities) {
      const value = returnedValues[specification.id];
      if (!meetsToleranceTarget(value, specification.toleranceTarget, `$.values.${specification.id}`)) {
        fail("ORACLE_TOLERANCE_TARGET_UNMET", "Converged Oracle quantity exceeds its requested tolerance target.", {
          id: specification.id
        });
      }
    }
    acceptedValues = returnedValues;
  } else if (partialPolicy.mode === "indeterminate") {
    status = "indeterminate";
    reasons.push("partial-policy-indeterminate");
  } else {
    if (missing.length > 0) {
      status = "indeterminate";
      reasons.push("partial-response-incomplete");
    }
    if (partialPolicy.maximumResidual !== undefined) {
      let withinMaximum;
      try {
        withinMaximum = compareQuantities(
          residual,
          "lte",
          partialPolicy.maximumResidual
        ).pass;
      } catch (error) {
        if (!(error instanceof KernelError)) throw error;
        fail("ORACLE_RESIDUAL_INVALID", "Oracle residual is incompatible with the partial-result guard.", {
          causeCode: error.code
        });
      }
      if (!withinMaximum) {
        status = "indeterminate";
        reasons.push("partial-residual-exceeds-maximum");
      }
    }
    const adjustedValues = {};
    const adjustments = [];
    let toleranceUnmet = false;
    for (const specification of binding.request.quantities) {
      const value = returnedValues[specification.id];
      if (value === undefined) continue;
      const effective = expandTolerance(
        specification.toleranceTarget,
        partialPolicy.toleranceMultiplier,
        `$.quantities.${specification.id}.toleranceTarget`
      );
      if (!meetsToleranceTarget(value, effective, `$.values.${specification.id}`)) {
        toleranceUnmet = true;
      }
      adjustedValues[specification.id] = deepFreeze({ ...value, tolerance: effective });
      adjustments.push({
        quantityId: specification.id,
        original: specification.toleranceTarget,
        effective
      });
    }
    if (toleranceUnmet) {
      status = "indeterminate";
      reasons.push("partial-tolerance-target-unmet");
    }
    if (status === "accepted") {
      acceptedValues = adjustedValues;
      toleranceAdjustments = adjustments;
    }
  }

  const semanticResponse = {
    schemaVersion: "1",
    protocol: ORACLE_PROTOCOL_VERSION,
    requestHash: binding.requestHash,
    returnedValues,
    convergence: input.convergence,
    ...(residual === undefined ? {} : { residual }),
    solver
  };
  const responseHash = hashCanonical(HASH_DOMAINS.ORACLE_RESPONSE, semanticResponse);
  const basis = {
    schemaVersion: "1",
    validator: ORACLE_RESPONSE_VALIDATOR_VERSION,
    requestHash: binding.requestHash,
    responseHash,
    status,
    convergence: input.convergence,
    acceptedValues,
    partialPolicy,
    toleranceAdjustments,
    reasons
  };
  return deepFreeze({
    ...basis,
    validationHash: hashCanonical(HASH_DOMAINS.ORACLE_VALIDATION, basis),
    returnedValues,
    ...(residual === undefined ? {} : { residual }),
    solver,
    wallTimeMs: Object.is(input.wallTimeMs, -0) ? 0 : input.wallTimeMs
  });
}
