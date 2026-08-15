import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRepositoryPath } from "../../scripts/check-kernel-closure.mjs";

test("kernel closure evidence paths are portable across operating systems", () => {
  const portable = "packages/kernel/test/canonicalize.test.mjs";

  assert.equal(normalizeRepositoryPath(portable), portable);
  assert.equal(
    normalizeRepositoryPath("packages\\kernel\\test\\canonicalize.test.mjs"),
    portable
  );
});
