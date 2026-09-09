import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("single-pass functional extraction verifies complete source bytes and exact window coordinates", () => {
  const result = spawnSync("python3", ["-B", fileURLToPath(new URL("test_extract.py", import.meta.url))],
    { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stderr, /Ran 6 tests/);
});
