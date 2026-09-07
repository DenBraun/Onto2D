import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run, verifyReferenceSources } from "../../../cases/structural-geometry/signatures/build.mjs";
import { readJson } from "../../../cases/structural-geometry/signatures/fixtures.mjs";

test("all signature artifacts replay against independent source-derived responses, 207 census requests and 2343 adjudications", async () => {
  const suite = await run(); assert.equal(suite.runs.length, 27); assert.equal(suite.contrasts.length, 9);
  assert.equal(suite.census.complete, 0); assert.equal(suite.census.observedFeatures, 345);
});
test("signature references reject omitted, changed or extra source/protocol dependencies", async () => {
  const reference = await readJson("reference.json");
  for (const mutate of [r => { delete r.sourceHashes["../responses/reference.py"]; }, r => { delete r.sourceHashes["../responses/build.mjs"]; },
    r => { r.sourceHashes["PROTOCOL.md"] = "0".repeat(64); },
    r => { r.sourceHashes["foreign"] = "0".repeat(64); }]) {
    const r = structuredClone(reference); mutate(r); await assert.rejects(() => verifyReferenceSources(r));
  }
});
test("independent Python replays complete and incomplete signatures, joint feature rows and all source-derived response evidence", () => {
  const cwd = fileURLToPath(new URL("../../../", import.meta.url));
  const output = execFileSync("python3", ["-B", "cases/structural-geometry/signatures/reference.py", "--verify-artifacts"], { cwd, encoding: "utf8" });
  assert.match(output, /27 controls/); assert.match(output, /2343 adjudications/);
});
