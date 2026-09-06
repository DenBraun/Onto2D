import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { verifyCensus, verifySixNodeRelabelings } from "../../../cases/structural-geometry/typed/census.mjs";
import { verifyReferenceSources } from "../../../cases/structural-geometry/typed/build.mjs";
import { readJson } from "../../../cases/structural-geometry/typed/fixtures.mjs";

test("all 739 absent/A/B directed graphs agree with 145 independently enumerated joint typed classes", async () => {
  const result = await verifyCensus(); assert.deepEqual(result, (await readJson("suite.json")).census);
  assert.equal(result.rows.reduce((sum, r) => sum + r.labelledGraphs, 0), 739);
  assert.equal(result.rows.reduce((sum, r) => sum + r.typedIsomorphismClasses, 0), 145);
});

test("all 720 relabelings of the declared six-node typed control preserve its joint canonical value", async () => {
  assert.deepEqual(await verifySixNodeRelabelings(), (await readJson("suite.json")).relabelings);
});

test("independent Python permutations verify original/remapped witnesses and all locked reference inputs", async () => {
  const reference = await readJson("reference.json"); await verifyReferenceSources(reference);
  for (const field of ["controlsFileSha256", "protocolFileSha256", "causalFileSha256", "canonicalReferenceFileSha256"]) {
    await assert.rejects(() => verifyReferenceSources({ ...reference, [field]: "0".repeat(64) }), /source binding differs/);
  }
  const script = fileURLToPath(new URL("../../../cases/structural-geometry/typed/reference.py", import.meta.url));
  for (const action of ["--verify", "--verify-artifacts"]) {
    const result = spawnSync("python3", ["-B", script, action], { encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  }
});
