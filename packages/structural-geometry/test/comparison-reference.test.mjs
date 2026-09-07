import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run, verifyReferenceSources } from "../../../cases/structural-geometry/comparison/build.mjs";
import { readJson } from "../../../cases/structural-geometry/comparison/fixtures.mjs";

test("all frozen comparisons reproduce independent source-derived values, strict statuses and coverage", async () => {
  assert.deepEqual(await run(), await readJson("suite.json"));
});

test("comparison reference rejects changed, missing and unexpected source bindings", async () => {
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  for (const file of Object.keys(reference.sourceHashes)) {
    await assert.rejects(() => verifyReferenceSources({ ...reference, sourceHashes: { ...reference.sourceHashes, [file]: "0".repeat(64) } }), /source binding differs/);
  }
  const missing = structuredClone(reference); delete missing.sourceHashes["controls.json"];
  await assert.rejects(() => verifyReferenceSources(missing), /source coverage differs/);
  await assert.rejects(() => verifyReferenceSources({ ...reference, sourceHashes: { ...reference.sourceHashes, unknown: "0".repeat(64) } }), /source coverage differs/);
});

test("independent Python permutations and matrix closure reproduce the reference and stored values", () => {
  const script = fileURLToPath(new URL("../../../cases/structural-geometry/comparison/reference.py", import.meta.url));
  for (const action of ["--verify", "--verify-artifacts"]) {
    const result = spawnSync("python3", ["-B", script, action], { encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  }
});
