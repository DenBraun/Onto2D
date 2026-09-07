import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { baselines, colorRefinement } from "../../../cases/structural-geometry/added-value/baselines.mjs";
import { run, verifyReferences } from "../../../cases/structural-geometry/added-value/build.mjs";
import { readJson } from "../../../cases/structural-geometry/added-value/generate.mjs";
const cwd = fileURLToPath(new URL("../../../", import.meta.url));
test("the whole added-value study replays against independent measurements, descriptors, source plans and paired outcomes", async () => {
  const suite = await run(); assert.equal(suite.pairs.length, 531); assert.equal(suite.units.length, 68);
});
test("independent Python replays all 68 source-bound unit records and the complete outcome table", () => {
  const output = execFileSync("python3", ["-B", "cases/structural-geometry/added-value/reference.py", "--verify-artifacts"], { cwd, encoding: "utf8" });
  assert.match(output, /68 units and 531 paired outcomes/);
});
test("the spectral, motif, canonical, degree, topology and refinement baselines agree independently on all 64 three-node digraphs", () => {
  const script = `import importlib.util, json, itertools
from pathlib import Path
spec=importlib.util.spec_from_file_location('study', Path('cases/structural-geometry/added-value/reference.py'))
r=importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
arcs=list(itertools.permutations(range(3),2))
graphs=[(3,[e for i,e in enumerate(arcs) if mask & (1<<i)]) for mask in range(64)]
print(json.dumps({'baselines':[r.baselines(*g) for g in graphs],'refinement':r.refinement(graphs)}))`;
  const independent = JSON.parse(execFileSync("python3", ["-B", "-c", script], { cwd, encoding: "utf8" }));
  const arcs = Array.from({ length: 3 }, (_, u) => Array.from({ length: 3 }, (_, v) => [u, v]).filter(([u, v]) => u !== v)).flat();
  const graphs = Array.from({ length: 64 }, (_, mask) => ({ n: 3, edges: arcs.filter((_, i) => mask & (1 << i)) }));
  assert.deepEqual({ baselines: graphs.map(baselines), refinement: colorRefinement(graphs) }, independent);
});
test("source locks reject missing, changed and undeclared helper dependencies", async () => {
  const ref = await readJson("reference.json"), numbers = await readJson("measurements.json");
  for (const mutate of [r => { delete r.sourceHashes["PROTOCOL.md"]; }, r => { r.sourceHashes["sources.json"] = "0".repeat(64); }, r => { r.sourceHashes.extra = "0".repeat(64); }]) {
    const r = structuredClone(ref); mutate(r); await assert.rejects(() => verifyReferences(r, numbers));
  }
  const n = structuredClone(numbers); delete n.sourceHashes["../flow/networkx_reference.py"];
  await assert.rejects(() => verifyReferences(ref, n));
});
