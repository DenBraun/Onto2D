import assert from "node:assert/strict";
import test from "node:test";
import { buildModelPack } from "@onto2d/model-pack";
import { compareStructuralSignatures } from "@onto2d/structural-geometry/pseudometric";
import { fixtures, readJson } from "../../../cases/structural-geometry/pseudometric/fixtures.mjs";
const examples = await fixtures(), original = examples[0].left.pack, nodes = original.files["model/nodes.json"];
const ids = new Map(nodes.map((n, i) => [n.id, `${i % 2 ? "\u{10000}" : "\ue000"} node ${nodes.length - i} \n`]));
const renamed = buildModelPack({ model: { ...original.manifest.model, id: "pseudometric-transport" }, source: original.manifest.source,
  dictionaries: original.files["model/dictionaries.json"],
  nodes: [...nodes].reverse().map(n => ({ ...n, id: ids.get(n.id), label: "changed", presentation: { x: 17 } })),
  edges: [...original.files["model/edges.json"]].reverse().map((e, i) => ({ ...e, id: `new edge ${i}`, source: ids.get(e.source), target: ids.get(e.target), label: "changed" })) });
const scope = s => ({ kind: "induced", nodeIds: s.nodeIds.map(id => ids.get(id)).reverse() });

test("all 48 complete scope-pair distances survive simultaneous whole-source transport, including typed domains", async () => {
  for (const f of examples.slice(0, 48)) {
    const before = await readJson(`artifacts/${f.id}.json`), input = { ...f.input, leftScope: scope(f.input.leftScope), rightScope: scope(f.input.rightScope) };
    const a = compareStructuralSignatures(renamed, renamed, input);
    for (const k of ["distance", "status", "coverage", "components", "diagnostics", "profile", "work"]) assert.deepEqual(a[k], before[k], `${f.id}: ${k}`);
    assert.equal(a.domains.compatible, true); assert.notEqual(a.artifactHash, before.artifactHash);
    assert.equal(a.domains.commonDomainHash === before.domains.commonDomainHash, f.input.regimeId !== "typed-relations-v1");
  }
});
test("one-sided untyped transport is zero, typed transport needs its own domain, and scope array order normalizes", async () => {
  for (const regime of ["canonical-structure-v1", "topology-only-v1", "typed-relations-v1"]) {
    const f = examples.find(f => f.input.regimeId === regime), a = compareStructuralSignatures(original, renamed, { ...f.input, rightScope: scope(f.input.rightScope) });
    assert.equal(a.domains.compatible, regime !== "typed-relations-v1");
    assert.deepEqual(a.distance, regime === "typed-relations-v1" ? null : { numerator: 0, denominator: 1 });
    const reordered = compareStructuralSignatures(original, original, { ...f.input,
      leftScope: { kind: "induced", nodeIds: [...f.input.leftScope.nodeIds].reverse() }, rightScope: { kind: "induced", nodeIds: [...f.input.rightScope.nodeIds].reverse() } });
    assert.deepEqual(reordered, await readJson(`artifacts/${f.id}.json`));
  }
});
