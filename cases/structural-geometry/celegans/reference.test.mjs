import assert from "node:assert/strict";
import test from "node:test";
import { pairCoordinates } from "../dream4/geometry.mjs";
import { python } from "./io.mjs";

test("independent Bellman-Ford and predecessor unions verify larger rooted scopes", async () => {
  const controls = [5, 11, 14].map(n => {
    const nodes = Array.from({ length: n }, (_, i) => `v${String(i).padStart(2, "0")}`);
    const edges = nodes.slice(1).flatMap((node, i) => [{ source: nodes[i], target: node }, ...(i > 1 ? [{ source: node, target: nodes[0] }] : [])]);
    const q = (a, b = 1) => ({ numerator: String(a), denominator: String(b) });
    return { graph: { nodes, edges }, fields: edges.map((_, i) => ({ forman: q(2 - i), ollivier: q(i - 3, 7),
      length: q(i + 1, 5), curvature: q(i - 5, i + 1) })), termination: { iteration: 4, reason: "iteration-limit" } };
  });
  const expected = await python("reference.py", ["--geometry"], controls, { timeout: 30000 });
  for (const [i, control] of controls.entries()) {
    assert.deepEqual(pairCoordinates(control.graph, control.fields, control.termination).pairs, expected[i]);
  }
});
