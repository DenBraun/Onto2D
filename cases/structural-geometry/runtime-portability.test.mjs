import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { digest, normalizeGraph } from "./datasets/scopes.mjs";
import { sampleNull } from "./robustness/nulls.mjs";
import { verifyPythonCosts } from "./runtime-compatibility.mjs";

const withoutResource = `
import importlib.abc, runpy, sys
class WithoutResource(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "resource":
            raise ModuleNotFoundError("resource is unavailable on Windows")
sys.modules.pop("resource", None)
sys.meta_path.insert(0, WithoutResource())
`;

test("reference score sums retain the declared binary64 order across Python versions", () => {
  const rows = [[1, 2 ** -53, -1], [0.1, 0.2, 0.3], [-0.2, 0.1, 0.1]];
  const result = spawnSync("python3", ["-B", "-c", `
import json, runpy, sys
reference = runpy.run_path(sys.argv[1], run_name="portability_review")
print(json.dumps([reference["sequential_sum"](row) for row in json.load(sys.stdin)]))
`, fileURLToPath(new URL("dream4/reference.py", import.meta.url))],
  { input: JSON.stringify(rows), encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), rows.map(row => row.reduce((sum, value) => sum + value, 0)));
});

test("every biological Python entry point imports without the Unix resource module", () => {
  const files = ["celegans/extract.py", "celegans/reference.py", "robustness/reference.py",
    "robustness/anatomy/reference.py", "robustness/capacity/reference.py",
    "robustness/metric/reference.py", "robustness/scope/reference.py"];
  const result = spawnSync("python3", ["-B", "-c", `${withoutResource}
for source in sys.argv[1:]:
    runpy.run_path(source, run_name="portability_review")
`, ...files.map(path => fileURLToPath(new URL(path, import.meta.url)))], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});

test("independent null sampling retains its result and explicitly marks unavailable memory", () => {
  const graph = normalizeGraph({ nodes: ["a", "b", "c", "d"],
    edges: ["ab", "ac", "bd", "cd"].map(([source, target]) => ({ source, target })) });
  const input = { datasetId: "control", root: null, graph, originalGraphSha256: digest(graph), nullIndex: 0 };
  const result = spawnSync("python3", ["-B", "-c", `${withoutResource}
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
`, fileURLToPath(new URL("robustness/reference.py", import.meta.url)), "--sampler"],
  { input: JSON.stringify(input), encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.result, sampleNull(input));
  assert.equal(output.costs.pythonPeakRssBytes, null);
  assert.equal(output.costs.pythonPeakRssReason, "resource-module-unavailable");
  verifyPythonCosts(output.costs);
});

test("reference costs distinguish measured memory from unavailable memory", () => {
  verifyPythonCosts({ elapsedMs: 10, pythonPeakRssBytes: 1024 });
  verifyPythonCosts({ elapsedMs: 10, pythonPeakRssBytes: null, pythonPeakRssReason: "resource-module-unavailable" });
  for (const costs of [
    { elapsedMs: 10, pythonPeakRssBytes: null },
    { elapsedMs: 10, pythonPeakRssBytes: -1 },
    { elapsedMs: NaN, pythonPeakRssBytes: 1024 },
    { elapsedMs: 10, pythonPeakRssBytes: 0, pythonPeakRssReason: "resource-module-unavailable" }
  ]) assert.throws(() => verifyPythonCosts(costs));
});
