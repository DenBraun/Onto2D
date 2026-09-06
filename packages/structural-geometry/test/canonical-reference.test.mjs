import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { verifyCensus, verifySixNodeRelabelings } from "../../../cases/structural-geometry/canonical/census.mjs";
import { readJson } from "../../../cases/structural-geometry/canonical/fixtures.mjs";
import { verifyReferenceSources } from "../../../cases/structural-geometry/canonical/build.mjs";

test("all 4165 directed graphs on 1–4 nodes agree with independent permutation classes without false merges or splits", async () => {
  const result = await verifyCensus();
  assert.deepEqual(result, (await readJson("suite.json")).census);
  assert.equal(result.rows.reduce((sum, r) => sum + r.labelledGraphs, 0), 4165);
  assert.equal(result.rows.reduce((sum, r) => sum + r.isomorphismClasses, 0), 238);
});

test("all 720 relabelings of the declared six-node directed control retain the exact canonical value", async () => {
  assert.deepEqual(await verifySixNodeRelabelings(), (await readJson("suite.json")).relabelings);
});

test("independent Python permutations regenerate expectations and verify all stored directed mapping witnesses", async () => {
  const reference = await readJson("reference.json");
  await verifyReferenceSources(reference);
  for (const field of ["controlsFileSha256", "causalFileSha256"]) {
    await assert.rejects(() => verifyReferenceSources({ ...reference, [field]: "0".repeat(64) }), /source binding differs/);
  }
  const script = fileURLToPath(new URL("../../../cases/structural-geometry/canonical/reference.py", import.meta.url));
  for (const action of ["--verify", "--verify-artifacts"]) {
    const result = spawnSync("python3", ["-B", script, action], { encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  }
});
