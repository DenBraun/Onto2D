import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidScientificAdapterError,
  SCIENTIFIC_ADAPTER_STATUS,
  defineScientificAdapter
} from "../src/index.js";

test("scientific adapter boundary validates and freezes implementations", async () => {
  const requestHash = `sha256:${"c".repeat(64)}`;
  const adapter = defineScientificAdapter({
    id: "fixture",
    version: "fixture-1",
    method: "constant-fixture",
    async evaluate(request) {
      return {
        requestHash,
        values: {},
        convergence: "converged",
        solver: {
          id: "fixture",
          version: "fixture-1",
          method: "constant-fixture",
          parameters: request.parameters
        },
        wallTimeMs: 0
      };
    }
  });

  assert.equal(SCIENTIFIC_ADAPTER_STATUS, "interface-defined/external-reference-available");
  assert.ok(Object.isFrozen(adapter));
  assert.deepEqual(await adapter.evaluate({ parameters: { seed: "fixture" } }), {
    requestHash,
    values: {},
    convergence: "converged",
    solver: {
      id: "fixture",
      version: "fixture-1",
      method: "constant-fixture",
      parameters: { seed: "fixture" }
    },
    wallTimeMs: 0
  });
});

test("scientific adapter boundary rejects incomplete implementations", () => {
  assert.throws(
    () => defineScientificAdapter({ id: "fixture" }),
    InvalidScientificAdapterError
  );
});

test("scientific adapter definitions are exact and accessor-safe", () => {
  let reads = 0;
  const active = {
    id: "fixture",
    version: "1",
    method: "fixture",
    evaluate() {}
  };
  Object.defineProperty(active, "id", {
    enumerable: true,
    get() {
      reads += 1;
      return "fixture";
    }
  });
  assert.throws(() => defineScientificAdapter(active), InvalidScientificAdapterError);
  assert.equal(reads, 0);
  assert.throws(
    () => defineScientificAdapter({
      id: "fixture",
      version: "1",
      method: "fixture",
      evaluate() {},
      hiddenPolicy: "not-declared"
    }),
    InvalidScientificAdapterError
  );
});
