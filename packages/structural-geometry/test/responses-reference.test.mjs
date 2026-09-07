import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { run, verifyReferenceSources } from "../../../cases/structural-geometry/responses/build.mjs";
import { readJson } from "../../../cases/structural-geometry/responses/fixtures.mjs";

test("all response goldens replay after independent exhaustive targets, graph effects and 341 aggregation profiles", async () => {
  const suite = await run(); assert.equal(suite.runs.length, 16); assert.equal(suite.census.targets, 1438);
});
test("response reference verification rejects omitted or changed source and dependency bindings", async () => {
  const original = await readJson("reference.json");
  for (const mutate of [r => { delete r.sourceHashes["../typed/reference.py"]; }, r => { r.sourceHashes["PROTOCOL.md"] = "0".repeat(64); }]) {
    const r = structuredClone(original); mutate(r); await assert.rejects(() => verifyReferenceSources(r));
  }
});
test("independent Python verifies selectors, paths, transformations, graph orbits, deltas and every stored artifact", () => {
  const cwd = fileURLToPath(new URL("../../../", import.meta.url));
  const output = execFileSync("python3", ["-B", "cases/structural-geometry/responses/reference.py", "--verify-artifacts"], { cwd, encoding: "utf8" });
  assert.match(output, /1438/); assert.match(output, /341 aggregation profiles/);
});
