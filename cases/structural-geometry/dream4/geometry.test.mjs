import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { analyzeStructuralGeometry } from "@onto2d/structural-geometry";
import { createOllivierAnalyzer } from "@onto2d/structural-geometry/ollivier";
import { createPythonOllivierAdapter } from "@onto2d/structural-geometry/ollivier/node";
import { createStructuralFlowAnalyzer } from "@onto2d/structural-geometry/flow";
import { createPythonStructuralFlowAdapter } from "@onto2d/structural-geometry/flow/node";
import { enumerateScopes, scopePack } from "../datasets/scopes.mjs";
import { pairCoordinates, rationalNumber, collectPairGeometry, FLOW_INPUT, GEOMETRY_FEATURE_NAMES } from "./geometry.mjs";

const q = (n, d = 1) => ({ numerator: String(n), denominator: String(d) });
const control = (nodes, pairs) => ({ graph: { nodes, edges: pairs.map(([source, target]) => ({ source, target })) },
  fields: pairs.map((_, i) => ({ forman: q(i - 2), ollivier: q(i - 1, i + 2), length: q(i + 1, 3), curvature: q(2 - i, i + 1) })),
  termination: { iteration: 2, reason: "tolerance" } });
const controls = [
  control(["a", "b", "c", "d", "e", "isolated"], [["a", "b"], ["b", "c"], ["b", "d"], ["c", "e"], ["d", "e"]]),
  control(["a", "b", "c"], [["a", "b"], ["b", "a"], ["b", "c"], ["a", "c"], ["c", "a"]]),
  control(["a", "b", "isolated"], [["a", "b"]]),
  control(["a", "b"], [])
];

test("all pair coordinates agree exactly with independent Fraction path enumeration", () => {
  const result = spawnSync("python3", ["-B", fileURLToPath(new URL("reference.py", import.meta.url)), "--geometry"],
    { input: JSON.stringify(controls), encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const expected = JSON.parse(result.stdout);
  controls.forEach((value, i) => {
    const actual = pairCoordinates(value.graph, value.fields, value.termination);
    assert.equal(actual.featureNames.length, 31);
    assert.deepEqual(actual.pairs, expected[i]);
  });
});

test("shared shortest-path edges are counted once; absent sets retain baseline masks", () => {
  const value = controls[0], result = pairCoordinates(value.graph, value.fields, value.termination);
  const pair = result.pairs.find(p => p.source === "a" && p.target === "e");
  assert.deepEqual(pair.exact[5], q(0), "Union includes all five edges once, not six path incidences");
  const missing = result.pairs.find(p => p.source === "isolated" && p.target === "a");
  assert.equal(missing.baseline[14], 1);
  assert.deepEqual(missing.exact[24], q(0));
  assert.equal(pair.baseline[14], 0);
  assert.ok(pair.geometry[24] > 0);
});

test("rational conversion rounds once, handles subnormals and rejects lost magnitudes", () => {
  assert.equal(rationalNumber(q(1, 3)), 1 / 3);
  assert.equal(rationalNumber([(1n << 53n) + 1n, 1n << 53n]), 1);
  assert.equal(rationalNumber([(1n << 53n) + 3n, 1n << 53n]), 1 + 2 ** -51);
  assert.equal(rationalNumber([1n, 1n << 1074n]), Number.MIN_VALUE);
  assert.equal(rationalNumber([3n, 1n << 1075n]), 2 * Number.MIN_VALUE);
  assert.throws(() => rationalNumber([1n, 1n << 1075n]), /underflow/);
  assert.throws(() => rationalNumber([1n << 1024n, 1n]), /overflow/);
  assert.throws(() => rationalNumber({ lowerTicks: "1", upperTicks: "2" }), /exact rational/);
  assert.throws(() => rationalNumber(q(1, 0)), /exact rational/);
});

test("collector verifies source-bound receipts and uses actual early terminal state", async () => {
  const graph = { nodes: ["a", "b", "c"], edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }] };
  const scope = enumerateScopes(graph)[0];
  const { pack, mapping } = scopePack(scope, [{ path: "synthetic", hash: `sha256:${"0".repeat(64)}` }], "synthetic");
  const artifacts = {
    forman: analyzeStructuralGeometry(pack),
    ollivier: await createOllivierAnalyzer(createPythonOllivierAdapter()).analyze(pack, {
      edgeIds: pack.files["model/edges.json"].map(e => e.id), idleness: "half" }),
    flow: await createStructuralFlowAnalyzer(createPythonStructuralFlowAdapter()).analyze(pack, FLOW_INPUT)
  };
  const input = { graph, pack, mapping, artifacts }, original = structuredClone(input);
  const result = collectPairGeometry(input);
  assert.deepEqual(input, original);
  assert.ok(result.termination.iteration < 4);
  assert.equal(result.termination.reason, "fixed-point");
  assert.equal(result.pairs[0].geometry[25], result.termination.iteration);
  assert.equal(result.pairs[0].geometry[26], 1);
  assert.equal(result.pairs[0].geometry[30], 0);
  const forged = structuredClone(input); forged.artifacts.flow.states.at(-1).edges[0].length.numerator = "99";
  assert.throws(() => collectPairGeometry(forged));
  const absent = structuredClone(input); delete absent.artifacts.ollivier;
  assert.throws(() => collectPairGeometry(absent));
  const mismatched = structuredClone(input); mismatched.graph.edges.pop();
  assert.throws(() => collectPairGeometry(mismatched));
  const wrong = structuredClone(input); wrong.mapping[0].nodeId = wrong.mapping[1].nodeId;
  assert.throws(() => collectPairGeometry(wrong));
});

test("terminal fields reject missing entries, zero lengths, intervals and excess horizons", () => {
  const value = controls[0];
  assert.throws(() => pairCoordinates(value.graph, value.fields.slice(1), value.termination));
  const zeroLength = structuredClone(value); zeroLength.fields[0].length = q(0);
  assert.throws(() => pairCoordinates(zeroLength.graph, zeroLength.fields, value.termination), /positive/);
  const interval = structuredClone(value); interval.fields[0].ollivier = { lowerTicks: "0", upperTicks: "1" };
  assert.throws(() => pairCoordinates(interval.graph, interval.fields, value.termination), /exact rational/);
  assert.throws(() => pairCoordinates(value.graph, value.fields, { iteration: 5, reason: "iteration-limit" }));
  assert.equal(new Set(GEOMETRY_FEATURE_NAMES).size, 31);
});
