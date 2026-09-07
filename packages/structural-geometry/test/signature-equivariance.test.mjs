import assert from "node:assert/strict";
import test from "node:test";
import { buildModelPack } from "@onto2d/model-pack";
import { runStructuralResponseSignature } from "@onto2d/structural-geometry/signature";
import { packFor } from "../../../cases/structural-geometry/typed/fixtures.mjs";
import { fixtures, readJson } from "../../../cases/structural-geometry/signatures/fixtures.mjs";

const controls = await readJson("../responses/controls.json");
const permutations = values => !values.length ? [[]] : values.flatMap((x, i) => permutations(values.filter((_, j) => j !== i)).map(rest => [x, ...rest]));
function renamed(pack, input, permutation) {
  const original = pack.files["model/nodes.json"], ids = new Map(original.map((n, i) => [n.id, `${permutation[i] % 2 ? "\u{10000}" : "\ue000"} node ${permutation[i]} \n`]));
  const edges = pack.files["model/edges.json"];
  return { pack: buildModelPack({ model: { ...pack.manifest.model, id: `signature-transport-${permutation.join("-")}` }, source: pack.manifest.source,
    nodes: [...original].reverse().map(n => ({ ...n, id: ids.get(n.id), label: "changed", presentation: { x: 42 } })),
    edges: [...edges].reverse().map((e, i) => ({ ...e, id: `renamed edge ${i} `, source: ids.get(e.source), target: ids.get(e.target), label: "changed" })),
    dictionaries: pack.files["model/dictionaries.json"] }),
    input: input.scope?.kind === "induced" ? { ...input, scope: { kind: "induced", nodeIds: input.scope.nodeIds.map(id => ids.get(id)).reverse() } } : input };
}
const values = a => ({ profile: a.profile, value: a.value, valueHash: a.valueHash, summary: a.summary,
  features: a.features.map(f => ({ id: f.id, state: f.state, value: f.value, valueHash: f.valueHash, coverage: f.coverage, reasons: f.reasons })) });
const run = f => runStructuralResponseSignature(f.pack, f.input);

test("all 393 small-graph topology bijections preserve every complete feature and incomplete reason, beyond null whole values", () => {
  let count = 0;
  for (let n = 1; n <= 3; n += 1) {
    const pairs = Array.from({ length: n }, (_, u) => Array.from({ length: n }, (_, v) => u === v ? [] : [[u, v]])).flat(2);
    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
      const pack = packFor({ id: `signature-equivariance-${n}-${mask}`, nodes: n,
        edges: pairs.filter((_, i) => mask & (1 << i)).map(([from, to]) => ({ from, to, types: controls.types[controls.censusType] })) });
      const input = { regimeId: "topology-only-v1" }, original = values(run({ pack, input }));
      for (const permutation of permutations(Array.from({ length: n }, (_, i) => i))) {
        assert.deepEqual(values(run(renamed(pack, input, permutation))), original); count += 1;
      }
    }
  }
  assert.equal(count, 393);
});
test("all 72 complete diamond-feedback regime bijections preserve feature fingerprints while provenance changes", async () => {
  const examples = await fixtures();
  for (const id of ["diamond-feedback-typed", "diamond-feedback-canonical-structure-v1", "diamond-feedback-topology-only-v1"]) {
    const f = examples.find(f => f.id === id), original = run(f);
    assert.equal(original.summary.status, "complete");
    for (const permutation of permutations([0, 1, 2, 3])) {
      const a = run(renamed(f.pack, f.input, permutation));
      assert.deepEqual(values(a), values(original)); assert.notEqual(a.artifactHash, original.artifactHash);
    }
  }
});
test("induced scope membership, opaque identifiers and missing selector evidence survive transported source renaming", async () => {
  const examples = await fixtures();
  for (const id of ["boundary", "opaque", "missing-necessity", "missing-role"]) {
    const f = examples.find(f => f.id === id), permutation = f.pack.files["model/nodes.json"].map((_, i, nodes) => nodes.length - 1 - i);
    assert.deepEqual(values(run(renamed(f.pack, f.input, permutation))), values(run(f)));
  }
});
