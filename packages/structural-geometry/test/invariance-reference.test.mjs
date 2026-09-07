import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run, verifyReferenceSources } from "../../../cases/structural-geometry/invariance/build.mjs";
import { readJson } from "../../../cases/structural-geometry/invariance/fixtures.mjs";

test("all invariance goldens replay after independently measured census, negative and strict-profile controls", async () => {
  const suite = await run(); assert.equal(suite.runs.length, 13); assert.equal(suite.census.probes, 828);
});
test("reference verification rejects omitted and changed source or dependency bindings", async () => {
  const original = await readJson("reference.json");
  for (const mutate of [r => { delete r.sourceHashes["../typed/reference.py"]; }, r => { r.sourceHashes["PROTOCOL.md"] = "0".repeat(64); }]) {
    const r = structuredClone(original); mutate(r); await assert.rejects(() => verifyReferenceSources(r));
  }
});
test("independent Python checks graph orbits, payload mappings, missingness and all stored artifacts", () => {
  const cwd = fileURLToPath(new URL("../../../", import.meta.url));
  const output = execFileSync("python3", ["-B", "cases/structural-geometry/invariance/reference.py", "--verify-artifacts"], { cwd, encoding: "utf8" });
  assert.match(output, /207 requests \/ 828 probes/);
});
