import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("research source acquisition rejects corrupt and incomplete downloads", () => {
  const result = spawnSync("python3", ["-B", "test_sources.py"], {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    encoding: "utf8",
    timeout: 30_000
  });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});
