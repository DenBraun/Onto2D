import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import {
  HASH_DOMAINS,
  KernelError,
  ORACLE_PROTOCOL_VERSION,
  ORACLE_RESPONSE_VALIDATOR_VERSION,
  ORACLE_VALIDATION_LIMITS,
  canonicalizeCandidate,
  createCanonicalForm,
  createOracleRequestBinding,
  validateOracleResponse
} from "../src/index.js";

function declaredQuantity(value, unit, semantic, tolerance = { absolute: 0 }) {
  return {
    value,
    unit,
    tolerance,
    semantic,
    provenance: { kind: "declared", evidence: [] }
  };
}

function oracleQuantity(binding, value, unit, semantic, tolerance = { absolute: 0 }) {
  return {
    value,
    unit,
    tolerance,
    semantic,
    provenance: {
      kind: "oracle",
      source: binding.requestHash,
      method: binding.request.solver.method,
      evidence: ["oracle-evidence"]
    }
  };
}

const candidate = canonicalizeCandidate({
  domain: "single-candidate",
  nodes: [{ ref: `sha256:${"a".repeat(64)}` }],
  edges: []
}).canonicalForm;

function request(overrides = {}) {
  return {
    candidate,
    quantities: [{
      id: "length",
      unit: "cm",
      semantic: "length",
      toleranceTarget: { absolute: 0.1 }
    }],
    parameters: {
      iterations: 100,
      step: declaredQuantity(100, "cm", "length", { absolute: 0.1 })
    },
    toleranceTarget: { relative: 1e-6 },
    solver: { id: "fixture-solver", version: "1.0.0", method: "finite-grid-v1" },
    ...overrides
  };
}

function response(binding, overrides = {}) {
  return {
    requestHash: binding.requestHash,
    values: {
      length: oracleQuantity(binding, 1, "m", "length", { absolute: 0.0005 })
    },
    convergence: "converged",
    solver: {
      ...binding.request.solver,
      parameters: binding.request.parameters
    },
    wallTimeMs: 12.5,
    ...overrides
  };
}

test("Oracle request binding normalizes units, ordering, parameters, and candidate bytes", () => {
  const binding = createOracleRequestBinding(request());
  const equivalent = createOracleRequestBinding(request({
    quantities: [{
      id: "length",
      unit: "m",
      semantic: "length",
      toleranceTarget: { absolute: 0.001 }
    }],
    parameters: {
      step: declaredQuantity(1, "m", "length", { absolute: 0.001 }),
      iterations: 100
    }
  }));

  assert.equal(ORACLE_PROTOCOL_VERSION, "oracle-protocol-v1");
  assert.deepEqual(ORACLE_VALIDATION_LIMITS, {
    maxQuantities: 10_000,
    maxParameters: 10_000,
    maxEvidenceIds: 10_000,
    maxIdentifierLength: 1_024
  });
  assert.equal(binding.request.quantities[0].unit, "m");
  assert.equal(binding.request.quantities[0].toleranceTarget.absolute, 0.001);
  assert.equal(binding.request.parameters.step.value, 1);
  assert.equal(binding.requestHash, equivalent.requestHash);
  assert.notEqual(
    binding.requestHash,
    createOracleRequestBinding(request({
      solver: { ...request().solver, version: "1.0.1" }
    })).requestHash
  );
  assert.match(binding.requestHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(binding));
});

test("converged Oracle responses validate binding, evidence, target tolerance, and operational hashing", () => {
  const binding = createOracleRequestBinding(request());
  const first = validateOracleResponse(binding, response(binding), {
    evidenceIds: ["oracle-evidence"]
  });
  const later = validateOracleResponse(binding, response(binding, { wallTimeMs: 99 }), {
    evidenceIds: ["oracle-evidence"]
  });

  assert.equal(ORACLE_RESPONSE_VALIDATOR_VERSION, "oracle-response-validator-v1");
  assert.equal(first.status, "accepted");
  assert.deepEqual(first.reasons, []);
  assert.equal(first.acceptedValues.length.value, 1);
  assert.equal(first.responseHash, later.responseHash);
  assert.equal(first.validationHash, later.validationHash);
  assert.notEqual(first.wallTimeMs, later.wallTimeMs);
  assert.match(first.responseHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.acceptedValues));
});

test("failed and default-disallowed partial responses become traceable indeterminate results", () => {
  const binding = createOracleRequestBinding(request());
  const failed = validateOracleResponse(binding, response(binding, {
    convergence: "failed",
    values: {}
  }));
  const partial = validateOracleResponse(binding, response(binding, {
    convergence: "partial",
    residual: oracleQuantity(binding, 0.01, "1", "solver-residual", { absolute: 0.0001 })
  }), { evidenceIds: ["oracle-evidence"] });

  assert.equal(failed.status, "indeterminate");
  assert.deepEqual(failed.reasons, ["oracle-failed"]);
  assert.deepEqual(failed.acceptedValues, {});
  assert.equal(partial.status, "indeterminate");
  assert.deepEqual(partial.reasons, ["partial-policy-indeterminate"]);
  assert.throws(
    () => validateOracleResponse(binding, response(binding, { convergence: "partial" })),
    (error) => error instanceof KernelError && error.code === "ORACLE_RESIDUAL_REQUIRED"
  );
});

test("approved partial responses expand declared targets exactly and enforce the residual guard", () => {
  const binding = createOracleRequestBinding(request());
  const partialResponse = response(binding, {
    values: {
      length: oracleQuantity(binding, 1, "m", "length", { absolute: 0.0015 })
    },
    convergence: "partial",
    residual: oracleQuantity(binding, 0.01, "1", "solver-residual", { absolute: 0.0001 })
  });
  const partialPolicy = {
    mode: "accept-expanded-tolerance",
    toleranceMultiplier: 2,
    maximumResidual: declaredQuantity(0.02, "1", "solver-residual")
  };
  const accepted = validateOracleResponse(binding, partialResponse, {
    partialPolicy,
    evidenceIds: ["oracle-evidence"]
  });
  const rejected = validateOracleResponse(binding, {
    ...partialResponse,
    residual: oracleQuantity(binding, 0.03, "1", "solver-residual", { absolute: 0.0001 })
  }, {
    partialPolicy,
    evidenceIds: ["oracle-evidence"]
  });

  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.acceptedValues.length.tolerance.absolute, 0.002);
  assert.deepEqual(accepted.toleranceAdjustments, [{
    quantityId: "length",
    original: { absolute: 0.001 },
    effective: { absolute: 0.002 }
  }]);
  assert.equal(rejected.status, "indeterminate");
  assert.ok(rejected.reasons.includes("partial-residual-exceeds-maximum"));
  assert.deepEqual(rejected.acceptedValues, {});
});

test("Oracle protocol rejects stale requests, solver drift, missing values, and invalid evidence binding", () => {
  const binding = createOracleRequestBinding(request());
  assert.throws(
    () => validateOracleResponse(binding, response(binding, {
      requestHash: `sha256:${"f".repeat(64)}`
    })),
    (error) => error instanceof KernelError && error.code === "ORACLE_REQUEST_HASH_MISMATCH"
  );
  assert.throws(
    () => validateOracleResponse(binding, response(binding, {
      solver: { ...response(binding).solver, version: "2.0.0" }
    })),
    (error) => error instanceof KernelError && error.code === "ORACLE_SOLVER_MISMATCH"
  );
  assert.throws(
    () => validateOracleResponse(binding, response(binding, { values: {} })),
    (error) => error instanceof KernelError && error.code === "ORACLE_RESPONSE_VALUE_SET_INVALID"
  );
  assert.throws(
    () => validateOracleResponse(binding, response(binding, {
      values: {
        length: {
          ...oracleQuantity(binding, 1, "m", "length", { absolute: 0.0005 }),
          provenance: {
            kind: "oracle",
            source: `sha256:${"f".repeat(64)}`,
            method: binding.request.solver.method,
            evidence: ["oracle-evidence"]
          }
        }
      }
    })),
    (error) => error instanceof KernelError && error.code === "ORACLE_EVIDENCE_BINDING_INVALID"
  );
  assert.throws(
    () => validateOracleResponse(binding, response(binding), { evidenceIds: [] }),
    (error) => error instanceof KernelError && error.code === "ORACLE_EVIDENCE_REFERENCE_MISSING"
  );
  assert.throws(
    () => validateOracleResponse(binding, response(binding, {
      values: {
        length: oracleQuantity(binding, 1, "s", "length", { absolute: 0.0005 })
      }
    })),
    (error) => error instanceof KernelError && error.code === "ORACLE_RESPONSE_UNIT_MISMATCH"
  );
  assert.throws(
    () => validateOracleResponse(binding, response(binding, {
      values: {
        length: oracleQuantity(binding, 1, "m", "length", { absolute: 0.01 })
      }
    })),
    (error) => error instanceof KernelError && error.code === "ORACLE_TOLERANCE_TARGET_UNMET"
  );
});

test("Oracle requests reject altered candidate forms and duplicate quantity identifiers", () => {
  const alteredCandidate = createCanonicalForm(HASH_DOMAINS.CANDIDATE, {
    ...JSON.parse(Buffer.from(candidate.bytesBase64, "base64").toString("utf8")),
    nodes: [{ ref: `sha256:${"b".repeat(64)}` }]
  });
  assert.throws(
    () => createOracleRequestBinding(request({
      candidate: { ...candidate, bytesBase64: alteredCandidate.bytesBase64 }
    })),
    (error) => error instanceof KernelError && error.code === "ORACLE_REQUEST_CANDIDATE_HASH_MISMATCH"
  );
  const twoNodeCandidate = canonicalizeCandidate({
    domain: "single-candidate",
    nodes: [
      { ref: `sha256:${"a".repeat(64)}` },
      { ref: `sha256:${"b".repeat(64)}` }
    ],
    edges: [{ from: 0, to: 1, role: "supports" }]
  }).canonicalForm;
  const noncanonicalPayload = JSON.parse(
    Buffer.from(twoNodeCandidate.bytesBase64, "base64").toString("utf8")
  );
  noncanonicalPayload.nodes.reverse();
  noncanonicalPayload.edges = noncanonicalPayload.edges.map((edge) => ({
    ...edge,
    from: 1 - edge.from,
    to: 1 - edge.to
  }));
  const selfConsistentButNoncanonical = createCanonicalForm(
    HASH_DOMAINS.CANDIDATE,
    noncanonicalPayload
  );
  assert.throws(
    () => createOracleRequestBinding(request({ candidate: selfConsistentButNoncanonical })),
    (error) => error instanceof KernelError && error.code === "ORACLE_REQUEST_CANDIDATE_INVALID"
  );
  assert.throws(
    () => createOracleRequestBinding(request({
      quantities: [request().quantities[0], request().quantities[0]]
    })),
    (error) => error instanceof KernelError && error.code === "ORACLE_REQUEST_QUANTITY_DUPLICATE"
  );
});
