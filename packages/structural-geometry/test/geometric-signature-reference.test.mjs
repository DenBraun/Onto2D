import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run, verifyReferenceSources } from "../../../cases/structural-geometry/geometric-signatures/build.mjs";
import { readJson } from "../../../cases/structural-geometry/geometric-signatures/fixtures.mjs";
test("all geometric goldens replay against independent source measurements, extrema and threshold profiles", async () => {
  const suite = await run(); assert.equal(suite.runs.length, 25); assert.equal(suite.properties.intervalExtrema.profiles, 781); assert.equal(suite.properties.thresholdTraces.profiles, 820);
});
test("independent source bindings reject omitted, changed or extra controls and helper dependencies", async () => {
  const reference = await readJson("reference.json"), measurements = await readJson("measurements.json");
  for (const mutate of [r => { delete r.sourceHashes["measurements.py"]; }, r => { r.sourceHashes["PROTOCOL.md"] = "0".repeat(64); }, r => { r.sourceHashes.foreign = "0".repeat(64); }]) {
    const r = structuredClone(reference); mutate(r); await assert.rejects(() => verifyReferenceSources(r, measurements));
  }
  const m = structuredClone(measurements); delete m.sourceHashes["../flow/networkx_reference.py"];
  await assert.rejects(() => verifyReferenceSources(reference, m));
});
test("independent Python replays every geometric descriptor and provenance set including unavailable future frames", () => {
  const cwd = fileURLToPath(new URL("../../../", import.meta.url));
  const output = execFileSync("python3", ["-B", "cases/structural-geometry/geometric-signatures/reference.py", "--verify-artifacts"], { cwd, encoding: "utf8" });
  assert.match(output, /25 cases/); assert.match(output, /781 interval profiles/); assert.match(output, /820 threshold traces/);
});
