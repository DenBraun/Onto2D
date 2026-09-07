import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run, verifyReferenceSources } from "../../../cases/structural-geometry/pseudometric/build.mjs";
import { readJson } from "../../../cases/structural-geometry/pseudometric/fixtures.mjs";
test("all 60 artifacts replay against independent source signatures, exact metric laws and partial counterexamples", async () => {
  const suite = await run(); assert.equal(suite.runs.length, 60); assert.equal(suite.aggregationProfiles, 728);
  assert.equal(suite.metricProperties.reduce((n, r) => n + r.orderedTriangles, 0), 14368590);
});
test("reference validation rejects omitted, changed or extra source and bridge bindings", async () => {
  const reference = await readJson("reference.json");
  for (const mutate of [r => { delete r.sourceHashes["../signatures/reference.py"]; }, r => { delete r.sourceHashes["../signatures/build.mjs"]; },
    r => { r.sourceHashes["PROTOCOL.md"] = "0".repeat(64); }, r => { r.sourceHashes.foreign = "0".repeat(64); }]) {
    const r = structuredClone(reference); mutate(r); await assert.rejects(() => verifyReferenceSources(r));
  }
});
test("independent Python derives source responses and checks full endpoint signatures plus exact comparison results", () => {
  const cwd = fileURLToPath(new URL("../../../", import.meta.url));
  const output = execFileSync("python3", ["-B", "cases/structural-geometry/pseudometric/reference.py", "--verify-artifacts"], { cwd, encoding: "utf8" });
  assert.match(output, /60 controls/); assert.match(output, /14368590 triangles/);
});
