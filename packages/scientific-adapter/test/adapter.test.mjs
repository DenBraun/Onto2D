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

  assert.equal(SCIENTIFIC_ADAPTER_STATUS, "interface-defined/implementations-pending");
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
