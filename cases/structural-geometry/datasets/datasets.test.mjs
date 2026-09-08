import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { verifyReport } from "./build.mjs";

test("biological source acquisition and native adapters pass offline corruption and alignment tests", () => {
  const result = spawnSync("python3", ["-B", "-m", "unittest", "discover", "-p", "test_*.py"], {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    encoding: "utf8",
    timeout: 30_000
  });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});

test("committed biological census binds the selected sources and current implementation", async () => {
  const report = await verifyReport();
  assert.equal(report.status, "source-applicability-only-not-biological-evaluation");
});
