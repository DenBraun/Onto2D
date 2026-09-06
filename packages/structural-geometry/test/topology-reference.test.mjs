import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { verifyCensus } from "../../../cases/structural-geometry/topology/census.mjs";
import { readJson } from "../../../cases/structural-geometry/topology/fixtures.mjs";
import { verifyReferenceSources } from "../../../cases/structural-geometry/topology/build.mjs";

test("all 4165 directed graphs agree with independent matrix closure and retain every known summary collision", async () => {
  const result = await verifyCensus();
  assert.deepEqual(result, (await readJson("suite.json")).census);
  assert.equal(result.rows.reduce((sum, r) => sum + r.labelledGraphs, 0), 4165);
  assert.equal(result.rows.reduce((sum, r) => sum + r.isomorphismClasses, 0), 238);
  assert.ok(result.rows.at(-1).collidingSummaryClasses > 0);
});

test("independent matrix closure regenerates expectations, verifies artifacts and guards all frozen reference sources", async () => {
  const reference = await readJson("reference.json");
  await verifyReferenceSources(reference);
  for (const field of ["controlsFileSha256", "causalFileSha256", "canonicalReferenceFileSha256"]) {
    await assert.rejects(() => verifyReferenceSources({ ...reference, [field]: "0".repeat(64) }), /source binding differs/);
  }
  const script = fileURLToPath(new URL("../../../cases/structural-geometry/topology/reference.py", import.meta.url));
  for (const action of ["--verify", "--verify-artifacts"]) {
    const result = spawnSync("python3", ["-B", script, action], { encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  }
});
