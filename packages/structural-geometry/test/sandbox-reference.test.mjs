import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run, verifyReferenceSources } from "../../../cases/structural-geometry/sandbox/build.mjs";
import { readJson } from "../../../cases/structural-geometry/sandbox/fixtures.mjs";

test("all 51 frozen runs and all 345 small-graph requests reproduce independent transformations", async () => {
  assert.deepEqual(await run(), await readJson("suite.json"));
});

test("sandbox reference rejects changed, missing and extra source bindings", async () => {
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  for (const file of Object.keys(reference.sourceHashes)) {
    await assert.rejects(() => verifyReferenceSources({ ...reference, sourceHashes: { ...reference.sourceHashes, [file]: "0".repeat(64) } }), /source binding differs/);
  }
  const missing = structuredClone(reference); delete missing.sourceHashes["PROTOCOL.md"];
  await assert.rejects(() => verifyReferenceSources(missing), /source coverage differs/);
  await assert.rejects(() => verifyReferenceSources({ ...reference, sourceHashes: { ...reference.sourceHashes, unknown: "0".repeat(64) } }), /source coverage differs/);
});

test("independent Python set transformations reproduce the source expectations and stored graphs/mappings", () => {
  const script = fileURLToPath(new URL("../../../cases/structural-geometry/sandbox/reference.py", import.meta.url));
  for (const action of ["--verify", "--verify-artifacts"]) {
    const result = spawnSync("python3", ["-B", script, action], { encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  }
});
