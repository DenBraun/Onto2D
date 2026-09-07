import assert from "node:assert/strict";
import test from "node:test";
import { buildModelPack } from "@onto2d/model-pack";
import { buildGeometricSignature } from "@onto2d/structural-geometry/geometric-signature";
import { fixtures, readJson } from "../../../cases/structural-geometry/geometric-signatures/fixtures.mjs";
import { computeEvidence } from "../../../cases/structural-geometry/geometric-signatures/build.mjs";

test("all 25 source/request transports preserve geometric values, degree roles, intervals, coverage and stopping events", async () => {
  for (const f of await fixtures()) {
    const original = await readJson(`artifacts/${f.id}.json`), nodes = f.pack.files["model/nodes.json"], edges = f.pack.files["model/edges.json"];
    const nodeIds = new Map(nodes.map((n, i) => [n.id, `${i % 2 ? "\u{10000}" : "\ue000"} node ${nodes.length - i} \n`]));
    const edgeIds = new Map(edges.map((e, i) => [e.id, ` edge ${edges.length - i} \n`]));
    const pack = buildModelPack({ model: { ...f.pack.manifest.model, id: `geometric-transport-${f.id}` }, source: f.pack.manifest.source,
      nodes: [...nodes].reverse().map(n => ({ ...n, id: nodeIds.get(n.id), label: "transported", presentation: { x: 42 } })),
      edges: [...edges].reverse().map(e => ({ ...e, id: edgeIds.get(e.id), source: nodeIds.get(e.source), target: nodeIds.get(e.target), label: "transported" })),
      dictionaries: f.pack.files["model/dictionaries.json"] });
    const input = structuredClone(f.input);
    for (const name of ["ollivier", "flow"]) {
      if (input[name]?.scope?.kind === "induced") input[name].scope.nodeIds = input[name].scope.nodeIds.map(id => nodeIds.get(id)).reverse();
    }
    if (input.ollivier) input.ollivier.edgeIds = input.ollivier.edgeIds.map(id => edgeIds.get(id)).reverse();
    if (input.flow?.initialLengths) input.flow.initialLengths = input.flow.initialLengths.map(e => ({ ...e, edgeId: edgeIds.get(e.edgeId) })).reverse();
    const transformed = { ...f, pack, input }, a = buildGeometricSignature(pack, input, await computeEvidence(transformed));
    for (const k of ["profile", "summary", "value", "valueHash", "work"]) assert.deepEqual(a[k], original[k], `${f.id}: ${k}`);
    const values = a => a.features.map(({ id, state, value, valueHash, coverage, reasons }) => ({ id, state, value, valueHash, coverage, reasons }));
    assert.deepEqual(values(a), values(original), f.id); assert.notEqual(a.artifactHash, original.artifactHash);
    const mapped = list => list.map(id => edgeIds.get(id)).sort();
    for (const index of [0, 1]) if (a.features[index].provenance) {
      for (const extreme of ["minimum", "maximum"]) for (const kind of ["possibleEdgeIds", "certainEdgeIds"]) {
        assert.deepEqual(a.features[index].provenance[extreme][kind], mapped(original.features[index].provenance[extreme][kind]), f.id);
      }
    }
    if (a.features[2].provenance) assert.deepEqual([...a.features[2].provenance.cuts.removedEdgeIds].sort(), mapped(original.features[2].provenance.cuts.removedEdgeIds));
  }
});
